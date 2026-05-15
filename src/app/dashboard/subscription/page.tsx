'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { Check, Loader2, X, PartyPopper, Sparkles, Clock, AlertCircle, Minus, Store, Rocket, Zap, Building2, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { PlatformPricing, PlanId, BillingCycle } from '@/lib/pricing';
import { Timestamp } from 'firebase/firestore';
import { differenceInDays, format } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

declare global {
  interface Window {
    PaystackPop: any;
  }
}

 
  const planFeatures: Record<string, { credits: string; icon: any; features: string[]; notIncluded?: string[] }> = {
    starter: {
      credits: 'AI available via top-up',
      icon: Rocket,
      features: [
        'Basic storefront',
        'Up to 10 products', 
        'Manual order management',
        'Basic sales analytics',
        'Standard onboarding support',
      ],
      
    },
  
    standard: {
      credits: 'AI available via top-up',
      icon: Store,
      features: [
        'Unlimited products',
        'Customer CRM (up to 50 contacts)',
        'Facebook & Google Pixel',
        'Announcement Bar & Discounts',
        'Sales Badges',
        'Import Products from IG',
        'Abandoned Cart Recovery',
        'AI assistant available when credits are topped up',
        '7-day free trial available',
      ],
     
    },
  
    growth: {
      credits: '2,000 AI responses included',
      icon: Zap,
      features: [
        'Everything in Standard',
        'Full AI assistant access',
        'Instagram DM AI automation',
        'WhatsApp AI automation',
        'Abandoned cart recovery',
        'Import Products from Instagram',
        'Customer CRM (up to 500 contacts)',
        'Countdown Timers & SEO',
        'AI Insights Dashboard',
        '7-day free trial available',
      ],
    },
  };

export default function SubscriptionPage() {
  const { user, loading, refreshUser } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { width, height } = useWindowSize();

  const [pricing, setPricing] = useState<PlatformPricing | null>(null);
  const [loadingPricing, setLoadingPricing] = useState(true);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [paystackReady, setPaystackReady] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  
  const [couponCode, setCouponCode] = useState('');
  const [isVerifyingCoupon, setIsVerifyingCoupon] = useState(false);
  const [activeCouponCode, setActiveCouponCode] = useState<string | null>(null);
  const [couponDiscounts, setCouponDiscounts] = useState<Record<string, number>>({});
  const [isEarlyTesterCoupon, setIsEarlyTesterCoupon] = useState(false);
  const [signupDiscountAmount, setSignupDiscountAmount] = useState(0);

  const sub = user?.subscription;
// Widen type to allow legacy 'free' comparisons (PlanId no longer includes 'free',
// but legacy users still have subscription.planId === 'free').
const currentPlan = sub?.planId as PlanId | 'free' | null | undefined;

  const currentPlanLabel = currentPlan
  ? currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)
  : 'Free';

  const expiryDate = sub?.status === 'trial'
    ? (sub?.trialEndsAt instanceof Timestamp ? sub.trialEndsAt.toDate() : sub?.trialEndsAt ? new Date(sub.trialEndsAt as any) : null)
    : (sub?.endDate instanceof Timestamp ? sub.endDate.toDate() : sub?.endDate ? new Date(sub.endDate as any) : null);

  const daysLeft = expiryDate ? differenceInDays(expiryDate, new Date()) : null;
  const isActuallySuspended =
  sub?.status === 'expired' || (!!expiryDate && new Date() > expiryDate);

  useEffect(() => {
    async function loadPricing() {
      try {
        const res = await fetch('/api/admin/pricing');
        const json = await res.json();
        if (json.success) setPricing(json.data);
      } catch (err) { console.error(err); }
      finally { setLoadingPricing(false); }
    }
    loadPricing();
  }, []);

  useEffect(() => {
    if (!user || (user as any).signupDiscountUsed) return;
    if ((user as any).signupDiscountEligible) setSignupDiscountAmount(10);
  }, [user]);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.onload = () => setPaystackReady(true);
    script.onerror = () => {
      setPaystackReady(false);
      toast({
        title: 'Payment system failed to load',
        description: 'Please refresh the page or contact support.',
        variant: 'destructive',
      });
    };
    
    document.body.appendChild(script);
    
    return () => {
      if (document.body && document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, [toast]);

  const verifyCouponForPlans = useCallback(async (code: string, cycle: BillingCycle) => {
    if (!user || !code) return;
    setIsVerifyingCoupon(true);
    const plansToCheck = ['starter', 'standard', 'growth'];
    const newDiscounts: Record<string, number> = {};
    let isValid = false;

    try {
      const promises = plansToCheck.map((pId) =>
        fetch('/api/subscription/initialize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId: pId, billingCycle: cycle, email: user.email, userId: user.uid, couponCode: code, purpose: "verify" }),
        }).then((res) => res.json())
      );

      const results = await Promise.all(promises);
      results.forEach((data, index) => {
        const pId = plansToCheck[index];
        if (data.success && data.data.appliedDiscount) {
          newDiscounts[pId] = data.data.appliedDiscount.amount;
          isValid = true;
        }
      });

      if (isValid) {
        setCouponDiscounts(newDiscounts);
        setActiveCouponCode(code);
        setIsEarlyTesterCoupon(code === 'EARLYTESTER50');
        toast({ title: code === 'EARLYTESTER50' ? '🎉 Early Tester Reward Applied!' : 'Coupon Applied!' });
      } else {
        toast({ title: 'Invalid Coupon', variant: 'destructive' });
      }
    } catch (error) { console.error(error); }
    finally { setIsVerifyingCoupon(false); }
  }, [user, toast]);

  const handlePlanChange = async (newPlanId: PlanId) => {
    if (!user || !paystackReady) return;
    setIsProcessing(newPlanId);

    try {
      const initResponse = await fetch('/api/subscription/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: newPlanId, billingCycle, email: user.email, userId: user.uid, couponCode: activeCouponCode, purpose: "pay" }),
      });
      const initData = await initResponse.json();

      if (!initResponse.ok || !initData.success) {
        console.error('Subscription initialize failed:', initData);
      
        throw new Error(
          initData.message ||
          initData.error ||
          'Subscription initialization failed.'
        );
      }

      const { reference, amount } = initData.data;
      const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;

if (!publicKey) {
  throw new Error('Paystack public key is missing.');
}

const verifyPayment = async (reference: string) => {
  setIsProcessing('verifying');

  try {
    const verifyRes = await fetch('/api/paystack/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference, userId: user.uid }),
    });

    const verifyJson = await verifyRes.json();

    if (!verifyRes.ok || !verifyJson.success) {
      throw new Error(verifyJson.message || 'Payment verification failed.');
    }

    await refreshUser();

    toast({
      title: 'Payment received',
      description: 'Your plan is being activated now.',
    });

    setShowConfetti(true);
    setTimeout(() => router.push('/dashboard'), 4000);
  } catch (error: any) {
    toast({
      title: 'Payment Verification Failed',
      description: error.message || 'Please contact support if you were charged.',
      variant: 'destructive',
    });

    setIsProcessing(null);
  }
};

const handler = window.PaystackPop.setup({
  key: publicKey,
  email: user.email,
  amount: Math.round(amount),
  ref: reference,
  currency: 'GHS',

  onSuccess: (transaction: any) => {
    verifyPayment(transaction.reference);
  },

  callback: (transaction: any) => {
    verifyPayment(transaction.reference);
  },

  onClose: () => setIsProcessing(null),
});
      handler.openIframe();
    } catch (error: any) {
      toast({ title: 'Payment Failed', description: error.message, variant: 'destructive' });
      setIsProcessing(null);
    }
  };




  const handleStartTrial = async (planId: 'standard' | 'growth') => {
    if (!user) return;
  
    setIsProcessing(`trial-${planId}`);
  
    try {
      const res = await fetch('/api/subscription/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          billingCycle: 'monthly',
          email: user.email,
          userId: user.uid,
          purpose: 'trial',
        }),
      });
  
      const json = await res.json();
  
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to start trial.');
      }
  
      await refreshUser();
  
      const planLabel = planId.charAt(0).toUpperCase() + planId.slice(1);
      toast({
        title: `${planLabel} trial activated`,
        description: planId === 'growth'
          ? 'You now have 7 days of full AI assistant access.'
          : 'You now have 7 days to explore Standard.',
      });
  
      router.push('/dashboard');
    } catch (error: any) {
      toast({
        title: 'Trial failed',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(null);
    }
  };

  const canRenewCurrentPlan =
  !!currentPlan &&
  currentPlan !== 'free' &&
  daysLeft !== null &&
  daysLeft <= 7;

  const canStartTrial =
  (!currentPlan || (sub?.status as string) === 'pending_plan') &&
  !(user as any)?.hasEverPaid &&
  !(user as any)?.hasUsedTrial;

  if (loading) return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto" /></div>;

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-6">
      {/* 🚩 ALERTS SECTION */}
      {currentPlan && currentPlan !== 'free' && (
        isActuallySuspended ? (
          <Alert className="border-red-500 bg-red-50"><AlertCircle className="h-5 w-5 text-red-600" /><AlertTitle className="text-red-800 font-bold">Store Suspended</AlertTitle><AlertDescription>Your plan has expired. Renew below to reactivate.</AlertDescription></Alert>
        ) : daysLeft !== null && daysLeft <= 7 ? (
          <Alert className="border-amber-400 bg-amber-50"><Clock className="h-5 w-5 text-amber-600" /><AlertTitle className="text-amber-800 font-bold">Plan Expiring Soon</AlertTitle><AlertDescription>{daysLeft === 0 ? 'Expires today' : `${daysLeft} days left`}. Renew now to stay online.</AlertDescription></Alert>
        ) : (
          <Card className="border-primary/10 bg-primary/5 text-center">
          <CardHeader>
            <CardTitle className="flex justify-center gap-2 text-sm uppercase tracking-widest">
              <Clock className="h-4 w-4" />
              {sub?.status === 'trial' ? 'Free Trial' : 'Active Plan'}:
              <span className="text-primary">{currentPlanLabel}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-bold">
              {daysLeft !== null && expiryDate
                ? `Renews in ${daysLeft} days (${format(expiryDate, 'PP')})`
                : 'Renewal date unavailable'}
            </p>
          </CardContent>
        </Card>
        )
      )}

      {isEarlyTesterCoupon && (
        <Alert className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-300"><PartyPopper className="h-5 w-5 text-purple-600" /><AlertTitle className="text-purple-800 font-black uppercase">Early Tester Reward!</AlertTitle><AlertDescription>₵50 OFF applied to all plans below.</AlertDescription></Alert>
      )}

      {signupDiscountAmount > 0 && (
        <Alert className="bg-blue-50 border-blue-200"><Sparkles className="h-4 w-4 text-blue-600" /><AlertTitle className="font-bold">Referral Bonus Unlocked 🎁</AlertTitle><AlertDescription>You get ₵{signupDiscountAmount} off your next upgrade.</AlertDescription></Alert>
      )}

      {/* 🗓 BILLING TOGGLE */}
      <div className="flex justify-center">
        <Tabs value={billingCycle} onValueChange={(v) => setBillingCycle(v as BillingCycle)}>
          <TabsList className="bg-slate-100 p-1 rounded-full"><TabsTrigger value="monthly" className="rounded-full px-8">Monthly</TabsTrigger><TabsTrigger value="quarterly" className="rounded-full px-8">Quarterly (-10%)</TabsTrigger></TabsList>
        </Tabs>
      </div>

      {/* 🏷 COUPON SECTION */}
      <div className="max-w-md mx-auto flex gap-2 mb-16">
        <Input placeholder="Coupon Code" value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} disabled={!!activeCouponCode} className="rounded-xl" />
        {activeCouponCode ? (
          <Button variant="outline" onClick={() => { setActiveCouponCode(null); setCouponDiscounts({}); setCouponCode(''); setIsEarlyTesterCoupon(false); }} className="rounded-xl"><X className="h-4 w-4" /></Button>
        ) : (
          <Button onClick={() => verifyCouponForPlans(couponCode, billingCycle)} disabled={isVerifyingCoupon} className="rounded-xl">{isVerifyingCoupon ? <Loader2 className="animate-spin" /> : 'Apply'}</Button>
        )}
      </div>

      {/* 💳 CARDS GRID */}
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {(['starter', 'standard', 'growth'] as const).map((id) => (
          <PricingCard
          key={id}
          planId={id}
          pricing={pricing}
          billingCycle={billingCycle}
          user={user}
          couponDiscount={couponDiscounts[id] || 0}
          signupDiscount={signupDiscountAmount}
          onPurchase={handlePlanChange}
          canStartTrial={canStartTrial && (id === 'standard' || id === 'growth')}
          onStartTrial={() => handleStartTrial(id as 'standard' | 'growth')}
          isProcessing={isProcessing}
          isCurrent={currentPlan === id}
          canRenew={canRenewCurrentPlan && currentPlan === id}
        />
        ))}
      </div>
     

      {/* ✅ UPDATED CONTACT LOGIC */}
      <div className="max-w-2xl mx-auto pt-10 border-t"><ManualUpgradeForm /></div>
      {showConfetti && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"><Confetti width={width} height={height} recycle={false} /><h1 className="text-4xl font-bold text-white">Payment Received! 🎉</h1></div>}
    </div>
  );
}

const ManualUpgradeForm = () => (
  <div className="text-center space-y-4">
    <p className="text-sm text-slate-500 font-bold uppercase tracking-widest">Payment Issues?</p>
    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        {/* ✅ DIRECT WHATSAPP BUTTON */}
        <Button 
            onClick={() => window.open('https://wa.me/233553240997', '_blank')}
            variant="outline" 
            className="rounded-xl border-slate-200 text-slate-600 px-8 py-6"
        >
            <MessageCircle className="mr-2 h-5 w-5 text-green-500" /> Contact Support
        </Button>

        
    </div>
  </div>
);

function PricingCard({
  planId,
  pricing,
  billingCycle,
  user,
  couponDiscount,
  signupDiscount,
  onPurchase,
  onStartTrial,
  canStartTrial,
  isProcessing,
  isCurrent,
  canRenew,
}: any) {
  const fallbackPrices: Record<string, { monthly: number; quarterly: number; label: string }> = {
    starter: { monthly: 35, quarterly: 105, label: 'Starter' },
    standard: { monthly: 70, quarterly: 210, label: 'Standard' },
    growth: { monthly: 200, quarterly: 600, label: 'Growth' },
  };

  const descriptions: Record<string, string> = {
    starter: 'Basic storefront for vendors who want to sell manually.',
    standard: 'Full sales tools with AI available through top-up.',
    growth: 'Full sales tools plus AI automation included.',
  };

  const planData = planFeatures[planId];

  if (!planData) {
    return null;
  }

  const Icon = planData.icon;
  const planInfo =
    pricing?.plans?.[planId as PlanId] ||
    fallbackPrices[planId];

  const originalPrice =
    billingCycle === 'quarterly'
      ? Number(planInfo?.quarterlyPrice || planInfo?.quarterly || 0)
      : Number(planInfo?.monthlyPrice || planInfo?.monthly || 0);

  const totalDiscountGHS = couponDiscount / 100 + signupDiscount;
  const finalPrice = Math.max(0, originalPrice - totalDiscountGHS);

 

  const isTrialLoading = canStartTrial && isProcessing === `trial-${planId}`;
  const isPlanLoading = isProcessing === planId || isProcessing === 'verifying';

  return (
    <Card
      className={cn(
        'flex flex-col relative h-full transition-all duration-300',
        planId === 'growth' &&
          'border-purple-600 ring-2 ring-purple-100 shadow-xl scale-105 z-10'
      )}
    >
      {planId === 'growth' && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 uppercase text-[9px] font-black">
          Most Popular
        </Badge>
      )}

      <CardHeader>
        <div className="flex items-center gap-2 mb-2">
          <Icon
            className={cn(
              'h-5 w-5',
              planId === 'growth' ? 'text-purple-600' : 'text-slate-400'
            )}
          />
          <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-900">
            {planInfo?.label || planId}
          </CardTitle>
        </div>

        {planId === 'growth' ? (
  <>
    <div className="flex items-baseline gap-1">
      <span className="text-3xl font-black text-slate-900">
        {Math.floor(finalPrice / (billingCycle === 'quarterly' ? 90 : 30))} GHS
      </span>
      <span className="text-slate-400 font-bold text-xs">/ DAY</span>
    </div>

    <p className="text-[10px] font-black text-purple-600 uppercase">
      Billed at {finalPrice} GHS/
      {billingCycle === 'quarterly' ? 'quarter' : 'month'}
    </p>
  </>
) : (
  <div className="flex items-baseline gap-1">
    <span className="text-3xl font-black text-slate-900">
      {finalPrice} GHS
    </span>
    <span className="text-slate-400 font-bold text-xs">
      / {billingCycle === 'quarterly' ? 'QUARTER' : 'MONTH'}
    </span>
  </div>
)}

        <CardDescription className="text-xs font-medium pt-3 min-h-[50px]">
          {descriptions[planId]}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-grow space-y-6">
        <div className="bg-purple-50 rounded-xl p-3 border border-purple-100 text-center">
          <p className="text-[10px] font-black text-purple-400 uppercase mb-0.5">
            Core Benefit
          </p>
          <p className="text-[11px] font-bold text-purple-800 uppercase">
            {planData.credits}
          </p>
        </div>

        <ul className="space-y-3">
          {planData.features.map((feature: string, index: number) => (
            <li
              key={index}
              className="flex items-start gap-3 text-[12px] text-slate-700 font-semibold leading-tight"
            >
              <Check className="h-4 w-4 text-purple-600 shrink-0" />
              {feature}
            </li>
          ))}

          {planData.notIncluded?.map((feature: string, index: number) => (
            <li
              key={index}
              className="flex items-start gap-3 text-[12px] text-slate-300 font-medium leading-tight"
            >
              <Minus className="h-4 w-4 shrink-0" />
              <span className="line-through">{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>

      <CardFooter>
        <Button
          className={cn(
            'w-full py-6 rounded-xl text-xs font-black uppercase tracking-widest',
            planId === 'growth'
              ? 'bg-purple-600 text-white'
              : 'hover:border-purple-600'
          )}
          variant={planId === 'growth' ? 'default' : 'outline'}
          disabled={(isCurrent && !canRenew && !canStartTrial) || !!isProcessing}
          onClick={() => {
            if (canStartTrial) {
              onStartTrial();
              return;
            }

            onPurchase(planId);
          }}
        >
          {isPlanLoading || isTrialLoading ? (
            <Loader2 className="animate-spin" />
          ) : canStartTrial ? (
            'Start 7-Day Free Trial'
          ) : canRenew ? (
            'Renew Plan'
          ) : isCurrent ? (
            'Current Plan'
          ) : (
            'Upgrade Plan'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}