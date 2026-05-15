import type { TurnContext } from '../types';
import type { TurnPlan } from '../nlu/turnPlanSchema';
import type { ClassifiedTurn } from '../nlu/types';
import type { TurnFactPacket, VerifiedVariant } from '../nlu/turnFactPacket';
import type { OrderState, SlotKey } from './stateContract';
import {
  normalizeName,
  normalizeAddress,
  matchVariantInMessage,
  parseQuantityFromMessage,
} from '../utils/valueNormalizers';
import { validatePhoneForStore } from '../utils/phoneValidation';
import { resolveDeliveryZoneSmart } from '../delivery/resolveDeliveryZoneSmart';

/**
 * SUCCESS: the slot was parsed cleanly. Orchestrator should rewrite
 * ctx.message to canonicalMessage so legacy handlers see a clean
 * value, then route normally to the slot-specific handler.
 *
 * RETRY: the customer attempted the slot but the value was invalid
 * (bad phone, OOS variant). Orchestrator should short-circuit and
 * return retryPrompt as the reply — NEVER let the bot claim the
 * slot was saved.
 *
 * PASS: this state has no expected slot, OR the customer's message
 * isn't slot-shaped (they're asking a question, browsing, etc.).
 * Continue to generic routing.
 */
export type SlotConsumptionResult =
  | {
      kind: 'success';
      slotKey: SlotKey;
      canonicalMessage: string;
      handlerHintIntent: string;
      reason: string;
    }
  | {
      kind: 'retry';
      slotKey: SlotKey;
      retryPrompt: string;
      reason: string;
    }
  | {
      kind: 'pass';
      reason: string;
    };

// Phase E+ interrupt guard: at the four checkout-slot states, refuse
// to consume questions or product-search/switch interrupts as slot
// fills. Without this, "how much is delivery to kumasi?" was committed
// as deliveryId, and "let me see the graphic bodysuit" was saved to
// customer.address. We return `pass` so the normal classifier+policy
// path routes the message correctly instead.
const QUESTION_START_RE =
  /^(how|what|where|when|why|which|who|do|does|is|are|will|would|should|can|could|may)\b/i;

const PRODUCT_INTERRUPT_RE =
  /\b(let me see|let me look|let me check|show me|show the|i want to see|i want to look|look for|looking for|i'?m looking for|do you have|do you sell|got any|have you got|find me|get me|any chance you (have|sell)|i want|i need|want|need)\b/i;

// Bundle A: bare meta messages (greetings, thanks, acks). Anchored so
// only whole-message matches qualify — "ok weija block" still flows to
// the address consumer normally.
const META_NOISE_RE =
  /^(hi|hello|hey|yo|good\s+(morning|afternoon|evening|day|night)|thanks|thank\s+you|ok|okay|alright)\s*[!.?]*$/i;

const INTERRUPT_GUARD_STATES: ReadonlySet<OrderState> = new Set<OrderState>([
  'AWAITING_DELIVERY_AREA',
  'AWAITING_ADDRESS',
  'AWAITING_PHONE',
  'AWAITING_NAME',
]);

function looksLikeInterrupt(
  message: string,
): { isInterrupt: true; reason: string } | { isInterrupt: false } {
  const trimmed = message.trim();
  if (!trimmed) return { isInterrupt: false };
  if (trimmed.includes('?')) {
    return { isInterrupt: true, reason: 'question_mark' };
  }
  if (QUESTION_START_RE.test(trimmed)) {
    return { isInterrupt: true, reason: 'starts_with_question_word' };
  }
  if (PRODUCT_INTERRUPT_RE.test(trimmed)) {
    return { isInterrupt: true, reason: 'product_interrupt_phrase' };
  }
  if (META_NOISE_RE.test(trimmed)) {
    return { isInterrupt: true, reason: 'meta_noise' };
  }
  return { isInterrupt: false };
}

export async function consumeExpectedSlot(
  ctx: TurnContext,
  turnPlan: TurnPlan | null,
  classification: ClassifiedTurn | null,
  factPacket: TurnFactPacket | null,
): Promise<SlotConsumptionResult> {
  const state = (ctx.commerceState?.state || 'IDLE') as OrderState;
  const message = ctx.message || '';
  const focus = factPacket?.facts.contextProducts?.focusProduct;

  if (INTERRUPT_GUARD_STATES.has(state)) {
    const guard = looksLikeInterrupt(message);
    if (guard.isInterrupt) {
      return { kind: 'pass', reason: `interrupt_guard:${guard.reason}` };
    }
  }

  switch (state) {
    case 'AWAITING_VARIANT':
      return tryConsumeVariant(message, focus);

    case 'AWAITING_QUANTITY':
      return tryConsumeQuantity(message, turnPlan, classification);

    case 'AWAITING_DELIVERY_AREA':
      return await tryConsumeDeliveryArea(message, ctx);

    case 'AWAITING_ADDRESS':
      return tryConsumeAddress(message, ctx, turnPlan);

    case 'AWAITING_PHONE':
      return tryConsumePhone(message, ctx, turnPlan);

    case 'AWAITING_NAME':
      return tryConsumeName(message, turnPlan);

    default:
      return { kind: 'pass', reason: 'no_expected_slot_at_state' };
  }
}

// ─── PER-SLOT CONSUMERS ────────────────────────────────────────────

function tryConsumeVariant(
  message: string,
  focus: any,
): SlotConsumptionResult {
  if (!focus || !Array.isArray(focus.variants) || focus.variants.length === 0) {
    return { kind: 'pass', reason: 'no_focus_variants' };
  }

  const matched = matchVariantInMessage(message, focus.variants) as
    | VerifiedVariant
    | null;
  if (!matched) {
    return { kind: 'pass', reason: 'no_variant_matched_in_message' };
  }

  if (matched.inStock === false) {
    return {
      kind: 'retry',
      slotKey: 'variantId',
      retryPrompt: `Sorry please, the ${matched.name} option is currently sold out. Would you like to pick a different option?`,
      reason: 'variant_matched_but_out_of_stock',
    };
  }

  // Canonical message: the matched variant's exact name. Legacy
  // handleVariantReply parses cleanly from this.
  return {
    kind: 'success',
    slotKey: 'variantId',
    canonicalMessage: matched.name,
    handlerHintIntent: 'provide_variant_choice',
    reason: 'variant_matched_and_in_stock',
  };
}

function tryConsumeQuantity(
  message: string,
  turnPlan: TurnPlan | null,
  classification: ClassifiedTurn | null,
): SlotConsumptionResult {
  // Try the extractor's slot first
  const planQty = extractQuantityFromTurnPlan(turnPlan);
  if (planQty !== null) {
    return successQuantity(planQty, 'turn_plan_quantity');
  }
  // Try classifier slots
  const classQty = (classification as any)?.slots?.quantity;
  if (typeof classQty === 'number' && classQty >= 1 && classQty <= 999) {
    return successQuantity(classQty, 'classifier_quantity');
  }
  // Deterministic regex parse (covers "add 1 set", "make it 2", etc.)
  const parsed = parseQuantityFromMessage(message);
  if (parsed !== null) {
    return successQuantity(parsed, 'regex_parsed_quantity');
  }
  return { kind: 'pass', reason: 'no_quantity_parsed' };
}

function successQuantity(n: number, reason: string): SlotConsumptionResult {
  return {
    kind: 'success',
    slotKey: 'quantity',
    canonicalMessage: String(n),
    handlerHintIntent: 'provide_quantity',
    reason,
  };
}

async function tryConsumeDeliveryArea(
  message: string,
  ctx: TurnContext,
): Promise<SlotConsumptionResult> {
  const zones = (ctx as any).deliveries || (ctx as any).deliveryZones || [];
  const result = await resolveDeliveryZoneSmart(message, zones, ctx.storeId);

  if (result.status === 'single_match' && result.zone) {
    // Use the customer's original message as the canonical value.
    // It's already been validated as resolving to a single zone, so
    // legacy handleDeliveryReply will re-resolve it the same way.
    // This avoids depending on field names like .name/.displayName
    // that vary across DeliveryZoneV2 implementations.
    return {
      kind: 'success',
      slotKey: 'deliveryId',
      canonicalMessage: message.trim(),
      handlerHintIntent: 'provide_delivery_zone',
      reason: 'zone_single_match',
    };
  }
  if (result.status === 'multiple_matches') {
    return { kind: 'pass', reason: 'zone_multiple_matches' };
  }
  return { kind: 'pass', reason: 'zone_not_resolved' };
}

function tryConsumeAddress(
  message: string,
  ctx: TurnContext,
  turnPlan: TurnPlan | null,
): SlotConsumptionResult {
  const planAddress = (turnPlan as any)?.checkoutSlots?.addressText;
  const candidate = (planAddress || message || '').trim();
  const normalized = normalizeAddress(candidate);
  if (!normalized) {
    return { kind: 'pass', reason: 'address_unparseable' };
  }

  // Guard: if zone is already set and the candidate is a single
  // short token (likely a city correction, not an address), don't
  // consume — the customer is probably correcting the zone, not
  // providing an address.
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const zoneAlreadySet = !!(ctx.commerceState as any)?.deliveryZoneId;
  if (zoneAlreadySet && tokens.length === 1 && normalized.length < 15) {
    return { kind: 'pass', reason: 'looks_like_zone_correction' };
  }

  return {
    kind: 'success',
    slotKey: 'address',
    canonicalMessage: normalized,
    handlerHintIntent: 'provide_address',
    reason: 'address_normalized',
  };
}

function tryConsumePhone(
  message: string,
  ctx: TurnContext,
  turnPlan: TurnPlan | null,
): SlotConsumptionResult {
  const planPhone = (turnPlan as any)?.checkoutSlots?.phone;
  const candidate = (planPhone || message || '').trim();

  // Only intercept if the candidate LOOKS like a phone attempt.
  // Rule: at least 7 consecutive digits somewhere in the cleaned text.
  // This mirrors the legacy extractPhone behaviour — non-phone-shaped
  // messages ("you have all the details already", "i don't know") pass
  // through to generic routing instead of being treated as bad phones.
  const digitsOnly = candidate.replace(/[\s\-+()]/g, '');
  const looksLikePhoneAttempt = /\d{7,}/.test(digitsOnly);
  if (!looksLikePhoneAttempt) {
    return { kind: 'pass', reason: 'message_not_phone_shaped' };
  }

  const validated = validatePhoneForStore(candidate, ctx);
  if (!validated) {
    return {
      kind: 'retry',
      slotKey: 'phone',
      retryPrompt: `That number does not look right please. Could you check it and send a valid phone number?`,
      reason: 'phone_invalid',
    };
  }
  return {
    kind: 'success',
    slotKey: 'phone',
    canonicalMessage: validated,
    handlerHintIntent: 'provide_phone',
    reason: 'phone_validated',
  };
}

function tryConsumeName(
  message: string,
  turnPlan: TurnPlan | null,
): SlotConsumptionResult {
  const planName = (turnPlan as any)?.checkoutSlots?.name;
  const candidate = (planName || message || '').trim();
  const normalized = normalizeName(candidate);
  if (!normalized) {
    return { kind: 'pass', reason: 'name_unparseable' };
  }
  return {
    kind: 'success',
    slotKey: 'name',
    canonicalMessage: normalized,
    handlerHintIntent: 'provide_name',
    reason: 'name_normalized',
  };
}

// ─── HELPERS ───────────────────────────────────────────────────────

function extractQuantityFromTurnPlan(plan: TurnPlan | null): number | null {
  if (!plan) return null;
  const fromPlan = (plan as any)?.slots?.quantity;
  if (typeof fromPlan === 'number' && fromPlan >= 1 && fromPlan <= 999) return fromPlan;
  const task = plan.tasks?.find((t: any) => t.intent === 'provide_quantity');
  const fromTask = (task as any)?.slots?.quantity;
  if (typeof fromTask === 'number' && fromTask >= 1 && fromTask <= 999) return fromTask;
  return null;
}