'use client';

import { useStore } from '@/context/store-context';
import Image from 'next/image';
import { cn } from '@/lib/utils';

export function AboutSection() {
  const { store } = useStore();

  const aboutConfig = store?.storefrontConfig?.about_section;
  const legacyAbout = store?.aboutUs;
  const isAboutActive = store?.isAboutUsActive;

  // Use storefront config if available, fall back to legacy about, skip if neither
  const headline = aboutConfig?.headline || (isAboutActive ? `About ${store?.name}` : null);
  const description = aboutConfig?.description || (isAboutActive ? legacyAbout : null);

  if (!headline && !description) return null;

  return (
    <section className="py-12 md:py-16 bg-background border-t">
      <div className="container mx-auto px-4 md:px-6">
        <div className={cn('grid gap-10 items-center', store?.logoUrl ? 'md:grid-cols-2' : 'max-w-2xl mx-auto text-center')}>
          <div>
            <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-2">Our Story</p>
            {headline && (
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">{headline}</h2>
            )}
            {description && (
              <div
                className="text-muted-foreground leading-relaxed prose max-w-none"
                dangerouslySetInnerHTML={{ __html: description.replace(/\n/g, '<br />') }}
              />
            )}
          </div>
          {store?.logoUrl && (
            <div className="flex justify-center md:justify-end">
              <div className="relative h-48 w-48 md:h-64 md:w-64 rounded-3xl overflow-hidden bg-secondary border">
                <Image
                  src={store.logoUrl}
                  alt={store.name}
                  fill
                  className="object-contain p-4"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
