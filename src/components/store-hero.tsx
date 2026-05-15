'use client';

import { useStore } from "@/context/store-context";
import Image from "next/image";
import { Button } from "./ui/button";
import Link from "next/link";
import { SearchForm } from "./store/SearchForm";
import { cn } from "@/lib/utils";

export function StoreHero() {
    const { store } = useStore();

    const isHeroActive = store?.isHeroBannerActive;
    const showSearchBar = store?.themeConfig?.showSearchBarInHero ?? true;

    // If hero is disabled and we don't need to show a search bar, render nothing.
    if (!isHeroActive && !showSearchBar) {
        return null;
    }

    return (
        <div className={cn(
            "relative bg-secondary text-secondary-foreground",
            isHeroActive ? "h-64 md:h-96" : "py-8" // Use padding instead of fixed height when banner is off
        )}>
            {isHeroActive && store.heroImageUrl && (
                <Image
                    src={store.heroImageUrl}
                    alt={store.heroHeadline || store.name}
                    fill
                    className="object-cover"
                    priority
                />
            )}
            {isHeroActive && <div className="absolute inset-0 bg-black/50" />}
            
            <div className="relative h-full flex flex-col items-center justify-center text-center p-4">
                {isHeroActive && (
                  <h1 className="text-3xl md:text-5xl font-bold text-white drop-shadow-md">{store.heroHeadline}</h1>
                )}
                
                {showSearchBar ? (
                    <div className={cn("w-full max-w-md", isHeroActive && "mt-6")}>
                        <SearchForm inputClassName="h-12 text-lg rounded-full shadow-lg" />
                    </div>
                ) : isHeroActive && store.heroCtaText && (
                    <Button size="lg" asChild className="mt-6">
                        <Link href="#products">{store.heroCtaText}</Link>
                    </Button>
                )}
            </div>
        </div>
    );
}
