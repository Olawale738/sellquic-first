import type { TurnContext, AiTurnResult } from '../types';
import type { ClassifiedTurn } from '../nlu/types';
import { resolveOrderLookup } from '../orders/resolveOrderLookup';
import { disambiguateOrders } from '../orders/disambiguateOrders';
import { formatOrderStatusReply, formatOrderListReply } from '../orders/formatOrderStatusReply';
import { createCommerceState } from '../state/commerceState';
import { executeCommerceActions } from '../actions/executeCommerceAction';

/**
 * Stage 3A — Real order lookup handler.
 */
export async function handleOrderStatusQuery(
  ctx: TurnContext,
  classified: ClassifiedTurn | null,
): Promise<AiTurnResult> {
  const slots = classified?.slots ?? {};
  const inAwait = ctx.commerceState.state === 'AWAITING_ORDER_LOOKUP';
  const previousOrderIds = (ctx.commerceState.pendingOrderLookupIds || []).filter(Boolean);

  if (inAwait && previousOrderIds.length >= 2) {
    const previousOrders = await loadOrdersByIds(ctx.storeId, previousOrderIds);
    const picked = disambiguateOrders(ctx.message, previousOrders);
    if (picked) {
      const reply = formatOrderStatusReply(picked, ctx.storeData);
      await clearLookupState(ctx);
      return done(ctx, reply, 'order_status_disambiguated', picked.id);
    }
    return done(
      ctx,
      `I'm not sure which order you mean. ${formatOrderListReply(previousOrders, false)}`,
      'order_status_disambiguation_unclear',
    );
  }

  const phoneFromCtx = ctx.customer?.phone || null;
  const lookupInput = {
    storeId: ctx.storeId,
    paymentReference: slots.orderReference,
    orderId: slots.orderId,
    phoneRaw: slots.phone || phoneFromCtx || undefined,
  };

  const hasAnyInput =
    !!lookupInput.paymentReference || !!lookupInput.orderId || !!lookupInput.phoneRaw;

  if (!hasAnyInput) {
    await setAwaitingLookupState(ctx, []);
    return done(
      ctx,
      "Sure — could you send the phone number you used for the order? I'll check it for you.",
      'order_status_awaiting_phone',
    );
  }


  const result = await resolveOrderLookup(lookupInput);

  if (lookupInput.phoneRaw) {
    try {
      const { triggerMemoryFetch } = await import('../customer-memory/triggerMemoryFetch');
      await triggerMemoryFetch(ctx, lookupInput.phoneRaw);
    } catch (err) {
      console.error('[order-status] memory fetch failed:', err);
    }
  }

  

  if (result.kind === 'found_one') {
    const reply = formatOrderStatusReply(result.order, ctx.storeData);
    await clearLookupState(ctx);
    return done(ctx, reply, 'order_status_found_one', result.order.id);
  }

  if (result.kind === 'found_many') {
    await setAwaitingLookupState(ctx, result.orders.map((o) => o.id));
    return done(
      ctx,
      formatOrderListReply(result.orders, result.truncated),
      'order_status_found_many',
    );
  }
  

  let copy: string;
  if (result.reason === 'reference_no_match') {
    copy = "I'm not finding an order with that reference for this store. Could you double-check, or share the phone number you used for the order?";
  } else if (result.reason === 'phone_no_match') {
    copy = "I'm not seeing an order with that number for this store. Could you double-check the number, or share the order reference?";
  } else {
    copy = "Could you send the phone number you used for the order? I'll check it for you.";
  }
  await setAwaitingLookupState(ctx, []);
  return done(ctx, copy, `order_status_${result.reason}`);
}



async function loadOrdersByIds(storeId: string, ids: string[]) {
  if (ids.length === 0) return [];
  const { db } = await import('@/lib/firebase-admin');
  const snaps = await Promise.all(ids.map((id) => db.collection('orders').doc(id).get()));
  const out = [];
  for (const s of snaps) {
    if (!s.exists) continue;
    const data = s.data() as any;
    if (data?.storeId !== storeId) continue;
    out.push(toLookupOrder(s));
  }
  return out;
}

function toLookupOrder(doc: any) {
  const data = doc.data();
  const items = Array.isArray(data?.items) ? data.items : [];
  return {
    id: doc.id,
    paymentReference: data?.paymentReference || null,
    paymentStatus: data?.paymentStatus || null,
    selectedPaymentMethod: data?.selectedPaymentMethod || null,
    status: data?.status || null,
    totalAmount: Number(data?.totalAmount || 0),
    createdAt: data?.createdAt?.toDate?.() ?? null,
    paidAt: data?.paidAt?.toDate?.() ?? null,
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

async function setAwaitingLookupState(ctx: TurnContext, orderIds: string[]) {
  const next = createCommerceState('AWAITING_ORDER_LOOKUP', {
    ...stateBase(ctx),
    pendingOrderLookupIds: orderIds,
  } as any);
  await executeCommerceActions(ctx, [
    { type: 'SET_COMMERCE_STATE', state: next, reason: 'order_lookup_awaiting' },
  ]);
}

async function clearLookupState(ctx: TurnContext) {
  const next = createCommerceState('BROWSING', {
    ...stateBase(ctx),
    pendingOrderLookupIds: null,
  } as any);
  await executeCommerceActions(ctx, [
    { type: 'SET_COMMERCE_STATE', state: next, reason: 'order_lookup_done' },
  ]);
}

function stateBase(ctx: TurnContext) {
  return {
    pendingProductId: ctx.commerceState.pendingProductId || null,
    pendingVariantId: ctx.commerceState.pendingVariantId || null,
    lastShownProductIds: ctx.commerceState.lastShownProductIds || [],
    displayedProductIds: ctx.commerceState.displayedProductIds || [],
    lastMentionedProductId: ctx.commerceState.lastMentionedProductId || null,
  };
}

function done(ctx: TurnContext, content: string, reason: string, focusOrderId?: string): AiTurnResult {
  return {
    reply: { type: 'text', content },
    debug: {
      stateBefore: ctx.commerceState.state,
      stateAfter: ctx.commerceState.state,
      handler: 'handleOrderStatusQuery',
      reason: focusOrderId ? `${reason}|order:${focusOrderId}` : reason,
    },
  };
}