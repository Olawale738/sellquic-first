import type { AiTurnResult, TurnContext } from '../types';
import { extractConfirmation } from '../extractors/extractConfirmation';
import { createCommerceState } from '../state/commerceState';
import { validateCheckoutReadiness } from '../checkout/validateCheckoutReadiness';
import { buildCheckout } from '../checkout/buildCheckout';
import { executeCommerceActions } from '../actions/executeCommerceAction';

function nameSuffix(ctx: TurnContext): string {
  const fullName = ctx.customer?.memory?.name?.trim();
  if (!fullName) return '';
  const firstName = fullName.split(/\s+/)[0];
  if (!firstName || firstName.length < 2) return '';
  return `, ${firstName}`;
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

export async function handleCheckoutConfirmation(
  ctx: TurnContext
): Promise<AiTurnResult> {
  const intent = extractConfirmation(ctx.message);
  const name = nameSuffix(ctx);

  if (intent === 'deny') {
    const state = createCommerceState('BROWSING', {
      lastShownProductIds: ctx.commerceState.lastShownProductIds || [],
      pendingProductId: ctx.commerceState.pendingProductId || null,
      pendingVariantId: ctx.commerceState.pendingVariantId || null,
      postDenialMode: true,
    });
    await persistStateOnly(ctx, state, 'checkout_denied');

    return {
      reply: {
        type: 'text',
        content: `No problem${name}. Want to add more items or change anything?`,
      },
      debug: {
        stateBefore: ctx.commerceState.state,
        stateAfter: state.state,
        handler: 'handleCheckoutConfirmation',
        reason: 'checkout_denied',
      },
    };
  }

  if (intent === 'unclear') {
    const state = createCommerceState('READY_FOR_CHECKOUT', {
      lastShownProductIds: ctx.commerceState.lastShownProductIds || [],
      pendingProductId: ctx.commerceState.pendingProductId || null,
      pendingVariantId: ctx.commerceState.pendingVariantId || null,
    });
    await persistStateOnly(ctx, state, 'checkout_confirmation_unclear');

    return {
      reply: {
        type: 'text',
        content: `Should I create the checkout link${name}? Say yes, "add more", or "change delivery".`,
      },
      debug: {
        stateBefore: ctx.commerceState.state,
        stateAfter: state.state,
        handler: 'handleCheckoutConfirmation',
        reason: 'checkout_confirmation_unclear',
      },
    };
  }

  // ─── HARD GATE: never confirm checkout with empty cart ────────────
  // Architectural invariant: no cart, no checkout. Runs only on the
  // confirm path (deny/unclear handled above). If we get here with
  // empty cart, upstream routing/state has drifted — re-anchor to
  // the focus product or ask the customer to pick one. NEVER proceed
  // to validateCheckoutReadiness/buildCheckout/SAVE_CHECKOUT.
  if (!Array.isArray(ctx.currentCart) || ctx.currentCart.length === 0) {
    const focusId =
      ctx.commerceState.pendingProductId ||
      ctx.commerceState.lastMentionedProductId ||
      null;
    const focus = focusId
      ? ctx.products.find((p) => p.id === focusId) || null
      : null;

    if (focus) {
      const hasVariants =
        focus.hasVariants === true &&
        Array.isArray(focus.variants) &&
        focus.variants.length > 0;
      const targetState =
        hasVariants && !ctx.commerceState.pendingVariantId
          ? 'AWAITING_VARIANT'
          : 'AWAITING_QUANTITY';

      const state = createCommerceState(targetState, {
        pendingProductId: focus.id,
        pendingVariantId: ctx.commerceState.pendingVariantId || null,
        lastMentionedProductId: focus.id,
        lastShownProductIds: [focus.id],
      });

      await persistStateOnly(
        ctx,
        state,
        'checkout_attempted_empty_cart_re_anchor',
      );

      const prompt =
        targetState === 'AWAITING_VARIANT'
          ? `We were looking at ${focus.name}${name} — which option would you like please?`
          : `We were looking at ${focus.name}${name} — how many should I add for you please?`;

      return {
        reply: { type: 'text', content: prompt },
        debug: {
          stateBefore: ctx.commerceState.state,
          stateAfter: state.state,
          handler: 'handleCheckoutConfirmation',
          reason: 'empty_cart_re_anchor_to_focus',
        },
      };
    }

    // No focus product either — ask the customer what they want.
    const idle = createCommerceState('IDLE');
    await persistStateOnly(
      ctx,
      idle,
      'checkout_attempted_empty_cart_no_focus',
    );

    return {
      reply: {
        type: 'text',
        content: `We do not have anything in your order yet${name}. What would you like to order today please?`,
      },
      debug: {
        stateBefore: ctx.commerceState.state,
        stateAfter: idle.state,
        handler: 'handleCheckoutConfirmation',
        reason: 'empty_cart_no_focus',
      },
    };
  }
  // ─── end HARD GATE ────────────────────────────────────────────────

  const readiness = validateCheckoutReadiness(ctx);

  if (!readiness.ok) {
    const state = createCommerceState(readiness.missingState, {
      lastShownProductIds: ctx.commerceState.lastShownProductIds || [],
      pendingProductId: ctx.commerceState.pendingProductId || null,
      pendingVariantId: ctx.commerceState.pendingVariantId || null,
    });
    await persistStateOnly(ctx, state, readiness.reason);

    return {
      reply: {
        type: 'text',
        content: readiness.message,
      },
      debug: {
        stateBefore: ctx.commerceState.state,
        stateAfter: state.state,
        handler: 'handleCheckoutConfirmation',
        reason: readiness.reason,
      },
    };
  }

  const checkout = buildCheckout(ctx);

  const { ctx: updatedCtx, execution } = await executeCommerceActions(ctx, [
    { type: 'SAVE_CHECKOUT', checkout, reason: 'checkout_confirmed_and_saved' },
  ]);

  return {
    reply: checkout.reply,
    debug: {
      stateBefore: ctx.commerceState.state,
      stateAfter: updatedCtx.commerceState.state,
      handler: 'handleCheckoutConfirmation',
      reason: execution.reasonSummary.join('|') || 'checkout_created',
    },
  };
}