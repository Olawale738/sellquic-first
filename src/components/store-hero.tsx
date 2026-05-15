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
    const aiHero = store?.storefrontConfig?.hero;

    // If hero is disabled, no search bar, and no AI config — render nothing.
    if (!isHeroActive && !showSearchBar && !aiHero) {
        return null;
    }

    const headline = store?.heroHeadline || aiHero?.headline;
    const subheadline = aiHero?.subheadline;
    const primaryCta = store?.heroCtaText || aiHero?.primary_cta || 'Shop Now';
    const secondaryCta = aiHero?.secondary_cta;

    return (
        <div className={cn(
            "relative bg-secondary text-secondary-foreground",
            isHeroActive ? "h-64 md:h-96" : (aiHero && !showSearchBar) ? "py-20 md:py-28" : "py-8"
        )}>
            {isHeroActive && store.heroImageUrl && (
                <Image
                    src={store.heroImageUrl}
                    alt={headline || store.name}
                    fill
                    className="object-cover"
                    priority
                />
            )}
            {isHeroActive && <div className="absolute inset-0 bg-black/50" />}

            <div className="relative h-full flex flex-col items-center justify-center text-center p-4 gap-4">
                {(isHeroActive || aiHero) && headline && (
                    <h1 className={cn(
                        "text-3xl md:text-5xl font-bold drop-shadow-sm max-w-3xl",
                        isHeroActive ? "text-white drop-shadow-md" : "text-foreground"
                    )}>
                        {headline}
                    </h1>
                )}

                {!isHeroActive && subheadline && (
                    <p className="text-muted-foreground text-base md:text-lg max-w-xl">{subheadline}</p>
                )}

                {showSearchBar ? (
                    <div className={cn("w-full max-w-md", (isHeroActive || aiHero) && "mt-2")}>
                        <SearchForm inputClassName="h-12 text-lg rounded-full shadow-lg" />
                    </div>
                ) : (isHeroActive || aiHero) && primaryCta && (
                    <div className="flex flex-col sm:flex-row gap-3 mt-2">
                        <Button size="lg" asChild className={cn(isHeroActive && "bg-white text-black hover:bg-white/90")}>
                            <Link href="#products">{primaryCta}</Link>
                        </Button>
                        {secondaryCta && (
                            <Button size="lg" variant="outline" asChild className={cn(isHeroActive && "border-white text-white hover:bg-white/10")}>
                                <Link href="#track-order">{secondaryCta}</Link>
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
