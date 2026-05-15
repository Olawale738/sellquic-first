'use client';

import { useStore } from "@/context/store-context";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { usePathname } from "next/navigation";
import { Product } from "@/types/product";
import { getStoreBasePath } from "@/lib/url";

interface StoreBreadcrumbsProps {
    product?: Product;
}

export const StoreBreadcrumbs = ({ product }: StoreBreadcrumbsProps) => {
    const { store, isDemo } = useStore();
    const pathname = usePathname();

    if (!store) return null;
    
    let basePath;
    if (isDemo) {
        basePath = `/demo/${store.slug}`;
    } else {
        basePath = getStoreBasePath(store.subdomain);
    }


    const isProductPage = pathname.includes('/products/');
    const isCheckoutPage = pathname.includes('/checkout');
    const isCatalogPage = pathname.includes('/catalog');

    return (
        <nav className="flex items-center text-sm text-muted-foreground">
            <Link href={basePath || '/'} className="hover:text-primary">Home</Link>

            {isCatalogPage && (
                <>
                    <ChevronRight className="h-4 w-4 mx-1" />
                    <span className="font-medium text-foreground">Collection</span>
                </>
            )}

            {isProductPage && product && (
                 <>
                    <ChevronRight className="h-4 w-4 mx-1" />
                    {product.category && <Link href={`${basePath}/catalog`} className="hover:text-primary">{product.category}</Link>}
                 </>
            )}

            {isCheckoutPage && (
                 <>
                    <ChevronRight className="h-4 w-4 mx-1" />
                    <span className="font-medium text-foreground">Checkout</span>
                 </>
            )}
        </nav>
    )
}
