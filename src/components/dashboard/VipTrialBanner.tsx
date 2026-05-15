'use client';

import React from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Sparkles, Clock, AlertTriangle } from 'lucide-react';
import { differenceInDays, isPast } from 'date-fns';
import Link from 'next/link';

export function VipTrialBanner() {
  const { user } = useAuth();
  
  if (!user) return null;

  const promo = (user as any).promoAccess;
  const planId = (user as any).subscription?.planId;

  // 1. If they don't have a promo pass, don't show the banner
  if (!promo) return null;

  // 2. Check the status of the pass
  const isRevoked = !!promo.revokedAt;
  const endsAt = new Date(promo.endsAt);
  const hasExpired = isPast(endsAt);

  // 3. If they are already paying for a premium plan, they don't need the banner urgency
  const paidPlans = ['growth', 'business', 'enterprise', 'pro', 'premium'];
  if (paidPlans.includes(planId) && !isRevoked && !hasExpired) {
    return null; 
  }

  // SCENARIO A: Trial is active and counting down
  if (!isRevoked && !hasExpired) {
    const daysLeft = differenceInDays(endsAt, new Date());
    return (
      <Alert className="mb-6 bg-gradient-to-r from-purple-50 to-fuchsia-50 border-purple-200 shadow-sm">
        <Sparkles className="h-5 w-5 text-purple-600" />
        <AlertTitle className="text-purple-800 font-bold text-lg flex items-center gap-2">
          VIP AI Trial Active!
          <span className="bg-purple-600 text-white text-xs px-2 py-1 rounded-full font-bold animate-pulse">
            <Clock className="inline w-3 h-3 mr-1 mb-[2px]" />
            {daysLeft} Days Left
          </span>
        </AlertTitle>
        <AlertDescription className="text-purple-700 mt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p>
            You have unlimited premium AI access. When your trial ends, the AI will pause automatically. Upgrade now to keep it running smoothly!
          </p>
          <Button asChild size="sm" className="bg-purple-600 hover:bg-purple-700 whitespace-nowrap">
            <Link href="/dashboard/subscription">Upgrade Plan</Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // SCENARIO B: Trial Expired (and they haven't upgraded)
  if (hasExpired || isRevoked) {
    return (
      <Alert variant="destructive" className="mb-6 bg-red-50 border-red-200">
        <AlertTriangle className="h-5 w-5 text-red-600" />
        <AlertTitle className="text-red-800 font-bold text-lg">
          Your VIP AI Trial has ended.
        </AlertTitle>
        <AlertDescription className="text-red-700 mt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p>
            Your AI assistant has been paused and will no longer reply to customers. Upgrade to a paid plan to reactivate it immediately!
          </p>
          <Button asChild size="sm" variant="destructive" className="whitespace-nowrap">
            <Link href="/dashboard/subscription">Reactivate AI</Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}