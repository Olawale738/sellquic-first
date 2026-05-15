import type { TurnContext, AiTurnResult } from '../types';
import type { ClassifiedTurn, Intent } from '../nlu/types';
import { resolveOrderLookup } from '../orders/resolveOrderLookup';
import { createCommerceState } from '../state/commerceState';
import { executeCommerceActions } from '../actions/executeCommerceAction';

/**
 * Stage 3B — Support request handler.
 *
 * Philosophy:
 *   - AI flags conversations for vendor attention but NEVER flips the
 *     `handoverMode` toggle. That toggle belongs to the vendor (inbox UI).
 *   - When AI escalates, it writes signals the vendor inbox uses
 *     (status: 'needs_review', pendingAiComeback: false, handoverReason,
 *     handoverAt) and tells the customer the seller has been notified.
 *   - AI keeps talking afterwards. The vendor decides via the toggle
 *     when to take over directly.
 */

export type SupportKind =
  | 'refund_request'
  | 'return_request'
  | 'exchange_request'
  | 'cancel_order'
  | 'damaged_item'
  | 'wrong_item'
  | 'late_delivery'
  | 'general_complaint';

const COMMAND_TO_KIND: Partial<Record<Intent, SupportKind>> = {
  command_refund_request: 'refund_request',
  command_return_request: 'return_request',
  command_exchange_request: 'exchange_request',
  command_cancel_order: 'cancel_order',
  command_damaged_item: 'damaged_item',
  command_wrong_item: 'wrong_item',
  command_late_delivery: 'late_delivery',
  command_general_complaint: 'general_complaint',
};

export async function handleSupportRequest(
  ctx: TurnContext,
  classified: ClassifiedTurn | null,
): Promise<AiTurnResult> {
  const slots = classified?.slots ?? {};
  const intent = classified?.intent;

  const kind: SupportKind | null =
    (intent && COMMAND_TO_KIND[intent]) ||
    (slots.carriedSupportIntent as SupportKind) ||
    ((ctx.commerceState as any).carriedSupportIntent as SupportKind) ||
    null;

  if (!kind) {
    return notifyAndReply(
      ctx,
      "I've let the seller know — they'll reach out shortly.",
      'support_unknown_kind',
      'general_complaint',
    );
  }

  // ── Disambiguation: customer is replying to a 2-3 order list shown
  //    in a previous turn. Mirrors Stage 3A's order-lookup behavior.
  const inAwait = ctx.commerceState.state === 'AWAITING_SUPPORT_LOOKUP';
  const previousOrderIds = (
    (ctx.commerceState as any).pendingOrderLookupIds || []
  ).filter(Boolean) as string[];

  if (inAwait && previousOrderIds.length >= 2) {
    const previousOrders = await loadOrdersByIds(ctx.storeId, previousOrderIds);
  
    // First try ordinal slot from classifier (e.g. "2" picks 2nd order).
    const ordinal = slots.ordinal;
    if (typeof ordinal === 'number' && ordinal >= 0 && ordinal < previousOrders.length) {
      return await replyForResolved(ctx, previousOrders[ordinal], kind);
    }
  
    // Fall back to natural-language disambiguation ("the brown one", "May 10").
    const { disambiguateOrders } = await import('../orders/disambiguateOrders');
    const picked = disambiguateOrders(ctx.message, previousOrders);
    if (picked) {
      return await replyForResolved(ctx, picked, kind);
    }
  
    // Couldn't disambiguate — re-list with empathy.
    const lines = previousOrders.map((o, i) => {
      const item = o.items[0];
      const itemLabel = item
        ? `${item.productName}${item.variantName ? ` (${item.variantName})` : ''}`
        : 'item';
      const dateLabel = o.createdAt ? ` — ${formatDate(o.createdAt)}` : '';
      return `${i + 1}. ${itemLabel} — GHS ${o.totalAmount}${dateLabel}`;
    });
    return reply(
      ctx,
      `${empathyOpening(kind)} I'm not sure which order you mean.\n\n${lines.join('\n')}\n\nWhich one is this about?`,
      `support_${kind}_disambiguation_unclear`,
    );
  }

  // ── Vague complaint clarification ────────────────────────────────────
  if (kind === 'general_complaint' && !slots.orderReference && !slots.orderId && !slots.phone) {
    if (ctx.commerceState.state !== 'AWAITING_SUPPORT_LOOKUP') {
      await setSupportLookupState(ctx, 'general_complaint');
      return reply(
        ctx,
        'Sorry please, what exactly happened with the order?',
        'support_general_clarify',
      );
    }
    return notifyAndReply(
      ctx,
      "I've let the seller know — they'll reach out shortly to help you sort it out.",
      'support_general_unclear',
      'general_complaint',
    );
  }

  // ── Try to resolve the order ─────────────────────────────────────────
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
    await setSupportLookupState(ctx, kind);
    return reply(
      ctx,
      `${empathyOpening(kind)} Could you send the phone number you used for the order? I'll pull it up.`,
      `support_${kind}_awaiting_phone`,
    );
  }

  const result = await resolveOrderLookup(lookupInput);

  if (lookupInput.phoneRaw) {
    try {
      const { triggerMemoryFetch } = await import('../customer-memory/triggerMemoryFetch');
      await triggerMemoryFetch(ctx, lookupInput.phoneRaw);
    } catch (err) {
      console.error('[support] memory fetch failed:', err);
    }
  }

  if (result.kind === 'not_found') {
    return notifyAndReply(
      ctx,
      `${empathyOpening(kind)} I'm not seeing an order with that info, but I've let the seller know — they'll reach out shortly to help.`,
      `support_${kind}_no_order`,
      kind,
    );
  }

  if (result.kind === 'found_many') {
    const ids = result.orders.map((o) => o.id);
    await setSupportLookupState(ctx, kind, ids);
    const lines = result.orders.map((o, i) => {
      const item = o.items[0];
      const itemLabel = item
        ? `${item.productName}${item.variantName ? ` (${item.variantName})` : ''}`
        : 'item';
      const dateLabel = o.createdAt ? ` — ${formatDate(o.createdAt)}` : '';
      return `${i + 1}. ${itemLabel} — GHS ${o.totalAmount}${dateLabel}`;
    });
    return reply(
      ctx,
      `${empathyOpening(kind)} I see a few orders on that number:\n\n${lines.join('\n')}\n\nWhich one is this about?`,
      `support_${kind}_pick_order`,
    );
  }

  return await replyForResolved(ctx, result.order, kind);
}

// ─────────────────────────────────────────────────────────────────────────
// Per-kind resolved replies
// ─────────────────────────────────────────────────────────────────────────

async function replyForResolved(
  ctx: TurnContext,
  order: any,
  kind: SupportKind,
): Promise<AiTurnResult> {
  const itemLabel = describeOrder(order);
  const policy = activeReturnPolicy(ctx.storeData);
  const phoneSeller = sellerNotifyHint(ctx);

  switch (kind) {
    case 'damaged_item':
    case 'wrong_item': {
      const apology =
        kind === 'damaged_item'
          ? `Sorry the ${itemLabel} arrived damaged.`
          : `Sorry the wrong item came (${itemLabel}).`;
      const policyLine = policy ? ` Here's our policy: ${policy}` : '';
      return notifyAndReply(
        ctx,
        `${apology}${policyLine} I've let the seller know${phoneSeller} — they'll reach out shortly.`,
        `support_${kind}_notified`,
        kind,
      );
    }

    case 'refund_request':
    case 'return_request':
    case 'exchange_request': {
      const verb =
        kind === 'refund_request' ? 'refund'
        : kind === 'return_request' ? 'return'
        : 'exchange';
      const apology = `Got it — you'd like to ${verb} ${itemLabel}.`;
      const policyLine = policy ? ` Here's our policy: ${policy}` : '';
      return notifyAndReply(
        ctx,
        `${apology}${policyLine} The seller will reach out shortly to confirm next steps.`,
        `support_${kind}_notified`,
        kind,
      );
    }

    case 'cancel_order': {
      const status = String(order.status || '').toLowerCase();
      let line: string;
      if (status === 'awaiting-payment' || status === 'pending') {
        line = `Your order is still in ${status === 'awaiting-payment' ? 'pre-payment' : 'pending'} status, so the seller can usually cancel at this stage.`;
      } else if (status === 'confirmed') {
        line = `Your order is already confirmed. The seller will check whether cancellation is still possible.`;
      } else if (status === 'shipped' || status === 'on-the-way') {
        line = `Your order is already on its way. The seller will check what can be done.`;
      } else if (status === 'fulfilled' || status === 'delivered') {
        line = `Your order has already been delivered. The seller will reach out to discuss options.`;
      } else if (status === 'cancelled') {
        line = `This order is already cancelled. If you still have a concern, the seller will follow up.`;
      } else {
        line = `The seller will check on the order status and follow up.`;
      }
      return notifyAndReply(
        ctx,
        `Got it — you'd like to cancel ${itemLabel}. ${line}`,
        `support_cancel_${status || 'unknown'}_notified`,
        kind,
      );
    }

    case 'late_delivery': {
      const timeline = vendorDeliveryTimeline(ctx.storeData);
      const created = order.createdAt instanceof Date ? order.createdAt : null;
      const daysSince = created ? Math.floor((Date.now() - created.getTime()) / 86400000) : null;
      const status = String(order.status || '').toLowerCase();

      if (status === 'fulfilled' || status === 'delivered') {
        return reply(
          ctx,
          `This order is already marked as delivered. If you haven't received it, the seller will check.`,
          'support_late_delivery_already_delivered',
        );
      }

      let timelineLine: string;
      if (timeline) {
        timelineLine = `The seller's delivery timeline is ${timeline}.`;
      } else {
        timelineLine = "I don't have the exact delivery timeline here, so I've let the seller know to confirm for you.";
      }

      const dayLine = daysSince != null ? ` It's been about ${daysSince} day${daysSince === 1 ? '' : 's'} since you ordered.` : '';

      return notifyAndReply(
        ctx,
        `Sorry it's taking longer than expected.${dayLine} ${timelineLine} The seller will follow up shortly${phoneSeller}.`,
        'support_late_delivery_notified',
        kind,
      );
    }

    case 'general_complaint': {
      return notifyAndReply(
        ctx,
        `Sorry to hear about that. I've let the seller know${phoneSeller} — they'll reach out shortly to sort it out.`,
        'support_general_notified',
        kind,
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

function empathyOpening(kind: SupportKind): string {
  switch (kind) {
    case 'damaged_item':       return 'Sorry the item arrived damaged.';
    case 'wrong_item':         return 'Sorry the wrong item came.';
    case 'refund_request':     return "Got it — you'd like a refund.";
    case 'return_request':     return "Got it — you'd like to return the item.";
    case 'exchange_request':   return "Got it — you'd like an exchange.";
    case 'cancel_order':       return "Got it — you'd like to cancel.";
    case 'late_delivery':      return "Sorry it's taking longer than expected.";
    case 'general_complaint':  return 'Sorry to hear about that.';
  }
}

function describeOrder(order: any): string {
  const items = Array.isArray(order.items) ? order.items : [];
  if (items.length === 0) return 'your order';
  const first = items[0];
  const variant = first.variantName ? ` (${first.variantName})` : '';
  if (items.length === 1) return `${first.productName}${variant}`;
  return `${first.productName}${variant} and ${items.length - 1} other item(s)`;
}

function activeReturnPolicy(storeData: any): string | null {
  if (storeData?.isReturnPolicyActive !== true) return null;
  const text = String(storeData?.returnPolicy || '').trim();
  if (!text) return null;
  return text.length > 300 ? `${text.slice(0, 300)}...` : text;
}

function vendorDeliveryTimeline(storeData: any): string | null {
  const t = storeData?.deliveryTimeline;
  if (typeof t === 'string' && t.trim().length > 0) return t.trim();
  return null;
}

function sellerNotifyHint(ctx: TurnContext): string {
  const phone = ctx.customer?.phone;
  return phone ? ` and will reach out via ${phone}` : '';
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
}

async function loadOrdersByIds(storeId: string, ids: string[]) {
  if (ids.length === 0) return [];
  const { db } = await import('@/lib/firebase-admin');
  const snaps = await Promise.all(
    ids.map((id) => db.collection('orders').doc(id).get()),
  );
  const out: any[] = [];
  for (const s of snaps) {
    if (!s.exists) continue;
    const data = s.data() as any;
    if (data?.storeId !== storeId) continue;
    const items = Array.isArray(data?.items) ? data.items : [];
    out.push({
      id: s.id,
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
    });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────
// State + notification (NOT handover — vendor owns that toggle)
// ─────────────────────────────────────────────────────────────────────────

async function setSupportLookupState(
  ctx: TurnContext,
  kind: SupportKind,
  pendingOrderIds: string[] = [],
): Promise<void> {
  const next = createCommerceState('AWAITING_SUPPORT_LOOKUP', {
    pendingProductId: ctx.commerceState.pendingProductId || null,
    pendingVariantId: ctx.commerceState.pendingVariantId || null,
    lastShownProductIds: ctx.commerceState.lastShownProductIds || [],
    displayedProductIds: ctx.commerceState.displayedProductIds || [],
    lastMentionedProductId: ctx.commerceState.lastMentionedProductId || null,
    pendingOrderLookupIds: pendingOrderIds,
    carriedSupportIntent: kind,
  } as any);
  await executeCommerceActions(ctx, [
    { type: 'SET_COMMERCE_STATE', state: next, reason: `support_${kind}_awaiting` },
  ]);
}

/**
 * Notify the vendor (mark conversation for review) and reply to the
 * customer. Drops back to BROWSING so AI keeps talking on the next turn.
 *
 * Critical: never writes `handoverMode: true`. That toggle is owned by
 * the vendor's inbox UI.
 */
async function notifyAndReply(
  ctx: TurnContext,
  content: string,
  reason: string,
  kind: SupportKind,
): Promise<AiTurnResult> {
  await markConversationForReview(ctx, kind);
  const next = createCommerceState('BROWSING', {
    pendingProductId: ctx.commerceState.pendingProductId || null,
    pendingVariantId: ctx.commerceState.pendingVariantId || null,
    lastShownProductIds: ctx.commerceState.lastShownProductIds || [],
    displayedProductIds: ctx.commerceState.displayedProductIds || [],
    lastMentionedProductId: ctx.commerceState.lastMentionedProductId || null,
    pendingOrderLookupIds: null,
    carriedSupportIntent: null,
  } as any);
  await executeCommerceActions(ctx, [
    { type: 'SET_COMMERCE_STATE', state: next, reason },
  ]);
  return reply(ctx, content, reason);
}

async function markConversationForReview(
  ctx: TurnContext,
  kind: SupportKind,
): Promise<void> {
  try {
    const { db } = await import('@/lib/firebase-admin');
    const { FieldValue } = await import('firebase-admin/firestore');
    await db
      .collection('stores')
      .doc(ctx.storeId)
      .collection('ai_conversations')
      .doc(ctx.conversationId)
      .update({
        // Vendor-attention signals — do NOT touch handoverMode.
        status: 'needs_review',
        pendingAiComeback: false,
        handoverReason: kind,
        handoverAt: FieldValue.serverTimestamp(),
        // Notification triggers (email/SMS) are wired separately and may
        // listen on `status: 'needs_review'`. Deferred for now.
      });
  } catch (err) {
    console.error('[support] failed to mark for review:', err);
  }
}

function reply(ctx: TurnContext, content: string, reason: string): AiTurnResult {
  return {
    reply: { type: 'text', content },
    debug: {
      stateBefore: ctx.commerceState.state,
      stateAfter: ctx.commerceState.state,
      handler: 'handleSupportRequest',
      reason,
    },
  };
}