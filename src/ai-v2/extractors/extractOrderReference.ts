/**
 * Extract an order reference or order doc ID from a customer message.
 *
 * Handles three formats:
 *   - Full payment reference: SELLQUIC-ORDER-{docId}-{epochMs}
 *   - Truncated reference:    SELLQUIC-ORDER-{docId}
 *   - Bare order doc ID:      a 20-char Firestore-style id (alphanumeric)
 *
 * Returns either a paymentReference string OR an orderId string,
 * preferring whichever is more specific. The caller decides which
 * Firestore query to run.
 */

const PAYMENT_REF_RE = /SELLQUIC-ORDER-([A-Za-z0-9_-]{15,30})(?:-(\d{10,16}))?/i;

// Firestore auto-IDs are 20 chars, [A-Za-z0-9_-]. Bare 20-char alphanumeric
// strings are most likely order IDs when they appear in a customer message
// about an order — but we don't fire on common words. The regex requires
// mixed case OR digits to avoid eating English words.
const BARE_ORDER_ID_RE = /\b([A-Za-z0-9_-]{20})\b/;

export type ExtractedOrderRef =
  | { kind: 'paymentReference'; value: string; orderId: string }
  | { kind: 'orderId'; value: string }
  | null;

export function extractOrderReference(message: string): ExtractedOrderRef {
  if (!message) return null;
  const text = String(message).trim();

  const fullMatch = text.match(PAYMENT_REF_RE);
  if (fullMatch) {
    const orderId = fullMatch[1];
    const ts = fullMatch[2];
    return {
      kind: 'paymentReference',
      value: ts ? `SELLQUIC-ORDER-${orderId}-${ts}` : `SELLQUIC-ORDER-${orderId}`,
      orderId,
    };
  }

  const bareMatch = text.match(BARE_ORDER_ID_RE);
  if (bareMatch) {
    const candidate = bareMatch[1];
    // Avoid false positives on long English words by requiring at least
    // one digit OR mixed case.
    const hasDigit = /\d/.test(candidate);
    const hasMixedCase = /[a-z]/.test(candidate) && /[A-Z]/.test(candidate);
    if (hasDigit || hasMixedCase) {
      return { kind: 'orderId', value: candidate };
    }
  }

  return null;
}