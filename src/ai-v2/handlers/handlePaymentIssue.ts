import type { AiTurnResult, TurnContext } from '../types';

/**
 * "I paid" / "payment done" / "I have paid".
 *
 * Policy: never assert payment was received. Acknowledge, ask for evidence
 * (transaction ID / screenshot / sender phone), and tell them the seller
 * will confirm. Do NOT respond with payment-methods FAQ.
 *
 * Does not change commerce state. Sets nothing on orderSession.status —
 * that transition is owned by the seller's verification, not the bot.
 */
export async function handlePaymentIssue(
  ctx: TurnContext
): Promise<AiTurnResult> {
  const session = ctx.orderSession || {};
  const total = session.checkoutTotal != null ? session.checkoutTotal : null;
  const totalText = total != null ? ` of GHS ${total.toFixed(2)}` : '';

  return {
    reply: {
      type: 'text',
      content:
        `Thanks for letting me know please. Could you share the transaction ID or a screenshot of the payment${totalText}? I'll pass it to the seller for confirmation.`,
    },
    debug: {
      stateBefore: ctx.commerceState.state,
      stateAfter: ctx.commerceState.state,
      handler: 'handlePaymentIssue',
      reason: 'payment_acknowledged',
    },
  };
}