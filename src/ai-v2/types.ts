import type { Timestamp } from 'firebase-admin/firestore';

export type Channel = 'whatsapp' | 'instagram' | 'webchat';

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
  | 'HANDOVER'
  | 'AWAITING_ORDER_LOOKUP'
  | 'AWAITING_SUPPORT_LOOKUP';

export type ResolvedBy =
  | 'exact'
  | 'alias'
  | 'variant'
  | 'token'
  | 'fuzzy'
  | 'inferred';

export type ProductVariantV2 = {
  id: string;
  name: string;
  price?: number;
  regularPrice?: number;
  stock?: number | null;
  image?: string | null;
  moq?: number | null;
};

export type ProductV2 = {
  id: string;
  name: string;
  price?: number;
  regularPrice?: number;
  description?: string;
  category?: string;
  brand?: string;
  tags?: string[];
  images?: string[];

  searchAliases?: string[];
  aliases?: string[];
  keywords?: string[];

  manageStock?: boolean;
  stock?: number | null;

  moq?: number | null;
  sellingStatus?: string;
  slug?: string;

  isArchived?: boolean;
  archivedAt?: unknown;
  isOutOfStock?: boolean;
  status?: string;

  hasVariants?: boolean;
  variants?: ProductVariantV2[];
};

export type ProductVariantForAi = ProductVariantV2;
export type ProductForAi = ProductV2;

export type DeliveryZoneV2 = {
  id: string;
  label: string;
  fee: number;
  type?: string;
};

export type DeliveryZoneForAi = DeliveryZoneV2;

export type CartItemV2 = {
  productId: string;
  variantId?: string | null;
  quantity: number;

  nameSnapshot?: string;
  variantNameSnapshot?: string | null;
  unitPriceSnapshot?: number;
  imageUrlSnapshot?: string | null;
};

export type CartItemForAi = CartItemV2;

export type OrderSessionV2 = {
  status:
    | 'building_cart'
    | 'collecting_details'
    | 'ready_for_checkout'
    | 'checkout_created'
    | 'paid'
    | 'cancelled';

  deliveryId?: string | null;
  deliveryLabel?: string | null;
  deliveryFee?: number | null;
  customerAddress?: string | null;

  checkoutUrl?: string | null;
  checkoutTotal?: number | null;
  checkoutCreatedAt?: Timestamp | null;
};

export type OrderSessionForAi = OrderSessionV2;

export type PersistedCommerceState = {
  state: CommerceState;
  stateEnteredAt?: Timestamp;
  expiresAt?: Timestamp;
  pendingOrderLookupIds?: string[] | null;
  /**
   * Set when the support flow asked for a phone or reference. Carries
   * the original intent so the next turn knows what to do once the
   * customer provides identifying info.
   */
  carriedSupportIntent?: string | null;

  pendingProductId?: string | null;
  pendingVariantId?: string | null;
  pendingProductOptions?: string[];

  lastShownProductIds?: string[];

  /**
   * The single product the customer is currently focused on. Updated by
   * any handler that surfaces a specific product (search single-match,
   * selection, variant reply, knowledge price/stock/variants answer with
   * a resolved product). Distinct from pendingProductId — this can be set
   * even when nothing is actively pending in the cart flow.
   */
  lastMentionedProductId?: string | null;

  /**
   * Exact ordered list of product IDs shown in the most recent product
   * cards, in display order. Used by ordinal selection ("the first one").
   * Differs from lastShownProductIds in that it is NEVER filtered for
   * purchasability — it must reflect what the customer literally saw.
   */
  displayedProductIds?: string[];

  /**
   * Set true after a checkout denial / "not now". While true:
   *   - bare "yes" does NOT re-trigger checkout confirmation
   *   - bare product names are not auto-searched as add intent
   *   - explicit commands (change address/delivery, add more items,
   *     show cart, where is my order, i paid) still route normally
   * Cleared by any explicit command or by an explicit add intent.
   */
  postDenialMode?: boolean;
};

export type TurnContext = {
  storeId: string;
  sellerId?: string;
  conversationId: string;
  channel: Channel;

  message: string;
  imageUrl?: string | null;

  storeData: any;
  convData: any;

  products: ProductV2[];
  deliveries: DeliveryZoneV2[];

  currentCart: CartItemV2[];
  orderSession: OrderSessionV2;
  commerceState: PersistedCommerceState;

  customer: {
    name: string | null;
    phone: string | null;
    address: string | null;
    instagramUserId?: string | null;
    whatsappId?: string | null;
    memory: import('./customer-memory/types').CustomerMemory | null;
  };
  /**
   * Last few messages from the conversation, oldest to newest, EXCLUDING
   * the current turn's user message. Used by the Gemini NLU prompt to
   * resolve anaphora ("the brown one") and bot-prompt context. Empty
   * array if conversation has no prior messages or load failed.
   */
  recentMessages?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}


export type ProductCardV2 = {
  productId: string;
  name: string;
  price: number;
  regularPrice?: number | null;
  imageUrl?: string | null;
  description?: string;
  stock?: number | null;
  manageStock?: boolean;
  hasVariants?: boolean;
  purchasable?: boolean;
  availabilityReason?: string;
  variants?: Array<{
    id: string;
    name: string;
    price: number;
    stock?: number | null;
    imageUrl?: string | null;
    purchasable?: boolean;
  }>;
};

export type AiV2Reply =
  | {
      type: 'text';
      content: string;
    }
  | {
      type: 'product_cards';
      content: string;
      products: ProductCardV2[];
    }
  | {
      type: 'action';
      action: 'checkout';
      label: string;
      url: string;
      content: string;
      total: number;
      items: any[];
    }
  | {
      type: 'silent';
      reason: string;
    };

export type AiTurnResult = {
  reply: AiV2Reply;
  debug?: {
    stateBefore?: CommerceState;
    stateAfter?: CommerceState;
    handler?: string;
    reason?: string;
  };
};