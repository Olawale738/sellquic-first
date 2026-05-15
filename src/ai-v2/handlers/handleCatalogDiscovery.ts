import type { AiTurnResult, TurnContext } from '../types';
import { getProductAvailability } from '../catalog/availability';
import { handleProductSearch } from './handleProductSearch';

const MAX_DISCOVERY_PRODUCTS = 6;

/**
 * Surfaces a small set of top/available products when the customer asks
 * "what do you sell" / "show me your menu" / "what products do you have".
 *
 * Strategy: filter to visible+purchasable products from ctx.products,
 * then synthesize a message that handleProductSearch will recognize.
 *
 * If the catalog already has a "featured"/"bestseller" tag, you can
 * sort by that here. For now: first MAX_DISCOVERY_PRODUCTS visible items.
 */
export async function handleCatalogDiscovery(
  ctx: TurnContext
): Promise<AiTurnResult> {
  const visible = (ctx.products || []).filter(
    (p) => getProductAvailability(p).visible
  );

  if (visible.length === 0) {
    return {
      reply: {
        type: 'text',
        content:
          "I don't have any products visible right now please. I can ask the seller to follow up.",
      },
      debug: {
        stateBefore: ctx.commerceState.state,
        stateAfter: ctx.commerceState.state,
        handler: 'handleCatalogDiscovery',
        reason: 'no_visible_products',
      },
    };
  }

  // Delegate to existing search/cards UX. handleProductSearch already
  // owns "shape product cards from a candidate set"; we just hand it
  // the discovery slice as the message.
  const sample = visible
    .slice(0, MAX_DISCOVERY_PRODUCTS)
    .map((p) => p.name)
    .join(' ');

  return handleProductSearch({
    ...ctx,
    message: sample,
  });
}