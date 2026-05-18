'use client';

import { useStore } from '@/context/store-context';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { getStoreBasePath } from '@/lib/url';
import { Button } from '@/components/ui/button';

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
  const { store, isDemo } = useStore();

  if (!store) return null;

  const basePath = isDemo ? `/demo/${store.slug}` : getStoreBasePath(store.subdomain);

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
    <section className="py-16 md:py-24 bg-background border-t overflow-hidden">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid md:grid-cols-2 gap-12 lg:gap-20 items-center">

          {/* ── Left: visual card ── */}
          <div className="relative order-2 md:order-1">
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-primary/10 via-primary/5 to-secondary aspect-[4/3] flex items-center justify-center">
              {/* Background pattern */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_70%,hsl(var(--primary)/0.15),transparent_60%)]" />
              <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-primary/5 -translate-y-1/3 translate-x-1/3" />
              <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-primary/8 translate-y-1/3 -translate-x-1/3" />

              {store.logoUrl ? (
                <div className="relative z-10 h-36 w-36 md:h-44 md:w-44 rounded-2xl bg-background shadow-xl flex items-center justify-center p-6 ring-1 ring-border">
                  <Image
                    src={store.logoUrl}
                    alt={store.name}
                    fill
                    className="object-contain p-6"
                  />
                </div>
              ) : (
                <div className="relative z-10 flex flex-col items-center gap-3 text-center p-8">
                  <div className="h-20 w-20 rounded-2xl bg-primary/15 flex items-center justify-center ring-8 ring-primary/5">
                    <span className="text-4xl font-black text-primary">
                      {store.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <p className="font-bold text-xl text-foreground">{store.name}</p>
                  {store.category && (
                    <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-3 py-1 rounded-full bg-background/80 border">
                      {store.category}
                    </span>
                  )}
                </div>
              )}

              {/* Floating trust badge */}
              <div className="absolute bottom-4 left-4 right-4 z-10">
                <div className="flex items-center gap-2 rounded-2xl bg-background/90 backdrop-blur-sm border shadow-sm px-4 py-2.5">
                  <div className="flex -space-x-1.5">
                    {['bg-primary', 'bg-emerald-500', 'bg-amber-500'].map((c, i) => (
                      <div key={i} className={`h-6 w-6 rounded-full ${c} ring-2 ring-background flex items-center justify-center`}>
                        <span className="text-[9px] text-white font-bold">✓</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs font-semibold text-foreground">Verified &amp; trusted store</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Right: text ── */}
          <div className="order-1 md:order-2">
            <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">Our Story</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3 leading-tight">
              {headline}
            </h2>
            <p className="text-primary font-medium italic mb-5">{tagline}</p>
            <div
              className="text-muted-foreground leading-relaxed mb-7 text-sm md:text-base"
              dangerouslySetInnerHTML={{ __html: description.replace(/\n/g, '<br />') }}
            />

            {/* Bullet points */}
            <ul className="space-y-3 mb-8">
              {bullets.map((b, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-foreground">
                  <div className="h-5 w-5 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-3 w-3 text-primary" />
                  </div>
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            {store.isAboutUsActive && (
              <Button variant="outline" className="rounded-xl gap-2" asChild>
                <Link href={`${basePath}/about`}>
                  Read Full Story <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>

        </div>
      </div>
    </section>
  );
}
