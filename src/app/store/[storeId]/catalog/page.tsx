'use client';

import { useState, useMemo, Suspense } from 'react';
import { useStore } from '@/context/store-context';
import { ProductCard } from '@/components/store-product-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Product } from '@/types/product';
import { Search, SlidersHorizontal, X, ChevronDown } from 'lucide-react';
import { cn, slugify } from '@/lib/utils';
import Link from 'next/link';
import { getStoreBasePath } from '@/lib/url';
import { StoreBreadcrumbs } from '@/components/store-breadcrumbs';

function CatalogPageInner() {
  const { store, isDemo } = useStore();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [sort, setSort] = useState('newest');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [visibleCount, setVisibleCount] = useState(16);

  const basePath = isDemo ? `/demo/${store?.slug}` : getStoreBasePath(store?.subdomain);

  const categories = useMemo(() => {
    if (!store?.categories?.length) return [];
    return store.categories;
  }, [store?.categories]);

  const products = useMemo(() => {
    if (!store?.products) return [];

    let list: Product[] = [...store.products];

    if (activeCategory !== 'all') {
      list = list.filter((p) => p.category?.toLowerCase() === activeCategory.toLowerCase());
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q)
      );
    }

    if (sort === 'price_asc') list.sort((a, b) => a.price - b.price);
    else if (sort === 'price_desc') list.sort((a, b) => b.price - a.price);
    else {
      list.sort((a, b) => {
        const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const db_ = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return db_.getTime() - da.getTime();
      });
    }

    return list;
  }, [store?.products, activeCategory, search, sort]);

  const visible = products.slice(0, visibleCount);

  if (!store) return null;

  const Filters = () => (
    <aside className="space-y-6">
      <div>
        <h3 className="font-semibold mb-3 text-sm uppercase tracking-wide text-muted-foreground">Categories</h3>
        <ul className="space-y-1">
          <li>
            <button
              onClick={() => setActiveCategory('all')}
              className={cn(
                'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                activeCategory === 'all'
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'hover:bg-muted text-foreground'
              )}
            >
              All Products
              <span className="ml-auto float-right text-xs opacity-70">{store.products?.length || 0}</span>
            </button>
          </li>
          {categories.map((cat: any) => {
            const count = store.products?.filter((p: Product) => p.category?.toLowerCase() === cat.name?.toLowerCase()).length || 0;
            return (
              <li key={cat.id}>
                <button
                  onClick={() => setActiveCategory(cat.name)}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                    activeCategory === cat.name
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'hover:bg-muted text-foreground'
                  )}
                >
                  {cat.name}
                  <span className="ml-auto float-right text-xs opacity-70">{count}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <h3 className="font-semibold mb-3 text-sm uppercase tracking-wide text-muted-foreground">Sort By</h3>
        <div className="space-y-1">
          {[
            { value: 'newest', label: 'Newest First' },
            { value: 'price_asc', label: 'Price: Low to High' },
            { value: 'price_desc', label: 'Price: High to Low' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSort(opt.value)}
              className={cn(
                'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                sort === opt.value
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'hover:bg-muted text-foreground'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );

  return (
    <div className="container mx-auto px-4 md:px-6 py-8">
      <StoreBreadcrumbs />

      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          {activeCategory === 'all' ? 'All Products' : activeCategory}
        </h1>
        <p className="text-muted-foreground mt-1">
          {products.length} {products.length === 1 ? 'product' : 'products'} available
        </p>
      </div>

      {/* Search + mobile filter toggle */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            className="pl-9 h-11"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button
          variant="outline"
          className="md:hidden h-11 gap-2"
          onClick={() => setShowMobileFilters(!showMobileFilters)}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
        </Button>
      </div>

      {/* Mobile filters drawer */}
      {showMobileFilters && (
        <div className="md:hidden mb-6 p-4 bg-secondary rounded-2xl">
          <Filters />
        </div>
      )}

      <div className="flex gap-8">
        {/* Desktop sidebar */}
        <div className="hidden md:block w-52 shrink-0">
          <Filters />
        </div>

        {/* Product grid */}
        <div className="flex-1 min-w-0">
          {visible.length === 0 ? (
            <div className="text-center py-20">
              {store.products?.length === 0 ? (
                // New store — no products at all
                <>
                  <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6 text-4xl">
                    🛍️
                  </div>
                  <h3 className="text-xl font-bold mb-2">Products Coming Soon</h3>
                  <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-6">
                    We&apos;re busy curating amazing products just for you. Check back soon!
                  </p>
                </>
              ) : (
                // Has products but filters returned nothing
                <>
                  <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Search className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-1">No products found</h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Try adjusting your search or category filter.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => { setSearch(''); setActiveCategory('all'); }}
                  >
                    Clear filters
                  </Button>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                {visible.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {visibleCount < products.length && (
                <div className="text-center mt-10 space-y-2">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => setVisibleCount((c) => c + 16)}
                  >
                    Load More
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Showing {visible.length} of {products.length}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CatalogPage() {
  return (
    <Suspense>
      <CatalogPageInner />
    </Suspense>
  );
}
