import { db } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { AiTurnResult, ProductV2, TurnContext } from '../types';
import { resolveVariantSmart } from '../catalog/resolveVariantSmart';
import { createCommerceState } from '../state/commerceState';

function findPendingProduct(ctx: TurnContext): ProductV2 | null {
  const pendingProductId =
    ctx.commerceState.pendingProductId ||
    (ctx.commerceState.lastShownProductIds?.length === 1
      ? ctx.commerceState.lastShownProductIds[0]
      : null);

  if (!pendingProductId) return null;

  return ctx.products.find((product) => product.id === pendingProductId) || null;
}

async function persistCommerceState(
  ctx: TurnContext,
  state: ReturnType<typeof createCommerceState>
) {
  const convRef = db
    .collection('stores')
    .doc(ctx.storeId)
    .collection('ai_conversations')
    .doc(ctx.conversationId);

  await convRef.set(
    {
      commerceState: state,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Customer's first name from memory, suitable for inline use
 * ("How many, Maurice?"). Returns empty string when not available.
 */
function nameSuffix(ctx: TurnContext): string {
  const fullName = ctx.customer?.memory?.name?.trim();
  if (!fullName) return '';
  const firstName = fullName.split(/\s+/)[0];
  if (!firstName || firstName.length < 2) return '';
  return `, ${firstName}`;
}

export async function handleVariantReply(ctx: TurnContext): Promise<AiTurnResult> {
  const product = findPendingProduct(ctx);
  const name = nameSuffix(ctx);

  if (!product) {
    const state = createCommerceState('IDLE');
    await persistCommerceState(ctx, state);

    return {
      reply: {
        type: 'text',
        content: `Sorry${name}, which product were you asking about?`,
      },
      debug: {
        stateBefore: ctx.commerceState.state,
        stateAfter: state.state,
        handler: 'handleVariantReply',
        reason: 'missing_pending_product',
      },
    };
  }

  const apiKey = process.env.GEMINI_API_KEY || '';
  const result = await resolveVariantSmart(ctx.message, product, apiKey);

  if (result.status === 'no_match') {
    const options = product.variants?.map((variant) => variant.name).join(', ') || '';

    const state = createCommerceState('AWAITING_VARIANT', {
      pendingProductId: product.id,
      lastShownProductIds: [product.id],
    });
    await persistCommerceState(ctx, state);

    return {
      reply: {
        type: 'text',
        content: options
          ? `Got it. For ${product.name} we have: ${options}. Which one would you like${name}?`
          : `Which option would you like for ${product.name}${name}?`,
      },
      debug: {
        stateBefore: ctx.commerceState.state,
        stateAfter: state.state,
        handler: 'handleVariantReply',
        reason: result.reason,
      },
    };
  }

  if (result.status === 'multiple_matches') {
    const options = result.variants.map((variant) => variant.name).join(', ');

    const state = createCommerceState('AWAITING_VARIANT', {
      pendingProductId: product.id,
      lastShownProductIds: [product.id],
    });
    await persistCommerceState(ctx, state);

    return {
      reply: {
        type: 'text',
        content: `A few options match: ${options}. Which one exactly${name}?`,
      },
      debug: {
        stateBefore: ctx.commerceState.state,
        stateAfter: state.state,
        handler: 'handleVariantReply',
        reason: result.reason,
      },
    };
  }

  const variant = result.variant;

  if (!variant) {
    const state = createCommerceState('AWAITING_VARIANT', {
      pendingProductId: product.id,
      lastShownProductIds: [product.id],
    });
    await persistCommerceState(ctx, state);

    return {
      reply: {
        type: 'text',
        content: `Which option would you like for ${product.name}${name}?`,
      },
      debug: {
        stateBefore: ctx.commerceState.state,
        stateAfter: state.state,
        handler: 'handleVariantReply',
        reason: 'variant_missing_after_match',
      },
    };
  }

  if (result.purchasable === false) {
    const state = createCommerceState('AWAITING_VARIANT', {
      pendingProductId: product.id,
      lastShownProductIds: [product.id],
    });
    await persistCommerceState(ctx, state);

    return {
      reply: {
        type: 'text',
        content: `Sorry${name}, ${variant.name} is sold out right now. Want to pick another option?`,
      },
      debug: {
        stateBefore: ctx.commerceState.state,
        stateAfter: state.state,
        handler: 'handleVariantReply',
        reason: 'variant_not_purchasable',
      },
    };
  }

  const state = createCommerceState('AWAITING_QUANTITY', {
    pendingProductId: product.id,
    pendingVariantId: variant.id,
    lastShownProductIds: [product.id],
  });
  await persistCommerceState(ctx, state);

  return {
    reply: {
      type: 'text',
      content: `Got it — ${variant.name}! How many should I add${name}?`,
    },
    debug: {
      stateBefore: ctx.commerceState.state,
      stateAfter: state.state,
      handler: 'handleVariantReply',
      reason: 'variant_selected',
    },
  };
}