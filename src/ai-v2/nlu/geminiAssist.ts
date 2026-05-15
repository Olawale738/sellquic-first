import type { TurnContext } from '../types';
import type { ClassifiedTurn, Intent } from './types';
import { intentIsInterrupt } from './types';
import type { GeminiNluResult } from './geminiNluSchema';

/**
 * Returns true if Gemini's classification should override deterministic.
 *
 * Brittle zones include:
 *   - Deterministic returned meta_unknown (no clue)
 *   - Deterministic returned low confidence
 *   - State is AWAITING_SUPPORT_LOOKUP (catch-all support state)
 *   - Order-status hijack patterns ("where is the link")
 *   - Product/variant ambiguity in pending-product flows
 *   - DIVERGENCE: deterministic says "command_X" but Gemini says "ask_X"
 *     — high-confidence misclassification by regex, where Gemini reads
 *     the message as a question and the deterministic regex over-matched.
 */
export function isBrittleCase(
  deterministic: ClassifiedTurn,
  ctx: TurnContext,
  gemini?: GeminiNluResult,
): boolean {
  // Unknown
  if (deterministic.intent === 'meta_unknown') return true;

  // Low confidence
  if (deterministic.confidence === 'low') return true;

  // Support lookup state — vague support requests benefit from Gemini.
  if (ctx.commerceState.state === 'AWAITING_SUPPORT_LOOKUP') return true;

  // Delivery area state but message looks like a product query.
  if (
    ctx.commerceState.state === 'AWAITING_DELIVERY_AREA' &&
    /\b(i want|i need|give me|do you have|show me|looking for)\b/i.test(ctx.message)
  ) {
    return true;
  }

  // Variant state but message has fresh-product-shaped wording or the
  // combined-order extractor over-fired (treats "i want 3 jumbo" as a
  // new product when there's a pending product with that variant).
  if (ctx.commerceState.state === 'AWAITING_VARIANT') {
    if (/\b(i want|i need|do you have|show me)\b/i.test(ctx.message)) {
      return true;
    }
    // Combined-order false positive: deterministic says "new product query"
    // but the pending product has variants matching the message.
    if (
      deterministic.intent === 'provide_product_query' &&
      gemini?.primaryIntent === 'provide_variant_choice'
    ) {
      return true;
    }
  }

  // Order-status hijack patterns ("where is the link" / "i want to order").
  if (
    deterministic.intent === 'command_order_status' &&
    /\b(link|button|send it|the link)\b/i.test(ctx.message)
  ) {
    return true;
  }

  // CRITICAL — high-confidence command vs question divergence.
  // Deterministic regex over-matches on words like "refund" / "return" /
  // "cancel" / "complain" — when the customer is asking ABOUT policy
  // ("what is your refund policy?") rather than requesting an action.
  // Gemini reads the question shape correctly; trust it here.
  if (gemini && deterministic.intent !== gemini.primaryIntent) {
    const detIsCommand = deterministic.intent.startsWith('command_');
    const geminiIsAsk = gemini.primaryIntent.startsWith('ask_');
    if (detIsCommand && geminiIsAsk && gemini.confidence === 'high') {
      return true;
    }


    // Two different ask_* intents (e.g. det=ask_variants, gemini=ask_price).
    // When deterministic regex categorizes a question wrong but Gemini
    // reads it correctly with high confidence, trust Gemini.
    const detIsAsk = deterministic.intent.startsWith('ask_');
    if (detIsAsk && geminiIsAsk && gemini.confidence === 'high') {
      return true;
    }
    // Mirror case: deterministic returned ask_unknown but Gemini
    // extracted a real intent with high confidence. (meta_unknown is
    // already handled at the top of this function.)
    if (
      deterministic.intent === 'ask_unknown' &&
      gemini.confidence === 'high'
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Maps a GeminiNluResult into the deterministic ClassifiedTurn shape so
 * the dialogue policy and downstream routing see the same interface.
 */
export function mapGeminiToClassified(
  gemini: GeminiNluResult,
  ctx: TurnContext,
): ClassifiedTurn {
  const intent = gemini.primaryIntent as Intent;

  const slots: import('./types').Slots = {};
  if (gemini.slots.productQuery) slots.productQuery = gemini.slots.productQuery;
  if (gemini.slots.variantQuery) slots.variantQuery = gemini.slots.variantQuery;
  if (gemini.slots.quantity != null) slots.quantity = gemini.slots.quantity;
  if (gemini.slots.deliveryZone) slots.zoneQuery = gemini.slots.deliveryZone;
  if (gemini.slots.address) slots.addressText = gemini.slots.address;
  if (gemini.slots.phone) slots.phone = gemini.slots.phone;
  if (gemini.slots.orderReference) slots.orderReference = gemini.slots.orderReference;

  // Carry the original message into questionText for the knowledge layer
  // when Gemini returns an ask_* intent.
  if (intent.startsWith('ask_')) {
    slots.questionText = ctx.message;
  }

  const isInterrupt =
    gemini.stateAction === 'interrupt' ||
    gemini.stateAction === 'exit_state' ||
    intentIsInterrupt(intent);

  return {
    intent,
    slots,
    confidence: gemini.confidence,
    source: 'gemini',
    isInterrupt,
    reason: `gemini:${gemini.reason.slice(0, 100)}`,
  };
}