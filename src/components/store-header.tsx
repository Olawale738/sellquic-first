
'use client';

import { useStore } from '@/context/store-context';
import { ShoppingBag, Menu, ChevronDown, Trash2 } from 'lucide-react'; 
import { useCart } from '@/hooks/use-cart';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from './ui/button';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Badge } from './ui/badge';
import { useState } from 'react';
import { getStoreBasePath } from '@/lib/url';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from './ui/collapsible';
import { StoreSupportDropdown } from './store/StoreSupportDropdown';

const MainMenuSheet = () => {
    const { store, isDemo } = useStore();
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    
    if (!store) return null;
    
    let basePath;
    if (isDemo) {
        basePath = `/demo/${store.slug}`;
    } else {
        basePath = getStoreBasePath(store.subdomain);
    }
    
    return (
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2">
                    <Menu className="h-5 w-5" />
                    <span className="hidden sm:inline-block">Menu</span>
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[85vw] sm:w-[400px] flex flex-col p-0">
                 <SheetHeader className="p-6 border-b">
                    <SheetTitle>Menu</SheetTitle>
                 </SheetHeader>
                 <nav className="flex-1 overflow-y-auto px-6 space-y-2 pt-4">
                    <Link href={basePath || '/'} onClick={() => setIsSheetOpen(false)} className="block py-2 font-medium hover:text-primary">Home</Link>
                    <Link href={`${basePath}/catalog`} onClick={() => setIsSheetOpen(false)} className="block py-2 font-medium hover:text-primary">Shop / Collection</Link>

                    {store.categories && store.categories.length > 0 && (
                      <Collapsible>
                          <CollapsibleTrigger className="w-full flex items-center justify-between py-2 font-medium hover:text-primary">
                            <span>Categories</span>
                            <ChevronDown className="h-4 w-4" />
                          </CollapsibleTrigger>
                          <CollapsibleContent className="pl-4">
                             {store.categories.map((cat: any) => (
                                <Link key={cat.id} href={`${basePath}/category/${cat.name.toLowerCase().replace(/\s+/g, '-')}`} onClick={() => setIsSheetOpen(false)} className="block py-2 text-muted-foreground hover:text-primary">{cat.name}</Link>
                            ))}
                          </CollapsibleContent>
                      </Collapsible>
                    )}

                    <Link href="#" onClick={(e) => { e.preventDefault(); setIsSheetOpen(false); }} className="block py-2 text-muted-foreground hover:text-primary">Help &amp; Track Order</Link>
                    {store?.isAboutUsActive && <Link href={`${basePath}/about`} onClick={() => setIsSheetOpen(false)} className="block py-2 text-muted-foreground hover:text-primary">About Us</Link>}
                    {store?.isReturnPolicyActive && <Link href={`${basePath}/return-policy`} onClick={() => setIsSheetOpen(false)} className="block py-2 text-muted-foreground hover:text-primary">Return Policy</Link>}
                 </nav>
            </SheetContent>
        </Sheet>
    )
}

const CartSheet = () => {
    const { cart, total, cartCount, removeItem, updateQuantity } = useCart();
    const { store, isDemo } = useStore();
    
    if (!store) return null;
    
    let basePath;
     if (isDemo) {
        basePath = `/demo/${store.slug}`;
    } else {
        basePath = getStoreBasePath(store.subdomain);
    }

    return (
         <Sheet>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-10 w-10">
                    <ShoppingBag className="h-5 w-5" />
                    {cartCount > 0 && <Badge variant="default" className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs">{cartCount}</Badge>}
                </Button>
            </SheetTrigger>
            <SheetContent>
                <div className="p-6 h-full flex flex-col">
                    <h2 className="text-lg font-bold mb-4">Your Cart</h2>
                    {cart.length > 0 ? (
                        <>
                            <div className="flex-1 overflow-y-auto -mx-6 px-6">
                                <div className="space-y-4">
                                {cart.map(item => (
                                    <div key={item.id + (item.selectedVariant?.id || '')} className="flex items-start gap-3">
                                        <Image src={item.selectedVariant?.image || item.images?.[0] || '/placeholder.svg'} alt={item.name} width={56} height={56} className="rounded-md border object-cover"/>
                                        <div className="flex-1 grid gap-0.5 text-sm">
                                            <p className="font-medium leading-tight">{item.name}</p>
                                            {item.selectedVariant && <p className="text-xs text-muted-foreground">{item.selectedVariant.name}</p>}
                                            <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                                            <p className="font-semibold">GH₵{(item.price * item.quantity).toFixed(2)}</p>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => removeItem(item.id, item.selectedVariant?.id)}>
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                                </div>
                            </div>
                            <div className="mt-auto pt-6 border-t">
                                <div className="flex justify-between font-bold text-lg mb-4">
                                    <span>Total</span>
                                    <span>GH₵{total.toFixed(2)}</span>
                                </div>
                                <SheetClose asChild>
                                    <Button size="lg" className="w-full" asChild>
                                        <Link href={`${basePath}/checkout`}>Proceed to Checkout</Link>
                                    </Button>
                                </SheetClose>
                            </div>
                        </>
                    ) : (
                        <div className="text-center text-muted-foreground flex-1 flex flex-col items-center justify-center">
                            <ShoppingBag className="h-12 w-12 mb-4"/>
                            <p>Your cart is empty.</p>
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    )
}

export function StoreHeader() {
    const { store, isDemo } = useStore();

    if (!store) {
        return (
             <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container h-16 flex items-center justify-center">
                    <div className="h-8 w-24 bg-muted animate-pulse rounded-md"></div>
                </div>
            </header>
        )
    }

    const basePath = isDemo ? `/demo/${store.slug}` : getStoreBasePath(store.subdomain);

    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container h-16 flex items-center justify-between gap-4">
                {/* Mobile: hamburger left */}
                <div className="flex items-center sm:hidden">
                    <MainMenuSheet />
                </div>

                {/* Logo + store name (left on desktop, center on mobile) */}
                <div className="flex-shrink-0 flex flex-col items-center sm:items-start">
                    <Link href={basePath || '/'} className="flex items-center gap-2">
                        {store.logoUrl && (
                            <Image src={store.logoUrl} alt={`${store.name} logo`} width={36} height={36} className="rounded-full" />
                        )}
                        <span className="font-bold text-base sm:text-lg">{store.name}</span>
                    </Link>
                    <span className="hidden md:block text-xs text-muted-foreground leading-none mt-0.5">
                        Secure &amp; fast delivery
                    </span>
                </div>

                {/* Desktop nav links — center-right */}
                <nav className="hidden sm:flex items-center gap-4 flex-1 justify-center sm:justify-end sm:mr-4">
                    <Link href={`${basePath}/catalog`} className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors">
                        Shop
                    </Link>
                    {store?.isAboutUsActive && (
                        <Link href={`${basePath}/about`} className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors">
                            About
                        </Link>
                    )}
                    <StoreSupportDropdown />
                </nav>

                {/* Cart always far right */}
                <div className="flex-shrink-0">
                    <CartSheet />
                </div>
            </div>
        </header>
    );
}
