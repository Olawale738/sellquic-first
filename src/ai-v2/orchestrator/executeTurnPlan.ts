import type { TurnContext, ProductV2 } from '../types';
import type {
  TurnPlan,
  ProductNeed,
  CheckoutSlots,
  Constraints,
  StoreInfoQuestions,
  SupportContext,
} from '../nlu/turnPlanSchema';
import type {
  TurnFactPacket,
  VerifiedProduct,
  VerifiedZone,
  AppliedFilters,
  StoreInfoFacts,
  RoutingDecision,
  ProductDiscovery,
  ContextProducts,
  EstablishedState,
} from '../nlu/turnFactPacket';
import { hasInfoQuestions, hasSupportContext } from '../nlu/turnPlanSchema';
import { resolveDeliveryZoneSmart } from '../delivery/resolveDeliveryZoneSmart';
import { searchProducts } from '../search/searchProducts';
import { getProductAvailability, isVariantPurchasable } from '../catalog/availability';

/**
 * executeTurnPlan — Phase 1C of the compound-message architecture.
 *
 * Reuses the existing searchProducts engine (with weighted scoring,
 * aliases, attribute boosts, core-noun gate, confidence gates) and
 * getProductAvailability (variant-aware stock detection). The executor
 * itself is a verifier + fact-packet assembler — it doesn't reinvent
 * search.
 */
export async function executeTurnPlan(
  plan: TurnPlan,
  ctx: TurnContext,
  apiKey: string,
): Promise<TurnFactPacket> {
  const handledTasks: TurnFactPacket['telemetry']['handledTasks'] = [];
  const unhandledTasks: TurnFactPacket['telemetry']['unhandledTasks'] = [];
  const verifierFailures: string[] = [];
  const filterDropReasons: string[] = [];

  // 1. Clarify shortcut
  if (plan.stateAction === 'clarify' && plan.clarificationQuestion) {
    return {
      routing: {
        primaryHandler: 'clarify',
        shouldClarify: true,
        shouldHandover: false,
        clarificationQuestion: plan.clarificationQuestion,
        reason: `extraction_clarify:${plan.reason || 'low_confidence'}`,
      },
      filled: {},
      facts: {},
      telemetry: {
        handledTasks: [],
        unhandledTasks: plan.tasks.map((t) => t.intent),
        verifierFailures: [],
        filterDropReasons: [],
      },
    };
  }

  // 2. Support routing — early bail
  if (hasSupportContext(plan) && plan.supportContext) {
    const supportReason = supportReasonFor(plan.supportContext);
    return {
      routing: {
        primaryHandler: 'handleSupportRequest',
        shouldClarify: false,
        shouldHandover: false,
        reason: `support_context:${supportReason}`,
      },
      filled: {},
      facts: {},
      telemetry: {
        handledTasks: plan.tasks.map((t) => t.intent),
        unhandledTasks: [],
        verifierFailures: [],
        filterDropReasons: [],
      },
    };
  }

  // 3. Verify product need + filters (using existing search engine)
  const productResult = await verifyProductNeed(plan.productNeed, ctx);
  if (productResult.dropped.length) {
    filterDropReasons.push(...productResult.dropped);
  }

  // 4. Verify delivery zone
  let matchedZone: VerifiedZone | undefined;
  let zoneResolutionFailed = false;
  if (plan.checkoutSlots?.deliveryZone) {
    const resolved = await resolveDeliveryZoneSmart(
      plan.checkoutSlots.deliveryZone,
      ctx.deliveries || [],
      apiKey,
    );
    if (resolved.status === 'single_match' && resolved.zone) {
      const z = resolved.zone as any;
      matchedZone = {
        id: resolved.zone.id,
        label: resolved.zone.label,
        fee: Number(resolved.zone.fee || 0),
        currency: 'GHS',
        etaText: z.etaText || z.timeline || null,
        type: z.type || null,
      };
    }
    if (!matchedZone) {
      zoneResolutionFailed = true;
      verifierFailures.push(`zone_not_matched:${resolved.status}`);
    }
  }

  // 5. Verify checkout slots
  const filled = verifyCheckoutSlots(plan.checkoutSlots, matchedZone, ctx, verifierFailures);

  // 6. Same-day feasibility
  const sameDayFeasible = computeSameDayFeasible(plan.constraints, matchedZone, ctx);

  // 7. Store info facts
  const storeInfo = plan.storeInfoQuestions ? collectStoreInfo(plan.storeInfoQuestions, ctx) : undefined;

  // 8. Price range from the discovery pool
  const priceRange = computePriceRange(productResult.discovery);

  // 9. Cart total
  const cartTotal = computeCartTotal(ctx);

  // 9b. Conversation-context products (focus + recently shown + cart).
  // The composer needs these to talk about products discussed in
  // earlier turns; the validator needs them to allow their numbers.
  const contextProducts = collectContextProducts(ctx);

  // 9c. Established commerce state — slots already filled in earlier
  // turns. Composer must not ask for these again; validator must allow
  // their numbers (e.g. delivery fee from a previous turn).
  const establishedState = collectEstablishedState(ctx);

  // 10. Routing decision
  const routing = decideRouting(plan, {
    productMatched: productResult.discovery.exactMatches.length > 0,
    productQueryRequested: !!plan.productNeed?.query,
    hasAlternatives: productResult.discovery.alternativeProducts.length > 0,
    matchedZone,
    zoneResolutionFailed,
    filled,
    storeInfoAsked: hasInfoQuestions(plan),
  });

  // 11. Mark handled vs unhandled tasks (telemetry)
  for (const task of plan.tasks) {
    if (isHandledByExecutor(task.intent, routing, productResult, storeInfo, filled)) {
      handledTasks.push(task.intent);
    } else {
      unhandledTasks.push(task.intent);
    }
  }

  return {
    routing,
    filled,
    facts: {
      productDiscovery: productResult.discovery,
      contextProducts,
      establishedState,
      appliedFilters: productResult.applied,
      droppedFilters: productResult.dropped,
      priceRange,
      matchedZone,
      sameDayFeasible,
      storeInfo,
      cartTotal,
      context: {
        occasion: plan.productNeed?.occasion,
        recipient: plan.productNeed?.recipient,
        useCase: plan.productNeed?.useCase,
      },
    },
    telemetry: {
      handledTasks,
      unhandledTasks,
      verifierFailures,
      filterDropReasons,
    },
  };
}

// ─── verifyProductNeed (NEW: reuses searchProducts + availability) ───
async function verifyProductNeed(
  need: ProductNeed | undefined,
  ctx: TurnContext,
): Promise<{
  discovery: ProductDiscovery;
  applied: AppliedFilters;
  dropped: string[];
}> {
  const noQuery = !need || !need.query || need.query.trim().length === 0;

  // No specific query → populate alternatives from the store's catalog
  // if it has any. This is the truthful default: when the customer asks
  // "what do you sell?" / "show me your catalog" / says "thank you", we
  // hand the composer a non-empty pool so it never claims the store is
  // empty when it isn't.
  //
  // The composer doesn't HAVE to mention these (for unrelated turns
  // like "thank you" it won't), but having them prevents the bot from
  // telling customers "we have no items" when we clearly do.
  if (noQuery) {
    const allProducts = ctx.products || [];
    const alternativeProducts =
      allProducts.length > 0 ? pickAlternatives(allProducts, new Set(), 4) : [];
    return {
      discovery: {
        reason: alternativeProducts.length > 0 ? 'in_domain_alternatives' : 'out_of_domain',
        exactMatches: [],
        outOfStockMatches: [],
        alternativeProducts,
      },
      applied: {},
      dropped: [],
    };
  }

  // 1. Reuse the existing search engine.
  let searchResult: any = null;
  try {
    searchResult = await searchProducts({
      query: need!.query!,
      products: ctx.products || [],
      storeId: ctx.storeId,
      limit: 6,
    });
  } catch (err) {
    console.error('[executeTurnPlan] searchProducts failed:', err);
  }

  const rawMatches: ProductV2[] =
    searchResult && searchResult.status !== 'no_match' && Array.isArray(searchResult.products)
      ? (searchResult.products as ProductV2[])
      : [];

  // 2. Apply post-filters (color/size/fit/material/brand) to the raw matches.
  const { kept, applied, dropped } = applyPostFilters(rawMatches, need!);

  // 3. Split kept matches by availability (variant-aware via getProductAvailability).
  const exactMatches: VerifiedProduct[] = [];
  const outOfStockMatches: VerifiedProduct[] = [];
  for (const p of kept) {
    const av = getProductAvailability(p);
    const v = toVerifiedProduct(p, av);
    if (av.purchasable) exactMatches.push(v);
    else outOfStockMatches.push(v);
  }

  // 4. Determine fallback reason and alternatives.
  let reason: ProductDiscovery['reason'];
  let alternativeProducts: VerifiedProduct[] = [];
  const allProducts = ctx.products || [];

  if (exactMatches.length > 0) {
    reason = 'exact_match';
    // No alternatives needed.
  } else if (outOfStockMatches.length > 0) {
    reason = 'out_of_stock_alternatives';
    alternativeProducts = pickAlternatives(
      allProducts,
      new Set(outOfStockMatches.map((m) => m.id)),
      4,
    );
  } else if (allProducts.length > 0) {
    // Search didn't find an exact match, but the store has products. Offer
    // alternatives instead of saying "we don't have it."
    reason = 'in_domain_alternatives';
    alternativeProducts = pickAlternatives(allProducts, new Set(), 4);
  } else {
    // Truly nothing.
    reason = 'out_of_domain';
  }

  return {
    discovery: { reason, exactMatches, outOfStockMatches, alternativeProducts },
    applied,
    dropped,
  };
}

function applyPostFilters(
  products: ProductV2[],
  need: ProductNeed,
): { kept: ProductV2[]; applied: AppliedFilters; dropped: string[] } {
  let candidates = products;
  const applied: AppliedFilters = {};
  const dropped: string[] = [];

  if (need.colors && need.colors.length > 0) {
    const matches = candidates.filter((p: any) => {
      const fields = [p.name, p.description].join(' ').toLowerCase();
      const variants = Array.isArray(p.variants) ? p.variants : [];
      const variantNames = variants.map((v: any) => v.name || '').join(' ').toLowerCase();
      return need.colors!.some(
        (c) => fields.includes(c.toLowerCase()) || variantNames.includes(c.toLowerCase()),
      );
    });
    if (matches.length > 0) {
      candidates = matches;
      applied.colors = need.colors;
    } else {
      dropped.push(`colors_no_match:${need.colors.join(',')}`);
    }
  }

  if (need.size) {
    const matches = candidates.filter((p: any) => {
      const variants = Array.isArray(p.variants) ? p.variants : [];
      const variantNames = variants.map((v: any) => (v.name || '').toLowerCase()).join(' ');
      return variantNames.includes(need.size!.toLowerCase());
    });
    if (matches.length > 0) {
      candidates = matches;
      applied.size = need.size;
    } else {
      dropped.push(`size_no_match:${need.size}`);
    }
  }

  if (need.fit) {
    const matches = candidates.filter((p: any) => {
      const haystack = `${p.name || ''} ${p.description || ''}`.toLowerCase();
      return haystack.includes(need.fit!.toLowerCase());
    });
    if (matches.length > 0) {
      candidates = matches;
      applied.fit = need.fit;
    } else dropped.push(`fit_not_in_catalog:${need.fit}`);
  }

  if (need.material) {
    const matches = candidates.filter((p: any) =>
      `${p.name} ${p.description}`.toLowerCase().includes(need.material!.toLowerCase()),
    );
    if (matches.length > 0) {
      candidates = matches;
      applied.material = need.material;
    } else dropped.push(`material_not_in_catalog:${need.material}`);
  }

  if (need.brand) {
    const matches = candidates.filter((p: any) =>
      `${p.name} ${p.description}`.toLowerCase().includes(need.brand!.toLowerCase()),
    );
    if (matches.length > 0) {
      candidates = matches;
      applied.brand = need.brand;
    } else dropped.push(`brand_not_in_catalog:${need.brand}`);
  }

  return { kept: candidates, applied, dropped };
}

function pickAlternatives(
  allProducts: ProductV2[],
  excludeIds: Set<string>,
  limit: number,
): VerifiedProduct[] {
  return allProducts
    .filter((p) => !excludeIds.has(p.id))
    .map((p) => ({ p, av: getProductAvailability(p) }))
    .filter((x) => x.av.purchasable)
    .sort((a, b) => {
      // Best sellers first (mirrors handleProductSearch's sortRecommendedProducts).
      const aBest = String((a.p as any).sellingStatus || '').toLowerCase().includes('best') ? 1 : 0;
      const bBest = String((b.p as any).sellingStatus || '').toLowerCase().includes('best') ? 1 : 0;
      return bBest - aBest;
    })
    .slice(0, limit)
    .map((x) => toVerifiedProduct(x.p, x.av));
}

function toVerifiedProduct(
  p: ProductV2,
  availability: { purchasable: boolean; reason: string },
): VerifiedProduct {
  const rawVariants = Array.isArray((p as any).variants) ? (p as any).variants : [];
  const variants = rawVariants.map((v: any) => ({
    id: String(v.id || ''),
    name: String(v.name || '').trim(),
    price: typeof v.price === 'number' ? v.price : undefined,
    // Use the canonical availability function — accounts for manageStock,
    // product status, isOutOfStock, etc. (variant-stock alone is wrong.)
    inStock: isVariantPurchasable(p, v),
    imageUrl: v.imageUrl || v.image || v.imageURL || null,
  })).filter((v: any) => v.name.length > 0);

  return {
    id: p.id,
    name: p.name,
    price: Number((p as any).price || 0),
    inStock: availability.purchasable,
    hasVariants: rawVariants.length > 0,
    variantCount: rawVariants.length,
    variants,
    availabilityReason: availability.reason,
  };
}

// ─── verifyCheckoutSlots ─────────────────────────────────────────────
const GHANA_PHONE_REGEX = /^0[2-5][0-9]{8}$/;

function verifyCheckoutSlots(
  slots: CheckoutSlots | undefined,
  matchedZone: VerifiedZone | undefined,
  ctx: TurnContext,
  failures: string[],
): TurnFactPacket['filled'] {
  const filled: TurnFactPacket['filled'] = {};
  if (!slots) return filled;

  if (typeof slots.quantity === 'number' && slots.quantity > 0 && slots.quantity <= 9999) {
    filled.quantity = Math.floor(slots.quantity);
  } else if (slots.quantity != null) {
    failures.push('quantity_invalid');
  }

  if (slots.phone) {
    const cleaned = slots.phone.replace(/[\s-+()]/g, '');
    const normalized = cleaned.startsWith('233') ? '0' + cleaned.slice(3) : cleaned;
    if (GHANA_PHONE_REGEX.test(normalized)) {
      filled.customerPhone = normalized;
    } else {
      failures.push('phone_invalid_format');
    }
  }

  if (slots.name) {
    const trimmed = slots.name.trim();
    if (trimmed.length >= 2 && trimmed.length <= 80) {
      filled.customerName = trimmed;
    } else {
      failures.push('name_invalid_length');
    }
  }

  if (slots.addressText) {
    const trimmed = slots.addressText.trim();
    if (trimmed.length >= 3) filled.customerAddress = trimmed;
  }

  if (matchedZone) filled.deliveryId = matchedZone.id;

  return filled;
}

function computeSameDayFeasible(
  constraints: Constraints | undefined,
  zone: VerifiedZone | undefined,
  ctx: TurnContext,
): boolean | undefined {
  if (!constraints || (!constraints.sameDayPreferred && !constraints.deliveryDeadline)) return undefined;
  if (!zone) return undefined;
  const eta = (zone.etaText || '').toLowerCase();
  if (eta.includes('same day') || eta.includes('same-day') || eta.includes('today')) return true;
  const label = zone.label.toLowerCase();
  if (label.includes('same day') || label.includes('same-day')) return true;
  return false;
}

function collectStoreInfo(asked: StoreInfoQuestions, ctx: TurnContext): StoreInfoFacts {
  const store = ctx.storeData || {};
  const info: StoreInfoFacts = {};

  if (asked.askPaymentMethods) {
    const methods: string[] = [];
    if (store.isPaystackActive || store.paymentInfo?.split_configured)
      methods.push('Momo or Card via secure portal');
    if (store.momoNumber || store.bankName) methods.push('Direct transfer');
    if (store.isCodActive) methods.push('Cash on delivery');
    info.paymentMethods = methods;
  }
  if (asked.askDeliveryAreas) {
    info.deliveryAreas = (ctx.deliveries || []).slice(0, 6).map((d: any) => {
      const data = typeof d.data === 'function' ? d.data() : d;
      return { label: data.label, fee: Number(data.fee || 0) };
    });
  }
  if (asked.askLocation) info.location = store.address || null;
  if (asked.askHours) info.hours = store.businessHours || store.hours || null;
  if (asked.askRefundPolicy) {
    info.refundPolicy = store.isReturnPolicyActive && store.returnPolicy ? store.returnPolicy : null;
  }
  if (asked.askAboutStore) {
    info.aboutStore = store.isAboutUsActive && store.aboutUs ? store.aboutUs : null;
  }
  if (asked.askContact) {
    info.whatsappNumber = store.whatsappNumber || store.phone || null;
    info.email = store.email || null;
  }
  if (asked.askDeliveryTime) {
    info.deliveryTimeline = store.deliveryTimeline || store.deliveryNotice || null;
  }
  return info;
}

function computePriceRange(
  discovery: ProductDiscovery,
): TurnFactPacket['facts']['priceRange'] | undefined {
  // Use exactMatches if any, else alternatives. Don't compute from
  // outOfStockMatches alone (misleading for budget guidance).
  const pool =
    discovery.exactMatches.length > 0 ? discovery.exactMatches : discovery.alternativeProducts;
  const prices = pool.map((p) => p.price).filter((p) => p > 0);
  if (prices.length === 0) return undefined;
  prices.sort((a, b) => a - b);
  return {
    min: prices[0],
    max: prices[prices.length - 1],
    median: prices[Math.floor(prices.length / 2)],
    currency: 'GHS',
  };
}

function collectContextProducts(ctx: TurnContext): ContextProducts {
  const allProducts = ctx.products || [];
  const state = ctx.commerceState;

  const findVerified = (id: string | null | undefined): VerifiedProduct | undefined => {
    if (!id) return undefined;
    const p = allProducts.find((pp: any) => pp.id === id);
    if (!p) return undefined;
    return toVerifiedProduct(p, getProductAvailability(p));
  };

  const focusId = state.pendingProductId || state.lastMentionedProductId || null;
  const focusProduct = findVerified(focusId);

  const recentIds = Array.isArray(state.lastShownProductIds) ? state.lastShownProductIds : [];
  const recentlyShown = recentIds
    .filter((id) => id !== focusId)
    .map((id) => findVerified(id))
    .filter((p): p is VerifiedProduct => p !== undefined)
    .slice(0, 6);

  const cart = Array.isArray(ctx.currentCart) ? ctx.currentCart : [];
  const cartProducts: VerifiedProduct[] = [];
  const seenCartIds = new Set<string>();
  for (const item of cart) {
    if (!item.productId || seenCartIds.has(item.productId)) continue;
    seenCartIds.add(item.productId);
    const verified = findVerified(item.productId);
    if (verified) cartProducts.push(verified);
  }

  return { focusProduct, recentlyShown, cartProducts };
}

function collectEstablishedState(ctx: TurnContext): EstablishedState {
  const state = ctx.commerceState as any;
  const customer = (ctx as any).customer;
  const allProducts = ctx.products || [];

  // Resolve already-established delivery zone (from prior turn).
  let deliveryZone: VerifiedZone | undefined;
  const establishedDeliveryId = state?.deliveryId || null;
  if (establishedDeliveryId) {
    const z: any = (ctx.deliveries || []).find((d: any) => d.id === establishedDeliveryId);
    if (z) {
      deliveryZone = {
        id: z.id,
        label: z.label,
        fee: Number(z.fee || 0),
        currency: 'GHS',
        etaText: z.etaText || z.timeline || null,
        type: z.type || null,
      };
    }
  }

  // Resolve pending product / variant names.
  let pendingProductName: string | undefined;
  let pendingVariantName: string | undefined;
  const pendingProductId = state?.pendingProductId || state?.lastMentionedProductId || undefined;
  const pendingVariantId = state?.pendingVariantId || undefined;
  if (pendingProductId) {
    const p: any = allProducts.find((pp: any) => pp.id === pendingProductId);
    if (p) {
      pendingProductName = p.name;
      if (pendingVariantId && Array.isArray(p.variants)) {
        const v = p.variants.find((vv: any) => vv.id === pendingVariantId);
        if (v) pendingVariantName = v.name;
      }
    }
  }

  return {
    deliveryZone,
    customerName: customer?.name || customer?.memory?.name || undefined,
    customerPhone: customer?.phone || customer?.memory?.phone || undefined,
    customerAddress: customer?.address || customer?.memory?.address || undefined,
    pendingProductId,
    pendingProductName,
    pendingVariantId,
    pendingVariantName,
    quantity:
      typeof state?.pendingQuantity === 'number'
        ? state.pendingQuantity
        : typeof state?.quantity === 'number'
        ? state.quantity
        : undefined,
  };
}

function computeCartTotal(ctx: TurnContext): number | undefined {
  const cart = ctx.currentCart;
  if (!Array.isArray(cart) || cart.length === 0) return undefined;
  const products = ctx.products || [];
  let total = 0;
  for (const item of cart) {
    const p = products.find((pp: any) => pp.id === item.productId);
    if (!p) continue;
    let price = Number((p as any).price || 0);
    if (item.variantId && Array.isArray((p as any).variants)) {
      const v = (p as any).variants.find((vv: any) => vv.id === item.variantId);
      if (v && typeof v.price === 'number') price = v.price;
    }
    total += price * (item.quantity || 1);
  }
  return total;
}

// ─── decideRouting ───────────────────────────────────────────────────
function decideRouting(
  plan: TurnPlan,
  signals: {
    productMatched: boolean;
    productQueryRequested: boolean;
    hasAlternatives: boolean;
    matchedZone?: VerifiedZone;
    zoneResolutionFailed: boolean;
    filled: TurnFactPacket['filled'];
    storeInfoAsked: boolean;
  },
): RoutingDecision {
  if (plan.stateAction === 'fill_multiple_slots' && Object.keys(signals.filled).length > 0) {
    if (signals.productQueryRequested && (signals.productMatched || signals.hasAlternatives)) {
      return {
        primaryHandler: 'handleProductSearch',
        shouldClarify: false,
        shouldHandover: false,
        reason: 'fill_multiple_slots:product_search',
      };
    }
    return {
      primaryHandler: 'handleCartUpdate',
      shouldClarify: false,
      shouldHandover: false,
      reason: 'fill_multiple_slots:apply_slots',
    };
  }

  if (signals.storeInfoAsked && !signals.productQueryRequested) {
    return {
      primaryHandler: 'handleInformationQuestion',
      shouldClarify: false,
      shouldHandover: false,
      reason: 'store_info_only',
    };
  }

  if (signals.productQueryRequested) {
    return {
      primaryHandler: 'handleProductSearch',
      shouldClarify: false,
      shouldHandover: false,
      reason: signals.productMatched
        ? 'product_query_matched'
        : signals.hasAlternatives
        ? 'product_query_alternatives'
        : 'product_query_no_match',
    };
  }

  if (plan.primaryIntent === 'say_yes') {
    const hasBrowsingTask = plan.tasks.some(
      (t) =>
        t.intent === 'command_catalog_discovery' ||
        t.intent === 'command_add_more' ||
        t.intent === 'provide_product_query',
    );
    if (hasBrowsingTask) {
      return {
        primaryHandler: 'handleProductSearch',
        shouldClarify: false,
        shouldHandover: false,
        reason: 'say_yes_with_browsing_task',
      };
    }
  }


  // Show-focus-product is its own routing path. Marks the routing
  // reason explicitly so telemetry distinguishes "show focus" from
  // "search for a new product".
  if (plan.primaryIntent === 'command_show_product') {
    return {
      primaryHandler: 'handleProductSearch',
      shouldClarify: false,
      shouldHandover: false,
      reason: 'show_focus_product',
    };
  }

  return {
    primaryHandler: handlerForIntent(plan.primaryIntent),
    shouldClarify: false,
    shouldHandover: false,
    reason: `primary_intent:${plan.primaryIntent}`,
  };
}

function handlerForIntent(intent: TurnPlan['primaryIntent']): RoutingDecision['primaryHandler'] {
  switch (intent) {
    case 'provide_product_query':
    case 'command_add_more':
    case 'command_catalog_discovery':
    case 'command_show_product':
    case 'meta_greeting':
      return 'handleProductSearch';
    case 'provide_variant_choice':
      return 'handleVariantReply';
    case 'provide_quantity':
      return 'handleQuantityReply';
    case 'provide_delivery_zone':
    case 'command_change_delivery':
      return 'handleDeliveryReply';
    case 'provide_address':
    case 'command_change_address':
      return 'handleAddressReply';
    case 'provide_phone':
    case 'command_change_phone':
      return 'handlePhoneReply';
    case 'provide_name':
    case 'command_change_name':
      return 'handleNameReply';
    case 'provide_ordinal_selection':
      return 'composer_only';
    case 'say_yes':
    case 'say_no':
    case 'say_unclear':
      return 'handleCheckoutConfirmation';
    case 'command_clear_cart':
    case 'command_show_cart':
      return 'handleCartUpdate';
    case 'command_handover':
      return 'handover';
    case 'command_refund_request':
    case 'command_return_request':
    case 'command_exchange_request':
    case 'command_cancel_order':
    case 'command_damaged_item':
    case 'command_wrong_item':
    case 'command_late_delivery':
    case 'command_general_complaint':
    case 'command_payment_issue':
      return 'handleSupportRequest';
    default:
      return 'handleInformationQuestion';
  }
}

function supportReasonFor(s: SupportContext): string {
  if (s.refundRequested) return 'refund';
  if (s.cancelRequested) return 'cancel';
  if (s.exchangeRequested) return 'exchange';
  if (s.damagedItem) return 'damaged';
  if (s.wrongItem) return 'wrong_item';
  if (s.paymentDispute) return 'payment_dispute';
  if (s.lateDelivery) return 'late_delivery';
  if (s.generalComplaint) return 'general_complaint';
  return 'unknown';
}

function isHandledByExecutor(
  intent: TurnPlan['primaryIntent'],
  routing: RoutingDecision,
  productResult: { discovery: ProductDiscovery },
  storeInfo: StoreInfoFacts | undefined,
  filled: TurnFactPacket['filled'],
): boolean {
  if (intent.startsWith('ask_') && storeInfo && Object.keys(storeInfo).length > 0) return true;
  if (intent === 'provide_product_query') {
    const d = productResult.discovery;
    return d.exactMatches.length > 0 || d.alternativeProducts.length > 0;
  }
  if (intent === 'provide_phone' && filled.customerPhone) return true;
  if (intent === 'provide_name' && filled.customerName) return true;
  if (intent === 'provide_address' && filled.customerAddress) return true;
  if (intent === 'provide_delivery_zone' && filled.deliveryId) return true;
  if (intent === 'provide_quantity' && filled.quantity != null) return true;
  return false;
}
