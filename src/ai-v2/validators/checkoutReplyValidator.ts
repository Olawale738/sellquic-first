import type { AiTurnResult, TurnContext } from '../types';

export type CheckoutValidatorResult =
  | { ok: true }
  | {
      ok: false;
      reason: string;
      safeReply: AiTurnResult['reply'];
    };

export function checkoutReplyValidator(
  ctx: TurnContext,
  result: AiTurnResult
): CheckoutValidatorResult {
  const reply = result.reply;

  if (reply.type !== 'action') return { ok: true };

  if (reply.action !== 'checkout') {
    return {
      ok: false,
      reason: 'unknown_action_reply',
      safeReply: {
        type: 'text',
        content: 'Please let me confirm that properly for you.',
      },
    };
  }

  if (!reply.url || !reply.url.startsWith('/checkout?')) {
    return {
      ok: false,
      reason: 'invalid_checkout_url',
      safeReply: {
        type: 'text',
        content:
          'Please give me a moment to recreate the checkout link properly.',
      },
    };
  }

  if (!Array.isArray(reply.items) || reply.items.length === 0) {
    return {
      ok: false,
      reason: 'checkout_without_items',
      safeReply: {
        type: 'text',
        content: 'Please which product would you like to order?',
      },
    };
  }

  if (!Number.isFinite(Number(reply.total)) || Number(reply.total) <= 0) {
    return {
      ok: false,
      reason: 'invalid_checkout_total',
      safeReply: {
        type: 'text',
        content:
          'Please let me confirm the order total properly before sending the checkout link.',
      },
    };
  }

  if (ctx.deliveries.length > 0 && !ctx.orderSession.deliveryId) {
    return {
      ok: false,
      reason: 'checkout_missing_delivery',
      safeReply: {
        type: 'text',
        content: 'Where should we deliver it please?',
      },
    };
  }

  if (ctx.deliveries.length > 0 && !ctx.customer.address && !ctx.orderSession.customerAddress) {
    return {
      ok: false,
      reason: 'checkout_missing_address',
      safeReply: {
        type: 'text',
        content: 'Please send the specific delivery address or nearby landmark.',
      },
    };
  }

  if (!ctx.customer.phone) {
    return {
      ok: false,
      reason: 'checkout_missing_phone',
      safeReply: {
        type: 'text',
        content: 'What phone number should we use for the order please?',
      },
    };
  }

  if (!ctx.customer.name) {
    return {
      ok: false,
      reason: 'checkout_missing_name',
      safeReply: {
        type: 'text',
        content: 'What name should I put on the order please?',
      },
    };
  }

  return { ok: true };
}