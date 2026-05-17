'use client';

import { useStore } from '@/context/store-context';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getStoreBasePath } from '@/lib/url';
import { cn, slugify } from '@/lib/utils';

interface CategoryCard {
  id: string;
  name: string;
  description?: string;
}

const DEFAULT_CATEGORIES: Record<string, string[]> = {
  fashion:     ['Dresses', 'Tops & Blouses', 'Shoes', 'Bags', 'Accessories'],
  clothing:    ['Tops', 'Bottoms', 'Shoes', 'Bags', 'Accessories'],
  food:        ['Meals', 'Snacks', 'Drinks', 'Catering'],
  restaurant:  ['Main Course', 'Sides', 'Drinks', 'Desserts'],
  beauty:      ['Skincare', 'Haircare', 'Makeup', 'Fragrance'],
  skincare:    ['Moisturizers', 'Serums', 'Cleansers', 'SPF'],
  electronics: ['Phones', 'Gadgets', 'Accessories', 'Repairs'],
  technology:  ['Laptops', 'Phones', 'Smart Home', 'Accessories'],
  furniture:   ['Living Room', 'Bedroom', 'Office', 'Decor'],
  home:        ['Living Room', 'Bedroom', 'Kitchen', 'Decor'],
  groceries:   ['Fresh Food', 'Pantry', 'Drinks', 'Household'],
  grocery:     ['Fresh Food', 'Pantry', 'Drinks', 'Household'],
  services:    ['Packages', 'Bookings', 'Consultations', 'Custom Requests'],
  health:      ['Supplements', 'Skincare', 'Fitness', 'Wellness'],
  sports:      ['Apparel', 'Equipment', 'Footwear', 'Accessories'],
};

function resolveDefaultCategories(category?: string): CategoryCard[] {
  const fallback = ['New Arrivals', 'Best Sellers', 'Featured', 'Sale'];
  if (!category) {
    return fallback.map((name, i) => ({ id: `default-${i}`, name }));
  }
  const cat = category.toLowerCase();
  for (const [key, names] of Object.entries(DEFAULT_CATEGORIES)) {
    if (cat.includes(key)) {
      return names.map((name, i) => ({ id: `default-${i}`, name }));
    }
  }
  return fallback.map((name, i) => ({ id: `default-${i}`, name }));
}

export function CategorySection() {
  const { store, isDemo } = useStore();

  if (!store) return null;

  const basePath = isDemo ? `/demo/${store.slug}` : getStoreBasePath(store.subdomain);

  let categories: CategoryCard[] = [];

  if (store.categories?.length) {
    categories = store.categories.slice(0, 6);
  } else if (store.storefrontConfig?.categories?.length) {
    categories = (store.storefrontConfig.categories as any[]).slice(0, 6).map((cat, i) => ({
      id: `ai-${i}`,
      name: typeof cat === 'string' ? cat : cat.name,
      description: typeof cat === 'object' ? cat.description : undefined,
    }));
  } else {
    categories = resolveDefaultCategories(store.category);
  }

  if (!categories.length) return null;

  return (
    <section className="bg-secondary/30 py-12 md:py-16">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-1">Browse</p>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Shop by Category</h2>
          </div>
          <Link
            href={`${basePath}/catalog`}
            className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            View All <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div
          className={cn(
            'grid gap-4',
            categories.length <= 3
              ? 'grid-cols-1 sm:grid-cols-3'
              : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
          )}
        >
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`${basePath}/category/${slugify(cat.name)}`}
              className="group relative flex flex-col items-center justify-center rounded-2xl bg-background border border-border/50 p-5 text-center transition-all hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5"
            >
              <div className="mb-3 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-xl font-bold text-primary select-none">
                  {cat.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <p className="font-semibold text-sm leading-snug group-hover:text-primary transition-colors">
                {cat.name}
              </p>
              {cat.description && (
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{cat.description}</p>
              )}
            </Link>
          ))}
        </div>

        <div className="flex justify-center mt-6 sm:hidden">
          <Link
            href={`${basePath}/catalog`}
            className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            View All Categories <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

