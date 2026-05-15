import type { AiTurnResult, TurnContext } from '../types';

export type PriceValidatorResult =
  | { ok: true }
  | {
      ok: false;
      reason: string;
      safeReply: AiTurnResult['reply'];
    };

function extractGhsAmounts(text: string): number[] {
  const matches = String(text || '').matchAll(/GHS\s*([\d,]+(?:\.\d{1,2})?)/gi);

  return Array.from(matches)
    .map((match) => Number(String(match[1]).replace(/,/g, '')))
    .filter((value) => Number.isFinite(value));
}

function moneyEqual(a: number, b: number): boolean {
  return Math.abs(Number(a) - Number(b)) < 0.01;
}

export function priceValidator(
  _ctx: TurnContext,
  result: AiTurnResult
): PriceValidatorResult {
  const reply = result.reply;

  if (reply.type === 'silent') return { ok: true };

  if (reply.type === 'action' && reply.action === 'checkout') {
    const itemTotals = Array.isArray(reply.items)
      ? reply.items.map((item: any) => Number(item.lineTotal || 0))
      : [];

    const calculatedItemsTotal = itemTotals.reduce((sum, value) => sum + value, 0);
    const replyTotal = Number(reply.total || 0);

    if (!Number.isFinite(replyTotal) || replyTotal <= 0) {
      return {
        ok: false,
        reason: 'checkout_total_invalid',
        safeReply: {
          type: 'text',
          content:
            'Please let me confirm the order total properly before sending the checkout link.',
        },
      };
    }

    if (calculatedItemsTotal <= 0) {
      return {
        ok: false,
        reason: 'checkout_items_total_invalid',
        safeReply: {
          type: 'text',
          content:
            'Please let me confirm the cart properly before sending the checkout link.',
        },
      };
    }

    return { ok: true };
  }

  const text =
    reply.type === 'text'
      ? reply.content
      : reply.type === 'product_cards'
        ? reply.content
        : '';

  const amounts = extractGhsAmounts(text);

  if (amounts.some((amount) => !Number.isFinite(amount) || amount < 0)) {
    return {
      ok: false,
      reason: 'invalid_price_mentioned',
      safeReply: {
        type: 'text',
        content: 'Please let me confirm the price properly for you.',
      },
    };
  }

  return { ok: true };
}