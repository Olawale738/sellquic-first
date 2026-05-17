'use client';

import { useStore } from "@/context/store-context";
import Image from "next/image";
import { Button } from "./ui/button";
import Link from "next/link";
import { SearchForm } from "./store/SearchForm";
import { cn } from "@/lib/utils";
import { getStoreBasePath } from "@/lib/url";

const CATEGORY_GRADIENTS: Record<string, string> = {
  fashion:     'from-purple-600 via-pink-500 to-rose-400',
  clothing:    'from-purple-600 via-pink-500 to-rose-400',
  food:        'from-orange-500 via-amber-400 to-yellow-300',
  restaurant:  'from-orange-600 via-red-500 to-orange-400',
  beauty:      'from-rose-500 via-pink-400 to-fuchsia-300',
  skincare:    'from-rose-500 via-pink-400 to-fuchsia-300',
  electronics: 'from-blue-600 via-indigo-500 to-violet-400',
  technology:  'from-blue-600 via-indigo-500 to-violet-400',
  furniture:   'from-amber-600 via-orange-400 to-yellow-300',
  home:        'from-amber-600 via-orange-400 to-yellow-300',
  groceries:   'from-green-600 via-emerald-500 to-teal-400',
  grocery:     'from-green-600 via-emerald-500 to-teal-400',
  services:    'from-indigo-600 via-violet-500 to-purple-400',
  health:      'from-teal-500 via-green-400 to-emerald-300',
  sports:      'from-sky-600 via-blue-500 to-indigo-400',
  books:       'from-amber-700 via-orange-600 to-yellow-500',
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

function getCategoryGradient(category?: string): string {
  if (!category) return 'from-primary via-primary/80 to-primary/60';
  const cat = category.toLowerCase();
  for (const [key, val] of Object.entries(CATEGORY_GRADIENTS)) {
    if (cat.includes(key)) return val;
  }
  return 'from-primary via-primary/80 to-primary/60';
}

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

  const headline = store?.heroHeadline || aiHero?.headline || store?.name;
  const subheadline = aiHero?.subheadline || store?.tagline || getCategoryTagline(store?.category);
  const primaryCta = store?.heroCtaText || aiHero?.primary_cta || 'Shop Now';
  const secondaryCta = aiHero?.secondary_cta || 'Track My Order';

  const gradient = getCategoryGradient(store?.category);
  const features = getCategoryFeatures(store?.category);
  const categoryIcon = getCategoryIcon(store?.category);

  return (
    <div className="relative overflow-hidden">
      {/* Background */}
      {hasHeroImage ? (
        <>
          <Image
            src={store.heroImageUrl!}
            alt={headline || store.name}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70" />
        </>
      ) : (
        <>
          <div className={cn('absolute inset-0 bg-gradient-to-br', gradient)} />
          {/* Decorative blobs */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-black/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 w-[600px] h-[200px] bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl pointer-events-none" />
        </>
      )}

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 md:px-6 py-16 md:py-24 lg:py-32">
        <div className="max-w-2xl mx-auto text-center space-y-5">
          {/* Store logo */}
          {store.logoUrl && (
            <div className="flex justify-center mb-2">
              <div className="h-16 w-16 md:h-20 md:w-20 rounded-2xl overflow-hidden bg-white/20 backdrop-blur-sm border border-white/40 shadow-xl flex items-center justify-center">
                <Image
                  src={store.logoUrl}
                  alt={store.name}
                  width={72}
                  height={72}
                  className="object-contain p-1.5"
                />
              </div>
            </div>
          )}

          {/* Category badge */}
          {store.category && (
            <div className="flex justify-center">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 text-white text-sm font-medium">
                <span>{categoryIcon}</span>
                <span className="capitalize">{store.category}</span>
              </span>
            </div>
          )}

          {/* Headline */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight drop-shadow-sm">
            {headline}
          </h1>

          {/* Subheadline */}
          {subheadline && (
            <p className="text-base md:text-lg lg:text-xl text-white/85 max-w-xl mx-auto leading-relaxed">
              {subheadline}
            </p>
          )}

          {/* Search bar */}
          <div className="max-w-md mx-auto w-full">
            <SearchForm
              inputClassName="h-12 text-base rounded-full shadow-xl border-0 bg-white text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-1">
            <Button
              size="lg"
              className="rounded-full px-8 bg-white text-gray-900 hover:bg-gray-100 shadow-lg font-semibold text-base transition-transform hover:scale-105"
              asChild
            >
              <Link href={`${basePath}/catalog`}>{primaryCta}</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="rounded-full px-8 border-white/60 text-white hover:bg-white/15 backdrop-blur-sm text-base transition-transform hover:scale-105"
              asChild
            >
              <Link href="#track-order">{secondaryCta}</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Trust strip */}
      <div className="relative z-10 border-t border-white/20 bg-black/25 backdrop-blur-sm">
        <div className="container mx-auto px-4 md:px-6 py-3">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-8 text-white/90 text-sm">
            {features.map((f, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="text-green-300 font-bold">✓</span>
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
