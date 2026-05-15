import { Type } from '@google/genai';
import { callGeminiResilient } from '../gemini/resilientClient';
import type { TurnContext } from '../types';
import type {
  TurnPlan,
  TurnPlanExtractionOutcome,
} from './turnPlanSchema';
import type { Intent } from './types';

/**
 * Turn-plan extraction — Phase 1B of the compound-message architecture.
 *
 * Reads a single customer turn (with brief recent history + state context)
 * and returns a structured TurnPlan that captures every signal the
 * customer expressed: intents, product filters, constraints, checkout
 * slots, store-info questions, and support context.
 *
 * Strict rule: extraction extracts. It NEVER decides actions, NEVER
 * verifies facts, NEVER claims products/prices/stock/zones exist.
 * Verification happens in executeTurnPlan() (Phase 1C). Speech happens
 * in the composer (Phase 1D).
 *
 * Runs in parallel with the existing classifyTurnWithGemini during
 * shadow rollout; cuts over per-store via aiV2.useTurnPlanExtraction.
 */

// ─── Enum sources ─────────────────────────────────────────────────────
// Mirrors the Intent union in nlu/types.ts. Must stay in sync — if you
// add a new Intent there, add it here too.
const ALL_INTENTS: Intent[] = [
  'provide_product_query',
  'provide_variant_choice',
  'provide_quantity',
  'provide_delivery_zone',
  'provide_address',
  'provide_phone',
  'provide_name',
  'provide_ordinal_selection',
  'say_yes',
  'say_no',
  'say_unclear',
  'ask_price',
  'ask_stock',
  'ask_variants',
  'ask_delivery_fee',
  'ask_delivery_time',
  'ask_payment_methods',
  'ask_cod',
  'ask_refund_policy',
  'ask_location',
  'ask_hours',
  'ask_about_store',
  'ask_cart_total',
  'ask_unknown',
  'command_change_address',
  'command_change_delivery',
  'command_change_name',
  'command_change_phone',
  'command_clear_cart',
  'command_show_cart',
  'command_add_more',
  'command_catalog_discovery',
  'command_show_product',
  'command_show_product',
  'command_order_status',
  'command_payment_issue',
  'command_handover',
  'command_refund_request',
  'command_return_request',
  'command_exchange_request',
  'command_cancel_order',
  'command_damaged_item',
  'command_wrong_item',
  'command_late_delivery',
  'command_general_complaint',
  'meta_greeting',
  'meta_thanks',
  'meta_unknown',
];

const CONFIDENCE_VALUES = ['high', 'medium', 'low'] as const;
const STATE_ACTION_VALUES = [
  'continue_current_state',
  'interrupt',
  'fill_multiple_slots',
  'clarify',
] as const;

// ─── JSON schema for Gemini structured output ────────────────────────
const TURN_PLAN_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    schemaVersion: { type: Type.STRING, enum: ['turn_plan_v1'] },
    primaryIntent: { type: Type.STRING, enum: ALL_INTENTS },
    tasks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          intent: { type: Type.STRING, enum: ALL_INTENTS },
          slots: { type: Type.OBJECT },
          confidence: { type: Type.STRING, enum: [...CONFIDENCE_VALUES] },
        },
        required: ['intent', 'slots', 'confidence'],
      },
    },
    productNeed: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING },
        colors: { type: Type.ARRAY, items: { type: Type.STRING } },
        size: { type: Type.STRING },
        fit: { type: Type.STRING },
        material: { type: Type.STRING },
        brand: { type: Type.STRING },
        occasion: { type: Type.STRING },
        recipient: { type: Type.STRING },
        useCase: { type: Type.STRING },
      },
    },
    constraints: {
      type: Type.OBJECT,
      properties: {
        deliveryDeadline: { type: Type.STRING },
        sameDayPreferred: { type: Type.BOOLEAN },
        budgetGuidanceRequested: { type: Type.BOOLEAN },
        budgetMin: { type: Type.NUMBER },
        budgetMax: { type: Type.NUMBER },
      },
    },
    checkoutSlots: {
      type: Type.OBJECT,
      properties: {
        quantity: { type: Type.NUMBER },
        variantHint: { type: Type.STRING },
        deliveryZone: { type: Type.STRING },
        addressText: { type: Type.STRING },
        phone: { type: Type.STRING },
        name: { type: Type.STRING },
      },
    },
    supportContext: {
      type: Type.OBJECT,
      properties: {
        refundRequested: { type: Type.BOOLEAN },
        cancelRequested: { type: Type.BOOLEAN },
        exchangeRequested: { type: Type.BOOLEAN },
        damagedItem: { type: Type.BOOLEAN },
        wrongItem: { type: Type.BOOLEAN },
        paymentDispute: { type: Type.BOOLEAN },
        lateDelivery: { type: Type.BOOLEAN },
        generalComplaint: { type: Type.BOOLEAN },
      },
    },
    storeInfoQuestions: {
      type: Type.OBJECT,
      properties: {
        askLocation: { type: Type.BOOLEAN },
        askHours: { type: Type.BOOLEAN },
        askPaymentMethods: { type: Type.BOOLEAN },
        askRefundPolicy: { type: Type.BOOLEAN },
        askAboutStore: { type: Type.BOOLEAN },
        askDeliveryFee: { type: Type.BOOLEAN },
        askDeliveryTime: { type: Type.BOOLEAN },
        askDeliveryAreas: { type: Type.BOOLEAN },
        askContact: { type: Type.BOOLEAN },
      },
    },
    stateAction: { type: Type.STRING, enum: [...STATE_ACTION_VALUES] },
    clarificationQuestion: { type: Type.STRING },
    confidence: { type: Type.STRING, enum: [...CONFIDENCE_VALUES] },
    reason: { type: Type.STRING },
  },
  required: [
    'schemaVersion',
    'primaryIntent',
    'tasks',
    'stateAction',
    'confidence',
  ],
};

// ─── Public entry point ───────────────────────────────────────────────
export async function extractTurnPlan(
  ctx: TurnContext,
  apiKey: string,
): Promise<TurnPlanExtractionOutcome> {
  const prompt = buildExtractionPrompt(ctx);

  const outcome = await callGeminiResilient({
    prompt,
    schema: TURN_PLAN_SCHEMA,
    temperature: 0.2,
    maxOutputTokens: 1200,
    kind: 'turn_plan_extraction',
    apiKey,
  });

  if (!outcome.ok) {
    return {
      ok: false,
      latencyMs: outcome.latencyMs,
      error: outcome.errorType,
    };
  }

  let parsed: TurnPlan;
  try {
    parsed = JSON.parse(outcome.text) as TurnPlan;
  } catch {
    return {
      ok: false,
      latencyMs: outcome.latencyMs,
      invalidJson: true,
      rawText: outcome.text,
      error: 'invalid_json',
    };
  }

  // Defensive guard — Gemini occasionally drops required fields even
  // with structured output. Bail rather than emit a half-formed plan.
  if (
    !parsed.primaryIntent ||
    !Array.isArray(parsed.tasks) ||
    !parsed.stateAction ||
    !parsed.confidence
  ) {
    return {
      ok: false,
      latencyMs: outcome.latencyMs,
      invalidJson: true,
      rawText: outcome.text,
      result: parsed,
      error: 'missing_required_fields',
    };
  }

  // Force schemaVersion (sometimes dropped despite being required).
  parsed.schemaVersion = 'turn_plan_v1';

  return {
    ok: true,
    result: parsed,
    latencyMs: outcome.latencyMs,
    rawText: outcome.text,
  };
}

// ─── Prompt construction ──────────────────────────────────────────────
function buildExtractionPrompt(ctx: TurnContext): string {
  const recent = Array.isArray(ctx.recentMessages)
    ? ctx.recentMessages
        .slice(-4)
        .map((m) => `${m.role}: ${m.content}`)
        .join('\n')
    : '(no prior turns)';

  const stateInfo = `current_state: ${ctx.commerceState.state}`;
  const cartItemCount = ctx.currentCart?.length || 0;
  const customerKnown =
    ctx.customer?.name || ctx.customer?.phone ? 'returning' : 'new';
  const pendingProductId = ctx.commerceState.pendingProductId || 'none';
  const pendingVariantId = ctx.commerceState.pendingVariantId || 'none';

  return `You extract a STRUCTURED PLAN from a Ghanaian commerce customer message. Output JSON only — no prose, no markdown.

Your job is to UNDERSTAND, not invent. Extract every signal the customer actually expressed. Never invent products, prices, stock, zones, or facts. If something isn't said, leave it out.

────────────────────────────────────────────────────────────────
CONTEXT (for disambiguation, not extraction targets)
${stateInfo}
cart_items: ${cartItemCount}
customer: ${customerKnown}
pending_product: ${pendingProductId}
pending_variant: ${pendingVariantId}

RECENT CONVERSATION:
${recent}

CUSTOMER JUST SAID:
"${ctx.message}"

────────────────────────────────────────────────────────────────
SCHEMA RULES

schemaVersion: always "turn_plan_v1"

primaryIntent: the most important thing the customer wants right now. tasks[0].intent must match.

tasks: array of intents detected. Long messages can produce 2-7 tasks. Don't pad — only include tasks the customer actually expressed.

productNeed: only when shopping/searching/asking about products.
  - colors: array, e.g. ["red", "white", "green"]. Empty/missing if none.
  - size: customer's wording ("34", "large").
  - fit: "close", "loose", "slim". Only if explicit.
  - occasion: "wedding", "birthday", etc. Only if said.
  - recipient: "sister", "boys", "myself". Only if said.

constraints: only when constraints are present.
  - deliveryDeadline: free text. "today", "3 days", "by friday".
  - sameDayPreferred: true if "today", "right away", "asap", "immediately".
  - budgetGuidanceRequested: true if "what budget", "what's the cheapest", "how much should I spend".
  - budgetMin/budgetMax: only if customer stated explicit numbers.

checkoutSlots: only when customer mentioned their info while ordering.
  - quantity: integer if customer said a number tied to a product.
  - variantHint: customer's wording ("the red one", "size 34", "the cheaper").
  - deliveryZone: customer's wording for location ("Weija", "Accra suburbs"). Don't try to map to a real zone — that's not your job.
  - addressText: specific landmark/address ("near the market").
  - phone: phone number if mentioned.
  - name: their name if mentioned.

supportContext: booleans. Only set true when customer signals an issue.

storeInfoQuestions: booleans. Only set true when customer asks about store info.
  - askDeliveryAreas: true for "where do you deliver?", "which areas?".
  - askDeliveryFee: true for "how much delivery?", "what's the delivery cost?".
  - askDeliveryTime: true for "when will I get it?", "how long does delivery take?".

stateAction: pick exactly one:
  - continue_current_state: customer answered the slot the bot asked for.
  - interrupt: customer pivoted away from the slot path (e.g. mid-quantity, asked a price question).
  - fill_multiple_slots: compound message with several slots/intents at once.
  - clarify: extraction is too uncertain or message has conflicting/ambiguous signals — set clarificationQuestion to ONE focused question.

clarificationQuestion: only set when stateAction is "clarify". Warm and Ghanaian-friendly. Short.

confidence: high if message is clear; medium if some ambiguity; low if you're guessing.

reason: 1-line note about why you chose this shape. For debug logs.

────────────────────────────────────────────────────────────────
EXAMPLES

Example 1 — short clear message at AWAITING_QUANTITY:
"i want 3"
{"schemaVersion":"turn_plan_v1","primaryIntent":"provide_quantity","tasks":[{"intent":"provide_quantity","slots":{"quantity":3},"confidence":"high"}],"checkoutSlots":{"quantity":3},"stateAction":"continue_current_state","confidence":"high","reason":"answered the quantity slot"}

Example 2 — compound shopping message at BROWSING:
"Good evening please I need a nice shirt for my sister's wedding which is coming off in the next 3 days. I want something red with a touch of white and green, size 34, close fit. Can I get it today and what should my budget be?"
{"schemaVersion":"turn_plan_v1","primaryIntent":"provide_product_query","tasks":[{"intent":"meta_greeting","slots":{},"confidence":"high"},{"intent":"provide_product_query","slots":{"query":"shirt"},"confidence":"high"},{"intent":"ask_delivery_time","slots":{},"confidence":"high"},{"intent":"ask_price","slots":{"guidance":true},"confidence":"high"}],"productNeed":{"query":"shirt","colors":["red","white","green"],"size":"34","fit":"close","occasion":"wedding","recipient":"sister"},"constraints":{"deliveryDeadline":"3 days","sameDayPreferred":true,"budgetGuidanceRequested":true},"storeInfoQuestions":{"askDeliveryTime":true},"stateAction":"fill_multiple_slots","confidence":"high","reason":"compound shopping intent with filters and side questions"}

Example 3 — checkout multi-slot:
"3 bottles of the hot one, deliver to Weija near the market, my number is 0244123456, can I pay momo?"
{"schemaVersion":"turn_plan_v1","primaryIntent":"provide_product_query","tasks":[{"intent":"provide_product_query","slots":{"query":"hot one"},"confidence":"high"},{"intent":"provide_quantity","slots":{"quantity":3},"confidence":"high"},{"intent":"provide_delivery_zone","slots":{"zone":"Weija"},"confidence":"high"},{"intent":"provide_address","slots":{"address":"near the market"},"confidence":"high"},{"intent":"provide_phone","slots":{"phone":"0244123456"},"confidence":"high"},{"intent":"ask_payment_methods","slots":{},"confidence":"high"}],"productNeed":{"query":"hot one"},"checkoutSlots":{"quantity":3,"variantHint":"hot","deliveryZone":"Weija","addressText":"near the market","phone":"0244123456"},"storeInfoQuestions":{"askPaymentMethods":true},"stateAction":"fill_multiple_slots","confidence":"high","reason":"compound order with product, qty, zone, address, phone, and payment question"}

Example 4 — ambiguous, needs clarify:
"do you have something nice"
{"schemaVersion":"turn_plan_v1","primaryIntent":"ask_unknown","tasks":[{"intent":"ask_unknown","slots":{},"confidence":"low"}],"stateAction":"clarify","clarificationQuestion":"Of course please! What kind of item are you looking for — clothes, shoes, accessories?","confidence":"low","reason":"intent unclear; need product category"}

Example 5 — interrupt at AWAITING_QUANTITY:
"actually how much is it?"
{"schemaVersion":"turn_plan_v1","primaryIntent":"ask_price","tasks":[{"intent":"ask_price","slots":{},"confidence":"high"}],"stateAction":"interrupt","confidence":"high","reason":"pivoted from quantity to price question"}

────────────────────────────────────────────────────────────────

Return ONLY the JSON object. No prose, no markdown, no comments.`;
}