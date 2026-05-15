import type { CartItemV2, ProductV2, ProductVariantV2, TurnContext } from '../types';
import { getEffectiveProductPrice, getEffectiveVariantPrice } from '../catalog/pricing';

export type CartLineV2 = {
  product: ProductV2;
  variant: ProductVariantV2 | null;
  item: CartItemV2;
  label: string;
  unitPrice: number;
  lineTotal: number;
};

function findProduct(products: ProductV2[], productId: string): ProductV2 | null {
  return products.find((product) => product.id === productId) || null;
}

function findVariant(product: ProductV2, variantId?: string | null): ProductVariantV2 | null {
  if (!variantId) return null;
  return product.variants?.find((variant) => variant.id === variantId) || null;
}

export function getCartLines(ctx: TurnContext): CartLineV2[] {
  return (ctx.currentCart || [])
    .map((item) => {
      const product = findProduct(ctx.products, item.productId);
      if (!product) return null;

      const variant = findVariant(product, item.variantId);

      const unitPrice = variant
        ? getEffectiveVariantPrice(variant, ctx.storeData)
        : getEffectiveProductPrice(product, ctx.storeData);

      const label = variant ? `${product.name} (${variant.name})` : product.name;

      return {
        product,
        variant,
        item,
        label,
        unitPrice,
        lineTotal: unitPrice * Number(item.quantity || 0),
      };
    })
    .filter((line): line is CartLineV2 => line !== null);
}

export function formatCartSummary(ctx: TurnContext): string {
  const lines = getCartLines(ctx);

  if (!lines.length) {
    return 'Your cart is currently empty please.';
  }

  const itemLines = lines
    .map((line, index) => {
      return `${index + 1}. ${line.label} x${line.item.quantity} — GHS ${line.lineTotal.toFixed(2)}`;
    })
    .join('\n');

  const itemsTotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const deliveryFee = Number(ctx.orderSession.deliveryFee || 0);
  const total = itemsTotal + deliveryFee;

  const deliveryLine = ctx.orderSession.deliveryLabel
    ? `\nDelivery (${ctx.orderSession.deliveryLabel}): GHS ${deliveryFee.toFixed(2)}`
    : '';

  return `${itemLines}${deliveryLine}\nTotal: GHS ${total.toFixed(2)}`;
}