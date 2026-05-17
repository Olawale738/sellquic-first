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
              <div className="mb-3 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-2xl">
                {getCategoryEmoji(cat.name)}
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

function getCategoryEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('dress') || n.includes('cloth') || n.includes('fashion') || n.includes('apparel')) return '👗';
  if (n.includes('top') || n.includes('blouse') || n.includes('shirt')) return '👕';
  if (n.includes('shoe') || n.includes('boot') || n.includes('sandal') || n.includes('footwear')) return '👟';
  if (n.includes('bag') || n.includes('purse') || n.includes('handbag')) return '👜';
  if (n.includes('accessor') || n.includes('jewel') || n.includes('watch')) return '💍';
  if (n.includes('bottom') || n.includes('pant') || n.includes('jean') || n.includes('trouser')) return '👖';
  if (n.includes('meal') || n.includes('food') || n.includes('rice') || n.includes('soup') || n.includes('main')) return '🍲';
  if (n.includes('snack') || n.includes('pastry') || n.includes('cake') || n.includes('biscuit') || n.includes('dessert')) return '🍪';
  if (n.includes('drink') || n.includes('juice') || n.includes('water') || n.includes('beverage')) return '🥤';
  if (n.includes('catering') || n.includes('event') || n.includes('side')) return '🍽️';
  if (n.includes('skin') || n.includes('cream') || n.includes('lotion') || n.includes('moisturi') || n.includes('serum')) return '✨';
  if (n.includes('hair') || n.includes('wig') || n.includes('weave')) return '💆';
  if (n.includes('makeup') || n.includes('lipstick') || n.includes('foundation')) return '💄';
  if (n.includes('fragrance') || n.includes('perfume') || n.includes('scent')) return '🌸';
  if (n.includes('phone') || n.includes('mobile') || n.includes('smartphone')) return '📱';
  if (n.includes('laptop') || n.includes('computer') || n.includes('pc')) return '💻';
  if (n.includes('gadget') || n.includes('cable') || n.includes('charger') || n.includes('smart')) return '🔌';
  if (n.includes('tv') || n.includes('screen') || n.includes('monitor')) return '📺';
  if (n.includes('living') || n.includes('sofa') || n.includes('chair') || n.includes('couch')) return '🛋️';
  if (n.includes('bed') || n.includes('bedroom') || n.includes('mattress')) return '🛏️';
  if (n.includes('office') || n.includes('desk') || n.includes('table')) return '🪑';
  if (n.includes('decor') || n.includes('rug') || n.includes('curtain') || n.includes('lamp')) return '🏡';
  if (n.includes('kitchen') || n.includes('cook') || n.includes('utensil')) return '🍳';
  if (n.includes('fresh') || n.includes('vegetable') || n.includes('fruit') || n.includes('produce')) return '🥦';
  if (n.includes('pantry') || n.includes('dry') || n.includes('grain') || n.includes('flour')) return '🫙';
  if (n.includes('household') || n.includes('cleaning') || n.includes('detergent')) return '🧹';
  if (n.includes('service') || n.includes('consult') || n.includes('booking')) return '📋';
  if (n.includes('repair') || n.includes('fix')) return '🔧';
  if (n.includes('supplement') || n.includes('vitamin') || n.includes('health')) return '💊';
  if (n.includes('fitness') || n.includes('sport') || n.includes('gym')) return '🏋️';
  if (n.includes('new arrival') || n.includes('new in')) return '🆕';
  if (n.includes('best seller') || n.includes('popular') || n.includes('trending')) return '🔥';
  if (n.includes('sale') || n.includes('discount') || n.includes('offer')) return '🏷️';
  if (n.includes('featured') || n.includes('highlight') || n.includes('pick')) return '⭐';
  if (n.includes('custom') || n.includes('request') || n.includes('bespoke')) return '🎨';
  return '🛍️';
}
