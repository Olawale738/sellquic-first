'use client';

import { useStore } from '@/context/store-context';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { getStoreBasePath } from '@/lib/url';
import { cn, slugify } from '@/lib/utils';

const Q = 'w=400&h=300&fit=crop&auto=format&q=80';
const u = (id: string) => `https://images.unsplash.com/photo-${id}?${Q}`;

const CATEGORY_PHOTO: Record<string, string> = {
  // ── Fashion / Clothing ──────────────────────────────────────────────────────
  dresses:          u('1539109136881-3be0616acf4b'),
  tops:             u('1434389677669-e08b4cac3105'),
  blouses:          u('1434389677669-e08b4cac3105'),
  'tops & blouses': u('1434389677669-e08b4cac3105'),
  shirts:           u('1602810316693-3667c854239a'),
  shoes:            u('1542291026-7eec264c27ff'),
  sneakers:         u('1542291026-7eec264c27ff'),
  heels:            u('1543163521-1bf539c55dd2'),
  boots:            u('1608256246200-2c9bac8a8f7c'),
  bags:             u('1548036328-c9fa89d128fa'),
  handbags:         u('1548036328-c9fa89d128fa'),
  purses:           u('1548036328-c9fa89d128fa'),
  accessories:      u('1523275335684-37898b6baf30'),
  jewellery:        u('1515562141207-7a88fb7ce338'),
  jewelry:          u('1515562141207-7a88fb7ce338'),
  watches:          u('1523275335684-37898b6baf30'),
  belts:            u('1548036328-c9fa89d128fa'),
  hats:             u('1521369909449-676261564f5b'),
  caps:             u('1521369909449-676261564f5b'),
  jeans:            u('1542272604-787c3835535d'),
  trousers:         u('1542272604-787c3835535d'),
  pants:            u('1542272604-787c3835535d'),
  jackets:          u('1551698617-ebb0b3e6b2e0'),
  coats:            u('1551698617-ebb0b3e6b2e0'),
  hoodies:          u('1556821840-3a63f691573a'),
  sweaters:         u('1576566588071-8c6f9a6f55c0'),
  suits:            u('1507679799987-c73779587ccf'),
  sportswear:       u('1538805060514-97a9cc247e8a'),
  underwear:        u('1616161560417-8d56d6de5f69'),
  lingerie:         u('1616161560417-8d56d6de5f69'),
  swimwear:         u('1520454974749-a795428f6b8a'),
  clothing:         u('1523398002811-999ca8dec234'),
  fashion:          u('1490481651871-ab68de25d43d'),
  apparel:          u('1490481651871-ab68de25d43d'),

  // ── Food & Restaurant ───────────────────────────────────────────────────────
  meals:            u('1546069901-ba9599a7e63c'),
  'main course':    u('1546069901-ba9599a7e63c'),
  mains:            u('1546069901-ba9599a7e63c'),
  lunch:            u('1546069901-ba9599a7e63c'),
  dinner:           u('1555396273-367ea4eb4db5'),
  snacks:           u('1551024506-0bccd828d307'),
  drinks:           u('1544145945-f90425340c7e'),
  beverages:        u('1544145945-f90425340c7e'),
  smoothies:        u('1570197788417-0e82375c9371'),
  juice:            u('1570197788417-0e82375c9371'),
  coffee:           u('1509042239860-f550ce710b93'),
  tea:              u('1556742205-e0d32a35c0f0'),
  catering:         u('1414235077428-338989a2e8c0'),
  desserts:         u('1563729784474-d77dbb933a9e'),
  cakes:            u('1558636225-5e27f1b506f0'),
  pastries:         u('1509440159596-0249088772ff'),
  bread:            u('1509440159596-0249088772ff'),
  breakfast:        u('1533089860892-a7c6f0a88666'),
  brunch:           u('1533089860892-a7c6f0a88666'),
  pizza:            u('1565299624946-b28f40a0ae38'),
  burgers:          u('1568901346375-23c9450c58cd'),
  chicken:          u('1598515213692-5e8a7d9e7b1a'),
  rice:             u('1512621776951-a57141f2eefd'),
  sides:            u('1512621776951-a57141f2eefd'),
  soups:            u('1547592180-85f173d888e0'),
  salads:           u('1512621776951-a57141f2eefd'),
  vegan:            u('1512621776951-a57141f2eefd'),
  vegetarian:       u('1512621776951-a57141f2eefd'),
  seafood:          u('1565557623262-b51ff2765ca7'),
  sushi:            u('1556742205-e0d32a35c0f0'),
  food:             u('1414235077428-338989a2e8c0'),

  // ── Beauty & Cosmetics ──────────────────────────────────────────────────────
  skincare:         u('1598440947619-2c35fc9aa908'),
  'skin care':      u('1598440947619-2c35fc9aa908'),
  makeup:           u('1522335789203-aabd1fc54bc9'),
  cosmetics:        u('1522335789203-aabd1fc54bc9'),
  foundation:       u('1522335789203-aabd1fc54bc9'),
  lipstick:         u('1586495777744-4e6b0c7fd1d5'),
  'lip care':       u('1586495777744-4e6b0c7fd1d5'),
  eyeshadow:        u('1522335789203-aabd1fc54bc9'),
  'eye care':       u('1522335789203-aabd1fc54bc9'),
  haircare:         u('1522337360788-8b13dee7a37e'),
  'hair care':      u('1522337360788-8b13dee7a37e'),
  'hair products':  u('1522337360788-8b13dee7a37e'),
  shampoo:          u('1522337360788-8b13dee7a37e'),
  conditioner:      u('1522337360788-8b13dee7a37e'),
  fragrance:        u('1541643600914-78b084683702'),
  perfume:          u('1541643600914-78b084683702'),
  cologne:          u('1541643600914-78b084683702'),
  moisturizers:     u('1608248543803-ba4f8c70ae0b'),
  moisturiser:      u('1608248543803-ba4f8c70ae0b'),
  serums:           u('1608248543803-ba4f8c70ae0b'),
  serum:            u('1608248543803-ba4f8c70ae0b'),
  toners:           u('1598440947619-2c35fc9aa908'),
  sunscreen:        u('1598440947619-2c35fc9aa908'),
  spf:              u('1598440947619-2c35fc9aa908'),
  'face masks':     u('1598440947619-2c35fc9aa908'),
  'body care':      u('1608248543803-ba4f8c70ae0b'),
  nails:            u('1604654894610-df63bc536371'),
  'nail care':      u('1604654894610-df63bc536371'),
  beauty:           u('1487412947147-5cebf100ffc2'),

  // ── Electronics & Tech ──────────────────────────────────────────────────────
  phones:           u('1511707171634-5f897ff02aa9'),
  smartphones:      u('1511707171634-5f897ff02aa9'),
  mobile:           u('1511707171634-5f897ff02aa9'),
  gadgets:          u('1593640408182-31c228f02c25'),
  laptops:          u('1496181133206-80ce9b88a853'),
  computers:        u('1496181133206-80ce9b88a853'),
  tablets:          u('1544244015-0df4cec08544'),
  headphones:       u('1505740420928-5e560c06d30e'),
  earphones:        u('1505740420928-5e560c06d30e'),
  earbuds:          u('1505740420928-5e560c06d30e'),
  speakers:         u('1608043152269-b1a4e02f1b48'),
  cameras:          u('1516035069371-29a1b244cc32'),
  tvs:              u('1593784991095-a68a14d4d7d7'),
  television:       u('1593784991095-a68a14d4d7d7'),
  gaming:           u('1550745165-9bc0b252726f'),
  'smart home':     u('1558618666-fcd25c85cd64'),
  chargers:         u('1585771724684-38269d6639fd'),
  cables:           u('1585771724684-38269d6639fd'),
  repairs:          u('1516321318423-f06f85e504b3'),
  electronics:      u('1498049794561-7780e7231661'),

  // ── Furniture & Home ────────────────────────────────────────────────────────
  'living room':    u('1555041469-a586c61ea9bc'),
  'lounge':         u('1555041469-a586c61ea9bc'),
  sofas:            u('1555041469-a586c61ea9bc'),
  bedroom:          u('1540518614846-7eded433c457'),
  beds:             u('1540518614846-7eded433c457'),
  mattresses:       u('1540518614846-7eded433c457'),
  office:           u('1524758631624-e2822e304c36'),
  'home office':    u('1524758631624-e2822e304c36'),
  desks:            u('1524758631624-e2822e304c36'),
  chairs:           u('1524758631624-e2822e304c36'),
  decor:            u('1586023492125-27b2c045efd7'),
  'home decor':     u('1586023492125-27b2c045efd7'),
  kitchen:          u('1556909114-f6e7ad7d3136'),
  dining:           u('1556909114-f6e7ad7d3136'),
  lighting:         u('1558618047-f3a1b0f0cd91'),
  curtains:         u('1558618047-f3a1b0f0cd91'),
  rugs:             u('1586023492125-27b2c045efd7'),
  storage:          u('1555041469-a586c61ea9bc'),
  outdoor:          u('1558618047-f3a1b0f0cd91'),
  furniture:        u('1555041469-a586c61ea9bc'),

  // ── Groceries & Produce ─────────────────────────────────────────────────────
  'fresh food':     u('1542838132-92c53300491e'),
  'fresh produce':  u('1540420773420-3366772f4999'),
  vegetables:       u('1540420773420-3366772f4999'),
  veggies:          u('1540420773420-3366772f4999'),
  fruits:           u('1490474418585-ba9bad8fd0ea'),
  produce:          u('1542838132-92c53300491e'),
  pantry:           u('1498579687545-d5a4fffb0a9e'),
  grains:           u('1498579687545-d5a4fffb0a9e'),
  dairy:            u('1563636619-e9143da7f317'),
  meat:             u('1607623814075-d8c6e9f1eb51'),
  fish:             u('1565557623262-b51ff2765ca7'),
  eggs:             u('1563636619-e9143da7f317'),
  household:        u('1584568694244-14fbdf83bd30'),
  'cleaning products': u('1584568694244-14fbdf83bd30'),
  groceries:        u('1542838132-92c53300491e'),

  // ── Services ────────────────────────────────────────────────────────────────
  packages:         u('1554415707-6e8cfc93fe23'),
  bookings:         u('1499750310107-5fef28a66643'),
  consultations:    u('1560472354-b33ff0c44a43'),
  consulting:       u('1560472354-b33ff0c44a43'),
  training:         u('1461896836934-ffe607ba8211'),
  tutoring:         u('1522202176988-66273c5b6e3e'),
  delivery:         u('1568515387539-76c762c2bac5'),
  cleaning:         u('1584568694244-14fbdf83bd30'),
  repairs:          u('1516321318423-f06f85e504b3'),
  security:         u('1497366216548-37526070297c'),
  accounting:       u('1554224155-8d04cb21cd6c'),
  legal:            u('1494236536165-dab4d859818b'),
  logistics:        u('1568515387539-76c762c2bac5'),
  services:         u('1497366216548-37526070297c'),

  // ── General fallbacks ────────────────────────────────────────────────────────
  'new arrivals':   u('1441986300917-64674bd600d8'),
  'best sellers':   u('1556742049-0cfed4f6a45d'),
  featured:         u('1472851294608-062f824d29cc'),
  sale:             u('1607082348824-0a96f2a4b9da'),
  offers:           u('1607082348824-0a96f2a4b9da'),
  deals:            u('1607082348824-0a96f2a4b9da'),
  'special offers': u('1607082348824-0a96f2a4b9da'),
  'all products':   u('1441986300917-64674bd600d8'),
  collections:      u('1472851294608-062f824d29cc'),
};

// Per-store-category fallback photo — shown when no keyword match is found
const STORE_CATEGORY_FALLBACK: Record<string, string> = {
  fashion:     u('1490481651871-ab68de25d43d'),
  clothing:    u('1490481651871-ab68de25d43d'),
  food:        u('1414235077428-338989a2e8c0'),
  restaurant:  u('1414235077428-338989a2e8c0'),
  beauty:      u('1487412947147-5cebf100ffc2'),
  cosmetics:   u('1487412947147-5cebf100ffc2'),
  electronics: u('1498049794561-7780e7231661'),
  furniture:   u('1555041469-a586c61ea9bc'),
  home:        u('1586023492125-27b2c045efd7'),
  groceries:   u('1542838132-92c53300491e'),
  services:    u('1497366216548-37526070297c'),
};

function photoForCategory(name: string, storeCategory?: string): string {
  const key = name.toLowerCase().trim();

  // 1. Exact match
  if (CATEGORY_PHOTO[key]) return CATEGORY_PHOTO[key];

  // 2. Partial / substring match
  for (const [k, url] of Object.entries(CATEGORY_PHOTO)) {
    if (key.includes(k) || k.includes(key)) return url;
  }

  // 3. Fallback to store-level category photo
  if (storeCategory) {
    const sc = storeCategory.toLowerCase().trim();
    for (const [k, url] of Object.entries(STORE_CATEGORY_FALLBACK)) {
      if (sc.includes(k)) return url;
    }
  }

  // 4. Ultimate fallback
  return u('1441986300917-64674bd600d8');
}

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
    categories = store.categories.slice(0, 15);
  } else if (store.storefrontConfig?.categories?.length) {
    categories = (store.storefrontConfig.categories as { name: string; description?: string }[])
      .slice(0, 15)
      .map((cat, i) => ({
        id: `ai-${i}`,
        name: cat.name,
        description: cat.description,
      }));
  } else if (store.autoStoreConfig?.categories?.length) {
    categories = store.autoStoreConfig.categories
      .slice(0, 15)
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
              : categories.length <= 6
                ? 'grid-cols-2 sm:grid-cols-3'
                : categories.length <= 10
                  ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
                  : 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-5'
        )}>
          {categories.map((cat) => {
            const photo = photoForCategory(cat.name, store?.category);

            return (
              <Link
                key={cat.id}
                href={`${basePath}/category/${slugify(cat.name)}`}
                className="group relative overflow-hidden rounded-2xl aspect-[4/3] flex flex-col justify-end p-4 transition-all hover:-translate-y-1 hover:shadow-xl"
              >
                <Image
                  src={photo}
                  alt={cat.name}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  sizes="(max-width: 640px) 50vw, 25vw"
                  unoptimized
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-2xl" />

                {/* Text content */}
                <div className="relative z-10">
                  <p className="font-bold text-white text-sm sm:text-base leading-snug drop-shadow-sm">
                    {cat.name}
                  </p>
                  {cat.description && cat.description.toLowerCase() !== cat.name.toLowerCase() && (
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
