import type { Intent, Confidence } from './types';

/**
 * Output of the new Gemini turn-plan extraction. Replaces the
 * primary+secondary intent shape with a structured plan that can
 * represent compound customer messages typical in Ghanaian commerce
 * conversations ("3 bottles of hot, deliver to Weija near the market,
 * my number is 024..., can I pay momo?").
 *
 * Consumed by executeTurnPlan() which verifies each piece against real
 * data and produces a TurnFactPacket for the composer.
 *
 * Strict rule: every field here is *what the customer claimed/asked*.
 * Verification happens downstream. Extraction never invents.
 */

/**
 * One actionable task pulled from the customer message. Long messages
 * may produce 1-7 tasks. Order matters — tasks[0] is the primary.
 */
export type ExtractedTask = {
  intent: Intent;
  slots: Record<string, unknown>;
  confidence: Confidence;
};

/**
 * What the customer is shopping for. All fields optional — extractor
 * fills only what the customer actually said. Filters get applied
 * downstream against real catalog attributes; if the catalog doesn't
 * support a filter (e.g. "fit: close" but products have no fit
 * attribute), it's silently dropped at verification time.
 */
export type ProductNeed = {
  query?: string;
  colors?: string[];
  size?: string;
  fit?: string;
  material?: string;
  brand?: string;
  occasion?: string;        // "wedding", "birthday", "casual"
  recipient?: string;       // "sister", "boys", "myself"
  useCase?: string;         // free-form, e.g. "office wear"
};

/**
 * Constraints affecting what we offer or how we respond. Used to filter
 * recommendations, flag delivery feasibility, compute budget guidance.
 */
export type Constraints = {
  deliveryDeadline?: string;          // "today", "3 days", "by friday"
  sameDayPreferred?: boolean;
  budgetGuidanceRequested?: boolean;
  budgetMin?: number;                 // GHS
  budgetMax?: number;                 // GHS
};

/**
 * Slots the customer mentioned in passing during a compound message.
 * Orchestrator fills all valid ones at once and asks only for what's
 * still missing — no more "i told you my number already" frustration.
 */
export type CheckoutSlots = {
  quantity?: number;
  variantHint?: string;               // "red one", "the cheaper", "size 34"
  deliveryZone?: string;              // Raw customer wording ("Weija")
  addressText?: string;               // Landmark/street ("near the market")
  phone?: string;
  name?: string;
};

/**
 * Customer-side context signaling support/escalation needs. Detected
 * even when not primary so the orchestrator can route correctly.
 */
export type SupportContext = {
  refundRequested?: boolean;
  cancelRequested?: boolean;
  exchangeRequested?: boolean;
  damagedItem?: boolean;
  wrongItem?: boolean;
  paymentDispute?: boolean;
  lateDelivery?: boolean;
  generalComplaint?: boolean;
};

/**
 * Store-info questions the customer asked alongside other intents.
 * Composer answers these inline if the facts can be verified from
 * StoreKnowledge.
 */
export type StoreInfoQuestions = {
  askLocation?: boolean;
  askHours?: boolean;
  askPaymentMethods?: boolean;
  askRefundPolicy?: boolean;
  askAboutStore?: boolean;
  askDeliveryFee?: boolean;
  askDeliveryTime?: boolean;
  askDeliveryAreas?: boolean;         // "where/which areas do you deliver to?"
  askContact?: boolean;
};

/**
 * Tells the orchestrator how to interpret this plan against current state:
 *  - continue_current_state: customer answered the slot we asked for
 *  - interrupt: customer pivoted away from the current slot path
 *  - fill_multiple_slots: compound message; fill all valid slots in one turn
 *  - clarify: extraction confidence too low; ask one focused question
 */
export type StateAction =
  | 'continue_current_state'
  | 'interrupt'
  | 'fill_multiple_slots'
  | 'clarify';

/**
 * The full extraction result. Mirrors the Gemini output schema 1:1.
 *
 * `schemaVersion` is required so logs remain debuggable as the schema
 * evolves. Bump it when fields change shape, not just when fields
 * are added.
 */
export type TurnPlan = {
  schemaVersion: 'turn_plan_v1';
  primaryIntent: Intent;
  tasks: ExtractedTask[];
  productNeed?: ProductNeed;
  constraints?: Constraints;
  checkoutSlots?: CheckoutSlots;
  supportContext?: SupportContext;
  storeInfoQuestions?: StoreInfoQuestions;
  stateAction: StateAction;
  clarificationQuestion?: string;     // Required when stateAction === 'clarify'
  confidence: Confidence;
  reason?: string;                    // Why the extractor chose this shape
};

/**
 * Outcome of a Gemini turn-plan extraction call. Same shape pattern as
 * GeminiClassifyOutcome so the orchestrator can handle them similarly.
 */
export type TurnPlanExtractionOutcome = {
  ok: boolean;
  result?: TurnPlan;
  latencyMs?: number;
  error?: string;
  invalidJson?: boolean;
  rawText?: string;
};

// ─── Type guards / helpers ────────────────────────────────────────────

export function hasProductNeed(plan: TurnPlan): boolean {
  if (!plan.productNeed) return false;
  return Object.values(plan.productNeed).some((v) =>
    Array.isArray(v) ? v.length > 0 : v != null && v !== '',
  );
}

export function hasCheckoutSlots(plan: TurnPlan): boolean {
  if (!plan.checkoutSlots) return false;
  return Object.values(plan.checkoutSlots).some(
    (v) => v != null && v !== '',
  );
}

export function hasConstraints(plan: TurnPlan): boolean {
  if (!plan.constraints) return false;
  return Object.values(plan.constraints).some(
    (v) => v != null && v !== '' && v !== false,
  );
}

export function hasInfoQuestions(plan: TurnPlan): boolean {
  if (!plan.storeInfoQuestions) return false;
  return Object.values(plan.storeInfoQuestions).some((v) => v === true);
}

export function hasSupportContext(plan: TurnPlan): boolean {
  if (!plan.supportContext) return false;
  return Object.values(plan.supportContext).some((v) => v === true);
}

export function shouldClarify(plan: TurnPlan): boolean {
  return plan.stateAction === 'clarify' && !!plan.clarificationQuestion;
}

/**
 * Counts the meaningful task surfaces in a plan. Useful for telemetry
 * and for deciding when to switch to clarify mode (high task count
 * with low confidence).
 */
export function planRichness(plan: TurnPlan): number {
  let n = plan.tasks.length;
  if (hasProductNeed(plan)) n++;
  if (hasCheckoutSlots(plan)) n++;
  if (hasConstraints(plan)) n++;
  if (hasInfoQuestions(plan)) n++;
  if (hasSupportContext(plan)) n++;
  return n;
}