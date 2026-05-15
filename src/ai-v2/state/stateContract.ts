import type { TurnContext } from '../types';
import type { TurnFactPacket, VerifiedProduct, VerifiedVariant } from '../nlu/turnFactPacket';

export type SlotKey =
  | 'productId'
  | 'variantId'
  | 'quantity'
  | 'deliveryId'
  | 'address'
  | 'phone'
  | 'name';

export type OrderState =
  | 'IDLE'
  | 'BROWSING'
  | 'AWAITING_PRODUCT_SELECTION'
  | 'AWAITING_VARIANT'
  | 'AWAITING_QUANTITY'
  | 'AWAITING_DELIVERY_AREA'
  | 'AWAITING_ADDRESS'
  | 'AWAITING_PHONE'
  | 'AWAITING_NAME'
  | 'READY_FOR_CHECKOUT'
  | 'CHECKOUT_CREATED'
  | 'HANDOVER';

export type StateContract = {
  state: OrderState;
  /** What slot are we trying to fill, or null if no slot expected. */
  expectedSlot: SlotKey | null;
  /** The default prompt to ask for this slot. */
  prompt: string;
  /**
   * The re-anchor reply when we lost track or got unclear input.
   * Always references the focus product if available.
   */
  reAnchor: string;
  /** Human label for telemetry. */
  label: string;
};

/**
 * Single source of truth for "what does the bot need next at this state?"
 *
 * Every reply path that doesn't know what to say falls back to
 * step.reAnchor — guaranteeing the customer always gets a coherent,
 * context-aware next step instead of a generic greeting.
 */
export function getStateContract(
  ctx: TurnContext,
  factPacket: TurnFactPacket | null,
): StateContract {
  const state = (ctx.commerceState.state || 'IDLE') as OrderState;
  const focus = factPacket?.facts.contextProducts?.focusProduct;
  const established = factPacket?.facts.establishedState;

  const focusName = focus?.name || null;
  const focusPriceLabel = focus?.price ? `GHS ${focus.price}` : '';
  const variantList = focus?.variants ? formatVariantList(focus.variants) : null;

  switch (state) {
    case 'AWAITING_VARIANT':
      return {
        state,
        expectedSlot: 'variantId',
        prompt: variantList
          ? `${focusName || 'It'} comes in ${variantList}. Which would you like?`
          : `Which option would you like?`,
        reAnchor: variantList
          ? `Let me re-anchor please — for ${focusName || 'this item'}, it comes in ${variantList}. Which would you like?`
          : `Which option were you choosing?`,
        label: 'pick_variant',
      };

    case 'AWAITING_QUANTITY':
      return {
        state,
        expectedSlot: 'quantity',
        prompt: focusName
          ? `How many ${focusName} should I add for you?`
          : `How many should I add?`,
        reAnchor: focusName
          ? `Sure please. We were ordering ${focusName}${focusPriceLabel ? ` (${focusPriceLabel})` : ''}. How many sets should I add for you?`
          : `Sure please. How many should I add?`,
        label: 'pick_quantity',
      };

    case 'AWAITING_DELIVERY_AREA':
      return {
        state,
        expectedSlot: 'deliveryId',
        prompt: `Where would you like the order delivered to please?`,
        reAnchor: focusName
          ? `Got it please. For your ${focusName} order, where should we deliver?`
          : `Got it please. Where should we deliver to?`,
        label: 'pick_delivery_area',
      };

    case 'AWAITING_ADDRESS':
      return {
        state,
        expectedSlot: 'address',
        prompt: `Please share your delivery address or a nearby landmark.`,
        reAnchor: `Got it please. Could you share your delivery address or a nearby landmark?`,
        label: 'collect_address',
      };

    case 'AWAITING_PHONE':
      return {
        state,
        expectedSlot: 'phone',
        prompt: `What phone number should I use for the order please?`,
        reAnchor: `Got it please. What phone number should I use for the order?`,
        label: 'collect_phone',
      };

    case 'AWAITING_NAME':
      return {
        state,
        expectedSlot: 'name',
        prompt: `What name should I put on the order please?`,
        reAnchor: `Got it please. What name should I put on the order?`,
        label: 'collect_name',
      };

    case 'READY_FOR_CHECKOUT':
      return {
        state,
        expectedSlot: null,
        prompt: `Shall I create your checkout link now?`,
        reAnchor: `We have all your details please. Shall I create your checkout link?`,
        label: 'confirm_checkout',
      };

    case 'AWAITING_PRODUCT_SELECTION':
      return {
        state,
        expectedSlot: 'productId',
        prompt: `Which one would you like?`,
        reAnchor: `Which of the items would you like to go with please?`,
        label: 'pick_product',
      };

    case 'BROWSING':
    case 'IDLE':
    default:
      return {
        state,
        expectedSlot: null,
        prompt: focusName
          ? `Want to continue with ${focusName}?`
          : `What are you looking for today please?`,
        reAnchor: focusName
          ? `We were looking at ${focusName}${focusPriceLabel ? ` (${focusPriceLabel})` : ''}. Want to continue with this one, or look at something else?`
          : `What are you looking for today please?`,
        label: 'browse',
      };
  }
}

function formatVariantList(variants: VerifiedVariant[]): string {
  if (variants.length === 0) return '';
  const inStock = variants.filter((v) => v.inStock);
  const oos = variants.filter((v) => !v.inStock);

  const namesList = inStock.length > 0 ? inStock : variants;
  const names = namesList.map((v) => v.name);
  let result: string;
  if (names.length === 1) result = names[0];
  else if (names.length === 2) result = `${names[0]} and ${names[1]}`;
  else result = `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;

  if (inStock.length > 0 && oos.length > 0) {
    const oosNames = oos.map((v) => v.name).join(', ');
    result += ` (${oosNames} ${oos.length === 1 ? 'is' : 'are'} currently sold out)`;
  }
  return result;
}