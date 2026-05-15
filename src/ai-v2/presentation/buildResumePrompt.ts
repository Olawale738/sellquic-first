import type { QuestionIntent, Referent } from '../knowledge/types';
import type { CommerceState } from '../types';

/**
 * Canonical prompt for each real AI v2 commerce state.
 * This must match src/ai-v2/types.ts, not Claude's temporary assumed names.
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
      return 'Which delivery area should I use please?';

    case 'AWAITING_ADDRESS':
      return 'Please send the specific delivery address or nearby landmark.';

    case 'AWAITING_PHONE':
      return 'What phone number should we use for the order please?';

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

export type ResumeDecision = 'resume' | 'pivot' | 'none';

export function decideResume(
  intent: QuestionIntent,
  referent: Referent,
  state: CommerceState
): ResumeDecision {
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
      return 'resume';

    case 'q_delivery_fee':
    case 'q_delivery_time':
      if (referent.kind === 'delivery_named') return 'pivot';
      return 'resume';

    case 'q_payment_methods':
    case 'q_cod':
    case 'q_refund_policy':
    case 'q_location':
    case 'q_hours':
    case 'q_about_store':
      return 'resume';

    case 'q_unknown':
      return 'none';
  }
}