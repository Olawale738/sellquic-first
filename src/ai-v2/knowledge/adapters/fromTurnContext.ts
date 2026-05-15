import type {
  KnowledgeDeliveryZone,
  KnowledgeProduct,
  KnowledgeTurnContext,
} from '../types';
import type { ProductV2, TurnContext } from '../../types';
import {
  getEffectiveProductPrice,
  getEffectiveVariantPrice,
} from '../../catalog/pricing';
import {
  getProductAvailability,
  isVariantPurchasable,
} from '../../catalog/availability';

function toKnowledgeProduct(
  product: ProductV2,
  ctx: TurnContext
): KnowledgeProduct {
  const availability = getProductAvailability(product);

  return {
    id: product.id,
    name: product.name,
    price: getEffectiveProductPrice(product, ctx.storeData),
    currency: 'GHS',
    stockQty: product.manageStock === true ? Number(product.stock || 0) : null,
    inStock: availability.purchasable,
    variants: Array.isArray(product.variants)
      ? product.variants.map((variant) => ({
          id: variant.id,
          name: variant.name,
          price: getEffectiveVariantPrice(variant, ctx.storeData),
          inStock: isVariantPurchasable(product, variant),
        }))
      : [],
    aliases: [
      ...(Array.isArray(product.searchAliases) ? product.searchAliases : []),
      ...(Array.isArray(product.aliases) ? product.aliases : []),
      ...(Array.isArray(product.keywords) ? product.keywords : []),
    ],
  };
}

function toKnowledgeDeliveryZone(delivery: any): KnowledgeDeliveryZone {
  return {
    id: String(delivery.id),
    name: String(delivery.label || delivery.name || ''),
    fee: Number(delivery.fee || 0),
    currency: 'GHS',
    etaText: delivery.etaText || delivery.timeline || null,
  };
}

export function toKnowledgeTurnContext(ctx: TurnContext): KnowledgeTurnContext {
  const productsById: Record<string, KnowledgeProduct> = {};

  for (const product of ctx.products || []) {
    productsById[product.id] = toKnowledgeProduct(product, ctx);
  }

  return {
    storeId: ctx.storeId,
    commerceState: ctx.commerceState.state,
    orderSession: {
      pendingProductId:
        ctx.commerceState.pendingProductId ||
        (ctx.commerceState.lastShownProductIds?.length === 1
          ? ctx.commerceState.lastShownProductIds[0]
          : null),
      selectedDeliveryZoneId:
        ctx.orderSession.deliveryId || ctx.convData?.selectedDeliveryId || null,
    },
    cart: {
      lines: (ctx.currentCart || []).map((item) => ({
        productId: item.productId,
        productName: item.nameSnapshot || item.productId,
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unitPriceSnapshot || 0),
      })),
    },
    lastMentionedProductId:
      ctx.commerceState.lastMentionedProductId ||
      ctx.commerceState.pendingProductId ||
      (ctx.commerceState.lastShownProductIds?.length === 1
        ? ctx.commerceState.lastShownProductIds[0]
        : null),
    productsById,
    deliveryZones: (ctx.deliveries || []).map(toKnowledgeDeliveryZone),
    customerMessage: ctx.message,
  };
}