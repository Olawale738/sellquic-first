import type { QuestionIntent } from '../knowledge/types';

/**
 * Deterministic question-intent classifier.
 *
 * Designed to be called from the existing intentRouter as a sub-classifier:
 *
 *     const q = classifyQuestionIntent(message);
 *     if (q) return q;        // it's a question — route to handleInformationQuestion
 *     // else fall through to the existing commerce-intent classification
 *
 * Returns null when the message is clearly not a question (no question
 * markers AND no question keywords). When it IS a question but no specific
 * sub-type matches, returns 'q_unknown' — never null in that case, so the
 * planner always has a path.
 *
 * No LLM. No store-specific keywords. The vocabulary here is generic English
 * commerce terminology — the catalog-aware bits (zone names, product names)
 * are handled downstream in resolveReferent, not here.
 */
export function classifyQuestionIntent(rawMessage: string): QuestionIntent | null {
  const msg = rawMessage.toLowerCase().trim();
  if (msg.length === 0) return null;

  const hasQuestionMark = msg.includes('?');
  const hasQuestionWord = QUESTION_WORDS_RE.test(msg);
  const looksLikeQuestion = hasQuestionMark || hasQuestionWord;

  // Run sub-classifiers in priority order. More specific intents win over
  // more generic ones.
  for (const rule of RULES) {
    if (rule.match(msg)) return rule.intent;
  }

  // It looks like a question but matched nothing specific.
  if (looksLikeQuestion) return 'q_unknown';

  // Not a question.
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// rules
// ─────────────────────────────────────────────────────────────────────────────

const QUESTION_WORDS_RE =
  /\b(how|what|where|when|why|which|who|can|could|do|does|is|are|will|would|should|may)\b/;

interface Rule {
  intent: QuestionIntent;
  match: (msg: string) => boolean;
}

const RULES: Rule[] = [
  // q_delivery_fee — must come before q_delivery_time and before q_price
  // because "how much is delivery" contains "how much" which would otherwise
  // hit q_price.

  {
    intent: 'q_cart_total',
    match: (m) =>
      /\b(total|subtotal|cart total|order total|how much for all|how much is everything|what will the total be|total be|all together|altogether)\b/.test(m),
  },
  {
    intent: 'q_delivery_fee',
    match: (m) =>
      /\b(deliver(y|ies)?|shipping|ship)\b/.test(m) &&
      (/\b(cost|price|fee|charge|how much|much is|is it)\b/.test(m) ||
        /\bhow much\b/.test(m)),
  },

  // q_delivery_time
  {
    intent: 'q_delivery_time',
    match: (m) =>
      /\b(deliver(y|ies)?|shipping|ship|arrive|arrival)\b/.test(m) &&
      /\b(how long|when|time|days|fast|quick|eta)\b/.test(m),
  },

  // q_cod — specific before generic payment
  {
    intent: 'q_cod',
    match: (m) =>
      /\b(cash on delivery|c\.?o\.?d\.?|pay on delivery|pay on arrival|pay when)\b/.test(m),
  },

  // q_payment_methods
  {
    intent: 'q_payment_methods',
    match: (m) =>
      /\b(pay|payment|paid|momo|mobile money|paystack|card|bank transfer|how can i pay|how do i pay|accept)\b/.test(m) &&
      // exclude pure "pay on delivery" which is q_cod
      !/\bcash on delivery\b/.test(m),
  },

  // q_refund_policy
  {
    intent: 'q_refund_policy',
    match: (m) =>
      /\b(refunds?|returns?|exchange|money back|warranty|guarantee)\b/.test(m),
  },

  // q_variants — runs BEFORE q_stock because variant-shaped questions
  // ("what flavours do you have?") contain "do you have" which would
  // otherwise hit q_stock first.
  {
    intent: 'q_variants',
    match: (m) => {
      // Only treat as a variants question if the message is asking ABOUT
      // options — not just mentioning "flavor" as part of a product name.
      // "what flavors do you have" → q_variants
      // "how much is the afrique flavor" → q_price (the product happens
      // to have "flavor" in its name)
      const hasVariantWord = /\b(variants?|flavou?rs?|sizes?|colou?rs?|options?|types?|kinds?)\b/.test(m);
      const hasQuestionShape = /\b(what|which|how many|tell me about|show me|list|give me)\b/.test(m);
      const hasPriceWord = /\b(price|cost|how much|much is|expensive|cheap)\b/.test(m);
  
      // If "how much" or "price" is present, this is a price question, not
      // a variants question — even if the product name contains "flavor".
      if (hasPriceWord) return false;
  
      // "what flavors / which sizes / list options" → q_variants
      if (hasVariantWord && hasQuestionShape) return true;
  
      // Bare ask: "options?" "variants?" → q_variants
      if (/^(variants?|options?|sizes?|colou?rs?|flavou?rs?|types?|kinds?)\s*\??$/.test(m.trim())) {
        return true;
      }
  
      return false;
    },
  },

  // q_stock
  {
    intent: 'q_stock',
    match: (m) =>
      /\b(in stock|out of stock|available|availability|got any|have any|do you have|still have)\b/.test(m),
  },

  // q_location
  {
    intent: 'q_location',
    match: (m) =>
      /\b(where (are you|is the (shop|store))|location|address|find you|based)\b/.test(m),
  },

  // q_hours
  {
    intent: 'q_hours',
    match: (m) =>
      /\b(hours|open(ing)?|close(d|ing)?|when (do you|are you)|what time)\b/.test(m),
  },

  // q_about_store
  {
    intent: 'q_about_store',
    match: (m) =>
      /\b(about (you|your (shop|store|business))|who are you|tell me about|what (do|does) you (sell|do))\b/.test(m),
  },

  // q_price — kept LAST among specific rules because "how much" is generic
  // and we want delivery/payment-shaped questions to win first.
  {
    intent: 'q_price',
    match: (m) =>
      /\b(price|cost|how much|much is|expensive|cheap)\b/.test(m),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Compound-message heuristic (telemetry only in PR 1)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detects whether a message likely contains BOTH a question and a commerce
 * action ("how much is it? add 2"). Per PR 1 design, this is logged only —
 * the planner picks the question as primary. Compound parsing comes later.
 */
export function detectsCompoundCommerceAction(rawMessage: string): boolean {
  const m = rawMessage.toLowerCase();
  const looksLikeQuestion =
    m.includes('?') ||
    QUESTION_WORDS_RE.test(m) ||
    /\b(price|cost|how much|delivery|payment|refund|stock|available|hours|location)\b/.test(m);

  const looksLikeAction =
    /\b(add|put|buy|order|purchase|get me|i want|i'll take|checkout|pay)\b/.test(m) &&
    /\b\d+\b/.test(m); // some quantity-ish number present

  return looksLikeQuestion && looksLikeAction;
}