import type { Intent } from './types';

/**
 * TurnFactPacket — the verified output of executeTurnPlan().
 *
 * Composer (Phase 1D) speaks ONLY from this. Validators check claims
 * ONLY against this. Every field here has been verified against real
 * Firestore/catalog data — extraction's raw guesses don't make it in.
 *
 * The compound-message architecture in one type: a single packet can
 * carry verified product matches AND a verified zone AND verified
 * store info AND filled checkout slots, all at once. The composer
 * weaves them into one coherent reply.
 */

export type RoutingDecision = {
  /**
   * Which handler should drive the primary action this turn. String,
   * not HandlerKey, because the orchestrator owns the mapping.
   */
  primaryHandler:
    | 'handleProductSearch'
    | 'handleVariantReply'
    | 'handleQuantityReply'
    | 'handleDeliveryReply'
    | 'handleAddressReply'
    | 'handlePhoneReply'
    | 'handleNameReply'
    | 'handleCheckoutConfirmation'
    | 'handleCartUpdate'
    | 'handleInformationQuestion'
    | 'handleSupportRequest'
    | 'handleMetaIntent'
    | 'composer_only'
    | 'clarify'
    | 'handover';

  shouldClarify: boolean;
  shouldHandover: boolean;
  clarificationQuestion?: string;

  /** Free-text label for telemetry. */
  reason: string;
};

/**
 * Slots the executor verified and would like persisted to commerce
 * state and/or order session in one go. The orchestrator applies them
 * before the primary handler runs.
 */
export type FilledSlots = {
  productId?: string;
  variantId?: string;
  quantity?: number;
  deliveryId?: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
};

export type VerifiedProduct = {
  id: string;
  name: string;
  price: number;
  inStock: boolean;
  hasVariants: boolean;
  variantCount?: number;
  /** From getProductAvailability — useful for telemetry. */
  availabilityReason?: string;
};




/**
 * Products carried over from earlier in the conversation. Composer can
 * reference these by name and price even when this turn's
 * productDiscovery is empty — the customer is often talking about
 * something we already showed them.
 */
export type ContextProducts = {
  /** The product currently in focus (pendingProductId or lastMentionedProductId). */
  focusProduct?: VerifiedProduct;
  /** Other products shown earlier in this conversation. */
  recentlyShown: VerifiedProduct[];
  /** Products currently in the customer's cart (with their effective prices). */
  cartProducts: VerifiedProduct[];
};
/**
 * Product-discovery result. The composer reads `reason` and chooses
 * its frame; the customer never gets "no options available" when
 * alternatives exist in the store.
 *
 *   exact_match               — show exactMatches, ask for selection
 *   out_of_stock_alternatives — exact item is OOS; show alternatives
 *   in_domain_alternatives    — no exact match, but store has related items
 *   out_of_domain             — store doesn't sell this category at all
 */
export type ProductDiscovery = {
  reason:
    | 'exact_match'
    | 'out_of_stock_alternatives'
    | 'in_domain_alternatives'
    | 'out_of_domain';
  exactMatches: VerifiedProduct[];
  outOfStockMatches: VerifiedProduct[];
  alternativeProducts: VerifiedProduct[];
};

export type VerifiedZone = {
  id: string;
  label: string;
  fee: number;
  currency: 'GHS';
  etaText?: string | null;
  type?: string | null;
};

export type AppliedFilters = {
  colors?: string[];
  size?: string;
  fit?: string;
  material?: string;
  brand?: string;
};

export type StoreInfoFacts = {
  paymentMethods?: string[];
  deliveryAreas?: Array<{ label: string; fee: number }>;
  location?: string | null;
  hours?: string | null;
  refundPolicy?: string | null;
  aboutStore?: string | null;
  whatsappNumber?: string | null;
  email?: string | null;
  deliveryTimeline?: string | null;
};



/**
 * Slots and references already established in earlier turns of this
 * conversation. Produced by `collectEstablishedState` in
 * `executeTurnPlan` and attached to the FactPacket so the composer
 * and orchestrator can reference what is already known without
 * re-asking the customer.
 */
export type EstablishedState = {
  deliveryZone?: VerifiedZone;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  pendingProductId?: string;
  pendingProductName?: string;
  pendingVariantId?: string;
  pendingVariantName?: string;
  quantity?: number;
};

/**
 * Verified facts the composer can speak from. Anything not in here is
 * NOT allowed to appear in the final reply.
 */
export type VerifiedFacts = {
  productDiscovery?: ProductDiscovery;
  /** Products from earlier turns in the conversation — focus, recently shown, cart. */
  contextProducts?: ContextProducts;
  appliedFilters?: AppliedFilters;
  droppedFilters?: string[]; // filters extraction said but catalog doesn't support
  priceRange?: {
    min: number;
    max: number;
    median: number;
    currency: 'GHS';
  };
  matchedZone?: VerifiedZone;
  sameDayFeasible?: boolean;
  storeInfo?: StoreInfoFacts;
  cartTotal?: number;
  /** Slots already filled in earlier turns of the conversation. */
  establishedState?: EstablishedState;
  /** Pass-through context (occasion, recipient) for composer to acknowledge. */
  context?: {
    occasion?: string;
    recipient?: string;
    useCase?: string;
  };
};

/**
 * Telemetry for the dashboard / divergence comparison. Mirror of what
 * the executor did, regardless of routing decision.
 */
export type ExecutionTelemetry = {
  handledTasks: Intent[];
  unhandledTasks: Intent[];
  verifierFailures: string[]; // e.g. ["zone_not_matched", "phone_invalid_format"]
  filterDropReasons: string[]; // e.g. ["fit_not_in_catalog"]
};

export type TurnFactPacket = {
  routing: RoutingDecision;
  filled: FilledSlots;
  facts: VerifiedFacts;
  telemetry: ExecutionTelemetry;
};