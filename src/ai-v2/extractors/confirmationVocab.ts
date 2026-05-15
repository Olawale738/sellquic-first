/**
 * Confirmation vocabulary additions — issue 3 from the PR2 brief.
 *
 * "Yep" was already accepted; "Yea" was not, which broke the bestshito
 * transcript at checkout confirmation.
 *
 * USAGE — patch into existing extractConfirmation.ts:
 *
 *   import { extractConfirmationFromVocab } from './confirmationVocab';
 *
 *   // First pass: cheap exact-phrase match against the vocab set.
 *   const fromVocab = extractConfirmationFromVocab(message);
 *   if (fromVocab !== 'unknown') return fromVocab;
 *   // …then existing extractor logic for trickier cases…
 *
 * IMPORTANT: plain "please" is NOT in the affirm set, per PR2 brief.
 * "please" alone is too ambiguous — customers say it when stalling,
 * prompting for more info, etc.
 */

export const CONFIRMATION_AFFIRM_PHRASES: ReadonlySet<string> = new Set([
    // standard
    'yes', 'yes please', 'yeah', 'yeah please', 'yep', 'yep please', 'yup',
    'sure', 'sure please', 'ok', 'okay', 'k', 'kk', 'fine', 'alright',
  
    // additions per PR2 brief
    'yea', 'yea please', 'yess', 'yess please', 'yesss',
    'sure thing', 'go on', 'go ahead', 'please go ahead',
    'go on please', 'go ahead please',
  
    // common spelling slips
    'yh', 'yhh', 'ya', 'yaa',
  ]);
  
  /**
   * Negative-confirmation phrases. Conservative on purpose — does NOT include
   * stall words like "wait", "hold on", or "hmm" since those aren't denials.
   * handleCheckoutCreatedReply should keep `confirmationIntent === 'deny'`
   * near the BOTTOM of its if-chain, after change-address / change-delivery /
   * delivery-fee question / q_cart_total / add-more / product-availability.
   */
  export const CONFIRMATION_DENY_PHRASES: ReadonlySet<string> = new Set([
    'no', 'no please', 'nope', 'nah', 'naa',
    'cancel', 'cancel please',
    'never mind', 'nevermind',
    "don't", 'dont', 'stop',
    'not yet', 'not now',
  ]);
  
  /** Strips trailing punctuation, collapses whitespace, lowercases. */
  export function normalizeConfirmationInput(raw: string): string {
    return raw
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  export type ConfirmationResult = 'affirm' | 'deny' | 'unknown';
  
  /**
   * Reference matcher — drop-in front-end for the existing extractor.
   * Layer this BEFORE the existing logic; fall through to the existing
   * extractor for unmatched messages.
   */
  export function extractConfirmationFromVocab(raw: string): ConfirmationResult {
    const norm = normalizeConfirmationInput(raw);
    if (norm.length === 0) return 'unknown';
    if (CONFIRMATION_AFFIRM_PHRASES.has(norm)) return 'affirm';
    if (CONFIRMATION_DENY_PHRASES.has(norm)) return 'deny';
    return 'unknown';
  }