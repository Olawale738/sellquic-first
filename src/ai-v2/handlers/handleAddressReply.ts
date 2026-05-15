import type { AiTurnResult, TurnContext } from '../types';
import { createCommerceState } from '../state/commerceState';
import { executeCommerceActions } from '../actions/executeCommerceAction';
import { buildCheckoutConfirmationQuestion } from '../checkout/formatCheckoutQuestion';

function nameSuffix(ctx: TurnContext): string {
  const fullName = ctx.customer?.memory?.name?.trim();
  if (!fullName) return '';
  const firstName = fullName.split(/\s+/)[0];
  if (!firstName || firstName.length < 2) return '';
  return `, ${firstName}`;
}

const BAD_ADDRESS_REPLIES = new Set([
  'yes', 'yeah', 'yep', 'ok', 'okay', 'alright', 'sure', 'please', 'pls',
  'same', 'use same', 'no', 'nope',
]);

function extractAddress(text: string): string | null {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (BAD_ADDRESS_REPLIES.has(lower)) return null;
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  if (cleaned.length < 3) return null;
  if (cleaned.length > 250) return cleaned.slice(0, 250);
  return cleaned;
}

function buildNextQuestion(ctx: TurnContext, state: string): string {
  const name = nameSuffix(ctx);
  switch (state) {
    case 'AWAITING_PHONE':
      return `What phone number should I use${name}?`;
    case 'AWAITING_NAME':
      return `What name should I put on the order${name}?`;
    case 'READY_FOR_CHECKOUT':
      return buildCheckoutConfirmationQuestion(ctx);
    default:
      return 'Anything else to add?';
  }
}

export async function handleAddressReply(ctx: TurnContext): Promise<AiTurnResult> {
  const address = extractAddress(ctx.message);
  const name = nameSuffix(ctx);

  if (!address) {
    const state = createCommerceState('AWAITING_ADDRESS', {
      pendingProductId: ctx.commerceState.pendingProductId || null,
      pendingVariantId: ctx.commerceState.pendingVariantId || null,
      lastShownProductIds: ctx.commerceState.lastShownProductIds || [],
    });

    await executeCommerceActions(ctx, [
      { type: 'SET_COMMERCE_STATE', state, reason: 'address_missing_or_invalid' },
    ]);

    return {
      reply: {
        type: 'text',
        content: `Send the delivery address or a nearby landmark${name}.`,
      },
      debug: {
        stateBefore: ctx.commerceState.state,
        stateAfter: state.state,
        handler: 'handleAddressReply',
        reason: 'address_missing_or_invalid',
      },
    };
  }

  const { ctx: updatedCtx, execution } = await executeCommerceActions(ctx, [
    { type: 'SET_ADDRESS', address, reason: 'set_customer_address' },
    {
      type: 'DERIVE_NEXT_STATE',
      statePatch: {
        pendingProductId: ctx.commerceState.pendingProductId || null,
        pendingVariantId: ctx.commerceState.pendingVariantId || null,
        lastShownProductIds: ctx.commerceState.lastShownProductIds || [],
      },
      reason: 'derive_next_state_after_address',
    },
  ]);

  const nextQuestion = buildNextQuestion(updatedCtx, updatedCtx.commerceState.state);

  return {
    reply: {
      type: 'text',
      content: `Got it — ${address}. ${nextQuestion}`,
    },
    debug: {
      stateBefore: ctx.commerceState.state,
      stateAfter: updatedCtx.commerceState.state,
      handler: 'handleAddressReply',
      reason: execution.reasonSummary.join('|') || 'address_saved',
    },
  };
}