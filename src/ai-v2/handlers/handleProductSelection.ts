import { db } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { AiTurnResult, ProductV2, TurnContext } from '../types';
import { extractOrdinalSelection } from '../extractors/extractOrdinalSelection';
import { searchProducts } from '../search/searchProducts';
import { formatProductCards } from '../catalog/formatProductCards';
import { getProductAvailability } from '../catalog/availability';
import { createCommerceState } from '../state/commerceState';

/**
 * Resolves the candidate products in their DISPLAY ORDER.
 *
 * Critical: this preserves the exact order the customer saw on screen,
 * including out-of-stock items. Ordinal selection ("the first one") relies
 * on this — it must point at index N of what was shown, not at index N of
 * a filtered subset.
 *
 * Falls back to pendingProductOptions / lastShownProductIds for older
 * conversations that pre-date displayedProductIds.
 */
function getPendingProducts(ctx: TurnContext): ProductV2[] {
  const orderedIds =
    ctx.commerceState.displayedProductIds?.length
      ? ctx.commerceState.displayedProductIds
      : ctx.commerceState.pendingProductOptions?.length
        ? ctx.commerceState.pendingProductOptions
        : ctx.commerceState.lastShownProductIds?.length
          ? ctx.commerceState.lastShownProductIds
          : ctx.commerceState.lastMentionedProductId
            ? [ctx.commerceState.lastMentionedProductId]
            : [];

  if (!orderedIds.length) return [];

  const productById = new Map(ctx.products.map((p) => [p.id, p]));

  // Preserve display order. Drop ids that no longer exist in catalog.
  const out: ProductV2[] = [];
  for (const id of orderedIds) {
    const p = productById.get(id);
    if (p) out.push(p);
  }
  return out;
}

function isAmbiguousSelectionText(message: string): boolean {
  const text = String(message || '').toLowerCase().trim();

  return /^(that one|this one|it|yes|yeah|yep|ok|okay|alright|sure|please|pls)$/i.test(
    text
  );
}

async function persistCommerceState(
  ctx: TurnContext,
  state: ReturnType<typeof createCommerceState>
) {
  const convRef = db
    .collection('stores')
    .doc(ctx.storeId)
    .collection('ai_conversations')
    .doc(ctx.conversationId);

  await convRef.set(
    {
      commerceState: state,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

function buildOptionList(products: ProductV2[]): string {
  return products
    .slice(0, 6)
    .map((product, index) => `${index + 1}. ${product.name}`)
    .join('\n');
}

function productHasVariants(product: ProductV2): boolean {
  return (
    product.hasVariants === true &&
    Array.isArray(product.variants) &&
    product.variants.length > 0
  );
}

async function moveForwardWithSelectedProduct(
  ctx: TurnContext,
  product: ProductV2,
  reason: string
): Promise<AiTurnResult> {
  const availability = getProductAvailability(product);

  if (!availability.purchasable) {
    const state = createCommerceState('BROWSING', {
      pendingProductId: product.id,
      lastShownProductIds: [product.id],
      lastMentionedProductId: product.id,
    });

    await persistCommerceState(ctx, state);

    return {
      reply: {
        type: 'product_cards',
        content: `Yes please, we have ${product.name}, but it is currently not available to order right now. Would you like to choose another option?`,
        products: formatProductCards([product], ctx.storeData),
      },
      debug: {
        stateBefore: ctx.commerceState.state,
        stateAfter: state.state,
        handler: 'handleProductSelection',
        reason: availability.reason,
      },
    };
  }

  if (productHasVariants(product)) {
    const variants = product.variants || [];
    const inStockVariants = variants.filter((v) => {
      const isOOS = (v as any).isOutOfStock === true;
      const stockZero = typeof v.stock === 'number' && v.stock === 0;
      return !isOOS && !stockZero;
    });

    // Single-variant auto-select: if a product has exactly one in-stock
    // variant, the customer has no real choice to make. Skip
    // AWAITING_VARIANT and go straight to quantity.
    if (inStockVariants.length === 1) {
      const onlyVariant = inStockVariants[0];
      const state = createCommerceState('AWAITING_QUANTITY', {
        pendingProductId: product.id,
        pendingVariantId: onlyVariant.id,
        lastShownProductIds: [product.id],
        lastMentionedProductId: product.id,
      });
      await persistCommerceState(ctx, state);

      return {
        reply: {
          type: 'product_cards',
          content: `Yes please, ${product.name} selected. How many should I add for you?`,
          products: formatProductCards([product], ctx.storeData),
        },
        debug: {
          stateBefore: ctx.commerceState.state,
          stateAfter: state.state,
          handler: 'handleProductSelection',
          reason: `${reason}|single_variant_auto_selected`,
        },
      };
    }

    // Multi-variant: ask which option.
    const state = createCommerceState('AWAITING_VARIANT', {
      pendingProductId: product.id,
      lastShownProductIds: [product.id],
      lastMentionedProductId: product.id,
    });
    await persistCommerceState(ctx, state);

    return {
      reply: {
        type: 'product_cards',
        content: `Great — for ${product.name}, which option would you like?`,
        products: formatProductCards([product], ctx.storeData),
      },
      debug: {
        stateBefore: ctx.commerceState.state,
        stateAfter: state.state,
        handler: 'handleProductSelection',
        reason,
      },
    };
  }

  const state = createCommerceState('AWAITING_QUANTITY', {
    pendingProductId: product.id,
    pendingVariantId: null,
    lastShownProductIds: [product.id],
    lastMentionedProductId: product.id,
  });

  await persistCommerceState(ctx, state);

  return {
    reply: {
      type: 'product_cards',
      content: `Yes please, ${product.name} selected. How many should I add for you?`,
      products: formatProductCards([product], ctx.storeData),
    },
    debug: {
      stateBefore: ctx.commerceState.state,
      stateAfter: state.state,
      handler: 'handleProductSelection',
      reason,
    },
  };
}

export async function handleProductSelection(
  ctx: TurnContext
): Promise<AiTurnResult> {
  const pendingProducts = getPendingProducts(ctx);

  if (!pendingProducts.length) {
    const state = createCommerceState('IDLE');

    await persistCommerceState(ctx, state);

    return {
      reply: {
        type: 'text',
        content: 'Please which product would you like to order?',
      },
      debug: {
        stateBefore: ctx.commerceState.state,
        stateAfter: state.state,
        handler: 'handleProductSelection',
        reason: 'missing_pending_product_options',
      },
    };
  }

  const ordinalIndex = extractOrdinalSelection(ctx.message);

  if (ordinalIndex !== null) {
    const product = pendingProducts[ordinalIndex];

    if (!product) {
      const ids = pendingProducts.map((p) => p.id);
      const state = createCommerceState('AWAITING_PRODUCT_SELECTION', {
        pendingProductOptions: ids,
        lastShownProductIds: ids,
        displayedProductIds: ids,
      });

      await persistCommerceState(ctx, state);

      return {
        reply: {
          type: 'text',
          content: `Just pick one of these — which one?\n\n${buildOptionList(
            pendingProducts
          )}`,
        },
        debug: {
          stateBefore: ctx.commerceState.state,
          stateAfter: state.state,
          handler: 'handleProductSelection',
          reason: 'ordinal_out_of_range',
        },
      };
    }

    return moveForwardWithSelectedProduct(
      ctx,
      product,
      'ordinal_product_selection'
    );
  }

  if (isAmbiguousSelectionText(ctx.message)) {
    // If there's exactly ONE product in pending, the customer's
    // affirmative IS unambiguous — they're saying yes to that one.
    // Auto-select and advance the flow.
    if (pendingProducts.length === 1) {
      return moveForwardWithSelectedProduct(
        ctx,
        pendingProducts[0],
        'affirmative_single_pending_product',
      );
    }

    // Multiple options → genuinely ambiguous, show the list.
    const ids = pendingProducts.map((p) => p.id);
    const state = createCommerceState('AWAITING_PRODUCT_SELECTION', {
      pendingProductOptions: ids,
      lastShownProductIds: ids,
      displayedProductIds: ids,
    });

    await persistCommerceState(ctx, state);

    return {
      reply: {
        type: 'text',
        content: `Please which one exactly?\n\n${buildOptionList(
          pendingProducts
        )}`,
      },
      debug: {
        stateBefore: ctx.commerceState.state,
        stateAfter: state.state,
        handler: 'handleProductSelection',
        reason: 'ambiguous_product_selection',
      },
    };
  }

  // 1. First try to resolve only within the products we just showed.
  const resolved = await searchProducts({
    query: ctx.message,
    products: pendingProducts,
    storeId: ctx.storeId,
    limit: 6,
  });

  if (resolved.status === 'single_match') {
    return moveForwardWithSelectedProduct(
      ctx,
      resolved.products[0],
      resolved.reason
    );
  }

  if (resolved.status === 'multiple_matches') {
    const products = resolved.products.slice(0, 6);
    const ids = products.map((p) => p.id);

    const state = createCommerceState('AWAITING_PRODUCT_SELECTION', {
      pendingProductOptions: ids,
      lastShownProductIds: ids,
      displayedProductIds: ids,
    });

    await persistCommerceState(ctx, state);

    return {
      reply: {
        type: 'product_cards',
        content: 'A few of these could work — which one would you like?',
        products: formatProductCards(products, ctx.storeData),
      },
      debug: {
        stateBefore: ctx.commerceState.state,
        stateAfter: state.state,
        handler: 'handleProductSelection',
        reason: resolved.reason,
      },
    };
  }

  // 2. If not found inside pending options, search the full catalog.
  // This is critical for correction messages like:
  // "I mean Akwasi's shito supreme"
  const fullCatalogResolved = await searchProducts({
    query: ctx.message,
    products: ctx.products,
    storeId: ctx.storeId,
    limit: 6,
  });

  if (fullCatalogResolved.status === 'single_match') {
    return moveForwardWithSelectedProduct(
      ctx,
      fullCatalogResolved.products[0],
      `full_catalog_${fullCatalogResolved.reason}`
    );
  }

  if (fullCatalogResolved.status === 'multiple_matches') {
    const products = fullCatalogResolved.products.slice(0, 6);
    const ids = products.map((p) => p.id);

    const state = createCommerceState('AWAITING_PRODUCT_SELECTION', {
      pendingProductOptions: ids,
      lastShownProductIds: ids,
      displayedProductIds: ids,
    });

    await persistCommerceState(ctx, state);

    return {
      reply: {
        type: 'product_cards',
        content: 'A few of these could work — which one would you like?',
        products: formatProductCards(products, ctx.storeData),
      },
      debug: {
        stateBefore: ctx.commerceState.state,
        stateAfter: state.state,
        handler: 'handleProductSelection',
        reason: `full_catalog_${fullCatalogResolved.reason}`,
      },
    };
  }

  // 3. Final fallback: keep the customer inside the selection state,
  // but show the original options again.
  const ids = pendingProducts.map((p) => p.id);
  const state = createCommerceState('AWAITING_PRODUCT_SELECTION', {
    pendingProductOptions: ids,
    lastShownProductIds: ids,
    displayedProductIds: ids,
  });

  await persistCommerceState(ctx, state);

  return {
    reply: {
      type: 'text',
      content: `Please choose one of these options:\n\n${buildOptionList(
        pendingProducts
      )}`,
    },
    debug: {
      stateBefore: ctx.commerceState.state,
      stateAfter: state.state,
      handler: 'handleProductSelection',
      reason: `pending_${resolved.reason}_full_catalog_${fullCatalogResolved.reason}`,
    },
  };
}