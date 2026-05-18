'use client';

import { useStore } from '@/context/store-context';
import { Button } from '@/components/ui/button';
import { MessageCircle, Mail, MapPin } from 'lucide-react';
import type { AutoStoreSection } from '@/types/auto-store-config';

export function HelpSection() {
  const { store } = useStore();

  const config = store?.storefrontConfig?.help_section;
  const contact = store?.storefrontConfig?.contact_section;

  // Fallback: read from autoStoreConfig sections when storefrontConfig is absent
  const autoSections: AutoStoreSection[] = store?.autoStoreConfig?.storefront?.sections ?? [];
  const autoHelp = autoSections.find((s) => s.section_type === 'help');
  const autoContact = store?.autoStoreConfig?.vendor_profile?.contact;

  const headline = config?.headline || autoHelp?.headline || "Can't find what you're looking for?";
  const description = config?.description || autoHelp?.description || "Our team is ready to help you find the perfect product or answer any question. Reach out and we'll get back to you quickly.";
  const cta = config?.cta || autoHelp?.cta || 'Contact Us';

  const phone = contact?.phone || autoContact?.phone || store?.sellerPhone;
  const email = contact?.email || autoContact?.email || store?.sellerEmail;
  const location = contact?.location || store?.location || autoContact?.location;
  const whatsappEnabled = contact?.whatsapp_enabled ?? !!phone;

  const whatsappUrl = phone
    ? `https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=Hi, I need help with my order.`
    : null;

  const emailUrl = email ? `mailto:${email}` : null;

  return (
    <section className="py-12 md:py-16 bg-primary/5 border-t">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">{headline}</h2>
          <p className="text-muted-foreground mb-8">{description}</p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-10">
            {whatsappEnabled && whatsappUrl && (
              <Button asChild size="lg" className="bg-green-500 hover:bg-green-600 text-white gap-2">
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-5 w-5" />
                  Chat on WhatsApp
                </a>
              </Button>
            )}
            {emailUrl && (
              <Button asChild variant="outline" size="lg" className="gap-2">
                <a href={emailUrl}>
                  <Mail className="h-5 w-5" />
                  {cta}
                </a>
              </Button>
            )}
            {!whatsappUrl && !emailUrl && (
              <Button size="lg" className="gap-2">
                <MessageCircle className="h-5 w-5" />
                {cta}
              </Button>
            )}
          </div>

          {(email || location) && (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-muted-foreground">
              {email && (
                <a href={`mailto:${email}`} className="flex items-center gap-2 hover:text-primary transition-colors">
                  <Mail className="h-4 w-4" />
                  {email}
                </a>
              )}
              {location && (
                <span className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 shrink-0" />
                  {location}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
