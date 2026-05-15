import type { ProductV2, ProductVariantV2, ResolvedBy } from '../types';
import { normalizeText } from './normalize';
import { isVariantPurchasable } from './availability';

export type VariantResolveResult = {
  status: 'single_match' | 'multiple_matches' | 'no_match';
  confidence: number;
  resolvedBy?: ResolvedBy;
  variant?: ProductVariantV2;
  variants: ProductVariantV2[];
  reason: string;
  purchasable?: boolean;
};

export function resolveVariant(
  message: string,
  product: ProductV2
): VariantResolveResult {
  const variants = Array.isArray(product.variants) ? product.variants : [];

  if (!variants.length) {
    return {
      status: 'no_match',
      confidence: 0,
      variants: [],
      reason: 'product_has_no_variants',
    };
  }

  const query = normalizeText(message);

  if (!query) {
    return {
      status: 'no_match',
      confidence: 0,
      variants,
      reason: 'empty_query',
    };
  }

  const exactMatches = variants.filter((variant) => {
    return normalizeText(variant.name) === query;
  });

  if (exactMatches.length === 1) {
    const variant = exactMatches[0];

    return {
      status: 'single_match',
      confidence: 1,
      resolvedBy: 'exact',
      variant,
      variants: [variant],
      purchasable: isVariantPurchasable(product, variant),
      reason: 'exact_variant_name_match',
    };
  }

  const containsMatches = variants.filter((variant) => {
    const name = normalizeText(variant.name);
    return name.includes(query) || query.includes(name);
  });

  if (containsMatches.length === 1) {
    const variant = containsMatches[0];

    return {
      status: 'single_match',
      confidence: 0.9,
      resolvedBy: 'token',
      variant,
      variants: [variant],
      purchasable: isVariantPurchasable(product, variant),
      reason: 'variant_contains_match',
    };
  }

  if (containsMatches.length > 1) {
    return {
      status: 'multiple_matches',
      confidence: 0.7,
      resolvedBy: 'token',
      variants: containsMatches,
      reason: 'multiple_variant_contains_matches',
    };
  }

  return {
    status: 'no_match',
    confidence: 0,
    variants,
    reason: 'no_variant_match',
  };
}