'use client';

import { useStore } from '@/context/store-context';
import Image from 'next/image';
import { cn } from '@/lib/utils';

const ABOUT_TAGLINES: Record<string, string> = {
  fashion:     'We curate the finest fashion pieces to help you express your unique style. From everyday essentials to statement pieces, every item is carefully selected for quality, style, and value.',
  clothing:    'We believe great style is for everyone. Our collection spans casual wear to formal attire, all curated with quality and affordability in mind.',
  food:        "We're passionate about bringing you delicious, high-quality food made with love and the freshest ingredients. Every meal is prepared with care to satisfy your cravings and delight your taste buds.",
  restaurant:  'Our kitchen is our passion. We source the finest ingredients and prepare every dish with dedication to flavor, freshness, and authentic taste.',
  beauty:      'We believe everyone deserves to feel beautiful. Our hand-picked beauty products are tested, authentic, and carefully sourced to support your unique beauty routine.',
  skincare:    'Your skin deserves the best. We stock only dermatologist-recommended, ingredient-conscious skincare products that deliver real results.',
  electronics: 'We bring you the latest and most reliable technology at competitive prices. Every product we sell is genuine, warranted, and backed by our expert support team.',
  technology:  'Tech should be accessible to everyone. We offer a wide range of authentic gadgets and devices to keep you connected, productive, and entertained.',
  furniture:   'Your home is your sanctuary. We source beautifully crafted furniture that blends function with style — because you deserve a space that feels like you.',
  home:        'Transform your living space with our thoughtfully curated home collection. Quality pieces that make every corner of your home shine.',
  groceries:   "From farm to your table — we're committed to supplying you with the freshest, highest-quality groceries at great prices.",
  grocery:     'We make grocery shopping effortless. Fresh produce, pantry staples, and household essentials delivered right to your door.',
  services:    'Our experienced team is dedicated to delivering professional services that exceed your expectations. Whatever you need, we make it happen.',
  health:      'Your wellness is our priority. We offer a curated selection of health and wellness products to support a balanced, vibrant lifestyle.',
  sports:      'Fuel your passion for sport and fitness. We stock premium sporting gear, apparel, and accessories to help you perform at your best.',
};

function getAboutDescription(name?: string, category?: string, tagline?: string): string {
  if (tagline) return tagline;
  const storeName = name || 'our store';
  const cat = category?.toLowerCase() || '';
  for (const [key, text] of Object.entries(ABOUT_TAGLINES)) {
    if (cat.includes(key)) return text;
  }
  return `Welcome to ${storeName}! We're dedicated to providing you with the best products and exceptional service. Every item in our store is carefully curated to meet the highest standards of quality and value.`;
}

export function AboutSection() {
  const { store } = useStore();

  if (!store) return null;

  const aboutConfig = store?.storefrontConfig?.about_section;
  const legacyAbout = store?.aboutUs;
  const isAboutActive = store?.isAboutUsActive;

  const headline =
    aboutConfig?.headline ||
    (isAboutActive ? `About ${store.name}` : null) ||
    `About ${store.name}`;

  const description =
    aboutConfig?.description ||
    (isAboutActive ? legacyAbout : null) ||
    getAboutDescription(store.name, store.category, store.tagline);

  return (
    <section className="py-12 md:py-16 bg-background border-t">
      <div className="container mx-auto px-4 md:px-6">
        <div
          className={cn(
            'grid gap-10 items-center',
            store.logoUrl ? 'md:grid-cols-2' : 'max-w-2xl mx-auto text-center'
          )}
        >
          <div>
            <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-2">Our Story</p>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">{headline}</h2>
            <div
              className="text-muted-foreground leading-relaxed prose max-w-none"
              dangerouslySetInnerHTML={{ __html: description.replace(/\n/g, '<br />') }}
            />
          </div>

          {store.logoUrl && (
            <div className="flex justify-center md:justify-end">
              <div className="relative h-48 w-48 md:h-64 md:w-64 rounded-3xl overflow-hidden bg-secondary border shadow-sm">
                <Image
                  src={store.logoUrl}
                  alt={store.name}
                  fill
                  className="object-contain p-6"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
