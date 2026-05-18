'use client';

import { useStore } from '@/context/store-context';
import { Button } from '@/components/ui/button';
import { MessageCircle, Mail, MapPin, Phone } from 'lucide-react';
import type { AutoStoreSection } from '@/types/auto-store-config';

export function HelpSection() {
  const { store } = useStore();

  const config = store?.storefrontConfig?.help_section;
  const contact = store?.storefrontConfig?.contact_section;
  const autoSections: AutoStoreSection[] = store?.autoStoreConfig?.storefront?.sections ?? [];
  const autoHelp = autoSections.find((s) => s.section_type === 'help');
  const autoContact = store?.autoStoreConfig?.vendor_profile?.contact;

  const headline = config?.headline || autoHelp?.headline || "We're here to help";
  const description = config?.description || autoHelp?.description || "Questions about a product, order, or delivery? Our team is ready — reach out any way that's convenient for you.";

  const phone = contact?.phone || autoContact?.phone || store?.sellerPhone;
  const email = contact?.email || autoContact?.email || store?.sellerEmail;
  const location = contact?.location || store?.location || autoContact?.location;

  const whatsappUrl = phone
    ? `https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=Hi, I need help with my order.`
    : null;
  const emailUrl = email ? `mailto:${email}` : null;

  const contactCards = [
    whatsappUrl && {
      icon: <MessageCircle className="h-6 w-6 text-green-500" />,
      bg: 'bg-green-500/8 border-green-500/20',
      iconBg: 'bg-green-500/10',
      label: 'WhatsApp',
      detail: 'Fastest response',
      href: whatsappUrl,
      target: '_blank',
      cta: 'Chat Now',
      ctaClass: 'bg-green-500 hover:bg-green-600 text-white',
    },
    emailUrl && {
      icon: <Mail className="h-6 w-6 text-primary" />,
      bg: 'bg-primary/5 border-primary/15',
      iconBg: 'bg-primary/10',
      label: 'Email',
      detail: 'We reply within 24 hours',
      href: emailUrl,
      target: undefined,
      cta: 'Send Email',
      ctaClass: '',
    },
    location && {
      icon: <MapPin className="h-6 w-6 text-orange-500" />,
      bg: 'bg-orange-500/5 border-orange-500/15',
      iconBg: 'bg-orange-500/10',
      label: 'Location',
      detail: location as string,
      href: null,
      target: undefined,
      cta: null,
      ctaClass: '',
    },
  ].filter(Boolean) as NonNullable<{
    icon: JSX.Element;
    bg: string;
    iconBg: string;
    label: string;
    detail: string;
    href: string | null;
    target: string | undefined;
    cta: string | null;
    ctaClass: string;
  }>[];

  const colClass =
    contactCards.length === 1 ? 'grid-cols-1 max-w-sm' :
    contactCards.length === 2 ? 'grid-cols-1 sm:grid-cols-2 max-w-2xl' :
    'grid-cols-1 sm:grid-cols-3 max-w-4xl';

  return (
    <section id="help" className="py-16 md:py-20 bg-background border-t">
      <div className="container mx-auto px-4 md:px-6">

        {/* Section header */}
        <div className="text-center mb-12">
          <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-2">Support</p>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">{headline}</h2>
          <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed">{description}</p>
        </div>

        {/* Contact cards */}
        {contactCards.length > 0 ? (
          <div className={`grid ${colClass} gap-4 mx-auto`}>
            {contactCards.map((card) => (
              <div
                key={card.label}
                className={`rounded-2xl border ${card.bg} p-6 flex flex-col items-center text-center gap-4`}
              >
                <div className={`h-14 w-14 rounded-2xl ${card.iconBg} flex items-center justify-center`}>
                  {card.icon}
                </div>
                <div>
                  <p className="font-semibold text-base">{card.label}</p>
                  <p className="text-sm text-muted-foreground mt-1 leading-snug">{card.detail}</p>
                </div>
                {card.cta && card.href && (
                  <Button
                    asChild
                    size="sm"
                    className={`rounded-xl px-6 w-full ${card.ctaClass}`}
                    variant={card.ctaClass ? 'default' : 'outline'}
                  >
                    <a href={card.href} target={card.target} rel={card.target ? 'noopener noreferrer' : undefined}>
                      {card.cta}
                    </a>
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* Fallback: no contact info yet */
          <div className="text-center">
            <Button size="lg" className="rounded-xl px-10 gap-2">
              <MessageCircle className="h-5 w-5" />
              Contact Us
            </Button>
          </div>
        )}

      </div>
    </section>
  );
}
