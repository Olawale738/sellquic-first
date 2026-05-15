
export type PlanId = 'starter' | 'standard' | 'growth';
export type BillingCycle = 'monthly' | 'quarterly';

export interface PlatformPricing {
  plans: Record<PlanId, {
    monthlyPrice: number;
    quarterlyPrice: number;
    aiCredits: number;
    label: string;
  }>;
  launchOffer: {
    active: boolean;
    endsAt: string;
    earlyAccessPrice: number;
    earlyAccessLabel: string;
    trialDays: number;
    earlyAccessPlanId: PlanId;
  };
  trial: {
    durationDays: number;
    active: boolean;
  };
  commissionPercentage: number;
}

export function isLaunchPeriodActive(pricing: PlatformPricing): boolean {
  if (!pricing.launchOffer?.active) return false;
  const now = new Date();
  const ends = new Date(pricing.launchOffer.endsAt);
  return now <= ends;
}

export function getEffectivePrice(
  planId: PlanId,
  cycle: BillingCycle,
  pricing: PlatformPricing
): number {
  return cycle === 'quarterly'
    ? pricing.plans[planId].quarterlyPrice
    : pricing.plans[planId].monthlyPrice;
}
