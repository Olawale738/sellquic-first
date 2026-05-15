import type { AiTurnResult, CartItemV2, ProductV2, TurnContext } from '../types';
import { extractQuantity } from '../extractors/extractQuantity';
import { getEffectiveProductPrice, getEffectiveVariantPrice } from '../catalog/pricing';
import { getProductAvailability, isVariantPurchasable } from '../catalog/availability';
import { createCommerceState } from '../state/commerceState';
import { executeCommerceActions } from '../actions/executeCommerceAction';
import { buildCheckoutConfirmationQuestion } from '../checkout/formatCheckoutQuestion';


function isFrustrationEscape(message: string): boolean {
  const t = String(message || '').toLowerCase().trim();
  if (!t) return false;
  return /^(0|nothing|none|never\s*mind|nvm|forget\s+it|cancel|stop|no\s+thanks?|no\s+thank\s+you|i'?m\s+done|i\s+changed\s+my\s+mind|don'?t\s+want\s+it)\s*[!.?]*$/i.test(t);
}
function nameSuffix(ctx: TurnContext): string {
  const fullName = ctx.customer?.memory?.name?.trim();
  if (!fullName) return '';
  const firstName = fullName.split(/\s+/)[0];
  if (!firstName || firstName.length < 2) return '';
  return `, ${firstName}`;
}

function findPendingProduct(ctx: TurnContext): ProductV2 | null {
  const pendingProductId =
    ctx.commerceState.pendingProductId ||
    (ctx.commerceState.lastShownProductIds?.length === 1
      ? ctx.commerceState.lastShownProductIds[0]
      : null);
  if (!pendingProductId) return null;
  return ctx.products.find((product) => product.id === pendingProductId) || null;
}

function upsertCartItem(cart: CartItemV2[], newItem: CartItemV2): CartItemV2[] {
  const existingIndex = cart.findIndex((item) => {
    return (
      item.productId === newItem.productId &&
      (item.variantId || null) === (newItem.variantId || null)
    );
  });
  if (existingIndex === -1) return [...cart, newItem];
  const copy = [...cart];
  copy[existingIndex] = { ...copy[existingIndex], ...newItem };
  return copy;
}

function buildNextQuestion(ctx: TurnContext, state: string): string {
  const name = nameSuffix(ctx);
  switch (state) {
    case 'AWAITING_DELIVERY_AREA':
      return `Where should I deliver to${name}?`;
    case 'AWAITING_ADDRESS':
      return `Send the delivery address or a landmark${name}.`;
    case 'AWAITING_PHONE':
      return `What phone number should I use${name}?`;
    case 'AWAITING_NAME':
      return `What name should I put on the order${name}?`;
    case 'READY_FOR_CHECKOUT':
      return buildCheckoutConfirmationQuestion(ctx);
    default:
      return 'Anything else to add?';
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

export async function handleQuantityReply(ctx: TurnContext): Promise<AiTurnResult> {
  const quantity = extractQuantity(ctx.message);
  const product = findPendingProduct(ctx);
  const name = nameSuffix(ctx);

  if (!product) {
    const state = createCommerceState('IDLE');
    await persistStateOnly(ctx, state, 'missing_pending_product');

    return {
      reply: {
        type: 'text',
        content: `Which product should I add${name}?`,
      },
      debug: {
        stateBefore: ctx.commerceState.state,
        stateAfter: state.state,
        handler: 'handleQuantityReply',
        reason: 'missing_pending_product',
      },
    };
  }

  if (!quantity || isFrustrationEscape(ctx.message)) {
    // Escape: customer typed "0", "forget it", "never mind", "cancel" etc.
    // Reset state to BROWSING so they can do something else.
    if (isFrustrationEscape(ctx.message)) {
      const state = createCommerceState('BROWSING', {
        lastShownProductIds: ctx.commerceState.lastShownProductIds || [],
      });
      await persistStateOnly(ctx, state, 'quantity_frustration_escape');
      return {
        reply: {
          type: 'text',
          content: `Got it${name}! What would you like instead, or want to look at something else?`,
        },
        debug: {
          stateBefore: ctx.commerceState.state,
          stateAfter: state.state,
          handler: 'handleQuantityReply',
          reason: 'quantity_frustration_escape',
        },
      };
    }

    const state = createCommerceState('AWAITING_QUANTITY', {
      pendingProductId: product.id,
      pendingVariantId: ctx.commerceState.pendingVariantId || null,
      lastShownProductIds: [product.id],
    });
    await persistStateOnly(ctx, state, 'quantity_missing');

    return {
      reply: {
        type: 'text',
        content: `How many ${product.name}${name}?`,
      },
      debug: {
        stateBefore: ctx.commerceState.state,
        stateAfter: state.state,
        handler: 'handleQuantityReply',
        reason: 'quantity_missing',
      },
    };
  }

  const availability = getProductAvailability(product);

  if (!availability.purchasable) {
    const state = createCommerceState('BROWSING', {
      lastShownProductIds: [product.id],
    });
    await persistStateOnly(ctx, state, availability.reason);

    return {
      reply: {
        type: 'text',
        content: `Sorry${name}, ${product.name} isn't available right now. Want to see another option?`,
      },
      debug: {
        stateBefore: ctx.commerceState.state,
        stateAfter: state.state,
        handler: 'handleQuantityReply',
        reason: availability.reason,
      },
    };
  }

  const hasVariants =
    product.hasVariants === true &&
    Array.isArray(product.variants) &&
    product.variants.length > 0;

  const variantId = ctx.commerceState.pendingVariantId || null;
  const variant = hasVariants
    ? product.variants?.find((v) => v.id === variantId) || null
    : null;

  if (hasVariants && !variant) {
    const state = createCommerceState('AWAITING_VARIANT', {
      pendingProductId: product.id,
      lastShownProductIds: [product.id],
    });
    await persistStateOnly(ctx, state, 'variant_required_before_quantity');

    return {
      reply: {
        type: 'text',
        content: `Which option for ${product.name}${name}?`,
      },
      debug: {
        stateBefore: ctx.commerceState.state,
        stateAfter: state.state,
        handler: 'handleQuantityReply',
        reason: 'variant_required_before_quantity',
      },
    };
  }

  if (variant && !isVariantPurchasable(product, variant)) {
    const state = createCommerceState('AWAITING_VARIANT', {
      pendingProductId: product.id,
      lastShownProductIds: [product.id],
    });
    await persistStateOnly(ctx, state, 'variant_out_of_stock');

    return {
      reply: {
        type: 'text',
        content: `Sorry${name}, ${variant.name} is sold out. Want to pick another?`,
      },
      debug: {
        stateBefore: ctx.commerceState.state,
        stateAfter: state.state,
        handler: 'handleQuantityReply',
        reason: 'variant_out_of_stock',
      },
    };
  }

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
      await persistStateOnly(ctx, state, 'quantity_exceeds_stock');

      return {
        reply: {
          type: 'text',
          content: `We only have ${availableStock} in stock${name}. How many should I add?`,
        },
        debug: {
          stateBefore: ctx.commerceState.state,
          stateAfter: state.state,
          handler: 'handleQuantityReply',
          reason: 'quantity_exceeds_stock',
        },
      };
    }
  }

  const unitPrice = variant
    ? getEffectiveVariantPrice(variant, ctx.storeData)
    : getEffectiveProductPrice(product, ctx.storeData);

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

  const { ctx: updatedCtx, execution } = await executeCommerceActions(ctx, [
    {
      type: 'REPLACE_CART',
      items: updatedCart,
      reason: 'quantity_reply_upsert_cart_item',
    },
    {
      type: 'DERIVE_NEXT_STATE',
      statePatch: {
        pendingProductId: product.id,
        pendingVariantId: variant?.id || null,
        lastShownProductIds: [product.id],
      },
      reason: 'derive_next_state_after_quantity',
    },
  ]);

  const productLabel = variant ? `${product.name} (${variant.name})` : product.name;
  const nextQuestion = buildNextQuestion(updatedCtx, updatedCtx.commerceState.state);

  return {
    reply: {
      type: 'text',
      content: `Added ${productLabel} x${quantity}. ${nextQuestion}`,
    },
    debug: {
      stateBefore: ctx.commerceState.state,
      stateAfter: updatedCtx.commerceState.state,
      handler: 'handleQuantityReply',
      reason: execution.reasonSummary.join('|') || 'quantity_saved',
    },
  };
}