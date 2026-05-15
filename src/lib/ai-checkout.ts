
export type AiCheckoutItem = { 
  productId: string; 
  quantity: number; 
  variantId?: string;
};

export function parseAiItemsParam(itemsParam: string | null): AiCheckoutItem[] {
  if (!itemsParam) return [];

  const parts = itemsParam
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const items: AiCheckoutItem[] = [];

  for (const part of parts) {
    const [productIdRaw, qtyRaw, variantIdRaw] = part.split(':');

    const productId = (productIdRaw || '').trim();
    const qty = Math.floor(Number(qtyRaw));
    const variantId = (variantIdRaw || '').trim();

    if (!productId) continue;
    if (!Number.isFinite(qty) || qty <= 0) continue;

    items.push({
      productId,
      quantity: qty,
      variantId: variantId || undefined
    });
  }

  return items;
}

export function parseDeliveryParam(deliveryId: string | null): string | null {
  if (!deliveryId) return null;
  return deliveryId.trim() || null;
}
