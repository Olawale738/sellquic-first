'use client';

import { useStore } from "@/context/store-context";
import Image from "next/image";
import { Button } from "./ui/button";
import Link from "next/link";
import { SearchForm } from "./store/SearchForm";
import { cn } from "@/lib/utils";
import { getStoreBasePath } from "@/lib/url";
import { ShieldCheck, Truck, Zap, Star, Clock, Leaf } from "lucide-react";
import { useState, useEffect } from "react";

const CATEGORY_HERO_IMAGES: Record<string, string> = {
  fashion:     'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1400&h=700&fit=crop&auto=format&q=80',
  clothing:    'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1400&h=700&fit=crop&auto=format&q=80',
  apparel:     'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1400&h=700&fit=crop&auto=format&q=80',
  food:        'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1400&h=700&fit=crop&auto=format&q=80',
  restaurant:  'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1400&h=700&fit=crop&auto=format&q=80',
  bakery:      'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=1400&h=700&fit=crop&auto=format&q=80',
  beauty:      'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=1400&h=700&fit=crop&auto=format&q=80',
  cosmetics:   'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=1400&h=700&fit=crop&auto=format&q=80',
  skincare:    'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=1400&h=700&fit=crop&auto=format&q=80',
  electronics: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=1400&h=700&fit=crop&auto=format&q=80',
  technology:  'https://images.unsplash.com/photo-1593640408182-31c228f02c25?w=1400&h=700&fit=crop&auto=format&q=80',
  gadgets:     'https://images.unsplash.com/photo-1593640408182-31c228f02c25?w=1400&h=700&fit=crop&auto=format&q=80',
  furniture:   'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=1400&h=700&fit=crop&auto=format&q=80',
  home:        'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1400&h=700&fit=crop&auto=format&q=80',
  decor:       'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1400&h=700&fit=crop&auto=format&q=80',
  groceries:   'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1400&h=700&fit=crop&auto=format&q=80',
  grocery:     'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=1400&h=700&fit=crop&auto=format&q=80',
  supermarket: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1400&h=700&fit=crop&auto=format&q=80',
  services:    'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1400&h=700&fit=crop&auto=format&q=80',
  consulting:  'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1400&h=700&fit=crop&auto=format&q=80',
  health:      'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=1400&h=700&fit=crop&auto=format&q=80',
  sports:      'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=1400&h=700&fit=crop&auto=format&q=80',
};

function getCategoryHeroImage(category?: string): string | null {
  if (!category) return null;
  const cat = category.toLowerCase().trim();
  for (const [key, url] of Object.entries(CATEGORY_HERO_IMAGES)) {
    if (cat.includes(key)) return url;
  }
  return 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1400&h=700&fit=crop&auto=format&q=80';
}

const CATEGORY_TRUST: Record<string, { icon: React.ElementType; text: string }[]> = {
  fashion:     [{ icon: Truck, text: 'Nationwide delivery' }, { icon: ShieldCheck, text: 'Authentic products' }, { icon: Star, text: 'Loved by thousands' }],
  clothing:    [{ icon: Truck, text: 'Nationwide delivery' }, { icon: ShieldCheck, text: 'Quality guaranteed' }, { icon: Star, text: 'Top-rated styles' }],
  food:        [{ icon: Zap, text: 'Same-day delivery' }, { icon: ShieldCheck, text: 'Freshly prepared' }, { icon: Star, text: 'Hygienically packed' }],
  restaurant:  [{ icon: Clock, text: 'Fast order turnaround' }, { icon: ShieldCheck, text: 'Fresh ingredients' }, { icon: Star, text: 'Chef approved' }],
  beauty:      [{ icon: ShieldCheck, text: '100% authentic' }, { icon: Star, text: 'Dermatologist tested' }, { icon: Truck, text: 'Secure packaging' }],
  electronics: [{ icon: ShieldCheck, text: 'Official warranty' }, { icon: Star, text: 'Genuine products' }, { icon: Zap, text: 'Fast dispatch' }],
  furniture:   [{ icon: Truck, text: 'White-glove delivery' }, { icon: ShieldCheck, text: '30-day returns' }, { icon: Star, text: 'Premium craftsmanship' }],
  groceries:   [{ icon: Leaf, text: 'Farm-fresh produce' }, { icon: Zap, text: 'Same-day delivery' }, { icon: ShieldCheck, text: 'Quality guaranteed' }],
  services:    [{ icon: ShieldCheck, text: 'Satisfaction guaranteed' }, { icon: Star, text: 'Experienced team' }, { icon: Clock, text: 'Flexible scheduling' }],
};

const CATEGORY_TAGLINES: Record<string, string> = {
  fashion:     'Discover the latest styles and trends',
  clothing:    'Dress to impress with our curated collections',
  food:        'Delicious meals delivered fresh to your door',
  restaurant:  'Authentic flavors, made with love',
  beauty:      'Premium beauty products for your skin & hair',
  skincare:    'Glow up with our dermatologist-approved products',
  electronics: 'The latest tech at the best prices',
  technology:  'Cutting-edge gadgets for modern living',
  furniture:   'Beautiful furniture for every room',
  home:        'Transform your space with stunning pieces',
  groceries:   'Fresh groceries delivered to your doorstep',
  grocery:     'Quality groceries, delivered fast',
  services:    'Professional services tailored to your needs',
  health:      'Your wellness journey starts here',
  sports:      'Gear up for greatness',
};

function getTrust(category?: string) {
  if (!category) return [{ icon: ShieldCheck, text: 'Quality guaranteed' }, { icon: Truck, text: 'Fast delivery' }, { icon: Star, text: 'Top rated' }];
  const cat = category.toLowerCase();
  for (const [key, val] of Object.entries(CATEGORY_TRUST)) {
    if (cat.includes(key)) return val;
  }
  return [{ icon: ShieldCheck, text: 'Quality guaranteed' }, { icon: Truck, text: 'Nationwide delivery' }, { icon: Star, text: 'Secure checkout' }];
}

function getTagline(category?: string, tagline?: string): string {
  if (tagline) return tagline;
  if (!category) return 'Discover amazing products at great prices';
  const cat = category.toLowerCase();
  for (const [key, val] of Object.entries(CATEGORY_TAGLINES)) {
    if (cat.includes(key)) return val;
  }
  return 'Discover amazing products at great prices';
}

export function StoreHero() {
  const { store, isDemo } = useStore();

  if (!store) return null;

  const basePath = isDemo ? `/demo/${store.slug}` : getStoreBasePath(store.subdomain);
  const aiHero = store?.storefrontConfig?.hero || store?.autoStoreConfig?.storefront?.hero;
  const hasVendorImage = store?.isHeroBannerActive && store?.heroImageUrl;
  const categoryHeroImage = getCategoryHeroImage(store?.category);
  const effectiveHeroImage = hasVendorImage ? store.heroImageUrl! : (categoryHeroImage ?? undefined);
  const isPhotoMode = !!effectiveHeroImage;

  const headline = store?.heroHeadline || aiHero?.headline || store?.name;
  const subheadline = store?.tagline || aiHero?.subheadline || getTagline(store?.category);
  const primaryCta = store?.heroCtaText || aiHero?.primary_cta || 'Shop Now';
  const trust = getTrust(store?.category);

  // Cycling trust ticker state
  const [trustIdx, setTrustIdx] = useState(0);
  const [tickerVisible, setTickerVisible] = useState(true);

  useEffect(() => {
    if (trust.length <= 1) return;
    const id = setInterval(() => {
      setTickerVisible(false);
      setTimeout(() => {
        setTrustIdx((i) => (i + 1) % trust.length);
        setTickerVisible(true);
      }, 280);
    }, 2800);
    return () => clearInterval(id);
  }, [trust.length]);

  return (
    <section className={cn('relative overflow-hidden min-h-[520px] flex flex-col')}>

      {/* Photo background (vendor upload or category default) */}
      {effectiveHeroImage && (
        <>
          <Image
            src={effectiveHeroImage}
            alt={headline}
            fill
            className="object-cover"
            priority
            unoptimized={!hasVendorImage}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/55 to-black/25" />
        </>
      )}

      {/* Fallback blobs — only if somehow no image */}
      {!effectiveHeroImage && (
        <>
          <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 -left-16 h-64 w-64 rounded-full bg-primary/5 blur-2xl" />
        </>
      )}

      {/* Content */}
      <div className={cn(
        'relative z-10 container mx-auto px-4 md:px-6 py-16 md:py-24 flex flex-col items-center text-center gap-6 flex-1 justify-center',
      )}>

        {/* Category badge */}
        {store.category && (
          <span className={cn(
            'inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest border',
            isPhotoMode
              ? 'bg-white/10 border-white/30 text-white backdrop-blur-sm'
              : 'bg-primary/10 border-primary/20 text-primary'
          )}>
            {store.category}
          </span>
        )}

        {/* Headline */}
        <h1 className={cn(
          'text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-tight max-w-2xl',
          isPhotoMode ? 'text-white drop-shadow-md' : 'text-foreground'
        )}>
          {headline}
        </h1>

        {/* Subheadline */}
        {subheadline && (
          <p className={cn(
            'text-base md:text-lg max-w-lg leading-relaxed',
            isPhotoMode ? 'text-white/85' : 'text-muted-foreground'
          )}>
            {subheadline}
          </p>
        )}

        {/* Search bar */}
        <div className="w-full max-w-md">
          <SearchForm
            inputClassName={cn(
              'h-12 rounded-2xl border shadow-md text-sm',
              isPhotoMode
                ? 'bg-white/95 text-foreground placeholder:text-muted-foreground border-0'
                : 'bg-background border-border'
            )}
          />
        </div>

        {/* CTA buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button
            size="lg"
            className={cn(
              'rounded-2xl px-8 font-semibold shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5',
              isPhotoMode
                ? 'bg-white text-gray-900 hover:bg-gray-100'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            )}
            asChild
          >
            <Link href={`${basePath}/catalog`}>{primaryCta}</Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className={cn(
              'rounded-2xl px-8 transition-all hover:-translate-y-0.5',
              isPhotoMode
                ? 'border-white/40 text-white hover:bg-white/10 backdrop-blur-sm'
                : 'border-border text-foreground hover:bg-background'
            )}
            asChild
          >
            <Link href={`${basePath}/catalog`}>Browse Collection</Link>
          </Button>
        </div>
      </div>

      {/* Cycling trust ticker */}
      <div className={cn(
        'relative z-10 border-t',
        isPhotoMode
          ? 'border-white/20 bg-black/35 backdrop-blur-sm'
          : 'border-border bg-background/80'
      )}>
        <div className="py-2.5 text-center overflow-hidden h-8 flex items-center justify-center">
          <span
            className={cn(
              'text-[11px] font-bold uppercase tracking-[0.18em] transition-all duration-280',
              isPhotoMode ? 'text-white/75' : 'text-muted-foreground',
              tickerVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2',
            )}
          >
            {trust[trustIdx]?.text}
          </span>
        </div>
      </div>
    </section>
  );
}
