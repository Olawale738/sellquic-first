import { db } from '@/lib/firebase-admin';
import type { TurnContext } from '../types';
import { normalizePhoneForLookup } from '@/lib/normalizePhone';

export type LookupOrder = {
  id: string;
  paymentReference: string | null;
  paymentStatus: string | null;
  selectedPaymentMethod: string | null;
  status: string | null;
  totalAmount: number;
  createdAt: Date | null;
  paidAt: Date | null;
  customerName: string | null;
  customerPhone: string | null;
  delivery: { id: string; label: string; fee: number } | null;
  items: Array<{ productName: string; variantName: string | null; quantity: number; price: number }>;
};

export type LookupResult =
  | { kind: 'found_one'; order: LookupOrder }
  | { kind: 'found_many'; orders: LookupOrder[]; truncated: boolean }
  | { kind: 'not_found'; reason: 'reference_no_match' | 'phone_no_match' | 'no_input' };

export type LookupInput = {
  storeId: string;
  paymentReference?: string;
  orderId?: string;
  phoneRaw?: string;
};

/**
 * Resolve customer order(s) for the support flow.
 *
 * Strict rules:
 *  - Always scoped to storeId — never cross-store.
 *  - Returns 1, many, or none. Never throws on "not found".
 *  - Reads Firestore directly. No assumptions about what's in ctx.
 *
 * Lookup priority:
 *   1. paymentReference (exact)
 *   2. orderId (doc lookup)
 *   3. phone (normalized, against last 50 store orders)
 */
export async function resolveOrderLookup(input: LookupInput): Promise<LookupResult> {
  const { storeId, paymentReference, orderId, phoneRaw } = input;

  if (paymentReference) {
    const snap = await db
      .collection('orders')
      .where('storeId', '==', storeId)
      .where('paymentReference', '==', paymentReference)
      .limit(1)
      .get();

    if (!snap.empty) {
      return { kind: 'found_one', order: docToOrder(snap.docs[0]) };
    }
    // fall through to other methods if available
  }

  if (orderId) {
    const docRef = db.collection('orders').doc(orderId);
    const doc = await docRef.get();
    if (doc.exists) {
      const data = doc.data();
      // Strict store scope: never return another vendor's order.
      if (data?.storeId === storeId) {
        return { kind: 'found_one', order: docToOrder(doc as any) };
      }
    }
  }

  if (phoneRaw) {
    const normalized = normalizePhoneForLookup(phoneRaw);
    if (!normalized) {
      return { kind: 'not_found', reason: 'phone_no_match' };
    }

    // Read last 50 orders for the store, filter in code.
    // Cheaper than maintaining a second indexed field; sufficient for v1.
    const snap = await db
      .collection('orders')
      .where('storeId', '==', storeId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const matches = snap.docs
      .map(docToOrder)
      .filter((o) => {
        const stored = normalizePhoneForLookup(o.customerPhone);
        return stored !== null && stored === normalized;
      });

    if (matches.length === 0) {
      return { kind: 'not_found', reason: 'phone_no_match' };
    }
    if (matches.length === 1) {
      return { kind: 'found_one', order: matches[0] };
    }
    // Cap at 3 visible; flag truncated if more.
    const visible = matches.slice(0, 3);
    return {
      kind: 'found_many',
      orders: visible,
      truncated: matches.length > 3,
    };
  }

  if (paymentReference || orderId) {
    return { kind: 'not_found', reason: 'reference_no_match' };
  }
  return { kind: 'not_found', reason: 'no_input' };
}

function docToOrder(doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot): LookupOrder {
  const data = doc.data() as any;
  const items = Array.isArray(data?.items) ? data.items : [];
  return {
    id: doc.id,
    paymentReference: data?.paymentReference || null,
    paymentStatus: data?.paymentStatus || null,
    selectedPaymentMethod: data?.selectedPaymentMethod || null,
    status: data?.status || null,
    totalAmount: Number(data?.totalAmount || 0),
    createdAt: toDate(data?.createdAt),
    paidAt: toDate(data?.paidAt),
    customerName: data?.customerInfo?.name || null,
    customerPhone: data?.customerInfo?.phone || null,
    delivery: data?.delivery
      ? {
          id: String(data.delivery.id || ''),
          label: String(data.delivery.label || '').trim(),
          fee: Number(data.delivery.fee || 0),
        }
      : null,
    items: items.map((it: any) => ({
      productName: String(it?.productName || '').trim(),
      variantName: it?.selectedVariant?.name ? String(it.selectedVariant.name).trim() : null,
      quantity: Number(it?.quantity || 0),
      price: Number(it?.price || 0),
    })),
  };
}

function toDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string') return new Date(value);
  return null;
}