import type { AiTurnResult, TurnContext } from '../types';

export type ValidatorResult =
  | { ok: true }
  | {
      ok: false;
      reason: string;
      safeReply: AiTurnResult['reply'];
    };

function textContainsCartMutationClaim(text: string): boolean {
  return /\b(added|add(ed)? to (your )?(cart|bag)|i'?ve added|item has been added)\b/i.test(
    text
  );
}

function isCheckoutQuestion(text: string): boolean {
  return (
    /\b(should i|shall i|can i|would you like me to|do you want me to)\b/i.test(text) &&
    /\b(create|send|prepare|generate).*(checkout|link)|checkout link\b/i.test(text)
  );
}

function textContainsCheckoutClaim(text: string): boolean {
  if (isCheckoutQuestion(text)) return false;
  return /\b(here'?s your checkout link|checkout link is ready|your checkout link is ready|checkout is ready|tap to complete|\/checkout\?)/i.test(
    text
  );
}

/**
 * Catches "I have finalized/completed your order" — composer claiming
 * the order is done. Question forms ("should I finalize?") are
 * handled by isCheckoutQuestion above and never reach here.
 */
function textContainsFinalizationClaim(text: string): boolean {
  if (isCheckoutQuestion(text)) return false;
  return (
    /\b(finaliz(ed|ing)|complet(ed|ing))\s+(your|the|this)\s+(order|purchase)\b/i.test(
      text,
    ) || /\b(i\s+have|i'?ve)\s+(finaliz(ed|ing)|complet(ed|ing))\b/i.test(text)
  );
}

/**
 * Catches "I have sent the link" / "I am sending the link to your
 * phone" — composer fabricating that a link was dispatched.
 */
function textContainsLinkSendClaim(text: string): boolean {
  if (isCheckoutQuestion(text)) return false;
  if (
    /\b(i\s+have\s+sent|i'?ve\s+sent|just\s+sent|have\s+sent)\b[^.!?]*\b(link|payment|checkout)\b/i.test(
      text,
    )
  ) {
    return true;
  }
  if (
    /\b(i\s+am\s+sending|i'?m\s+sending|am\s+sending)\b[^.!?]*\b(link|payment|checkout|to\s+your\s+(phone|number))\b/i.test(
      text,
    )
  ) {
    return true;
  }
  if (/\blink\s+i\s+(am\s+sending|'?m\s+sending|have\s+sent|'?ve\s+sent)\b/i.test(text)) {
    return true;
  }
  return false;
}

export function ghostActionValidator(
  ctx: TurnContext,
  result: AiTurnResult
): ValidatorResult {
  const reply = result.reply;

  if (reply.type === 'silent') return { ok: true };

  if (reply.type === 'action' && reply.action === 'checkout') {
    return { ok: true };
  }

  const text =
    reply.type === 'text'
      ? reply.content
      : reply.type === 'product_cards'
        ? reply.content
        : '';

  if (!text) return { ok: true };

  const handler = result.debug?.handler || '';
  const cartIsEmpty =
    !Array.isArray(ctx.currentCart) || ctx.currentCart.length === 0;

  const allowedCartMutationHandlers = new Set([
    'handleQuantityReply',
    'handleAddProductCombined',
    'handleCartUpdate',
    'handleCartReplace',
  ]);

  if (textContainsCartMutationClaim(text) && !allowedCartMutationHandlers.has(handler)) {
    return {
      ok: false,
      reason: 'ghost_cart_mutation_claim',
      safeReply: {
        type: 'text',
        content:
          'Please let me confirm that properly. Which product and quantity should I add for you?',
      },
    };
  }

  // Only the actual checkout-creation handler emits a real link.
  // Confirmation handler asks for confirmation; it does not yet have a link.
  const allowedFinalizationHandlers = new Set(['handleCheckoutCreatedReply']);
  const allowedCheckoutClaimHandlers = new Set([
    'handleCheckoutConfirmation',
    'handleCheckoutCreatedReply',
  ]);

  // 1. "I have finalized your order"
  if (
    textContainsFinalizationClaim(text) &&
    (!allowedFinalizationHandlers.has(handler) || cartIsEmpty)
  ) {
    return {
      ok: false,
      reason: cartIsEmpty
        ? 'ghost_finalization_claim_empty_cart'
        : 'ghost_finalization_claim_wrong_handler',
      safeReply: {
        type: 'text',
        content: cartIsEmpty
          ? 'Sorry please, I do not have anything in your order yet. What would you like to order?'
          : 'Please let me confirm the order details before finalizing.',
      },
    };
  }

  // 2. "I have sent / I am sending the link"
  if (
    textContainsLinkSendClaim(text) &&
    (!allowedFinalizationHandlers.has(handler) || cartIsEmpty)
  ) {
    return {
      ok: false,
      reason: cartIsEmpty
        ? 'ghost_link_send_claim_empty_cart'
        : 'ghost_link_send_claim_wrong_handler',
      safeReply: {
        type: 'text',
        content: cartIsEmpty
          ? 'Sorry please, I have not sent any link yet — your order is still empty. What would you like to order?'
          : 'Please let me prepare the actual checkout link for you.',
      },
    };
  }

  // 3. Generic checkout-link declarative claims.
  if (textContainsCheckoutClaim(text) && !allowedCheckoutClaimHandlers.has(handler)) {
    return {
      ok: false,
      reason: 'ghost_checkout_claim',
      safeReply: {
        type: 'text',
        content:
          'Please let me confirm the order details properly before creating the checkout link.',
      },
    };
  }

  return { ok: true };
}