import { Type } from '@google/genai';
import type { Intent } from './types';

/**
 * Gemini NLU result — what the model returns.
 *
 * Mirrors deterministic ClassifiedTurn but with looser confidence
 * (Gemini can express uncertainty more meaningfully than regex).
 */
export interface GeminiNluResult {
  primaryIntent: Intent;
  secondaryIntent?: Intent | 'none';
  slots: GeminiSlots;
  stateAction: 'continue_current_state' | 'interrupt' | 'exit_state';
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

export interface GeminiSlots {
  productQuery?: string;
  variantQuery?: string;
  quantity?: number;
  deliveryZone?: string;
  address?: string;
  phone?: string;
  orderReference?: string;
  supportIssue?: string;
}

/**
 * The 30 intents Gemini is allowed to return. Must stay in sync with
 * the Intent type in nlu/types.ts. If you add an intent there, add it
 * here too.
 */
export const ALLOWED_INTENTS: Intent[] = [
  // Meta
  'meta_greeting',
  'meta_thanks',
  'meta_unknown',

  // Provide-slot intents
  'provide_product_query',
  'provide_variant_choice',
  'provide_quantity',
  'provide_delivery_zone',
  'provide_address',
  'provide_phone',
  'provide_name',
  'provide_ordinal_selection',

  // Confirmations
  'say_yes',
  'say_no',

  // Commands
  'command_handover',
  'command_order_status',
  'command_payment_issue',
  'command_catalog_discovery',
  'command_change_address',
  'command_change_delivery',
  'command_change_name',
  'command_change_phone',
  'command_clear_cart',
  'command_show_cart',
  'command_add_more',
  'command_refund_request',
  'command_return_request',
  'command_exchange_request',
  'command_cancel_order',
  'command_damaged_item',
  'command_wrong_item',
  'command_late_delivery',
  'command_general_complaint',

  // Questions
  'ask_price',
  'ask_stock',
  'ask_variants',
  'ask_delivery_fee',
  'ask_delivery_time',
  'ask_payment_methods',
  'ask_cod',
  'ask_refund_policy',
  'ask_location',
  'ask_hours',
  'ask_about_store',
  'ask_cart_total',
  'ask_unknown',
];

export const NLU_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    primaryIntent: {
      type: Type.STRING,
      enum: ALLOWED_INTENTS,
      description: 'The main thing the customer is trying to do this turn.',
    },
    secondaryIntent: {
      type: Type.STRING,
      enum: [...ALLOWED_INTENTS, 'none'],
      description:
        'A second intent if the message is compound (e.g. "how much is delivery + 2 of these"). Use "none" if only one intent.',
    },
    slots: {
      type: Type.OBJECT,
      properties: {
        productQuery: {
          type: Type.STRING,
          description:
            'Product name, alias, or descriptive phrase. Verbatim from the customer.',
        },
        variantQuery: {
          type: Type.STRING,
          description:
            'Variant name (color/size/style) the customer mentioned.',
        },
        quantity: {
          type: Type.INTEGER,
          description: 'Numeric quantity if customer specified one.',
        },
        deliveryZone: {
          type: Type.STRING,
          description: 'Delivery area/zone the customer named.',
        },
        address: {
          type: Type.STRING,
          description: 'Specific street/landmark/house address.',
        },
        phone: {
          type: Type.STRING,
          description: 'Ghana phone number if present.',
        },
        orderReference: {
          type: Type.STRING,
          description:
            'Order reference code (e.g. SELLQUIC-ORDER-...) if mentioned.',
        },
        supportIssue: {
          type: Type.STRING,
          description: 'Brief description of complaint or support issue.',
        },
      },
    },
    stateAction: {
      type: Type.STRING,
      enum: ['continue_current_state', 'interrupt', 'exit_state'],
      description:
        'Whether the customer is filling the current slot (continue), starting something new (interrupt), or abandoning the flow (exit).',
    },
    confidence: {
      type: Type.STRING,
      enum: ['high', 'medium', 'low'],
      description:
        'How sure are you. "low" if the message is ambiguous, off-topic, or doesn\'t match any clear intent.',
    },
    reason: {
      type: Type.STRING,
      description: 'One short sentence explaining the classification.',
    },
  },
  required: ['primaryIntent', 'slots', 'stateAction', 'confidence', 'reason'],
  propertyOrdering: [
    'primaryIntent',
    'secondaryIntent',
    'slots',
    'stateAction',
    'confidence',
    'reason',
  ],
};

/**
 * Validates a parsed JSON object against the Gemini NLU contract.
 * Returns null if invalid. Caller falls back to deterministic on null.
 */
export function validateGeminiNluResult(parsed: unknown): GeminiNluResult | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const r = parsed as Record<string, unknown>;

  if (typeof r.primaryIntent !== 'string') return null;
  if (!ALLOWED_INTENTS.includes(r.primaryIntent as Intent)) return null;

  if (
    r.secondaryIntent !== undefined &&
    typeof r.secondaryIntent === 'string' &&
    r.secondaryIntent !== 'none' &&
    !ALLOWED_INTENTS.includes(r.secondaryIntent as Intent)
  ) {
    return null;
  }

  if (!r.slots || typeof r.slots !== 'object') return null;

  if (
    r.stateAction !== 'continue_current_state' &&
    r.stateAction !== 'interrupt' &&
    r.stateAction !== 'exit_state'
  ) {
    return null;
  }

  if (
    r.confidence !== 'high' &&
    r.confidence !== 'medium' &&
    r.confidence !== 'low'
  ) {
    return null;
  }

  if (typeof r.reason !== 'string') return null;

  return parsed as GeminiNluResult;
}