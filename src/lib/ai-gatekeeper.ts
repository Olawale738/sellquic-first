import { db } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

export async function checkAiAccess(storeId: string) {
  try {
    const storeSnap = await db.collection('stores').doc(storeId).get();
    if (!storeSnap.exists) return { allowed: false, type: 'not_found' };

    const sellerId = storeSnap.data()?.sellerId;
    if (!sellerId) return { allowed: false, type: 'no_owner' };

    const sellerSnap = await db.collection('users').doc(sellerId).get();
    const userData = sellerSnap.data();
    if (!userData) return { allowed: false, type: 'no_user' };

    const sub = userData.subscription;
    const promo = userData.promoAccess;
    const now = Date.now();

    // 1. UNIVERSAL PROMO ACCESS CHECK (The Launch Offer / VIP Pass)
    // This is the master override for the 14-Day trial.
    let hasActivePromo = false;
    if (promo && !promo.revokedAt) {
      const promoEndsAt = promo.endsAt instanceof Timestamp 
        ? promo.endsAt.toMillis() 
        : new Date(promo.endsAt).getTime();
        
      if (promoEndsAt > now) {
        hasActivePromo = true;
      }
    }

    if (hasActivePromo) {
      return { allowed: true, sellerId, reason: 'promo_active' };
    }

    // 2. LEGACY TRIAL CHECK (For users who signed up before promoAccess)
   // 2. STRICT SUBSCRIPTION TRIAL CHECK
if (sub?.status === 'trial') {
  const trialEnd = sub.trialEndsAt instanceof Timestamp
    ? sub.trialEndsAt.toMillis()
    : new Date(sub.trialEndsAt).getTime();

  if (trialEnd > now) {
    return { allowed: true, sellerId, reason: 'trial_active' };
  }

  return { allowed: false, type: 'trial_expired', sellerId };
}

    // 3. STRICT PAID PLAN CHECK (Only allows specific Plan IDs)
    // 🚨 This stops 'free' and 'starter' users from sneaking in!
    const paidPlans = ['starter', 'standard', 'growth'];
    const isPaidPlan = sub?.status === 'active' && paidPlans.includes(sub?.planId);

    if (isPaidPlan) {
      return { allowed: true, sellerId, reason: 'paid_plan' };
    }

    // 4. ALL CHECKS FAILED -> BLOCK
    return { allowed: false, type: 'blocked', sellerId };
  } catch (e) {
    console.error('Gatekeeper Error:', e);
    return { allowed: false, type: 'error' };
  }
}