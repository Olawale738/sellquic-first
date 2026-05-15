import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { isPast } from 'date-fns';
import { PlatformPricing, PlanId, getEffectivePrice } from '@/lib/pricing';
import { kv } from '@vercel/kv';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { planId, billingCycle, email, userId, couponCode, purpose } = body;

    // ✅ FIX 1: Define isVerifyOnly (was missing after merge)
    const isVerifyOnly = purpose === 'verify';

    // 1. Basic Validation
    if (!planId || !userId || !billingCycle || !email) {
      return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
    }

    // --- DYNAMIC PRICING LOGIC ---
    const pricingDoc = await db.collection('settings').doc('platform').get();
    if (!pricingDoc.exists) {
      return NextResponse.json({ success: false, message: 'Pricing not configured.' }, { status: 500 });
    }

    const pricing = pricingDoc.data() as PlatformPricing;

    // 🆕 GROWTH 7-DAY FREE TRIAL — NO PAYSTACK
if (purpose === 'trial') {
  const userRef = db.collection('users').doc(userId);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    return NextResponse.json(
      { success: false, message: 'User not found' },
      { status: 404 }
    );
  }

  const userData = userSnap.data();

  if (userData?.hasEverPaid === true || userData?.hasUsedTrial === true) {
    return NextResponse.json(
      { success: false, message: 'Trial not available for this account.' },
      { status: 400 }
    );
  }

  if (!['standard', 'growth'].includes(planId)) {
    return NextResponse.json(
      { success: false, message: 'Free trial is only available for Standard and Growth.' },
      { status: 400 }
    );
  }

  const now = new Date();
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 7);

  const trialCredits = Number(pricing.plans?.[planId as PlanId]?.aiCredits || 0);

  const batch = db.batch();

  batch.update(userRef, {
    subscription: {
      planId,
      status: 'trial',
      billingCycle: 'trial',
      startDate: now,
      endDate: trialEnd,
      trialEndsAt: trialEnd,
      updatedAt: now,
    },
    hasUsedTrial: true,
    updatedAt: now,
  });

  const periodRef = userRef.collection('ai_credit_periods').doc('trial_initial');

  

  batch.set(periodRef, {
    planId,
    billingCycle: 'monthly',
    status: 'active',
    periodStart: now,
    periodEnd: trialEnd,
    totalCredits: trialCredits,
    usedCredits: 0,
    remainingCredits: trialCredits, 
    source: 'trial',
    createdAt: now,
    updatedAt: now,
  });


  const storesSnap = await db
  .collection('stores')
  .where('sellerId', '==', userId)
  .get();

storesSnap.docs.forEach((storeDoc) => {
  batch.set(
    storeDoc.ref,
    {
      status: 'active',
      aiAssistant: {
        enabled: true,
        channels: {
          web: true,
          whatsapp: true,
          instagram: true,
        },
        updatedAt: now,
      },
      updatedAt: now,
    },
    { merge: true }
  );
});
  await batch.commit();
  await Promise.all(
    storesSnap.docs.map((storeDoc) =>
      kv.del(`store_context_v3:${storeDoc.id}`).catch(() => null)
    )
  );

  return NextResponse.json({
    success: true,
    message: `${planId === 'growth' ? 'Growth' : 'Standard'} trial activated`,
  });
}

const validPlans = ['starter', 'standard', 'growth'];

if (!validPlans.includes(planId)) {
  return NextResponse.json(
    { success: false, message: 'Invalid plan selected' },
    { status: 400 }
  );
}

const firestorePlanId = planId as PlanId;

const amountGHS = getEffectivePrice(firestorePlanId, billingCycle, pricing);

if (!Number.isFinite(amountGHS) || amountGHS < 0) {
  return NextResponse.json(
    { success: false, message: 'Invalid plan or billing cycle' },
    { status: 400 }
  );
}

let finalAmountInPesewas = amountGHS * 100;

    // ✅ FIX 2: Restore signup/affiliate discount logic (was in old branch, lost in merge)
    let signupDiscount = 0;

    const userDocRef = db.collection('users').doc(userId);
    const userDoc = await userDocRef.get();

    if (userDoc.exists) {
      const userData = userDoc.data();

      const hasSubscriptionHistory = await db
        .collection('transactions')
        .where('userId', '==', userId)
        .where('type', '==', 'subscription')
        .where('status', '==', 'completed')
        .limit(1)
        .get();

      const hasPaidBefore = !hasSubscriptionHistory.empty;
      const isEligible = userData?.signupDiscountEligible === true;
      const notUsed = userData?.signupDiscountUsed !== true;

      // Apply ₵10 affiliate discount on 2nd+ payment (renewal)
      if (isEligible && notUsed && hasPaidBefore) {
        signupDiscount = 1000; // ₵10 in pesewas
        finalAmountInPesewas -= signupDiscount;
        console.log(`✅ Signup/affiliate discount applied for user ${userId}`);
      }
    }

    let appliedDiscount = null;

    // 2. Coupon Logic
    if (couponCode) {
      const cleanCode = couponCode.trim().toUpperCase();

      const redemptionId = `${userId}_${cleanCode}`;
      const redemptionDoc = await db.collection('coupon_redemptions').doc(redemptionId).get();

      if (redemptionDoc.exists) {
        return NextResponse.json({ success: false, message: 'You have already used this coupon code.' }, { status: 400 });
      }

      const couponSnap = await db.collection('coupons')
        .where('code', '==', cleanCode)
        .limit(1)
        .get();

      if (couponSnap.empty) {
        return NextResponse.json({ success: false, message: 'Invalid coupon code' }, { status: 400 });
      }

      const coupon = couponSnap.docs[0].data();

      if (coupon.isActive === false) {
        return NextResponse.json({ success: false, message: 'This coupon is no longer active' }, { status: 400 });
      }

      let expiresAt = null;
      if (coupon.expiresAt?.toDate) expiresAt = coupon.expiresAt.toDate();
      else if (coupon.expiresAt) expiresAt = new Date(coupon.expiresAt);

      if (expiresAt && isPast(expiresAt)) {
        return NextResponse.json({ success: false, message: 'Coupon code has expired' }, { status: 400 });
      }

      const isValidPlan = coupon.validForPlan === 'all' || coupon.validForPlan === firestorePlanId;
      if (!isValidPlan) {
        return NextResponse.json({ success: false, message: `This code is not valid for the ${planId} plan` }, { status: 400 });
      }

      let discountAmount = 0;
      if (coupon.type === 'percentage') {
        discountAmount = Math.floor(finalAmountInPesewas * (coupon.value / 100));
      } else {
        discountAmount = coupon.value * 100;
      }

      finalAmountInPesewas = Math.max(0, finalAmountInPesewas - discountAmount);

      appliedDiscount = {
        code: coupon.code,
        amount: discountAmount,
        type: coupon.type,
        value: coupon.value,
      };
    }

    // ✅ FIX 3: isVerifyOnly block now works — all 3 variables are defined above
    // Also removed the duplicate `if (purpose === 'verify')` block that was below this
    if (isVerifyOnly) {
      return NextResponse.json({
        success: true,
        data: {
          appliedDiscount,
          amount: finalAmountInPesewas,
          signupDiscountApplied: signupDiscount > 0,
          signupDiscountAmount: signupDiscount,
        },
      });
    }

    // 3. Payment Initialization
    const reference = `SUB-${userId}-${Date.now()}`;
    const secretKey = process.env.PAYSTACK_SECRET_KEY;

    if (!secretKey) {
      return NextResponse.json({ success: false, message: 'Payment gateway not configured.' }, { status: 500 });
    }

    if (finalAmountInPesewas <= 0) {
      return NextResponse.json({ success: false, message: '100% discount requires manual processing via support.' }, { status: 400 });
    }

    const CREDIT_LIMITS: Record<PlanId, number> = {
      starter: Number(pricing.plans?.starter?.aiCredits || 0),
      standard: Number(pricing.plans?.standard?.aiCredits || 0),
      growth: Number(pricing.plans?.growth?.aiCredits || 2000),
    };
    
    const aiCredits = Number(CREDIT_LIMITS[firestorePlanId] || 0);

    const payload = {
      email,
      amount: finalAmountInPesewas,
      reference,
      currency: 'GHS',
      metadata: {
        planId: firestorePlanId,
        billingCycle,
        userId,
        aiCredits,
        type: 'subscription',
        appliedDiscount: appliedDiscount
          ? { code: appliedDiscount.code, amount: appliedDiscount.amount }
          : null,
        signupDiscountApplied: signupDiscount > 0,
      },
    };

    const res = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!data.status) {
      return NextResponse.json({ success: false, message: data.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: {
        authorizationUrl: data.data.authorization_url,
        access_code: data.data.access_code,
        reference,
        amount: finalAmountInPesewas,
        appliedDiscount,
        signupDiscount: signupDiscount > 0 ? { amount: signupDiscount } : null,
      },
    });

  } catch (err: any) {
    console.error('Subscription API Error:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'Subscription initialization failed' },
      { status: 500 }
    );
  }
}