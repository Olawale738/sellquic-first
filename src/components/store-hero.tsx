'use client';

import { useStore } from "@/context/store-context";
import Image from "next/image";
import { Button } from "./ui/button";
import Link from "next/link";
import { SearchForm } from "./store/SearchForm";
import { cn } from "@/lib/utils";
import { getStoreBasePath } from "@/lib/url";
import { ShieldCheck, Truck, Zap, Star, Clock, Leaf } from "lucide-react";

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
  const hasHeroImage = store?.isHeroBannerActive && store?.heroImageUrl;

  const headline = store?.heroHeadline || aiHero?.headline || store?.name;
  const subheadline = store?.tagline || aiHero?.subheadline || getTagline(store?.category);
  const primaryCta = store?.heroCtaText || aiHero?.primary_cta || 'Shop Now';
  const trust = getTrust(store?.category);

  return (
    <section className={cn('relative overflow-hidden', hasHeroImage ? 'min-h-[520px] flex flex-col' : 'bg-secondary/40')}>

      {/* Hero image mode */}
      {hasHeroImage && (
        <>
          <Image
            src={store.heroImageUrl!}
            alt={headline}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/20" />
        </>
      )}

      {/* Gradient mode — decorative blobs */}
      {!hasHeroImage && (
        <>
          <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 -left-16 h-64 w-64 rounded-full bg-primary/5 blur-2xl" />
        </>
      )}

      {/* Content */}
      <div className={cn(
        'relative z-10 container mx-auto px-4 md:px-6 py-16 md:py-24 flex flex-col items-center text-center gap-6',
        hasHeroImage ? 'flex-1 justify-center' : ''
      )}>

        {/* Category badge */}
        {store.category && (
          <span className={cn(
            'inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest border',
            hasHeroImage
              ? 'bg-white/10 border-white/30 text-white backdrop-blur-sm'
              : 'bg-primary/10 border-primary/20 text-primary'
          )}>
            {store.category}
          </span>
        )}

        {/* Headline */}
        <h1 className={cn(
          'text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-tight max-w-2xl',
          hasHeroImage ? 'text-white drop-shadow-md' : 'text-foreground'
        )}>
          {headline}
        </h1>

        {/* Subheadline */}
        {subheadline && (
          <p className={cn(
            'text-base md:text-lg max-w-lg leading-relaxed',
            hasHeroImage ? 'text-white/85' : 'text-muted-foreground'
          )}>
            {subheadline}
          </p>
        )}

        {/* Search bar */}
        <div className="w-full max-w-md">
          <SearchForm
            inputClassName={cn(
              'h-12 rounded-2xl border shadow-md text-sm',
              hasHeroImage
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
              hasHeroImage
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
              hasHeroImage
                ? 'border-white/40 text-white hover:bg-white/10 backdrop-blur-sm'
                : 'border-border text-foreground hover:bg-background'
            )}
            asChild
          >
            <Link href="#track-order">Track My Order</Link>
          </Button>
        </div>
      </div>

      {/* Trust strip */}
      <div className={cn(
        'relative z-10 border-t',
        hasHeroImage
          ? 'border-white/20 bg-black/35 backdrop-blur-sm'
          : 'border-border bg-background/80'
      )}>
        <div className="container mx-auto px-4 md:px-6 py-3.5">
          <div className={cn(
            'flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-10 text-sm',
            hasHeroImage ? 'text-white/80' : 'text-muted-foreground'
          )}>
            {trust.map(({ icon: Icon, text }, i) => (
              <div key={i} className="flex items-center gap-2">
                <Icon className={cn('h-4 w-4 shrink-0', hasHeroImage ? 'text-white/70' : 'text-primary')} />
                <span className="font-medium">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
