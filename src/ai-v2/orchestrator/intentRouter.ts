import type { CommerceState, TurnContext } from '../types';
import {
  extractConfirmation,
  type ConfirmationIntent,
} from '../extractors/extractConfirmation';
import { extractQuantity } from '../extractors/extractQuantity';
import { normalizeText, tokenize } from '../catalog/normalize';
import type { CombinedOrderIntent } from '../extractors/extractCombinedOrderIntent';
import { extractCombinedOrderIntent } from '../extractors/extractCombinedOrderIntent';
import {
  classifyQuestionIntent,
  detectsCompoundCommerceAction,
} from './classifyQuestionIntent';
import type { QuestionIntent } from '../knowledge/types';

export type TurnIntent =
  | 'greeting'
  | 'thank_you'
  | 'product_inquiry'
  | 'add_product'
  | 'add_product_combined'
  | 'add_more_command'
  | 'product_selection'
  | 'variant_selection'
  | 'quantity_answer'
  | 'cart_replace'
  | 'cart_update'
  | 'delivery_question'
  | 'change_delivery'
  | 'change_address'
  | 'checkout_confirm'
  | 'checkout_deny'
  | 'handover_request'
  | 'catalog_discovery'
  | 'order_status'
  | 'payment_issue'
  | 'unknown'
  | QuestionIntent;

  export type IntentRoute = {
    intent: TurnIntent;
    shouldInterruptState: boolean;
    cleanedMessage?: string;
    confirmation?: ConfirmationIntent;
    secondaryIntent?: 'commerce_action' | null;
    combinedOrder?: CombinedOrderIntent;
    reason: string;
  };

const COLLECTING_STATES: CommerceState[] = [
  'AWAITING_VARIANT',
  'AWAITING_QUANTITY',
  'AWAITING_DELIVERY_AREA',
  'AWAITING_ADDRESS',
  'AWAITING_PHONE',
  'AWAITING_NAME',
  'READY_FOR_CHECKOUT',
];

const GENERIC_PRODUCT_QUERY_TOKENS = new Set([
  'is',
  'it',
  'in',
  'stock',
  'available',
  'availability',
  'any',
  'one',
  'this',
  'that',
  'product',
  'item',
  'please',
  'pls',
  'do',
  'you',
  'have',
  'sell',
]);

function cleanProductQuery(message: string): string {
  return normalizeText(message)
    .replace(
      /\b(no|nope|not that|wrong|instead|rather|only|just|i mean|change|switch|use|new)\b/g,
      ' '
    )
    .replace(
      /\b(i want|i need|give me|add|do you have|do u have|what about|how about|is there|available|availability|in stock|out of stock|sell|show me|get me|looking for|still have|have any)\b/g,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanAddProductQuery(message: string): string {
  return normalizeText(message)
    .replace(/\b(sorry|please|pls)\b/g, ' ')
    .replace(/\b(add|add more|add another|include|put)\b/g, ' ')
    .replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasMeaningfulProductQuery(message: string): boolean {
  const cleaned = cleanProductQuery(message);
  const tokens = tokenize(cleaned).filter(
    (token) => !GENERIC_PRODUCT_QUERY_TOKENS.has(token)
  );

  return tokens.length > 0;
}

function tokenCount(message: string): number {
  return tokenize(message).length;
}

function isGreeting(message: string): boolean {
  return /^(hi|hello|hey|good morning|good afternoon|good evening|yo)$/i.test(
    String(message || '').trim()
  );
}

function isThankYou(message: string): boolean {
  return /^(thanks|thank you|thank you please|ok thanks|okay thanks|alright thanks|alright, thank you|alright thank you|thanks please)$/i.test(
    String(message || '').trim()
  );
}

function isHandoverRequest(message: string): boolean {
  const text = normalizeText(message);

  return /\b(talk to human|speak to human|seller|vendor|agent|call me|can someone call|human being|real person)\b/i.test(
    text
  );
}

function isAddMoreCommand(message: string): boolean {
  // Bare "add more / add another item" with no product reference.
  // Distinct from add_product (which has a product token) and from
  // add_product_combined (which has product + qty/variant).
  return /^(add|add more|add another|add another item|add more items|another one|one more|more items)\s*\.?$/i.test(
    String(message || '').trim()
  );
}

function isCatalogDiscovery(message: string): boolean {
  const text = normalizeText(message);
  return /^(what do you sell|what do u sell|what products do you have|what products do u have|show (me )?(your )?products|show (me )?(the )?menu|show (me )?(the )?catalog|show (me )?what you have|what (do )?you have|menu|catalog|products)\s*\??$/i.test(
    text
  );
}

function isOrderStatus(message: string): boolean {
  const text = normalizeText(message);
  return /\b(where is my order|where('?s| is) (my|the) (order|delivery|package)|track (my )?order|order status|has my order shipped|when will (my|the) order|my order status|status of my order)\b/i.test(
    text
  );
}

function isPaymentIssue(message: string): boolean {
  const text = normalizeText(message);
  // "I paid", "payment done", "I have paid", "i've paid", "made payment",
  // "sent the money", "payment sent", "transferred"
  return /\b(i (have )?paid|i've paid|payment done|payment made|payment sent|made (the )?payment|sent (the )?(money|payment)|transferred|i paid already)\b/i.test(
    text
  );
}

function isCartReplace(message: string): boolean {
  const text = normalizeText(message);

  return (
    /\b(no|nope|wrong|not that)\b.*\b(only|just|rather|instead|i want|i need)\b/i.test(
      text
    ) ||
    /\b(i only want|only want|just want|i just want|replace with|change it to|change order to)\b/i.test(
      text
    )
  );
}

function isCartUpdate(message: string): boolean {
  const text = normalizeText(message);

  return /\b(show my cart|view cart|cart summary|what is in my cart|what have i ordered|clear cart|empty cart|remove|delete|take out|make it|change it to|set it to|update it to|add one more|one more|add another one)\b/i.test(
    text
  );
}

function isChangeAddress(message: string): boolean {
  const text = normalizeText(message);

  return (
    /\b(change|update|edit|use|set|new|different).*(address|landmark|house|location)\b/i.test(
      text
    ) || /^(change address|address|new address|different address)$/i.test(text)
  );
}

function isChangeDelivery(message: string): boolean {
  const text = normalizeText(message);

  return (
    /\b(change|update|edit|switch|different|new).*(delivery area|delivery|area)\b/i.test(
      text
    ) || /^(delivery|delivery area|change delivery|change delivery area)$/i.test(text)
  );
}

function isDeliveryQuestion(message: string): boolean {
  const text = normalizeText(message);

  return /\b(how much|price|fee|cost).*(delivery|deliver|shipping)|\b(delivery|deliver).*(to|for)\b/i.test(
    text
  );
}

function isAddProductIntent(message: string): boolean {
  const text = normalizeText(message);

  if (
    /^(add|add more|add item|add more item|add more items|add another|add another item|add another items|new item|another item)$/i.test(
      text
    )
  ) {
    return false;
  }

  return (
    /\b(add|add more|add another|include|put)\b.+\b[a-z0-9]{2,}\b/i.test(text) &&
    cleanAddProductQuery(message).length > 0
  );
}

function isStrongProductInquiry(message: string): boolean {
  const text = normalizeText(message);

  const hasProductSearchPhrase =
    /\b(what about|how about|do you have|do u have|is there|sell|still have|have any)\b/i.test(
      text
    ) ||
    /\b(i want|i need|give me|add|get me|show me|looking for)\b/i.test(text) ||
    /\bavailable|in stock|out of stock\b/i.test(text);

  // Phrase-led inquiry — the original case
  if (hasProductSearchPhrase && hasMeaningfulProductQuery(message)) {
    return true;
  }

  // Bare product mention with NO question/answer scaffolding. Only fires
  // when the cleaned message has at least 2 meaningful tokens — single
  // tokens like "weija" or "yes" must NOT trigger this. This covers the
  // "kumasi shito" / "akwasi shito" cases that customers fire mid-flow.
  const cleaned = cleanProductQuery(message);
  const tokens = tokenize(cleaned).filter(
    (token) => !GENERIC_PRODUCT_QUERY_TOKENS.has(token)
  );
  if (tokens.length >= 2 && !/^\d+$/.test(cleaned)) {
    return true;
  }

  return false;
}

function isVariantLikelyAnswer(ctx: TurnContext, message: string): boolean {
  if (ctx.commerceState.state !== 'AWAITING_VARIANT') return false;

  const text = normalizeText(message);
  const cleaned = cleanProductQuery(message);

  if (
    /\b(what about|how about|do you have|do u have|available|rather|instead|not that|wrong)\b/i.test(
      text
    )
  ) {
    return false;
  }

  return tokenCount(cleaned || text) <= 3;
}

function isProductSelectionState(ctx: TurnContext): boolean {
  return ctx.commerceState.state === 'AWAITING_PRODUCT_SELECTION';
}

function stateAllowsProductInterrupt(state: CommerceState): boolean {
  return COLLECTING_STATES.includes(state);
}

export function classifyTurnIntent(ctx: TurnContext): IntentRoute {
  const raw = String(ctx.message || '').trim();
  const confirmation = extractConfirmation(raw);

  if (!raw) {
    return {
      intent: 'unknown',
      shouldInterruptState: false,
      reason: 'empty_message',
    };
  }

  if (isGreeting(raw)) {
    return {
      intent: 'greeting',
      shouldInterruptState: false,
      reason: 'greeting',
    };
  }

  if (isThankYou(raw)) {
    return {
      intent: 'thank_you',
      shouldInterruptState: ctx.commerceState.state === 'CHECKOUT_CREATED',
      reason: 'thank_you',
    };
  }

  if (isHandoverRequest(raw)) {
    return {
      intent: 'handover_request',
      shouldInterruptState: true,
      reason: 'handover_request',
    };
  }

  // Order/payment support — must beat product/state interpretation.
  // "where is my order" must not be searched as a product.
  if (isOrderStatus(raw)) {
    return {
      intent: 'order_status',
      shouldInterruptState: true,
      reason: 'order_status',
    };
  }

  // "i paid" must not be answered with payment-methods FAQ.
  if (isPaymentIssue(raw)) {
    return {
      intent: 'payment_issue',
      shouldInterruptState: true,
      reason: 'payment_issue',
    };
  }

  // Catalog discovery — must not be treated as product search with empty query.
  if (isCatalogDiscovery(raw)) {
    return {
      intent: 'catalog_discovery',
      shouldInterruptState: true,
      reason: 'catalog_discovery',
    };
  }

  // Bare "add more" with no product token — distinct from add_product.
  // Lives here so it interrupts state without being misread as cart_update.
  if (isAddMoreCommand(raw)) {
    return {
      intent: 'add_more_command',
      shouldInterruptState: true,
      reason: 'add_more_command',
    };
  }

  if (isCartReplace(raw)) {
    return {
      intent: 'cart_replace',
      shouldInterruptState: true,
      cleanedMessage: cleanProductQuery(raw),
      reason: 'cart_replace',
    };
  }

  if (isChangeAddress(raw)) {
    return {
      intent: 'change_address',
      shouldInterruptState: true,
      reason: 'change_address',
    };
  }

  if (isChangeDelivery(raw)) {
    return {
      intent: 'change_delivery',
      shouldInterruptState: true,
      reason: 'change_delivery',
    };
  }

  if (isDeliveryQuestion(raw)) {
    return {
      intent: 'delivery_question',
      shouldInterruptState: true,
      reason: 'delivery_question',
    };
  }

  const combinedOrder = extractCombinedOrderIntent(raw);

  if (combinedOrder) {
    return {
      intent: 'add_product_combined',
      shouldInterruptState: true,
      cleanedMessage: combinedOrder.productQuery || undefined,
      combinedOrder,
      reason: 'add_product_combined_intent',
    };
  }

  if (isAddProductIntent(raw)) {
    return {
      intent: 'add_product',
      shouldInterruptState: true,
      cleanedMessage: cleanAddProductQuery(raw),
      reason: 'add_product_intent',
    };
  }

  if (isCartUpdate(raw)) {
    return {
      intent: 'cart_update',
      shouldInterruptState: true,
      reason: 'cart_update',
    };
  }

  if (isProductSelectionState(ctx)) {
    return {
      intent: 'product_selection',
      shouldInterruptState: false,
      reason: 'product_selection_state',
    };
  }

  if (isVariantLikelyAnswer(ctx, raw)) {
    return {
      intent: 'variant_selection',
      shouldInterruptState: false,
      reason: 'variant_likely_answer',
    };
  }

  const quantity = extractQuantity(raw);

  if (ctx.commerceState.state === 'AWAITING_QUANTITY' && quantity) {
    return {
      intent: 'quantity_answer',
      shouldInterruptState: false,
      reason: 'quantity_answer',
    };
  }

  // Important:
  // Product-specific questions/searches must win before q_* classification.
  // "do you have Akwasi's shito" should search product.
  // "is it in stock?" should become q_stock.
  if (isStrongProductInquiry(raw)) {
    return {
      intent: 'product_inquiry',
      shouldInterruptState: stateAllowsProductInterrupt(ctx.commerceState.state),
      cleanedMessage: cleanProductQuery(raw) || raw,
      reason: 'strong_product_inquiry',
    };
  }

  const questionIntent = classifyQuestionIntent(raw);
  if (questionIntent) {
    return {
      intent: questionIntent,
      shouldInterruptState: true,
      secondaryIntent: detectsCompoundCommerceAction(raw)
        ? 'commerce_action'
        : null,
      reason: `question_${questionIntent}`,
    };
  }

  if (confirmation === 'confirm') {
    // After a denial/"not now", a bare "yes" must not re-trigger checkout.
    // It needs an explicit command (add more, change address, etc.), all
    // of which are routed BEFORE this branch.
    if (ctx.commerceState.postDenialMode === true) {
      return {
        intent: 'unknown',
        shouldInterruptState: false,
        reason: 'bare_confirm_in_post_denial_mode',
      };
    }
    return {
      intent: 'checkout_confirm',
      shouldInterruptState: ctx.commerceState.state === 'READY_FOR_CHECKOUT',
      confirmation,
      reason: 'checkout_confirm',
    };
  }

  if (confirmation === 'deny') {
    return {
      intent: 'checkout_deny',
      shouldInterruptState:
        ctx.commerceState.state === 'READY_FOR_CHECKOUT' ||
        ctx.commerceState.state === 'CHECKOUT_CREATED',
      confirmation,
      reason: 'checkout_deny',
    };
  }

  return {
    intent: 'unknown',
    shouldInterruptState: false,
    reason: 'unknown',
  };
}