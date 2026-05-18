'use client';

import { useState } from 'react';
import { useStore } from '@/context/store-context';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  HelpCircle, PackageSearch, MessageCircle, Mail,
  ArrowRight, CheckCircle2, Clock, Truck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AutoStoreSection } from '@/types/auto-store-config';

// ─── Tracking step ─────────────────────────────────────────────────────────────

function Step({
  icon, label, done, active,
}: { icon: React.ReactNode; label: string; done?: boolean; active?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={cn(
        'shrink-0 h-7 w-7 rounded-full border-2 flex items-center justify-center',
        done   ? 'bg-green-500/15 border-green-500' :
        active ? 'bg-primary/15   border-primary'   :
                 'bg-muted        border-muted-foreground/20',
      )}>
        {icon}
      </div>
      <span className={cn('text-xs font-medium',
        done ? 'text-green-600 dark:text-green-400' : active ? 'text-primary' : 'text-muted-foreground/50'
      )}>
        {label}
      </span>
      {active && (
        <span className="ml-auto text-[10px] font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
          Live
        </span>
      )}
    </div>
  );
}

// ─── Main dropdown ─────────────────────────────────────────────────────────────

export function StoreSupportDropdown() {
  const { store } = useStore();
  const [open, setOpen]           = useState(false);
  const [orderId, setOrderId]     = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!store) return null;

  // ── Config resolution ──────────────────────────────────────────────────────
  const config        = store?.storefrontConfig?.order_tracking;
  const autoSections: AutoStoreSection[] = store?.autoStoreConfig?.storefront?.sections ?? [];
  const autoTracking  = autoSections.find((s) => s.section_type === 'tracking');
  const autoContact   = store?.autoStoreConfig?.vendor_profile?.contact;
  const contact       = store?.storefrontConfig?.contact_section;

  const placeholder   = config?.input_placeholder || 'e.g. SQ-2024-00123';
  const phone         = contact?.phone || autoContact?.phone || store?.sellerPhone;
  const email         = contact?.email || autoContact?.email || store?.sellerEmail;

  const whatsappUrl   = phone
    ? `https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=Hi, I need help with my order.`
    : null;

  const handleTrack = (e: React.FormEvent) => {
    e.preventDefault();
    if (orderId.trim()) setSubmitted(true);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>

      {/* ── Trigger ─────────────────────────────────────────────────────── */}
      <PopoverTrigger asChild>
        <button className={cn(
          'flex items-center gap-1.5 text-sm font-medium transition-colors rounded-lg px-2.5 py-1.5',
          open
            ? 'bg-primary text-primary-foreground'
            : 'text-foreground/70 hover:text-primary hover:bg-muted',
        )}>
          <HelpCircle className="h-4 w-4" />
          <span>Help</span>
        </button>
      </PopoverTrigger>

      {/* ── Panel ───────────────────────────────────────────────────────── */}
      <PopoverContent
        align="end"
        sideOffset={10}
        className="w-[340px] p-0 rounded-2xl shadow-xl border overflow-hidden"
      >

        {/* Track Order ─────────────────────────────────────────────────── */}
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <PackageSearch className="h-4 w-4 text-primary" />
            </div>
            <p className="font-semibold text-sm">Track Your Order</p>
          </div>

          {!submitted ? (
            <>
              <form onSubmit={handleTrack} className="flex gap-2">
                <Input
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  placeholder={placeholder}
                  className="h-9 text-sm flex-1 rounded-xl"
                />
                <Button type="submit" size="sm" className="h-9 px-4 rounded-xl shrink-0 gap-1">
                  Track
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </form>
              <p className="text-[11px] text-muted-foreground mt-2">
                No account required · Contact vendor for details
              </p>
            </>
          ) : (
            <div className="rounded-xl border bg-muted/40 p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="font-mono text-xs font-bold">{orderId}</p>
                <button
                  onClick={() => { setSubmitted(false); setOrderId(''); }}
                  className="text-[11px] text-primary hover:underline"
                >
                  New search
                </button>
              </div>
              <div className="space-y-2">
                <Step icon={<CheckCircle2 className="h-3.5 w-3.5 text-green-500" />} label="Order Received" done />
                <Step icon={<Clock className="h-3.5 w-3.5 text-primary" />}         label="Being Prepared" active />
                <Step icon={<Truck className="h-3.5 w-3.5 text-muted-foreground/40" />} label="Out for Delivery" />
              </div>
            </div>
          )}
        </div>

        {/* Divider ─────────────────────────────────────────────────────── */}
        <div className="h-px bg-border mx-5" />

        {/* Contact options ─────────────────────────────────────────────── */}
        <div className="px-5 py-4 space-y-2">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            Get in touch
          </p>

          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl hover:bg-muted px-3 py-2.5 transition-colors group"
            >
              <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                <MessageCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">WhatsApp</p>
                <p className="text-[11px] text-muted-foreground">Fastest response</p>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all" />
            </a>
          )}

          {email && (
            <a
              href={`mailto:${email}`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl hover:bg-muted px-3 py-2.5 transition-colors group"
            >
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Email</p>
                <p className="text-[11px] text-muted-foreground">Reply within 24 hours</p>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all" />
            </a>
          )}

          {!whatsappUrl && !email && (
            <p className="text-xs text-muted-foreground px-3 py-2">
              No contact info available yet.
            </p>
          )}
        </div>

        {/* Footer note ──────────────────────────────────────────────────── */}
        <div className="px-5 py-3 border-t bg-muted/30">
          <p className="text-[10px] text-muted-foreground/60 text-center leading-relaxed">
            All support is vendor-managed · Response times may vary
          </p>
        </div>

      </PopoverContent>
    </Popover>
  );
}
