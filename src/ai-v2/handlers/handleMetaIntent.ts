import type { AiTurnResult, TurnContext } from '../types';
import type { Intent } from '../nlu/types';
import { composeReplyWithGemini } from '../composer/composeReply';
import type { FactPacket } from '../composer/factPacket';

export async function handleMetaIntent(
  ctx: TurnContext,
  intent: Intent,
): Promise<AiTurnResult> {
  const useComposer = ctx.storeData?.aiV2?.useGeminiReplyComposer === true;
  const apiKey = process.env.GEMINI_API_KEY || '';
  const cartCount = Array.isArray(ctx.currentCart) ? ctx.currentCart.length : 0;
  const hasItems = cartCount > 0;
  const customerName = ctx.customer?.memory?.name?.trim() || null;
  const storeName = ctx.storeData?.name || 'our store';

  const packet: FactPacket = {
    intent: intent === 'meta_greeting' ? 'greeting' : 'unknown_message',
    allowedAction: 'speak_only',
    facts: {
      storeName,
      customerName: customerName || undefined,
      isReturningCustomer: ctx.customer?.memory?.isReturningCustomer === true,
      catalogSummary: hasItems
        ? `customer has ${cartCount} item(s) in cart`
        : 'cart is empty',
    },
    nextStep: hasItems
      ? "ask if they're ready to check out, or want to add more"
      : 'ask what they want to shop for',
    forbiddenClaims: [
      'never invent prices',
      'never invent stock',
      'never promise delivery',
    ],
    toneHints: [
      'friendly Ghanaian sales assistant',
      'warm but brief',
    ],
  };

  let replyText: string;
  if (useComposer && apiKey) {
    const outcome = await composeReplyWithGemini(packet, ctx, apiKey);
    if (outcome.ok && outcome.replyText) {
      replyText = outcome.replyText;
    } else {
      replyText = buildFallbackReply(intent, hasItems, customerName, storeName);
    }
  } else {
    replyText = buildFallbackReply(intent, hasItems, customerName, storeName);
  }

  return {
    reply: { type: 'text', content: replyText },
    debug: {
      stateBefore: ctx.commerceState.state,
      stateAfter: ctx.commerceState.state,
      handler: 'handleMetaIntent',
      reason: `meta:${intent}|hasItems:${hasItems}|composer:${useComposer ? 'tried' : 'off'}`,
    },
  };
}

function buildFallbackReply(
  intent: Intent,
  hasItems: boolean,
  customerName: string | null,
  storeName: string,
): string {
  const namePart = customerName ? `, ${customerName}` : '';

  if (intent === 'meta_greeting') {
    return customerName
      ? `Hi ${customerName}, welcome back to ${storeName}! What can I get for you today?`
      : `Hi! Welcome to ${storeName}. What can I get for you today?`;
  }

  if (intent === 'meta_thanks') {
    return hasItems
      ? `You're welcome${namePart}! Ready to check out, or want to add anything else?`
      : `You're welcome${namePart}! Anything else I can help you find?`;
  }

  return hasItems
    ? `Anything else to add${namePart}, or should I create the checkout link?`
    : `What can I help you find${namePart}?`;
}
