/**
 * Fact packet — the strict contract between deterministic handlers and
 * the Gemini reply composer.
 *
 * Philosophy:
 *   - Handlers compute facts from the database/state machine.
 *   - Composer phrases the reply naturally given those facts.
 *   - Composer NEVER invents facts. Validator enforces this.
 *
 * Allowed actions:
 *   'speak_only'     — composer phrases a reply, no side effects
 *   'speak_and_route' — composer phrases reply, deterministic state
 *                       transition has already happened
 *
 * NEVER allowed for composer:
 *   - Mutating cart
 *   - Creating checkout
 *   - Calculating totals
 *   - Approving refund/cancel
 *   - Confirming payment
 *   - Inventing prices, stock, variant names, delivery fees
 */

export type FactPacketIntent =
  | 'ask_price'
  | 'ask_stock'
  | 'ask_variants'
  | 'product_not_found'
  | 'greeting'
  | 'unknown_message';

export type FactPacket = {
  intent: FactPacketIntent;
  allowedAction: 'speak_only' | 'speak_and_route';
  facts: PacketFacts;
  nextStep: string;            // human-readable hint, e.g. "ask if they want to add to cart"
  forbiddenClaims: string[];   // explicit "never say X"
  toneHints?: string[];        // ["proactive", "Ghanaian English", "brief"]
};

export type PacketFacts = {
  // Product facts
  productName?: string;
  price?: number;
  currency?: string;
  inStock?: boolean;
  stockQty?: number | null;
  // Variant facts
  variants?: Array<{
    name: string;
    price?: number;
    inStock?: boolean;
  }>;
  totalVariants?: number;
  variantPriceSpread?: 'all_same' | 'mixed' | 'none';
  // Search miss facts
  customerQuery?: string;
  catalogSummary?: string;
  suggestedProducts?: Array<{ name: string; price?: number }>;
  // Greeting facts
  storeName?: string;
  customerName?: string;
  isReturningCustomer?: boolean;
};

/**
 * Numbers that the composer is ALLOWED to mention. The validator uses
 * this to detect hallucinated prices/quantities. Any number in the
 * reply text that is NOT in this set causes the composer reply to be
 * rejected (we fall back to the deterministic reply).
 */
export function allowedNumbers(packet: FactPacket): Set<number> {
  const allowed = new Set<number>();

  const f = packet.facts;
  if (typeof f.price === 'number') allowed.add(f.price);
  if (typeof f.stockQty === 'number' && f.stockQty != null) allowed.add(f.stockQty);
  if (typeof f.totalVariants === 'number') allowed.add(f.totalVariants);

  if (Array.isArray(f.variants)) {
    for (const v of f.variants) {
      if (typeof v.price === 'number') allowed.add(v.price);
    }
  }
  if (Array.isArray(f.suggestedProducts)) {
    for (const sp of f.suggestedProducts) {
      if (typeof sp.price === 'number') allowed.add(sp.price);
    }
  }

  // Always allow these — they're either count signals or universal numbers.
  allowed.add(0);
  allowed.add(1);
  allowed.add(2);
  allowed.add(3);

  return allowed;
}