
'use client';

import { useState, useEffect } from 'react';
import { useStore } from "@/context/store-context";
import { notFound, useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from '@/components/ui/button';
import { useCart } from '@/hooks/use-cart';
import { ShoppingCart, Zap, Plus, Minus, PlayCircle, Loader2 } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { cn } from '@/lib/utils';
import { StoreBreadcrumbs } from '@/components/store-breadcrumbs';
import { Product, ProductVariant } from '@/types/product';
import StorePage from '../page';
import StoreCategoryPage from '../category/[categoryName]/page';
import AboutPage from '../about/page';
import ReturnPolicyPage from '../return-policy/page';
import { useToast } from '@/hooks/use-toast';
import { getStoreBasePath } from '@/lib/url';
import { ProductCard } from '@/components/store-product-card';
import CheckoutPage from '../checkout/page';
import OrderConfirmation from '../order/confirmation/page';
import ProductCountdown from '@/components/store/ProductCountdown';
import { Badge } from '@/components/ui/badge';

import { trackMetaEvent } from '@/lib/tracking/meta';

// ============== START PRODUCT PAGE LOGIC ==============
function ProductPageComponent({ product }: { product: Product }) {
    const { store, isDemo } = useStore();
    const router = useRouter();
    const { addItem, cart } = useCart();
    const { toast } = useToast();
    
    const marketing = store?.marketing || {};
    const globalDiscount = marketing.isSiteWideSaleActive ? (marketing.siteWideDiscount || 0) : 0;
    
    const calculatePrice = (basePrice: number) => {
        if (globalDiscount > 0) {
            return basePrice * (1 - globalDiscount / 100);
        }
        return basePrice;
    };

    const getInitialQuantity = (variant: ProductVariant | null) => {
        const cartItem = cart.find(i => i.id === product.id && i.selectedVariant?.id === variant?.id);
        const moq = variant?.moq || product.moq || 1;
        return cartItem ? cartItem.quantity : moq;
    }

    const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
        product?.hasVariants && product.variants && product.variants.length > 0 ? product.variants[0] : null
    );

    const moq = selectedVariant?.moq || product.moq || 1;
    
    const [quantity, setQuantity] = useState(getInitialQuantity(selectedVariant));
    
    const allMedia = [
        ...(product.videoUrl ? [product.videoUrl] : []),
        ...(product.images || []),
        ...(product.variants?.map((v: ProductVariant) => v.image).filter((img?: string) => img) || [])
    ];
    const uniqueMedia = Array.from(new Set(allMedia.filter(Boolean)));
    const [selectedMedia, setSelectedMedia] = useState<string>(
        selectedVariant?.image || uniqueMedia[0] || ''
    );
    const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
    
    useEffect(() => {
        const newMoq = selectedVariant?.moq || product.moq || 1;
        setQuantity(q => Math.max(newMoq, q)); // Keep current quantity if it's higher than the new MOQ
    }, [selectedVariant, product.moq]);
    
    if (!product) {
        return notFound();
    }
    
    const hasVariants = product.hasVariants && product.variants && product.variants.length > 0;
    
    const getTotalStock = (p: Product, v: ProductVariant | null): number => {
        if (p.isOutOfStock) return 0;
        if (!p.manageStock) return 999;
        if (hasVariants && p.variants) {
            if (v) return v.stock || 0;
            return p.variants.reduce((total:number, variant:ProductVariant) => total + (variant.stock || 0), 0);
        }
        return p.stock || 0;
    };

    const isOutOfStock = getTotalStock(product, selectedVariant) === 0;

    const baseDisplayPrice = selectedVariant ? selectedVariant.price : product.price;
    const displayPrice = calculatePrice(baseDisplayPrice);
    
    const baseOriginalPrice = selectedVariant ? (selectedVariant.regularPrice || product.regularPrice) : product.regularPrice;
    const originalPrice = baseOriginalPrice || baseDisplayPrice;

    const isDiscounted = displayPrice < originalPrice;
    const discountPercentage = Math.round(((originalPrice - displayPrice) / originalPrice) * 100);
    
    const currentStock = getTotalStock(product, selectedVariant);

    useEffect(() => {
        if (!store?.marketing?.analytics?.facebookPixelId) return;
        trackMetaEvent('ViewContent', {
          content_ids: [product.id],
          content_name: product.name,
          content_type: 'product',
          value: Number(displayPrice),
          currency: 'GHS',
        });
      }, [store?.marketing?.analytics?.facebookPixelId, product.id, product.name, displayPrice, selectedVariant]);

    const handleVariantChange = (variantId: string) => {
        const variant = product.variants?.find((v: ProductVariant) => v.id === variantId);
        if (variant) {
            setSelectedVariant(variant);
            if (variant.image) {
                setSelectedMedia(variant.image);
            }
            const cartItem = cart.find(i => i.id === product.id && i.selectedVariant?.id === variant.id);
            const newMoq = variant.moq || product.moq || 1;
            setQuantity(cartItem ? cartItem.quantity : newMoq);
        }
    };
    
    const handleMediaThumbnailClick = (mediaSrc: string) => {
        setSelectedMedia(mediaSrc);
    }

    const handleAddToCart = () => {
        const itemToAdd = {
            ...product,
            price: displayPrice,
        };
        addItem(itemToAdd, quantity, selectedVariant ? { ...selectedVariant, price: displayPrice } : undefined);
        toast({
            title: "Added to Cart!",
            description: `${quantity} x ${product.name} ${selectedVariant ? `(${selectedVariant.name})` : ''} has been added to your cart.`,
        });
        trackMetaEvent('AddToCart', {
            content_ids: [product.id],
            content_name: product.name,
            content_type: 'product',
            value: Number(displayPrice) * quantity,
            currency: 'GHS',
            num_items: quantity,
        });
    };

    const handleBuyNow = () => {
        if (!store) return;
         const itemToAdd = {
            ...product,
            price: displayPrice,
        };
        addItem(itemToAdd, quantity, selectedVariant ? { ...selectedVariant, price: displayPrice } : undefined);
        trackMetaEvent('InitiateCheckout', {
            content_ids: [product.id],
            content_name: product.name,
            content_type: 'product',
            value: Number(displayPrice) * quantity,
            currency: 'GHS',
            num_items: quantity,
        });
        const basePath = getStoreBasePath(store.subdomain);
        router.push(`${basePath}/checkout`);
    }

    const relatedProducts = store?.products
        .filter((p: Product) => p.category === product.category && p.id !== product.id)
        .slice(0, 4);
    
    const isLongDescription = product.description.length > 200;
    const descriptionToShow = isLongDescription && !isDescriptionExpanded 
        ? `${product.description.substring(0, 200)}...` 
        : product.description;

    const isVideoSelected = selectedMedia && selectedMedia.includes('cloudinary');
    
    return (
        <div className="container mx-auto px-4 md:px-6 py-8">
            <StoreBreadcrumbs product={product} />
            <div className="grid md:grid-cols-2 gap-8 lg:gap-12 mt-6">
            <div>
  <div
   className="group relative aspect-[4/5] w-full overflow-hidden rounded-2xl border bg-white shadow-sm cursor-zoom-in"
    onClick={() => {
      if (!isVideoSelected && selectedMedia) setIsImagePreviewOpen(true);
    }}
  >
    {isVideoSelected ? (
      <video
        key={selectedMedia}
        src={selectedMedia}
        className="h-full w-full object-contain bg-black"
        controls
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
      >
        Your browser does not support the video tag.
      </video>
    ) : (
      selectedMedia && (
        <Image
  src={selectedMedia}
  alt={product.name}
  fill
  className="object-cover object-center transition-transform duration-300 group-hover:scale-[1.02]"
  sizes="(max-width: 768px) 100vw, 50vw"
  priority
/>
      )
    )}

{!isVideoSelected && selectedMedia && (
  <div className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white shadow-sm">
    Tap to view
  </div>
)}

    {isOutOfStock && !isVideoSelected && (
      <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
        <span className="px-4 py-2 bg-black text-white font-semibold rounded-md">
          Out of Stock
        </span>
      </div>
    )}
  </div>

  {isImagePreviewOpen && selectedMedia && (
  <div
    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 p-4"
    onClick={() => setIsImagePreviewOpen(false)}
  >
    <button
      type="button"
      aria-label="Close image preview"
      className="absolute right-4 top-4 z-20 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-white/25"
      onClick={() => setIsImagePreviewOpen(false)}
    >
      Close
    </button>

    <div
      className="relative h-[90vh] w-[95vw]"
      onClick={(e) => e.stopPropagation()}
    >
      <Image
        src={selectedMedia}
        alt={product.name}
        fill
        className="object-contain"
        sizes="95vw"
        priority
      />
    </div>
  </div>
)}
  <div className="grid grid-cols-5 gap-2 mt-4">
                        {uniqueMedia.map((media, idx) => {
                            if (!media) return null;
                            const isVideo = media.includes('cloudinary');
                            return (
                               <div 
                                    key={idx} 
                                    className={cn(
                                        "aspect-square relative rounded-xl overflow-hidden border bg-neutral-50 cursor-pointer transition-all hover:opacity-90",
                                        selectedMedia === media ? "border-black ring-2 ring-black/10" : "border-muted"
                                      )}
                                    onClick={() => handleMediaThumbnailClick(media as string)}>
                                   <Image 
    src={isVideo ? (media as string).replace(/\.[^/.]+$/, ".jpg") : media as string} 
    alt={`${product.name} thumbnail ${idx + 1}`} 
    fill 
    className="object-cover object-center"
/>
                                   {isVideo && (
                                       <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                           <PlayCircle className="h-8 w-8 text-white" />
                                       </div>
                                   )}
                               </div>
                            )
                        })}
                    </div>
                </div>
                <div className="space-y-6">
                    <h1 className="text-2xl font-bold">{product.name}</h1>
                    
                    <div className="mt-4 mb-6">
                        {isDiscounted && marketing.showOriginalPrice !== false ? (
                            <div className="flex items-center gap-3">
                                <span className="text-3xl font-bold text-red-600">
                                    GH₵{displayPrice.toFixed(2)}
                                </span>
                                <span className="text-xl text-muted-foreground line-through">
                                    GH₵{originalPrice.toFixed(2)}
                                </span>
                                {marketing.showDiscountBadges !== false && (
                                    <span className="bg-red-100 text-red-700 px-2 py-1 rounded-md text-sm font-semibold">
                                        -{discountPercentage}% OFF
                                    </span>
                                )}
                            </div>
                        ) : (
                            <span className="text-3xl font-bold text-primary">
                                GH₵{displayPrice.toFixed(2)}
                            </span>
                        )}
                    </div>

                    <div>
                        <div className="text-muted-foreground prose max-w-none" dangerouslySetInnerHTML={{ __html: descriptionToShow.replace(/\n/g, '<br />') }} />
                        {isLongDescription && (
                            <Button variant="link" className="px-0 text-primary" onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}>
                                {isDescriptionExpanded ? 'View Less' : 'View More'}
                            </Button>
                        )}
                    </div>


                    {hasVariants && (
                        <div className="space-y-4">
                           <h3 className="font-semibold text-lg">Select {selectedVariant?.name || product.variants?.[0]?.name || 'Option'}</h3>
                            <RadioGroup 
                                defaultValue={selectedVariant?.id} 
                                onValueChange={handleVariantChange}
                                className="flex flex-wrap gap-2"
                            >
                               {product.variants?.map((variant: ProductVariant) => (
                                    <Label 
                                        key={variant.id} 
                                        htmlFor={variant.id}
                                        className={cn("flex items-center gap-2 border rounded-md p-3 cursor-pointer hover:border-primary transition-colors", selectedVariant?.id === variant.id && "border-primary bg-primary/5", (variant.stock === 0 && product.manageStock) && "opacity-50 cursor-not-allowed")}
                                    >
                                        <RadioGroupItem value={variant.id} id={variant.id} disabled={variant.stock === 0 && product.manageStock}/>
                                        {variant.name}
                                        {(variant.stock === 0 && product.manageStock) && <span className="text-xs text-destructive">(Out of stock)</span>}
                                    </Label>
                               ))}
                            </RadioGroup>
                        </div>
                    )}
                    
                   {!isOutOfStock ? (
                        <div className="space-y-4">
                            {moq > 1 && store?.isMoqEnabled && (
                                <Badge variant="outline" className="text-sm">Minimum order: {moq} units</Badge>
                            )}
                            <ProductCountdown settings={store?.marketingSettings?.productTimer} />
                            <div className="flex items-center gap-4">
                                <p className="font-semibold">QTY:</p>
                                <div className="flex items-center border rounded-md">
                                    <Button variant="ghost" size="icon" onClick={() => setQuantity(q => Math.max(moq, q - 1))} disabled={quantity <= moq}><Minus className="h-4 w-4"/></Button>
                                    <input 
                                        type="number" 
                                        value={quantity} 
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value) || moq;
                                            setQuantity(Math.max(moq, Math.min(currentStock, val)));
                                        }}
                                        onBlur={() => {
                                            if (quantity < moq) {
                                                setQuantity(moq);
                                                toast({
                                                    title: "Minimum Order Adjusted",
                                                    description: `Quantity adjusted to meet minimum order of ${moq} units.`,
                                                });
                                            }
                                        }}
                                        min={moq}
                                        max={currentStock}
                                        className="w-12 text-center border-0 focus:outline-none focus:ring-0"
                                    />
                                    <Button variant="ghost" size="icon" onClick={() => setQuantity(q => Math.min(currentStock, q + 1))} disabled={quantity >= currentStock}><Plus className="h-4 w-4"/></Button>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2 pt-2">
  <Button 
    size="lg"
    className="w-full h-12 bg-black text-white hover:bg-gray-800"
    onClick={handleAddToCart}
    disabled={quantity < moq}
  >
    <ShoppingCart className="mr-2 h-5 w-5" /> Add to Cart
  </Button>

  <div className="text-center text-xs text-muted-foreground font-medium">
    or
  </div>

  <Button 
  size="lg"
  className="w-full h-12 border border-black text-black bg-transparent hover:bg-gray-50"
  onClick={handleBuyNow}
  disabled={quantity < moq}
>
    <Zap className="mr-2 h-5 w-5" /> Buy Now
  </Button>
</div>
                         
 
                            <div className="text-center text-sm text-muted-foreground mt-2">
                                {product.manageStock ? (
                                    <span>{currentStock} available</span>
                                ) : (
                                    <span>In Stock</span>
                                )}
                            </div>
                        </div>
                    ) : null}


                </div>
            </div>
            {relatedProducts && relatedProducts.length > 0 && (
                <div className="mt-16 pt-12 border-t">
                    <h2 className="text-2xl font-bold mb-6">You Might Also Like</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                        {relatedProducts.map((p: Product) => (
                            <ProductCard key={p.id} product={p} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
// ============== END PRODUCT PAGE LOGIC ==============


// This is the main router for the /store/[storeId]/... routes
export default function StoreSlugPage() {
  const params = useParams();
  const { store } = useStore();
  
  const slugParams = params.slug as string[] | undefined;

  if (!store) {
      return (
        <div className="flex h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      );
  }
  
  if (!slugParams || slugParams.length === 0) {
      return <StorePage />;
  }

  const page = slugParams[0];

  if (page === 'products' && slugParams.length > 1) {
      const productIdentifier = slugParams[1];
      const product = store.products.find((p: Product) => p.slug === productIdentifier || p.id === productIdentifier);
      if (product) {
          return <ProductPageComponent product={product} />;
      }
      return notFound();
  }
  
  if (page === 'category' && slugParams.length > 1) {
      return <StoreCategoryPage />;
  }
  
  if (page === 'about') {
      return <AboutPage />;
  }

  if (page === 'return-policy') {
      return <ReturnPolicyPage />;
  }
  
  if (page === 'checkout') {
      return <CheckoutPage />;
  }
  
  if (page === 'order' && slugParams.length > 1 && slugParams[1] === 'confirmation') {
      return <OrderConfirmation />;
  }

  const productBySlug = store.products.find((p: Product) => p.slug === page);
  if (productBySlug) {
      return <ProductPageComponent product={productBySlug} />;
  }
  
  return notFound();
}

