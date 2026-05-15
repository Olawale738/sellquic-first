import type { CommerceState, TurnContext } from '../types';

/**
 * Stable intent taxonomy for AI v2's classifier-first NLU layer.
 *
 * Naming convention:
 *   provide_X — customer provides a slot value (consumed by state handler)
 *   ask_X     — customer asks something (routed to knowledge layer)
 *   command_X — customer issues an explicit command (interrupt)
 *   say_X     — bare confirmation/denial
 *   meta_X    — neither commerce nor knowledge (greeting, thanks, off-topic)
 */
export type Intent =
  // ── slot provisions ────────────────────────────────────────────────────
  | 'provide_product_query'
  | 'provide_variant_choice'
  | 'provide_quantity'
  | 'provide_delivery_zone'
  | 'provide_address'
  | 'provide_phone'
  | 'provide_name'
  | 'provide_ordinal_selection'

  // ── confirmation family ────────────────────────────────────────────────
  | 'say_yes'
  | 'say_no'
  | 'say_unclear'

  // ── ask family ─────────────────────────────────────────────────────────
  | 'ask_price'
  | 'ask_stock'
  | 'ask_variants'
  | 'ask_delivery_fee'
  | 'ask_delivery_time'
  | 'ask_payment_methods'
  | 'ask_cod'
  | 'ask_refund_policy'
  | 'ask_location'
  | 'ask_hours'
  | 'ask_about_store'
  | 'ask_cart_total'
  | 'ask_unknown'

  // ── command family ─────────────────────────────────────────────────────
  | 'command_change_address'
  | 'command_change_delivery'
  | 'command_change_name'
  | 'command_change_phone'
  | 'command_refund_request'
  | 'command_return_request'
  | 'command_exchange_request'
  | 'command_cancel_order'
  | 'command_damaged_item'
  | 'command_wrong_item'
  | 'command_late_delivery'
  | 'command_general_complaint'
  | 'command_clear_cart'
  | 'command_cart_update'
  | 'command_show_cart'
  | 'command_show_product'
  | 'command_add_more'
  | 'command_catalog_discovery'
  | 'command_order_status'
  | 'command_payment_issue'
  | 'command_handover'

  // ── meta ───────────────────────────────────────────────────────────────
  | 'meta_greeting'
  | 'meta_thanks'
  | 'meta_unknown';

/**
 * Slots the classifier may extract. Only intent-relevant slots are populated.
 * Slot values are RAW text — handlers do catalog/zone resolution downstream.
 */
export interface Slots {
  productQuery?: string;
  variantQuery?: string;
  /**
   * Order/payment reference extracted from the message. Set by Stage 3A
   * for command_order_status and follow-ups in AWAITING_ORDER_LOOKUP.
   */
  orderReference?: string;
  /**
   * Bare order document ID (when the customer pasted just the ID).
   */
  orderId?: string;
  /**
   * Carries the original support intent across an AWAITING_SUPPORT_LOOKUP
   * turn so handleSupportRequest knows what the customer was complaining
   * about even after they answer with just a phone number.
   */
  carriedSupportIntent?:
    | 'refund_request'
    | 'return_request'
    | 'exchange_request'
    | 'cancel_order'
    | 'damaged_item'
    | 'wrong_item'
    | 'late_delivery'
    | 'general_complaint';
  quantity?: number;
  zoneQuery?: string;
  ordinal?: number;
  addressText?: string;
  phone?: string;
  name?: string;
  questionText?: string;
}

export type Confidence = 'high' | 'medium' | 'low';

export type ClassifierSource =
  | 'deterministic'
  | 'semantic'
  | 'llm_fallback'
  | 'state_default'
  | 'gemini';

export interface ClassifiedTurn {
  intent: Intent;
  slots: Slots;
  confidence: Confidence;
  source: ClassifierSource;

  /**
   * True if this intent should beat the current state handler. Set by
   * the classifier; the policy may override (e.g. demote in HANDOVER).
   */
  isInterrupt: boolean;

  /**
   * For compound messages ("how much is it? add 2"). Logged in PR1;
   * processed by policy in a later PR.
   */
  secondary?: {
    intent: Intent;
    slots: Slots;
  };

  /**
   * Stable telemetry string. Format: "<source>:<rule>".
   * Examples: "deterministic:zone_match", "deterministic:question_q_price"
   */
  reason: string;
}

/**
 * Maps Intent to whether it is structurally a state-interrupting intent.
 * Pure function — no ctx, no state. Used by classifyTurn.
 */
export function intentIsInterrupt(intent: Intent): boolean {
  return (
    intent.startsWith('command_') ||
    intent.startsWith('ask_')
  );
}

// Re-exports so consumers don't have to import from two places later.
export type { CommerceState, TurnContext };