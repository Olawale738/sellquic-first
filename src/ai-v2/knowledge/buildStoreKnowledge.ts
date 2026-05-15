import type {
  KnowledgeDeliveryZone,
  RawStoreDoc,
  StoreKnowledge,
} from './types';

/**
 * Projects a raw Firestore store document + delivery zones into the
 * normalized StoreKnowledge shape consumed by the knowledge answer layer.
 *
 * Pure function. No Firestore reads, no side effects.
 */
export function buildStoreKnowledge(
  store: RawStoreDoc,
  deliveryZones: KnowledgeDeliveryZone[]
): StoreKnowledge {
  return {
    storeId: safeString(store.id) || 'unknown_store',
    name: nonEmpty((store as any).name) ?? nonEmpty((store as any).businessName) ?? 'this store',

    about:
      nonEmpty((store as any).aboutUs) ??
      nonEmpty((store as any).aiAssistant?.brandIntro) ??
      null,

    location: nonEmpty((store as any).location),
    hours: nonEmpty((store as any).hours),

    delivery: {
      zones: deliveryZones,
      notice:
        nonEmpty((store as any).deliveryNotice) ??
        nonEmpty((store as any).themeConfig?.deliveryInfo) ??
        null,
      timeline: nonEmpty((store as any).deliveryTimeline),
    },

    payment: {
      cod: (store as any).isCodActive === true,
      momo: {
        enabled: (store as any).isMomoActive === true,
        number: nonEmpty((store as any).momoNumber),
        network: nonEmpty((store as any).momoNetwork),
        accountName: nonEmpty((store as any).momoAccountName),
      },
      paystack: (store as any).isPaystackActive === true,
      bank: (store as any).isBankPaymentActive === true,
      info: nonEmpty((store as any).paymentInfo),
    },

    policy: {
      returns: nonEmpty((store as any).returnPolicy),
    },

    faqs: mergeFaqs((store as any).faqs ?? null, (store as any).themeConfig?.faqs ?? null),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the trimmed string if value is a real non-empty string.
 *
 * Important:
 * Firestore data is not guaranteed to match our TypeScript assumptions.
 * Some fields may be maps/arrays/booleans. We must not call .trim()
 * unless the value is actually a string.
 */
function nonEmpty(v: unknown): string | null {
  if (typeof v !== 'string') return null;

  const t = v.trim();
  return t.length === 0 ? null : t;
}

function safeString(v: unknown): string | null {
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length ? t : null;
  }

  if (typeof v === 'number' || typeof v === 'boolean') {
    return String(v);
  }

  return null;
}

function normalizeQuestion(q: string): string {
  return q
    .toLowerCase()
    .replace(/[\s\u00A0]+/g, ' ')
    .replace(/[?!.,;:]+$/g, '')
    .trim();
}

type RawFaq = {
  question?: unknown;
  answer?: unknown;
};

function mergeFaqs(
  primary: RawFaq[] | null,
  fallback: RawFaq[] | null
): StoreKnowledge['faqs'] {
  const out: StoreKnowledge['faqs'] = [];
  const seen = new Set<string>();

  for (const f of Array.isArray(primary) ? primary : []) {
    const q = nonEmpty(f?.question);
    const a = nonEmpty(f?.answer);

    if (!q || !a) continue;

    const key = normalizeQuestion(q);
    if (seen.has(key)) continue;

    seen.add(key);
    out.push({ q, a, source: 'faqs' });
  }

  for (const f of Array.isArray(fallback) ? fallback : []) {
    const q = nonEmpty(f?.question);
    const a = nonEmpty(f?.answer);

    if (!q || !a) continue;

    const key = normalizeQuestion(q);
    if (seen.has(key)) continue;

    seen.add(key);
    out.push({ q, a, source: 'themeConfig.faqs' });
  }

  return out;
}