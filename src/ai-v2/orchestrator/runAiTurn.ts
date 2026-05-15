import type { AiTurnResult, Channel, TurnContext } from '../types';
import { loadTurnContext } from './loadTurnContext';
import { classifyTurn } from '../nlu/classifyTurn';
import { dialoguePolicy, type PolicyDecision } from './dialoguePolicy';
import { classifyTurnWithGemini, type GeminiClassifyOutcome } from '../nlu/classifyTurnWithGemini';
import { mapGeminiToClassified, isBrittleCase } from '../nlu/geminiAssist';
import { extractTurnPlan } from '../nlu/extractTurnPlan';
import type { TurnPlanExtractionOutcome } from '../nlu/turnPlanSchema';
import { executeTurnPlan } from './executeTurnPlan';
import { handleInformationQuestionRouter } from '../handlers/handleInformationQuestionRouter';
import { consumeExpectedSlot } from '../state/consumeExpectedSlot';
import { getStateContract } from '../state/stateContract';
import { replyHasLostContext } from '../state/replyContextDetection';
import { checkActionWording } from '../composer/actionConfirmationGuard';
import { formatProductCards } from '../catalog/formatProductCards';
import type { TurnFactPacket, ProductDiscovery } from '../nlu/turnFactPacket';

// Phase 0C: hints threaded from runAiTurn into handleProductSearch so
// the handler honors the executor's verified product discovery and
// falls back to the cleaned Gemini-extracted product query before
// searching the raw customer message.
type ProductSearchHints = {
  verifiedDiscovery?: ProductDiscovery;
  productNeedQuery?: string;
  classifiedIntent?: string;
};
import { composeFromFactPacket, type FactPacketComposerOutcome } from '../composer/composeFromFactPacket';
import { handleProductSearch } from '../handlers/handleProductSearch';
import { handleProductSelection } from '../handlers/handleProductSelection';
import { handleVariantReply } from '../handlers/handleVariantReply';
import { handleQuantityReply } from '../handlers/handleQuantityReply';
import { handleDeliveryReply } from '../handlers/handleDeliveryReply';
import { handleAddressReply } from '../handlers/handleAddressReply';
import { handlePhoneReply } from '../handlers/handlePhoneReply';
import { handleNameReply } from '../handlers/handleNameReply';
import { handleCheckoutConfirmation } from '../handlers/handleCheckoutConfirmation';
import { handleCheckoutCreatedReply } from '../handlers/handleCheckoutCreatedReply';
import { handleCartUpdate } from '../handlers/handleCartUpdate';
import { handleCartReplace } from '../handlers/handleCartReplace';
import { handleAddProductCombined } from '../handlers/handleAddProductCombined';
import { handleCatalogDiscovery } from '../handlers/handleCatalogDiscovery';
import { handleOrderStatusQuery } from '../handlers/handleOrderStatusQuery';
import { handlePaymentIssue } from '../handlers/handlePaymentIssue';
import { handleSupportRequest } from '../handlers/handleSupportRequest';
import { createCommerceState } from '../state/commerceState';
import { executeCommerceActions } from '../actions/executeCommerceAction';
import { handleMetaIntent } from '../handlers/handleMetaIntent';

import { buildStoreKnowledge } from '../knowledge/buildStoreKnowledge';
import { toKnowledgeTurnContext } from '../knowledge/adapters/fromTurnContext';
import { handleInformationQuestion } from '../handlers/handleInformationQuestion';

import { validateFinalReply } from '../validators/validateFinalReply';
import { logAiTurn } from '../telemetry/logAiTurn';
import { composeReplyWithGemini } from '../composer/composeReply';
import { buildFactPacketForInformationQuestion } from '../composer/factPacketBuilders';

type RunAiTurnInput = {
  storeId: string;
  conversationId: string;
  channel?: Channel;
  message: string;
  imageUrl?: string | null;
};

export async function runAiTurn(input: RunAiTurnInput): Promise<AiTurnResult> {
  const startedAt = Date.now();
  const ctx = await loadTurnContext(input);

  // ─── Deterministic NLU (always runs) ────────────────────────────────
  let deterministicClassification: import('../nlu/types').ClassifiedTurn | null = null;
  let deterministicError: string | null = null;
  try {
    deterministicClassification = classifyTurn(ctx);
  } catch (err) {
    deterministicError = err instanceof Error ? err.message : String(err);
  }

  // ─── Gemini NLU (shadow + assist + state-primary behind flags) ──────
  const useShadow = ctx.storeData?.aiV2?.useGeminiNluShadow === true;
  const useAssist = ctx.storeData?.aiV2?.useGeminiNluAssist === true;
  const useVariantPrimary = ctx.storeData?.aiV2?.useGeminiPrimaryAtVariantState === true;

  const shouldCallGemini =
    useShadow ||
    useAssist ||
    (useVariantPrimary && ctx.commerceState.state === 'AWAITING_VARIANT');

  let geminiOutcome: GeminiClassifyOutcome | null = null;
  const apiKey = process.env.GEMINI_API_KEY || '';

  if (shouldCallGemini && deterministicClassification && apiKey) {
    geminiOutcome = await classifyTurnWithGemini(ctx);
  }

  let classified = deterministicClassification;
  let classificationSource: 'deterministic' | 'gemini' = 'deterministic';
  let geminiOverrideReason: string | null = null;

  const isVariantStatePrimary =
    useVariantPrimary &&
    ctx.commerceState.state === 'AWAITING_VARIANT' &&
    geminiOutcome?.ok &&
    geminiOutcome.result;

  const brittle =
    useAssist &&
    geminiOutcome?.ok &&
    geminiOutcome.result &&
    deterministicClassification
      ? isBrittleCase(deterministicClassification, ctx, geminiOutcome.result)
      : false;

  if (isVariantStatePrimary && geminiOutcome?.result) {
    classified = mapGeminiToClassified(geminiOutcome.result, ctx);
    classificationSource = 'gemini';
    geminiOverrideReason = 'patch_f_awaiting_variant';
  } else if (brittle && geminiOutcome?.result) {
    classified = mapGeminiToClassified(geminiOutcome.result, ctx);
    classificationSource = 'gemini';
    geminiOverrideReason = 'brittle_case';
  }

  // ─── Phase 1 pipeline (compound-message arch) ──────────────────────
  const useTurnPlanExtraction = ctx.storeData?.aiV2?.useTurnPlanExtraction === true;
  const useTurnPlanExecution = ctx.storeData?.aiV2?.useTurnPlanExecution === true;
  const useTurnPlanComposer = ctx.storeData?.aiV2?.useTurnPlanComposer === true;

  let turnPlanOutcome: TurnPlanExtractionOutcome | null = null;
  let factPacket: TurnFactPacket | null = null;
  let composerOutcome: FactPacketComposerOutcome | null = null;

  if (useTurnPlanExtraction && apiKey) {
    turnPlanOutcome = await extractTurnPlan(ctx, apiKey);
  }

  if (
    useTurnPlanExecution &&
    turnPlanOutcome?.ok &&
    turnPlanOutcome.result &&
    apiKey
  ) {
    try {
      factPacket = await executeTurnPlan(turnPlanOutcome.result, ctx, apiKey);
    } catch (err) {
      console.error('[AI V2 TurnPlan] executeTurnPlan failed:', err);
      factPacket = null;
    }
  }

  // ─── Routing (Bundle C: dialoguePolicy is primary) ────────────────
  // Order:
  //   1. dialoguePolicy decides the customer's task from classified +
  //      ctx (intent groups: PRODUCT_DISCOVERY, PRODUCT_QUESTION,
  //      CART_ACTION, ORDER_SLOT, STORE_QUESTION, META).
  //   2. Only when the decision is `state_handler` (i.e. the policy
  //      itself thinks this turn is a slot fill) does consumeExpectedSlot
  //      get to run and validate / normalize the value. For
  //      route_handler / route_command / route_question / silent_handover,
  //      the consumer is skipped — the policy has already routed.
  //   3. Composer + hints + dispatch as before.
  //
  // Pre-Bundle-C, consumeExpectedSlot ran first and could rewrite both
  // ctx.message and classified.intent before the policy ever saw them,
  // turning questions and product/cart commands into slot fills.
  const usePolicy =
    ctx.storeData?.aiV2?.useClassifierPolicy === true && classified !== null;

  let decision: PolicyDecision | null = null;
  if (usePolicy && classified) {
    try {
      decision = dialoguePolicy(ctx, classified);
    } catch (err) {
      console.error('[AI V2 Policy] dialoguePolicy threw, will fall back:', err);
      decision = null;
    }
  }

  // Run the slot consumer only when dispatch will go through the
  // state-driven path. When usePolicy is off OR the policy threw, we
  // also fall back to the state-driven path, so the consumer runs
  // there too (preserves legacy behavior).
  const willStateHandlerDispatch =
    decision === null || decision.kind === 'state_handler';

  if (willStateHandlerDispatch) {
    const slotConsumption = await consumeExpectedSlot(
      ctx,
      turnPlanOutcome?.result || null,
      classified,
      factPacket,
    );

    if (slotConsumption.kind === 'retry') {
      return {
        reply: { type: 'text', content: slotConsumption.retryPrompt },
        debug: {
          stateBefore: ctx.commerceState.state,
          stateAfter: ctx.commerceState.state,
          handler: 'expected_slot_retry',
          reason: `expected_slot_retry:${slotConsumption.slotKey}:${slotConsumption.reason}`,
        },
      };
    }

    if (slotConsumption.kind === 'success') {
      (ctx as any).__originalMessage = ctx.message;
      ctx.message = slotConsumption.canonicalMessage;
      if (classified) {
        (classified as any).intent = slotConsumption.handlerHintIntent;
        (classified as any).confidence = 'high';
        (classified as any).source = 'expected_slot_consumer';
      }
    }
  }

  if (useTurnPlanComposer && factPacket && apiKey) {
    composerOutcome = await composeFromFactPacket(factPacket, ctx, apiKey);
  }

  const productSearchHints: ProductSearchHints = {
    verifiedDiscovery: factPacket?.facts.productDiscovery,
    productNeedQuery: turnPlanOutcome?.result?.productNeed?.query,
    classifiedIntent: classified?.intent,
  };

  let rawResult: AiTurnResult;
  if (decision) {
    try {
      rawResult = await routeViaPolicy(ctx, decision, classified, productSearchHints);
    } catch (err) {
      console.error('[AI V2 Policy] routeViaPolicy threw, falling back:', err);
      rawResult = await routeDeterministicTurn(ctx, productSearchHints);
    }
  } else {
    rawResult = await routeDeterministicTurn(ctx, productSearchHints);
  }

  // ─── Composer reply override ───────────────────────────────────────
  const intentIsVariantQuestion =
    classified?.intent === 'ask_variants' ||
    turnPlanOutcome?.result?.primaryIntent === 'ask_variants' ||
    (rawResult.debug?.reason || '').includes('q_variants');

  // Meta intents (greetings, thanks, unknowns) never get composer-overridden.
  // handleMetaIntent already produces a clean greeting; letting the
  // fact-packet composer rewrite it leaks any products that
  // executeTurnPlan happened to surface for the turn.
  const intentIsMeta =
    classified?.intent === 'meta_greeting' ||
    classified?.intent === 'meta_thanks' ||
    classified?.intent === 'meta_unknown' ||
    turnPlanOutcome?.result?.primaryIntent === 'meta_greeting' ||
    turnPlanOutcome?.result?.primaryIntent === 'meta_thanks' ||
    turnPlanOutcome?.result?.primaryIntent === 'meta_unknown';

  // Phase 0A commerce guard: when the handler did commerce work or
  // failed to progress on a commerce flow, suppress the fact-packet
  // composer override so it cannot narrate state changes the machine
  // never made.
  const BLOCKED_STATES = new Set<string>([
    'AWAITING_PRODUCT_SELECTION',
    'AWAITING_VARIANT',
    'AWAITING_QUANTITY',
    'AWAITING_DELIVERY_AREA',
    'AWAITING_ADDRESS',
    'AWAITING_PHONE',
    'AWAITING_NAME',
    'READY_FOR_CHECKOUT',
    'CHECKOUT_CREATED',
  ]);
  const COMMERCE_HANDLERS = new Set<string>([
    'handleProductSelection',
    'handleVariantReply',
    'handleQuantityReply',
    'handleDeliveryReply',
    'handleAddressReply',
    'handlePhoneReply',
    'handleNameReply',
    'handleCheckoutConfirmation',
    'handleCheckoutCreatedReply',
    'handleCartUpdate',
    'handleCartReplace',
  ]);
  const NO_PROGRESS_REASON_MARKERS = [
    'non_product_fallback',
    'cart_empty_no_pending',
    'no_match',
    'composer_off_or_failed',
    'state_re_anchor',
  ];
  const COMMERCE_INTENTS = new Set<string>([
    'provide_variant_choice',
    'provide_quantity',
    'provide_name',
    'provide_phone',
    'provide_address',
    'provide_delivery_zone',
    'say_yes',
  ]);
  const reasonForGuard = rawResult.debug?.reason ?? '';
  const commerceGuardBlocks =
    BLOCKED_STATES.has(ctx.commerceState.state) ||
    COMMERCE_HANDLERS.has(rawResult.debug?.handler ?? '') ||
    NO_PROGRESS_REASON_MARKERS.some((m) => reasonForGuard.includes(m)) ||
    COMMERCE_INTENTS.has(classified?.intent ?? '');

  if (
    composerOutcome?.ok &&
    composerOutcome.replyText &&
    rawResult.reply.type === 'text' &&
    !intentIsVariantQuestion &&
    !intentIsMeta
  ) {
    if (!commerceGuardBlocks) {
      rawResult = {
        ...rawResult,
        reply: { type: 'text', content: composerOutcome.replyText },
        debug: {
          ...rawResult.debug,
          reason: `${rawResult.debug?.reason || ''}|fact_packet_composer:ok`,
        },
      };
    } else {
      rawResult = {
        ...rawResult,
        debug: {
          ...rawResult.debug,
          reason: `${rawResult.debug?.reason || ''}|composer_override_skipped:commerce_guard`,
        },
      };
    }
  }

  // HOTFIX: don't ask for fields the customer already provided.
  // Composer can hallucinate "may I have your name?" even when name
  // is in establishedState. Detect those phrasings and replace with
  // the actual deterministic next step.
  if (rawResult.reply.type === 'text' && factPacket) {
    const facts = (factPacket.facts as any) || {};
    const established = facts?.establishedState || {};
    const filled = (factPacket as any).filled || {};
    const text = rawResult.reply.content;

    const hasName = !!(established.customerName || filled.customerName || ctx.customer?.name);
    const hasPhone = !!(established.customerPhone || filled.customerPhone);
    const hasAddress = !!(established.customerAddress || filled.customerAddress);
    const hasZone = !!(established.deliveryZone || filled.deliveryZone);

    const asksName =
      /\b(your\s+(?:full\s+)?name|may\s+i\s+(?:please\s+)?have\s+your\s+name|what(?:'s|\s+is)\s+your\s+name|name\s+to\s+(?:complete|finalize|use|proceed))\b/i.test(text);
    const asksPhone =
      /\b(phone\s+number|your\s+(?:phone|number|contact)|number\s+to\s+(?:use|reach|complete)|may\s+i\s+(?:please\s+)?have\s+your\s+(?:phone|number)|provide\s+your\s+(?:phone|number))\b/i.test(text);
    const asksAddress =
      /\b(delivery\s+address|exact\s+address|your\s+address|where\s+to\s+(?:deliver|send)|provide\s+your\s+(?:address|location))\b/i.test(text);
    const asksZone =
      /\b(which\s+(?:area|location)|delivery\s+area|where\s+(?:should|do)\s+we\s+deliver)\b/i.test(text);

    const askingFilledField =
      (asksName && hasName) ||
      (asksPhone && hasPhone) ||
      (asksAddress && hasAddress) ||
      (asksZone && hasZone);

    if (askingFilledField) {
      let safe: string;
      if (!hasName) safe = "May I please have your full name to complete the order?";
      else if (!hasPhone) safe = "Could you please share the phone number for the order?";
      else if (!hasZone) safe = "Which area should we deliver to please?";
      else if (!hasAddress) safe = "What is the exact delivery address or landmark please?";
      else safe = "Should I create the checkout link for you now?";

      rawResult = {
        ...rawResult,
        reply: { type: 'text', content: safe },
        debug: {
          ...rawResult.debug,
          reason: `${rawResult.debug?.reason || ''}|asked_filled_field_replaced`,
        },
      };
    }
  }

  // ─── Focus-first view request override ─────────────────────────────
  const focus = factPacket?.facts.contextProducts?.focusProduct;
  const intentSaysShowFocus =
    turnPlanOutcome?.result?.primaryIntent === 'command_show_product' ||
    (turnPlanOutcome?.result?.tasks || []).some(
      (t) => t.intent === 'command_show_product',
    );

  // Tightened: word boundaries so "pic" doesn't match "pickup",
  // "see" requires an object, etc.
  const viewSignalInMessage =
    /\b(pic|picture|photo|image|view it|how it looks|what it looks like|show (?:it|me|the|that)|see (?:it|the|that|this|one))\b/i.test(
      ctx.message,
    );

  // HOTFIX: never override an information-question reply with a product
  // card dump. If the customer asked about pickup, delivery time, store
  // hours, payment, etc., the composer's correct text answer must stand.
  const INFO_QUESTION_HANDLED_TASKS = new Set([
    'ask_delivery_time',
    'ask_delivery_fee',
    'ask_location',
    'ask_about_store',
    'ask_payment_methods',
    'ask_returns',
    'ask_pickup',
    'ask_cod',
    'ask_store_hours',
    'ask_warranty',
  ]);
  const handledTasksForGate: string[] =
    ((factPacket?.routing as any)?.handledTasks as string[]) || [];
  const isInfoQuestion =
    (factPacket?.routing as any)?.primaryHandler === 'handleInformationQuestion' ||
    handledTasksForGate.some((t) => INFO_QUESTION_HANDLED_TASKS.has(t));

  const isViewRequest =
    (viewSignalInMessage || intentSaysShowFocus) && !isInfoQuestion;

  if (focus && isViewRequest && rawResult.reply.type === 'text') {
    const focusProduct = (ctx.products || []).find((p: any) => p.id === focus.id);
    if (focusProduct) {
      const selectedVariantId =
        ctx.commerceState?.pendingVariantId ||
        factPacket?.facts.establishedState?.pendingVariantId ||
        null;
      
      const cards = formatProductCards([focus as any], { selectedVariantId });
      const message =
        selectedVariantId && (cards[0] as any)?.variantImageMissing
          ? `Sure please, here it is. (No separate photo for the ${(cards[0] as any).variantName} option — this is the product image.)`
          : `Sure please, here it is.`;

      rawResult = {
        reply: {
          type: 'product_cards',
          content: message,
          products: cards as any,
        },
        debug: {
          stateBefore: ctx.commerceState.state,
          stateAfter: ctx.commerceState.state,
          handler: 'handleProductSearch',
          reason: `${rawResult.debug?.reason || ''}|view_request_override:${intentSaysShowFocus ? 'intent' : 'regex'}`,
        },
      };
    }
  }

  // ─── Action-confirmation wording guard ───────────────────────────
  // Note: checkActionWording should be imported/available
  
  // ─── Action-confirmation wording guard (state-aware fallback) ────
  if (rawResult.reply.type === 'text') {
    const violation = checkActionWording(rawResult.reply.content, factPacket);
    if (violation) {
      rawResult = {
        ...rawResult,
        reply: {
          type: 'text',
          content: buildStateAwareSafeReply(ctx, factPacket),
        },
        debug: {
          ...rawResult.debug,
          reason: `${rawResult.debug?.reason || ''}|action_guard:${violation.kind}|state_safe:${ctx.commerceState.state}`,
        },
      };
    }
  }
  

  // ─── Universal re-anchor (final safety net, state-aware) ─────────
  if (rawResult.reply.type === 'text' && replyHasLostContext(rawResult.reply.content)) {
    const facts = (factPacket?.facts as any) || {};
    const cartHasItems =
      (facts?.cartTotal || 0) > 0 ||
      (facts?.contextProducts?.cartProducts?.length || 0) > 0;
    const hasRecoverableContext =
      !!facts?.contextProducts?.focusProduct ||
      !!facts?.establishedState?.customerName ||
      !!facts?.establishedState?.customerPhone ||
      !!facts?.establishedState?.customerAddress ||
      !!facts?.establishedState?.deliveryZone ||
      cartHasItems ||
      (ctx.commerceState.state !== 'IDLE' && ctx.commerceState.state !== 'BROWSING');

    if (hasRecoverableContext) {
      rawResult = {
        ...rawResult,
        reply: {
          type: 'text',
          content: buildStateAwareSafeReply(ctx, factPacket),
        },
        debug: {
          ...rawResult.debug,
          reason: `${rawResult.debug?.reason || ''}|state_safe_reply:${ctx.commerceState.state}`,
        },
      };
    }
  }


  
  const validated = validateFinalReply(ctx, rawResult);

  await logAiTurn({
    ctx,
    result: validated.result,
    validation: validated.validation,
    startedAt,
    shadowClassification: deterministicClassification,
    shadowError: deterministicError,
    geminiOutcome,
    classificationSource,
    geminiOverrideReason,
    turnPlanOutcome,
    factPacket,
    composerOutcome,
  });

  return validated.result;
}

async function routeViaPolicy(
  ctx: TurnContext,
  decision: PolicyDecision,
  classified: import('../nlu/types').ClassifiedTurn | null,
  hints?: ProductSearchHints,
): Promise<AiTurnResult> {
  switch (decision.kind) {
    case 'silent_handover':
      return { reply: { type: 'silent', reason: 'handover_active' } };

      case 'route_question':
        return await handleInformationQuestionRouter(ctx, decision.questionIntent);

    case 'route_handler':
      return invokeHandler(ctx, decision.handler, classified, hints);

    case 'route_command':
      return invokeCommand(ctx, decision.command, classified);

    case 'state_handler':
    default:
      return routeStateHandler(ctx, hints);
  }
}

async function routeDeterministicTurn(
  ctx: TurnContext,
  hints?: ProductSearchHints,
): Promise<AiTurnResult> {
  return routeStateHandler(ctx, hints);
}

async function invokeHandler(
  ctx: TurnContext,
  handler: any,
  classified: any,
  hints?: ProductSearchHints,
): Promise<AiTurnResult> {
  switch (handler) {
    case 'handleProductSearch': return handleProductSearch(ctx, hints);
    case 'handleProductSelection': return handleProductSelection(ctx);
    case 'handleAddProductCombined':
      return handleAddProductCombined(ctx, {
        productQuery: (classified?.slots?.productQuery as string | null | undefined) ?? null,
        variantQuery: (classified?.slots?.variantQuery as string | null | undefined) ?? null,
        quantity:
          typeof classified?.slots?.quantity === 'number'
            ? classified.slots.quantity
            : null,
      });
    case 'handleCartUpdate': {
      // handleCartUpdate returns null when its internal extractor sees
      // no cart-shaped intent in the message. Fall back to state handler.
      const result = await handleCartUpdate(ctx);
      return result ?? routeStateHandler(ctx, hints);
    }
    case 'handleVariantReply': return handleVariantReply(ctx);
    case 'handleQuantityReply': return handleQuantityReply(ctx);
    case 'handleDeliveryReply': return handleDeliveryReply(ctx);
    case 'handleAddressReply': return handleAddressReply(ctx);
    case 'handlePhoneReply': return handlePhoneReply(ctx);
    case 'handleNameReply': return handleNameReply(ctx);
    case 'handleCheckoutConfirmation': return handleCheckoutConfirmation(ctx);
    case 'handleCheckoutCreatedReply': return handleCheckoutCreatedReply(ctx);
    case 'handleMetaIntent': return handleMetaIntent(ctx, classified?.intent || 'meta_unknown');
    default: return routeStateHandler(ctx, hints);
  }
}

async function invokeCommand(
  ctx: TurnContext,
  command: any,
  classified: any,
): Promise<AiTurnResult> {
  // Bundle B: dispatch the policy's command decisions to real handlers.
  // Previously a stub that fell through to routeStateHandler — every
  // command_show_cart / clear_cart / handover / payment_issue /
  // change_* / support_* / order_status / catalog_discovery /
  // add_more was being swallowed by the active slot handler.
  switch (command) {
    case 'show_cart':
    case 'clear_cart': {
      // handleCartUpdate re-extracts the intent type from ctx.message
      // (extractCartUpdateIntent) and branches on show_cart vs clear_cart
      // internally — see handleCartUpdate.ts:225-250. Returns null only
      // when its extractor finds no cart shape; fall back in that case.
      const result = await handleCartUpdate(ctx);
      return result ?? routeStateHandler(ctx);
    }
    case 'add_more':
    case 'catalog_discovery':
      return handleCatalogDiscovery(ctx);
    case 'order_status':
      return handleOrderStatusQuery(ctx, classified);
    case 'payment_issue':
      return handlePaymentIssue(ctx);
    case 'change_address':
      return handleAddressReply(ctx);
    case 'change_delivery':
      return handleDeliveryReply(ctx);
    case 'change_name':
      return handleNameReply(ctx);
    case 'change_phone':
      return handlePhoneReply(ctx);
    case 'handover':
      return { reply: { type: 'silent', reason: 'command_handover' } };
    case 'support_refund':
    case 'support_return':
    case 'support_exchange':
    case 'support_cancel':
    case 'support_damaged':
    case 'support_wrong_item':
    case 'support_late_delivery':
    case 'support_general':
      return handleSupportRequest(ctx, classified);
    default:
      return routeStateHandler(ctx);
  }
}

async function routeStateHandler(
  ctx: TurnContext,
  hints?: ProductSearchHints,
): Promise<AiTurnResult> {
  const state = ctx.commerceState.state;
  if (state === 'AWAITING_VARIANT') return handleVariantReply(ctx);
  if (state === 'AWAITING_QUANTITY') return handleQuantityReply(ctx);
  if (state === 'AWAITING_DELIVERY_AREA') return handleDeliveryReply(ctx);
  if (state === 'AWAITING_ADDRESS') return handleAddressReply(ctx);
  if (state === 'AWAITING_PHONE') return handlePhoneReply(ctx);
  if (state === 'AWAITING_NAME') return handleNameReply(ctx);
  if (state === 'READY_FOR_CHECKOUT') return handleCheckoutConfirmation(ctx);
  if (state === 'CHECKOUT_CREATED') return handleCheckoutCreatedReply(ctx);
  return handleProductSearch(ctx, hints);
}




// HOTFIX: state-aware safe reply when validators fire or context is lost.
// Replaces the old behavior of always re-anchoring to BROWSE.
function buildStateAwareSafeReply(
  ctx: TurnContext,
  factPacket: TurnFactPacket | null,
): string {
  const state = ctx.commerceState.state;
  const facts = (factPacket?.facts as any) || {};
  const cartHasItems =
    (facts?.cartTotal || 0) > 0 ||
    (facts?.contextProducts?.cartProducts?.length || 0) > 0;

  switch (state) {
    case 'READY_FOR_CHECKOUT':
      return "Sorry please, I have your order details. Should I create the checkout link for you now?";
    case 'AWAITING_DELIVERY_AREA':
      return "Sorry please, which area should we deliver to?";
    case 'AWAITING_ADDRESS':
      return "Sorry please, what is the exact delivery address or landmark?";
    case 'AWAITING_PHONE':
      return "Sorry please, what phone number should we use for the order?";
    case 'AWAITING_NAME':
      return "Sorry please, what name should we use for the order?";
    case 'AWAITING_QUANTITY':
      return "Sorry please, how many should I add for you?";
    case 'AWAITING_VARIANT':
      return "Sorry please, which option would you like?";
  }

  if (cartHasItems) {
    return "Sorry please, would you like to continue with the item already in your bag, or look at something else?";
  }

  return "What are you looking for today please?";
}