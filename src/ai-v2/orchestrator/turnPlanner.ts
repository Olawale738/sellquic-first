import type { AiTurnResult, TurnContext } from '../types';
import { classifyTurnIntent, type IntentRoute } from './intentRouter';
import type { QuestionIntent } from '../knowledge/types';
import { isQuestionIntent } from '../knowledge/types';

export type PlannedRoute =
  | {
      type: 'silent_handover';
      intentRoute: IntentRoute;
    }
  | {
      type: 'cart_replace';
      intentRoute: IntentRoute;
      productQuery?: string;
    }
  | {
      type: 'add_product_combined';
      intentRoute: IntentRoute;
    }
  | {
      type: 'add_product';
      intentRoute: IntentRoute;
      productQuery?: string;
    }
  | {
      type: 'cart_update';
      intentRoute: IntentRoute;
    }
  | {
      type: 'information_question';
      intentRoute: IntentRoute;
      questionIntent: QuestionIntent;
    }
  | {
      type: 'checkout_created';
      intentRoute: IntentRoute;
    }
  | {
      type: 'product_inquiry_interrupt';
      intentRoute: IntentRoute;
      productQuery?: string;
    }
  | {
      type: 'change_address';
      intentRoute: IntentRoute;
    }
  | {
      type: 'change_delivery';
      intentRoute: IntentRoute;
    }
  | {
      type: 'delivery_question';
      intentRoute: IntentRoute;
    }
  | {
      type: 'add_more_command';
      intentRoute: IntentRoute;
    }
  | {
      type: 'catalog_discovery';
      intentRoute: IntentRoute;
    }
  | {
      type: 'order_status';
      intentRoute: IntentRoute;
    }
  | {
      type: 'payment_issue';
      intentRoute: IntentRoute;
    }
  | {
      type: 'handover_request';
      intentRoute: IntentRoute;
    }
  | {
      type: 'state_handler';
      intentRoute: IntentRoute;
    };

export function planTurn(ctx: TurnContext): PlannedRoute {
  if (ctx.commerceState.state === 'HANDOVER') {
    return {
      type: 'silent_handover',
      intentRoute: {
        intent: 'handover_request',
        shouldInterruptState: false,
        reason: 'handover_active',
      },
    };
  }

  const intentRoute = classifyTurnIntent(ctx);

  // ─── Global interrupts ──────────────────────────────────────────────────
  // These intents must beat every state-specific handler, including
  // READY_FOR_CHECKOUT / CHECKOUT_CREATED / AWAITING_QUANTITY. Order matters:
  // handover wins over everything; order/payment support beats product
  // inquiry; explicit change-X commands beat the active step.
  if (intentRoute.intent === 'handover_request') {
    return { type: 'handover_request', intentRoute };
  }
  if (intentRoute.intent === 'order_status') {
    return { type: 'order_status', intentRoute };
  }
  if (intentRoute.intent === 'payment_issue') {
    return { type: 'payment_issue', intentRoute };
  }
  if (intentRoute.intent === 'change_address') {
    return { type: 'change_address', intentRoute };
  }
  if (intentRoute.intent === 'change_delivery') {
    return { type: 'change_delivery', intentRoute };
  }
  if (intentRoute.intent === 'delivery_question') {
    return { type: 'delivery_question', intentRoute };
  }
  if (intentRoute.intent === 'catalog_discovery') {
    return { type: 'catalog_discovery', intentRoute };
  }
  if (intentRoute.intent === 'add_more_command') {
    return { type: 'add_more_command', intentRoute };
  }

  if (intentRoute.intent === 'cart_replace') {
    return {
      type: 'cart_replace',
      intentRoute,
      productQuery: intentRoute.cleanedMessage,
    };
  }

  if (intentRoute.intent === 'add_product_combined') {
    return {
      type: 'add_product_combined',
      intentRoute,
    };
  }

  if (intentRoute.intent === 'add_product') {
    return {
      type: 'add_product',
      intentRoute,
      productQuery: intentRoute.cleanedMessage,
    };
  }

  if (intentRoute.intent === 'cart_update') {
    return {
      type: 'cart_update',
      intentRoute,
    };
  }

  if (isQuestionIntent(intentRoute.intent)) {
    return {
      type: 'information_question',
      intentRoute,
      questionIntent: intentRoute.intent,
    };
  }

  if (ctx.commerceState.state === 'CHECKOUT_CREATED') {
    return {
      type: 'checkout_created',
      intentRoute,
    };
  }

  if (
    intentRoute.intent === 'product_inquiry' &&
    intentRoute.shouldInterruptState
  ) {
    return {
      type: 'product_inquiry_interrupt',
      intentRoute,
      productQuery: intentRoute.cleanedMessage || ctx.message,
    };
  }

  return {
    type: 'state_handler',
    intentRoute,
  };
}

export function silentHandoverResult(ctx: TurnContext): AiTurnResult {
  return {
    reply: {
      type: 'silent',
      reason: 'handover_active',
    },
    debug: {
      stateBefore: ctx.commerceState.state,
      stateAfter: ctx.commerceState.state,
      handler: 'turnPlanner',
      reason: 'handover_active',
    },
  };
}