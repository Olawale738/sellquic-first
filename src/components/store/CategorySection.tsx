'use client';

import { useStore } from '@/context/store-context';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { getStoreBasePath } from '@/lib/url';
import { cn, slugify } from '@/lib/utils';

const CATEGORY_PHOTO: Record<string, string> = {
  // Fashion / Clothing
  dresses: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=400&h=300&fit=crop&auto=format&q=80',
  tops: 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=400&h=300&fit=crop&auto=format&q=80',
  'tops & blouses': 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=400&h=300&fit=crop&auto=format&q=80',
  shoes: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=300&fit=crop&auto=format&q=80',
  bags: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400&h=300&fit=crop&auto=format&q=80',
  accessories: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=300&fit=crop&auto=format&q=80',
  jeans: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=400&h=300&fit=crop&auto=format&q=80',
  jackets: 'https://images.unsplash.com/photo-1551698617-ebb0b3e6b2e0?w=400&h=300&fit=crop&auto=format&q=80',
  // Food
  meals: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop&auto=format&q=80',
  snacks: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&h=300&fit=crop&auto=format&q=80',
  drinks: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=400&h=300&fit=crop&auto=format&q=80',
  catering: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&h=300&fit=crop&auto=format&q=80',
  'main course': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop&auto=format&q=80',
  desserts: 'https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?w=400&h=300&fit=crop&auto=format&q=80',
  breakfast: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=400&h=300&fit=crop&auto=format&q=80',
  pizza: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=300&fit=crop&auto=format&q=80',
  sides: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop&auto=format&q=80',
  // Beauty
  skincare: 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=400&h=300&fit=crop&auto=format&q=80',
  makeup: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=400&h=300&fit=crop&auto=format&q=80',
  haircare: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&h=300&fit=crop&auto=format&q=80',
  fragrance: 'https://images.unsplash.com/photo-1541643600914-78b084683702?w=400&h=300&fit=crop&auto=format&q=80',
  moisturizers: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=400&h=300&fit=crop&auto=format&q=80',
  serums: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=400&h=300&fit=crop&auto=format&q=80',
  // Electronics
  phones: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&h=300&fit=crop&auto=format&q=80',
  gadgets: 'https://images.unsplash.com/photo-1593640408182-31c228f02c25?w=400&h=300&fit=crop&auto=format&q=80',
  laptops: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&h=300&fit=crop&auto=format&q=80',
  headphones: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=300&fit=crop&auto=format&q=80',
  'smart home': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop&auto=format&q=80',
  repairs: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=300&fit=crop&auto=format&q=80',
  // Furniture
  'living room': 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&h=300&fit=crop&auto=format&q=80',
  bedroom: 'https://images.unsplash.com/photo-1540518614846-7eded433c457?w=400&h=300&fit=crop&auto=format&q=80',
  office: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=400&h=300&fit=crop&auto=format&q=80',
  decor: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&h=300&fit=crop&auto=format&q=80',
  kitchen: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=300&fit=crop&auto=format&q=80',
  // Groceries
  'fresh food': 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&h=300&fit=crop&auto=format&q=80',
  'fresh produce': 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&h=300&fit=crop&auto=format&q=80',
  pantry: 'https://images.unsplash.com/photo-1498579687545-d5a4fffb0a9e?w=400&h=300&fit=crop&auto=format&q=80',
  vegetables: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&h=300&fit=crop&auto=format&q=80',
  fruits: 'https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?w=400&h=300&fit=crop&auto=format&q=80',
  household: 'https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?w=400&h=300&fit=crop&auto=format&q=80',
  // Services
  packages: 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=400&h=300&fit=crop&auto=format&q=80',
  bookings: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=400&h=300&fit=crop&auto=format&q=80',
  consultations: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&h=300&fit=crop&auto=format&q=80',
  // General
  'new arrivals': 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=300&fit=crop&auto=format&q=80',
  'best sellers': 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&h=300&fit=crop&auto=format&q=80',
  featured: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=400&h=300&fit=crop&auto=format&q=80',
  sale: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=400&h=300&fit=crop&auto=format&q=80',
};

function photoForCategory(name: string): string | null {
  return CATEGORY_PHOTO[name.toLowerCase().trim()] ?? null;
}

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
            const photo = photoForCategory(cat.name);

            return (
              <Link
                key={cat.id}
                href={`${basePath}/category/${slugify(cat.name)}`}
                className="group relative overflow-hidden rounded-2xl aspect-[4/3] flex flex-col justify-end p-4 transition-all hover:-translate-y-1 hover:shadow-xl"
              >
                {photo ? (
                  <>
                    <Image
                      src={photo}
                      alt={cat.name}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      sizes="(max-width: 640px) 50vw, 25vw"
                      unoptimized
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />
                  </>
                ) : (
                  <>
                    <div className={cn('absolute inset-0 bg-gradient-to-br', gradient)} />
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -top-4 -right-4 text-[8rem] font-black text-white/10 select-none leading-none"
                    >
                      {letter}
                    </span>
                  </>
                )}

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-2xl" />

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
