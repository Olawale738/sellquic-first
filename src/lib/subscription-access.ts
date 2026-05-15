import { Timestamp } from 'firebase/firestore';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type SubscriptionAccessState =
  | 'active_paid'
  | 'active_trial'
  | 'expired_trial'
  | 'expired_paid'
  | 'pending_plan'
  | 'legacy_free'
  | 'no_subscription'
  | 'inactive';

export type ProductAccessResult =
  | { allowed: true }
  | { allowed: false; reason: string; limitReached?: boolean };

// ─────────────────────────────────────────────────────────────────────────────
// Product limit constants
//
// NOTE: The legacy free cap is currently 5 based on existing code in
// products/edit/[productId]/page.tsx.  Maurice mentioned the old cap may be 54 —
// please verify the actual value in Firestore user documents before changing
// LEGACY_FREE_PRODUCT_LIMIT below.
// ─────────────────────────────────────────────────────────────────────────────

export const LEGACY_FREE_PRODUCT_LIMIT = 5; // ← confirm vs. Firestore if needed
export const STARTER_PRODUCT_LIMIT = 10;

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function toDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value?.toDate === 'function') return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Plan identification
// ─────────────────────────────────────────────────────────────────────────────

/** Returns true for old users who were grandfathered into the 'free' plan. */
export function isLegacyFreeUser(subscription: any): boolean {
  return subscription?.planId === 'free';
}

// ─────────────────────────────────────────────────────────────────────────────
// Access status helpers
// ─────────────────────────────────────────────────────────────────────────────

export function isTrialActive(subscription: any): boolean {
  if (!subscription || subscription.status !== 'trial') return false;
  const trialEndsAt = toDate(subscription.trialEndsAt || subscription.endDate);
  if (!trialEndsAt) return false;
  return trialEndsAt > new Date();
}

export function isPaidSubscriptionActive(subscription: any): boolean {
  if (!subscription || subscription.status !== 'active') return false;
  const endDate = toDate(subscription.endDate);
  if (!endDate) return false;
  return endDate > new Date();
}

/**
 * Returns true when the user may interact with commerce features.
 *
 * Three states are possible — do NOT rely solely on this to block Starter users
 * because Starter has access but is limited to STARTER_PRODUCT_LIMIT products:
 *
 *   hasCommerceAccess → false  : access blocked completely (use getCommerceAccessMessage)
 *   hasCommerceAccess → true   : use getProductLimitForSubscription / canCreateProduct
 *                                to determine if they can add more products
 */
export function hasCommerceAccess(subscription: any): boolean {
  // Legacy free users always retain commerce access (up to their capped limit).
  if (isLegacyFreeUser(subscription)) return true;
  return isTrialActive(subscription) || isPaidSubscriptionActive(subscription);
}

export function getSubscriptionAccessState(
  subscription: any
): SubscriptionAccessState {
  if (!subscription) return 'no_subscription';
  if (isLegacyFreeUser(subscription)) return 'legacy_free';
  if (subscription.status === 'pending_plan') return 'pending_plan';

  if (subscription.status === 'trial') {
    return isTrialActive(subscription) ? 'active_trial' : 'expired_trial';
  }

  if (subscription.status === 'active') {
    return isPaidSubscriptionActive(subscription) ? 'active_paid' : 'expired_paid';
  }

  return 'inactive';
}

// ─────────────────────────────────────────────────────────────────────────────
// Product limit helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the maximum number of active products for this subscription,
 * or null for unlimited (Standard / Growth).
 */
export function getProductLimitForSubscription(subscription: any): number | null {
  if (isLegacyFreeUser(subscription)) return LEGACY_FREE_PRODUCT_LIMIT;
  if (
    subscription?.planId === 'starter' &&
    isPaidSubscriptionActive(subscription)
  ) {
    return STARTER_PRODUCT_LIMIT;
  }
  return null;
}

/**
 * Central gate for all product creation / restore actions.
 *
 * Checks both access (subscription state) and the per-plan product limit.
 * Call this *before* uploading images or writing to Firestore.
 */
export function canCreateProduct({
  subscription,
  activeProductCount,
}: {
  subscription: any;
  activeProductCount: number;
}): ProductAccessResult {
  // 1. Must have commerce access first
  if (!hasCommerceAccess(subscription)) {
    return {
      allowed: false,
      reason: getCommerceAccessMessage(subscription),
    };
  }


  
  // 2. Check per-plan product cap
  const limit = getProductLimitForSubscription(subscription);
  if (limit !== null && activeProductCount >= limit) {
    const planLabel = isLegacyFreeUser(subscription)
      ? `legacy free plan limit of ${limit}`
      : `Starter plan limit of ${limit}`;

    return {
      allowed: false,
      limitReached: true,
      reason: `You've reached the ${planLabel} active products. Upgrade to Standard or Growth for unlimited products.`,
    };
  }

  return { allowed: true };
}


/** True only for active or trial Growth users. */
export function canCreateMultipleStores(subscription: any): boolean {
  return hasCommerceAccess(subscription) && subscription?.planId === 'growth';
}
// ─────────────────────────────────────────────────────────────────────────────
// User-facing messages
// ─────────────────────────────────────────────────────────────────────────────

export function getCommerceAccessMessage(subscription: any): string {
  const state = getSubscriptionAccessState(subscription);

  if (state === 'pending_plan' || state === 'no_subscription') {
    return 'Choose a plan or start a 7-day trial to begin listing products on SellQuic.';
  }
  if (state === 'expired_trial') {
    return 'Your 7-day trial has ended. Choose a plan to continue listing products.';
  }
  if (state === 'expired_paid') {
    return 'Your subscription has expired. Renew your plan to continue listing products.';
  }
  return 'Choose a plan to continue listing products and using SellQuic tools.';
}