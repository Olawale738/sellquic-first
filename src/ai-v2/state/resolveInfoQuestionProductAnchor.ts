/**
 * Pure resolver for "which product is this information question about?"
 *
 * Used by the orchestrator-side router for question intents (q_price,
 * q_stock, q_variants, q_delivery_fee, etc.) to decide which product —
 * if any — should be persisted to commerceState.lastMentionedProductId
 * after the answer is given.
 *
 * This resolver does NOT persist anything. It returns a structured
 * decision; the caller (handleInformationQuestionRouter) decides how
 * to act on it.
 *
 * Resolution order (each step short-circuits on success):
 *
 *   1. explicit_name      — customer named the product in the message,
 *                            resolved via resolveExplicitProduct (typo
 *                            tolerance, IDF token weighting).
 *   2. pending_product    — commerceState.pendingProductId from earlier
 *                            turn (the active commerce focus).
 *   3. last_mentioned     — commerceState.lastMentionedProductId from
 *                            earlier turn (looser pronoun-resolution
 *                            anchor, may differ from pending).
 *   4. displayed_products — message contains a pronoun ("it", "this",
 *                            "that", "this one", "that one") AND
 *                            lastShownProductIds has exactly one entry.
 *   5. cart_single_item   — gated on product-shaped intents only;
 *                            cart has exactly one item.
 *
 * If multiple candidates surface at any step (explicit-ambiguous, or
 * multiple shown products with a pronoun), returns source='ambiguous'
 * with productId=null. Caller must NOT anchor on ambiguous results —
 * better to leave state unchanged than guess wrong.
 *
 * Pure. Synchronous. No I/O. No mutations. Deterministic for a given ctx.
 */

import type { ProductV2, TurnContext } from '../types';
import type { KnowledgeProduct, QuestionIntent } from '../knowledge/types';
import { resolveExplicitProduct } from '../knowledge/resolveExplicitProduct';

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export type AnchorSource =
  | 'explicit_name'
  | 'pending_product'
  | 'last_mentioned'
  | 'displayed_products'
  | 'cart_single_item'
  | 'ambiguous'
  | 'none';

export type AnchorResult = {
  productId: string | null;
  source: AnchorSource;
  matchCount: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Question intents where the answer is intrinsically about ONE product.
 * Used to gate the cart_single_item fallback — a generic delivery or
 * payment question shouldn't auto-anchor the lone cart item.
 */
const PRODUCT_QUESTION_INTENTS: ReadonlySet<QuestionIntent> = new Set<QuestionIntent>([
  'q_price',
  'q_stock',
  'q_variants',
]);

/**
 * Minimal pronoun set. Deliberately narrow — only forms that
 * unambiguously refer to a previously surfaced product. Ordinal
 * forms ("first one", "1st one", "number 2") are deliberately
 * excluded because they're already handled by the existing
 * provide_ordinal_selection intent and dialoguePolicy section 6/7.
 * Routing them here too would create dual paths for the same input.
 */
const PRONOUN_RE = /\b(this one|that one|the one|it|this|that)\b/i;

// ─────────────────────────────────────────────────────────────────────────────
// Public function
// ─────────────────────────────────────────────────────────────────────────────

export function resolveInfoQuestionProductAnchor(
  ctx: TurnContext,
  questionIntent: QuestionIntent,
): AnchorResult {
  const message = ctx.message || '';
  const products = ctx.products || [];
  const productIds = new Set(products.map((p) => p.id));

  // ── Step 1: explicit name match ────────────────────────────────────────
  // Reuse the catalog-aware matcher from the knowledge layer. It handles
  // typo tolerance and IDF-weighted token overlap. Bridge ProductV2 to
  // KnowledgeProduct via a typed adapter (no casts).
  const productsById = toKnowledgeProductsById(products);
  const explicit = resolveExplicitProduct(message, productsById);

  if (explicit.kind === 'match') {
    return {
      productId: explicit.product.id,
      source: 'explicit_name',
      matchCount: 1,
    };
  }
  if (explicit.kind === 'ambiguous') {
    return {
      productId: null,
      source: 'ambiguous',
      matchCount: explicit.candidates.length,
    };
  }
  // explicit.kind === 'none' → fall through

  // ── Step 2: pending_product (active commerce focus) ────────────────────
  const pendingId = ctx.commerceState.pendingProductId;
  if (pendingId && productIds.has(pendingId)) {
    return {
      productId: pendingId,
      source: 'pending_product',
      matchCount: 1,
    };
  }

  // ── Step 3: last_mentioned (looser anchor from earlier turn) ───────────
  const lastMentionedId = ctx.commerceState.lastMentionedProductId;
  if (lastMentionedId && productIds.has(lastMentionedId)) {
    return {
      productId: lastMentionedId,
      source: 'last_mentioned',
      matchCount: 1,
    };
  }

  // ── Step 4: pronoun + recently shown ───────────────────────────────────
  if (PRONOUN_RE.test(message)) {
    const shown = ctx.commerceState.lastShownProductIds || [];
    const validShown = shown.filter((id) => productIds.has(id));

    if (validShown.length === 1) {
      return {
        productId: validShown[0],
        source: 'displayed_products',
        matchCount: 1,
      };
    }
    if (validShown.length > 1) {
      return {
        productId: null,
        source: 'ambiguous',
        matchCount: validShown.length,
      };
    }
    // validShown.length === 0 → fall through
  }

  // ── Step 5: cart_single_item (product-shaped questions only) ───────────
  if (PRODUCT_QUESTION_INTENTS.has(questionIntent)) {
    const cart = ctx.currentCart || [];
    if (cart.length === 1) {
      const cartLine = cart[0];
      const cartProductId = cartLine?.productId;
      if (cartProductId && productIds.has(cartProductId)) {
        return {
          productId: cartProductId,
          source: 'cart_single_item',
          matchCount: 1,
        };
      }
    }
  }

  // ── No anchor available ─────────────────────────────────────────────────
  return {
    productId: null,
    source: 'none',
    matchCount: 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Typed adapter — ProductV2 → KnowledgeProduct
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the productsById record that resolveExplicitProduct expects.
 *
 * KnowledgeProduct requires id/name/price/currency/stockQty/inStock.
 * ProductV2 has id/name natively; price/stock are optional, so we
 * fill safe defaults. Currency is hardcoded 'GHS' — the codebase
 * is single-currency today and many other call sites do the same.
 *
 * variants and aliases pass through. The matcher only tokenizes
 * name + aliases, so variant data isn't strictly needed, but we
 * preserve aliases since they affect match quality.
 */
function toKnowledgeProductsById(
  products: ProductV2[],
): Record<string, KnowledgeProduct> {
  const out: Record<string, KnowledgeProduct> = {};
  for (const p of products) {
    out[p.id] = {
      id: p.id,
      name: p.name,
      price: typeof p.price === 'number' ? p.price : 0,
      currency: 'GHS',
      stockQty: typeof p.stock === 'number' ? p.stock : null,
      inStock: p.isOutOfStock !== true,
      aliases: p.aliases,
    };
  }
  return out;
}