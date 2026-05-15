'use client';

import { useState } from 'react';
import { useStore } from "@/context/store-context";
import { notFound, useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from '@/components/ui/button';
import { useCart } from '@/hooks/use-cart';
import { ShoppingCart, Zap, Plus, Minus, PlayCircle } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { cn } from '@/lib/utils';
import { StoreBreadcrumbs } from '@/components/store-breadcrumbs';
import { Product, ProductVariant } from '@/types/product';
import { useToast } from '@/hooks/use-toast';
import { ProductCard } from '@/components/store-product-card';
import ProductCountdown from '@/components/store/ProductCountdown';

// This is the product page component adapted for the demo.
export default function DemoProductPage() {
    const { store } = useStore();
    const router = useRouter();
    const params = useParams();
    const { addItem, cart } = useCart();
    const { toast } = useToast();

    const productId = params.productId as string;

    // In a demo, product data comes from the demo store object in context
    const product = store?.products.find((p: Product) => p.id === productId || p.slug === productId);

    const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
        product?.hasVariants && product.variants && product.variants.length > 0 ? product.variants[0] : null
    );
    const [quantity, setQuantity] = useState(1);
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
    
    const allMedia = [
        ...(product?.videoUrl ? [product.videoUrl] : []),
        ...(product?.images || []),
        ...(product?.variants?.map((v: ProductVariant) => v.image).filter((img?: string) => img) || [])
    ];
    const uniqueMedia = Array.from(new Set(allMedia.filter(Boolean)));

    const [selectedMedia, setSelectedMedia] = useState<string>(
        selectedVariant?.image || uniqueMedia[0] || ''
    );

    if (!product) {
        return notFound();
    }
    
    const marketing = store?.marketing || {};
    const globalDiscount = marketing.isSiteWideSaleActive ? (marketing.siteWideDiscount || 0) : 0;
    
    const calculatePrice = (basePrice: number) => {
        if (globalDiscount > 0) {
            return basePrice * (1 - globalDiscount / 100);
        }
        return basePrice;
    };

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

    const handleVariantChange = (variantId: string) => {
        const variant = product.variants?.find((v: ProductVariant) => v.id === variantId);
        if (variant) {
            setSelectedVariant(variant);
            if (variant.image) {
                setSelectedMedia(variant.image);
            }
            const cartItem = cart.find(i => i.id === product.id && i.selectedVariant?.id === variant.id);
            setQuantity(cartItem ? cartItem.quantity : 1);
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
            title: "Added to Demo Cart!",
            description: `${quantity} x ${product.name} ${selectedVariant ? `(${selectedVariant.name})` : ''} has been added.`,
        });
    };

    const handleBuyNow = () => {
        if (!store) return;
         const itemToAdd = {
            ...product,
            price: displayPrice,
        };
        addItem(itemToAdd, quantity, selectedVariant ? { ...selectedVariant, price: displayPrice } : undefined);
        const basePath = `/demo/${store.slug}`; // Demo specific path
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
                    <div className="aspect-square relative rounded-lg overflow-hidden border bg-black">
                        {isVideoSelected ? (
                            <video
                                key={selectedMedia}
                                src={selectedMedia}
                                className="w-full h-full object-contain"
                                controls
                                muted
                                autoPlay
                                loop
                                playsInline
                                preload="metadata"
                            >
                                Your browser does not support the video tag.
                            </video>
                        ) : (
                           selectedMedia && <Image src={selectedMedia} alt={product.name} fill className="object-cover"/>
                        )}
                         {isOutOfStock && !isVideoSelected && (
                            <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                                <span className="px-4 py-2 bg-black text-white font-semibold rounded-md">Out of Stock</span>
                            </div>
                        )}
                    </div>
                     <div className="grid grid-cols-5 gap-2 mt-4">
                        {uniqueMedia.map((media, idx) => {
                            if (!media) return null;
                            const isVideo = media.includes('cloudinary');
                            return (
                               <div 
                                    key={idx} 
                                    className={cn("aspect-[4/5] relative rounded-md overflow-hidden border-2 cursor-pointer", selectedMedia === media ? 'border-primary' : 'border-transparent')}
                                    onClick={() => handleMediaThumbnailClick(media as string)}>
                                   <Image 
                                        src={isVideo ? product.images[0] || 'https://placehold.co/400' : media as string}
                                        alt={`${product.name} thumbnail ${idx + 1}`} 
                                        fill 
                                        className="object-cover" 
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
                                        {discountPercentage}% OFF
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
                            <Button variant="link" className="px-0" onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}>
                                {isDescriptionExpanded ? 'View Less' : 'View More'}
                            </Button>
                        )}
                    </div>


                    {hasVariants && (
                        <div className="space-y-4">
                            <h3 className="font-semibold text-lg">Select {product.variants?.[0]?.name?.split(',')[0].split(':')[0] || 'Option'}</h3>
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
                            <ProductCountdown settings={store?.marketingSettings?.productTimer} />
                            <div className="flex items-center gap-4">
                                <p className="font-semibold">QTY:</p>
                                <div className="flex items-center border rounded-md">
                                    <Button variant="ghost" size="icon" onClick={() => setQuantity(q => Math.max(1, q - 1))}><Minus className="h-4 w-4"/></Button>
                                    <span className="w-10 text-center">{quantity}</span>
                                    <Button variant="ghost" size="icon" onClick={() => setQuantity(q => Math.min(currentStock, q + 1))}><Plus className="h-4 w-4"/></Button>
                                </div>
                            </div>
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center gap-4">
                                    <Button 
                                        size="lg" 
                                        className="flex-1"
                                        onClick={handleAddToCart}
                                    >
                                        <ShoppingCart className="mr-2 h-5 w-5"/> Add to Cart
                                    </Button>
                                </div>
                                <Button 
                                    size="lg" 
                                    variant="secondary"
                                    className="w-full"
                                    onClick={handleBuyNow}
                                >
                                    <Zap className="mr-2 h-5 w-5"/> Buy Now
                                </Button>
                                <div className="text-center text-sm text-muted-foreground mt-2">
                                    {product.manageStock ? (
                                        <span>{currentStock} available</span>
                                    ) : (
                                        <span>In Stock</span>
                                    )}
                                </div>
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
    );
}
