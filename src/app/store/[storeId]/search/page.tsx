'use client';

import { useStore } from '@/context/store-context';
import { useSearchParams } from 'next/navigation';
import { useMemo, Suspense } from 'react';
import { Product } from '@/types/product';

import { ProductCard } from '@/components/store-product-card';
import { Loader2, Search } from 'lucide-react';

function SearchResults() {
  // Removed activeTheme from here
  const { store } = useStore();
  const searchParams = useSearchParams();
  const query = searchParams.get('q');

  const filteredProducts = useMemo(() => {
    if (!query || !store?.products) {
      return [];
    }
    const lowercasedQuery = query.toLowerCase();
    return store.products.filter((product: Product) => 
      !product.isArchived && (
        product.name.toLowerCase().includes(lowercasedQuery) ||
        (product.description && product.description.toLowerCase().includes(lowercasedQuery)) ||
        (product.category && product.category.toLowerCase().includes(lowercasedQuery))
      )
    );
  }, [query, store?.products]);

  return (
    <div className="container mx-auto px-4 md:px-6 py-8 md:py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold">Search Results</h1>
        {query ? (
          <p className="text-muted-foreground mt-2">
            {filteredProducts.length} results for "{query}"
          </p>
        ) : (
          <p className="text-muted-foreground mt-2">
            Please enter a search term.
          </p>
        )}
      </div>

      {filteredProducts.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-10">
          {filteredProducts.map((product: Product) => (
            // Removed the ternary operator and OnyxProductCard reference
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        !query ? null :
        <div className="text-center py-20 col-span-full">
            <Search className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">No products found</h3>
            <p className="text-muted-foreground mt-1">Try searching for something else.</p>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <SearchResults />
        </Suspense>
    )
}