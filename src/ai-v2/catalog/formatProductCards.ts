import type { ProductCardV2, ProductV2 } from '../types';
import type { VerifiedProduct } from '../nlu/turnFactPacket';

type ProductLike = ProductV2 | VerifiedProduct;
type FormatOptions = { selectedVariantId?: string | null };

/**
 * Formats products into display-ready cards.
 *
 * Backward-compatible signature: legacy callers pass `(products, storeData)`,
 * new callers pass `(products, { selectedVariantId })` for variant-aware
 * display. The function detects which signature it received via shape
 * inspection and falls back gracefully.
 *
 * Variant-aware in-stock computation: if a selectedVariantId is supplied
 * and matches one of the product's variants, that variant's stock state
 * is authoritative. Otherwise we OR over the variants array, falling back
 * to the product-level stock if the product has no variants.
 *
 * `availabilityReason` is overridden to 'available' whenever the
 * computed in-stock is true — this prevents stale parent-level
 * 'out_of_stock_partial' reasons from showing as "Out of stock" badges
 * on cards whose variants are clearly purchasable.
 */
export function formatProductCards(
  products: ProductLike[],
  optionsOrStoreData?: FormatOptions | any,
): ProductCardV2[] {
  // Detect signature. Options object has `selectedVariantId`. Anything
  // else (storeData object, undefined, null) → treated as no options.
  const options: FormatOptions =
    optionsOrStoreData &&
    typeof optionsOrStoreData === 'object' &&
    !Array.isArray(optionsOrStoreData) &&
    'selectedVariantId' in optionsOrStoreData
      ? (optionsOrStoreData as FormatOptions)
      : {};

  return products.map((p) => {
    const variants = (p as any).variants;
    const selectedVariant =
      options.selectedVariantId && Array.isArray(variants)
        ? variants.find((v: any) => v.id === options.selectedVariantId)
        : null;

    // Image priority: variant image > product imageUrl > product image > images[0]
    const image =
      selectedVariant?.imageUrl ||
      selectedVariant?.image ||
      (p as any).imageUrl ||
      (p as any).image ||
      ((p as any).images && (p as any).images[0]) ||
      null;

    const computeVariantInStock = (v: any): boolean => {
      if (typeof v.inStock === 'boolean') return v.inStock;
      if (v.purchasable === true) return true;
      if (v.purchasable === false) return false;
      const stock = Number(v.stock || 0);
      return stock > 0;
    };

    let computedInStock: boolean;
    if (selectedVariant) {
      computedInStock = computeVariantInStock(selectedVariant);
    } else if (Array.isArray(variants) && variants.length > 0) {
      computedInStock = variants.some(computeVariantInStock);
    } else if (typeof (p as any).inStock === 'boolean') {
      computedInStock = (p as any).inStock;
    } else if ((p as any).manageStock === true) {
      computedInStock = Number((p as any).stock || 0) > 0;
    } else {
      computedInStock = !(p as any).isOutOfStock;
    }

    const priorReason = (p as any).availabilityReason as string | undefined;

    return {
      productId: p.id,
      name: p.name,
      price: selectedVariant?.price ?? (p as any).price ?? 0,
      regularPrice: (p as any).regularPrice ?? null,
      imageUrl: image,
      description: (p as any).description || '',
      stock: (p as any).stock ?? null,
      manageStock: (p as any).manageStock ?? false,
      hasVariants: (p as any).hasVariants ?? false,
      purchasable: computedInStock,
      availabilityReason: computedInStock
        ? 'available'
        : priorReason || 'out_of_stock',
    } as ProductCardV2;
  });
}