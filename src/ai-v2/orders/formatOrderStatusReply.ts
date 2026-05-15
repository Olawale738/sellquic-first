import type { LookupOrder } from './resolveOrderLookup';

/**
 * Format honest customer-facing copy from a single order document.
 *
 * Inputs:
 *   - order — the resolved Firestore order
 *   - storeData — vendor's store doc, for policy fields:
 *       deliveryTimeline, deliveryNotice
 *
 * Rules:
 *   - All facts come from the order doc or storeData. Never invent.
 *   - Payment status copy depends on selectedPaymentMethod, NOT just paymentStatus.
 *   - COD never sounds like an unpaid problem.
 *   - When the vendor has no policy field, say so honestly.
 */
export function formatOrderStatusReply(
  order: LookupOrder,
  storeData: any,
): string {
  const parts: string[] = [];

  parts.push(itemsLine(order));
  parts.push(paymentLine(order));
  parts.push(statusLine(order, storeData));

  return parts.filter(Boolean).join(' ');
}

function itemsLine(order: LookupOrder): string {
  if (order.items.length === 0) return '';
  const labels = order.items.map((i) => {
    const variant = i.variantName ? ` (${i.variantName})` : '';
    const qty = i.quantity > 1 ? ` x${i.quantity}` : '';
    return `${i.productName}${variant}${qty}`;
  });
  const summary = labels.length === 1
    ? labels[0]
    : labels.length <= 3
      ? labels.join(', ')
      : `${labels.slice(0, 3).join(', ')} and ${labels.length - 3} more item(s)`;

  return `Found your order for ${summary} (GHS ${order.totalAmount}).`;
}

function paymentLine(order: LookupOrder): string {
  const method = (order.selectedPaymentMethod || '').toLowerCase();
  const paymentStatus = (order.paymentStatus || '').toLowerCase();
  const status = (order.status || '').toLowerCase();

  // COD — never frame as unpaid problem.
  if (method === 'cod') {
    const isPickup = (order.delivery?.label || '').toLowerCase().includes('pick');
    if (isPickup) {
      return 'This is a Cash on Pickup order — payment is made when you pick it up.';
    }
    return 'This is a Cash on Delivery order — payment is made when you receive it.';
  }

  // Paystack
  if (method === 'paystack') {
    if (paymentStatus === 'paid') {
      const paidOn = order.paidAt ? ` on ${formatDate(order.paidAt)}` : '';
      return `Payment was received${paidOn}.`;
    }
    return 'I can see this order, but payment is not marked as received yet. If you already paid, please share the payment reference or screenshot so the seller can confirm.';
  }

  // Manual MoMo / bank
  if (method === 'momo') {
    if (paymentStatus === 'paid' || status === 'confirmed') {
      return 'The seller has confirmed your payment.';
    }
    if (status === 'pending') {
      return "The seller is still confirming your MoMo payment. They'll update the order once they see it.";
    }
    return 'This is a MoMo / bank transfer order. The seller will confirm payment once they see it. If you have already paid, please share the transaction ID or a screenshot.';
  }

  // Unknown method — honest fallback.
  if (paymentStatus === 'paid') return 'Payment has been received.';
  return '';
}

function statusLine(order: LookupOrder, storeData: any): string {
  const status = (order.status || '').toLowerCase();

  switch (status) {
    case 'awaiting-payment':
      return ''; // payment line already explains this case.

    case 'pending':
      return "It's been received and is waiting on the seller to confirm.";

    case 'confirmed': {
      const timeline = vendorDeliveryTimeline(storeData);
      const notice = vendorDeliveryNotice(storeData);
      const isPickup = (order.delivery?.label || '').toLowerCase().includes('pick');

      if (isPickup) {
        return notice
          ? `Order is confirmed and ready for pickup. ${notice}`
          : 'Order is confirmed and ready for pickup. The seller will share pickup details with you.';
      }

      const base = 'Order is confirmed.';
      if (timeline) {
        return `${base} The seller's typical delivery is ${timeline}.${notice ? ` ${notice}` : ''}`;
      }
      return notice
        ? `${base} ${notice}`
        : `${base} The seller will share a delivery update with you.`;
    }

    case 'on-the-way':
    case 'shipped':
      return 'Your order is on the way.';

    case 'fulfilled':
    case 'delivered':
      return 'This order has been delivered.';

    case 'cancelled':
      return 'This order has been cancelled.';

    default:
      return '';
  }
}

function vendorDeliveryTimeline(storeData: any): string | null {
  const t = storeData?.deliveryTimeline;
  if (typeof t === 'string' && t.trim().length > 0) return t.trim();
  return null;
}

function vendorDeliveryNotice(storeData: any): string | null {
  const t = storeData?.deliveryNotice;
  if (typeof t === 'string' && t.trim().length > 0) return t.trim();
  return null;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
}

/**
 * Format a multi-order disambiguation list. Used when phone matches 2-3
 * orders or when 4+ are truncated to 3.
 */
export function formatOrderListReply(
  orders: LookupOrder[],
  truncated: boolean,
): string {
  const lines = orders.map((o, idx) => {
    const item = o.items[0];
    const itemLabel = item
      ? `${item.productName}${item.variantName ? ` (${item.variantName})` : ''}`
      : 'item';
    const dateLabel = o.createdAt ? ` — ${formatDate(o.createdAt)}` : '';
    return `${idx + 1}. ${itemLabel} — GHS ${o.totalAmount}${dateLabel}`;
  });

  const intro = truncated
    ? "I see a few recent orders on that number. Here are the latest 3:"
    : `I see ${orders.length} recent orders on that number:`;

  const tail = truncated
    ? "\n\nWhich one are you asking about? If you mean an older order, please share the order reference."
    : '\n\nWhich one are you asking about? You can say the item, the month, or the amount.';

  return `${intro}\n\n${lines.join('\n')}${tail}`;
}