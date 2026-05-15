import type { CartItemV2, ProductV2, TurnContext } from '../types';
import {
  getProductAvailability,
  isVariantPurchasable,
} from '../catalog/availability';

export type CheckoutReadinessResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      missingState:
        | 'AWAITING_QUANTITY'
        | 'AWAITING_VARIANT'
        | 'AWAITING_DELIVERY_AREA'
        | 'AWAITING_ADDRESS'
        | 'AWAITING_PHONE'
        | 'AWAITING_NAME'
        | 'BROWSING';
      reason: string;
      message: string;
    };

function findProduct(products: ProductV2[], productId: string) {
  return products.find((product) => product.id === productId) || null;
}

function validateCartItem(
  item: CartItemV2,
  products: ProductV2[]
): CheckoutReadinessResult {
  const product = findProduct(products, item.productId);

  if (!product) {
    return {
      ok: false,
      missingState: 'BROWSING',
      reason: 'product_not_found',
      message:
        'Please the product in your cart is no longer available. Can you choose the product again?',
    };
  }

  const availability = getProductAvailability(product);

  if (!availability.purchasable) {
    return {
      ok: false,
      missingState: 'BROWSING',
      reason: availability.reason,
      message: `${product.name} is currently not available to order. Would you like to choose another option?`,
    };
  }

  const quantity = Number(item.quantity || 0);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return {
      ok: false,
      missingState: 'AWAITING_QUANTITY',
      reason: 'invalid_quantity',
      message: `How many ${product.name} should I add for you please?`,
    };
  }

  const hasVariants =
    product.hasVariants === true &&
    Array.isArray(product.variants) &&
    product.variants.length > 0;

  if (hasVariants) {
    if (!item.variantId) {
      return {
        ok: false,
        missingState: 'AWAITING_VARIANT',
        reason: 'missing_variant',
        message: `Please which option would you like for ${product.name}?`,
      };
    }

    const variant = product.variants!.find((v) => v.id === item.variantId);

    if (!variant) {
      return {
        ok: false,
        missingState: 'AWAITING_VARIANT',
        reason: 'variant_not_found',
        message: `Please choose the option again for ${product.name}.`,
      };
    }

    if (!isVariantPurchasable(product, variant)) {
      return {
        ok: false,
        missingState: 'AWAITING_VARIANT',
        reason: 'variant_not_purchasable',
        message: `Sorry please, ${product.name} in ${variant.name} is currently out of stock. Would you like another option?`,
      };
    }

    if (product.manageStock === true && quantity > Number(variant.stock || 0)) {
      return {
        ok: false,
        missingState: 'AWAITING_QUANTITY',
        reason: 'quantity_exceeds_variant_stock',
        message: `Sorry please, we only have ${Number(variant.stock || 0)} available for ${product.name} in ${variant.name}. How many should I add?`,
      };
    }
  } else if (product.manageStock === true && quantity > Number(product.stock || 0)) {
    return {
      ok: false,
      missingState: 'AWAITING_QUANTITY',
      reason: 'quantity_exceeds_product_stock',
      message: `Sorry please, we only have ${Number(product.stock || 0)} available for ${product.name}. How many should I add?`,
    };
  }

  return { ok: true };
}

export function validateCheckoutReadiness(
  ctx: TurnContext
): CheckoutReadinessResult {
  const cart = ctx.currentCart || [];

  if (!cart.length) {
    return {
      ok: false,
      missingState: 'BROWSING',
      reason: 'cart_empty',
      message: 'Please which product would you like to order?',
    };
  }

  for (const item of cart) {
    const result = validateCartItem(item, ctx.products);
    if (!result.ok) return result;
  }

  if (ctx.deliveries.length > 0 && !ctx.orderSession.deliveryId) {
    return {
      ok: false,
      missingState: 'AWAITING_DELIVERY_AREA',
      reason: 'missing_delivery_area',
      message: 'Where should we deliver it please?',
    };
  }

  if (
    ctx.deliveries.length > 0 &&
    !ctx.customer.address &&
    !ctx.orderSession.customerAddress
  ) {
    return {
      ok: false,
      missingState: 'AWAITING_ADDRESS',
      reason: 'missing_customer_address',
      message: 'Please send the specific delivery address or nearby landmark.',
    };
  }

  if (!ctx.customer.phone) {
    return {
      ok: false,
      missingState: 'AWAITING_PHONE',
      reason: 'missing_customer_phone',
      message: 'What phone number should we use for the order please?',
    };
  }

  if (!ctx.customer.name) {
    return {
      ok: false,
      missingState: 'AWAITING_NAME',
      reason: 'missing_customer_name',
      message: 'What name should I put on the order please?',
    };
  }

  return { ok: true };
}