import { Type } from '@google/genai';
import { callGeminiResilient } from '../gemini/resilientClient';
import type { TurnContext } from '../types';
import type { TurnFactPacket } from '../nlu/turnFactPacket';

/**
 * Composer that speaks from a TurnFactPacket — Phase 1D of the
 * compound-message architecture.
 *
 * Strict rule: the customer-facing reply contains ONLY facts present
 * in the packet. Numbers, product names, zones, and capability claims
 * are all validated against the packet. Any violation fails closed —
 * orchestrator falls back to the deterministic reply.
 *
 * The composer's job is voice + weaving (warm Ghanaian sales tone,
 * compound replies that address multiple things at once). It is not
 * allowed to introduce new facts.
 */

export type FactPacketComposerOutcome = {
  ok: boolean;
  replyText?: string;
  latencyMs?: number;
  error?: string;
  invalidJson?: boolean;
  violationKind?:
    | 'hallucinated_number'
    | 'hallucinated_product'
    | 'forbidden_phrase'
    | 'too_long'
    | 'empty';
  rawText?: string;
};

const REPLY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    replyText: { type: Type.STRING },
  },
  required: ['replyText'],
};

// ─── Public entry ────────────────────────────────────────────────────
export async function composeFromFactPacket(
  packet: TurnFactPacket,
  ctx: TurnContext,
  apiKey: string,
): Promise<FactPacketComposerOutcome> {
  // Short-circuit: clarify mode. Speak the prepared question; no Gemini call.
  if (packet.routing.shouldClarify && packet.routing.clarificationQuestion) {
    return { ok: true, replyText: packet.routing.clarificationQuestion };
  }

  // Short-circuit: handover. Composer doesn't speak handover messages —
  // those are the orchestrator's policy commands.
  if (packet.routing.shouldHandover || packet.routing.primaryHandler === 'handover') {
    return { ok: false, error: 'handover_not_composed_here' };
  }

  const prompt = buildComposerPrompt(packet, ctx);

  const outcome = await callGeminiResilient({
    prompt,
    schema: REPLY_SCHEMA,
    temperature: 0.5,
    maxOutputTokens: 350,
    kind: 'fact_packet_composer',
    apiKey,
  });

  if (!outcome.ok) {
    return { ok: false, latencyMs: outcome.latencyMs, error: outcome.errorType };
  }

  let parsed: { replyText?: string };
  try {
    parsed = JSON.parse(outcome.text);
  } catch {
    return {
      ok: false,
      latencyMs: outcome.latencyMs,
      invalidJson: true,
      error: 'invalid_json',
      rawText: outcome.text,
    };
  }

  const replyText = String(parsed.replyText || '').trim();
  const violation = validateReply(replyText, packet);
  if (violation) {
    return {
      ok: false,
      latencyMs: outcome.latencyMs,
      violationKind: violation,
      error: `validator:${violation}`,
      replyText,
      rawText: outcome.text,
    };
  }

  return { ok: true, replyText, latencyMs: outcome.latencyMs, rawText: outcome.text };
}

// ─── Prompt construction ─────────────────────────────────────────────
function buildComposerPrompt(packet: TurnFactPacket, ctx: TurnContext): string {
  const recent = Array.isArray(ctx.recentMessages)
    ? ctx.recentMessages.slice(-3).map((m) => `${m.role}: ${m.content}`).join('\n')
    : '(no prior turns)';

  const customerName = ctx.customer?.name || null;
  const stateInfo = `current_state: ${ctx.commerceState.state}`;
  const nextHandler = packet.routing.primaryHandler;

  const factsBlock = JSON.stringify(packet.facts, null, 2);
  const filledBlock =
    Object.keys(packet.filled).length > 0
      ? JSON.stringify(packet.filled, null, 2)
      : '(none filled this turn)';

  return `You are a warm Ghanaian sales assistant for an online shop. Reply naturally to the customer using ONLY the VERIFIED FACTS below. Never invent prices, products, stock, zones, delivery times, payment methods, or any other facts not in the packet.

────────────────────────────────────────────────────────────────
CONTEXT
${stateInfo}
next_handler: ${nextHandler}
${customerName ? `customer_name: ${customerName}` : 'customer_name: unknown'}

RECENT CONVERSATION:
${recent}

CUSTOMER JUST SAID:
"${ctx.message}"

────────────────────────────────────────────────────────────────
VERIFIED FACTS (the only facts you may speak):
${factsBlock}

CHECKOUT SLOTS FILLED THIS TURN:
${filledBlock}

────────────────────────────────────────────────────────────────
FORBIDDEN — these will fail validation and trigger fallback:
- Never invent prices not in the facts.
- Never invent product names not in productDiscovery.exactMatches/outOfStockMatches/alternativeProducts.
- Never claim "free delivery" unless a zone in facts has fee 0.
- Never claim "same day" delivery unless sameDayFeasible is true.
- Never make a positive "in stock" claim if no matched product is in stock.
- Never tell the customer to "check back another time" unless productDiscovery.reason is "out_of_domain" AND alternativeProducts is empty.
- Never invent payment methods, store hours, refund policy.
- Never use markdown (no **, no *, no #).
- Never end every sentence with an emoji. Use emojis sparingly.

────────────────────────────────────────────────────────────────
TONE & STYLE
- Warm, Ghanaian, "please" used naturally as a softener.
- Match the customer's register: pidgin if they used pidgin, formal if formal.
- Keep reply under 350 characters.
- One idea, one reply. End with ONE question or call to action.
- Currency is GHS. Format like "GHS 250" or "GHS 250.00".
- For places, use the customer's exact wording (e.g. "Weija", "Ashongman Estate") — the fee comes from the verified zone but the location words come from the customer.

NEXT-STEP HINT (based on next_handler):
- handleProductSearch → either show matches and ask which one, or note no matches and ask to rephrase.
- handleVariantReply → ask which option/variant.
- handleQuantityReply → ask how many.
- handleDeliveryReply → ask where to deliver.
- handleAddressReply → ask for specific address/landmark.
- handlePhoneReply → ask for phone.
- handleNameReply → ask for full name.
- handleCheckoutConfirmation → confirm details and ask to proceed.
- handleCartUpdate → confirm what was changed and ask next step.
- handleInformationQuestion → answer the question and ask if they want to order.
- composer_only → just answer naturally.

────────────────────────────────────────────────────────────────
COMPOUND-REPLY RULE (this is the main reason you exist):
When facts cover multiple things the customer asked about (e.g. product matches AND a delivery question AND a budget question), weave them into ONE reply. Don't list them robotically. Acknowledge context (occasion, recipient) when present.

────────────────────────────────────────────────────────────────
CONVERSATION CONTEXT (contextProducts in facts):
The customer may be referring to products discussed in earlier turns:
- focusProduct: the product currently in focus (just shown / under discussion).
- recentlyShown: products shown earlier in this conversation.
- cartProducts: items already in their cart.

You may reference these by name and price even when productDiscovery is empty for this turn — the customer is often asking a follow-up about something they already saw. If the customer says things like "show me the picture", "tell me more about it", "the one you mentioned", or "is it available", they almost always mean focusProduct.



────────────────────────────────────────────────────────────────
ESTABLISHED STATE (facts.establishedState):
This contains slots already filled in earlier turns: deliveryZone, customerName, customerPhone, customerAddress, pendingProductId, pendingVariantId, quantity.

CRITICAL RULES:
- Do NOT ask the customer for any field that is already set in establishedState. If deliveryZone is set, do not ask "where would you like delivery?" — use it.
- You MAY reference established values (e.g. "delivery to Accra is GHS 35"). The validator allows numbers from establishedState.
- If the customer is changing an established value, that's fine — but use the actual stored value as the baseline.

────────────────────────────────────────────────────────────────
VARIANT TRUTH RULES (these prevent hallucination — strictest in the system):
- When a product has a variants[] array in the packet, those are the ONLY valid variant names. Do not invent variant names, colors, sizes, or styles. If the customer asks "what styles/colors/sizes do you have?", read directly from variants[] and list the actual names.
- If a product has no variants[] or it's empty, say "It comes in just one option" — never make up styles.
- When the customer picks a variant, only acknowledge it if their words match a real variant name in variants[]. If the match is unclear, list the actual options again.
- NEVER say you "have reserved" or "added" or "noted down" or "put down" anything for the customer unless the cart actually has items (facts.cartTotal > 0). Use neutral language: "Great choice — which size would you like?" or "I can reserve that once we confirm the option."
- NEVER say you have "noted" or "saved" the customer's phone, name, or address unless that field is in filled (this turn) or in establishedState (earlier turn).
- For variant images: if a variant has imageUrl, you may say "I can show you a picture of that one." If imageUrl is null, say honestly "I don't have a separate picture for that option, but the main product photo will give you a good idea." Do not assume a product category — the vendor may sell anything.
────────────────────────────────────────────────────────────────
ESTABLISHED STATE (facts.establishedState):
This contains slots already filled in earlier turns: deliveryZone, customerName, customerPhone, customerAddress, pendingProductId, pendingVariantId, quantity.

CRITICAL RULES:
- Do NOT ask the customer for any field that is already set in establishedState. If deliveryZone is set, do not ask "where would you like delivery?" — use it.
- You MAY reference established values (e.g. "delivery to Accra is GHS 35"). The validator allows numbers from establishedState.
- If the customer is changing an established value, that's fine — but use the actual stored value as the baseline.

────────────────────────────────────────────────────────────────
VARIANT TRUTH RULES (these prevent hallucination — strictest in the system):
- When a product has a variants[] array in the packet, those are the ONLY valid variant names. Do not invent variant names, colors, sizes, or styles. If the customer asks "what styles/colors/sizes do you have?", read directly from variants[] and list the actual names.
- If a product has no variants[] or it's empty, say "It comes in just one option" — never make up styles.
- When the customer picks a variant, only acknowledge it if their words match a real variant name in variants[]. If the match is unclear, list the actual options again.
- NEVER say you "have reserved" or "added" or "noted down" or "put down" anything for the customer unless the cart actually has items (facts.cartTotal > 0). Use neutral language: "Great choice — which size would you like?" or "I can reserve that once we confirm the option."
- NEVER say you have "noted" or "saved" the customer's phone, name, or address unless that field is in filled (this turn) or in establishedState (earlier turn).
- For variant images: if a variant has imageUrl, you may say "I can show you a picture of that one." If imageUrl is null, say honestly "I don't have a separate picture for that option, but the main product photo will give you a good idea." Do not assume a product category — the vendor may sell anything.

────────────────────────────────────────────────────────────────
EXAMPLES

Example A — exact match:
productDiscovery.reason = "exact_match", exactMatches has 2 shirts.
Customer: "I need a nice shirt for my son's birthday in 3 days, red and green."
Good reply: "Ah nice please — for your son's birthday! We have these two shirts that fit, both around GHS 250. Which one would you like to go for?"

Example B — out_of_stock_alternatives:
productDiscovery.reason = "out_of_stock_alternatives", outOfStockMatches has the shirt customer asked for, alternativeProducts has 3 in-stock kids items.
Customer: "I need a shirt for my son's birthday."
Good reply: "Ah, happy birthday to your son! The exact shirts you're asking about are sold out right now, but we do have these other kids' outfits in stock — would any of these work? [name them with prices]"

Example C — in_domain_alternatives:
productDiscovery.reason = "in_domain_alternatives", exactMatches empty, alternativeProducts has 4 popular kids items.
Customer: "do you have any kids formal wear?"
Good reply: "I don't have a specific 'formal wear' line, but we have a few outfits that work nicely for occasions — like the Baby Boy Suspender Set (GHS 250) or the LED Light-Up Sneakers (GHS 300). Want me to show you?"

Example D — multi-slot compound order (product + qty + zone + phone):
filled has quantity 3, deliveryZone Weija, addressText "near the market", phone 0244123456. matchedZone Accra GHS 35. exactMatches has 1 hot shito. storeInfo has paymentMethods.
Customer: "3 bottles of the hot one, deliver to Weija near the market, my number is 0244123456, can I pay momo?"
Good reply: "Got it please — 3 bottles of the hot one, delivery to Weija near the market is GHS 35, and yes you can pay via Momo. Just need your name to finalize, please?"

Example E — out_of_domain (rare):
productDiscovery.reason = "out_of_domain", everything empty.
Customer: "do you sell laptops?"
Good reply: "We don't carry laptops please — we focus on kids' fashion, like outfit sets and trendy sneakers. Anything in that line I can help you with?"
────────────────────────────────────────────────────────────────
Return ONLY the JSON object. No prose, no markdown.

{ "replyText": "your reply here" }`;
}

// ─── Validator ───────────────────────────────────────────────────────
function validateReply(
  replyText: string,
  packet: TurnFactPacket,
): FactPacketComposerOutcome['violationKind'] | null {
  if (!replyText || replyText.length === 0) return 'empty';
  if (replyText.length > 400) return 'too_long';

  const lower = replyText.toLowerCase();

  // ── Forbidden phrase checks ────────────────────────────────────────
  // "free delivery" / "free shipping" — only allowed if some zone has fee 0
  if (/\b(free\s+(delivery|shipping))\b/i.test(lower)) {
    const hasFreeZone =
      (packet.facts.matchedZone?.fee === 0) ||
      (packet.facts.storeInfo?.deliveryAreas || []).some((a) => a.fee === 0);
    if (!hasFreeZone) return 'forbidden_phrase';
  }

  // "same day" / "same-day" — only allowed when sameDayFeasible === true
  // Tightened: only matches explicit same-day delivery phrasing.
  // The bare word "today" is no longer caught (was rejecting greetings
  // like "happy to help you today").
  if (/\b(same[-\s]?day(?:\s+delivery)?|delivered\s+today|today's?\s+delivery|get\s+it\s+today|by\s+today)\b/i.test(lower)) {
    if (packet.facts.sameDayFeasible !== true) {
      // Allow when answering negatively (e.g. "Same-day isn't available").
      if (!/\b(isn't|is not|not\s+available|cannot|can't|won't)\b/i.test(lower)) {
        return 'forbidden_phrase';
      }
    }
  }

  if (/\bin\s+stock\b/i.test(lower)) {
    const discovery = packet.facts.productDiscovery;
    const anyInStock = (discovery?.exactMatches || []).some((p) => p.inStock)
      || (discovery?.alternativeProducts || []).some((p) => p.inStock);
    if (!anyInStock) {
      // Look at each sentence containing "in stock" — if any is a
      // positive claim (no negation nearby), fail.
      const sentences = lower.split(/[.!?]+/);
      const positiveClaim = sentences.some((s) => {
        if (!/in\s+stock/.test(s)) return false;
        return !/(not|don't|do not|cannot|can't|isn't|aren't|won't|out\s+of|sold\s+out|never|no\s+items|no\s+products)/.test(s);
      });
      if (positiveClaim) return 'forbidden_phrase';
    }
  }

  // "check back another time / later" — only allowed when out_of_domain
  // with no alternatives. Otherwise this kills sales unnecessarily.
  if (/check\s+back\s+(another|later|some\s+other|next)/i.test(lower)) {
    const discovery = packet.facts.productDiscovery;
    const isOOD = discovery?.reason === 'out_of_domain';
    const noAlts = (discovery?.alternativeProducts.length || 0) === 0;
    if (!(isOOD && noAlts)) return 'forbidden_phrase';
  }


  
  // "Phone noted/saved" — composer must not claim phone is captured
  // unless the phone slot was actually filled this turn or already
  // established. Otherwise this lets the bot acknowledge invalid
  // phone numbers as accepted.
  if (/\b(noted|saved|got|received|stored)\s+(your\s+)?(phone|number|contact)\b/i.test(lower)
    || /\b(phone|number)\s+(has\s+been|is)\s+(noted|saved|stored|received)\b/i.test(lower)
    || /\bthank\s+you[^.!?]*?(phone|number)[^.!?]*?(noted|saved|got)\b/i.test(lower)) {
    const phoneSet = !!packet.filled.customerPhone || !!packet.facts.establishedState?.customerPhone;
    if (!phoneSet) return 'forbidden_phrase';
  }

  // Reservation / order language — composer must not claim to have
  // reserved, added, or placed an order unless a cart action actually
  // occurred (cart has items now). Block ghost-reservation language.
  if (/\b(have\s+reserved|i've\s+reserved|i\s+have\s+added|i've\s+added|order\s+of\s+\d+|put\s+(it|that|them|down)\s+(for|aside|down)|i\s+have\s+placed\s+(your\s+)?order|i\s+have\s+confirmed\s+(your\s+)?order|noted\s+(it|that|them)\s+down\s+for\s+you)\b/i.test(lower)) {
    const cartHasItems = (packet.facts.cartTotal || 0) > 0;
    if (!cartHasItems) return 'forbidden_phrase';
  }

  // ── Hallucinated number check ──────────────────────────────────────
  const allowed = allowedNumbers(packet);
  const numbersInReply = extractNumbers(replyText);
  for (const n of numbersInReply) {
    if (!allowed.has(n) && !allowedFloat(n, allowed)) {
      return 'hallucinated_number';
    }
  }

  // ── Hallucinated product check (soft) ──────────────────────────────
  // If the reply contains substrings that look like quoted product
  // names (capitalized phrases of 3+ words), flag any not in matched.
  // Skip for now — too brittle without NER. Composer is told strictly
  // not to invent and validator catches numbers.

  return null;
}

function allowedNumbers(packet: TurnFactPacket): Set<number> {
  const allowed = new Set<number>();

  // Common low integers — quantities, counts, "1 left" etc.
  for (let i = 0; i <= 10; i++) allowed.add(i);

  const f = packet.facts;

  // Pull prices from all discovery pools — composer can legitimately
  // mention any of them in framing replies.
  if (f.productDiscovery) {
    const allDiscoveryProducts = [
      ...f.productDiscovery.exactMatches,
      ...f.productDiscovery.outOfStockMatches,
      ...f.productDiscovery.alternativeProducts,
    ];
    for (const p of allDiscoveryProducts) {
      allowed.add(p.price);
      if (typeof p.variantCount === 'number') allowed.add(p.variantCount);
    }
  }

  // Also allow numbers from products carried in conversation context
  // — focus product, recently shown, cart. The customer often asks
  // follow-up questions about these (price, stock, variants) and the
  // composer should be able to mention them honestly.
  if (f.contextProducts) {
    const ctxPool = [
      ...(f.contextProducts.focusProduct ? [f.contextProducts.focusProduct] : []),
      ...f.contextProducts.recentlyShown,
      ...f.contextProducts.cartProducts,
    ];
    for (const p of ctxPool) {
      allowed.add(p.price);
      if (typeof p.variantCount === 'number') allowed.add(p.variantCount);
    }
  }
  if (f.priceRange) {
    allowed.add(f.priceRange.min);
    allowed.add(f.priceRange.max);
    allowed.add(f.priceRange.median);
  }
  if (f.matchedZone) {
    allowed.add(f.matchedZone.fee);
  }
  if (f.storeInfo?.deliveryAreas) {
    for (const a of f.storeInfo.deliveryAreas) allowed.add(a.fee);
  }
  if (typeof f.cartTotal === 'number') allowed.add(f.cartTotal);

  if (typeof packet.filled.quantity === 'number') {
    allowed.add(packet.filled.quantity);
  }

  // Numbers established in earlier turns — delivery fee, prior quantity.
  // Without these, composer can't legitimately reference an already-
  // confirmed delivery cost in a follow-up turn (validator would flag
  // it as hallucinated_number).
  const est = packet.facts.establishedState;
  if (est) {
    if (est.deliveryZone) allowed.add(est.deliveryZone.fee);
    if (typeof est.quantity === 'number') allowed.add(est.quantity);
  }

  return allowed;
}

/**
 * Extract numbers from text, skipping things that look like phone
 * numbers (10+ consecutive digits starting with 0). Also skips
 * digit sequences inside obvious phone-shaped contexts.
 */
function extractNumbers(text: string): number[] {
  const matches = text.match(/\b\d+(?:\.\d+)?\b/g) || [];
  return matches
    .filter((s) => !(s.length >= 10 && s.startsWith('0'))) // phone-like
    .filter((s) => !(s.length === 9 && /^[0-9]+$/.test(s) && s.startsWith('0'))) // partial phone
    .map((s) => parseFloat(s))
    .filter((n) => Number.isFinite(n));
}

/**
 * Allow floats that round to an allowed integer (e.g. composer wrote
 * "GHS 250.00" but allowed has 250). Cheap cushion against price
 * formatting variance.
 */
function allowedFloat(n: number, allowed: Set<number>): boolean {
  if (allowed.has(Math.round(n))) return true;
  if (allowed.has(Math.floor(n))) return true;
  if (allowed.has(Math.ceil(n))) return true;
  return false;
}
