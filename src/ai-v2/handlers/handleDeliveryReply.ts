import type { AiTurnResult, DeliveryZoneV2, TurnContext } from '../types';
import { resolveDeliveryZoneSmart } from '../delivery/resolveDeliveryZoneSmart';
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
    case 'AWAITING_ADDRESS':
      return `Send the delivery address or a landmark${name}.`;
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

async function persistStateOnly(
  ctx: TurnContext,
  state: ReturnType<typeof createCommerceState>,
  reason: string
) {
  await executeCommerceActions(ctx, [
    { type: 'SET_COMMERCE_STATE', state, reason },
  ]);
}

function formatDeliveryZoneList(zones: DeliveryZoneV2[]): string {
  return zones
    .slice(0, 8)
    .map((zone) => `${zone.label} — GHS ${zone.fee}`)
    .join('\n');
}

export async function handleDeliveryReply(ctx: TurnContext): Promise<AiTurnResult> {
  const name = nameSuffix(ctx);

  if (!ctx.deliveries.length) {
    const state = createCommerceState('AWAITING_ADDRESS');
    await persistStateOnly(ctx, state, 'no_delivery_zones_configured');

    return {
      reply: {
        type: 'text',
        content: `Send the delivery address or a nearby landmark${name}.`,
      },
      debug: {
        stateBefore: ctx.commerceState.state,
        stateAfter: state.state,
        handler: 'handleDeliveryReply',
        reason: 'no_delivery_zones_configured',
      },
    };
  }

  const apiKey = process.env.GEMINI_API_KEY || '';
  const result = await resolveDeliveryZoneSmart(ctx.message, ctx.deliveries, apiKey);

  if (result.status === 'no_match') {
    const zoneList = formatDeliveryZoneList(ctx.deliveries);

    const state = createCommerceState('AWAITING_DELIVERY_AREA', {
      pendingProductId: ctx.commerceState.pendingProductId || null,
      pendingVariantId: ctx.commerceState.pendingVariantId || null,
      lastShownProductIds: ctx.commerceState.lastShownProductIds || [],
    });
    await persistStateOnly(ctx, state, result.reason);

    return {
      reply: {
        type: 'text',
        content: zoneList
          ? `I couldn't match that area${name}. We deliver to:\n\n${zoneList}\n\nWhich one works?`
          : `Send your delivery area again${name}.`,
      },
      debug: {
        stateBefore: ctx.commerceState.state,
        stateAfter: state.state,
        handler: 'handleDeliveryReply',
        reason: result.reason,
      },
    };
  }

  if (result.status === 'multiple_matches') {
    const options = formatDeliveryZoneList(result.zones);

    const state = createCommerceState('AWAITING_DELIVERY_AREA', {
      pendingProductId: ctx.commerceState.pendingProductId || null,
      pendingVariantId: ctx.commerceState.pendingVariantId || null,
      lastShownProductIds: ctx.commerceState.lastShownProductIds || [],
    });
    await persistStateOnly(ctx, state, result.reason);

    return {
      reply: {
        type: 'text',
        content: `A few areas match:\n\n${options}\n\nWhich exact one${name}?`,
      },
      debug: {
        stateBefore: ctx.commerceState.state,
        stateAfter: state.state,
        handler: 'handleDeliveryReply',
        reason: result.reason,
      },
    };
  }

  const zone = result.zone;

  if (!zone) {
    const state = createCommerceState('AWAITING_DELIVERY_AREA', {
      pendingProductId: ctx.commerceState.pendingProductId || null,
      pendingVariantId: ctx.commerceState.pendingVariantId || null,
      lastShownProductIds: ctx.commerceState.lastShownProductIds || [],
    });
    await persistStateOnly(ctx, state, 'zone_missing_after_match');

    return {
      reply: {
        type: 'text',
        content: `Send your delivery area again${name}.`,
      },
      debug: {
        stateBefore: ctx.commerceState.state,
        stateAfter: state.state,
        handler: 'handleDeliveryReply',
        reason: 'zone_missing_after_match',
      },
    };
  }

  const { ctx: updatedCtx, execution } = await executeCommerceActions(ctx, [
    { type: 'SET_DELIVERY', zone, reason: 'set_delivery_zone' },
    {
      type: 'DERIVE_NEXT_STATE',
      statePatch: {
        pendingProductId: ctx.commerceState.pendingProductId || null,
        pendingVariantId: ctx.commerceState.pendingVariantId || null,
        lastShownProductIds: ctx.commerceState.lastShownProductIds || [],
      },
      reason: 'derive_next_state_after_delivery',
    },
  ]);

  const nextQuestion = buildNextQuestion(updatedCtx, updatedCtx.commerceState.state);

  return {
    reply: {
      type: 'text',
      content: `Got it — ${zone.label}, GHS ${zone.fee}. ${nextQuestion}`,
    },
    debug: {
      stateBefore: ctx.commerceState.state,
      stateAfter: updatedCtx.commerceState.state,
      handler: 'handleDeliveryReply',
      reason: execution.reasonSummary.join('|') || 'delivery_saved',
    },
  };
}