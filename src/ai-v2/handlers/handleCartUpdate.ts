import type { AiTurnResult, CartItemV2, ProductV2, TurnContext } from '../types';
import {
  extractCartUpdateIntent,
  type CartUpdateIntent,
} from '../extractors/extractCartUpdateIntent';
import { searchProducts } from '../search/searchProducts';
import {
  getProductAvailability,
  isVariantPurchasable,
} from '../catalog/availability';
import { createCommerceState } from '../state/commerceState';
import { executeCommerceActions } from '../actions/executeCommerceAction';
import {
  formatCartSummary,
  getCartLines,
  type CartLineV2,
} from '../cart/cartSummary';
import { buildCheckoutConfirmationQuestion } from '../checkout/formatCheckoutQuestion';

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

function productHasStockForQuantity(
  product: ProductV2,
  line: CartLineV2,
  quantity: number
): {
  ok: boolean;
  message?: string;
} {
  const availability = getProductAvailability(product);

  if (!availability.purchasable) {
    return {
      ok: false,
      message: `${product.name} is currently not available to order. Would you like to choose another option?`,
    };
  }

  if (line.variant && !isVariantPurchasable(product, line.variant)) {
    return {
      ok: false,
      message: `Sorry please, ${line.label} is currently out of stock. Would you like another option?`,
    };
  }

  if (product.manageStock === true) {
    const availableStock = line.variant
      ? Number(line.variant.stock || 0)
      : Number(product.stock || 0);

    if (quantity > availableStock) {
      return {
        ok: false,
        message: `Sorry please, we only have ${availableStock} available for ${line.label}. How many should I use?`,
      };
    }
  }

  return { ok: true };
}

function getCartProductsFromLines(lines: CartLineV2[]): ProductV2[] {
  return lines.map((line) => line.product);
}

async function resolveTargetLine(
  ctx: TurnContext,
  intent: CartUpdateIntent
): Promise<{
  status: 'single' | 'multiple' | 'none';
  line?: CartLineV2;
  lines?: CartLineV2[];
  reason: string;
}> {
  const lines = getCartLines(ctx);

  if (!lines.length) {
    return { status: 'none', reason: 'cart_empty' };
  }

  if ('ordinalIndex' in intent && typeof intent.ordinalIndex === 'number') {
    const line = lines[intent.ordinalIndex];

    if (line) {
      return { status: 'single', line, reason: 'ordinal_cart_item_match' };
    }

    return { status: 'none', reason: 'ordinal_out_of_range', lines };
  }

  if ('productQuery' in intent && intent.productQuery) {
    const cartProducts = getCartProductsFromLines(lines);

    const result = await searchProducts({
      query: intent.productQuery,
      products: cartProducts,
      storeId: ctx.storeId,
      limit: 6,
    });

    if (result.status === 'single_match') {
      const productId = result.products[0].id;

      const matchedLines = lines.filter((line) => {
        return line.product.id === productId;
      });

      if (matchedLines.length === 1) {
        return {
          status: 'single',
          line: matchedLines[0],
          reason: result.reason,
        };
      }

      return {
        status: 'multiple',
        lines: matchedLines,
        reason: 'multiple_cart_lines_for_product',
      };
    }

    if (result.status === 'multiple_matches') {
      const ids = new Set(result.products.map((product) => product.id));

      return {
        status: 'multiple',
        lines: lines.filter((line) => ids.has(line.product.id)),
        reason: result.reason,
      };
    }

    return { status: 'none', reason: result.reason, lines };
  }

  if (lines.length === 1) {
    return {
      status: 'single',
      line: lines[0],
      reason: 'single_cart_item_default',
    };
  }

  return {
    status: 'multiple',
    lines,
    reason: 'multiple_cart_items_need_selection',
  };
}

function removeLineFromCart(
  cart: CartItemV2[],
  target: CartLineV2
): CartItemV2[] {
  return cart.filter((item) => {
    return !(
      item.productId === target.item.productId &&
      (item.variantId || null) === (target.item.variantId || null)
    );
  });
}

function updateLineQuantity(
  cart: CartItemV2[],
  target: CartLineV2,
  quantity: number
): CartItemV2[] {
  return cart.map((item) => {
    const isTarget =
      item.productId === target.item.productId &&
      (item.variantId || null) === (target.item.variantId || null);

    if (!isTarget) return item;

    return {
      ...item,
      quantity,
    };
  });
}

function optionList(lines: CartLineV2[]): string {
  return lines
    .map((line, index) => `${index + 1}. ${line.label} x${line.item.quantity}`)
    .join('\n');
}

async function persistStateOnly(
  ctx: TurnContext,
  state: ReturnType<typeof createCommerceState>,
  reason: string
) {
  await executeCommerceActions(ctx, [
    {
      type: 'SET_COMMERCE_STATE',
      state,
      reason,
    },
  ]);
}

export async function handleCartUpdate(
  ctx: TurnContext
): Promise<AiTurnResult | null> {
  const intent = extractCartUpdateIntent(ctx.message);

  if (intent.type === 'none') return null;

  const lines = getCartLines(ctx);

  if (intent.type === 'show_cart') {
    return {
      reply: {
        type: 'text',
        content: formatCartSummary(ctx),
      },
      debug: {
        stateBefore: ctx.commerceState.state,
        stateAfter: ctx.commerceState.state,
        handler: 'handleCartUpdate',
        reason: 'show_cart',
      },
    };
  }

  if (intent.type === 'clear_cart') {
    const { ctx: updatedCtx, execution } = await executeCommerceActions(ctx, [
      {
        type: 'CLEAR_CART',
        reason: 'clear_cart_requested',
      },
      {
        type: 'DERIVE_NEXT_STATE',
        reason: 'derive_next_state_after_clear_cart',
      },
    ]);

    return {
      reply: {
        type: 'text',
        content: 'Cart cleared please. What would you like to order now?',
      },
      debug: {
        stateBefore: ctx.commerceState.state,
        stateAfter: updatedCtx.commerceState.state,
        handler: 'handleCartUpdate',
        reason: execution.reasonSummary.join('|') || 'clear_cart',
      },
    };
  }

  if (!lines.length) {
    return {
      reply: {
        type: 'text',
        content:
          'Your cart is currently empty please. What would you like to order?',
      },
      debug: {
        stateBefore: ctx.commerceState.state,
        stateAfter: ctx.commerceState.state,
        handler: 'handleCartUpdate',
        reason: 'cart_empty',
      },
    };
  }

  const target = await resolveTargetLine(ctx, intent);

  if (target.status !== 'single' || !target.line) {
    return {
      reply: {
        type: 'text',
        content: `Please which cart item should I update?\n\n${optionList(
          target.lines?.length ? target.lines : lines
        )}`,
      },
      debug: {
        stateBefore: ctx.commerceState.state,
        stateAfter: ctx.commerceState.state,
        handler: 'handleCartUpdate',
        reason: target.reason,
      },
    };
  }

  if (intent.type === 'remove_item') {
    const updatedCart = removeLineFromCart(ctx.currentCart, target.line);

    const { ctx: updatedCtx, execution } = await executeCommerceActions(ctx, [
      {
        type: 'REPLACE_CART',
        items: updatedCart,
        reason: 'remove_cart_item',
      },
      {
        type: 'DERIVE_NEXT_STATE',
        statePatch: {
          lastShownProductIds: ctx.commerceState.lastShownProductIds || [],
          pendingProductId: null,
          pendingVariantId: null,
        },
        reason: 'derive_next_state_after_remove_item',
      },
    ]);

    const nextMessage = updatedCart.length
      ? buildNextQuestion(updatedCtx, updatedCtx.commerceState.state)
      : 'What would you like to order now?';

    return {
      reply: {
        type: 'text',
        content: `${target.line.label} removed please. ${nextMessage}`,
      },
      debug: {
        stateBefore: ctx.commerceState.state,
        stateAfter: updatedCtx.commerceState.state,
        handler: 'handleCartUpdate',
        reason: execution.reasonSummary.join('|') || 'remove_item',
      },
    };
  }

  const nextQuantity =
    intent.type === 'set_quantity'
      ? intent.quantity
      : target.line.item.quantity + intent.delta;

  if (!Number.isFinite(nextQuantity) || nextQuantity <= 0) {
    return {
      reply: {
        type: 'text',
        content: 'Please send a valid quantity.',
      },
      debug: {
        stateBefore: ctx.commerceState.state,
        stateAfter: ctx.commerceState.state,
        handler: 'handleCartUpdate',
        reason: 'invalid_updated_quantity',
      },
    };
  }

  const stockCheck = productHasStockForQuantity(
    target.line.product,
    target.line,
    nextQuantity
  );

  if (!stockCheck.ok) {
    const state = createCommerceState('AWAITING_QUANTITY', {
      pendingProductId: target.line.product.id,
      pendingVariantId: target.line.variant?.id || null,
      lastShownProductIds: [target.line.product.id],
    });

    await executeCommerceActions(ctx, [
      {
        type: 'CLEAR_CHECKOUT',
        reason: 'stock_check_failed_clear_checkout',
      },
      {
        type: 'SET_COMMERCE_STATE',
        state,
        reason: 'stock_check_failed_set_quantity_state',
      },
    ]);

    return {
      reply: {
        type: 'text',
        content: stockCheck.message || 'Please send a valid quantity.',
      },
      debug: {
        stateBefore: ctx.commerceState.state,
        stateAfter: state.state,
        handler: 'handleCartUpdate',
        reason: 'stock_check_failed',
      },
    };
  }

  const updatedCart = updateLineQuantity(
    ctx.currentCart,
    target.line,
    nextQuantity
  );

  const { ctx: updatedCtx, execution } = await executeCommerceActions(ctx, [
    {
      type: 'REPLACE_CART',
      items: updatedCart,
      reason: 'update_cart_item_quantity',
    },
    {
      type: 'DERIVE_NEXT_STATE',
      statePatch: {
        lastShownProductIds: ctx.commerceState.lastShownProductIds || [],
        pendingProductId: target.line.product.id,
        pendingVariantId: target.line.variant?.id || null,
      },
      reason: 'derive_next_state_after_quantity_update',
    },
  ]);

  const nextQuestion = buildNextQuestion(
    updatedCtx,
    updatedCtx.commerceState.state
  );

  return {
    reply: {
      type: 'text',
      content: `${target.line.label} updated to x${nextQuantity} please. ${nextQuestion}`,
    },
    debug: {
      stateBefore: ctx.commerceState.state,
      stateAfter: updatedCtx.commerceState.state,
      handler: 'handleCartUpdate',
      reason: execution.reasonSummary.join('|') || intent.type,
    },
  };
}