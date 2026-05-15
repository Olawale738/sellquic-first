import type { CommerceState, QuestionIntent, Referent } from '../knowledge/types';

/**
 * Canonical prompt for each commerce state — the question the bot would have
 * asked if no interruption had happened. Used to resume a flow after an
 * information question is answered.
 *
 * Single source of truth: do not let handlers inline these strings, or we'll
 * get drift. If we localize replies later, this is the only file to touch
 * for resume prompts.
 *
 * Returns null when the state has no natural resume prompt:
 *   - IDLE / BROWSING — no flow in progress
 *   - CHECKOUT_CREATED — handled by checkout-created handler, not by us
 *   - HANDOVER — human is involved, do not interject with state prompts
 */
export function buildResumePrompt(state: CommerceState): string | null {
  switch (state) {
    case 'AWAITING_PRODUCT_SELECTION':
      return 'Which one would you like please?';
    case 'AWAITING_VARIANT':
      return 'Which option would you like please?';
    case 'AWAITING_QUANTITY':
      return 'How many should I add for you please?';
    case 'AWAITING_DELIVERY_AREA':
      return 'Which delivery zone should I use please?';
    case 'AWAITING_ADDRESS':
      return 'What is the delivery address please?';
    case 'AWAITING_PHONE':
      return 'What phone number should I use for the order please?';
    case 'AWAITING_NAME':
      return 'What name should I put on the order please?';
    case 'READY_FOR_CHECKOUT':
      return 'Should I go ahead and create the checkout link please?';
    case 'IDLE':
    case 'BROWSING':
    case 'CHECKOUT_CREATED':
    case 'HANDOVER':
      return null;
  }
}

/**
 * Resume policy — given (intent, referent, current state), should the
 * answer builder resume the current commerce step?
 *
 * Encoded as a function rather than a static table because some decisions
 * depend on the referent (delivery_named pivots) or on state.
 *
 * Returns:
 *   'resume' → append buildResumePrompt(state) to the answer
 *   'pivot'  → append a different prompt (provided by the answer builder)
 *   'none'   → just answer, no follow-up
 *
 * The answer builder still has the final say (it can choose 'none' if it
 * has a stronger reason — e.g. q_stock when out of stock).
 */
export type ResumeDecision = 'resume' | 'pivot' | 'none';

export function decideResume(
  intent: QuestionIntent,
  referent: Referent,
  state: CommerceState,
): ResumeDecision {
  // No active flow to resume from.
  if (
    state === 'IDLE' ||
    state === 'BROWSING' ||
    state === 'CHECKOUT_CREATED' ||
    state === 'HANDOVER'
  ) {
    return 'none';
  }

  switch (intent) {
    case 'q_price':
    case 'q_variants':
      return 'resume';

    case 'q_stock':
      // The stock answer builder may downgrade this to 'none' if out of stock.
      return 'resume';

    case 'q_delivery_fee':
    case 'q_delivery_time':
      // Asking about a *different* zone than what's selected: never silently
      // mutate. The answer builder pivots with a "want to change?" prompt.
      if (referent.kind === 'delivery_named') return 'pivot';
      return 'resume';

    case 'q_payment_methods':
    case 'q_cod':
    case 'q_refund_policy':
    case 'q_location':
    case 'q_hours':
    case 'q_about_store':
      return 'resume';

    case 'q_cart_total':
      // The cart-total builder picks its own resume prompt because it depends
      // on whether delivery is selected. Default 'resume' here is just the
      // baseline; the builder overrides with 'pivot' or 'none' as needed.
      return 'resume';

    case 'q_unknown':
      return 'none';
  }
}