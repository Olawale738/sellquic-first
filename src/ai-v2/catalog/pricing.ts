export function getEffectiveProductPrice(product: any, storeData: any): number {
  const marketing = storeData?.marketing || {};
  const globalDiscount =
    marketing.isSiteWideSaleActive ? Number(marketing.siteWideDiscount || 0) : 0;

  const basePrice = Number(product?.price || 0);

  if (!Number.isFinite(basePrice)) return 0;

  return globalDiscount > 0
    ? Math.round(basePrice * (1 - globalDiscount / 100) * 100) / 100
    : basePrice;
}

export function getEffectiveVariantPrice(variant: any, storeData: any): number {
  const marketing = storeData?.marketing || {};
  const globalDiscount =
    marketing.isSiteWideSaleActive ? Number(marketing.siteWideDiscount || 0) : 0;

  const basePrice = Number(variant?.price || 0);

  if (!Number.isFinite(basePrice)) return 0;

  return globalDiscount > 0
    ? Math.round(basePrice * (1 - globalDiscount / 100) * 100) / 100
    : basePrice;
}