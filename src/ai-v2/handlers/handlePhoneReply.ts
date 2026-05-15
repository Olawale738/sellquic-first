import type { AiTurnResult, TurnContext } from '../types';
import { extractPhone } from '../extractors/extractPhone';
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

function buildNextQuestion(ctx: TurnContext, state: string): string {
  const name = nameSuffix(ctx);
  switch (state) {
    case 'AWAITING_NAME':
      return `What name should I put on the order${name}?`;
    case 'READY_FOR_CHECKOUT':
      return buildCheckoutConfirmationQuestion(ctx);
    default:
      return 'Anything else to add?';
  }
}

async function persistStateOnly(
  ctx: TurnContext,
  state: ReturnType<typeof createCommerceState>,
  reason: string
) {
  await executeCommerceActions(ctx, [
    { type: 'SET_COMMERCE_STATE', state, reason },
  ]);
}

export async function handlePhoneReply(ctx: TurnContext): Promise<AiTurnResult> {
  const phone = extractPhone(ctx.message);
  const name = nameSuffix(ctx);

  if (!phone) {
    const state = createCommerceState('AWAITING_PHONE', {
      pendingProductId: ctx.commerceState.pendingProductId || null,
      pendingVariantId: ctx.commerceState.pendingVariantId || null,
      lastShownProductIds: ctx.commerceState.lastShownProductIds || [],
    });
    await persistStateOnly(ctx, state, 'phone_missing_or_invalid');

    return {
      reply: {
        type: 'text',
        content: `That doesn't look like a Ghana phone number${name}. Send something like 0597788056.`,
      },
      debug: {
        stateBefore: ctx.commerceState.state,
        stateAfter: state.state,
        handler: 'handlePhoneReply',
        reason: 'phone_missing_or_invalid',
      },
    };
  }

  const { ctx: updatedCtx, execution } = await executeCommerceActions(ctx, [
    { type: 'SET_PHONE', phone, reason: 'set_customer_phone' },
    {
      type: 'DERIVE_NEXT_STATE',
      statePatch: {
        pendingProductId: ctx.commerceState.pendingProductId || null,
        pendingVariantId: ctx.commerceState.pendingVariantId || null,
        lastShownProductIds: ctx.commerceState.lastShownProductIds || [],
      },
      reason: 'derive_next_state_after_phone',
    },
  ]);

  try {
    const { triggerMemoryFetch } = await import('../customer-memory/triggerMemoryFetch');
    await triggerMemoryFetch(updatedCtx, phone);
  } catch (err) {
    console.error('[handlePhoneReply] memory fetch failed:', err);
  }

  const nextQuestion = buildNextQuestion(updatedCtx, updatedCtx.commerceState.state);

  return {
    reply: {
      type: 'text',
      content: `Got it — ${phone}. ${nextQuestion}`,
    },
    debug: {
      stateBefore: ctx.commerceState.state,
      stateAfter: updatedCtx.commerceState.state,
      handler: 'handlePhoneReply',
      reason: execution.reasonSummary.join('|') || 'phone_saved',
    },
  };
}