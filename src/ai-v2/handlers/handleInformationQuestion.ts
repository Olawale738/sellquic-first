import type {
  InformationReply,
  KnowledgeTurnContext,
  ProductSearcher,
  QuestionIntent,
  Referent,
  StoreKnowledge,
} from '../knowledge/types';
import { PRODUCT_QUESTION_INTENTS } from '../knowledge/types';
import { buildAnswer } from '../knowledge/answerBuilders';
import { resolveReferent } from '../knowledge/resolveReferent';
import { resolveExplicitProduct } from '../knowledge/resolveExplicitProduct';

export interface InformationHandlerOutput {
  composedReply: string;
  reply: InformationReply;
  telemetry: {
    questionIntent: QuestionIntent;
    referent: string;
    referentSource?: string;
    /**
     * Set when the resolved referent was a product. Used by the
     * orchestrator to persist active product focus after the answer.
     */
    referentProductId?: string;
    answerSource: string;
    resumed: boolean;
    knowledgeMissing: string[];
  };
}

export interface InformationHandlerOptions {
  /**
   * Optional production product searcher. When provided, the explicit-product
   * resolver delegates to it for product-shaped questions (q_price/q_stock/
   * q_variants). Wire this to the existing searchProducts() in the
   * orchestrator to get its catalog-aware behavior for free.
   */
  searchProducts?: ProductSearcher;
}

/**
 * Handles a customer information question.
 *
 *   1. For product-shaped questions, try resolveExplicitProduct first.
 *      "How much is Accra spice co shito?" → matches by message content.
 *   2. If no explicit match, fall back to resolveReferent (pronoun /
 *      pending / cart-single).
 *   3. Build an answer from verified StoreKnowledge.
 *   4. Compose the customer-facing reply by gluing answerText + resume prompt.
 *
 * Pure orchestration. Performs ZERO commerce mutations — never touches
 * cart, delivery, address, phone, name, checkout, or commerce state.
 */
export function handleInformationQuestion(
  intent: QuestionIntent,
  ctx: KnowledgeTurnContext,
  knowledge: StoreKnowledge,
  options: InformationHandlerOptions = {},
): InformationHandlerOutput {
  const referent = resolveQuestionReferent(intent, ctx, knowledge, options.searchProducts);
  const reply = buildAnswer(intent, ctx, knowledge, referent);

  const composed = composeReply(reply);

  return {
    composedReply: composed,
    reply,
    telemetry: {
      questionIntent: intent,
      referent: referent.kind,
      referentSource:
        referent.kind === 'product' ? referent.source : undefined,
      referentProductId:
        referent.kind === 'product' ? referent.product.id : undefined,
      answerSource: reply.answerSource,
      resumed: reply.resume.kind !== 'none',
      knowledgeMissing: reply.diagnostics?.knowledgeMissing ?? [],
    },
  };
}

/**
 * Two-stage referent resolution:
 *
 *   stage 1 (only for product-shaped intents):
 *     resolveExplicitProduct(message, catalog, searcher)
 *
 *   stage 2 (always):
 *     resolveReferent(intent, ctx, knowledge)
 *
 * Stage 2 implements the pronoun/pending/cart-single fallback that's
 * already proven safe in PR1.
 */
function resolveQuestionReferent(
  intent: QuestionIntent,
  ctx: KnowledgeTurnContext,
  knowledge: StoreKnowledge,
  searcher: ProductSearcher | undefined,
): Referent {
  if (PRODUCT_QUESTION_INTENTS.has(intent)) {
    const explicit = resolveExplicitProduct(
      ctx.customerMessage,
      ctx.productsById,
      searcher,
    );
    if (explicit.kind === 'match') {
      return {
        kind: 'product',
        product: explicit.product,
        source: 'explicit_message',
      };
    }
    // 'ambiguous' currently falls through to pronoun fallback. If both
    // produce nothing, the answer builder asks "which product?".
    // (We could escalate ambiguous to its own builder later; not in PR2.)
  }

  return resolveReferent(intent, ctx, knowledge);
}

/**
 * Compose the final customer-visible string.
 *
 * Single-line answers use ". " or " " as the separator (depending on whether
 * the answer already ends in punctuation). Multi-line answers (e.g. cart
 * total breakdown) get blank-line-separated from the resume prompt for
 * readability.
 */
export function composeReply(reply: InformationReply): string {
  const a = reply.answerText.trim();
  if (reply.resume.kind === 'none') return a;

  const p = reply.resume.prompt.trim();
  if (p.length === 0) return a;

  if (a.includes('\n')) return `${a}\n\n${p}`;

  // Avoid double-period when answerText ends with punctuation.
  const sep = /[.!?]$/.test(a) ? ' ' : '. ';
  return `${a}${sep}${p}`;
}