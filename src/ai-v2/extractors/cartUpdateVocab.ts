/**
 * Cart-update vocabulary additions — issue 4 from the PR2 brief.
 *
 * "Ok clear it" was being treated as a checkout-link prompt because the
 * existing extractor didn't recognize it as a clear-cart intent.
 *
 * USAGE — patch into existing extractCartUpdateIntent.ts:
 *
 *   import { detectsClearCartIntent } from './cartUpdateVocab';
 *
 *   if (detectsClearCartIntent(message)) return { kind: 'clear_cart' };
 *   // …existing logic for add/remove single line, etc…
 *
 * Routes through existing handleCartUpdate.ts → executeCommerceActions
 * ([CLEAR_CART, CLEAR_CHECKOUT]), which already invalidates the checkout
 * link per the executor invariants. NO new commerce mutation paths.
 */

/**
 * Phrase patterns that mean "clear the entire cart / start over".
 *
 * Conservative on purpose — does NOT match:
 *   - "remove the akwasi" (single-line removal, different intent)
 *   - "change my address" (different intent)
 *   - "cancel" alone (could mean cancel current step, not the whole cart)
 *   - "forget about it" (too vague — could be a stall)
 */
const CLEAR_CART_PATTERNS: RegExp[] = [
    // "clear it" / "clear it all" / "clear my cart" / "clear everything"
    /\bclear\s+(it|all|everything|my\s+(cart|order)|the\s+(cart|order))\b/,
  
    // "empty it" / "empty the cart" / "empty my cart"
    /\bempty\s+(it|all|the\s+(cart|order)|my\s+(cart|order))\b/,
  
    // "remove everything" / "remove all" / "remove all items"
    /\bremove\s+(everything|all|all\s+items|all\s+the\s+items)\b/,
  
    // "cancel this order" / "cancel the order" / "cancel my order"
    /\bcancel\s+(this|the|my)\s+order\b/,
  
    // "cancel everything"
    /\bcancel\s+everything\b/,
  
    // "start over" / "let's start over" / "start fresh" / "start again"
    /\b(start|begin)\s+(over|fresh|again)\b/,
    /\blet'?s\s+start\s+(over|fresh|again)\b/,
  
    // "scrap it" / "scrap this" / "scrap the order"
    /\bscrap\s+(it|this|that|the\s+order|the\s+cart)\b/,
  
    // "forget it" / "forget the order" — combined with order/cart context
    /\bforget\s+(the\s+order|the\s+cart|this\s+order)\b/,
  
    // "reset cart" / "reset the order"
    /\breset\s+(it|cart|the\s+(cart|order)|my\s+(cart|order))\b/,
  ];
  
  /**
   * Returns true iff the customer's message expresses an intent to clear
   * the entire cart. Case-insensitive after light normalization.
   */
  export function detectsClearCartIntent(rawMessage: string): boolean {
    const m = rawMessage.toLowerCase().trim();
    if (m.length === 0) return false;
    return CLEAR_CART_PATTERNS.some((p) => p.test(m));
  }
  
  /** Test set used by the smoke harness. */
  export const CLEAR_CART_TEST_CASES: Array<{ msg: string; expected: boolean }> = [
    // SHOULD match
    { msg: 'Ok clear it', expected: true },
    { msg: 'clear it', expected: true },
    { msg: 'clear everything', expected: true },
    { msg: 'clear my cart', expected: true },
    { msg: 'empty it', expected: true },
    { msg: 'empty the cart', expected: true },
    { msg: 'remove everything', expected: true },
    { msg: 'remove all items', expected: true },
    { msg: 'cancel this order', expected: true },
    { msg: 'cancel my order', expected: true },
    { msg: 'cancel everything', expected: true },
    { msg: "let's start over", expected: true },
    { msg: 'start fresh', expected: true },
    { msg: 'start over', expected: true },
    { msg: 'reset my cart', expected: true },
    { msg: 'scrap it', expected: true },
  
    // SHOULD NOT match — too ambiguous or different intent
    { msg: 'cancel', expected: false },
    { msg: 'remove the akwasi shito', expected: false },
    { msg: 'change my address', expected: false },
    { msg: 'clear', expected: false },
    { msg: 'forget about it', expected: false },
  ];