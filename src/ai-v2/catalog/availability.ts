import type { ProductV2, ProductVariantV2 } from '../types';

export type AvailabilityResult = {
  visible: boolean;
  purchasable: boolean;
  reason:
    | 'available'
    | 'archived_or_draft'
    | 'out_of_stock'
    | 'product_stock_empty'
    | 'variant_stock_empty'
    | 'all_variants_out_of_stock';
  availableStock: number | null;
};

export function isPublishedOrActive(product: ProductV2): boolean {
  const status = String(product.status || '').toLowerCase().trim();

  if (!status) return true;
  if (status === 'published') return true;
  if (status === 'active') return true;

  return false;
}

export function getProductAvailability(product: ProductV2): AvailabilityResult {
  if (!product || product.isArchived === true || !isPublishedOrActive(product)) {
    return {
      visible: false,
      purchasable: false,
      reason: 'archived_or_draft',
      availableStock: 0,
    };
  }

  if (product.isOutOfStock === true) {
    return {
      visible: true,
      purchasable: false,
      reason: 'out_of_stock',
      availableStock: 0,
    };
  }

  if (product.manageStock !== true) {
    return {
      visible: true,
      purchasable: true,
      reason: 'available',
      availableStock: null,
    };
  }

  const hasVariants =
    product.hasVariants === true &&
    Array.isArray(product.variants) &&
    product.variants.length > 0;

  if (hasVariants) {
    const totalStock = product.variants!.reduce((sum, variant) => {
      return sum + Math.max(0, Number(variant.stock || 0));
    }, 0);

    return {
      visible: true,
      purchasable: totalStock > 0,
      reason: totalStock > 0 ? 'available' : 'all_variants_out_of_stock',
      availableStock: totalStock,
    };
  }

  const stock = Math.max(0, Number(product.stock || 0));

  return {
    visible: true,
    purchasable: stock > 0,
    reason: stock > 0 ? 'available' : 'product_stock_empty',
    availableStock: stock,
  };
}

export function isProductVisibleToCustomer(product: ProductV2): AvailabilityResult {
  return getProductAvailability(product);
}

export function isVariantPurchasable(
  product: ProductV2,
  variant: ProductVariantV2
): boolean {
  if (!product || !variant) return false;

  const productAvailability = getProductAvailability(product);

  if (!productAvailability.visible) return false;
  if (product.isOutOfStock === true) return false;

  if (product.manageStock !== true) return true;

  const stock = Number(variant.stock || 0);
  return stock > 0;
}