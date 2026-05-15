import type {
    KnowledgeDeliveryZone,
    KnowledgeTurnContext,
    QuestionIntent,
    Referent,
    StoreKnowledge,
  } from './types';
  
  /**
   * Resolves what the customer's question refers to, given the current turn
   * context and (for delivery questions) the customer's literal message.
   *
   * Resolution rules locked in PR design:
   *
   *   PRODUCT-shaped questions (q_price, q_stock, q_variants):
   *     1. orderSession.pendingProductId      → 'pending'
   *     2. lastMentionedProductId (if a single one) → 'last_mentioned'
   *     3. cart has exactly one line          → 'cart_single'
   *     4. otherwise                          → 'none'
   *
   *   DELIVERY questions (q_delivery_fee, q_delivery_time):
   *     1. If the customer's message names a known zone → 'delivery_named'
   *     2. Else if a zone is currently selected         → 'delivery_current'
   *     3. Else                                          → 'delivery_current' with zone=null
   *        (the answer builder will list zones)
   *
   *   Everything else: 'none' (these intents don't need referent resolution).
   *
   * Pure function. No side effects.
   */
  export function resolveReferent(
    intent: QuestionIntent,
    ctx: KnowledgeTurnContext,
    knowledge: StoreKnowledge,
  ): Referent {
    switch (intent) {
      case 'q_price':
      case 'q_stock':
      case 'q_variants':
        return resolveProductReferent(ctx);
  
      case 'q_delivery_fee':
      case 'q_delivery_time':
        return resolveDeliveryReferent(ctx, knowledge);
  
      default:
        return { kind: 'none' };
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // product referent
  // ─────────────────────────────────────────────────────────────────────────────
  
  function resolveProductReferent(ctx: KnowledgeTurnContext): Referent {
    // 1. pending product on the order session
    const pendingId = ctx.orderSession.pendingProductId ?? null;
    if (pendingId) {
      const p = ctx.productsById[pendingId];
      if (p) return { kind: 'product', product: p, source: 'pending' };
    }
  
    // 2. last mentioned product (if it still exists in catalog)
    const lastId = ctx.lastMentionedProductId ?? null;
    if (lastId) {
      const p = ctx.productsById[lastId];
      if (p) return { kind: 'product', product: p, source: 'last_mentioned' };
    }
  
    // 3. cart has exactly one line
    if (ctx.cart.lines.length === 1) {
      const line = ctx.cart.lines[0];
      const p = ctx.productsById[line.productId];
      if (p) return { kind: 'product', product: p, source: 'cart_single' };
    }
  
    // 4. nothing safe to assume
    return { kind: 'none' };
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // delivery referent
  // ─────────────────────────────────────────────────────────────────────────────
  
  function resolveDeliveryReferent(
    ctx: KnowledgeTurnContext,
    knowledge: StoreKnowledge,
  ): Referent {
    const named = matchZoneInMessage(ctx.customerMessage, knowledge.delivery.zones);
    if (named) return { kind: 'delivery_named', zone: named };
  
    const currentId = ctx.orderSession.selectedDeliveryZoneId ?? null;
    if (currentId) {
      const z = knowledge.delivery.zones.find((dz) => dz.id === currentId) ?? null;
      return { kind: 'delivery_current', zone: z };
    }
  
    return { kind: 'delivery_current', zone: null };
  }
  
  /**
   * Substring-matches a known delivery zone name inside the customer's message.
   * Catalog-aware: matches against the actual zones for this store, no
   * hardcoded location names.
   *
   * Match rules:
   *   - case-insensitive
   *   - whole word (zone name surrounded by non-letters or string boundary)
   *   - longest matching zone wins (so "East Legon" beats "Legon" if both exist)
   */
  function matchZoneInMessage(
    message: string,
    zones: KnowledgeDeliveryZone[],
  ): KnowledgeDeliveryZone | null {
    if (zones.length === 0) return null;
    const haystack = ` ${message.toLowerCase()} `;
  
    let best: KnowledgeDeliveryZone | null = null;
    let bestLen = 0;
  
    for (const z of zones) {
      const needle = z.name.toLowerCase().trim();
      if (needle.length === 0) continue;
      // require word-ish boundary on both sides
      const re = new RegExp(`(^|[^a-z0-9])${escapeRegex(needle)}([^a-z0-9]|$)`, 'i');
      if (re.test(haystack) && needle.length > bestLen) {
        best = z;
        bestLen = needle.length;
      }
    }
  
    return best;
  }
  
  function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }