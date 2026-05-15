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
import { Loader2, Percent } from 'lucide-react';
import { Label } from '@/components/ui/label';

type PlanKey = 'starter' | 'standard' | 'growth';

type PlanPricingState = Record<
  PlanKey,
  {
    label: string;
    monthlyPrice: string;
    quarterlyPrice: string;
    aiCredits: string;
  }
>;

const defaultPlans: PlanPricingState = {
  starter: {
    label: 'Starter',
    monthlyPrice: '35',
    quarterlyPrice: '105',
    aiCredits: '0',
  },
  standard: {
    label: 'Standard',
    monthlyPrice: '70',
    quarterlyPrice: '210',
    aiCredits: '0',
  },
  growth: {
    label: 'Growth',
    monthlyPrice: '200',
    quarterlyPrice: '600',
    aiCredits: '2000',
  },
};

export default function PlatformSettings() {
  const [rate, setRate] = useState('5');
  const [plans, setPlans] = useState<PlanPricingState>(defaultPlans);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const firestore = useFirestore();
  const { toast } = useToast();

  useEffect(() => {
    if (!firestore) return;

    setLoading(true);

    getDoc(doc(firestore, 'settings', 'platform'))
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data();

          setRate(data.commissionPercentage?.toString() || '5');

          setPlans({
            starter: {
              label: data.plans?.starter?.label || 'Starter',
              monthlyPrice:
                data.plans?.starter?.monthlyPrice?.toString() || '35',
              quarterlyPrice:
                data.plans?.starter?.quarterlyPrice?.toString() || '105',
              aiCredits: data.plans?.starter?.aiCredits?.toString() || '0',
            },
            standard: {
              label: data.plans?.standard?.label || 'Standard',
              monthlyPrice:
                data.plans?.standard?.monthlyPrice?.toString() || '70',
              quarterlyPrice:
                data.plans?.standard?.quarterlyPrice?.toString() || '210',
              aiCredits: data.plans?.standard?.aiCredits?.toString() || '0',
            },
            growth: {
              label: data.plans?.growth?.label || 'Growth',
              monthlyPrice:
                data.plans?.growth?.monthlyPrice?.toString() || '200',
              quarterlyPrice:
                data.plans?.growth?.quarterlyPrice?.toString() || '600',
              aiCredits: data.plans?.growth?.aiCredits?.toString() || '2000',
            },
          });
        }

        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch settings:', err);
        setLoading(false);
      });
  }, [firestore]);

  const updatePlanField = (
    planId: PlanKey,
    field: keyof PlanPricingState[PlanKey],
    value: string
  ) => {
    setPlans((prev) => ({
      ...prev,
      [planId]: {
        ...prev[planId],
        [field]: value,
      },
    }));
  };

  const parseMoney = (value: string, fieldName: string) => {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) {
      throw new Error(`${fieldName} must be a valid number.`);
    }
    return num;
  };

  const parseCredits = (value: string, fieldName: string) => {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0 || !Number.isInteger(num)) {
      throw new Error(`${fieldName} must be a whole number.`);
    }
    return num;
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      if (!firestore) throw new Error('Firestore not available');

      const numRate = parseFloat(rate);
      if (isNaN(numRate) || numRate < 0 || numRate > 100) {
        throw new Error('Percentage must be between 0 and 100.');
      }

      const cleanPlans = {
        starter: {
          label: plans.starter.label || 'Starter',
          monthlyPrice: parseMoney(
            plans.starter.monthlyPrice,
            'Starter monthly price'
          ),
          quarterlyPrice: parseMoney(
            plans.starter.quarterlyPrice,
            'Starter quarterly price'
          ),
          aiCredits: parseCredits(
            plans.starter.aiCredits,
            'Starter AI credits'
          ),
        },
        standard: {
          label: plans.standard.label || 'Standard',
          monthlyPrice: parseMoney(
            plans.standard.monthlyPrice,
            'Standard monthly price'
          ),
          quarterlyPrice: parseMoney(
            plans.standard.quarterlyPrice,
            'Standard quarterly price'
          ),
          aiCredits: parseCredits(
            plans.standard.aiCredits,
            'Standard AI credits'
          ),
        },
        growth: {
          label: plans.growth.label || 'Growth',
          monthlyPrice: parseMoney(
            plans.growth.monthlyPrice,
            'Growth monthly price'
          ),
          quarterlyPrice: parseMoney(
            plans.growth.quarterlyPrice,
            'Growth quarterly price'
          ),
          aiCredits: parseCredits(
            plans.growth.aiCredits,
            'Growth AI credits'
          ),
        },
      };

      await setDoc(
        doc(firestore, 'settings', 'platform'),
        {
          commissionPercentage: numRate,
          plans: cleanPlans,
          updatedAt: new Date(),
        },
        { merge: true }
      );

      toast({
        title: 'Settings Updated!',
        description: 'Platform commission and pricing plans have been saved.',
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
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Platform Settings</CardTitle>
          <CardDescription>
            Manage global settings for the entire platform.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="commission-rate">Platform Commission (%)</Label>
            <div className="relative max-w-xs">
              <Input
                id="commission-rate"
                type="number"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className="pl-9"
                placeholder="e.g., 5"
              />
              <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">
              This percentage is deducted from vendor sales when using automated payouts.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-4xl">
        <CardHeader>
          <CardTitle>Subscription Pricing</CardTitle>
          <CardDescription>
            These prices are used by the subscription page and Paystack initialization.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {(['starter', 'standard', 'growth'] as PlanKey[]).map((planId) => (
            <div
              key={planId}
              className="grid grid-cols-1 md:grid-cols-4 gap-4 rounded-2xl border p-4"
            >
              <div className="space-y-2">
                <Label>{plans[planId].label}</Label>
                <Input
                  value={plans[planId].label}
                  onChange={(e) =>
                    updatePlanField(planId, 'label', e.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Monthly Price (GHS)</Label>
                <Input
                  type="number"
                  value={plans[planId].monthlyPrice}
                  onChange={(e) =>
                    updatePlanField(planId, 'monthlyPrice', e.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Quarterly Price (GHS)</Label>
                <Input
                  type="number"
                  value={plans[planId].quarterlyPrice}
                  onChange={(e) =>
                    updatePlanField(planId, 'quarterlyPrice', e.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Monthly AI Credits</Label>
                <Input
                  type="number"
                  value={plans[planId].aiCredits}
                  onChange={(e) =>
                    updatePlanField(planId, 'aiCredits', e.target.value)
                  }
                />
              </div>
            </div>
          ))}

          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}