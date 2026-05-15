
'use client';

import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { parseAiItemsParam } from '@/lib/ai-checkout';
import { useCart } from '@/hooks/use-cart';
import { useStore } from '@/context/store-context';
import { useToast } from '@/hooks/use-toast';
import type { Product, ProductVariant } from '@/types/product';

type ResolvedProduct = Product & {
  isArchived?: boolean;
  storeId?: string;
};

type ResolveCartResponse =
  | { success: true; products: ResolvedProduct[] }
  | { success: false; message: string };

export function ApplyAiCheckoutToCart() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasRun = useRef(false);

  const { store } = useStore();
  const { clearCart, addItem } = useCart();
  const { toast } = useToast();

  useEffect(() => {
    if (hasRun.current) return;

    const source = searchParams.get('source');
    const itemsParam = searchParams.get('items');

    if (source !== 'ai' || !itemsParam) return;
    if (!store?.id) return;

    hasRun.current = true;

    (async () => {
      try {
        const items = parseAiItemsParam(itemsParam);
        if (items.length === 0) {
          toast({ title: 'Invalid AI order', description: 'No valid items found.', variant: 'destructive' });
          return;
        }
        
        const res = await fetch('/api/cart/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ storeId: store.id, items }),
        });

        const data = (await res.json()) as ResolveCartResponse;

        if (!res.ok || !data.success) {
          const msg = !data.success ? data.message : 'Could not resolve products';
          throw new Error(msg);
        }

        const productMap = new Map<string, ResolvedProduct>(data.products.map((p) => [p.id, p]));

        const resolvedItems = items.map(itemFromUrl => {
            const product = productMap.get(itemFromUrl.productId);
            if (!product) return null;

            const selectedVariant = itemFromUrl.variantId 
                ? product.variants?.find((v: ProductVariant) => v.id === itemFromUrl.variantId)
                : undefined;
            
            return {
                product,
                quantity: itemFromUrl.quantity,
                selectedVariant
            };
        }).filter((item): item is { product: ResolvedProduct; quantity: number; selectedVariant: ProductVariant | undefined } => item !== null);


        if (resolvedItems.length === 0) {
          toast({
            title: 'Could not add items',
            description: 'Items are unavailable. Please pick products from the store.',
            variant: 'destructive',
          });
          return;
        }

        clearCart();
        
        resolvedItems.forEach(({ product, quantity, selectedVariant }) => {
            addItem(product, quantity, selectedVariant);
        });

        toast({ title: 'Added to cart', description: 'Items from AI chat were added to your cart.' });

        // Clean URL — keep deliveryId so CheckoutPage can read it
        const url = new URL(window.location.href);
url.searchParams.delete('items');

const qs = url.searchParams.toString();
router.replace(url.pathname + (qs ? `?${qs}` : ''));
      } catch (err: any) {
        toast({
          title: 'Could not add items',
          description: err?.message || 'Try again.',
          variant: 'destructive',
        });
      }
    })();
  }, [searchParams, router, store?.id, clearCart, addItem, toast]);

  return null;
}
    