'use client';

import { useState } from 'react';
import { useStore } from '@/context/store-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PackageSearch, CheckCircle2, Clock, Truck } from 'lucide-react';
import type { AutoStoreSection } from '@/types/auto-store-config';

export function OrderTrackingSection() {
  const { store } = useStore();
  const [orderId, setOrderId] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const config = store?.storefrontConfig?.order_tracking;

  // Fallback: read from autoStoreConfig sections when storefrontConfig is absent
  const autoSections: AutoStoreSection[] = store?.autoStoreConfig?.storefront?.sections ?? [];
  const autoTracking = autoSections.find((s) => s.section_type === 'tracking');

  const headline = config?.headline || autoTracking?.headline || 'Track Your Order';
  const description = config?.description || autoTracking?.description || 'Enter your order reference to get a live status update. No account needed.';
  const placeholder = config?.input_placeholder || 'e.g. SQ-2024-00123';
  const cta = config?.cta || autoTracking?.cta || 'Track Order';

  const handleTrack = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId.trim()) return;
    setSubmitted(true);
  };

  return (
    <section id="track-order" className="py-12 md:py-16 bg-background border-t">
      <div className="container mx-auto px-4 md:px-6 max-w-2xl text-center">
        <div className="mx-auto mb-6 h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <PackageSearch className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">{headline}</h2>
        <p className="text-muted-foreground mb-8 max-w-md mx-auto">{description}</p>

        {!submitted ? (
          <form onSubmit={handleTrack} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <Input
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder={placeholder}
              className="h-12 text-base flex-1"
            />
            <Button type="submit" size="lg" className="h-12 px-8 shrink-0">
              {cta}
            </Button>
          </form>
        ) : (
          <div className="max-w-md mx-auto bg-secondary rounded-2xl p-6 text-left">
            <div className="flex items-center gap-2 mb-4">
              <span className="font-mono text-sm font-medium text-muted-foreground">Order</span>
              <span className="font-mono text-sm font-bold">{orderId}</span>
            </div>
            <div className="space-y-4">
              <TrackingStep icon={<CheckCircle2 className="h-5 w-5 text-green-500" />} label="Order Received" done />
              <TrackingStep icon={<Clock className="h-5 w-5 text-primary" />} label="Processing" active />
              <TrackingStep icon={<Truck className="h-5 w-5 text-muted-foreground" />} label="Out for Delivery" />
            </div>
            <button
              onClick={() => { setSubmitted(false); setOrderId(''); }}
              className="mt-6 text-sm text-primary hover:underline"
            >
              Track a different order
            </button>
          </div>
        )}

        <p className="mt-6 text-xs text-muted-foreground">
          No account required · Contact the vendor for detailed updates
        </p>
      </div>
    </section>
  );
}

function TrackingStep({ icon, label, done, active }: { icon: React.ReactNode; label: string; done?: boolean; active?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="shrink-0">{icon}</div>
      <span className={done ? 'font-medium' : active ? 'font-medium text-primary' : 'text-muted-foreground'}>
        {label}
      </span>
      {active && (
        <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
          In Progress
        </span>
      )}
    </div>
  );
}
