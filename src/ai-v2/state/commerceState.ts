import { Timestamp } from 'firebase-admin/firestore';
import type { CommerceState, PersistedCommerceState } from '../types';

export function getStateTtlSeconds(state: CommerceState): number {
  switch (state) {
    case 'AWAITING_PRODUCT_SELECTION':
    case 'AWAITING_VARIANT':
    case 'AWAITING_QUANTITY':
      return 30 * 60;

    case 'AWAITING_DELIVERY_AREA':
      return 60 * 60;

    case 'AWAITING_ADDRESS':
    case 'AWAITING_PHONE':
    case 'AWAITING_NAME':
      return 2 * 60 * 60;

    case 'READY_FOR_CHECKOUT':
      return 24 * 60 * 60;

    case 'CHECKOUT_CREATED':
      return 7 * 24 * 60 * 60;

    default:
      return 30 * 60;
  }
}

export function isCommerceStateExpired(state: PersistedCommerceState): boolean {
  if (!state?.expiresAt) return false;

  const expiresAtMs = state.expiresAt.toMillis?.();

  if (!expiresAtMs) return false;

  return Date.now() > expiresAtMs;
}

export function createCommerceState(
  state: CommerceState,
  patch: Partial<PersistedCommerceState> = {}
): PersistedCommerceState {
  const now = Timestamp.now();
  const ttlSeconds = getStateTtlSeconds(state);
  const expiresAt = Timestamp.fromMillis(now.toMillis() + ttlSeconds * 1000);

  return {
    state,
    stateEnteredAt: now,
    expiresAt,
    ...patch,
  };
}

export function normalizeLegacyCommerceState(convData: any): PersistedCommerceState {
  const legacyStep = String(convData?.awaitingStep || '').toLowerCase();

  if (convData?.handoverMode === true || convData?.status === 'needs_review') {
    return createCommerceState('HANDOVER');
  }

  if (legacyStep === 'variant') {
    return createCommerceState('AWAITING_VARIANT', {
      pendingProductId: convData?.draftOrder?.productId || null,
      pendingVariantId: convData?.draftOrder?.variantId || null,
    });
  }

  if (legacyStep === 'quantity') {
    return createCommerceState('AWAITING_QUANTITY', {
      pendingProductId: convData?.draftOrder?.productId || null,
      pendingVariantId: convData?.draftOrder?.variantId || null,
    });
  }

  if (legacyStep === 'delivery') {
    return createCommerceState('AWAITING_DELIVERY_AREA');
  }

  if (legacyStep === 'address') {
    return createCommerceState('AWAITING_ADDRESS');
  }

  if (legacyStep === 'phone') {
    return createCommerceState('AWAITING_PHONE');
  }

  if (legacyStep === 'fullname') {
    return createCommerceState('AWAITING_NAME');
  }

  if (legacyStep === 'confirmation') {
    return createCommerceState('READY_FOR_CHECKOUT');
  }

  if (convData?.lastCheckoutLink || convData?.lastActionData?.action === 'checkout') {
    return createCommerceState('CHECKOUT_CREATED');
  }

  const cart = Array.isArray(convData?.currentCart) ? convData.currentCart : [];

  if (cart.length > 0) {
    return createCommerceState('BROWSING');
  }

  return createCommerceState('IDLE');
}