'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Loader2, DollarSign } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { useRequireSuperAdmin } from '@/hooks/use-auth';

const TLD_OPTIONS = ['.com', '.org', '.biz', '.info', '.xyz', '.co', '.tv'];

// We store as strings in state for easy binding to <Input>,
// then convert to numbers before saving.
type PriceState = Record<string, string>;

export default function DomainPricingPage() {
  useRequireSuperAdmin();

  const [prices, setPrices] = useState<PriceState>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();

  useEffect(() => {
    if (!firestore) return;

    const load = async () => {
      setLoading(true);
      try {
        const snap = await getDoc(doc(firestore, 'settings', 'domains'));
        if (snap.exists()) {
          const data = snap.data() as { prices?: Record<string, number> };
          const existingPrices = data?.prices || {};

          // Convert numbers -> strings for the inputs
          const asStrings: PriceState = {};
          for (const [tld, value] of Object.entries(existingPrices)) {
            asStrings[tld] =
              typeof value === 'number' ? value.toString() : String(value ?? '');
          }
          setPrices(asStrings);
        } else {
          setPrices({});
        }
      } catch (err) {
        console.error('Failed to fetch domain settings:', err);
        toast({
          title: 'Error',
          description: 'Could not load domain pricing settings.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [firestore, toast]);

  const handlePriceChange = (tld: string, value: string) => {
    setPrices((prev) => ({ ...prev, [tld]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (!firestore) throw new Error('Firestore not available');

      // Convert to numbers; ignore empty values
      const pricesToSave: Record<string, number> = {};
      for (const [tld, value] of Object.entries(prices)) {
        const num = parseFloat(value);
        if (!isNaN(num) && num > 0) {
          pricesToSave[tld] = num;
        }
      }

      await setDoc(
        doc(firestore, 'settings', 'domains'),
        {
          prices: pricesToSave,
          updatedAt: new Date(),
        },
        { merge: true }
      );

      toast({
        title: 'Settings Updated',
        description: 'Domain prices have been saved successfully.',
      });
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e.message || 'Could not save settings.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Domain Pricing (SellQuic Domains)</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Set the <span className="font-semibold">GHS</span> price for each
            domain extension vendors can buy directly through SellQuic. This is
            used when they search and pay for a new domain from the dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {TLD_OPTIONS.map((tld) => (
              <div key={tld} className="space-y-2">
                <Label
                  htmlFor={`price-${tld}`}
                  className="flex items-center justify-between text-xs font-semibold"
                >
                  <span>{tld}</span>
                  <span className="text-[10px] text-muted-foreground">
                    per year (GHS)
                  </span>
                </Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id={`price-${tld}`}
                    type="number"
                    min={0}
                    step="0.01"
                    value={prices[tld] ?? ''}
                    onChange={(e) => handlePriceChange(tld, e.target.value)}
                    className="pl-9"
                    placeholder="e.g. 185"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="text-[11px] text-muted-foreground">
            <p>
              <strong>Note:</strong> These prices are for domains purchased
              through the SellQuic dashboard. Vendors who connect their own
              existing domain (Namecheap, GoDaddy, etc.) are not charged here.
            </p>
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {saving ? 'Saving...' : 'Save Prices'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
