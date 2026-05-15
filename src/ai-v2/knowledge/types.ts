/**
 * Knowledge layer type contracts.
 *
 * Single source of truth for the shapes consumed by:
 *   - buildStoreKnowledge        (normalized projection)
 *   - resolveReferent            (pronoun/context fallback)
 *   - resolveExplicitProduct     (explicit-product match from message)
 *   - answerBuilders/*           (per-intent reply builders)
 *   - handleInformationQuestion  (orchestrator)
 */

// ─────────────────────────────────────────────────────────────────────────────
// CommerceState — kept in sync with the real AI v2 state machine.
// ─────────────────────────────────────────────────────────────────────────────

export type CommerceState =
  | 'IDLE'
  | 'BROWSING'
  | 'AWAITING_PRODUCT_SELECTION'
  | 'AWAITING_VARIANT'
  | 'AWAITING_QUANTITY'
  | 'AWAITING_DELIVERY_AREA'
  | 'AWAITING_ADDRESS'
  | 'AWAITING_PHONE'
  | 'AWAITING_NAME'
  | 'READY_FOR_CHECKOUT'
  | 'CHECKOUT_CREATED'
  | 'HANDOVER';

// ─────────────────────────────────────────────────────────────────────────────
// Catalog & cart shapes consumed by the knowledge layer.
// ─────────────────────────────────────────────────────────────────────────────

export interface KnowledgeProduct {
  id: string;
  name: string;
  price: number;
  currency: string;
  stockQty: number | null;
  inStock: boolean;
  variants?: Array<{ id: string; name: string; price?: number; inStock?: boolean }>;
  aliases?: string[];
}

export interface KnowledgeDeliveryZone {
  id: string;
  name: string;
  fee: number;
  currency: string;
  etaText?: string | null;
}

export interface KnowledgeCartLine {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

export interface KnowledgeOrderSession {
  pendingProductId?: string | null;
  selectedDeliveryZoneId?: string | null;
}

export interface KnowledgeTurnContext {
  storeId: string;
  commerceState: CommerceState;
  orderSession: KnowledgeOrderSession;
  cart: { lines: KnowledgeCartLine[] };
  lastMentionedProductId?: string | null;
  productsById: Record<string, KnowledgeProduct>;
  deliveryZones: KnowledgeDeliveryZone[];
  customerMessage: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// QuestionIntent
// ─────────────────────────────────────────────────────────────────────────────

export type QuestionIntent =
  | 'q_price'
  | 'q_stock'
  | 'q_variants'
  | 'q_delivery_fee'
  | 'q_delivery_time'
  | 'q_payment_methods'
  | 'q_cod'
  | 'q_refund_policy'
  | 'q_location'
  | 'q_hours'
  | 'q_about_store'
  | 'q_cart_total'
  | 'q_unknown';

export const QUESTION_INTENTS: ReadonlyArray<QuestionIntent> = [
  'q_price',
  'q_stock',
  'q_variants',
  'q_delivery_fee',
  'q_delivery_time',
  'q_payment_methods',
  'q_cod',
  'q_refund_policy',
  'q_location',
  'q_hours',
  'q_about_store',
  'q_cart_total',
  'q_unknown',
];

export function isQuestionIntent(x: string): x is QuestionIntent {
  return (QUESTION_INTENTS as ReadonlyArray<string>).includes(x);
}

/** Intents that ask about a specific product. The explicit-product resolver
 *  runs only for these. */
export const PRODUCT_QUESTION_INTENTS: ReadonlySet<QuestionIntent> =
  new Set<QuestionIntent>(['q_price', 'q_stock', 'q_variants']);

// ─────────────────────────────────────────────────────────────────────────────
// StoreKnowledge — normalized projection
// ─────────────────────────────────────────────────────────────────────────────

export interface StoreKnowledge {
  storeId: string;
  name: string;
  about: string | null;
  location: string | null;
  hours: string | null;

  delivery: {
    zones: KnowledgeDeliveryZone[];
    notice: string | null;
    timeline: string | null;
  };

  payment: {
    cod: boolean;
    momo: {
      enabled: boolean;
      number: string | null;
      network: string | null;
      accountName: string | null;
    };
    paystack: boolean;
    bank: boolean;
    info: string | null;
  };

  policy: {
    returns: string | null;
  };

  faqs: Array<{
    q: string;
    a: string;
    source: 'faqs' | 'themeConfig.faqs';
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Referent — what the question refers to
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Product referent priority (highest → lowest):
 *   explicit_message → pending → last_mentioned → cart_single
 */
export type Referent =
  | {
      kind: 'product';
      product: KnowledgeProduct;
      source: 'explicit_message' | 'pending' | 'last_mentioned' | 'cart_single';
    }
  | { kind: 'cart' }
  | { kind: 'delivery_current'; zone: KnowledgeDeliveryZone | null }
  | { kind: 'delivery_named'; zone: KnowledgeDeliveryZone }
  | { kind: 'none' };

// ─────────────────────────────────────────────────────────────────────────────
// InformationReply — structured handler output
// ─────────────────────────────────────────────────────────────────────────────

export interface InformationReply {
  answerText: string;
  answerSource: string;
  resume:
    | { kind: 'none' }
    | { kind: 'state_prompt'; state: CommerceState; prompt: string }
    | { kind: 'pivot'; prompt: string };
  diagnostics?: {
    referentKind: Referent['kind'];
    referentSource?: 'explicit_message' | 'pending' | 'last_mentioned' | 'cart_single';
    knowledgeMissing?: string[];
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Raw store document — fields are `unknown` because Firestore data is messy.
// ─────────────────────────────────────────────────────────────────────────────

export interface RawStoreDoc {
  id: string;
  name?: unknown;
  aboutUs?: unknown;
  location?: unknown;
  hours?: unknown;
  deliveryNotice?: unknown;
  deliveryTimeline?: unknown;
  returnPolicy?: unknown;
  paymentInfo?: unknown;

  isCodActive?: unknown;
  isMomoActive?: unknown;
  momoNumber?: unknown;
  momoNetwork?: unknown;
  momoAccountName?: unknown;
  isPaystackActive?: unknown;
  isBankPaymentActive?: unknown;

  faqs?: unknown;

  aiAssistant?: {
    brandIntro?: unknown;
  } | null;

  themeConfig?: {
    deliveryInfo?: unknown;
    faqs?: unknown;
  } | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// ProductSearcher — injection seam for resolveExplicitProduct
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Optional dependency. When provided by the orchestrator, the explicit
 * resolver delegates to the production searchProducts() and gets all of
 * its catalog-aware behavior (typo tolerance, alias matching, common-word
 * downranking) for free.
 *
 * Synchronous because current Firestore search is in-memory.
 */
export type ProductSearcher = (query: string) => ProductSearchHit[];

export interface ProductSearchHit {
  product: KnowledgeProduct;
  /** Higher = better match. Scale is searcher-dependent. */
  score: number;
}