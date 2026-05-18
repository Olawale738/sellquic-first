'use client';

import { useStore } from '@/context/store-context';
import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from './ui/button';
import { Plus, Eye } from 'lucide-react';
import { useCart } from '@/hooks/use-cart';
import { cn } from '@/lib/utils';
import { Product } from '@/types/product';
import { useToast } from '@/hooks/use-toast';
import { getStoreBasePath } from '@/lib/url';
import { useRouter } from 'next/navigation';

export const ProductCard = ({ product }: { product: Product }) => {
  const { store, isDemo } = useStore();
  const router = useRouter();
  const { toast } = useToast();
  const { addItem } = useCart();

  if (!product || !store) return null;

  // Marketing / discount logic
  const marketing = store.marketing || {};
  const globalDiscount = marketing.isSiteWideSaleActive ? (marketing.siteWideDiscount || 0) : 0;

  const calculatePrice = (basePrice: number) =>
    globalDiscount > 0 ? basePrice * (1 - globalDiscount / 100) : basePrice;

  const displayPrice = calculatePrice(product.price);
  const originalPrice = product.regularPrice || product.price;
  const isDiscounted = displayPrice < originalPrice;
  const discountPercentage = Math.round(((originalPrice - displayPrice) / originalPrice) * 100);

  const hasVariants = product.hasVariants && product.variants && product.variants.length > 0;

  const getTotalStock = (p: Product): number => {
    if (p.isOutOfStock) return 0;
    if (!p.manageStock) return 999;
    if (hasVariants && p.variants) return p.variants.reduce((total, v) => total + (v.stock || 0), 0);
    return p.stock || 0;
  };

  const isOutOfStock = getTotalStock(product) === 0;

  const productUrl = isDemo
    ? `/demo/${store.slug}/products/${product.id}`
    : `${getStoreBasePath(store.subdomain)}/products/${product.slug || product.id}`;

  let imageSrc = '/placeholder.svg';
  if (product.images?.length) {
    imageSrc = product.images[0];
  } else if (product.variants?.length) {
    const v = product.variants.find((v) => v.image?.length);
    if (v?.image) imageSrc = v.image;
  }

  const priceDisplay = () => {
    if (hasVariants && product.variants) {
      const validPrices = product.variants.map((v) => calculatePrice(v.price)).filter((p) => p > 0);
      if (validPrices.length > 0) {
        const min = Math.min(...validPrices);
        return (
          <span className="font-bold text-primary text-sm">
            <span className="text-xs text-muted-foreground font-normal">From </span>
            GH₵{min.toFixed(2)}
          </span>
        );
      }
    }

    if (isDiscounted && marketing.showOriginalPrice !== false) {
      return (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground line-through">GH₵{originalPrice.toFixed(2)}</span>
          <span className="font-bold text-base text-red-500">GH₵{displayPrice.toFixed(2)}</span>
        </div>
      );
    }

    return <span className="font-bold text-base text-primary">GH₵{displayPrice.toFixed(2)}</span>;
  };

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem({ ...product, price: displayPrice }, 1);
    toast({ title: `${product.name} added to cart!` });
  };

  const handleView = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(productUrl);
  };

  return (
    <div className="group rounded-2xl border border-border/50 bg-card overflow-hidden flex flex-col transition-shadow hover:shadow-lg">
      {/* Image */}
      <Link href={productUrl} className="block relative overflow-hidden aspect-[4/5] bg-secondary/40">
        <Image
          src={imageSrc}
          alt={product.name}
          fill
          unoptimized
          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
          className={cn(
            'object-cover object-top transition-transform duration-500 group-hover:scale-105',
            isOutOfStock && 'grayscale opacity-70'
          )}
        />

        {/* Badges */}
        {isOutOfStock && (
          <Badge variant="secondary" className="absolute top-2.5 left-2.5 text-xs font-semibold">
            Out of Stock
          </Badge>
        )}
        {!isOutOfStock && isDiscounted && marketing.showDiscountBadges !== false && (
          <Badge className="absolute top-2.5 right-2.5 bg-red-500 hover:bg-red-500 text-white text-xs font-bold shadow">
            -{discountPercentage}%
          </Badge>
        )}

        {/* Quick action overlay */}
        {!isOutOfStock && (
          <div className="absolute inset-x-0 bottom-0 p-2 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
            {hasVariants ? (
              <Button
                size="sm"
                className="w-full gap-1.5 text-xs font-semibold shadow-md"
                onClick={handleView}
              >
                <Eye className="h-3.5 w-3.5" />
                View Options
              </Button>
            ) : (
              <Button
                size="sm"
                className="w-full gap-1.5 text-xs font-semibold shadow-md"
                onClick={handleQuickAdd}
              >
                <Plus className="h-3.5 w-3.5" />
                Add to Cart
              </Button>
            )}
          </div>
        )}
      </Link>

      {/* Info */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <Link href={productUrl}>
          <h3
            className="text-sm font-semibold text-foreground leading-snug line-clamp-2 hover:text-primary transition-colors"
            title={product.name}
          >
            {product.name}
          </h3>
        </Link>
        <div className="mt-auto">{priceDisplay()}</div>
      </div>

      {/* Mobile CTA (no hover on touch) */}
      {!isOutOfStock && (
        <div className="px-3 pb-3 sm:hidden">
          {hasVariants ? (
            <Button size="sm" variant="outline" className="w-full text-xs" onClick={handleView}>
              View Options
            </Button>
          ) : (
            <Button size="sm" className="w-full text-xs gap-1" onClick={handleQuickAdd}>
              <Plus className="h-3.5 w-3.5" /> Add to Cart
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
