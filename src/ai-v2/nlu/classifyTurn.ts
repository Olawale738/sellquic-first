import type { TurnContext } from '../types';
import type { ClassifiedTurn, Intent, Slots } from './types';
import { intentIsInterrupt } from './types';

import { normalizeText, tokenize } from '../catalog/normalize';
import { extractPhone } from '../extractors/extractPhone';
import { extractCombinedOrderIntent, buildVariantVocab } from '../extractors/extractCombinedOrderIntent';
import { extractConfirmation } from '../extractors/extractConfirmation';
import { extractQuantity } from '../extractors/extractQuantity';
import { extractOrdinalSelection } from '../extractors/extractOrdinalSelection';

import { extractOrderReference } from '../extractors/extractOrderReference';
import { detectsClearCartIntent } from '../extractors/cartUpdateVocab';
import { extractConfirmationFromVocab } from '../extractors/confirmationVocab';
import {
  classifyQuestionIntent,
  detectsCompoundCommerceAction,
} from '../orchestrator/classifyQuestionIntent';
import type { QuestionIntent } from '../knowledge/types';

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────


function collectVariantTokens(product: any): Set<string> {
  const tokens = new Set<string>();
  for (const v of (product?.variants ?? []) as any[]) {
    for (const w of String(v?.name || '').toLowerCase().split(/[^a-z0-9]+/)) {
      if (w.length >= 2) tokens.add(w);
    }
  }
  return tokens;
}

/**
 * Layer-1 deterministic classifier. Single source of truth for "what does
 * this message mean, given the current state".
 *
 * Returns a ClassifiedTurn for every input. Confidence:
 *   - 'high'   : matched a strong signal (regex, vocab, exact catalog token)
 *   - 'medium' : ambiguous between two reasonable interpretations
 *   - 'low'    : best guess only — caller may want to invoke layer 2/3
 *
 * 
 
 * Pure function except for catalog reads from ctx. No I/O, no Firestore,
 * no executor calls. Never decides commerce truth — only meaning.
 */
export function classifyTurn(ctx: TurnContext): ClassifiedTurn {
  const raw = String(ctx.message || '').trim();

  if (raw.length === 0) {
    return {
      intent: 'meta_unknown',
      slots: {},
      confidence: 'high',
      source: 'deterministic',
      isInterrupt: false,
      reason: 'deterministic:empty_message',
    };
  }

  // 1. META — greetings/thanks beat everything except handover.
  const meta = tryMeta(raw);
  if (meta) return meta;

  // 2. HANDOVER request — highest-priority command.
  const handover = tryHandover(raw);
  if (handover) return handover;

  // 3. EXPLICIT COMMANDS — change address/delivery, payment issue, order
  //    status, catalog discovery, clear cart, show cart, add-more bare.
 // 3b. QUESTIONS go BEFORE commands. "How much is X?" is a question,
  // not a product-search command, even when X happens to match a
  // catalog token. The slot-ownership guard for AWAITING_ADDRESS still
  // applies — address fragments aren't questions.
  const looksLikeQuestion =
    raw.includes('?') ||
    /\b(how|what|where|when|why|which|who|do|does|is|are|will|would|should)\b/i.test(raw);
  const isStrictAddressState =
    ctx.commerceState.state === 'AWAITING_ADDRESS' && !looksLikeQuestion;

  if (looksLikeQuestion && !isStrictAddressState) {
    const question = tryQuestion(ctx, raw);
    if (question) return question;
  }

  const command = tryCommand(raw);
  if (command) return command;

  

  // 5. COMBINED ORDER — product + (qty or variant) in one message.
  const variantVocab = buildVariantVocab(ctx.products ?? []);
const combined = tryCombinedOrder(raw, variantVocab);
if (combined) return combined;

  // 6. STATE-EXPECTED SLOT — try to read the current state's expected slot.
  //    Importantly, this runs BEFORE generic catalog/zone fallbacks so
  //    "tamale" in AWAITING_DELIVERY_AREA is a zone, "behind the mosque"
  //    in AWAITING_ADDRESS is an address, etc.
  const expected = tryExpectedSlot(ctx);
  if (expected) return expected;

  // 7. SLOT-AGNOSTIC FALLBACKS — confirmations, ordinals, catalog tokens.
  const fallback = tryFallback(ctx, raw);
  if (fallback) return fallback;

  // 8. Final: meta_unknown.
  return {
    intent: 'meta_unknown',
    slots: {},
    confidence: 'low',
    source: 'deterministic',
    isInterrupt: false,
    reason: 'deterministic:no_match',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Meta
// ─────────────────────────────────────────────────────────────────────────────

const GREETING_RE =
  /^(hi|hello|hey|good morning|good afternoon|good evening|yo|sup)\s*[!.?]?$/i;

const THANKS_RE =
  /^(thanks|thank you|thank you please|ok thanks|okay thanks|alright thanks|alright,? thank you|thanks please|appreciate it|much appreciated)\s*[!.?]?$/i;

function tryMeta(raw: string): ClassifiedTurn | null {
  const t = raw.trim();
  if (GREETING_RE.test(t)) {
    return result('meta_greeting', {}, 'high', false, 'meta_greeting');
  }
  if (THANKS_RE.test(t)) {
    return result('meta_thanks', {}, 'high', false, 'meta_thanks');
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Handover
// ─────────────────────────────────────────────────────────────────────────────

const HANDOVER_RE =
  /\b(talk to (a |the )?(human|person|agent|seller|vendor)|speak to (a |the )?(human|person|agent|seller|vendor)|call me|can someone call|human being|real person|live agent)\b/i;

function tryHandover(raw: string): ClassifiedTurn | null {
  if (!HANDOVER_RE.test(normalizeText(raw))) return null;
  return result('command_handover', {}, 'high', true, 'command_handover');
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Commands
// ─────────────────────────────────────────────────────────────────────────────

// Order-status: must be asking about an EXISTING order, not requesting checkout/link.
// Negative lookahead blocks "where is the order link", "where is the link",
// "i want to order", "place an order", "create my order".
const ORDER_STATUS_RE =
  /\b(where is my order(?!\s+link)|where('?s| is) (my|the) (order(?!\s+(link|button|page))|delivery|package|parcel|shipment)|track (my |the )?order|order status|status of (my |the )?order|has my order (shipped|been delivered|arrived|come)|when will (my |the )?order|when (is|will) (my |the )?order (arriv|com|deliver))\b/i;

// Phrases that look order-statusy but aren't — checkout/link requests.
const ORDER_STATUS_NEGATIVE_RE =
  /\b(order link|checkout link|the link|send the link|resend|i want to order|i want to place|place an order|place my order|create (my |an )?order|new order|make (an |my )?order)\b/i;

const PAYMENT_ISSUE_RE =
  /\b(i (have )?paid|i'?ve paid|payment done|payment made|payment sent|made (the )?payment|sent (the )?(money|payment)|i transferred|i paid already)\b/i;

const CATALOG_DISCOVERY_RE =
  /^(what do (you|u) sell|what products do (you|u) have|show (me )?(your )?products|show (me )?(the )?menu|show (me )?(the )?catalog|show (me )?what (you|u) have|what (do )?(you|u) have|menu|catalog|products|browse|browsing)\s*\??$/i;

const CHANGE_ADDRESS_RE =
  /\b(change|update|edit|use|set|new|different)\b.*\b(address|landmark|house|location)\b|^(change address|new address|different address|address)\s*\??$/i;

const CHANGE_DELIVERY_RE =
  /\b(change|update|edit|switch|different|new)\b.*\b(delivery area|delivery|area|zone|location)\b|^(change delivery|change delivery area|different delivery)\s*\??$/i;

const CHANGE_NAME_RE =
  /\b(change|update|edit|use|set|new|different|fix|correct)\b.*\b(name|full name)\b|^(change (the )?name|wrong name|new name|different name)\s*\??$/i;

const CHANGE_PHONE_RE =
  /\b(change|update|edit|use|set|new|different|fix|correct)\b.*\b(number|phone( number)?|contact|mobile)\b|^(change (the )?(phone|number|contact)|wrong number|wrong phone|new number)\s*\??$/i;

const SHOW_CART_RE =
  /^(show (me )?(my )?cart|view (my )?cart|cart|cart summary|what is in my cart|what'?s in my cart|what have i ordered)\s*\??$/i;

 
const ADD_MORE_BARE_RE =
  /^(add|add more|add another|add another item|add more items|another one|one more|more items|i want more)\s*\.?$/i;

const REFUND_RE =
  /\b(refund|money back|i want my money|return my money|give me my money)\b/i;

const RETURN_RE =
  /\b(i want to return|i'?d like to return|return (this|the) (item|product|order)|send (this|it) back)\b/i;

const EXCHANGE_RE =
  /\b(exchange|swap (it|this) for|change for (a |the )?(different|right) (size|color|colour|item))\b/i;

const CANCEL_RE =
  /\b(cancel (my |the )?(order|purchase)|i want to cancel|don'?t want it anymore|cancel it)\b/i;

const DAMAGED_RE =
  /\b(damaged|broken|torn|ripped|cracked|spoilt|expired|leaking|smashed|crushed|defective)\b/i;

const WRONG_ITEM_RE =
  /\b(wrong (item|order|color|colour|size|product|thing)|not what i ordered|different from (what i|my) order|sent (me )?the wrong)\b/i;

const LATE_DELIVERY_RE =
  /\b(still (hasn'?t|has not) (come|arrived|delivered)|where is (my|the) (package|delivery)|delivery is late|order is late|it'?s been (\d+ |a |many )?(day|days|week|weeks)|why is (it|my order) taking so long|(takes|taking) too long)\b/i;

const GENERAL_COMPLAINT_RE =
  /\b(i want to complain|i have a complaint|this is bad|terrible service|poor service|unhappy with|not happy|disappointed|i'?m angry|frustrated|upset)\b/i;

function tryCommand(raw: string): ClassifiedTurn | null {
  const t = normalizeText(raw);

  if (ORDER_STATUS_RE.test(t) && !ORDER_STATUS_NEGATIVE_RE.test(t)) {
    const ref = extractOrderReference(raw);
    const slots: import('./types').Slots = {};
    if (ref?.kind === 'paymentReference') {
      slots.orderReference = ref.value;
      slots.orderId = ref.orderId;
    } else if (ref?.kind === 'orderId') {
      slots.orderId = ref.value;
    }
    return result('command_order_status', slots, 'high', true, 'command_order_status');
  }

  if (PAYMENT_ISSUE_RE.test(t))
    return result('command_payment_issue', {}, 'high', true, 'command_payment_issue');

  if (CATALOG_DISCOVERY_RE.test(t))
    return result('command_catalog_discovery', {}, 'high', true, 'command_catalog_discovery');

  if (CHANGE_ADDRESS_RE.test(t))
    return result('command_change_address', {}, 'high', true, 'command_change_address');

  if (CHANGE_DELIVERY_RE.test(t))
    return result('command_change_delivery', {}, 'high', true, 'command_change_delivery');

  if (CHANGE_NAME_RE.test(t))
    return result('command_change_name', {}, 'high', true, 'command_change_name');

  if (CHANGE_PHONE_RE.test(t))
    return result('command_change_phone', {}, 'high', true, 'command_change_phone');

  if (detectsClearCartIntent(raw))
    return result('command_clear_cart', {}, 'high', true, 'command_clear_cart');

  if (SHOW_CART_RE.test(t))
    return result('command_show_cart', {}, 'high', true, 'command_show_cart');

  if (detectsClearCartIntent(raw))
    return result('command_clear_cart', {}, 'high', true, 'command_clear_cart');

  // Cart line removal: "remove X", "delete X", "take X off", "take out X"
  // Must come BEFORE catalog-token fallback or "remove kumasi" routes
  // to product search instead of cart removal.
  const REMOVE_LINE_RE = /\b(remove|delete|take\s+(out|off))\b/i;
  if (REMOVE_LINE_RE.test(raw) && !detectsClearCartIntent(raw)) {
    return result(
      'command_cart_update',
      {},
      'high',
      true,
      'command_remove_line',
    );
  }

  if (SHOW_CART_RE.test(t))
    return result('command_show_cart', {}, 'high', true, 'command_show_cart');


  // Support intents — order matters, more specific before more general.
  // We look at raw (not normalized t) for damaged/wrong-item so we don't
  // miss capitalized words.
  if (DAMAGED_RE.test(raw))
    return result('command_damaged_item', captureOrderRefSlots(raw), 'high', true, 'command_damaged_item');

  if (WRONG_ITEM_RE.test(raw))
    return result('command_wrong_item', captureOrderRefSlots(raw), 'high', true, 'command_wrong_item');

  if (LATE_DELIVERY_RE.test(raw))
    return result('command_late_delivery', captureOrderRefSlots(raw), 'high', true, 'command_late_delivery');

  if (CANCEL_RE.test(raw))
    return result('command_cancel_order', captureOrderRefSlots(raw), 'high', true, 'command_cancel_order');

  if (EXCHANGE_RE.test(raw))
    return result('command_exchange_request', captureOrderRefSlots(raw), 'high', true, 'command_exchange_request');

  if (RETURN_RE.test(raw))
    return result('command_return_request', captureOrderRefSlots(raw), 'high', true, 'command_return_request');

  if (REFUND_RE.test(raw))
    return result('command_refund_request', captureOrderRefSlots(raw), 'high', true, 'command_refund_request');

  if (GENERAL_COMPLAINT_RE.test(raw))
    return result('command_general_complaint', {}, 'high', true, 'command_general_complaint');

  return null;
}

/**
 * Helper for support intents — pull any reference/phone out of the same
 * message ("my order SELLQUIC-... was damaged", "0244... it's broken").
 */
function captureOrderRefSlots(raw: string): Slots {
  const slots: Slots = {};
  const ref = extractOrderReference(raw);
  if (ref?.kind === 'paymentReference') {
    slots.orderReference = ref.value;
    slots.orderId = ref.orderId;
  } else if (ref?.kind === 'orderId') {
    slots.orderId = ref.value;
  }
  const phone = extractPhone(raw);
  if (phone) slots.phone = phone;
  return slots;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Questions (knowledge layer)
// ─────────────────────────────────────────────────────────────────────────────

const ASK_INTENT_MAP: Record<QuestionIntent, Intent> = {
  q_price: 'ask_price',
  q_stock: 'ask_stock',
  q_variants: 'ask_variants',
  q_delivery_fee: 'ask_delivery_fee',
  q_delivery_time: 'ask_delivery_time',
  q_payment_methods: 'ask_payment_methods',
  q_cod: 'ask_cod',
  q_refund_policy: 'ask_refund_policy',
  q_location: 'ask_location',
  q_hours: 'ask_hours',
  q_about_store: 'ask_about_store',
  q_cart_total: 'ask_cart_total',
  q_unknown: 'ask_unknown',
};

function tryQuestion(ctx: TurnContext, raw: string): ClassifiedTurn | null {
  const q = classifyQuestionIntent(raw);
  if (!q) return null;

  const intent = ASK_INTENT_MAP[q];
  const slots: Slots = { questionText: raw };

  // Slot-extract a delivery zone name when the question is delivery-related.
  // The knowledge layer uses this to compose "delivery to Tamale is GHS 80".
  if (intent === 'ask_delivery_fee' || intent === 'ask_delivery_time') {
    const zoneQuery = matchZoneInMessage(ctx, raw);
    if (zoneQuery) slots.zoneQuery = zoneQuery;
  }

  // Compound flag — log only in Step 1, processed by policy later.
  const compound = detectsCompoundCommerceAction(raw);

  return result(
    intent,
    slots,
    'high',
    intentIsInterrupt(intent),
    `question_${q}${compound ? '|compound' : ''}`,
    compound ? { intent: 'provide_quantity', slots: {} } : undefined,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Combined order
// ─────────────────────────────────────────────────────────────────────────────

function tryCombinedOrder(raw: string, variantVocab: Set<string>): ClassifiedTurn | null {
  const co = extractCombinedOrderIntent(raw, variantVocab);
  if (!co) return null;

  const slots: Slots = {};
  if (co.productQuery) slots.productQuery = co.productQuery;
  if (co.variantQuery) slots.variantQuery = co.variantQuery;
  if (co.quantity != null) slots.quantity = co.quantity;

  // Variant + qty without product = variant choice intent
  if (!co.productQuery && co.variantQuery) {
    return result(
      'provide_variant_choice',
      slots,
      'high',
      true,
      'combined_variant_no_product',
    );
  }

  return result(
    'provide_product_query',
    slots,
    'high',
    true,
    'combined_order',
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. State-expected slot
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tries to read the slot the current state is waiting for. This is what
 * makes "african market" in AWAITING_ADDRESS map to provide_address rather
 * than provide_product_query — the active state's expected slot wins on ties.
 *
 * Returns null when the current state isn't slot-collecting OR the message
 * doesn't plausibly fill that slot.
 */
function tryExpectedSlot(ctx: TurnContext): ClassifiedTurn | null {
  const raw = ctx.message;
  const t = raw.trim().toLowerCase();
  const state = ctx.commerceState.state;

  // ── PROACTIVE-OFFER QUANTITY CAPTURE ──────────────────────────────────
  // After a price answer, the composer often pitches "Would you like
  // to add it? How many?". State is BROWSING/IDLE but pendingProductId
  // is set. Customer says "yes 3" / "ok i want 2" / just "yes".
  // Catch this here so policy can route to handleQuantityReply.
  if (
    ctx.commerceState.pendingProductId &&
    (state === 'BROWSING' || state === 'IDLE')
  ) {
    const isAffirmation = /^(yes|yeah|yep|yup|ok|okay|sure|please|alright|aight)\b/i.test(t);
    const isAddIntent = /^\s*(add|i\s+want|i\s+need|i'?ll\s+take|get\s+me|give\s+me|put)\b/i.test(t);
    const qtyMatch = t.match(/\b(\d{1,3})\b/);
    const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : null;

    if ((isAffirmation || isAddIntent) && quantity && quantity > 0 && quantity <= 100) {
      return result(
        'provide_quantity',
        { quantity },
        'high',
        false,
        'proactive_offer_quantity_capture',
      );
    }

    // After a stock/info question, customer often references a variant
    // of the just-shown product ("i want the green one"). Catch this so
    // it routes through the variant resolver instead of being treated as
    // a fresh product search.
    const pendingProduct = ctx.products.find(
      (p) => p.id === ctx.commerceState.pendingProductId,
    );
    if (pendingProduct) {
      const variantTokens = collectVariantTokens(pendingProduct);
      const messageTokens = raw.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
      const hasVariantToken = messageTokens.some(
        (token) => token.length >= 2 && variantTokens.has(token),
      );
      if (hasVariantToken) {
        return result(
          'provide_variant_choice',
          { variantQuery: raw.trim() },
          'high',
          false,
          'pending_product_variant_descriptor',
        );
      }
    }
  }

  switch (state) {
    case 'AWAITING_QUANTITY': {
      const qty = extractQuantity(raw);
      if (qty != null) {
        return result(
          'provide_quantity',
          { quantity: qty },
          'high',
          false,
          'state_slot_quantity',
        );
      }
      return null;
    }



    
    case 'AWAITING_DELIVERY_AREA': {
      const zone = matchZoneInMessage(ctx, raw);
      if (zone) {
        return result(
          'provide_delivery_zone',
          { zoneQuery: zone },
          'high',
          false,
          'state_slot_delivery_zone',
        );
      }
      return null;
    }

    case 'AWAITING_ADDRESS': {
      // Address is the most permissive slot. Accept anything that's not
      // an obvious zone name, phone, ordinal, or catalog hit. The policy
      // can still override via Rule 5 if a stronger interrupt was missed
      // (it won't — interrupts run before this in the cascade).
      const looksLikeZone = matchZoneInMessage(ctx, raw) != null;
      const looksLikePhone = looksLikePhoneNumber(raw);
      // SIGNATURE-CHECK: extractOrdinalSelection returns 0-based index | null.
      const looksLikeOrdinal = extractOrdinalSelection(raw) != null;

      // If it's clearly a zone, defer to provide_delivery_zone (medium
      // confidence — could still be an address that happens to BE a zone
      // name like "Weija"). Policy decides.
      if (looksLikeZone && raw.trim().split(/\s+/).length === 1) {
        return result(
          'provide_delivery_zone',
          { zoneQuery: matchZoneInMessage(ctx, raw)! },
          'medium',
          false,
          'state_slot_address_but_zone_match',
        );
      }
      if (looksLikePhone || looksLikeOrdinal) return null;

      // Anything else with at least one alphabetical token: treat as address.
      if (/[a-zA-Z]/.test(raw)) {
        return result(
          'provide_address',
          { addressText: raw.trim() },
          'high',
          false,
          'state_slot_address',
        );
      }
      return null;
    }

    case 'AWAITING_PHONE': {
      const phone = extractPhoneSafe(raw);
      if (phone) {
        return result(
          'provide_phone',
          { phone },
          'high',
          false,
          'state_slot_phone',
        );
      }
      return null;
    }

    case 'AWAITING_NAME': {
      // Names are anything that isn't a phone, ordinal, or zone token.
      const phone = extractPhoneSafe(raw);
      if (phone) return null;
      if (/[a-zA-Z]/.test(raw) && raw.trim().length >= 2) {
        return result(
          'provide_name',
          { name: raw.trim() },
          'high',
          false,
          'state_slot_name',
        );
      }
      return null;
    }

    case 'AWAITING_PRODUCT_SELECTION': {
      const ord = extractOrdinalSelection(raw);
      if (ord != null) {
        return result(
          'provide_ordinal_selection',
          { ordinal: ord },
          'high',
          false,
          'state_slot_ordinal',
        );
      }
      // Otherwise fall through — handler does its own search.
      return null;
    }

    case 'AWAITING_VARIANT': {
      // First check: does the message contain a token matching one of the
      // pending product's variant names? If yes, this is a variant choice
      // even when wrapped in "i want the X" filler.
      const pendingProduct = findPendingProductForVariantMatch(ctx);
      if (pendingProduct) {
        const matched = matchVariantInMessage(raw, pendingProduct);
        if (matched) {
          return result(
            'provide_variant_choice',
            { variantQuery: matched },
            'high',
            false,
            'state_slot_variant_token_match',
          );
        }

        // Whole-name match failed (variant names are too long to fit in
        // the message — vendor named them with full product+color). Try
        // token-level: if any word in the message matches a token in the
        // variant vocab, treat as variant choice. resolveVariantSmart
        // will resolve the actual variant via Gemini downstream.
        const variantTokens = collectVariantTokens(pendingProduct);
        const messageTokens = raw.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
        const hasVariantToken = messageTokens.some(
          (token) => token.length >= 2 && variantTokens.has(token),
        );
        if (hasVariantToken) {
          return result(
            'provide_variant_choice',
            { variantQuery: raw.trim() },
            'high',
            false,
            'state_slot_variant_descriptor',
          );
        }
      }


      

      // Otherwise, looks-like-fresh-product-query escape hatch as before.
      const looksLikeFreshProductQuery =
        /\b(i want|i need|give me|add|do you have|show me|looking for|got)\b/i.test(raw);
      if (looksLikeFreshProductQuery) return null;

      // Default: treat as variant text.
      return result(
        'provide_variant_choice',
        { variantQuery: raw.trim() },
        'medium',
        false,
        'state_slot_variant',
      );
    }

    case 'AWAITING_ORDER_LOOKUP': {
      const ref = extractOrderReference(raw);
      const phone = extractPhone(raw);
      const slots: Slots = {};
      if (ref?.kind === 'paymentReference') {
        slots.orderReference = ref.value;
        slots.orderId = ref.orderId;
      } else if (ref?.kind === 'orderId') {
        slots.orderId = ref.value;
      }
      if (phone) slots.phone = phone;
      return result(
        'command_order_status',
        slots,
        ref || phone ? 'high' : 'medium',
        true,
        'state_slot_order_lookup',
      );
    }

    case 'AWAITING_SUPPORT_LOOKUP': {
      const offTopic = isOffTopicEscape(raw);
      if (offTopic) {
        return null;
      }
    
      // Bare ordinal ("1", "2", "the first", "second one") in AWAITING_SUPPORT_LOOKUP
      // is the customer picking from a previously-shown order list. Route as
      // command_<carried> so handleSupportRequest gets to disambiguate.
      // Without this, "2" falls into `provide_ordinal_selection` and routes
      // to handleProductSelection — which does the wrong thing.
      const ord = extractOrdinalSelection(raw);
      const carried = (ctx.commerceState as any).carriedSupportIntent as string | undefined;
    
      if (ord != null && carried) {
        const slots: Slots = { ordinal: ord, carriedSupportIntent: carried as any };
        return result(
          `command_${carried}` as Intent,
          slots,
          'high',
          true,
          'state_slot_support_lookup_ordinal',
        );
      }
    
      const ref = extractOrderReference(raw);
      const phone = extractPhone(raw);
      const slots: Slots = {};
      if (ref?.kind === 'paymentReference') {
        slots.orderReference = ref.value;
        slots.orderId = ref.orderId;
      } else if (ref?.kind === 'orderId') {
        slots.orderId = ref.value;
      }
      if (phone) slots.phone = phone;
      if (carried) slots.carriedSupportIntent = carried as any;
    
      // No identifying info AND no support keywords — likely off topic.
      // Drop confidence so policy can deprioritize.
      const hasSupportSignal = !!(ref || phone ||
        /\b(refund|return|cancel|damaged|broken|wrong|late|complain)\b/i.test(raw));
    
      const intent = carried
        ? (`command_${carried}` as Intent)
        : 'command_general_complaint';
    
      return result(
        intent,
        slots,
        hasSupportSignal ? 'high' : 'low',
        hasSupportSignal,
        'state_slot_support_lookup',
      );
    }

    case 'READY_FOR_CHECKOUT':
    case 'CHECKOUT_CREATED':
    case 'IDLE':
    case 'BROWSING':
    case 'HANDOVER':
    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Slot-agnostic fallbacks
// ─────────────────────────────────────────────────────────────────────────────

function tryFallback(ctx: TurnContext, raw: string): ClassifiedTurn | null {
  // 7a. Confirmation vocab (uses the existing vocab module).
  const vocab = extractConfirmationFromVocab(raw);
  if (vocab !== 'unknown') {
    if (vocab === 'affirm') {
      return result('say_yes', {}, 'high', false, 'confirmation_affirm');
    }
    if (vocab === 'deny') {
      return result('say_no', {}, 'high', false, 'confirmation_deny');
    }
  }

  // 7b. Existing extractor (covers cases vocab module doesn't).
  // SIGNATURE-CHECK: extractConfirmation returns 'confirm' | 'deny' | 'unclear'.
  const conf = extractConfirmation(raw);
  if (conf === 'confirm') return result('say_yes', {}, 'medium', false, 'confirmation_existing_confirm');
  if (conf === 'deny')    return result('say_no', {}, 'medium', false, 'confirmation_existing_deny');

  // 7c. Bare ordinal with no state context.
  const ord = extractOrdinalSelection(raw);
  if (ord != null) {
    return result(
      'provide_ordinal_selection',
      { ordinal: ord },
      'medium',
      false,
      'fallback_ordinal',
    );
  }

  // 7d. Catalog token match — message contains at least one product token.
  //     Routes to provide_product_query so policy can decide whether it
  //     interrupts the active state.
  const catalogHit = matchCatalogToken(ctx, raw);
  if (catalogHit) {
    return result(
      'provide_product_query',
      { productQuery: raw.trim() },
      'high',
      true,
      `catalog_token_${catalogHit}`,
    );
  }

  // 7e. Bare phone-shaped string.
  const phone = extractPhoneSafe(raw);
  if (phone) {
    return result(
      'provide_phone',
      { phone },
      'medium',
      false,
      'fallback_phone',
    );
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Catalog & zone helpers — small, defensive, stateless.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Matches a delivery zone name in the message against ctx.deliveries.
 * Word-boundary, case-insensitive, longest-match wins.
 * Returns the matched zone label, or null.
 */
function matchZoneInMessage(ctx: TurnContext, raw: string): string | null {
  const zones = Array.isArray(ctx.deliveries) ? ctx.deliveries : [];
  if (zones.length === 0) return null;

  const haystack = ` ${raw.toLowerCase()} `;
  let best: string | null = null;
  let bestLen = 0;

  for (const z of zones) {
    const label = String((z as any).label || (z as any).name || '').toLowerCase().trim();
    if (label.length === 0) continue;
    const re = new RegExp(`(^|[^a-z0-9])${escapeRegex(label)}([^a-z0-9]|$)`, 'i');
    if (re.test(haystack) && label.length > bestLen) {
      best = (z as any).label || (z as any).name;
      bestLen = label.length;
    }
  }
  return best;
}

/**
 * Returns the matched catalog signal type if any product/variant/alias token
 * appears in the message. Conservative — requires at least one non-stopword
 * token of length ≥ 3 to match, to avoid "i" or "is" lighting up a product.
 */
function matchCatalogToken(ctx: TurnContext, raw: string): string | null {
  const products = Array.isArray(ctx.products) ? ctx.products : [];
  if (products.length === 0) return null;

  const messageTokens = new Set(
    tokenize(raw).filter((t) => t.length >= 3 && !STOP_TOKENS.has(t)),
  );
  if (messageTokens.size === 0) return null;

  for (const p of products) {
    const productTokens = collectProductTokens(p);
    let matched: string | null = null;

    productTokens.forEach((t) => {
      if (matched) return;
      if (messageTokens.has(t)) {
        matched = 'product';
      }
    });

    if (matched) return matched;
  }
  return null;
}

function collectProductTokens(p: any): Set<string> {
  const set = new Set<string>();
  for (const t of tokenize(String(p.name || ''))) set.add(t);
  for (const a of (p.aliases || []) as string[]) {
    for (const t of tokenize(a)) set.add(t);
  }
  for (const v of (p.variants || []) as any[]) {
    for (const t of tokenize(String(v.name || ''))) set.add(t);
  }
  return set;
}

const STOP_TOKENS = new Set([
  'the', 'and', 'for', 'you', 'are', 'with', 'have', 'this', 'that',
  'from', 'your', 'will', 'about', 'just', 'one', 'two', 'three',
  'please', 'pls', 'want', 'need', 'add', 'get',
]);

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Resolves the pending product for variant matching. Used only when the
 * state is AWAITING_VARIANT — looks at pendingProductId on commerceState,
 * then last-mentioned, returns the catalog product or null.
 */
function findPendingProductForVariantMatch(ctx: TurnContext): any | null {
  const id =
    ctx.commerceState.pendingProductId ??
    ctx.commerceState.lastMentionedProductId ??
    null;
  if (!id) return null;
  const products = Array.isArray(ctx.products) ? ctx.products : [];
  return products.find((p: any) => p.id === id) ?? null;
}

/**
 * Returns the matched variant name (raw, not normalized) if the message
 * contains a token matching one of the product's variants. Word-boundary,
 * case-insensitive, longest-match wins.
 */
function matchVariantInMessage(raw: string, product: any): string | null {
  const variants = (product?.variants ?? []) as Array<{ name?: string }>;
  if (!variants.length) return null;

  const haystack = ` ${raw.toLowerCase()} `;
  let best: string | null = null;
  let bestLen = 0;

  for (const v of variants) {
    const name = String(v?.name || '').toLowerCase().trim();
    if (name.length === 0) continue;
    const re = new RegExp(`(^|[^a-z0-9])${escapeRegex(name)}([^a-z0-9]|$)`, 'i');
    if (re.test(haystack) && name.length > bestLen) {
      best = v.name as string;
      bestLen = name.length;
    }
  }
  return best;
}

// ─────────────────────────────────────────────────────────────────────────────
// Phone helper — defensive against extractPhone signature drift.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a phone-shaped string from the message, or null. Local heuristic —
 * does NOT call extractPhone (its signature is intentionally unverified
 * here to keep Step 1 zero-risk on imports). Replace with extractPhone()
 * in Step 2 if the real signature is `(string) => string | null`.
 */
function extractPhoneSafe(raw: string): string | null {
  return extractPhone(raw);
}

function looksLikePhoneNumber(raw: string): boolean {
  return extractPhone(raw) != null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Off-topic escape — used by AWAITING_SUPPORT_LOOKUP to break out of the
// support flow when the customer changes topic, greets, jokes, etc.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detects messages that should escape AWAITING_SUPPORT_LOOKUP rather than
 * loop the support flow. Greetings, thanks, off-topic questions, jokes, etc.
 */
function isOffTopicEscape(raw: string): boolean {
  const t = raw.toLowerCase().trim();
  if (t.length === 0) return false;

  // Greetings / thanks
  if (/^(hi|hello|hey|good morning|good afternoon|good evening|thanks|thank you|ok|okay|alright)\s*[!.?]?$/i.test(t)) {
    return true;
  }

  // Jokes / weird requests
  if (/\b(tell me a joke|are you (a |an )?(bot|ai|human|real)|who made you|i love you)\b/i.test(t)) {
    return true;
  }

  // Off-topic competitor / unrelated
  if (/\b(jumia|tonaton|jiji|amazon|aliexpress)\b/i.test(t)) {
    return true;
  }

  // Pure product browse interrupt
  if (/^(what do (you|u) sell|show (me )?products|menu|catalog)\s*\??$/i.test(t)) {
    return true;
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal: result builder
// ─────────────────────────────────────────────────────────────────────────────

function result(
  intent: Intent,
  slots: Slots,
  confidence: ClassifiedTurn['confidence'],
  isInterrupt: boolean,
  reasonTail: string,
  secondary?: ClassifiedTurn['secondary'],
): ClassifiedTurn {
  return {
    intent,
    slots,
    confidence,
    source: 'deterministic',
    isInterrupt,
    reason: `deterministic:${reasonTail}`,
    ...(secondary ? { secondary } : {}),
  };
}