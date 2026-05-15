import type {
    AiTurnResult,
    CartItemV2,
    ProductVariantV2,
    TurnContext,
  } from '../types';
  import type { CombinedOrderIntent } from '../extractors/extractCombinedOrderIntent';
  
  import { searchProducts } from '../search/searchProducts';
  import { resolveVariant } from '../catalog/resolveVariant';
  import {
    getEffectiveProductPrice,
    getEffectiveVariantPrice,
  } from '../catalog/pricing';
  import {
    getProductAvailability,
    isVariantPurchasable,
  } from '../catalog/availability';
  import { createCommerceState } from '../state/commerceState';
  import { executeCommerceActions } from '../actions/executeCommerceAction';
  import { buildCheckoutConfirmationQuestion } from '../checkout/formatCheckoutQuestion';
  import { handleProductSearch } from './handleProductSearch';
  
  // ─── helpers (duplicates of handleQuantityReply internals; extract later) ──
  
  function upsertCartItem(cart: CartItemV2[], newItem: CartItemV2): CartItemV2[] {
    const existingIndex = cart.findIndex(
      (item) =>
        item.productId === newItem.productId &&
        (item.variantId || null) === (newItem.variantId || null)
    );
  
    if (existingIndex === -1) {
      return [...cart, newItem];
    }
  
    const copy = [...cart];
    copy[existingIndex] = { ...copy[existingIndex], ...newItem };
    return copy;
  }
  
  function buildNextQuestion(ctx: TurnContext, state: string): string {
    switch (state) {
      case 'AWAITING_DELIVERY_AREA':
        return 'Where should we deliver it please?';
      case 'AWAITING_ADDRESS':
        return 'Please send the specific delivery address or landmark.';
      case 'AWAITING_PHONE':
        return 'What phone number should we use for the order please?';
      case 'AWAITING_NAME':
        return 'What name should I put on the order please?';
      case 'READY_FOR_CHECKOUT':
        return buildCheckoutConfirmationQuestion(ctx);
      default:
        return 'Would you like to add anything else?';
    }
  }
  
  async function persistStateOnly(
    ctx: TurnContext,
    state: ReturnType<typeof createCommerceState>,
    reason: string
  ) {
    await executeCommerceActions(ctx, [
      { type: 'SET_COMMERCE_STATE', state, reason },
    ]);
  }
  
  // ─── handler ────────────────────────────────────────────────────────────────
  
  /**
   * Drives a (possibly partial) combined add-product intent through the same
   * machine gates handleQuantityReply uses:
   *   searchProducts → availability → resolveVariant → stock → executor
   *
   * Never bypasses executeCommerceActions. Never invents pricing or stock.
   * Cart mutation is REPLACE_CART + DERIVE_NEXT_STATE — identical pattern.
   *
   * On product no_match / multiple_matches we delegate to handleProductSearch
   * so its existing UX (cards, prompts) keeps owning that path. The customer's
   * quantity/variant intent is dropped in that branch — follow-up: stash on
   * commerceState as pendingQuantity/pendingVariantHint to recover after the
   * customer picks a product.
   */
  export async function handleAddProductCombined(
    ctx: TurnContext,
    payload: CombinedOrderIntent
  ): Promise<AiTurnResult> {
    // 1. PRODUCT
    const productQuery = payload.productQuery;
    if (!productQuery) {
      // Defensive — extractor should never return a payload without a productQuery.
      return handleProductSearch(ctx);
    }
  
    const searchResult = await searchProducts({
      query: productQuery,
      products: ctx.products,
      storeId: ctx.storeId,
      limit: 5,
    });
  
    if (searchResult.status !== 'single_match' || !searchResult.products[0]) {
      return handleProductSearch({ ...ctx, message: productQuery });
    }
  
    const product = searchResult.products[0];
  
    // 2. AVAILABILITY
    const availability = getProductAvailability(product);
    if (!availability.purchasable) {
      const state = createCommerceState('BROWSING', {
        lastShownProductIds: [product.id],
      });
      await persistStateOnly(ctx, state, availability.reason);
      return {
        reply: {
          type: 'text',
          content: `Sorry please, ${product.name} is currently not available to order. Would you like to see another option?`,
        },
        debug: {
          stateBefore: ctx.commerceState.state,
          stateAfter: state.state,
          handler: 'handleAddProductCombined',
          reason: availability.reason,
        },
      };
    }
  
    // 3. VARIANT
    const hasVariants =
      product.hasVariants === true &&
      Array.isArray(product.variants) &&
      product.variants.length > 0;
  
    let variant: ProductVariantV2 | null = null;
  
    if (hasVariants) {
      if (!payload.variantQuery) {
        const state = createCommerceState('AWAITING_VARIANT', {
          pendingProductId: product.id,
          lastShownProductIds: [product.id],
        });
        await persistStateOnly(ctx, state, 'variant_required_combined');
        return {
          reply: {
            type: 'text',
            content: `Please which option would you like for ${product.name}?`,
          },
          debug: {
            stateBefore: ctx.commerceState.state,
            stateAfter: state.state,
            handler: 'handleAddProductCombined',
            reason: 'variant_required_combined',
          },
        };
      }
  
      const variantResult = resolveVariant(payload.variantQuery, product);
  
      if (variantResult.status !== 'single_match' || !variantResult.variant) {
        const state = createCommerceState('AWAITING_VARIANT', {
          pendingProductId: product.id,
          lastShownProductIds: [product.id],
        });
        await persistStateOnly(
          ctx,
          state,
          `variant_${variantResult.status}_combined`
        );
        return {
          reply: {
            type: 'text',
            content: `Please which option would you like for ${product.name}?`,
          },
          debug: {
            stateBefore: ctx.commerceState.state,
            stateAfter: state.state,
            handler: 'handleAddProductCombined',
            reason: `variant_${variantResult.status}_combined`,
          },
        };
      }
  
      variant = variantResult.variant;
  
      if (!isVariantPurchasable(product, variant)) {
        const state = createCommerceState('AWAITING_VARIANT', {
          pendingProductId: product.id,
          lastShownProductIds: [product.id],
        });
        await persistStateOnly(ctx, state, 'variant_out_of_stock_combined');
        return {
          reply: {
            type: 'text',
            content: `Sorry please, ${product.name} in ${variant.name} is currently out of stock. Would you like another option?`,
          },
          debug: {
            stateBefore: ctx.commerceState.state,
            stateAfter: state.state,
            handler: 'handleAddProductCombined',
            reason: 'variant_out_of_stock_combined',
          },
        };
      }
    }
  
    // 4. QUANTITY
    if (payload.quantity == null) {
      const state = createCommerceState('AWAITING_QUANTITY', {
        pendingProductId: product.id,
        pendingVariantId: variant?.id || null,
        lastShownProductIds: [product.id],
      });
      await persistStateOnly(ctx, state, 'quantity_missing_combined');
      return {
        reply: {
          type: 'text',
          content: `How many ${product.name} should I add for you please?`,
        },
        debug: {
          stateBefore: ctx.commerceState.state,
          stateAfter: state.state,
          handler: 'handleAddProductCombined',
          reason: 'quantity_missing_combined',
        },
      };
    }
  
    const quantity = payload.quantity;
  
    if (quantity < 1) {
      const state = createCommerceState('AWAITING_QUANTITY', {
        pendingProductId: product.id,
        pendingVariantId: variant?.id || null,
        lastShownProductIds: [product.id],
      });
      await persistStateOnly(ctx, state, 'invalid_quantity_combined');
      return {
        reply: {
          type: 'text',
          content: `How many ${product.name} should I add for you please?`,
        },
        debug: {
          stateBefore: ctx.commerceState.state,
          stateAfter: state.state,
          handler: 'handleAddProductCombined',
          reason: 'invalid_quantity_combined',
        },
      };
    }
  
    // 5. STOCK
    if (product.manageStock === true) {
      const availableStock = variant
        ? Number(variant.stock || 0)
        : Number(product.stock || 0);
  
      if (quantity > availableStock) {
        const state = createCommerceState('AWAITING_QUANTITY', {
          pendingProductId: product.id,
          pendingVariantId: variant?.id || null,
          lastShownProductIds: [product.id],
        });
        await persistStateOnly(ctx, state, 'quantity_exceeds_stock_combined');
        return {
          reply: {
            type: 'text',
            content: `Sorry please, we only have ${availableStock} available. How many should I add for you?`,
          },
          debug: {
            stateBefore: ctx.commerceState.state,
            stateAfter: state.state,
            handler: 'handleAddProductCombined',
            reason: 'quantity_exceeds_stock_combined',
          },
        };
      }
    }
  
    // 6. PRICE — machine-owned
    const unitPrice = variant
      ? getEffectiveVariantPrice(variant, ctx.storeData)
      : getEffectiveProductPrice(product, ctx.storeData);
  
    // 7. CART ITEM (snapshots — identical to handleQuantityReply)
    const cartItem: CartItemV2 = {
      productId: product.id,
      variantId: variant?.id || null,
      quantity,
      nameSnapshot: product.name,
      variantNameSnapshot: variant?.name || null,
      unitPriceSnapshot: unitPrice,
      imageUrlSnapshot: variant?.image || product.images?.[0] || null,
    };
  
    const updatedCart = upsertCartItem(ctx.currentCart, cartItem);
  
    // 8. EXECUTOR — REPLACE_CART + DERIVE_NEXT_STATE only
    const { ctx: updatedCtx, execution } = await executeCommerceActions(ctx, [
      {
        type: 'REPLACE_CART',
        items: updatedCart,
        reason: 'combined_order_upsert_cart_item',
      },
      {
        type: 'DERIVE_NEXT_STATE',
        statePatch: {
          pendingProductId: product.id,
          pendingVariantId: variant?.id || null,
          lastShownProductIds: [product.id],
        },
        reason: 'derive_next_state_after_combined_add',
      },
    ]);
  
    const productLabel = variant
      ? `${product.name} (${variant.name})`
      : product.name;
    const nextQuestion = buildNextQuestion(
      updatedCtx,
      updatedCtx.commerceState.state
    );
  
    return {
      reply: {
        type: 'text',
        content: `${productLabel} x${quantity} added please. ${nextQuestion}`,
      },
      debug: {
        stateBefore: ctx.commerceState.state,
        stateAfter: updatedCtx.commerceState.state,
        handler: 'handleAddProductCombined',
        reason: execution.reasonSummary.join('|') || 'combined_order_saved',
      },
    };
  }