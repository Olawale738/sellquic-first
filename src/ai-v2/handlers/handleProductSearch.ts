import { db } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { AiTurnResult, ProductV2, TurnContext } from '../types';
import { searchProducts } from '../search/searchProducts';
import type { ProductSearchResult } from '../search/types';
import type { ProductDiscovery } from '../nlu/turnFactPacket';
import { formatProductCards } from '../catalog/formatProductCards';
import { getProductAvailability } from '../catalog/availability';
import { createCommerceState } from '../state/commerceState';



function isGreeting(message: string): boolean {
  const text = String(message || '').toLowerCase().trim();
  // Match greetings with optional politeness prefix/suffix:
  //   "hi", "hello there", "good evening please", "please good evening"
  return /^(please\s+)?(hi+|hello+|hey+|good\s+(morning|afternoon|evening|day|night)|yo|sup|how('?s| is) it going|how are you|how far)(\s+please)?\s*[!.?]*$/i.test(text);
}
  


/**
 * Returns true if the message LOOKS LIKE a product search.
 *
 * Positive signal — we accept it as a product query when:
 *   - It contains a known catalog token (we'd have classified it
 *     anyway, this is belt-and-suspenders)
 *   - It uses product-search verbs ("show me X", "do you have Y",
 *     "looking for Z", "i want", "i need")
 *   - It's a bare noun phrase 2-5 words long (typical "<product name>"
 *     queries)
 *
 * Anything else returns false → caller routes to Gemini fallback.
 *
 * Note: catalog token check happens upstream in the classifier. This
 * function is just defending against legacy routing paths that bypass
 * the classifier.
 */
function isMessageProductShaped(message: string): boolean {
  const text = message.toLowerCase().trim();
  if (!text) return false;
  if (text.length <= 2) return false;

  // Product-search verbs
  if (/\b(show me|i want|i need|i'?m looking for|looking for|do you have|do you sell|got any|have you got|any chance you (have|sell)|got\s+\w+\??|find me|get me)\b/i.test(text)) {
    return true;
  }

  // Bare 2-5 word noun phrase, no question/filler markers
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length >= 1 && words.length <= 5) {
    const hasFiller = /\b(hi|hello|hey|thanks?|ok|alright|please|sure|fine|cool|nice|done|good|how|what|where|why|when|who|do|does|is|are|will|would|should|can|could|tell|let|forget|nevermind|just|really|seriously)\b/i.test(text);
    const hasPunctuation = /[?!]$/.test(text);
    if (!hasFiller && !hasPunctuation) {
      return true;
    }
  }

  return false;
}

function isBroadBrowseIntent(message: string): boolean {
  const text = String(message || '').toLowerCase().trim();

  return /\b(show me|what do you have|catalog|browse|all products|all items|show products|products available|what is available)\b/i.test(
    text
  );
}

function formatVariantOptionsForCustomer(product: any): string {
  const variants = Array.isArray(product.variants) ? product.variants : [];

  if (variants.length === 0) {
    return '';
  }

  const availableVariants = variants.filter((variant: any) => {
    return variant?.isOutOfStock !== true && variant?.outOfStock !== true && variant?.stock !== 0;
  });

  const list = (availableVariants.length ? availableVariants : variants)
    .slice(0, 8)
    .map((variant: any) => {
      const name = String(variant?.name || '').trim();
      const price =
        typeof variant?.price === 'number'
          ? ` — GHS ${variant.price.toFixed(2)}`
          : '';

      return name ? `${name}${price}` : null;
    })
    .filter(Boolean);

  if (list.length === 0) {
    return '';
  }

  if (list.length === 1) {
    return `It comes in ${list[0]}.`;
  }

  return `It comes in ${list.slice(0, -1).join(', ')}, and ${list[list.length - 1]}.`;
}

function sortRecommendedProducts(products: ProductV2[]): ProductV2[] {
  return [...products].sort((a, b) => {
    const aBest = String(a.sellingStatus || '').toLowerCase().includes('best') ? 1 : 0;
    const bBest = String(b.sellingStatus || '').toLowerCase().includes('best') ? 1 : 0;

    return bBest - aBest;
  });
}

async function persistCommerceState(
  ctx: TurnContext,
  state: ReturnType<typeof createCommerceState>
) {
  const convRef = db
    .collection('stores')
    .doc(ctx.storeId)
    .collection('ai_conversations')
    .doc(ctx.conversationId);

  await convRef.set(
    {
      commerceState: state,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

function buildGreetingCopy(ctx: TurnContext): string {
  const storeName = ctx.storeData?.name || 'our store';
  const memoryName = ctx.customer?.memory?.name?.trim();
  const isReturning = ctx.customer?.memory?.isReturningCustomer === true;

  if (memoryName && isReturning) {
    return `Hi ${memoryName}, welcome back to ${storeName}! What can I get for you today?`;
  }

  return `Hi! Welcome to ${storeName}. What can I get for you today?`;
}

// Phase 0C: synthesize a ProductSearchResult from the executor's
// verified exactMatches so the handler stops re-searching the raw
// message when executeTurnPlan already found a product. Returns null
// when no verified id resolves to a full ProductV2 in ctx.products.
function synthesizeFromVerifiedExactMatches(
  discovery: ProductDiscovery,
  products: ProductV2[],
): ProductSearchResult | null {
  if (discovery.exactMatches.length === 0) return null;
  const productsById = new Map(products.map((p) => [p.id, p]));
  const resolved = discovery.exactMatches
    .map((m) => productsById.get(m.id))
    .filter((p): p is ProductV2 => !!p);
  if (resolved.length === 0) return null;
  if (resolved.length === 1) {
    return {
      status: 'single_match',
      confidence: 1,
      products: resolved,
      reason: 'verified_exact_match_from_fact_packet',
      provider: 'firestore_weighted_fallback',
    };
  }
  return {
    status: 'multiple_matches',
    confidence: 1,
    products: resolved,
    reason: 'verified_exact_matches_from_fact_packet',
    provider: 'firestore_weighted_fallback',
  };
}

// Phase 0E: rescue search misses with in-domain alternatives the
// executor already verified. Only fires when the executor's reason is
// 'in_domain_alternatives' — never for out_of_domain or
// out_of_stock_alternatives. Returns null when no alternative id
// resolves to a real product in ctx.products.
function synthesizeFromInDomainAlternatives(
  discovery: ProductDiscovery,
  products: ProductV2[],
): ProductSearchResult | null {
  if (discovery.reason !== 'in_domain_alternatives') return null;
  if (discovery.alternativeProducts.length === 0) return null;
  const productsById = new Map(products.map((p) => [p.id, p]));
  const resolved = discovery.alternativeProducts
    .map((m) => productsById.get(m.id))
    .filter((p): p is ProductV2 => !!p);
  if (resolved.length === 0) return null;
  if (resolved.length === 1) {
    return {
      status: 'single_match',
      confidence: 1,
      products: resolved,
      reason: 'in_domain_alternatives_from_fact_packet',
      provider: 'firestore_weighted_fallback',
    };
  }
  return {
    status: 'multiple_matches',
    confidence: 1,
    products: resolved,
    reason: 'in_domain_alternatives_from_fact_packet',
    provider: 'firestore_weighted_fallback',
  };
}

export async function handleProductSearch(
  ctx: TurnContext,
  options: {
    force?: boolean;
    classifiedIntent?: string;
    verifiedDiscovery?: ProductDiscovery;
    productNeedQuery?: string;
  } = {},
): Promise<AiTurnResult> {
  const message = String(ctx.message || '').trim();
  const force = options.force === true;
  const intent = options.classifiedIntent || '';

  // ── ARCHITECTURAL GATE — catalog search runs ONLY when:
  //   (a) caller forces it (broad-browse commands, combined orders), OR
  //   (b) classified intent is provide_product_query (we know they want
  //       a product), OR
  //   (c) the executor verified an exact-match product, OR
  //   (d) the executor extracted a non-empty productNeed.query (Gemini
  //       saw a product mention even if our regex didn't), OR
  //   (e) the message itself is bare and product-shaped.
  //
  // Anything else → safe fallback. Never "we don't carry that" for
  // greetings, thanks, fillers, or messages we don't understand.
  const isProductIntent = intent === 'provide_product_query';
  const isLooksLikeProductQuery = isMessageProductShaped(message);
  const hasVerifiedExactMatch =
    !!options.verifiedDiscovery &&
    options.verifiedDiscovery.exactMatches.length > 0;
  const hasCleanProductNeedQuery =
    typeof options.productNeedQuery === 'string' &&
    options.productNeedQuery.trim().length > 0;

  if (
    !force &&
    !isProductIntent &&
    !hasVerifiedExactMatch &&
    !hasCleanProductNeedQuery &&
    !isLooksLikeProductQuery
  ) {
    return await handleNonProductFallback(ctx, message);
  }

  if (isGreeting(message)) {
    const state = createCommerceState('IDLE');

    await persistCommerceState(ctx, state);

    return {
      reply: {
        type: 'text',
        content: buildGreetingCopy(ctx),
      },
      debug: {
        stateBefore: ctx.commerceState.state,
        stateAfter: state.state,
        handler: 'handleProductSearch',
        reason: 'greeting',
      },
    };
  }

  if (isBroadBrowseIntent(message)) {
    const products = sortRecommendedProducts(ctx.products).slice(0, 6);

    if (!products.length) {
      const state = createCommerceState('IDLE');

      await persistCommerceState(ctx, state);

      return {
        reply: {
          type: 'text',
          content: "We're still setting up the shop. Tell me what you're looking for and I'll check if we have it.",
        },
        debug: {
          stateBefore: ctx.commerceState.state,
          stateAfter: state.state,
          handler: 'handleProductSearch',
          reason: 'browse_no_products',
        },
      };
    }

    const displayed = products;
    const state = createCommerceState('BROWSING', {
      lastShownProductIds: displayed.map((p) => p.id),
      displayedProductIds: displayed.map((p) => p.id),
    });

    await persistCommerceState(ctx, state);

    return {
      reply: {
        type: 'product_cards',
        content: "Here's some of what we have. Anything catch your eye?",
        products: formatProductCards(displayed, ctx.storeData),
      },
      debug: {
        stateBefore: ctx.commerceState.state,
        stateAfter: state.state,
        handler: 'handleProductSearch',
        reason: 'broad_browse',
      },
    };
  }

  // Phase 0C cascade: prefer the executor's verified exactMatches; else
  // retry searchProducts with the Gemini-extracted productNeed.query if
  // it differs meaningfully from the raw message; else search the raw
  // message. Keeps the existing branches at single_match/
  // multiple_matches/no_match unchanged.
  let result: ProductSearchResult;
  const verifiedSynth = options.verifiedDiscovery
    ? synthesizeFromVerifiedExactMatches(options.verifiedDiscovery, ctx.products)
    : null;

  if (verifiedSynth) {
    result = verifiedSynth;
  } else {
    const cleanedQuery = options.productNeedQuery?.trim();
    const meaningfulOverride =
      !!cleanedQuery && cleanedQuery.toLowerCase() !== message.toLowerCase();

    let cleanedResult: ProductSearchResult | null = null;
    if (meaningfulOverride && cleanedQuery) {
      const r = await searchProducts({
        query: cleanedQuery,
        products: ctx.products,
        storeId: ctx.storeId,
        limit: 6,
      });
      if (r.status !== 'no_match') cleanedResult = r;
    }

    result =
      cleanedResult ??
      (await searchProducts({
        query: message,
        products: ctx.products,
        storeId: ctx.storeId,
        limit: 6,
      }));
  }

  // Phase 0E: when both searches missed but the executor verified
  // in-domain alternatives, promote them through the existing
  // multiple_matches/single_match branches. Restricted to IDLE and
  // BROWSING so we never clobber a focus product the customer is
  // already committed to in a commerce-funnel state.
  if (
    result.status === 'no_match' &&
    options.verifiedDiscovery &&
    (ctx.commerceState.state === 'IDLE' ||
      ctx.commerceState.state === 'BROWSING')
  ) {
    const altSynth = synthesizeFromInDomainAlternatives(
      options.verifiedDiscovery,
      ctx.products,
    );
    if (altSynth) result = altSynth;
  }

  if (result.status === 'no_match') {
    // Architectural: catalog miss should NEVER dump "we don't carry that".
    // Composer redirect with catalogSummary tells customer what we DO sell
    // and asks a useful next-step question.
    return await handleNonProductFallback(ctx, message);
  }

  if (result.status === 'multiple_matches') {
    const products = result.products.slice(0, 6);
    const displayedIds = products.map((p) => p.id);

    const state = createCommerceState('AWAITING_PRODUCT_SELECTION', {
      lastShownProductIds: displayedIds,
      pendingProductOptions: displayedIds,
      displayedProductIds: displayedIds,
    });

    await persistCommerceState(ctx, state);

    return {
      reply: {
        type: 'product_cards',
        content: 'We have a few options here. Which one would you like?',
        products: formatProductCards(products, ctx.storeData),
      },
      debug: {
        stateBefore: ctx.commerceState.state,
        stateAfter: state.state,
        handler: 'handleProductSearch',
        reason: result.reason,
      },
    };
  }

  const product = result.products[0];
  const availability = getProductAvailability(product);
  const hasVariants =
    product.hasVariants === true &&
    Array.isArray(product.variants) &&
    product.variants.length > 0;

    if (!availability.purchasable) {
      const state = createCommerceState('BROWSING', {
        lastShownProductIds: [product.id],
        pendingProductId: product.id,
        displayedProductIds: [product.id],
        lastMentionedProductId: product.id,
      });
    await persistCommerceState(ctx, state);

    return {
      reply: {
        type: 'product_cards',
        content: `We do have ${product.name}, but it's not available to order right now. Would you like me to show you something similar?`,
        products: formatProductCards([product], ctx.storeData),
      },
      debug: {
        stateBefore: ctx.commerceState.state,
        stateAfter: state.state,
        handler: 'handleProductSearch',
        reason: availability.reason,
      },
    };
  }

  if (hasVariants) {
    const variants = product.variants || [];
    const inStockVariants = variants.filter((v) => {
      const isOOS = (v as any).isOutOfStock === true;
      const stockZero = typeof v.stock === 'number' && v.stock === 0;
      return !isOOS && !stockZero;
    });

    // Single-variant auto-select: skip the awkward "which option?"
    // when there's only one in-stock variant. Customer goes directly
    // to quantity.
    if (inStockVariants.length === 1) {
      const onlyVariant = inStockVariants[0];
      const state = createCommerceState('AWAITING_QUANTITY', {
        pendingProductId: product.id,
        pendingVariantId: onlyVariant.id,
        lastShownProductIds: [product.id],
        displayedProductIds: [product.id],
        lastMentionedProductId: product.id,
      });

      await persistCommerceState(ctx, state);

      return {
        reply: {
          type: 'product_cards',
          content: `Yes please, we have ${product.name}. How many should I add for you?`,
          products: formatProductCards([product], ctx.storeData),
        },
        debug: {
          stateBefore: ctx.commerceState.state,
          stateAfter: state.state,
          handler: 'handleProductSearch',
          reason: 'single_product_single_variant_auto_selected',
        },
      };
    }

    // Multi-variant: ask which option.
    const state = createCommerceState('AWAITING_VARIANT', {
      pendingProductId: product.id,
      lastShownProductIds: [product.id],
      displayedProductIds: [product.id],
      lastMentionedProductId: product.id,
    });

    await persistCommerceState(ctx, state);

    return {
      reply: {
        type: 'product_cards',
        content: `Yes please, we have ${product.name}. ${formatVariantOptionsForCustomer(product)} Which option would you like?`,
        products: formatProductCards([product], ctx.storeData),
      },
      debug: {
        stateBefore: ctx.commerceState.state,
        stateAfter: state.state,
        handler: 'handleProductSearch',
        reason: 'single_product_requires_variant',
      },
    };
  }

  const state = createCommerceState('AWAITING_QUANTITY', {
    pendingProductId: product.id,
    pendingVariantId: null,
    lastShownProductIds: [product.id],
    displayedProductIds: [product.id],
    lastMentionedProductId: product.id,
  });

  await persistCommerceState(ctx, state);

  return {
    reply: {
      type: 'product_cards',
      content: `Yes please, we have ${product.name}. How many should I add for you?`,
      products: formatProductCards([product], ctx.storeData),
    },
    debug: {
      stateBefore: ctx.commerceState.state,
      stateAfter: state.state,
      handler: 'handleProductSearch',
      reason: 'single_product_needs_quantity',
    },
  };
}async function handleNonProductFallback(
  ctx: TurnContext,
  message: string,
): Promise<AiTurnResult> {
  // Do not call Gemini in this fallback. This branch means the handler
  // did not make commerce progress, so the reply must not invent order,
  // checkout, delivery, or customer-detail next steps.
  const focusId =
    ctx.commerceState.pendingProductId ||
    ctx.commerceState.lastMentionedProductId ||
    null;
  const focusProduct = focusId
    ? ctx.products.find((p) => p.id === focusId) || null
    : null;

  const content = focusProduct
    ? `Sorry please, did you want to continue with ${focusProduct.name}, or look at something else?`
    : `Sorry please, what are you looking for today?`;

  return {
    reply: { type: 'text', content },
    debug: {
      stateBefore: ctx.commerceState.state,
      stateAfter: ctx.commerceState.state,
      handler: 'handleProductSearch',
      reason: 'non_product_fallback|deterministic_safe',
    },
  };
}