import { FieldValue } from 'firebase-admin/firestore';
import { db } from '@/lib/firebase-admin';
import type { AiTurnResult, TurnContext } from '../types';
import type { ClassifiedTurn, Intent } from '../nlu/types';
import type { GeminiClassifyOutcome } from '../nlu/classifyTurnWithGemini';

type LogAiTurnInput = {
  ctx: TurnContext;
  result: AiTurnResult;
  validation?: {
    ok: boolean;
    failedValidator?: string;
    reason?: string;
  };
  startedAt: number;
  /**
   * Deterministic classifier output. Always present unless classifier threw.
   */
  shadowClassification?: ClassifiedTurn | null;
  shadowError?: string | null;
  /**
   * Gemini NLU output — only present when shadow or assist flag is on.
   * Logged side-by-side with deterministic for divergence analysis.
   */
  geminiOutcome?: GeminiClassifyOutcome | null;
  /**
   * Which source's classification actually drove routing this turn.
   */
  classificationSource?: 'deterministic' | 'gemini';
  /**
   * Why Gemini drove (when classificationSource === 'gemini'). Lets us
   * distinguish Patch F state-primary turns from brittle-case overrides
   * in dashboards.
   */
  geminiOverrideReason?: string | null;
  /**
   * Phase 1 turn-plan pipeline outputs. Logged for shadow comparison
   * with the existing classifier/composer pipeline. Any of these may
   * be null — if the corresponding flag was off or the call failed.
   */
  turnPlanOutcome?: import('../nlu/turnPlanSchema').TurnPlanExtractionOutcome | null;
  factPacket?: import('../nlu/turnFactPacket').TurnFactPacket | null;
  composerOutcome?: import('../composer/composeFromFactPacket').FactPacketComposerOutcome | null;
};

function preview(value: string, max = 500): string {
  const text = String(value || '').replace(/\s+/g, ' ').trim();

  if (text.length <= max) return text;

  return `${text.slice(0, max)}...`;
}

function getReplyPreview(result: AiTurnResult): string {
  const reply = result.reply;

  if (reply.type === 'text') return preview(reply.content);
  if (reply.type === 'product_cards') return preview(reply.content);
  if (reply.type === 'action') return preview(reply.content);
  if (reply.type === 'silent') return `silent:${reply.reason}`;

  return 'unknown_reply';
}

export async function logAiTurn({
  ctx,
  result,
  validation,
  startedAt,
  shadowClassification,
  shadowError,
  geminiOutcome,
  classificationSource,
  geminiOverrideReason,
  turnPlanOutcome,
  factPacket,
  composerOutcome,
}: LogAiTurnInput): Promise<void> {
  try {
    const latencyMs = Date.now() - startedAt;

    const productionHandler = result.debug?.handler || null;
    const shadowDivergence = computeShadowDivergence(
      shadowClassification ?? null,
      productionHandler,
    );

    // Gemini telemetry — null-safe pulls so old logs without Gemini fields
    // remain queryable in Firestore.
    const geminiIntent = geminiOutcome?.result?.primaryIntent ?? null;
    const geminiSecondaryIntent = geminiOutcome?.result?.secondaryIntent ?? null;
    const geminiSlots = geminiOutcome?.result?.slots ?? null;
    const geminiStateAction = geminiOutcome?.result?.stateAction ?? null;
    const geminiConfidence = geminiOutcome?.result?.confidence ?? null;
    const geminiReason = geminiOutcome?.result?.reason ?? null;
    const geminiLatencyMs = geminiOutcome?.latencyMs ?? null;
    const geminiError = geminiOutcome?.error ?? null;
    const geminiInvalidJson = geminiOutcome?.invalidJson === true;

    // Divergence: did Gemini disagree with deterministic on the primary intent?
    // null when Gemini didn't run; true/false otherwise.
    const intentDivergence =
      geminiIntent && shadowClassification
        ? geminiIntent !== shadowClassification.intent
        : null;

    // Compact summaries — full payloads would bloat Firestore docs.
    const turnPlanSummary = turnPlanOutcome
      ? {
          ok: turnPlanOutcome.ok,
          latencyMs: turnPlanOutcome.latencyMs ?? null,
          error: turnPlanOutcome.error ?? null,
          invalidJson: turnPlanOutcome.invalidJson === true,
          primaryIntent: turnPlanOutcome.result?.primaryIntent ?? null,
          taskCount: turnPlanOutcome.result?.tasks?.length ?? null,
          stateAction: turnPlanOutcome.result?.stateAction ?? null,
          confidence: turnPlanOutcome.result?.confidence ?? null,
          schemaVersion: turnPlanOutcome.result?.schemaVersion ?? null,
          reason: turnPlanOutcome.result?.reason ?? null,
        }
      : null;

      const discovery = factPacket?.facts.productDiscovery;
      const factPacketSummary = factPacket
        ? {
            primaryHandler: factPacket.routing.primaryHandler,
            shouldClarify: factPacket.routing.shouldClarify,
            shouldHandover: factPacket.routing.shouldHandover,
            routingReason: factPacket.routing.reason,
            filledSlotKeys: Object.keys(factPacket.filled),
            discoveryReason: discovery?.reason ?? null,
            exactMatchCount: discovery?.exactMatches.length ?? 0,
            outOfStockCount: discovery?.outOfStockMatches.length ?? 0,
            alternativeCount: discovery?.alternativeProducts.length ?? 0,
          contextFocusId: factPacket.facts.contextProducts?.focusProduct?.id ?? null,
          contextRecentCount: factPacket.facts.contextProducts?.recentlyShown.length ?? 0,
          contextCartCount: factPacket.facts.contextProducts?.cartProducts.length ?? 0,
          appliedFilters: factPacket.facts.appliedFilters ?? null,
            droppedFilters: factPacket.facts.droppedFilters ?? [],
            matchedZoneId: factPacket.facts.matchedZone?.id ?? null,
            sameDayFeasible: factPacket.facts.sameDayFeasible ?? null,
            handledTasks: factPacket.telemetry.handledTasks,
            unhandledTasks: factPacket.telemetry.unhandledTasks,
            verifierFailures: factPacket.telemetry.verifierFailures,
            filterDropReasons: factPacket.telemetry.filterDropReasons,
          }
        : null;

    const composerSummary = composerOutcome
      ? {
          ok: composerOutcome.ok,
          latencyMs: composerOutcome.latencyMs ?? null,
          error: composerOutcome.error ?? null,
          violationKind: composerOutcome.violationKind ?? null,
          replyPreview: composerOutcome.replyText
            ? preview(composerOutcome.replyText)
            : null,
          invalidJson: composerOutcome.invalidJson === true,
        }
      : null;

    const logRef = db
      .collection('stores')
      .doc(ctx.storeId)
      .collection('ai_v2_turn_logs')
      .doc();

    await logRef.set({
      storeId: ctx.storeId,
      conversationId: ctx.conversationId,
      sellerId: ctx.sellerId || null,
      channel: ctx.channel,

      messagePreview: preview(ctx.message),
      replyType: result.reply.type,
      replyPreview: getReplyPreview(result),

      stateBefore: result.debug?.stateBefore || ctx.commerceState.state,
      stateAfter: result.debug?.stateAfter || null,
      handler: productionHandler,
      reason: result.debug?.reason || null,

      validationOk: validation?.ok ?? true,
      failedValidator: validation?.failedValidator || null,
      validationReason: validation?.reason || null,

      cartItemCount: ctx.currentCart.length,
      deliveryId: ctx.orderSession.deliveryId || null,
      hasCustomerName: Boolean(ctx.customer.name),
      hasCustomerPhone: Boolean(ctx.customer.phone),
      hasCustomerAddress: Boolean(ctx.customer.address || ctx.orderSession.customerAddress),

      // Deterministic NLU classification.
      shadowIntent: shadowClassification?.intent ?? null,
      shadowSlots: shadowClassification?.slots ?? null,
      shadowConfidence: shadowClassification?.confidence ?? null,
      shadowSource: shadowClassification?.source ?? null,
      shadowIsInterrupt: shadowClassification?.isInterrupt ?? null,
      shadowReason: shadowClassification?.reason ?? null,
      shadowError: shadowError ?? null,
      shadowDivergence,

      // Gemini NLU classification (Track B).
      geminiIntent,
      geminiSecondaryIntent,
      geminiSlots,
      geminiStateAction,
      geminiConfidence,
      geminiReason,
      geminiLatencyMs,
      geminiError,
      geminiInvalidJson,
      intentDivergence,
      classificationSource: classificationSource ?? 'deterministic',
      geminiOverrideReason: geminiOverrideReason ?? null,

      turnPlanSummary,
      factPacketSummary,
      composerSummary,

      latencyMs,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error('[AI V2 Telemetry] Failed to log turn:', error);
  }
}

/**
 * Coarse divergence flag: maps the shadow Intent to the handler we'd
 * expect Step 3's policy to route to, then compares to the handler that
 * actually ran. Useful to filter logs in Firestore by `shadowDivergence.agreed == false`.
 */
function computeShadowDivergence(
  shadow: ClassifiedTurn | null,
  productionHandler: string | null,
): {
  agreed: boolean;
  expectedHandler: string | null;
  note: string;
} {
  if (!shadow) {
    return { agreed: false, expectedHandler: null, note: 'shadow_unavailable' };
  }
  const expectedHandler = expectedHandlerForIntent(shadow.intent);
  if (!expectedHandler) {
    return {
      agreed: false,
      expectedHandler: null,
      note: `no_mapping_for_${shadow.intent}`,
    };
  }
  if (!productionHandler) {
    return { agreed: false, expectedHandler, note: 'production_handler_missing' };
  }
  const agreed = productionHandler === expectedHandler;
  return {
    agreed,
    expectedHandler,
    note: agreed ? 'agree' : `expected_${expectedHandler}_got_${productionHandler}`,
  };
}

function expectedHandlerForIntent(intent: Intent): string | null {
  switch (intent) {
    case 'provide_product_query':         return 'handleProductSearch';
    case 'provide_variant_choice':        return 'handleVariantReply';
    case 'provide_quantity':              return 'handleQuantityReply';
    case 'provide_delivery_zone':         return 'handleDeliveryReply';
    case 'provide_address':               return 'handleAddressReply';
    case 'provide_phone':                 return 'handlePhoneReply';
    case 'provide_name':                  return 'handleNameReply';
    case 'provide_ordinal_selection':     return 'handleProductSelection';

    case 'say_yes':
    case 'say_no':
    case 'say_unclear':                   return 'handleCheckoutConfirmation';

    case 'ask_price':
    case 'ask_stock':
    case 'ask_variants':
    case 'ask_delivery_fee':
    case 'ask_delivery_time':
    case 'ask_payment_methods':
    case 'ask_cod':
    case 'ask_refund_policy':
    case 'ask_location':
    case 'ask_hours':
    case 'ask_about_store':
    case 'ask_cart_total':
    case 'ask_unknown':                   return 'handleInformationQuestion';

    case 'command_change_address':        return 'handleAddressReply';
    case 'command_change_delivery':       return 'handleDeliveryReply';
    case 'command_change_name':           return 'handleNameReply';
    case 'command_change_phone':          return 'handlePhoneReply';
    case 'command_clear_cart':            return 'handleCartUpdate';
    case 'command_cart_update':           return 'handleCartUpdate';
    case 'command_show_cart':             return 'handleCartUpdate';
    case 'command_add_more':              return 'handleProductSearch';
    case 'command_catalog_discovery':     return 'handleProductSearch';
    case 'command_order_status':          return 'handleOrderStatusQuery';
    case 'command_payment_issue':         return 'handlePaymentIssue';
    case 'command_handover':              return null;

    case 'command_refund_request':
    case 'command_return_request':
    case 'command_exchange_request':
    case 'command_cancel_order':
    case 'command_damaged_item':
    case 'command_wrong_item':
    case 'command_wrong_item':
    case 'command_late_delivery':
    case 'command_general_complaint':     return 'handleSupportRequest';

    case 'meta_greeting':                 return 'handleProductSearch';
    case 'meta_thanks':                   return null;
    case 'meta_unknown':                  return null;
    default:                              return null;
  }
}
