'use client';

import { useState } from 'react';
import { useStore } from '@/context/store-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  PackageSearch, MessageCircle, Mail, ArrowRight,
  CheckCircle2, Clock, Truck,
} from 'lucide-react';
import type { AutoStoreSection } from '@/types/auto-store-config';
import { cn } from '@/lib/utils';

// ─── Tracking step ────────────────────────────────────────────────────────────

function Step({
  icon, label, sublabel, done, active,
}: {
  icon: React.ReactNode; label: string; sublabel?: string; done?: boolean; active?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className={cn(
        'shrink-0 h-8 w-8 rounded-full border-2 flex items-center justify-center',
        done   ? 'bg-green-500/15 border-green-500' :
        active ? 'bg-white/15     border-white/60'  :
                 'bg-white/5      border-white/20',
      )}>
        {icon}
      </div>
      <div className="pt-0.5 flex-1">
        <p className={cn('text-sm font-semibold',
          done ? 'text-green-400' : active ? 'text-white' : 'text-white/40'
        )}>
          {label}
        </p>
        {sublabel && <p className="text-xs text-white/40 mt-0.5">{sublabel}</p>}
      </div>
      {active && (
        <span className="shrink-0 mt-0.5 text-[10px] font-semibold bg-white/15 text-white/80 px-2 py-0.5 rounded-full uppercase tracking-wide">
          In Progress
        </span>
      )}
    </div>
  );
}

function StepDivider({ done }: { done?: boolean }) {
  return <div className={cn('ml-4 w-px h-5 my-0.5', done ? 'bg-green-500/40' : 'bg-white/10')} />;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function StoreContactBand() {
  const { store } = useStore();
  const [orderId, setOrderId]     = useState('');
  const [submitted, setSubmitted] = useState(false);

  // ── Copy from config ──────────────────────────────────────────────────────
  const config      = store?.storefrontConfig?.order_tracking;
  const autoSections: AutoStoreSection[] = store?.autoStoreConfig?.storefront?.sections ?? [];
  const autoTracking = autoSections.find((s) => s.section_type === 'tracking');

  const trackHeadline   = config?.headline         || autoTracking?.headline         || 'Track Your Order';
  const trackDesc       = config?.description      || autoTracking?.description      || 'Enter your order reference for a live status update. No account needed.';
  const trackPlaceholder = config?.input_placeholder                                 || 'e.g. SQ-2024-00123';
  const trackCta        = config?.cta              || autoTracking?.cta              || 'Track Order';

  const helpConfig      = store?.storefrontConfig?.help_section;
  const autoHelp        = autoSections.find((s) => s.section_type === 'help');
  const contact         = store?.storefrontConfig?.contact_section;
  const autoContact     = store?.autoStoreConfig?.vendor_profile?.contact;

  const helpHeadline    = helpConfig?.headline || autoHelp?.headline || "We're here to help";
  const helpDesc        = helpConfig?.description || autoHelp?.description ||
    "Questions about a product, order, or delivery? Our team is ready — reach out any way that's convenient for you.";

  const phone     = contact?.phone  || autoContact?.phone  || store?.sellerPhone;
  const email     = contact?.email  || autoContact?.email  || store?.sellerEmail;
  const whatsappUrl = phone
    ? `https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=Hi, I need help with my order.`
    : null;

  const handleTrack = (e: React.FormEvent) => {
    e.preventDefault();
    if (orderId.trim()) setSubmitted(true);
  };

  return (
    <section id="track-order" className="bg-slate-900 dark:bg-slate-950 text-white">
      <div className="container mx-auto px-4 md:px-6 py-16 md:py-20">

        {/* ── Two-column grid ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">

          {/* ── Left: Order Tracking ─────────────────────────────────────── */}
          <div>
            <div className="inline-flex h-11 w-11 rounded-xl bg-white/10 items-center justify-center mb-5">
              <PackageSearch className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-2">{trackHeadline}</h2>
            <p className="text-white/55 mb-7 leading-relaxed">{trackDesc}</p>

            {!submitted ? (
              <div className="space-y-3">
                <form onSubmit={handleTrack} className="flex gap-2">
                  <Input
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                    placeholder={trackPlaceholder}
                    className="flex-1 h-12 rounded-xl bg-white/10 border-white/15 text-white placeholder:text-white/35 focus-visible:ring-white/30 focus-visible:border-white/40"
                  />
                  <Button
                    type="submit"
                    size="lg"
                    className="h-12 rounded-xl px-6 bg-white text-slate-900 hover:bg-white/90 font-semibold shrink-0 gap-1.5"
                  >
                    {trackCta}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </form>
                <p className="text-xs text-white/35">
                  No account required · Contact the vendor for detailed updates
                </p>
              </div>
            ) : (
              <div className="rounded-2xl bg-white/8 border border-white/12 p-5 space-y-0">
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
                  <div>
                    <p className="text-[11px] font-semibold text-white/40 uppercase tracking-widest">Order reference</p>
                    <p className="font-mono font-bold text-base mt-0.5">{orderId}</p>
                  </div>
                  <button
                    onClick={() => { setSubmitted(false); setOrderId(''); }}
                    className="text-xs text-white/50 hover:text-white/80 transition-colors font-medium"
                  >
                    New search
                  </button>
                </div>
                <div className="space-y-0">
                  <Step icon={<CheckCircle2 className="h-4 w-4 text-green-400" />} label="Order Received"   sublabel="Confirmed by vendor"             done />
                  <StepDivider done />
                  <Step icon={<Clock        className="h-4 w-4 text-white/70" />}  label="Being Prepared"   sublabel="Your order is being processed"    active />
                  <StepDivider />
                  <Step icon={<Truck        className="h-4 w-4 text-white/25" />}  label="Out for Delivery" sublabel="On its way to you" />
                </div>
              </div>
            )}
          </div>

          {/* ── Right: Support ───────────────────────────────────────────── */}
          <div>
            <div className="inline-flex h-11 w-11 rounded-xl bg-white/10 items-center justify-center mb-5">
              <MessageCircle className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-2" id="help">{helpHeadline}</h2>
            <p className="text-white/55 mb-7 leading-relaxed">{helpDesc}</p>

            <div className="space-y-3">
              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 rounded-2xl bg-white/8 hover:bg-white/12 border border-white/10 hover:border-white/20 p-4 transition-all group"
                >
                  <div className="h-11 w-11 rounded-xl bg-green-500/20 flex items-center justify-center shrink-0">
                    <MessageCircle className="h-5 w-5 text-green-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">WhatsApp</p>
                    <p className="text-xs text-white/45 mt-0.5">Fastest response</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-white/30 group-hover:text-white/60 group-hover:translate-x-0.5 transition-all shrink-0" />
                </a>
              )}

              {email && (
                <a
                  href={`mailto:${email}`}
                  className="flex items-center gap-4 rounded-2xl bg-white/8 hover:bg-white/12 border border-white/10 hover:border-white/20 p-4 transition-all group"
                >
                  <div className="h-11 w-11 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
                    <Mail className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">Email</p>
                    <p className="text-xs text-white/45 mt-0.5">We reply within 24 hours</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-white/30 group-hover:text-white/60 group-hover:translate-x-0.5 transition-all shrink-0" />
                </a>
              )}

              {!whatsappUrl && !email && (
                <div className="rounded-2xl bg-white/8 border border-white/10 p-5 text-center text-white/40 text-sm">
                  Contact details will appear here once the vendor adds them.
                </div>
              )}
            </div>
          </div>

        </div>

        {/* ── Divider between band and footer-style strip ──────────────── */}
        <div className="mt-14 pt-8 border-t border-white/8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/30">
          <p>Use the form above to track any order — no login required.</p>
          <p>Response times may vary · All support is vendor-managed</p>
        </div>

      </div>
    </section>
  );
}
