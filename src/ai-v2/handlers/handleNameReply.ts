import type { AiTurnResult, TurnContext } from '../types';
import { extractName } from '../extractors/extractName';
import { createCommerceState } from '../state/commerceState';
import { executeCommerceActions } from '../actions/executeCommerceAction';
import { buildCheckoutConfirmationQuestion } from '../checkout/formatCheckoutQuestion';

function buildNextQuestion(ctx: TurnContext, state: string): string {
  switch (state) {
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

export async function handleNameReply(ctx: TurnContext): Promise<AiTurnResult> {
  const name = extractName(ctx.message);

  if (!name) {
    const state = createCommerceState('AWAITING_NAME', {
      pendingProductId: ctx.commerceState.pendingProductId || null,
      pendingVariantId: ctx.commerceState.pendingVariantId || null,
      lastShownProductIds: ctx.commerceState.lastShownProductIds || [],
    });
    await persistStateOnly(ctx, state, 'name_missing_or_invalid');

    return {
      reply: {
        type: 'text',
        content: 'What name should I put on the order?',
      },
      debug: {
        stateBefore: ctx.commerceState.state,
        stateAfter: state.state,
        handler: 'handleNameReply',
        reason: 'name_missing_or_invalid',
      },
    };
  }

  const { ctx: updatedCtx, execution } = await executeCommerceActions(ctx, [
    { type: 'SET_NAME', name, reason: 'set_customer_name' },
    {
      type: 'DERIVE_NEXT_STATE',
      statePatch: {
        pendingProductId: ctx.commerceState.pendingProductId || null,
        pendingVariantId: ctx.commerceState.pendingVariantId || null,
        lastShownProductIds: ctx.commerceState.lastShownProductIds || [],
      },
      reason: 'derive_next_state_after_name',
    },
  ]);

  const nextQuestion = buildNextQuestion(updatedCtx, updatedCtx.commerceState.state);

  return {
    reply: {
      type: 'text',
      content: `Thanks ${name}! ${nextQuestion}`,
    },
    debug: {
      stateBefore: ctx.commerceState.state,
      stateAfter: updatedCtx.commerceState.state,
      handler: 'handleNameReply',
      reason: execution.reasonSummary.join('|') || 'name_saved',
    },
  };
}