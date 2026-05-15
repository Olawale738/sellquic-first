'use server';

import { fetchAndCacheCustomerMemory } from '@/ai/utils/customerMemory';
import Fuse from 'fuse.js';
import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '@/lib/firebase-admin';

import { z } from 'zod';
import {
  MAX_CHECKOUT_ITEMS,
  MAX_TOTAL_QTY,
  MAX_QTY_PER_ITEM,
  HANDOVER_MESSAGE,
} from '../constants';
import { sendSms } from '@/lib/mnotify';
import { formatPhoneNumberForApi } from '@/lib/utils';

// -------------------------------
// Search Helpers
// -------------------------------

const SEARCH_STOPWORDS = new Set([
  'can', 'you', 'recommend', 'any', 'nice', 'for', 'a', 'an', 'the',
  'please', 'show', 'me', 'something', 'want', 'need', 'looking',
  'find', 'get', 'with', 'to', 'of', 'my', 'also', 'again', 'just',
]);

function normalizeSearchText(value: string) {
  if (!value) return '';
  return value
    .toLowerCase()
    // 1. Remove special characters/punctuation (AI safety)
    .replace(/[^\w\s-]/g, ' ') 
    // 2. Collapse all whitespaces (The "Double Space" Crusher)
    .replace(/\s+/g, ' ') 
    .trim();
}

function extractConstraints(searchTerm: string) {
  const q = normalizeSearchText(searchTerm);
  const words = q.split(' ').filter(Boolean);

  const includeTerms: string[] = words.filter((w) => !SEARCH_STOPWORDS.has(w));
  const excludeTerms: string[] = [];

  const oppositePairs: Array<[string, string]> = [
    ['boys', 'girls'],
    ['girls', 'boys'],
    ['men', 'women'],
    ['women', 'men'],
    ['male', 'female'],
    ['female', 'male'],
    ['black', 'white'],
    ['white', 'black'],
    ['small', 'large'],
    ['large', 'small'],
    ['wireless', 'wired'],
    ['wired', 'wireless'],
    ['spicy', 'mild'],
    ['mild', 'spicy'],
  ];

  for (const [want, avoid] of oppositePairs) {
    if (q.includes(want)) excludeTerms.push(avoid);
  }

  const negationRegex = /\b(no|not|without|except|avoid|none|skip)\s+(\w+)/gi;
  let match: RegExpExecArray | null;
  while ((match = negationRegex.exec(q)) !== null) {
    excludeTerms.push(match[2].toLowerCase());
  }

  return { includeTerms, excludeTerms };
}

function productSearchText(p: any) {
  return normalizeSearchText([
    p.name,
    p.category,
    p.description,
    p.sellingStatus,
    p.brand,
    ...(Array.isArray(p.tags) ? p.tags : []),
    ...(Array.isArray(p.variants) ? p.variants.map((v: any) => v.name) : []),
  ].filter(Boolean).join(' '));
}

function scoreByConstraints(
  p: any,
  constraints: { includeTerms: string[]; excludeTerms: string[] }
) {
  const text = productSearchText(p);
  let score = 0;

  for (const term of constraints.includeTerms) {
    if (text.includes(term)) {
      score += term.length > 3 ? 4 : 2;
    }
  }

  for (const term of constraints.excludeTerms) {
    if (text.includes(term)) {
      score -= 12;
    }
  }

  return score;
}


function countIncludeMatches(
  p: any,
  constraints: { includeTerms: string[]; excludeTerms: string[] }
) {
  const text = productSearchText(p);
  let matches = 0;

  for (const term of constraints.includeTerms) {
    if (text.includes(term)) matches++;
  }

  return matches;
}

function hasStrongIntentTerms(includeTerms: string[]) {
  return includeTerms.some((t) => t.length >= 4);
}


function rerankResults(
  results: any[],
  constraints: { includeTerms: string[]; excludeTerms: string[] }
) {
  const ranked = results
    .map((p) => {
      const score = scoreByConstraints(p, constraints);
      const includeMatches = countIncludeMatches(p, constraints);
      return { p, score, includeMatches };
    })
    .sort((a, b) => b.score - a.score);

  // First remove hard contradictions
  let filtered = ranked.filter((x) => x.score > -8);

  // If query has meaningful terms, require at least one include-term match
  if (constraints.includeTerms.length > 0) {
    const withDirectMatch = filtered.filter((x) => x.includeMatches >= 1);
    if (withDirectMatch.length > 0) {
      filtered = withDirectMatch;
    }
  }

  // If query has stronger intent words like "sleeveless", "dress", "wireless",
  // prefer products matching 2+ terms when possible
  if (hasStrongIntentTerms(constraints.includeTerms)) {
    const stronger = filtered.filter((x) => x.includeMatches >= 2);
    if (stronger.length > 0) {
      filtered = stronger;
    }
  }

  return (filtered.length > 0 ? filtered : ranked).map((x) => x.p);
}


async function loadFullCatalogForStore(storeId: string): Promise<ProductLike[]> {
  if (!storeId) return [];

  const snap = await db.collection('products')
    .where('storeId', '==', storeId)
    .get();

    return snap.docs
  .map((doc) => ({ id: doc.id, ...doc.data() } as ProductLike))
  .filter((p) => 
    p.isArchived !== true &&
    p.isOutOfStock !== true &&
    (p.status === 'published' || p.status === 'active' || !p.status)
  );
}

function isBroadCatalogBrowse(searchTerm: string) {
  const q = normalizeSearchText(searchTerm);
  return /\b(show me|browse|catalog|all products|all items|what do you have|everything|show products)\b/i.test(q);
}

function getAiEffectivePrice(product: any, storeData: any) {
  const marketing = storeData?.marketing || {};
  const globalDiscount =
    marketing.isSiteWideSaleActive ? Number(marketing.siteWideDiscount || 0) : 0;

  const basePrice = Number(product?.price || 0);
  return globalDiscount > 0 ? basePrice * (1 - globalDiscount / 100) : basePrice;
}

function getAiEffectiveVariantPrice(variant: any, storeData: any) {
  const marketing = storeData?.marketing || {};
  const globalDiscount =
    marketing.isSiteWideSaleActive ? Number(marketing.siteWideDiscount || 0) : 0;

  const basePrice = Number(variant?.price || 0);
  return globalDiscount > 0 ? basePrice * (1 - globalDiscount / 100) : basePrice;
}

function productToCard(p: ProductLike, storeData: any) {
  return {
    productId: p.id,
    name: String(p.name || ''),
    price: getAiEffectivePrice(p, storeData),
    imageUrl: p.images?.[0]?.replace(/\?alt=media&token=[^&]+/, '?alt=media') || null,
    stock: p.manageStock
      ? (p.variants && p.variants.length > 0
          ? p.variants.reduce((sum: number, v: any) => sum + (typeof v.stock === 'number' ? v.stock : 0), 0)
          : (typeof p.stock === 'number' ? p.stock : 0))
      : null,
    variants: p.variants && p.variants.length > 0
      ? p.variants.map((v: any) => ({
          id: String(v.id),
          name: String(v.name),
          price: getAiEffectiveVariantPrice(v, storeData),
          stock: typeof v.stock === 'number' ? v.stock : null,
        }))
      : [],
  };
}
// -------------------------------
// Schemas
// -------------------------------

const CheckoutArgsSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string().min(1),
      variantId: z.string().optional(),
      quantity: z
        .union([z.number(), z.string()])
        .transform((v) => Number(v))
        .refine((n) => Number.isFinite(n) && n > 0, 'Invalid quantity'),
    })
  ),
  customerMessage: z.string().optional(),
  deliveryId: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  customerAddress: z.string().optional(),
});

const RemoveArgsSchema = z.object({
  productIds: z.array(z.string().min(1)).default([]),
  variantIds: z.array(z.string()).optional(), // optional parallel array of variantIds
});

const AddToCartSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string().min(1),
      variantId: z.string().optional(),
      quantity: z.number().min(1),
    })
  )
});

const ShowProductsSchema = z.object({
  productIds: z.array(z.string().min(1)).default([]),
  recommendations: z.array(z.string().min(1)).optional(),
  message: z.string().optional(),
});

const LookupOrderSchema = z.object({
  phone: z.string().optional(),
  name: z.string().optional(),
  paymentReference: z.string().optional(),
}).refine(data => data.phone || data.name || data.paymentReference, {
  message: 'At least one search parameter must be provided.',
});

// -------------------------------
// Types
// -------------------------------

type ProductLike = {
  id: string;
  name: string;
  price: number;
  images?: string[];
  stock?: number;
  manageStock?: boolean;
  isArchived?: boolean;
  isOutOfStock?: boolean;
  status?: string;
  category?: string;
  description?: string;
  sellingStatus?: string;
  brand?: string;
  tags?: string[];
  variants?: Array<{ id: string; name: string; price: number; stock?: number }>;
};

type Refs = {
  convRef: FirebaseFirestore.DocumentReference;
  msgRef: FirebaseFirestore.CollectionReference;
  inboxRef: FirebaseFirestore.DocumentReference;
};



// -------------------------------
// Core handlers
// -------------------------------

export async function handleToolCall(
  call: any,
  refs: Refs,
  productsById: Map<string, ProductLike>,
  userMsg: string,
  storeData: any,
  conversationId: string,
  deliveryDocs: FirebaseFirestore.QueryDocumentSnapshot[] = []
) {
  if (call?.args?.quickReplies) {
    delete call.args.quickReplies;
  }

  const { convRef } = refs;
  const convSnap = await convRef.get();
  const convData = convSnap.data() || {};
  const existingCart = (convData.currentCart || []) as Array<{
    productId: string;
    variantId?: string | null;
    quantity: number;
  }>;


    

  switch (call.name) {
    case 'save_customer_info': {
      const name = call.args?.customerName as string | undefined;
      const phone = call.args?.customerPhone as string | undefined;

      if (name || phone) {
        await convRef.set({
          ...(name ? { customerName: name } : {}),
          ...(phone ? { customerPhone: phone } : {}),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
      if (phone) {
        fetchAndCacheCustomerMemory(storeData.id, refs.convRef, { phone }).catch((e) =>
          console.error('[Memory Engine] Phone trigger failed:', e)
        );
      }

      return NextResponse.json({ reply: { type: 'save_info_done' } });
    }

    case 'show_products': {
      const parsed = ShowProductsSchema.safeParse(call.args ?? {});
      if (!parsed.success) {
        return handleHandover(refs, 'Invalid Args (show_products)', storeData, conversationId);
      }

      const { productIds, recommendations, message } = parsed.data;
      const products = productIds
  .map((id) => productsById.get(id))
  .filter(Boolean)
  .slice(0, 5) as ProductLike[];

const recs = (recommendations || [])
  .map((id) => productsById.get(id))
  .filter(Boolean)
  .slice(0, 5) as ProductLike[];

  // ── SMART TEXT GENERATOR (SHOW PRODUCTS) ──
  let content = (message || "").trim();

  // Override robotic AI messages
  if (!content || /\b(closest matches|here are the|found for|here is the|I found)\b/i.test(content)) {
    if (products.length === 1) {
      // Convert ALL CAPS database names to Title Case for natural chat
      const humanName = (products[0].name || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
      content = `Here is the ${humanName} please Would you like to order this one?`;
    } else if (products.length > 1) {
      content = `Here are those items for you please! Which one would you prefer?`;
    } else {
      content = `Here is what I found for you please`;
    }
  }

  const payload = {
    type: 'product_cards' as const,
    products: products.map((p) => productToCard(p, storeData)),
    recommendations: recs.map((p) => productToCard(p, storeData)),
  };

      await saveModelResponse(refs, content, payload);
      await convRef.set({
        lastShownProductIds: products.map((p) => p.id),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      return NextResponse.json({ reply: { ...payload, content } });
    }

    case 'add_to_cart': {
      const parsed = AddToCartSchema.safeParse(call.args ?? {});
      if (!parsed.success) {
        return handleHandover(refs, 'Invalid Args (add_to_cart)', storeData, conversationId);
      }
    
      const cartMap = new Map<string, any>();
      for (const item of existingCart) {
        const key = `${item.productId}:${item.variantId || ''}`;
        cartMap.set(key, item);
      }
    
      const addedItemsNames: string[] = [];
      let hasError = false;
      let errorMsg = '';
    
      for (const item of parsed.data.items) {
        const p = productsById.get(item.productId);
        if (!p || p.isArchived || p.isOutOfStock) {
          hasError = true;
          errorMsg = 'Sorry please, one of those items is no longer available 😔.';
          break;
        }
    
        if (Array.isArray(p.variants) && p.variants.length > 1 && !item.variantId) {
          hasError = true;
          errorMsg = `The ${p.name} has a few options please 😊 Which size or option would you like?`;
          break;
        }
    
        let availableStock = 9999;
        let itemName = p.name;
        let itemPrice = getAiEffectivePrice(p, storeData);
        let matchedVariantId: string | null = null;
    
        if (item.variantId && p.variants) {
          let v = p.variants.find((vv: any) => vv.id === item.variantId);
    
          if (!v) {
            const lowerRequested = String(item.variantId).toLowerCase().trim();
            v = p.variants.find((vv: any) =>
              String(vv.name || '').toLowerCase().trim() === lowerRequested
            );
          }
    
          if (v) {
            matchedVariantId = v.id;
            itemName = `${p.name} (${v.name})`;
            itemPrice = getAiEffectiveVariantPrice(v, storeData);
            if (p.manageStock) availableStock = Number(v.stock ?? 0);
          } else {
            // Variant was passed but not found — block silently adding with null variantId
            hasError = true;
            errorMsg = `The ${p.name} has a few options please 😊 Which size or option would you like?`;
            break;
          }
        } else if (p.manageStock && !p.variants?.length) {
          availableStock = Number(p.stock ?? 0);
        }
    
        const key = `${item.productId}:${matchedVariantId || item.variantId || ''}`;
        const newQty = item.quantity; // SET not ADD — AI passes the final intended quantity
    
        if (newQty > availableStock) {
          hasError = true;
          errorMsg = `Sorry please! We only have ${availableStock} of the ${itemName} left 😔.`;
          break;
        }
    
        cartMap.set(key, {
          productId: item.productId,
          variantId: matchedVariantId || item.variantId || null,
          quantity: newQty,
          nameSnapshot: itemName,
          priceSnapshot: itemPrice,
        });
    
        addedItemsNames.push(`${item.quantity}x ${itemName}`);
      }
    
      if (hasError) {
        await saveModelResponse(refs, errorMsg);
        await convRef.set({
          draftOrder: FieldValue.delete(),
          awaitingStep: FieldValue.delete(),
          awaitingSince: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        return NextResponse.json({ reply: { type: 'text', content: errorMsg } });
      }
    
      const newCart = Array.from(cartMap.values());
    
      await refs.inboxRef.set({
        lastCheckoutLink: FieldValue.delete(),
        lastCheckoutItems: FieldValue.delete(),
        lastCheckoutTotal: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      
      await convRef.set({
        currentCart: newCart,
        orderSessionStatus: 'building_cart',
        draftOrder: FieldValue.delete(),
        awaitingStep: FieldValue.delete(),
        awaitingSince: FieldValue.delete(),
        lastCheckoutLink: FieldValue.delete(),
        lastCheckoutItems: FieldValue.delete(),
        lastCheckoutTotal: FieldValue.delete(),
        lastCheckoutCreatedAt: FieldValue.delete(),
        lastCheckoutDeliveryId: FieldValue.delete(),
        lastActionData: FieldValue.delete(),
        lastCartUpdatedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    
      const content = `Perfect please 😊 I've added ${addedItemsNames.join(' and ')} to your bag. Would you like to checkout now`;
      await saveModelResponse(refs, content);
      return NextResponse.json({ reply: { type: 'text', content } });
    }

    case 'remove_from_cart': {
      const parsed = RemoveArgsSchema.safeParse(call.args ?? {});
      if (!parsed.success) {
        return handleHandover(refs, 'Invalid Args (remove_from_cart)', storeData, conversationId);
      }

   // Clear stale checkout from BOTH convRef and inboxRef
await refs.convRef.set({
  lastCheckoutLink: FieldValue.delete(),
  lastCheckoutItems: FieldValue.delete(),
  lastCheckoutTotal: FieldValue.delete(),
  lastCheckoutCreatedAt: FieldValue.delete(),
  lastCheckoutDeliveryId: FieldValue.delete(),
  lastActionData: FieldValue.delete(),
  orderSessionStatus: 'building_cart',
  updatedAt: FieldValue.serverTimestamp(),
}, { merge: true });

await refs.inboxRef.set({
  lastCheckoutLink: FieldValue.delete(),
  lastCheckoutItems: FieldValue.delete(),
  lastCheckoutTotal: FieldValue.delete(),
}, { merge: true });

const removalPairs = parsed.data.productIds.map((pid: string, i: number) => ({
  productId: pid,
  variantId: parsed.data.variantIds?.[i] || null,
}));

const updatedCart = existingCart.filter((item) => {
  return !removalPairs.some((r: { productId: string; variantId: string | null }) => {
    if (r.variantId) {
      return item.productId === r.productId && item.variantId === r.variantId;
    }
    return item.productId === r.productId;
  });
});

      await convRef.set({
        currentCart: updatedCart,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      const content =
        (call.args?.message as string) ||
        "Done — I've removed that from your bag. What would you like instead?";

      await saveModelResponse(refs, content);
      return NextResponse.json({ reply: { type: 'text', content } });
    }

    case 'create_checkout': {
      const parsed = CheckoutArgsSchema.safeParse(call.args ?? {});
      if (!parsed.success) {
        return handleHandover(refs, 'Invalid Args (create_checkout)', storeData, conversationId);
      }

      const draftOrder = convSnap.data()?.draftOrder || null;

      // Reconciliation: trust persisted draft quantity over drifted model args
      if (
        draftOrder?.quantity &&
        Number(draftOrder.quantity) > 1 &&
        parsed.data.items.length === 1
      ) {
        const item = parsed.data.items[0];

        if (Number(item.quantity) < Number(draftOrder.quantity)) {
          if (!draftOrder.productId || item.productId === draftOrder.productId) {
            item.quantity = Number(draftOrder.quantity);
            console.log(
              `[Draft Reconciliation] Restored quantity to ${draftOrder.quantity} for product ${item.productId}`
            );
          }
        }
      }
      
      const confirmedReuseDetails = convSnap.data()?.confirmedReuseDetails === true;
      const snapData = convSnap.data();
      const isReturningCustomer = !!snapData?.customerMemory &&
        snapData.customerMemory !== 'NEW_CUSTOMER';

        const hasStoredDetails = !!(convData.customerName && convData.customerPhone);
        const hasAllDetailsInArgs = !!(parsed.data.customerName && parsed.data.customerPhone);
        
        if (!hasAllDetailsInArgs && !confirmedReuseDetails) {
          // ✅ THE FIX: Trust the Database Cart first. If empty, fallback to LLM.
          const fallbackItems = existingCart.length > 0
          ? existingCart.map((i: any) => ({
              productId: i.productId,
              variantId: i.variantId || undefined,
              quantity: i.quantity,
            }))
          : parsed.data.items;

        const pendingCheckout = {
          items: fallbackItems, 
          customerMessage: parsed.data.customerMessage || '',
          deliveryId: parsed.data.deliveryId || convData.lastCheckoutDeliveryId || null,
          customerName: parsed.data.customerName || convData.customerName || null,
          customerPhone: parsed.data.customerPhone || convData.customerPhone || null,
          customerAddress: parsed.data.customerAddress || convData.customerAddress || null,
        };

        const content = hasStoredDetails
  ? `Should I use your same details as last time please? (${convData.customerName}, ${convData.customerPhone}${convData.customerAddress ? `, ${convData.customerAddress}` : ''}) 😊`
  : `Sure please! To complete your order I just need a few details — what's your name, phone number, and delivery area? 😊`;

        await saveModelResponse(refs, content);
        await convRef.set({
          awaitingStep: 'confirmation',
          awaitingSince: FieldValue.serverTimestamp(),
          pendingCheckout,
          nudgeCount: 0,
          lastNudgeSent: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });

        return NextResponse.json({ reply: { type: 'text', content } });
      }

      for (const i of parsed.data.items) {
        let p = productsById.get(i.productId);

        if (!p || p.isArchived || p.isOutOfStock) {
          const errMsg = `Sorry please, that item is no longer available 😔 Would you like to see what else we have?`;
          await saveModelResponse(refs, errMsg);
          return NextResponse.json({ reply: { type: 'text', content: errMsg } });
        }
        
        // HARD BLOCK: if product has multiple variants, one must be selected before checkout
        if (Array.isArray(p.variants) && p.variants.length > 1 && !i.variantId) {
          const variantPayload = {
            type: 'product_cards' as const,
            products: [productToCard(p, storeData)],
            recommendations: [],
          };

          const content = `This item has a few options please 😊 Which one would you like?`;
          await saveModelResponse(refs, content, {
            ...variantPayload,
            searchResultIds: [p.id],
          });
          await convRef.set({ awaitingStep: 'variant', awaitingSince: FieldValue.serverTimestamp(), nudgeCount: 0, lastNudgeSent: FieldValue.delete() }, { merge: true });

          return NextResponse.json({
            reply: {
              ...variantPayload,
              content,
            }
          });
        }

        if (i.variantId) {
          let v = p.variants?.find((vv: any) => vv.id === i.variantId);

       
if (!v) {
  const lowerRequested = String(i.variantId).toLowerCase().trim();
  v = p.variants?.find((vv: any) =>
    String(vv.name || '').toLowerCase().trim() === lowerRequested
  );
  if (v) i.variantId = v.id; // normalise to real ID for the rest of the pipeline
}

          // Recovery path: AI may have paired the wrong productId with a real variantId.
          if (!v) {
            const uniqueVariantOwner = Array.from(productsById.values()).find((candidate: any) =>
              Array.isArray(candidate.variants) &&
              candidate.variants.some((vv: any) => vv.id === i.variantId)
            );

            if (uniqueVariantOwner && uniqueVariantOwner.id !== p.id) {
              i.productId = uniqueVariantOwner.id;
              p = productsById.get(i.productId)!;
              v = p?.variants?.find((vv: any) => vv.id === i.variantId);
            }
          }

          if (!v) {
            const lastShownIds = convData.lastShownProductIds || [];
            const candidateProducts = lastShownIds
              .map((id: string) => productsById.get(id))
              .filter(Boolean);

            const productWithMatchingVariant = candidateProducts.find((candidate: any) =>
              Array.isArray(candidate.variants) &&
              candidate.variants.some((vv: any) => vv.id === i.variantId)
            );

            if (productWithMatchingVariant) {
              i.productId = productWithMatchingVariant.id;
              p = productsById.get(i.productId)!;
              v = p?.variants?.find((vv: any) => vv.id === i.variantId);
            }
          }

          if (!p || !v) {
            const originalProduct = productsById.get(i.productId);
            if (originalProduct && Array.isArray(originalProduct.variants) && originalProduct.variants.length > 0) {
                const variantList = originalProduct.variants
                .map((vv: any) => `${vv.name} — GHS ${getAiEffectiveVariantPrice(vv, storeData).toFixed(2)}`)
                    .join(', ');
                const content = `This item comes in: ${variantList}. Which one would you like please?`;
                await saveModelResponse(refs, content);
                return NextResponse.json({ reply: { type: 'text', content } });
            }
        
            const errMsg = `Which option would you like please?`;
            await saveModelResponse(refs, errMsg);
            return NextResponse.json({ reply: { type: 'text', content: errMsg } });
        }

          if (p.manageStock) {
            const available = Number(v.stock ?? 0);
            if (i.quantity > available) {
              const errMsg = available === 0
                ? `Sorry please, that option is out of stock right now 😔 Want to see other options?`
                : `Sorry please! We only have ${available} of that left 😔 Would you like ${available} instead?`;
              await saveModelResponse(refs, errMsg);
              return NextResponse.json({ reply: { type: 'text', content: errMsg } });
            }
          }
        } else if (p.manageStock && !p.variants?.length) {
          const available = Number(p.stock ?? 0);
          if (i.quantity > available) {
            const errMsg = available === 0
              ? `Sorry please, that item is out of stock right now 😔 Want to see other options?`
              : `Sorry please! We only have ${available} left 😔 Would you like ${available} instead?`;
            await saveModelResponse(refs, errMsg);
            return NextResponse.json({ reply: { type: 'text', content: errMsg } });
          }
        }
      }

      const mergedMap = new Map<string, { productId: string; variantId?: string; quantity: number }>();
      for (const i of parsed.data.items) {
        const key = `${i.productId}:${i.variantId || ''}`;
        mergedMap.set(key, {
          productId: i.productId,
          variantId: i.variantId,
          quantity: Math.max(1, Math.floor(Number(i.quantity))),
        });
      }

      let items = Array.from(mergedMap.values())
        .map((i) => {
          const p = productsById.get(i.productId);
          if (!p || p.isArchived || p.isOutOfStock) return null;

          let price = getAiEffectivePrice(p, storeData);
          let name = String(p.name || '');
          let available = p.manageStock ? Number(p.stock ?? 0) : 9999;

          if (i.variantId && Array.isArray(p.variants)) {
            const v = p.variants.find((vv) => vv.id === i.variantId);
            if (!v) return null;
            price = getAiEffectiveVariantPrice(v, storeData);
            name = v.name && v.name !== p.name ? `${p.name} (${v.name})` : String(p.name || '');
            if (p.manageStock) available = Number(v.stock ?? 0);
          }

          const qty = Math.max(1, Math.min(i.quantity, available, MAX_QTY_PER_ITEM));

          return {
            productId: i.productId,
            variantId: i.variantId || null,
            quantity: qty,
            name,
            price,
            lineTotal: price * qty,
            imageUrl: p.images?.[0] || null,
          };
        })
        .filter(Boolean) as Array<{
          productId: string;
          variantId: string | null;
          quantity: number;
          name: string;
          price: number;
          lineTotal: number;
          imageUrl: string | null;
        }>;

      if (items.length === 0) {
        return handleHandover(refs, 'No valid items', storeData, conversationId);
      }

      if (items.length > MAX_CHECKOUT_ITEMS) {
        items = items.slice(0, MAX_CHECKOUT_ITEMS);
      }

      const totalQty = items.reduce((s, i) => s + i.quantity, 0);
      if (totalQty > MAX_TOTAL_QTY) {
        const ratio = MAX_TOTAL_QTY / totalQty;
        items = items.map((i) => {
          const newQty = Math.max(1, Math.min(MAX_QTY_PER_ITEM, Math.floor(i.quantity * ratio)));
          return { ...i, quantity: newQty, lineTotal: i.price * newQty };
        });
      }

      await convRef.set({
        currentCart: items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          quantity: i.quantity,
        })),
        ...(parsed.data.customerName && { customerName: parsed.data.customerName }),
        ...(parsed.data.customerPhone && { customerPhone: parsed.data.customerPhone }),
        ...(parsed.data.customerAddress && { customerAddress: parsed.data.customerAddress }),
        draftOrder: FieldValue.delete(),
        confirmedReuseDetails: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });



      const itemsParam = items
        .map((i) => `${i.productId}:${i.quantity}${i.variantId ? `:${i.variantId}` : ''}`)
        .join(',');

      const itemsTotal = items.reduce((s, x) => s + x.lineTotal, 0);

      let deliveryFee = 0;
      let deliveryLabel = '';
      if (parsed.data.deliveryId) {
        const deliveryZone = deliveryDocs.find((d: any) => d.id === parsed.data.deliveryId);
        if (deliveryZone) {
          deliveryFee = Number(deliveryZone.data().fee || 0);
          deliveryLabel = deliveryZone.data().label || '';
        }
      }

      const grandTotal = itemsTotal + deliveryFee;

      const itemsList = items
        .map((i) => `${i.name} x${i.quantity} — GHS ${i.lineTotal.toFixed(2)}`)
        .join('\n');

      const receiptBlock = deliveryFee > 0
        ? `\n\n${itemsList}\nDelivery (${deliveryLabel}): GHS ${deliveryFee.toFixed(2)}\nTotal: GHS ${grandTotal.toFixed(2)}`
        : `\n\n${itemsList}\nTotal: GHS ${grandTotal.toFixed(2)}`;

      const aiWarmMessage =
        parsed.data.customerMessage?.trim() || "Perfect please! Here's your checkout link ";
      const customerMessage = aiWarmMessage + receiptBlock;

      const channel = convData.channel || 'webchat';

      const urlParams = new URLSearchParams({
        source: 'ai',
        channel,
        items: itemsParam,
      });

      if (parsed.data.deliveryId) urlParams.set('deliveryId', parsed.data.deliveryId);
      if (parsed.data.customerName) urlParams.set('name', parsed.data.customerName);
      if (parsed.data.customerPhone) urlParams.set('phone', parsed.data.customerPhone);
      if (parsed.data.customerAddress) urlParams.set('address', parsed.data.customerAddress);

      const checkoutReply = {
        type: 'action' as const,
        action: 'checkout' as const,
        label: 'Complete Order',
        url: `https://${storeData.customDomain || `${storeData.subdomain}.sellquic.com`}/checkout?${urlParams.toString()}`,
        content: customerMessage,
        items,
        total: grandTotal,
        currency: 'GHS',
      };

      await convRef.set({
        lastCheckoutLink: checkoutReply.url,
        lastCheckoutItems: items,
        lastCheckoutTotal: grandTotal,
        lastCheckoutDeliveryId: parsed.data.deliveryId || null,
        lastCheckoutCreatedAt: FieldValue.serverTimestamp(),
        awaitingStep: FieldValue.delete(),
        awaitingSince: FieldValue.delete(),
        pendingCheckout: FieldValue.delete(),
        orderSessionStatus: 'checkout_ready',
        nudgeCount: 0,
        lastNudgeSent: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      // ── SAVE LAST CHECKOUT LINK FOR RESEND ─────────────────────────────
      await refs.inboxRef.set({
        lastCheckoutLink: checkoutReply.url,
        lastCheckoutCreatedAt: FieldValue.serverTimestamp(),
        lastCheckoutItems: items,           // optional but useful
        lastCheckoutTotal: grandTotal,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });



      await saveModelResponse(refs, customerMessage, checkoutReply);
      return NextResponse.json({ reply: checkoutReply });
    }
    case 'lookup_order': {
      const parsed = LookupOrderSchema.safeParse(call.args ?? {});

      // STRICT RULE: ONLY reference code is allowed for lookup
      if (!parsed.success || !parsed.data.paymentReference) {
        const content = "Sure please 😊 Please send the order reference code (it looks like BEST-XXXXX) and I'll check it right away.";

        await saveModelResponse(refs, content);
        await refs.convRef.set({
          awaitingStep: FieldValue.delete(),
          awaitingSince: FieldValue.delete(),
          nudgeCount: 0,
          lastNudgeSent: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });

        return NextResponse.json({ reply: { type: 'text', content } });
      }

      const { paymentReference } = parsed.data;

      await refs.convRef.set({
        lastOrderLookupReference: paymentReference,
        status: 'active',
        handoverReason: FieldValue.delete(),
        handoverAt: FieldValue.delete(),
        awaitingStep: FieldValue.delete(),
        awaitingSince: FieldValue.delete(),
        activeFlow: 'order_lookup',
        activeFlowStartedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      const storeId = storeData.id || convData.storeId;
      if (!storeId) {
        return handleHandover(refs, 'lookup_order: no storeId', storeData, conversationId);
      }

      try {
        const ordersRef = db.collection('orders');

        // ONLY lookup by reference code
        const refSnap = await ordersRef
          .where('storeId', '==', storeId)
          .where('paymentReference', '==', paymentReference.trim())
          .limit(1)
          .get();

        let orderData = refSnap.empty ? null : refSnap.docs[0].data();

        // ── ORDER MISMATCH DETECTOR ───────────────────────────────────────
const lastCheckoutItems: any[] = convData.lastCheckoutItems || [];
if (orderData && lastCheckoutItems.length > 0 && orderData.items?.length > 0) {
  const checkedOutNames = lastCheckoutItems
    .map((i: any) => String(i.name || '').toLowerCase())
    .sort()
    .join('|');
  const lookedUpNames = orderData.items
    .map((i: any) => String(i.productName || '').toLowerCase())
    .sort()
    .join('|');

    if (checkedOutNames !== lookedUpNames) {
      await refs.convRef.set({
        lastCheckoutLink: FieldValue.delete(),
        lastCheckoutItems: FieldValue.delete(),
        lastCheckoutTotal: FieldValue.delete(),
        lastCheckoutCreatedAt: FieldValue.delete(),
        lastActionData: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
  
      await refs.inboxRef.set({
        lastCheckoutLink: FieldValue.delete(),
        lastCheckoutItems: FieldValue.delete(),
        lastCheckoutTotal: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
}

        if (!orderData) {
          const content = "I couldn't find a recent order with that reference code right now 😊. Please double-check the code or let me know if there's anything else I can help with.";
        
          await refs.convRef.set({
            status: 'active',
            handoverReason: FieldValue.delete(),
            handoverAt: FieldValue.delete(),
            awaitingStep: FieldValue.delete(),
            awaitingSince: FieldValue.delete(),
            nudgeCount: 0,
            lastNudgeSent: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });

          await saveModelResponse(refs, content);
          return NextResponse.json({ reply: { type: 'text', content } });
        }

        // Safe status handling
        const foundCustomerName = orderData.customerInfo?.name || 'there';
        const rawStatus = String(orderData.status || '').trim().toLowerCase();
        const normalizedStatus =
          rawStatus === 'awaiting payment' ? 'awaiting-payment'
          : rawStatus === 'canceled' ? 'cancelled'
          : rawStatus;

        const itemNames =
          orderData.items?.map((i: any) => i.productName).filter(Boolean).join(', ') || 'order';

        let content = '';

        switch (normalizedStatus) {
          case 'fulfilled':
          case 'delivered':
            content = `Great news ${foundCustomerName}! Your ${itemNames} order has been confirmed and fulfilled 🎉 Is there anything else I can help you with?`;
            break;

          case 'processing':
          case 'pending':
          case 'paid':
          case 'confirmed':
          case 'confirmed-paid':
          case 'in-progress':
          case 'ready':
          case 'shipped':
          case 'on-the-way':
            content = `Hi ${foundCustomerName}! Your ${itemNames} order is confirmed and being processed — it'll be on its way to you soon 😊 Anything else I can help with?`;
            break;

          case 'awaiting-payment':
            content = `Hi ${foundCustomerName}! I can see your order but payment hasn't been confirmed yet. If you paid via Paystack it usually confirms automatically — if it's been a while, please share a screenshot and we'll sort it right away 💕`;
            break;

          case 'cancelled':
            content = `Hi ${foundCustomerName}, it looks like this order was cancelled. Would you like to place a new one? 😊`;
            break;

          default:
            content = `Hi ${foundCustomerName}! I found your ${itemNames} order and we're confirming the latest update for you now 😊`;
            break;
        }

        await refs.convRef.set({
          status: 'active',
          handoverReason: FieldValue.delete(),
          handoverAt: FieldValue.delete(),
          aiErrorFlag: FieldValue.delete(),
          aiErrorContextActive: FieldValue.delete(),
          aiErrorCount: FieldValue.delete(),
          lastAiError: FieldValue.delete(),
          lastAiErrorMessagePreview: FieldValue.delete(),
          awaitingStep: FieldValue.delete(),
          awaitingSince: FieldValue.delete(),
          nudgeCount: 0,
          lastNudgeSent: FieldValue.delete(),
          lastNudgeMessage: FieldValue.delete(),
          lastNudgeContextType: FieldValue.delete(),
          lastNudgeContextPayload: FieldValue.delete(),
          activeFlow: FieldValue.delete(),
          activeFlowStartedAt: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });

        await refs.inboxRef.set({
          status: 'open',
          unreadForVendor: false,
          lastMessageAt: FieldValue.serverTimestamp(),
          lastMessagePreview: content.slice(0, 160),
        }, { merge: true });

        await saveModelResponse(refs, content);
        return NextResponse.json({ reply: { type: 'text', content } });

      } catch (err: any) {
        console.error('[lookup_order] Error:', err);
        const content = "I'm having trouble checking that right now please 😊 Could you try again in a moment?";
        await saveModelResponse(refs, content);
        return NextResponse.json({ reply: { type: 'text', content } });
      }
    }

    case 'notify_vendor': {
      const question = (call.args?.question as string) || 'A customer had a question';
      const replyToCustomer =
        (call.args?.replyToCustomer as string) ||
        "I've passed your question to the team and they'll get back to you shortly 😊";

      try {
        if (storeData?.sellerId) {
          const sellerSnap = await db.collection('users').doc(storeData.sellerId).get();
          const sellerData = sellerSnap.data();
          const sellerPhone = sellerData?.phone;
          const sellerEmail = sellerData?.email;
          const customerName = convData.customerName || 'A customer';

          const notifyPromises: Promise<any>[] = [];

          if (sellerPhone) {
            const formattedPhone = formatPhoneNumberForApi(sellerPhone);
            if (formattedPhone) {
              notifyPromises.push(
                sendSms(
                  formattedPhone,
                  `SellQuic: ${customerName} has a question on "${storeData.name}": "${question.slice(0, 120)}". Reply here: https://sellquic.com/dashboard/inbox/${conversationId}`
                ).catch((e) => console.error('[notify_vendor] SMS failed:', e))
              );
            }
          }

          if (sellerEmail) {
            const { sendVendorQueryEmail } = await import('@/lib/resend');
            notifyPromises.push(
              sendVendorQueryEmail({
                vendorEmail: sellerEmail,
                storeName: storeData.name || 'Your Store',
                customerName,
                customerQuestion: question,
                conversationId,
              }).catch((e) => console.error('[notify_vendor] Email failed:', e))
            );
          }

          await Promise.allSettled(notifyPromises);
        }
      } catch (e) {
        console.error('[notify_vendor] Notification failed:', e);
      }

      await saveModelResponse(refs, replyToCustomer);
      return NextResponse.json({ reply: { type: 'text', content: replyToCustomer } });
    }

    case 'search_catalog': {
      const searchTerm = String(call.args?.searchTerm || '').trim();
      if (!searchTerm) {
        return handleHandover(refs, 'Invalid Args (search_catalog)', storeData, conversationId);
      }
    
      const storeId = String(convData.storeId || '').trim();
      const allProducts = await loadFullCatalogForStore(storeId);
    
      if (allProducts.length === 0) {
        const content = "I couldn't load our products right now please. Could you try again in a moment?";
        await saveModelResponse(refs, content);
        return NextResponse.json({ reply: { type: 'text', content } });
      }
    
      const broadBrowse = isBroadCatalogBrowse(searchTerm);
      let results: ProductLike[] = [];
    
      if (broadBrowse) {
        results = [...allProducts]
          .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
          .slice(0, 6);
      } else {
        const normalizedQuery = normalizeSearchText(
          searchTerm
            .replace(/\bcreame?\b/gi, 'cream')
            .replace(/\bserumm?\b/gi, 'serum')
            .replace(/\btonerr?\b/gi, 'toner')
            .replace(/\bclarr?ifying\b/gi, 'clarifying')
            .replace(/\bmoisturiser\b/gi, 'moisturizer')
            .replace(/\blotionn\b/gi, 'lotion')
            .replace(/\bscub\b/gi, 'scrub')
        );
    
        const constraints = extractConstraints(normalizedQuery);
    
        const queryTokens = normalizedQuery
          .split(' ')
          .filter((w) => !SEARCH_STOPWORDS.has(w) && w.length >= 3);
    
        const smartDirectMatches = allProducts.filter((p) => {
          const text = productSearchText(p);
          if (queryTokens.length === 0) return false;
    
          const matchedCount = queryTokens.filter((token) => text.includes(token)).length;
    
          if (queryTokens.length <= 2) return matchedCount === queryTokens.length;
          return matchedCount >= Math.max(2, queryTokens.length - 1);
        });
    
        const directContains = allProducts.filter((p) => {
          const text = productSearchText(p);
          return normalizedQuery.length >= 3 && text.includes(normalizedQuery);
        });
    
        const fuse = new Fuse(allProducts, {
          keys: [
            { name: 'name', weight: 3 },
            { name: 'category', weight: 1.8 },
            { name: 'tags', weight: 1.7 },
            { name: 'variants.name', weight: 1.4 },
            { name: 'brand', weight: 1.2 },
            { name: 'description', weight: 0.8 },
            { name: 'sellingStatus', weight: 0.5 },
          ],
          threshold: 0.38,
          distance: 200,
          minMatchCharLength: 2,
          ignoreLocation: true,
        });
    
        const fuseResults = fuse.search(normalizedQuery).map((r) => r.item);
    
        const tokenFallback = (products: ProductLike[], tokens: string[]): ProductLike[] => {
          if (tokens.length === 0) return [];
    
          const scored = products
            .map((p) => {
              const text = productSearchText(p);
              const matchCount = tokens.filter((t) => text.includes(t)).length;
              return { p, matchCount };
            })
            .filter((x) => x.matchCount > 0)
            .sort((a, b) => b.matchCount - a.matchCount);
    
          return scored.map((x) => x.p);
        };
    
        const candidatePool = Array.from(
          new Map(
            [
              ...smartDirectMatches,
              ...directContains,
              ...fuseResults,
              ...tokenFallback(allProducts, queryTokens),
            ].map((p) => [p.id, p])
          ).values()
        );
    
        if (candidatePool.length > 0) {
          results = rerankResults(candidatePool, constraints).slice(0, 6);
        }
      }
    
     // ── SMART TEXT GENERATOR (SEARCH CATALOG) ──
     const cleanTerm = searchTerm.toLowerCase().trim();
     const displayTerm = cleanTerm.replace(/\b\w/g, c => c.toUpperCase());
     const isPriceQuestion = /\b(how much|price|cost)\b/i.test(userMsg);
     const isAvailabilityQuestion = /\b(do you have|is there|looking for|any)\b/i.test(userMsg);

     let content = (call.args?.message || "").trim();

     if (results.length === 0) {
       content = (!content || /\b(closest matches|found|search|results)\b/i.test(content))
           ? `We don't currently have "${displayTerm}" right now please. Would you like me to check for something similar? 😊`
           : content;
   
       await saveModelResponse(refs, content);
       await convRef.set({
         lastSearchTerm: searchTerm,
         lastShownProductIds: [],
         updatedAt: FieldValue.serverTimestamp(),
       }, { merge: true });
       return NextResponse.json({ reply: { type: 'text', content } });
     }

     // Override robotic AI messages
     if (!content || /\b(search|result|results|closest matches|here are the|found for|here is the|I found)\b/i.test(content)) {
       if (broadBrowse) {
         content = "Here is what we have available right now please! Let me know if you see anything you like";
       } else {
         const exactMatch = results.find(p => String(p.name || '').toLowerCase() === cleanTerm);
         const bestMatch = exactMatch || results[0];
         
         const humanName = (bestMatch.name || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

         if (results.length === 1 || exactMatch) {
           if (isPriceQuestion) {
            const effectivePrice = getAiEffectivePrice(bestMatch, storeData);

            content = `The ${humanName} is GHS ${effectivePrice.toFixed(2)} please Would you like to get it?`;
           } else if (isAvailabilityQuestion) {
             content = `Yes please! We have the ${humanName} in stock. Would you like to order it?`;
           } else {
             content = `Here is the ${humanName} please Does this work for you?`;
           }
         } else {
           content = `We have a few great options for ${displayTerm} please Which one stands out to you?`;
         }
       }
     }
   
     const payload = {
      type: 'product_cards' as const,
      products: results.map((p) => productToCard(p, storeData)),
      recommendations: [],
    };
   
     await saveModelResponse(refs, content, payload);
     await convRef.set({
       lastSearchTerm: searchTerm,
       lastShownProductIds: results.map((p) => p.id),
       updatedAt: FieldValue.serverTimestamp(),
     }, { merge: true });
   
     return NextResponse.json({ reply: { ...payload, content } });
    }

    default: {
      const content = "Let me sort that out with you please";
      await saveModelResponse(refs, content);
      return NextResponse.json({ reply: { type: 'text', content } });
    }
  }
}

// -------------------------------
// Handover
// -------------------------------

export async function handleHandover(
  refs: Refs,
  reason: string,
  storeData: any,
  conversationId: string
) {
  const convSnap = await refs.convRef.get();
  const convData = convSnap.data() || {};

  // ── 30-MINUTE COOLDOWN (stops repeated SMS) ─────────────────────────────
  const handoverAt = convData.handoverAt?.toDate?.() || null;
  const now = Date.now();
  if (handoverAt) {
    const minutesSince = (now - handoverAt.getTime()) / (1000 * 60);
    if (minutesSince < 30) {
      const content = "One moment please, the team is already looking into it 😊";
      await saveModelResponse(refs, content);
      await refs.convRef.set({ status: 'needs_review', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return NextResponse.json({ reply: { type: 'text', content } });
    }
  }

  const batch = db.batch();

  batch.set(
    refs.convRef,
    {
      status: 'needs_review',
      handoverReason: reason,
      handoverAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),

      // Clear ALL stuck state so the bot can recover
      activeFlow: FieldValue.delete(),
      activeFlowStartedAt: FieldValue.delete(),
      awaitingStep: FieldValue.delete(),
      awaitingSince: FieldValue.delete(),
      aiErrorFlag: FieldValue.delete(),
      aiErrorContextActive: FieldValue.delete(),
      aiErrorCount: FieldValue.delete(),
      lastAiError: FieldValue.delete(),
      lastAiErrorMessagePreview: FieldValue.delete(),
      lastNudgeSent: FieldValue.delete(),
      lastNudgeMessage: FieldValue.delete(),
      lastNudgeContextType: FieldValue.delete(),
      lastNudgeContextPayload: FieldValue.delete(),
      nudgeCount: 0,
    },
    { merge: true }
  );

  batch.set(
    refs.inboxRef,
    {
      status: 'needs_review',
      unreadForVendor: true,
      lastMessageAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  batch.set(refs.msgRef.doc(), {
    role: 'model',
    content: HANDOVER_MESSAGE,
    type: 'text',
    createdAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();

  // Only send SMS on a fresh handover (after cooldown)
  if (storeData?.sellerId) {
    try {
      const sellerSnap = await db.collection('users').doc(storeData.sellerId).get();
      if (sellerSnap.exists) {
        const sellerPhone = sellerSnap.data()?.phone;
        if (sellerPhone) {
          const formattedPhone = formatPhoneNumberForApi(sellerPhone);
          if (formattedPhone) {
            await sendSms(
              formattedPhone,
              `SellQuic AI Handover: A customer on "${storeData.name}" needs help. Chat: https://sellquic.com/dashboard/inbox/${conversationId}`
            );
          }
        }
      }
    } catch (e) {
      console.error('[Handover] SMS failed:', e);
    }
  }

  return NextResponse.json({ reply: { type: 'text', content: HANDOVER_MESSAGE } });
}


// Save model response
// -------------------------------

export async function saveModelResponse(refs: Refs, content: string, payload?: any) {
  const batch = db.batch();
  const isCheckout = payload?.type === 'action' && payload?.action === 'checkout';

  if (payload?.quickReplies) {
    delete payload.quickReplies;
  }

  const safeContent = String(content || '').trim() || '...';

  batch.set(refs.msgRef.doc(), {
    role: 'model',
    content: safeContent,
    createdAt: FieldValue.serverTimestamp(),
    ...(payload?.type ? { type: payload.type } : { type: 'text' }),
    ...(payload?.products ? { products: payload.products } : {}),
    ...(payload?.recommendations ? { recommendations: payload.recommendations } : {}),
    ...(payload?.recommendationNote ? { recommendationNote: payload.recommendationNote } : {}),
    ...(payload?.searchResultIds ? { searchResultIds: payload.searchResultIds } : {}),
    ...(isCheckout ? { actionData: payload } : {}),
  }, { merge: true });

  batch.set(refs.inboxRef, {
    lastMessagePreview: safeContent.slice(0, 160),
    lastMessageAt: FieldValue.serverTimestamp(),
    unreadForVendor: false,
  }, { merge: true });

  const convPatch: Record<string, any> = {
    updatedAt: FieldValue.serverTimestamp(),
    lastAssistantMessage: safeContent,
    lastAssistantMessageAt: FieldValue.serverTimestamp(),
  };
  
  // Only clear pendingAiComeback if this is a real substantive answer
  // not a stall/placeholder message that triggered the retry engine
  const isStallMessage = /give me just a moment|one moment please|just sorting that out|still checking/i.test(safeContent);
  if (!isStallMessage) {
    convPatch.pendingAiComeback = FieldValue.delete();
  }

  if (payload?.searchResultIds?.length) {
    convPatch.lastShownProductIds = payload.searchResultIds;
  }

  if (isCheckout) {
    convPatch.lastActionData = payload;
    convPatch.currentCart = Array.isArray(payload?.items)
      ? payload.items.map((i: any) => ({
          productId: i.productId,
          variantId: i.variantId ?? null,
          quantity: i.quantity,
        }))
      : [];
  }

  batch.set(refs.convRef, convPatch, { merge: true });

  await batch.commit();
}

    
