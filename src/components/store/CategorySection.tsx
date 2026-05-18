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

// Gradient palette — one per slot mod 8
const GRADIENTS = [
  'from-violet-500 to-purple-600',
  'from-blue-500 to-cyan-600',
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-amber-500',
  'from-rose-500 to-pink-600',
  'from-indigo-500 to-blue-600',
  'from-yellow-500 to-orange-500',
  'from-green-500 to-emerald-600',
];

// Deterministic gradient based on category name string
function gradientForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
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
  if (!category) return fallback.map((name, i) => ({ id: `def-${i}`, name }));
  const cat = category.toLowerCase();
  for (const [key, names] of Object.entries(DEFAULT_CATEGORIES)) {
    if (cat.includes(key)) return names.map((name, i) => ({ id: `def-${i}`, name }));
  }
  return fallback.map((name, i) => ({ id: `def-${i}`, name }));
}

export function CategorySection() {
  const { store, isDemo } = useStore();

  if (!store) return null;

  const basePath = isDemo ? `/demo/${store.slug}` : getStoreBasePath(store.subdomain);

  let categories: CategoryCard[] = [];

  if (store.categories?.length) {
    categories = store.categories.slice(0, 8);
  } else if (store.storefrontConfig?.categories?.length) {
    categories = (store.storefrontConfig.categories as { name: string; description?: string }[])
      .slice(0, 8)
      .map((cat, i) => ({
        id: `ai-${i}`,
        name: cat.name,
        description: cat.description,
      }));
  } else if (store.autoStoreConfig?.categories?.length) {
    categories = store.autoStoreConfig.categories
      .slice(0, 8)
      .map((cat: { name: string; description?: string }, i: number) => ({
        id: `auto-${i}`,
        name: cat.name,
        description: cat.description,
      }));
  } else {
    categories = resolveDefaultCategories(store.category);
  }

  if (!categories.length) return null;

  return (
    <section className="py-12 md:py-16 bg-background border-t">
      <div className="container mx-auto px-4 md:px-6">

        {/* Section header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-1">Collections</p>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Shop by Category</h2>
          </div>
          <Link
            href={`${basePath}/catalog`}
            className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-primary hover:underline shrink-0"
          >
            View All <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Category grid */}
        <div className={cn(
          'grid gap-4',
          categories.length <= 3
            ? 'grid-cols-1 sm:grid-cols-3'
            : categories.length <= 4
              ? 'grid-cols-2 sm:grid-cols-4'
              : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
        )}>
          {categories.map((cat) => {
            const gradient = gradientForName(cat.name);
            const letter = cat.name.charAt(0).toUpperCase();

            return (
              <Link
                key={cat.id}
                href={`${basePath}/category/${slugify(cat.name)}`}
                className="group relative overflow-hidden rounded-2xl aspect-[4/3] flex flex-col justify-end p-4 transition-transform hover:-translate-y-1 hover:shadow-xl"
              >
                {/* Gradient background */}
                <div className={cn('absolute inset-0 bg-gradient-to-br', gradient)} />

                {/* Large decorative letter */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute -top-4 -right-4 text-[8rem] font-black text-white/10 select-none leading-none group-hover:text-white/15 transition-colors"
                >
                  {letter}
                </span>

                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors rounded-2xl" />

                {/* Text content */}
                <div className="relative z-10">
                  <p className="font-bold text-white text-sm sm:text-base leading-snug drop-shadow-sm">
                    {cat.name}
                  </p>
                  {cat.description && (
                    <p className="mt-0.5 text-white/75 text-xs line-clamp-1 drop-shadow-sm">
                      {cat.description}
                    </p>
                  )}
                </div>

                {/* Arrow */}
                <div className="absolute top-3 right-3 h-7 w-7 rounded-full bg-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowRight className="h-3.5 w-3.5 text-white" />
                </div>
              </Link>
            );
          })}
        </div>

        {/* Mobile view all */}
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
