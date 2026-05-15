import type { TurnFactPacket } from '../nlu/turnFactPacket';

/**
 * Guard: composer cannot claim actions ("noted", "saved", "added",
 * "reserved", "confirmed", "your order of N") unless the executor
 * actually performed those actions in this turn.
 */

export type ActionWordingViolation = {
  kind:
    | 'claimed_phone_action_not_filled'
    | 'claimed_name_action_not_filled'
    | 'claimed_address_action_not_filled'
    | 'claimed_cart_action_no_change'
    | 'claimed_order_quantity_no_cart'
    | 'claimed_reservation_no_cart'
    | 'claimed_finalization_no_cart'
    | 'claimed_link_sent_no_cart'
    | 'claimed_link_sending_no_cart';
  matchedPhrase: string;
};

const ACTION_VERBS_RE =
  /\b(noted|saved|got|received|stored|recorded|captured|registered|jotted\s+down)\b/i;
const RESERVE_RE =
  /\b(reserved|i'?ve\s+reserved|have\s+reserved|put\s+(it|that|them|down)\s+(for|aside|down))\b/i;
const ADD_RE =
  /\b(added|i'?ve\s+added|i\s+have\s+added|placed\s+in\s+(the\s+)?cart)\b/i;
const CONFIRM_RE =
  /\b(confirmed|i'?ve\s+confirmed|have\s+confirmed)\s+(your\s+)?(order|details|items)\b/i;
const ORDER_OF_N_RE =
  /\border\s+of\s+\d+|\bi\s+have\s+\d+\s+(set|sets|item|items|piece|pieces)\b/i;

  export function checkActionWording(
    reply: string,
    factPacket: TurnFactPacket | null,
  ): ActionWordingViolation | null {
    if (!reply) return null;
    const text = reply.toLowerCase();
  
    // CORRECT path: filled is top-level on the packet, with direct slot fields.
    const filled = factPacket?.filled || {};
    const customerPhoneFilled = !!filled.customerPhone;
    const customerNameFilled = !!filled.customerName;
    const customerAddressFilled = !!filled.customerAddress;
    const deliveryIdFilled = !!filled.deliveryId;
    const cartItemCount: number = (factPacket?.facts as any)?.cartTotal || 0;
    const anySlotFilledThisTurn =
      customerPhoneFilled ||
      customerNameFilled ||
      customerAddressFilled ||
      deliveryIdFilled;
  
    // PRECISE patterns: verb must be immediately followed by the noun.
    // "noted phone", "saved your phone number", "got the contact" → match.
    // "That is noted. Please give me your phone." → does NOT match.
    const NOTED_PHONE_RE =
      /\b(noted|saved|got|received|stored|recorded|registered|captured)\s+(it\s+|that\s+|your\s+|the\s+)?(phone|number|contact)\b/i;
    const NOTED_NAME_RE =
      /\b(noted|saved|got|received|stored|recorded|registered|captured)\s+(it\s+|that\s+|your\s+|the\s+)?(name|full\s+name)\b/i;
    const NOTED_ADDRESS_RE =
      /\b(noted|saved|got|received|stored|recorded|registered|captured)\s+(it\s+|that\s+|your\s+|the\s+)?(address|location|landmark)\b/i;
  
    if (NOTED_PHONE_RE.test(text) && !customerPhoneFilled) {
      return {
        kind: 'claimed_phone_action_not_filled',
        matchedPhrase: 'noted phone but not filled',
      };
    }
  
    if (NOTED_NAME_RE.test(text) && !customerNameFilled) {
      return {
        kind: 'claimed_name_action_not_filled',
        matchedPhrase: 'noted name but not filled',
      };
    }
  
    if (NOTED_ADDRESS_RE.test(text) && !customerAddressFilled) {
      return {
        kind: 'claimed_address_action_not_filled',
        matchedPhrase: 'noted address but not filled',
      };
    }
  
    // Cart-action claims: "I've added", "placed in cart", "reserved", "your order of N"
    // Only fire when no slot was filled AND cart still empty — preserves
    // legitimate replies after delivery/name/phone capture.
    const ADDED_RE =
      /\b(i'?ve\s+added|i\s+have\s+added|placed\s+in\s+(the\s+)?cart|added\s+(it|that|them|the\s+items?)\s+to\s+(your\s+)?(cart|order))\b/i;
    const RESERVED_RE =
      /\b(i'?ve\s+reserved|have\s+reserved|put\s+(it|that|them|down)\s+(for|aside|down))\b/i;
    const CONFIRMED_ORDER_RE =
      /\b(i'?ve\s+confirmed|have\s+confirmed)\s+(your\s+)?(order|details|items)\b/i;
    const ORDER_OF_N_RE =
      /\border\s+of\s+\d+\s+(set|sets|item|items|piece|pieces)\b/i;
  
    if (ADDED_RE.test(text) && cartItemCount === 0 && !anySlotFilledThisTurn) {
      return {
        kind: 'claimed_cart_action_no_change',
        matchedPhrase: 'added without cart change',
      };
    }
    if (RESERVED_RE.test(text) && cartItemCount === 0) {
      return {
        kind: 'claimed_reservation_no_cart',
        matchedPhrase: 'reserved without cart',
      };
    }
    if (CONFIRMED_ORDER_RE.test(text) && cartItemCount === 0) {
      return {
        kind: 'claimed_cart_action_no_change',
        matchedPhrase: 'confirmed order without cart',
      };
    }
    if (ORDER_OF_N_RE.test(text) && cartItemCount === 0) {
      return {
        kind: 'claimed_order_quantity_no_cart',
        matchedPhrase: 'order quantity claim without cart',
      };
    }

    // NEW: "I have finalized your order" / "I've completed the order"
    const FINALIZED_RE =
      /\b(finaliz(ed|ing)|complet(ed|ing))\s+(your|the|this)\s+(order|purchase)\b/i;
    const HAVE_FINALIZED_RE =
      /\b(i\s+have|i'?ve)\s+(finaliz(ed|ing)|complet(ed|ing))\b/i;
    if (
      (FINALIZED_RE.test(text) || HAVE_FINALIZED_RE.test(text)) &&
      cartItemCount === 0
    ) {
      return {
        kind: 'claimed_finalization_no_cart',
        matchedPhrase: 'finalization claim with empty cart',
      };
    }

    // NEW: "I have sent the link" / "I've sent the payment link"
    const SENT_LINK_RE =
      /\b(i\s+have\s+sent|i'?ve\s+sent|just\s+sent|have\s+sent)\b[^.!?]*\b(link|payment|checkout)\b/i;
    if (SENT_LINK_RE.test(text) && cartItemCount === 0) {
      return {
        kind: 'claimed_link_sent_no_cart',
        matchedPhrase: 'sent-link claim with empty cart',
      };
    }

    // NEW: "I am sending the link to your phone" / "the link I am sending"
    const SENDING_LINK_RE =
      /\b(i\s+am\s+sending|i'?m\s+sending|am\s+sending)\b[^.!?]*\b(link|payment|checkout|to\s+your\s+(phone|number))\b/i;
    const LINK_I_AM_SENDING_RE =
      /\blink\s+i\s+(am\s+sending|'?m\s+sending|have\s+sent|'?ve\s+sent)\b/i;
    if (
      (SENDING_LINK_RE.test(text) || LINK_I_AM_SENDING_RE.test(text)) &&
      cartItemCount === 0
    ) {
      return {
        kind: 'claimed_link_sending_no_cart',
        matchedPhrase: 'sending-link claim with empty cart',
      };
    }

    return null;
  }