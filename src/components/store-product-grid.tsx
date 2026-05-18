
'use client';

import { useState, useMemo, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname, useParams } from 'next/navigation';
import { useStore } from '@/context/store-context';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProductCard } from './store-product-card';
import { Button } from './ui/button';
import { Product } from '@/types/product';
import { X, SlidersHorizontal, Grid3X3, List, ChevronDown, Sparkles, ShieldCheck, Zap, PackageSearch } from 'lucide-react';
import { cn, slugify } from '@/lib/utils';
import { getStoreBasePath } from '@/lib/url';

/* ─── Skeleton Card ─── */
function ProductSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="aspect-[4/5] rounded-xl bg-muted" />
      <div className="space-y-2 px-1">
        <div className="h-4 w-3/4 rounded bg-muted" />
        <div className="h-4 w-1/3 rounded bg-muted" />
      </div>
    </div>
  );
}

function ProductSkeletonGrid() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8 md:gap-x-6 md:gap-y-10">
      {Array.from({ length: 8 }).map((_, i) => (
        <ProductSkeleton key={i} />
      ))}
    </div>
  );
}

/* ─── Filter Chip ─── */
function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      onClick={onRemove}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
    >
      {label}
      <X className="h-3.5 w-3.5" />
    </button>
  );
}

/* ─── Price Range Slider ─── */
function PriceRangeFilter({
  min,
  max,
  currentMin,
  currentMax,
  onChange,
  currency = '₵',
}: {
  min: number;
  max: number;
  currentMin: number;
  currentMax: number;
  onChange: (min: number, max: number) => void;
  currency?: string;
}) {
  const [localMin, setLocalMin] = useState(currentMin);
  const [localMax, setLocalMax] = useState(currentMax);

  useEffect(() => {
    setLocalMin(currentMin);
    setLocalMax(currentMax);
  }, [currentMin, currentMax]);

  const handleMinChange = (value: number) => {
    const newMin = Math.min(value, localMax - 1);
    setLocalMin(newMin);
  };

  const handleMaxChange = (value: number) => {
    const newMax = Math.max(value, localMin + 1);
    setLocalMax(newMax);
  };

  const handleCommit = () => {
    onChange(localMin, localMax);
  };

  if (min === max) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground font-medium">Price Range</span>
        <span className="font-semibold text-foreground">
          {currency}{localMin.toLocaleString()} — {currency}{localMax.toLocaleString()}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          value={localMin}
          onChange={(e) => handleMinChange(Number(e.target.value))}
          onMouseUp={handleCommit}
          onTouchEnd={handleCommit}
          className="w-full h-2 rounded-full appearance-none bg-muted cursor-pointer accent-primary"
        />
        <input
          type="range"
          min={min}
          max={max}
          value={localMax}
          onChange={(e) => handleMaxChange(Number(e.target.value))}
          onMouseUp={handleCommit}
          onTouchEnd={handleCommit}
          className="w-full h-2 rounded-full appearance-none bg-muted cursor-pointer accent-primary"
        />
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <input
            type="number"
            value={localMin}
            min={min}
            max={localMax - 1}
            onChange={(e) => handleMinChange(Number(e.target.value))}
            onBlur={handleCommit}
            className="w-full px-3 py-1.5 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Min"
          />
        </div>
        <span className="text-muted-foreground self-center">—</span>
        <div className="flex-1">
          <input
            type="number"
            value={localMax}
            min={localMin + 1}
            max={max}
            onChange={(e) => handleMaxChange(Number(e.target.value))}
            onBlur={handleCommit}
            className="w-full px-3 py-1.5 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Max"
          />
        </div>
      </div>
    </div>
  );
}

const SECTION_LABELS: Record<string, { eyebrow: string; heading: string }> = {
  fashion:     { eyebrow: 'Latest styles',    heading: 'New Arrivals' },
  clothing:    { eyebrow: 'Latest styles',    heading: 'New Arrivals' },
  apparel:     { eyebrow: 'Latest styles',    heading: 'New Arrivals' },
  food:        { eyebrow: 'On the menu',      heading: 'Fresh Picks' },
  restaurant:  { eyebrow: "Today's menu",     heading: "Chef's Selections" },
  bakery:      { eyebrow: 'Baked fresh',      heading: "Today's Bakes" },
  catering:    { eyebrow: 'Made to order',    heading: 'Our Menu' },
  beauty:      { eyebrow: 'Just in',          heading: 'New Beauty Drops' },
  cosmetics:   { eyebrow: 'Just in',          heading: 'New Arrivals' },
  skincare:    { eyebrow: 'Glow essentials',  heading: 'Skincare Picks' },
  electronics: { eyebrow: 'Just landed',      heading: 'Latest Tech' },
  technology:  { eyebrow: 'Just launched',    heading: 'New Devices' },
  furniture:   { eyebrow: 'Just in',          heading: 'New Collections' },
  home:        { eyebrow: 'Just in',          heading: 'Home Picks' },
  groceries:   { eyebrow: 'Farm fresh',       heading: "Today's Stock" },
  grocery:     { eyebrow: 'Farm fresh',       heading: 'Fresh Stock' },
  services:    { eyebrow: 'Available now',    heading: 'Our Services' },
  health:      { eyebrow: 'Wellness picks',   heading: 'Health & Wellness' },
  sports:      { eyebrow: 'Gear up',          heading: 'Sports & Fitness' },
};

function getSectionLabel(category?: string) {
  if (!category) return { eyebrow: 'Just landed', heading: 'New Arrivals' };
  const cat = category.toLowerCase();
  for (const [key, val] of Object.entries(SECTION_LABELS)) {
    if (cat.includes(key)) return val;
  }
  return { eyebrow: 'Just landed', heading: 'New Arrivals' };
}

/* ─── Main Grid (inner, wrapped by Suspense) ─── */
function StoreProductGridInner() {
  const { store, isDemo } = useStore();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();

  // 1. Determine active category from path first, then query param
  const categoryNameFromPath = params.categoryName ? decodeURIComponent(params.categoryName as string).replace(/-/g, ' ') : null;
  const categoryNameFromQuery = searchParams.get('category');
  const initialCategory = categoryNameFromPath || categoryNameFromQuery || 'all';

  const sortParam = searchParams.get('sort') || 'newest';
  const minPriceParam = searchParams.get('min') ? Number(searchParams.get('min')) : null;
  const maxPriceParam = searchParams.get('max') ? Number(searchParams.get('max')) : null;

  const [filter, setFilter] = useState(initialCategory);
  const [sort, setSort] = useState(sortParam);
  const [visibleCount, setVisibleCount] = useState(12);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const priceRange = useMemo(() => {
    if (!store?.products?.length) return { min: 0, max: 1000 };
    const prices = store.products.map((p: Product) => p.price).filter(Boolean);
    if (prices.length === 0) return { min: 0, max: 1000 };
    return {
      min: Math.floor(Math.min(...prices)),
      max: Math.ceil(Math.max(...prices)),
    };
  }, [store?.products]);

  const [priceMin, setPriceMin] = useState(minPriceParam ?? priceRange.min);
  const [priceMax, setPriceMax] = useState(maxPriceParam ?? priceRange.max);
  
  const basePath = isDemo ? `/demo/${store?.slug}` : getStoreBasePath(store?.subdomain);

  const handleFilterChange = (value: string) => {
    if (value === 'all') {
      router.push(basePath);
    } else {
      router.push(`${basePath}/category/${slugify(value)}`);
    }
  };

  const handleSortChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'newest') {
      params.delete('sort');
    } else {
      params.set('sort', value);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handlePriceChange = (min: number, max: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (min === priceRange.min) params.delete('min');
    else params.set('min', String(min));

    if (max === priceRange.max) params.delete('max');
    else params.set('max', String(max));
    
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };
  
  const clearAllFilters = () => {
    router.push(basePath);
  };
  
  useEffect(() => {
    setFilter(initialCategory);
    setSort(sortParam);
    if (minPriceParam !== null) setPriceMin(minPriceParam); else setPriceMin(priceRange.min);
    if (maxPriceParam !== null) setPriceMax(maxPriceParam); else setPriceMax(priceRange.max);
  }, [initialCategory, sortParam, minPriceParam, maxPriceParam, priceRange]);


  const hasActiveFilters = filter !== 'all' || sort !== 'newest' || priceMin !== priceRange.min || priceMax !== priceRange.max;
  const sectionLabel = getSectionLabel(store?.category);

  // ── Empty store: no products at all ───────────────────────────────────────
  if (!store.products?.length) {
    return (
      <section className="relative overflow-hidden border-t bg-background" id="products">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.07),transparent_60%),radial-gradient(ellipse_at_bottom_left,hsl(var(--primary)/0.04),transparent_60%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:48px_48px] opacity-30" />

        <div className="relative container mx-auto px-4 md:px-6 py-20 md:py-28">

          {/* ── Top badge ── */}
          <div className="flex justify-center mb-8">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/8 px-4 py-1.5 text-xs font-semibold text-primary uppercase tracking-widest">
              <Sparkles className="h-3 w-3" />
              Launching Soon
            </span>
          </div>

          {/* ── Headline ── */}
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 leading-tight">
              Something{' '}
              <span className="text-primary">exceptional</span>{' '}
              is on the way
            </h2>
            <p className="text-muted-foreground text-base md:text-lg leading-relaxed">
              {store.name} is putting the finishing touches on a carefully curated collection.
              Every item is being handpicked to meet our quality standards — check back soon.
            </p>
          </div>

          {/* ── Promise cards ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 max-w-3xl mx-auto mb-12">
            {[
              {
                icon: <PackageSearch className="h-5 w-5 text-primary" />,
                bg: 'bg-primary/10',
                title: 'Curated Selection',
                desc: 'Every product hand-picked for quality, value, and relevance.',
              },
              {
                icon: <Zap className="h-5 w-5 text-amber-500" />,
                bg: 'bg-amber-500/10',
                title: 'Fast Delivery',
                desc: 'Reliable nationwide shipping with real-time order tracking.',
              },
              {
                icon: <ShieldCheck className="h-5 w-5 text-emerald-500" />,
                bg: 'bg-emerald-500/10',
                title: 'Quality Guaranteed',
                desc: 'Verified authentic products backed by our quality promise.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border bg-card/80 backdrop-blur-sm p-5 flex flex-col gap-3 hover:shadow-md hover:border-primary/20 transition-all"
              >
                <div className={`h-10 w-10 rounded-xl ${item.bg} flex items-center justify-center`}>
                  {item.icon}
                </div>
                <div>
                  <p className="font-semibold text-sm mb-1">{item.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Footer note ── */}
          <p className="text-center text-xs text-muted-foreground/50">
            Questions about an existing order? Use the{' '}
            <span className="font-semibold text-muted-foreground/70">Help</span> button in the navigation above.
          </p>

        </div>
      </section>
    );
  }

  if (!store) {
    return (
      <div className="container mx-auto px-4 md:px-6 py-8 md:py-12">
        <ProductSkeletonGrid />
      </div>
    );
  }

  const sortedAndFilteredProducts = useMemo(() => {
    let products = [...store.products];

    // Category filter (case-insensitive)
    if (filter !== 'all') {
      products = products.filter((p: Product) =>
        p.category?.toLowerCase() === filter.toLowerCase()
      );
    }

    // Price range filter
    products = products.filter((p: Product) => {
      let effectivePrice = p.price || 0;
      if (p.hasVariants && p.variants && p.variants.length > 0) {
        const variantPrices = p.variants.map(v => v.price).filter(price => typeof price === 'number' && price > 0);
        if (variantPrices.length > 0) {
          effectivePrice = Math.min(...variantPrices);
        }
      }
      return effectivePrice >= priceMin && effectivePrice <= priceMax;
    });

    // Sort
    if (sort === 'price_asc') {
      products.sort((a, b) => a.price - b.price);
    } else if (sort === 'price_desc') {
      products.sort((a, b) => b.price - a.price);
    } else {
      products.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return dateB.getTime() - dateA.getTime();
      });
    }

    return products;
  }, [store.products, filter, sort, priceMin, priceMax]);
  

  const totalCount = sortedAndFilteredProducts.length;
  const visibleProducts = sortedAndFilteredProducts.slice(0, visibleCount);

  return (
    <div className="container mx-auto px-4 md:px-6 py-8 md:py-12" id="products">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-1">{sectionLabel.eyebrow}</p>
            <h2 className="text-2xl font-bold tracking-tight">{filter !== 'all' ? filter : sectionLabel.heading}</h2>
            {totalCount > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                {totalCount === 1 ? '1 product' : `${totalCount} products`}
                {filter !== 'all' && ` in ${filter}`}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="sm:hidden"
            >
              <SlidersHorizontal className="h-4 w-4 mr-1.5" />
              Filters
              {hasActiveFilters && (
                <span className="ml-1.5 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                  !
                </span>
              )}
            </Button>
            <div className="hidden sm:flex items-center border rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  'p-2 transition-colors',
                  viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                )}
              >
                <Grid3X3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'p-2 transition-colors',
                  viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                )}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
            <div className="hidden sm:flex gap-2">
              <Select value={filter} onValueChange={handleFilterChange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {store.categories?.map((cat: any) => (
                    <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sort} onValueChange={handleSortChange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="price_asc">Price: Low to High</SelectItem>
                  <SelectItem value="price_desc">Price: High to Low</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowFilters(!showFilters)}
                className={cn(showFilters && 'bg-primary text-primary-foreground')}
              >
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className={cn('sm:hidden flex flex-col gap-3', !showFilters && 'hidden')}>
          <Select value={filter} onValueChange={handleFilterChange}>
            <SelectTrigger>
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {store.categories?.map((cat: any) => (
                <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={handleSortChange}>
            <SelectTrigger>
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="price_asc">Price: Low to High</SelectItem>
              <SelectItem value="price_desc">Price: High to Low</SelectItem>
            </SelectContent>
          </Select>
          <PriceRangeFilter
            min={priceRange.min}
            max={priceRange.max}
            currentMin={priceMin}
            currentMax={priceMax}
            onChange={handlePriceChange}
          />
        </div>

        <div className={cn('hidden sm:block', !showFilters && 'sm:hidden')}>
          <div className="max-w-md">
            <PriceRangeFilter
              min={priceRange.min}
              max={priceRange.max}
              currentMin={priceMin}
              currentMax={priceMax}
              onChange={handlePriceChange}
            />
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2">
            {filter !== 'all' && (
              <FilterChip label={filter} onRemove={() => handleFilterChange('all')} />
            )}
            {sort !== 'newest' && (
              <FilterChip
                label={sort === 'price_asc' ? 'Price: Low → High' : 'Price: High → Low'}
                onRemove={() => handleSortChange('newest')}
              />
            )}
            {(priceMin !== priceRange.min || priceMax !== priceRange.max) && (
              <FilterChip
                label={`₵${priceMin.toLocaleString()} — ₵${priceMax.toLocaleString()}`}
                onRemove={() => handlePriceChange(priceRange.min, priceRange.max)}
              />
            )}
            <button
              onClick={clearAllFilters}
              className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors ml-1"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      <div
        className={cn(
          viewMode === 'grid'
            ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8 md:gap-x-6 md:gap-y-10'
            : 'flex flex-col gap-4'
        )}
      >
        {visibleProducts.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      {totalCount === 0 && (
        <div className="text-center py-20 col-span-full">
          {hasActiveFilters ? (
            <>
              <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <SlidersHorizontal className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-1">No products found</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Try adjusting your filters or search term.
              </p>
              <Button variant="outline" onClick={clearAllFilters}>
                Clear all filters
              </Button>
            </>
          ) : (
            <>
              <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
                <PackageSearch className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-2">No products in this category yet</h3>
              <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-5">
                This section is being stocked. Browse other categories or check back soon.
              </p>
              <Button variant="outline" onClick={clearAllFilters} className="rounded-xl px-6">
                View all products
              </Button>
            </>
          )}
        </div>
      )}

      {visibleCount < totalCount && (
        <div className="text-center mt-12 space-y-2">
          <Button variant="outline" size="lg" onClick={() => setVisibleCount(prev => prev + 8)}>
            Load More Products
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
          <p className="text-xs text-muted-foreground">
            Showing {visibleProducts.length} of {totalCount} products
          </p>
        </div>
      )}
    </div>
  );
}

export function StoreProductGrid({ searchTerm }: { searchTerm?: string }) {
  return (
    <Suspense fallback={<ProductSkeletonGrid />}>
      <StoreProductGridInner />
    </Suspense>
  );
}
