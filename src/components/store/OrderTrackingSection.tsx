'use client';

import { useState } from 'react';
import { useStore } from '@/context/store-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PackageSearch, CheckCircle2, Clock, Truck, ArrowRight } from 'lucide-react';
import type { AutoStoreSection } from '@/types/auto-store-config';
import { cn } from '@/lib/utils';

function StepLine({ done }: { done?: boolean }) {
  return (
    <div className={cn('mx-auto w-px h-6 my-1', done ? 'bg-green-400' : 'bg-muted-foreground/20')} />
  );
}

function TrackingStep({
  icon,
  label,
  sublabel,
  done,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  done?: boolean;
  active?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className={cn(
        'shrink-0 h-9 w-9 rounded-full flex items-center justify-center border-2',
        done  ? 'bg-green-500/10 border-green-500'  :
        active ? 'bg-primary/10 border-primary'       :
                 'bg-muted border-muted-foreground/20'
      )}>
        {icon}
      </div>
      <div className="pt-1.5">
        <p className={cn('text-sm font-semibold', done ? 'text-green-600 dark:text-green-400' : active ? 'text-primary' : 'text-muted-foreground')}>
          {label}
        </p>
        {sublabel && <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>}
      </div>
      {active && (
        <span className="ml-auto mt-1.5 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium shrink-0">
          In Progress
        </span>
      )}
    </div>
  );
}

export function OrderTrackingSection() {
  const { store } = useStore();
  const [orderId, setOrderId] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const config = store?.storefrontConfig?.order_tracking;
  const autoSections: AutoStoreSection[] = store?.autoStoreConfig?.storefront?.sections ?? [];
  const autoTracking = autoSections.find((s) => s.section_type === 'tracking');

  const headline = config?.headline || autoTracking?.headline || 'Track Your Order';
  const description = config?.description || autoTracking?.description || 'Enter your order reference for a live status update. No account needed.';
  const placeholder = config?.input_placeholder || 'e.g. SQ-2024-00123';
  const cta = config?.cta || autoTracking?.cta || 'Track Order';

  const handleTrack = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId.trim()) return;
    setSubmitted(true);
  };

  return (
    <section id="track-order" className="py-16 md:py-20 bg-muted/30 border-t">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center max-w-4xl mx-auto">

          {/* ── Left: Form ──────────────────────────────────────────────────── */}
          <div>
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 mb-5">
              <PackageSearch className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">{headline}</h2>
            <p className="text-muted-foreground mb-6 leading-relaxed">{description}</p>

            {!submitted ? (
              <form onSubmit={handleTrack} className="space-y-3">
                <div className="relative">
                  <Input
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                    placeholder={placeholder}
                    className="h-12 text-base pr-4 rounded-xl"
                  />
                </div>
                <Button type="submit" size="lg" className="w-full h-12 rounded-xl gap-2">
                  {cta}
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <p className="text-xs text-muted-foreground text-center pt-1">
                  No account required · Contact the vendor for detailed updates
                </p>
              </form>
            ) : (
              <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Order reference</p>
                    <p className="font-mono font-bold text-base">{orderId}</p>
                  </div>
                  <button
                    onClick={() => { setSubmitted(false); setOrderId(''); }}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    New search
                  </button>
                </div>
                <div className="space-y-0">
                  <TrackingStep icon={<CheckCircle2 className="h-4 w-4 text-green-500" />} label="Order Received" sublabel="Confirmed by vendor" done />
                  <StepLine done />
                  <TrackingStep icon={<Clock className="h-4 w-4 text-primary" />} label="Being Prepared" sublabel="Your order is being processed" active />
                  <StepLine />
                  <TrackingStep icon={<Truck className="h-4 w-4 text-muted-foreground" />} label="Out for Delivery" sublabel="On its way to you" />
                </div>
              </div>
            )}
          </div>

          {/* ── Right: Visual card ──────────────────────────────────────────── */}
          <div className="hidden md:block">
            <div className="rounded-3xl border bg-card shadow-sm overflow-hidden">
              <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-6 pt-8 pb-6">
                <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-1">Real-time updates</p>
                <h3 className="text-xl font-bold">Always know where your order is</h3>
              </div>
              <div className="px-6 pb-8 space-y-5">
                {[
                  { icon: <CheckCircle2 className="h-5 w-5 text-green-500" />, title: 'Order Confirmed', desc: 'You receive instant confirmation the moment your order is placed.' },
                  { icon: <Clock className="h-5 w-5 text-primary" />, title: 'Preparation Updates', desc: 'Track your order as the vendor prepares and packages it for you.' },
                  { icon: <Truck className="h-5 w-5 text-blue-500" />, title: 'Delivery Tracking', desc: 'Get notified when your order is out for delivery and on its way.' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">{item.icon}</div>
                    <div>
                      <p className="text-sm font-semibold">{item.title}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
