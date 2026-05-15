import type {
  CartItemV2,
  CommerceState,
  DeliveryZoneV2,
  OrderSessionV2,
  ProductV2,
  TurnContext,
} from '../types';
import { getProductAvailability, isVariantPurchasable } from '../catalog/availability';

export type NextStepResult = {
  state: CommerceState;
  reason: string;
};

function findProduct(products: ProductV2[], productId: string) {
  return products.find((product) => product.id === productId) || null;
}

function cartHasValidItems(cart: CartItemV2[], products: ProductV2[]): boolean {
  if (!Array.isArray(cart) || cart.length === 0) return false;

  return cart.every((item) => {
    const product = findProduct(products, item.productId);
    if (!product) return false;

    const availability = getProductAvailability(product);
    if (!availability.purchasable) return false;

    const quantity = Number(item.quantity || 0);
    if (!Number.isFinite(quantity) || quantity <= 0) return false;

    const hasVariants =
      product.hasVariants === true &&
      Array.isArray(product.variants) &&
      product.variants.length > 0;

    if (hasVariants) {
      if (!item.variantId) return false;

      const variant = product.variants!.find((v) => v.id === item.variantId);
      if (!variant) return false;

      return isVariantPurchasable(product, variant);
    }

    return true;
  });
}

function hasAnyProductNeedingVariant(cart: CartItemV2[], products: ProductV2[]): boolean {
  return cart.some((item) => {
    const product = findProduct(products, item.productId);
    if (!product) return false;

    const hasVariants =
      product.hasVariants === true &&
      Array.isArray(product.variants) &&
      product.variants.length > 0;

    return hasVariants && !item.variantId;
  });
}

function hasAnyMissingQuantity(cart: CartItemV2[]): boolean {
  return cart.some((item) => {
    const quantity = Number(item.quantity || 0);
    return !Number.isFinite(quantity) || quantity <= 0;
  });
}

function hasDeliveryZones(deliveries: DeliveryZoneV2[]): boolean {
  return Array.isArray(deliveries) && deliveries.length > 0;
}

export function getNextRequiredStep(ctx: TurnContext): NextStepResult {
  const cart = ctx.currentCart || [];
  const orderSession = ctx.orderSession || ({} as OrderSessionV2);

  if (ctx.commerceState.state === 'HANDOVER') {
    return {
      state: 'HANDOVER',
      reason: 'handover_active',
    };
  }

  if (!cart.length) {
    // Cart empty BUT we have a focus product → mid-flow on a
    // commitment that hasn't yet reached quantity. Do NOT collapse
    // to IDLE — that's how the system was silently dropping
    // customer commitments and reaching name/phone/address with
    // an empty cart.
    const pendingProductId =
      ctx.commerceState.pendingProductId ||
      ctx.commerceState.lastMentionedProductId;

    if (pendingProductId) {
      const pending = ctx.products.find((p) => p.id === pendingProductId);
      if (pending) {
        const hasVariants =
          pending.hasVariants === true &&
          Array.isArray(pending.variants) &&
          pending.variants.length > 0;

        if (hasVariants && !ctx.commerceState.pendingVariantId) {
          return {
            state: 'AWAITING_VARIANT',
            reason: 'cart_empty_pending_variant',
          };
        }
        return {
          state: 'AWAITING_QUANTITY',
          reason: 'cart_empty_pending_quantity',
        };
      }
    }

    return {
      state: 'IDLE',
      reason: 'cart_empty_no_pending',
    };
  }

  if (hasAnyProductNeedingVariant(cart, ctx.products)) {
    return {
      state: 'AWAITING_VARIANT',
      reason: 'cart_has_product_missing_variant',
    };
  }

  if (hasAnyMissingQuantity(cart)) {
    return {
      state: 'AWAITING_QUANTITY',
      reason: 'cart_has_missing_quantity',
    };
  }

  if (!cartHasValidItems(cart, ctx.products)) {
    return {
      state: 'BROWSING',
      reason: 'cart_items_not_valid_or_not_purchasable',
    };
  }

  if (hasDeliveryZones(ctx.deliveries) && !orderSession.deliveryId) {
    return {
      state: 'AWAITING_DELIVERY_AREA',
      reason: 'delivery_zone_required',
    };
  }

  if (hasDeliveryZones(ctx.deliveries) && !ctx.customer.address && !orderSession.customerAddress) {
    return {
      state: 'AWAITING_ADDRESS',
      reason: 'customer_address_required',
    };
  }

  if (!ctx.customer.phone) {
    return {
      state: 'AWAITING_PHONE',
      reason: 'customer_phone_required',
    };
  }

  if (!ctx.customer.name) {
    return {
      state: 'AWAITING_NAME',
      reason: 'customer_name_required',
    };
  }

  if (orderSession.checkoutUrl) {
    return {
      state: 'CHECKOUT_CREATED',
      reason: 'checkout_already_created',
    };
  }

  return {
    state: 'READY_FOR_CHECKOUT',
    reason: 'all_checkout_requirements_met',
  };
}