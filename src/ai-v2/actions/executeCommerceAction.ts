import { db } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type {
  CartItemV2,
  OrderSessionV2,
  PersistedCommerceState,
  TurnContext,
} from '../types';
import { createCommerceState } from '../state/commerceState';
import { getNextRequiredStep } from '../state/nextRequiredStep';
import type {
  CommerceAction,
  CommerceActionExecutionResult,
} from './types';

function getConversationRef(ctx: TurnContext) {
  return db
    .collection('stores')
    .doc(ctx.storeId)
    .collection('ai_conversations')
    .doc(ctx.conversationId);
}

function shouldInvalidateCheckout(action: CommerceAction): boolean {
  return [
    'CLEAR_CART',
    'REPLACE_CART',
    'SET_DELIVERY',
    'SET_ADDRESS',
    'SET_PHONE',
    'SET_NAME',
  ].includes(action.type);
}

function cloneOrderSession(ctx: TurnContext): OrderSessionV2 {
  return {
    ...(ctx.convData?.orderSession || {}),
    ...ctx.orderSession,
  };
}

function buildUpdatedContext(input: {
  ctx: TurnContext;
  currentCart: CartItemV2[];
  orderSession: OrderSessionV2;
  customer: TurnContext['customer'];
  commerceState: PersistedCommerceState;
}): TurnContext {
  return {
    ...input.ctx,
    currentCart: input.currentCart,
    orderSession: input.orderSession,
    customer: input.customer,
    commerceState: input.commerceState,
  };
}

export async function executeCommerceActions(
  ctx: TurnContext,
  actions: CommerceAction[]
): Promise<{
  ctx: TurnContext;
  execution: CommerceActionExecutionResult;
}> {
  let currentCart: CartItemV2[] = [...(ctx.currentCart || [])];
  let orderSession: OrderSessionV2 = cloneOrderSession(ctx);
  let customer: TurnContext['customer'] = { ...ctx.customer };
  let commerceState: PersistedCommerceState = ctx.commerceState;

  let checkoutInvalidated = false;

  const actionTypes: string[] = [];
  const reasonSummary: string[] = [];

  for (const action of actions) {
    actionTypes.push(action.type);
    if (action.reason) reasonSummary.push(action.reason);

    if (shouldInvalidateCheckout(action) || action.type === 'CLEAR_CHECKOUT') {
      checkoutInvalidated = true;
      orderSession = {
        ...orderSession,
        status:
          currentCart.length > 0 || action.type !== 'CLEAR_CART'
            ? 'collecting_details'
            : 'building_cart',
        checkoutUrl: null,
        checkoutTotal: null,
        checkoutCreatedAt: null,
      };
    }

    switch (action.type) {
      case 'CLEAR_CHECKOUT': {
        orderSession = {
          ...orderSession,
          checkoutUrl: null,
          checkoutTotal: null,
          checkoutCreatedAt: null,
        };
        break;
      }

      case 'CLEAR_CART': {
        currentCart = [];
        orderSession = {
          ...orderSession,
          status: 'building_cart',
          checkoutUrl: null,
          checkoutTotal: null,
          checkoutCreatedAt: null,
        };
        break;
      }

      case 'REPLACE_CART': {
        currentCart = action.items;
        orderSession = {
          ...orderSession,
          status: action.items.length ? 'collecting_details' : 'building_cart',
          checkoutUrl: null,
          checkoutTotal: null,
          checkoutCreatedAt: null,
        };
        break;
      }

      case 'SET_DELIVERY': {
        orderSession = {
          ...orderSession,
          status: 'collecting_details',
          deliveryId: action.zone.id,
          deliveryLabel: action.zone.label,
          deliveryFee: action.zone.fee,
          checkoutUrl: null,
          checkoutTotal: null,
          checkoutCreatedAt: null,
        };
        break;
      }

      case 'SET_ADDRESS': {
        customer = {
          ...customer,
          address: action.address,
        };

        orderSession = {
          ...orderSession,
          status: 'collecting_details',
          customerAddress: action.address,
          checkoutUrl: null,
          checkoutTotal: null,
          checkoutCreatedAt: null,
        };
        break;
      }

      case 'SET_PHONE': {
        customer = {
          ...customer,
          phone: action.phone,
        };

        orderSession = {
          ...orderSession,
          status: 'collecting_details',
          checkoutUrl: null,
          checkoutTotal: null,
          checkoutCreatedAt: null,
        };
        break;
      }

      case 'SET_NAME': {
        customer = {
          ...customer,
          name: action.name,
        };

        orderSession = {
          ...orderSession,
          status: 'collecting_details',
          checkoutUrl: null,
          checkoutTotal: null,
          checkoutCreatedAt: null,
        };
        break;
      }

      case 'SET_COMMERCE_STATE': {
        commerceState = action.state;
        break;
      }

      case 'DERIVE_NEXT_STATE': {
        const simulatedCtx = buildUpdatedContext({
          ctx,
          currentCart,
          orderSession,
          customer,
          commerceState,
        });

        const nextStep = getNextRequiredStep(simulatedCtx);

        commerceState = createCommerceState(nextStep.state, {
          ...(action.statePatch || {}),
        });

        reasonSummary.push(nextStep.reason);
        break;
      }

      case 'SAVE_CHECKOUT': {
        const checkout = action.checkout;

        checkoutInvalidated = false;

        orderSession = {
          ...orderSession,
          status: 'checkout_created',
          checkoutUrl: checkout.checkoutUrl,
          checkoutTotal: checkout.total,
          checkoutCreatedAt: null,
          deliveryId: orderSession.deliveryId || null,
          deliveryLabel: orderSession.deliveryLabel || null,
          deliveryFee: orderSession.deliveryFee || null,
          customerAddress: customer.address || orderSession.customerAddress || null,
        };

        commerceState = createCommerceState('CHECKOUT_CREATED', {
          lastShownProductIds: commerceState.lastShownProductIds || [],
          pendingProductId: commerceState.pendingProductId || null,
          pendingVariantId: commerceState.pendingVariantId || null,
        });

        break;
      }
    }
  }

  const convRef = getConversationRef(ctx);

  const patch: Record<string, any> = {
    currentCart,
    orderSession,
    commerceState,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (customer.address !== ctx.customer.address) {
    patch.customerAddress = customer.address || null;
  }

  if (customer.phone !== ctx.customer.phone) {
    patch.customerPhone = customer.phone || null;
  }

  if (customer.name !== ctx.customer.name) {
    patch.customerName = customer.name || null;
  }

  if (orderSession.deliveryId) {
    patch.selectedDeliveryId = orderSession.deliveryId;
  }

  const saveCheckoutAction = actions.find((action) => action.type === 'SAVE_CHECKOUT');

  if (saveCheckoutAction?.type === 'SAVE_CHECKOUT') {
    patch.lastCheckoutLink = saveCheckoutAction.checkout.checkoutUrl;
    patch.lastActionData = saveCheckoutAction.checkout.lastActionData;
    patch.checkoutCreatedAt = FieldValue.serverTimestamp();
  } else if (checkoutInvalidated) {
    patch.lastCheckoutLink = FieldValue.delete();
    patch.lastActionData = FieldValue.delete();
    patch.checkoutCreatedAt = FieldValue.delete();
  }

  await convRef.set(patch, { merge: true });

  const nextCtx = buildUpdatedContext({
    ctx,
    currentCart,
    orderSession,
    customer,
    commerceState,
  });

  return {
    ctx: nextCtx,
    execution: {
      actionTypes,
      checkoutInvalidated,
      reasonSummary,
    },
  };
}