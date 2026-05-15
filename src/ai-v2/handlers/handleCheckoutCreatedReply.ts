import type { AiTurnResult, TurnContext, AiV2Reply } from '../types';
import { createCommerceState } from '../state/commerceState';
import { executeCommerceActions } from '../actions/executeCommerceAction';
import { extractConfirmation } from '../extractors/extractConfirmation';
import { resolveDeliveryZone } from '../delivery/resolveDeliveryZone';
import { searchProducts } from '../search/searchProducts';
import { formatProductCards } from '../catalog/formatProductCards';

function nameSuffix(ctx: TurnContext): string {
  const fullName = ctx.customer?.memory?.name?.trim();
  if (!fullName) return '';
  const firstName = fullName.split(/\s+/)[0];
  if (!firstName || firstName.length < 2) return '';
  return `, ${firstName}`;
}

function isThankYou(message: string): boolean {
  const text = String(message || '').toLowerCase().trim();
  return /^(thanks|thank you|thank you please|ok thanks|okay thanks|alright thanks|alright, thank you|alright thank you|alright|okay|ok|thanks please)$/i.test(text);
}

function isResendLinkIntent(message: string): boolean {
  const text = String(message || '').toLowerCase().trim();
  return /\b(resend|resent|send again|link again|checkout link|send the link|where is the link)\b/i.test(text);
}

function isAddMoreIntent(message: string): boolean {
  const text = String(message || '').toLowerCase().trim();
  return /\b(add more|add another item|add another items|new item|another item|add item|add something|buy more|order more)\b/i.test(text);
}

function isChangeAddressIntent(message: string): boolean {
  const text = String(message || '').toLowerCase().trim();
  return (
    /\b(change|update|edit|use|set|new|different).*(address|landmark|house|location)\b/i.test(text) ||
    /^(change address|address|new address|different address)$/i.test(text)
  );
}

function isChangeDeliveryIntent(message: string): boolean {
  const text = String(message || '').toLowerCase().trim();
  return (
    /\b(change|update|edit|switch|different|new).*(delivery area|delivery|area)\b/i.test(text) ||
    /^(delivery|delivery area|change delivery|change delivery area)$/i.test(text)
  );
}

function isDeliveryFeeQuestion(message: string): boolean {
  const text = String(message || '').toLowerCase().trim();
  return /\b(how much|price|fee|cost).*(delivery|deliver|shipping)|\b(delivery|deliver).*(to|for)\b/i.test(text);
}

function isProductAvailabilityQuestion(message: string): boolean {
  const text = String(message || '').toLowerCase().trim();
  return /\b(do you have|do u have|have|sell|any|is there|available|in stock)\b/i.test(text);
}

async function setCheckoutCreatedState(ctx: TurnContext, reason: string) {
  const state = createCommerceState('CHECKOUT_CREATED', {
    lastShownProductIds: ctx.commerceState.lastShownProductIds || [],
    pendingProductId: ctx.commerceState.pendingProductId || null,
    pendingVariantId: ctx.commerceState.pendingVariantId || null,
  });
  await executeCommerceActions(ctx, [
    { type: 'SET_COMMERCE_STATE', state, reason },
  ]);
  return state;
}

async function clearCheckoutAndSetState(
  ctx: TurnContext,
  state: ReturnType<typeof createCommerceState>,
  reason: string
) {
  return executeCommerceActions(ctx, [
    { type: 'CLEAR_CHECKOUT', reason: `${reason}_clear_checkout` },
    { type: 'SET_COMMERCE_STATE', state, reason },
  ]);
}

function getCheckoutActionFromConversation(ctx: TurnContext): AiV2Reply | null {
  const action = ctx.convData?.lastActionData;

  if (action?.type === 'action' && action?.action === 'checkout' && action?.url) {
    return {
      type: 'action',
      action: 'checkout',
      label: action.label || 'Complete Order',
      url: action.url,
      content: action.content || 'Your checkout link is ready.',
      total: Number(action.total || 0),
      items: Array.isArray(action.items) ? action.items : [],
    };
  }

  if (ctx.orderSession.checkoutUrl) {
    return {
      type: 'text',
      content: `Your checkout link is ready: ${ctx.orderSession.checkoutUrl}`,
    };
  }

  return null;
}

function formatDeliveryAreas(ctx: TurnContext): string {
  return ctx.deliveries
    .slice(0, 8)
    .map((zone) => `${zone.label} — GHS ${zone.fee}`)
    .join('\n');
}

export async function handleCheckoutCreatedReply(
  ctx: TurnContext
): Promise<AiTurnResult> {
  const confirmationIntent = extractConfirmation(ctx.message);
  const name = nameSuffix(ctx);

  if (isThankYou(ctx.message)) {
    const state = await setCheckoutCreatedState(ctx, 'thank_you_after_checkout_keep_state');

    return {
      reply: {
        type: 'text',
        content: `You're welcome${name}! You can complete the order with the checkout link anytime.`,
      },
      debug: {
        stateBefore: ctx.commerceState.state,
        stateAfter: state.state,
        handler: 'handleCheckoutCreatedReply',
        reason: 'thank_you_after_checkout',
      },
    };
  }

  if (isResendLinkIntent(ctx.message) || confirmationIntent === 'confirm') {
    const checkoutReply = getCheckoutActionFromConversation(ctx);
    if (checkoutReply) {
      return {
        reply: checkoutReply,
        debug: {
          stateBefore: ctx.commerceState.state,
          stateAfter: ctx.commerceState.state,
          handler: 'handleCheckoutCreatedReply',
          reason: 'resend_checkout_link',
        },
      };
    }

    const state = createCommerceState('READY_FOR_CHECKOUT', {
      lastShownProductIds: ctx.commerceState.lastShownProductIds || [],
      pendingProductId: ctx.commerceState.pendingProductId || null,
      pendingVariantId: ctx.commerceState.pendingVariantId || null,
    });
    await executeCommerceActions(ctx, [
      { type: 'SET_COMMERCE_STATE', state, reason: 'checkout_link_missing_ready_to_recreate' },
    ]);

    return {
      reply: {
        type: 'text',
        content: `Should I recreate the checkout link${name}?`,
      },
      debug: {
        stateBefore: ctx.commerceState.state,
        stateAfter: state.state,
        handler: 'handleCheckoutCreatedReply',
        reason: 'checkout_link_missing',
      },
    };
  }

  if (isChangeAddressIntent(ctx.message)) {
    const state = createCommerceState('AWAITING_ADDRESS', {
      lastShownProductIds: ctx.commerceState.lastShownProductIds || [],
      pendingProductId: ctx.commerceState.pendingProductId || null,
      pendingVariantId: ctx.commerceState.pendingVariantId || null,
    });

    const { ctx: updatedCtx, execution } = await clearCheckoutAndSetState(
      ctx, state, 'change_address_after_checkout',
    );

    return {
      reply: {
        type: 'text',
        content: `Sure${name}. Send the new address or a nearby landmark.`,
      },
      debug: {
        stateBefore: ctx.commerceState.state,
        stateAfter: updatedCtx.commerceState.state,
        handler: 'handleCheckoutCreatedReply',
        reason: execution.reasonSummary.join('|') || 'change_address_after_checkout',
      },
    };
  }

  if (isChangeDeliveryIntent(ctx.message)) {
    const state = createCommerceState('AWAITING_DELIVERY_AREA', {
      lastShownProductIds: ctx.commerceState.lastShownProductIds || [],
      pendingProductId: ctx.commerceState.pendingProductId || null,
      pendingVariantId: ctx.commerceState.pendingVariantId || null,
    });

    const { ctx: updatedCtx, execution } = await clearCheckoutAndSetState(
      ctx, state, 'change_delivery_after_checkout',
    );

    return {
      reply: {
        type: 'text',
        content: `Sure${name}. Which delivery area should I use instead?`,
      },
      debug: {
        stateBefore: ctx.commerceState.state,
        stateAfter: updatedCtx.commerceState.state,
        handler: 'handleCheckoutCreatedReply',
        reason: execution.reasonSummary.join('|') || 'change_delivery_after_checkout',
      },
    };
  }

  if (isDeliveryFeeQuestion(ctx.message)) {
    const result = resolveDeliveryZone(ctx.message, ctx.deliveries);

    if (result.status === 'single_match' && result.zone) {
      return {
        reply: {
          type: 'text',
          content: `Delivery to ${result.zone.label} is GHS ${result.zone.fee}. Your checkout link is still ready. To switch, say "change delivery to ${result.zone.label}".`,
        },
        debug: {
          stateBefore: ctx.commerceState.state,
          stateAfter: ctx.commerceState.state,
          handler: 'handleCheckoutCreatedReply',
          reason: 'delivery_fee_question_after_checkout',
        },
      };
    }

    if (result.status === 'multiple_matches') {
      const options = result.zones
        .map((zone) => `${zone.label} — GHS ${zone.fee}`)
        .join('\n');

      return {
        reply: {
          type: 'text',
          content: `A few areas match:\n\n${options}\n\nYour checkout link is still ready. Tell me the exact area to switch.`,
        },
        debug: {
          stateBefore: ctx.commerceState.state,
          stateAfter: ctx.commerceState.state,
          handler: 'handleCheckoutCreatedReply',
          reason: 'delivery_fee_multiple_matches_after_checkout',
        },
      };
    }

    const areas = formatDeliveryAreas(ctx);

    return {
      reply: {
        type: 'text',
        content: areas
          ? `I couldn't match that area${name}. We deliver to:\n\n${areas}`
          : `I couldn't find delivery areas for this store${name}.`,
      },
      debug: {
        stateBefore: ctx.commerceState.state,
        stateAfter: ctx.commerceState.state,
        handler: 'handleCheckoutCreatedReply',
        reason: 'delivery_fee_no_match_after_checkout',
      },
    };
  }

  if (isAddMoreIntent(ctx.message)) {
    const state = createCommerceState('BROWSING', {
      lastShownProductIds: ctx.commerceState.lastShownProductIds || [],
      pendingProductId: null,
      pendingVariantId: null,
    });

    const { ctx: updatedCtx, execution } = await clearCheckoutAndSetState(
      ctx, state, 'add_more_after_checkout',
    );

    return {
      reply: {
        type: 'text',
        content: `Sure${name}. What else would you like to add?`,
      },
      debug: {
        stateBefore: ctx.commerceState.state,
        stateAfter: updatedCtx.commerceState.state,
        handler: 'handleCheckoutCreatedReply',
        reason: execution.reasonSummary.join('|') || 'add_more_after_checkout',
      },
    };
  }

  if (isProductAvailabilityQuestion(ctx.message)) {
    const result = await searchProducts({
      query: ctx.message,
      products: ctx.products,
      storeId: ctx.storeId,
      limit: 6,
    });

    if (result.status === 'single_match') {
      return {
        reply: {
          type: 'product_cards',
          content: `Yes, we have it${name}. To add to your current order, say "add more" then send the product name.`,
          products: formatProductCards(result.products, ctx.storeData),
        },
        debug: {
          stateBefore: ctx.commerceState.state,
          stateAfter: ctx.commerceState.state,
          handler: 'handleCheckoutCreatedReply',
          reason: `product_question_after_checkout_${result.reason}`,
        },
      };
    }

    if (result.status === 'multiple_matches') {
      return {
        reply: {
          type: 'product_cards',
          content: `Found a few options${name}. To add one to your current order, say "add more" then tell me which.`,
          products: formatProductCards(result.products.slice(0, 6), ctx.storeData),
        },
        debug: {
          stateBefore: ctx.commerceState.state,
          stateAfter: ctx.commerceState.state,
          handler: 'handleCheckoutCreatedReply',
          reason: `multiple_product_question_after_checkout_${result.reason}`,
        },
      };
    }

    return {
      reply: {
        type: 'text',
        content: `I couldn't find that in the catalog${name}. Your checkout link is still ready.`,
      },
      debug: {
        stateBefore: ctx.commerceState.state,
        stateAfter: ctx.commerceState.state,
        handler: 'handleCheckoutCreatedReply',
        reason: `product_question_no_match_after_checkout_${result.reason}`,
      },
    };
  }

  if (confirmationIntent === 'deny') {
    const state = await setCheckoutCreatedState(ctx, 'deny_after_checkout_keep_state');

    return {
      reply: {
        type: 'text',
        content: `No problem${name}. Your checkout link is still available. You can say "add more", "change address", "change delivery", or "resend link".`,
      },
      debug: {
        stateBefore: ctx.commerceState.state,
        stateAfter: state.state,
        handler: 'handleCheckoutCreatedReply',
        reason: 'deny_after_checkout',
      },
    };
  }

  return {
    reply: {
      type: 'text',
      content: `Your checkout link is ready${name}. You can say "resend link", "add more", "change address", or "change delivery".`,
    },
    debug: {
      stateBefore: ctx.commerceState.state,
      stateAfter: ctx.commerceState.state,
      handler: 'handleCheckoutCreatedReply',
      reason: 'checkout_created_unclear_followup',
    },
  };
}