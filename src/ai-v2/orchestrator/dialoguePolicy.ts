import type { TurnContext } from '../types';
import type { ClassifiedTurn } from '../nlu/types';
import type { QuestionIntent } from '../knowledge/types';

/**
 * Policy decision = what runAiTurn should do for this turn.
 *
 * Policy is pure: takes (ctx, classified), returns a decision. Never
 * imports handlers. Never reads catalog/Firestore. Never decides commerce
 * truth — only WHO HANDLES the turn.
 *
 * runAiTurn maps PolicyDecision to an actual handler invocation.
 */
export type PolicyDecision =
  | { kind: 'silent_handover' }
  | { kind: 'route_handler'; handler: HandlerKey; reason: string }
  | { kind: 'route_command'; command: CommandKey; reason: string }
  | { kind: 'route_question'; questionIntent: QuestionIntent; reason: string }
  | { kind: 'state_handler'; reason: string };

export type HandlerKey =
  | 'handleProductSearch'
  | 'handleProductSelection'
  | 'handleVariantReply'
  | 'handleQuantityReply'
  | 'handleDeliveryReply'
  | 'handleAddressReply'
  | 'handlePhoneReply'
  | 'handleNameReply'
  | 'handleCheckoutConfirmation'
  | 'handleCheckoutCreatedReply'
  | 'handleCartUpdate'
  | 'handleCartReplace'
  | 'handleAddProductCombined'
  | 'handleMetaIntent';


export type CommandKey =
  | 'change_address'
  | 'change_delivery'
  | 'change_name'
  | 'change_phone'
  | 'show_cart'
  | 'clear_cart'
  | 'add_more'
  | 'catalog_discovery'
  | 'order_status'
  | 'payment_issue'
  | 'handover'
  | 'support_refund'
  | 'support_return'
  | 'support_exchange'
  | 'support_cancel'
  | 'support_damaged'
  | 'support_wrong_item'
  | 'support_late_delivery'
  | 'support_general';

/**
 * Decide where this turn goes.
 *
 * Rule order matters. Each rule returns immediately on match.
 *
 *   1. HANDOVER state — silence everything.
 *   2. Hard interrupts — change/show/clear cart, catalog discovery,
 *      order status, payment issue, handover, support intents.
 *   3. Knowledge questions — answered by the knowledge layer regardless
 *      of state.
 *   4. Post-denial guard — bare "yes" is not a confirmation.
 *   5. Combined order — provide_product_query with quantity slot.
 *   6. State-expected slot — when the classifier returns a slot the
 *      current state is asking for, hand it to the state handler.
 *   7. Slot for the wrong state — re-route to the correct concern.
 *   8. Confirmations in confirmation states.
 *   9. Default — let the legacy state handler run.
 */
export function dialoguePolicy(
  ctx: TurnContext,
  c: ClassifiedTurn,
): PolicyDecision {
  const state = ctx.commerceState.state;

  // 1. HANDOVER wins.
  if (state === 'HANDOVER') {
    return { kind: 'silent_handover' };
  }

  // 1b. AWAITING_SUPPORT_LOOKUP — keep the customer in the support flow.
  // While we're collecting phone/order to handle a refund/return/etc.,
  // any reply that isn't a clear off-topic (greeting/joke) or a NEW
  // hard interrupt (handover, switching to a different support intent,
  // payment_issue) belongs to the support handler.
  //
  // This blocks the wrong-handler trap: classifier returns
  // provide_phone / provide_ordinal_selection / provide_name, and we
  // route those slots BACK to handleSupportRequest instead of letting
  // handlePhoneReply / handleProductSelection take them.
  if (state === 'AWAITING_SUPPORT_LOOKUP') {
    // Only let a small whitelist of intents punch through — they're
    // legitimate interrupts, not support-flow continuations.
    const supportFlowInterrupts: ClassifiedTurn['intent'][] = [
      'command_handover',
      'command_payment_issue',
      'command_refund_request',
      'command_return_request',
      'command_exchange_request',
      'command_cancel_order',
      'command_damaged_item',
      'command_wrong_item',
      'command_late_delivery',
      'command_general_complaint',
      'meta_greeting',
      'meta_thanks',
    ];

    if (!supportFlowInterrupts.includes(c.intent)) {
      // Anything else — phone, ordinal, name, generic ask, unknown —
      // route back to the support handler. Carry the carriedSupportIntent
      // forward so handleSupportRequest knows which kind to handle.
      const carried = (ctx.commerceState as any).carriedSupportIntent as
        | string
        | undefined;
      const command = carried
        ? (`support_${carried.replace(/_request$|_order$/, '')}` as CommandKey)
        : ('support_general' as CommandKey);

      // Map carriedSupportIntent (e.g. "refund_request") to CommandKey
      // (e.g. "support_refund"). The map below is the source of truth.
      const carriedToCommand: Record<string, CommandKey> = {
        refund_request: 'support_refund',
        return_request: 'support_return',
        exchange_request: 'support_exchange',
        cancel_order: 'support_cancel',
        damaged_item: 'support_damaged',
        wrong_item: 'support_wrong_item',
        late_delivery: 'support_late_delivery',
        general_complaint: 'support_general',
      };
      const finalCommand: CommandKey = carried
        ? carriedToCommand[carried] || 'support_general'
        : 'support_general';

      return {
        kind: 'route_command',
        command: finalCommand,
        reason: `support_lookup_continuation_${c.intent}`,
      };
    }
    // Else fall through to normal routing — handover, switching to a
    // different support intent, greeting, thanks all handled below.
  }

  // 1c. Meta intents (greetings, thanks, unknowns) — never fall to
  // product search. Routes to handleMetaIntent which uses the composer
  // when available for friendly state-aware replies.
  if (c.intent === 'meta_greeting' || c.intent === 'meta_thanks' || c.intent === 'meta_unknown') {
    return {
      kind: 'route_handler',
      handler: 'handleMetaIntent',
      reason: c.intent,
    };
  }


  // 1d. Proactive offer accept — composer often pitches "want me to
  // add it? how many?" after a price answer. State is BROWSING/IDLE
  // but pendingProductId is set. Customer's "yes 3" / "ok 2" should
  // route to quantity handler with that pending product. Without this
  // rule, "yes 3" falls to handleProductSearch which asks "which
  // product?" even though context already had one.
  if (
    c.intent === 'provide_quantity' &&
    ctx.commerceState.pendingProductId &&
    (ctx.commerceState.state === 'BROWSING' || ctx.commerceState.state === 'IDLE')
  ) {
    return {
      kind: 'route_handler',
      handler: 'handleQuantityReply',
      reason: 'proactive_offer_accept',
    };
  }



  // 1e. Affirmative with focus product — bot just pitched a single
  // product and customer said "yes" / "ok" / "i want to proceed".
  // Without this, bare yes falls through to state_handler →
  // handleProductSearch (which has nothing to do with affirmation),
  // and the customer's commitment to the focus product is dropped.
  // Routes to handleProductSelection so the product enters the flow
  // (variant or quantity) with focus context preserved.
  if (
    c.intent === 'say_yes' &&
    (ctx.commerceState.lastMentionedProductId ||
      ctx.commerceState.pendingProductId) &&
    (ctx.commerceState.state === 'BROWSING' ||
      ctx.commerceState.state === 'IDLE') &&
    !ctx.commerceState.postDenialMode
  ) {
    return {
      kind: 'route_handler',
      handler: 'handleProductSelection',
      reason: 'affirmative_with_focus_product',
    };
  }

  // 1f. Checkout-readiness during slot collection. Customer signals
  // they're ready ("ok am ready now", "am ready to checkout", "let's
  // checkout") while a required checkout slot is still missing. Without
  // this rule, classifier produces say_yes/meta_unknown → state_handler
  // → slot handler → "I couldn't match that area"-style failure reply.
  // Routes to handleCheckoutConfirmation, which calls
  // validateCheckoutReadiness and produces the per-slot guidance message
  // ("Where should we deliver it please?", etc.).
  //
  // Both regexes are fully anchored (^…$). Compound messages like
  // "ready, weija block" do NOT match — they continue to the slot path.
  if (CHECKOUT_READINESS_STATES.has(state)) {
    const trimmed = (ctx.message || '').trim();
    if (READINESS_RE.test(trimmed) || CHECKOUT_INTENT_RE.test(trimmed)) {
      return {
        kind: 'route_handler',
        handler: 'handleCheckoutConfirmation',
        reason: 'checkout_readiness_during_slot_collection',
      };
    }
  }

  // 1g. Catalog/general store questions and recipient-tied
  // recommendations. Without this rule, Gemini's brittle override often
  // treats "do you sell hair?" / "what do you sell generally?" /
  // "can you recommend an outfit for my son?" as provide_product_query,
  // which routes to handleProductSearch → no_match →
  // handleNonProductFallback's focus template (wrong: shows the
  // currently-focused product instead of catalog summary). Routing
  // here to handleCatalogDiscovery (Bundle B-wired) produces a
  // vendor-driven catalog summary from ctx.products. No hardcoded
  // category names — the reply comes from the vendor's actual catalog.
  {
    const message = (ctx.message || '').trim();
    if (
      CATALOG_QUESTION_RE.test(message) ||
      RECOMMENDATION_FOR_RECIPIENT_RE.test(message)
    ) {
      return {
        kind: 'route_command',
        command: 'catalog_discovery',
        reason: 'catalog_or_recommendation_question',
      };
    }
  }

  // 2. Hard interrupts.
  switch (c.intent) {
    case 'command_handover': {
      // Bundle E: only honor handover when the raw message contains an
      // explicit handover phrase. Gemini's brittle override sometimes
      // classifies "i have a question" / "can i ask?" as command_handover,
      // which would land at the silent-handover dispatch and break the
      // conversation. When no explicit phrase is present, treat as
      // q_unknown so handleInformationQuestionRouter produces a
      // clarifying reply (no silent reply, no field corruption).
      if (!HANDOVER_EXPLICIT_RE.test(ctx.message || '')) {
        return {
          kind: 'route_question',
          questionIntent: 'q_unknown',
          reason: 'handover_misclassified_routed_to_unknown',
        };
      }
      return { kind: 'route_command', command: 'handover', reason: c.reason };
    }
    case 'command_order_status':
      return { kind: 'route_command', command: 'order_status', reason: c.reason };
    case 'command_payment_issue':
      return { kind: 'route_command', command: 'payment_issue', reason: c.reason };
    case 'command_change_address':
      return { kind: 'route_command', command: 'change_address', reason: c.reason };
    case 'command_change_delivery':
      return { kind: 'route_command', command: 'change_delivery', reason: c.reason };
    case 'command_change_name':
      return { kind: 'route_command', command: 'change_name', reason: c.reason };
    case 'command_change_phone':
      return { kind: 'route_command', command: 'change_phone', reason: c.reason };
    case 'command_show_cart':
      return { kind: 'route_command', command: 'show_cart', reason: c.reason };
    case 'command_clear_cart':
      return { kind: 'route_command', command: 'clear_cart', reason: c.reason };
      case 'command_cart_update':
        return {
          kind: 'route_handler',
          handler: 'handleCartUpdate',
          reason: c.reason,
        };  
    case 'command_add_more':
      return { kind: 'route_command', command: 'add_more', reason: c.reason };
    case 'command_catalog_discovery':
      return { kind: 'route_command', command: 'catalog_discovery', reason: c.reason };

    // Stage 3B — support intents (route to handleSupportRequest).
    case 'command_refund_request':
      return { kind: 'route_command', command: 'support_refund', reason: c.reason };
    case 'command_return_request':
      return { kind: 'route_command', command: 'support_return', reason: c.reason };
    case 'command_exchange_request':
      return { kind: 'route_command', command: 'support_exchange', reason: c.reason };
    case 'command_cancel_order':
      return { kind: 'route_command', command: 'support_cancel', reason: c.reason };
    case 'command_damaged_item':
      return { kind: 'route_command', command: 'support_damaged', reason: c.reason };
    case 'command_wrong_item':
      return { kind: 'route_command', command: 'support_wrong_item', reason: c.reason };
    case 'command_late_delivery':
      return { kind: 'route_command', command: 'support_late_delivery', reason: c.reason };
    case 'command_general_complaint':
      return { kind: 'route_command', command: 'support_general', reason: c.reason };
  }

  // 3. Knowledge questions.
  const askMap = ASK_TO_QUESTION_INTENT[c.intent];
  if (askMap) {
    return { kind: 'route_question', questionIntent: askMap, reason: c.reason };
  }

  // 4. Post-denial — bare confirmations are not consent.
  if (
    ctx.commerceState.postDenialMode === true &&
    c.intent === 'say_yes'
  ) {
    return {
      kind: 'state_handler',
      reason: 'post_denial_bare_yes_ignored',
    };
  }

  // 5. Combined order — provide_product_query carrying a quantity slot is
  //    the combined extractor's signal. Handler resolves catalog + adds.
  if (
    c.intent === 'provide_product_query' &&
    typeof c.slots.quantity === 'number'
  ) {
    return {
      kind: 'route_handler',
      handler: 'handleAddProductCombined',
      reason: 'combined_order',
    };
  }

  // 6 & 7. Slot intents — match against the state's expected slot.
  if (isProvideIntent(c.intent)) {
    // AWAITING_PRODUCT_SELECTION: customer is choosing from displayed
    // options. Both ordinal selections ("the first one") and natural
    // product names ("let me see the baby boys suspender") belong to
    // handleProductSelection, which knows about displayedProductIds /
    // pendingProductOptions. Without this branch, ordinals fall through
    // routeStateHandler into handleProductSearch, and natural names
    // hit the product_query_interrupts_state branch below — both wrong.
    if (
      state === 'AWAITING_PRODUCT_SELECTION' &&
      (c.intent === 'provide_product_query' ||
        c.intent === 'provide_ordinal_selection')
    ) {
      return {
        kind: 'route_handler',
        handler: 'handleProductSelection',
        reason: `selection_state_${c.intent}`,
      };
    }

    const expected = expectedSlotForState(state);

    if (expected && intentMatchesSlot(c.intent, expected)) {
      // Slot matches the active state — let the state handler take it.
      return {
        kind: 'state_handler',
        reason: `state_slot_${expected}`,
      };
    }

    // Slot for a different concern.
    if (c.intent === 'provide_product_query' && c.confidence !== 'low') {
      // "i want bags" while AWAITING_VARIANT, or any clear product
      // query mid-flow → search products. This is the rule that stops
      // state handlers from hijacking fresh product intent.
      return {
        kind: 'route_handler',
        handler: 'handleProductSearch',
        reason: 'product_query_interrupts_state',
      };
    }

    if (c.intent === 'provide_delivery_zone') {
      // Customer named a zone outside AWAITING_DELIVERY_AREA. Let the
      // delivery handler take it; it idempotently sets the zone and
      // re-derives next state.
      return {
        kind: 'route_handler',
        handler: 'handleDeliveryReply',
        reason: 'zone_named_outside_delivery_state',
      };
    }

    if (c.intent === 'provide_address') {
      return {
        kind: 'route_handler',
        handler: 'handleAddressReply',
        reason: 'address_provided_outside_address_state',
      };
    }

    if (c.intent === 'provide_phone') {
      return {
        kind: 'route_handler',
        handler: 'handlePhoneReply',
        reason: 'phone_provided_outside_phone_state',
      };
    }

    if (c.intent === 'provide_name') {
      return {
        kind: 'route_handler',
        handler: 'handleNameReply',
        reason: 'name_provided_outside_name_state',
      };
    }

    if (c.intent === 'provide_ordinal_selection') {
      return {
        kind: 'route_handler',
        handler: 'handleProductSelection',
        reason: 'ordinal_outside_selection_state',
      };
    }


    if (c.intent === 'provide_variant_choice') {
      // Customer named a variant outside AWAITING_VARIANT.
      // If we have a pending product → variant handler can resolve it.
      // If we don't → route to product search so the customer can name
      // a product instead of getting "couldn't match area".
      if (ctx.commerceState.pendingProductId) {
        return {
          kind: 'route_handler',
          handler: 'handleVariantReply',
          reason: 'variant_named_outside_variant_state',
        };
      }
      return {
        kind: 'route_handler',
        handler: 'handleProductSearch',
        reason: 'variant_named_no_pending_product',
      };
    }

    // Quantity / variant outside their states are too ambiguous to act
    // on without more context — defer to the active state handler.
    return {
      kind: 'state_handler',
      reason: `slot_${c.intent}_in_${state}_deferred`,
    };
  }

  // 8. Confirmations.
  if (c.intent === 'say_yes' || c.intent === 'say_no' || c.intent === 'say_unclear') {
    if (state === 'READY_FOR_CHECKOUT') {
      return {
        kind: 'route_handler',
        handler: 'handleCheckoutConfirmation',
        reason: 'confirmation_in_checkout_state',
      };
    }
    if (state === 'CHECKOUT_CREATED') {
      return {
        kind: 'route_handler',
        handler: 'handleCheckoutCreatedReply',
        reason: 'confirmation_in_checkout_created_state',
      };
    }
    return {
      kind: 'state_handler',
      reason: 'confirmation_outside_confirmation_state',
    };
  }

  // 9. Meta and unknown — defer.
  return { kind: 'state_handler', reason: `default_${c.intent}` };
}

// ─────────────────────────────────────────────────────────────────────────────
// helpers — pure, no imports
// ─────────────────────────────────────────────────────────────────────────────

// Rule 1f checkout-readiness: anchored regexes match whole-message
// readiness signals only. Compound messages do NOT match.
const READINESS_RE =
  /^(?:(?:ok|alright|sure|please|now)\s+)*(?:(?:am|i\s+am|i'?m|we\s+are|we'?re)\s+)?(?:ready|done|good)(?:\s+(?:now|to\s+(?:checkout|check\s+out|order|pay|go|complete|finalize|proceed|finish)))?\s*[!.?]*$/i;

const CHECKOUT_INTENT_RE =
  /^(?:(?:ok|alright|sure|please)\s+)?(?:(?:i\s+want\s+to|i'?d\s+like\s+to|let'?s|let\s+me)\s+)?(?:checkout|check\s+out|complete\s+(?:my\s+|the\s+)?order|finalize\s+(?:my\s+|the\s+)?order|create\s+(?:my\s+|the\s+)?(?:order|checkout)|process\s+(?:my\s+|the\s+)?order|proceed)\s*[!.?]*$/i;

const CHECKOUT_READINESS_STATES: ReadonlySet<TurnContext['commerceState']['state']> =
  new Set<TurnContext['commerceState']['state']>([
    'AWAITING_VARIANT',
    'AWAITING_QUANTITY',
    'AWAITING_DELIVERY_AREA',
    'AWAITING_ADDRESS',
    'AWAITING_PHONE',
    'AWAITING_NAME',
  ]);

// Bundle E — handover gating. Mirrors classifyTurn's HANDOVER_RE plus
// "let me speak to (the) (owner|seller|...)" / "i want to talk to ...".
// When Gemini's brittle override classifies as command_handover but the
// raw message doesn't contain an explicit handover phrase, route to
// q_unknown instead of going silent.
const HANDOVER_EXPLICIT_RE =
  /\b(talk\s+to\s+(?:a\s+|the\s+)?(?:human|person|agent|seller|vendor|representative|owner|someone)|speak\s+(?:to|with)\s+(?:a\s+|the\s+)?(?:human|person|agent|seller|vendor|representative|owner|someone)|call\s+me|can\s+someone\s+call|human\s+being|real\s+person|live\s+agent|let\s+me\s+speak\s+to\s+(?:the\s+)?(?:owner|seller|vendor|human|agent|someone)|i\s+want\s+to\s+talk\s+to\s+(?:a\s+|the\s+)?(?:human|person|agent|seller|vendor|owner|someone)|connect\s+me\s+(?:to|with)\s+(?:a\s+|the\s+)?(?:human|person|agent|seller|vendor|owner|someone))\b/i;

// Bundle E — catalog/general store questions. Anchored to whole-message
// shapes only. Routes to handleCatalogDiscovery, which produces a
// summary of the vendor's actual catalog (no hardcoded categories).
const CATALOG_QUESTION_RE =
  /^(?:do\s+you\s+(?:sell|have|carry|stock|got)\s+\w[\w\s]*\??|what\s+(?:do|did)\s+you\s+(?:sell|have|carry|stock)(?:\s+\w+)?\??|what\s+(?:items|products|things|stuff|else)\s+(?:do|did)\s+you\s+(?:sell|have|carry|stock)(?:\s+\w+)?\??|do\s+you\s+have\s+(?:any\s+)?(?:other|more)\s+(?:products|items|options)\??|what\s+else\s+(?:do|did)\s+you\s+have\??)\s*$/i;

// Bundle E — recommendation/discovery requests tied to a recipient or a
// generic product noun. Catches "can you recommend an outfit for my
// son", "any options for my daughter", "got something for my baby",
// "anything for him". Anchored to start-of-message or post-sentence so
// it doesn't match mid-sentence noise. The reply comes from
// handleCatalogDiscovery (vendor-driven catalog), not hardcoded text.
const RECOMMENDATION_FOR_RECIPIENT_RE =
  /(?:^|[.!?]\s+)(?:can\s+you\s+|could\s+you\s+|please\s+|kindly\s+)?(?:recommend|suggest|do\s+you\s+have|got\s+(?:any|something|anything)?|any|something|anything)\b[\s\S]{0,60}?\bfor\s+(?:my\s+)?(?:son|daughter|kid|child|children|baby|nephew|niece|brother|sister|husband|wife|girlfriend|boyfriend|partner|friend|him|her|them|me|myself)\b/i;

const ASK_TO_QUESTION_INTENT: Partial<Record<ClassifiedTurn['intent'], QuestionIntent>> = {
  ask_price: 'q_price',
  ask_stock: 'q_stock',
  ask_variants: 'q_variants',
  ask_delivery_fee: 'q_delivery_fee',
  ask_delivery_time: 'q_delivery_time',
  ask_payment_methods: 'q_payment_methods',
  ask_cod: 'q_cod',
  ask_refund_policy: 'q_refund_policy',
  ask_location: 'q_location',
  ask_hours: 'q_hours',
  ask_about_store: 'q_about_store',
  ask_cart_total: 'q_cart_total',
  ask_unknown: 'q_unknown',
};

type SlotKey =
  | 'product'
  | 'variant'
  | 'quantity'
  | 'delivery_zone'
  | 'address'
  | 'phone'
  | 'name'
  | 'ordinal';

function expectedSlotForState(state: TurnContext['commerceState']['state']): SlotKey | null {
  switch (state) {
    case 'AWAITING_PRODUCT_SELECTION': return 'ordinal';
    case 'AWAITING_VARIANT':           return 'variant';
    case 'AWAITING_QUANTITY':          return 'quantity';
    case 'AWAITING_DELIVERY_AREA':     return 'delivery_zone';
    case 'AWAITING_ADDRESS':           return 'address';
    case 'AWAITING_PHONE':             return 'phone';
    case 'AWAITING_NAME':              return 'name';
    default:                           return null;
  }
}

function isProvideIntent(intent: ClassifiedTurn['intent']): boolean {
  return intent.startsWith('provide_');
}

function intentMatchesSlot(intent: ClassifiedTurn['intent'], slot: SlotKey): boolean {
  switch (slot) {
    case 'product':       return intent === 'provide_product_query';
    case 'variant':       return intent === 'provide_variant_choice';
    case 'quantity':      return intent === 'provide_quantity';
    case 'delivery_zone': return intent === 'provide_delivery_zone';
    case 'address':       return intent === 'provide_address';
    case 'phone':         return intent === 'provide_phone';
    case 'name':          return intent === 'provide_name';
    case 'ordinal':       return intent === 'provide_ordinal_selection';
  }
}