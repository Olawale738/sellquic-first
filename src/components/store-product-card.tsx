
'use client';

import { useStore } from '@/context/store-context';
import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from './ui/button';
import { Plus } from 'lucide-react';
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

    // --- MARKETING LOGIC ---
    const marketing = store.marketing || {};
    const globalDiscount = marketing.isSiteWideSaleActive ? (marketing.siteWideDiscount || 0) : 0;
    
    const calculatePrice = (basePrice: number) => {
        if (globalDiscount > 0) {
            return basePrice * (1 - globalDiscount / 100);
        }
        return basePrice;
    };
    
    const displayPrice = calculatePrice(product.price);
    const originalPrice = product.regularPrice || product.price;
    const isDiscounted = displayPrice < originalPrice;
    
    const discountPercentage = Math.round(((originalPrice - displayPrice) / originalPrice) * 100);

    // --- END MARKETING LOGIC ---

    const hasVariants = product.hasVariants && product.variants && product.variants.length > 0;

    const getTotalStock = (p: Product): number => {
      if (p.isOutOfStock) return 0;
      if (!p.manageStock) return 999;
      if (hasVariants && p.variants) {
          return p.variants.reduce((total, v) => total + (v.stock || 0), 0);
      }
      return p.stock || 0;
    };
  
    const isOutOfStock = getTotalStock(product) === 0;

    const getDisplayPrice = () => {
        if (hasVariants && product.variants) {
            const validPrices = product.variants.map(v => calculatePrice(v.price)).filter(p => p > 0);
            if (validPrices.length > 0) {
            const minPrice = Math.min(...validPrices);
            return (
                <span className="font-bold text-primary">
                    <span className="text-xs text-muted-foreground font-normal">From </span>
                    GH₵{minPrice.toFixed(2)}
                </span>
            );
            }
        }

        // Standard Product Display
        if (isDiscounted && marketing.showOriginalPrice !== false) {
             return (
                <div className="flex flex-col items-start leading-none gap-1">
                    <span className="text-sm text-muted-foreground line-through">
                        GH₵{originalPrice.toFixed(2)}
                    </span>
                    <span className="font-bold text-lg text-red-600">
                        GH₵{displayPrice.toFixed(2)}
                    </span>
                </div>
            );
        }

        return <span className="font-bold text-lg text-primary">GH₵{displayPrice.toFixed(2)}</span>;
    };
  
    const handleQuickAdd = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Add the DISCOUNTED price to cart
      const itemToAdd = { ...product, price: displayPrice };
      addItem(itemToAdd, 1);
      toast({ title: `${product.name} added to cart!` });
    };

    const handleViewProduct = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        router.push(productUrl);
    }
    
    const productUrl = isDemo ? `/demo/${store.slug}/products/${product.id}` : `${getStoreBasePath(store.subdomain)}/products/${product.slug || product.id}`;
    
    // Smart Image Fallback
    let imageSrc = '/placeholder.svg';
    if (product.images && product.images.length > 0) {
        imageSrc = product.images[0];
    } else if (product.variants && product.variants.length > 0) {
        const variantWithImage = product.variants.find(v => v.image && v.image.length > 0);
        if (variantWithImage && variantWithImage.image) imageSrc = variantWithImage.image;
    }
  
    return (
      <div className="border border-gray-200/60 rounded-lg p-2 transition-shadow hover:shadow-md bg-white h-full flex flex-col">
        <Link href={productUrl} className="block group flex-grow">
        <div className="relative overflow-hidden rounded-lg aspect-[4/5] bg-gray-50">
                <Image
                    src={imageSrc}
                    alt={product.name}
                    fill
                    unoptimized={true}
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className={cn(
                        "object-cover object-top group-hover:scale-105 transition-transform duration-300",
                        isOutOfStock && "grayscale"
                    )}
                />
                {isOutOfStock && (
                    <Badge variant="destructive" className="absolute top-2 left-2 z-10">
                    Out of Stock
                    </Badge>
                )}
                 {/* SALE BADGE */}
                {!isOutOfStock && isDiscounted && marketing.showDiscountBadges !== false && (
                     <Badge className="absolute top-2 right-2 z-10 bg-red-600 hover:bg-red-600 shadow-sm">
                        -{discountPercentage}%
                    </Badge>
                )}
            </div>
            
            <div className="mt-3 px-1 flex-grow flex flex-col justify-between">
                <h3 className="font-semibold text-base leading-tight truncate text-gray-900" title={product.name}>
                    {product.name}
                </h3>
                <div className="flex justify-between items-end mt-2">
                    <div className="flex items-baseline">
                        {getDisplayPrice()}
                    </div>
                </div>
            </div>
        </Link>
        <div className="px-1 pt-2">
             {!isOutOfStock && (
                <>
                {hasVariants ? (
                    <Button size="sm" className="w-full font-bold bg-black text-white hover:bg-gray-800" onClick={handleViewProduct}>
                        View Options
                    </Button>
                ) : (
                    <Button size="sm" className="w-full font-bold bg-black text-white hover:bg-gray-800" onClick={handleQuickAdd}>
                        <Plus className="h-4 w-4 mr-1" /> Add to Cart
                    </Button>
                )}
                </>
            )}
        </div>
      </div>
    );
};
