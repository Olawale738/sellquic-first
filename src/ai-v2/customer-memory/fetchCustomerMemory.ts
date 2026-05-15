import { db } from '@/lib/firebase-admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { normalizePhoneForLookup } from '@/lib/normalizePhone';
import type { CustomerMemory } from './types';
import { CUSTOMER_MEMORY_TTL_DAYS } from './types';

/**
 * Fetch + cache customer memory for this conversation.
 *
 * Side effect: writes `customerMemory` to the conversation doc.
 *
 * Idempotent: if the cached memory is fresh (< 7 days) AND phone hasn't
 * changed, skip the Firestore read.
 *
 * Returns null if phone is unrecognizable. Returns a CustomerMemory
 * (possibly with `isReturningCustomer: false`) on success.
 */
export async function fetchAndCacheCustomerMemory(
  storeId: string,
  conversationId: string,
  rawPhone: string,
  cachedMemory: CustomerMemory | null,
): Promise<CustomerMemory | null> {
  const normalized = normalizePhoneForLookup(rawPhone);
  if (!normalized) return null;

  // Cache hit: same phone, fresh
  if (cachedMemory && cachedMemory.phone === normalized && isFresh(cachedMemory)) {
    return cachedMemory;
  }

  // Read last 50 store orders, filter in code by normalized phone.
  // Same pattern as resolveOrderLookup — cheap, store-scoped.
  const snap = await db
    .collection('orders')
    .where('storeId', '==', storeId)
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();

  const matches = snap.docs
    .map((d) => ({ doc: d, data: d.data() as any }))
    .filter(({ data }) => {
      const stored = normalizePhoneForLookup(data?.customerInfo?.phone);
      return stored !== null && stored === normalized;
    })
    .filter(({ data }) => {
      // Inclusive — anything not cancelled counts as a real customer.
      const status = String(data?.status || '').toLowerCase();
      return status !== 'cancelled';
    });

  const newest = matches[0]?.data ?? null;
  const recentOrders = matches.slice(0, 3).map(({ doc, data }) => ({
    id: doc.id,
    totalAmount: Number(data?.totalAmount || 0),
    itemSummary: summarizeItems(data?.items),
    createdAtMs: data?.createdAt?.toMillis?.() ?? null,
    status: data?.status || null,
  }));

  const memory: CustomerMemory = {
    phone: normalized,
    name: newest?.customerInfo?.name?.trim?.() || null,
    isReturningCustomer: matches.length > 0,
    recentOrders,
    fetchedAt: Timestamp.now(),
  };

  // Cache on the conversation doc. Best-effort — never throw on write.
  try {
    await db
      .collection('stores')
      .doc(storeId)
      .collection('ai_conversations')
      .doc(conversationId)
      .update({
        customerMemory: memory,
        // Keep the conversation's customerName in sync if not yet set.
        ...(memory.name ? { customerName: memory.name } : {}),
        ...(memory.phone ? { customerPhone: memory.phone } : {}),
        customerMemoryUpdatedAt: FieldValue.serverTimestamp(),
      });
  } catch (err) {
    console.error('[customer-memory] cache write failed:', err);
  }

  return memory;
}

function isFresh(memory: CustomerMemory): boolean {
  const fetchedMs = memory.fetchedAt?.toMillis?.();
  if (!fetchedMs) return false;
  const ageDays = (Date.now() - fetchedMs) / (1000 * 60 * 60 * 24);
  return ageDays < CUSTOMER_MEMORY_TTL_DAYS;
}

function summarizeItems(items: any): string {
  if (!Array.isArray(items) || items.length === 0) return 'order';
  const labels = items.slice(0, 2).map((it) => {
    const variant = it?.selectedVariant?.name ? ` (${String(it.selectedVariant.name).trim()})` : '';
    return `${String(it?.productName || '').trim()}${variant}`;
  });
  if (items.length <= 2) return labels.join(', ');
  return `${labels.join(', ')} and ${items.length - 2} more`;
}