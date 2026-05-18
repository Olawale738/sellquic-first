'use client';

import { useStore } from '@/context/store-context';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { CheckCircle2 } from 'lucide-react';

const ABOUT_COPY: Record<string, { tagline: string; body: string; bullets: string[] }> = {
  fashion: {
    tagline: 'Style is a language — we help you speak it fluently.',
    body: 'We curate the finest fashion pieces to help you express your unique style. From everyday essentials to statement pieces, every item is carefully selected for quality, style, and value.',
    bullets: ['Handpicked styles for every occasion', 'Authentic products only', 'Fast nationwide delivery'],
  },
  food: {
    tagline: 'Made with love. Delivered with care.',
    body: "We're passionate about bringing you delicious, high-quality food made with the freshest ingredients. Every meal is prepared with care to satisfy your cravings and delight your taste buds.",
    bullets: ['Fresh ingredients every day', 'Hygienic preparation standards', 'Same-day delivery available'],
  },
  beauty: {
    tagline: 'Because you deserve to glow every single day.',
    body: 'We believe everyone deserves to feel beautiful. Our hand-picked beauty products are tested, authentic, and carefully sourced to support your unique beauty routine.',
    bullets: ['100% authentic products', 'Dermatologist-approved picks', 'Secure & discreet packaging'],
  },
  electronics: {
    tagline: 'Real tech. Real warranty. Real support.',
    body: 'We bring you the latest and most reliable technology at competitive prices. Every product we sell is genuine, warranted, and backed by our expert support team.',
    bullets: ['Official warranty on all items', 'Genuine products guaranteed', 'Tech support available post-purchase'],
  },
  furniture: {
    tagline: 'Your home, your sanctuary — we make it beautiful.',
    body: 'We source beautifully crafted furniture that blends function with style. Because you deserve a space that feels like you.',
    bullets: ['Premium materials & craftsmanship', 'Assembly support available', '30-day return policy'],
  },
  groceries: {
    tagline: 'From farm to your table, every day.',
    body: "We're committed to supplying you with the freshest, highest-quality groceries at great prices. From farm-fresh produce to pantry staples — we have it all.",
    bullets: ['Farm-fresh produce daily', 'Best prices guaranteed', 'Same-day delivery options'],
  },
  services: {
    tagline: 'Professional. Reliable. Built around you.',
    body: 'Our experienced team is dedicated to delivering professional services that exceed your expectations. Whatever you need, we make it happen on time.',
    bullets: ['Experienced professionals', 'Satisfaction guaranteed', 'Flexible scheduling'],
  },
};

function getAboutCopy(name: string, category?: string, tagline?: string, aboutUs?: string) {
  const cat = (category || '').toLowerCase();
  for (const [key, copy] of Object.entries(ABOUT_COPY)) {
    if (cat.includes(key)) {
      return {
        tagline: tagline || copy.tagline,
        body: aboutUs || copy.body,
        bullets: copy.bullets,
      };
    }
  }
  return {
    tagline: tagline || `Welcome to ${name}`,
    body: aboutUs || `We're dedicated to providing you with the best products and exceptional service. Every item is carefully curated to meet the highest standards of quality and value.`,
    bullets: ['Quality products guaranteed', 'Fast & secure delivery', 'Excellent customer support'],
  };
}

export function AboutSection() {
  const { store } = useStore();

  if (!store) return null;

  const aboutConfig = store?.storefrontConfig?.about_section;
  const autoAbout = store?.autoStoreConfig?.storefront?.sections?.find(
    (s: { section_type: string }) => s.section_type === 'about'
  );

  const headline =
    aboutConfig?.headline ||
    autoAbout?.headline ||
    `About ${store.name}`;

  const isAboutActive = store?.isAboutUsActive;
  const legacyAbout = store?.aboutUs;

  const { tagline, body, bullets } = getAboutCopy(
    store.name,
    store.category,
    store.tagline,
    isAboutActive ? legacyAbout : undefined,
  );

  const description = aboutConfig?.description || autoAbout?.description || body;

  return (
    <section className="py-14 md:py-20 bg-secondary/30 border-t">
      <div className="container mx-auto px-4 md:px-6">
        <div className={cn(
          'grid gap-12 items-center',
          store.logoUrl ? 'md:grid-cols-2' : 'max-w-3xl mx-auto'
        )}>

          {/* Text side */}
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">Our Story</p>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3 text-foreground">
              {headline}
            </h2>
            <p className="text-muted-foreground italic mb-5 text-base">{tagline}</p>
            <div
              className="text-muted-foreground leading-relaxed mb-6 text-sm md:text-base"
              dangerouslySetInnerHTML={{ __html: description.replace(/\n/g, '<br />') }}
            />
            {/* Bullets */}
            <ul className="space-y-2.5">
              {bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Logo / visual side */}
          {store.logoUrl && (
            <div className="flex justify-center md:justify-end">
              <div className="relative h-56 w-56 md:h-72 md:w-72 rounded-3xl overflow-hidden bg-background border shadow-lg">
                <Image
                  src={store.logoUrl}
                  alt={store.name}
                  fill
                  className="object-contain p-8"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
