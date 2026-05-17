'use client';

import { useStore } from "@/context/store-context";
import Image from "next/image";
import { Button } from "./ui/button";
import Link from "next/link";
import { SearchForm } from "./store/SearchForm";
import { cn } from "@/lib/utils";
import { getStoreBasePath } from "@/lib/url";

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
  books:       'Knowledge is power — explore our collection',
};

const CATEGORY_FEATURES: Record<string, string[]> = {
  fashion:     ['Free returns on all orders', 'Authentic products guaranteed', 'Nationwide delivery'],
  food:        ['Fresh & hygienically prepared', 'Same-day delivery available', 'Customizable orders'],
  beauty:      ['100% authentic products', 'Dermatologist recommended', 'Secure packaging'],
  electronics: ['Official warranty included', 'Genuine products only', 'Tech support available'],
  furniture:   ['White-glove delivery available', 'Assembly support included', '30-day return policy'],
  groceries:   ['Farm-fresh produce', 'Same-day delivery', 'Best quality guaranteed'],
  services:    ['Experienced professionals', 'Satisfaction guaranteed', 'Flexible scheduling'],
};

const CATEGORY_ICONS: Record<string, string> = {
  fashion:     '👗',
  clothing:    '👔',
  food:        '🍲',
  restaurant:  '🍽️',
  beauty:      '✨',
  skincare:    '🌸',
  electronics: '📱',
  technology:  '💻',
  furniture:   '🛋️',
  home:        '🏡',
  groceries:   '🛒',
  grocery:     '🛒',
  services:    '🔧',
  health:      '💊',
  sports:      '⚽',
  books:       '📚',
};

function getCategoryTagline(category?: string): string {
  if (!category) return 'Discover amazing products at great prices';
  const cat = category.toLowerCase();
  for (const [key, val] of Object.entries(CATEGORY_TAGLINES)) {
    if (cat.includes(key)) return val;
  }
  return 'Discover amazing products at great prices';
}

function getCategoryFeatures(category?: string): string[] {
  if (!category) return ['Quality guaranteed', 'Secure checkout', 'Fast delivery'];
  const cat = category.toLowerCase();
  for (const [key, val] of Object.entries(CATEGORY_FEATURES)) {
    if (cat.includes(key)) return val;
  }
  return ['Quality guaranteed', 'Secure checkout', 'Fast delivery'];
}

function getCategoryIcon(category?: string): string {
  if (!category) return '🛍️';
  const cat = category.toLowerCase();
  for (const [key, val] of Object.entries(CATEGORY_ICONS)) {
    if (cat.includes(key)) return val;
  }
  return '🛍️';
}

export function StoreHero() {
  const { store, isDemo } = useStore();

  if (!store) return null;

  const basePath = isDemo ? `/demo/${store.slug}` : getStoreBasePath(store.subdomain);
  const aiHero = store?.storefrontConfig?.hero;
  const hasHeroImage = store?.isHeroBannerActive && store?.heroImageUrl;

  const headline = store?.heroHeadline || aiHero?.headline || `Welcome to ${store?.name}`;
  const subheadline = aiHero?.subheadline || store?.tagline || getCategoryTagline(store?.category);
  const primaryCta = store?.heroCtaText || aiHero?.primary_cta || 'Shop Collection';
  const features = getCategoryFeatures(store?.category);
  const categoryIcon = getCategoryIcon(store?.category);

  return (
    <section className={cn('bg-secondary border-b', hasHeroImage && 'relative overflow-hidden')}>
      {/* Hero image with dark overlay */}
      {hasHeroImage && (
        <>
          <Image
            src={store.heroImageUrl!}
            alt={headline || store.name}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-black/55" />
        </>
      )}

      {/* Editorial content */}
      <div className={cn(
        'relative z-10 container mx-auto px-4 md:px-6 py-16 md:py-24',
        hasHeroImage ? 'text-white' : 'text-foreground'
      )}>
        <div className="max-w-xl mx-auto text-center space-y-6">

          {/* Category icon — only shown when no hero image */}
          {!hasHeroImage && (
            <div className="text-5xl md:text-6xl mb-2 select-none" aria-hidden="true">
              {categoryIcon}
            </div>
          )}

          {/* Small category badge */}
          {store.category && (
            <p className={cn(
              'text-xs font-semibold uppercase tracking-widest',
              hasHeroImage ? 'text-white/70' : 'text-primary'
            )}>
              {store.category}
            </p>
          )}

          {/* Main headline */}
          <h1 className={cn(
            'text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-tight',
            hasHeroImage ? 'text-white drop-shadow-sm' : 'text-foreground'
          )}>
            {headline}
          </h1>

          {/* Subheadline */}
          {subheadline && (
            <p className={cn(
              'text-base md:text-lg leading-relaxed max-w-md mx-auto',
              hasHeroImage ? 'text-white/80' : 'text-muted-foreground'
            )}>
              {subheadline}
            </p>
          )}

          {/* Search */}
          <div className="max-w-sm mx-auto w-full">
            <SearchForm
              inputClassName={cn(
                'h-11 text-sm rounded-full border shadow-sm',
                hasHeroImage
                  ? 'bg-white text-foreground placeholder:text-muted-foreground border-0 shadow-lg'
                  : 'bg-background text-foreground placeholder:text-muted-foreground'
              )}
            />
          </div>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-1">
            <Button
              size="lg"
              className={cn(
                'rounded-full px-8 font-semibold text-sm transition-transform hover:scale-105',
                hasHeroImage
                  ? 'bg-white text-gray-900 hover:bg-gray-100 shadow-md'
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
                'rounded-full px-8 text-sm transition-transform hover:scale-105',
                hasHeroImage
                  ? 'border-white/50 text-white hover:bg-white/10 backdrop-blur-sm'
                  : 'border-border text-foreground hover:bg-secondary'
              )}
              asChild
            >
              <Link href="#track-order">Track My Order</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Trust strip */}
      <div className={cn(
        'relative z-10 border-t',
        hasHeroImage
          ? 'border-white/20 bg-black/30 backdrop-blur-sm'
          : 'border-border bg-background/60'
      )}>
        <div className="container mx-auto px-4 md:px-6 py-3">
          <div className={cn(
            'flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-8 text-sm',
            hasHeroImage ? 'text-white/80' : 'text-muted-foreground'
          )}>
            {features.map((f, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="text-primary font-bold">✓</span>
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
