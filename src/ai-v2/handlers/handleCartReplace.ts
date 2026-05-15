import type { AiTurnResult, TurnContext } from '../types';
import { createCommerceState } from '../state/commerceState';
import { executeCommerceActions } from '../actions/executeCommerceAction';
import { handleProductSearch } from './handleProductSearch';

export async function handleCartReplace(
  ctx: TurnContext,
  productQuery?: string
): Promise<AiTurnResult> {
  const { ctx: clearedCtx } = await executeCommerceActions(ctx, [
    {
      type: 'CLEAR_CART',
      reason: 'cart_replace_clear_existing_cart',
    },
    {
      type: 'CLEAR_CHECKOUT',
      reason: 'cart_replace_clear_existing_checkout',
    },
    {
      type: 'SET_COMMERCE_STATE',
      state: createCommerceState('BROWSING'),
      reason: 'cart_replace_set_browsing',
    },
  ]);

  const cleanedQuery = String(productQuery || '').trim();

  if (!cleanedQuery) {
    return {
      reply: {
        type: 'text',
        content: 'No problem please. Which product should I use instead?',
      },
      debug: {
        stateBefore: ctx.commerceState.state,
        stateAfter: 'BROWSING',
        handler: 'handleCartReplace',
        reason: 'cart_replaced_missing_product_query',
      },
    };
  }

  const result = await handleProductSearch({
    ...clearedCtx,
    currentCart: [],
    message: cleanedQuery,
    commerceState: createCommerceState('BROWSING'),
  });

  return {
    ...result,
    debug: {
      ...(result.debug || {}),
      handler: 'handleCartReplace',
      reason: `cart_replaced_then_${result.debug?.reason || 'product_search'}`,
    },
  };
}