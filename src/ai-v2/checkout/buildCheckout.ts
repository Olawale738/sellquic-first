import type {
    AiV2Reply,
    CartItemV2,
    ProductV2,
    ProductVariantV2,
    TurnContext,
  } from '../types';
  import {
    getEffectiveProductPrice,
    getEffectiveVariantPrice,
  } from '../catalog/pricing';
  
  type CheckoutLineItem = {
    productId: string;
    variantId: string | null;
    name: string;
    quantity: number;
    price: number;
    lineTotal: number;
    imageUrl: string | null;
  };
  
  export type BuiltCheckout = {
    reply: Extract<AiV2Reply, { type: 'action' }>;
    lastActionData: any;
    checkoutUrl: string;
    total: number;
    items: CheckoutLineItem[];
  };
  
  function findProduct(products: ProductV2[], productId: string): ProductV2 | null {
    return products.find((product) => product.id === productId) || null;
  }
  
  function findVariant(
    product: ProductV2,
    variantId?: string | null
  ): ProductVariantV2 | null {
    if (!variantId) return null;
    return product.variants?.find((variant) => variant.id === variantId) || null;
  }
  
  function buildLineItem(
    item: CartItemV2,
    products: ProductV2[],
    storeData: any
  ): CheckoutLineItem {
    const product = findProduct(products, item.productId);
  
    if (!product) {
      throw new Error(`Product not found: ${item.productId}`);
    }
  
    const variant = findVariant(product, item.variantId);
  
    const price = variant
      ? getEffectiveVariantPrice(variant, storeData)
      : getEffectiveProductPrice(product, storeData);
  
    const quantity = Number(item.quantity || 0);
    const label = variant ? `${product.name} (${variant.name})` : product.name;
  
    return {
      productId: product.id,
      variantId: variant?.id || null,
      name: label,
      quantity,
      price,
      lineTotal: price * quantity,
      imageUrl: variant?.image || product.images?.[0] || null,
    };
  }
  
  function buildItemsParam(items: CheckoutLineItem[]): string {
    return items
      .map((item) => {
        return item.variantId
          ? `${item.productId}:${item.variantId}:${item.quantity}`
          : `${item.productId}:${item.quantity}`;
      })
      .join(',');
  }
  
  function buildCheckoutUrl(ctx: TurnContext, items: CheckoutLineItem[]): string {
    const params = new URLSearchParams();
  
    params.set('source', 'ai');
    params.set('channel', ctx.channel);
    params.set('items', buildItemsParam(items));
  
    if (ctx.orderSession.deliveryId) {
      params.set('deliveryId', ctx.orderSession.deliveryId);
    }
  
    if (ctx.customer.name) {
      params.set('name', ctx.customer.name);
    }
  
    if (ctx.customer.phone) {
      params.set('phone', ctx.customer.phone);
    }
  
    const address = ctx.customer.address || ctx.orderSession.customerAddress;
  
    if (address) {
      params.set('address', address);
    }
  
    return `/checkout?${params.toString()}`;
  }
  
  export function buildCheckout(ctx: TurnContext): BuiltCheckout {
    const items = ctx.currentCart.map((item) =>
      buildLineItem(item, ctx.products, ctx.storeData)
    );
  
    const itemsTotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const deliveryFee = Number(ctx.orderSession.deliveryFee || 0);
    const total = itemsTotal + deliveryFee;
  
    const checkoutUrl = buildCheckoutUrl(ctx, items);
  
    const itemSummary = items
      .map(
        (item) =>
          `${item.name} x${item.quantity} — GHS ${item.lineTotal.toFixed(2)}`
      )
      .join('\n');
  
    const deliveryLine = ctx.orderSession.deliveryLabel
      ? `\nDelivery (${ctx.orderSession.deliveryLabel}): GHS ${deliveryFee.toFixed(2)}`
      : '';
  
    const content = `Perfect please! Here's your checkout link.\n\n${itemSummary}${deliveryLine}\nTotal: GHS ${total.toFixed(2)}`;
  
    const reply: Extract<AiV2Reply, { type: 'action' }> = {
      type: 'action',
      action: 'checkout',
      label: 'Complete Order',
      url: checkoutUrl,
      content,
      total,
      items,
    };
  
    return {
      reply,
      checkoutUrl,
      total,
      items,
      lastActionData: {
        ...reply,
        currency: 'GHS',
        quickReplies: ['Add more items', 'Change delivery', "That's all 👍"],
      },
    };
  }