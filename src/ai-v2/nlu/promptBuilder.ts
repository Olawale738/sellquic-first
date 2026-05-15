import type { TurnContext } from '../types';

/**
 * Builds the prompt sent to Gemini for NLU classification.
 *
 * Goals:
 *  - Give Gemini just enough context to classify intent + extract slots
 *  - Keep prompt short to control cost (target ~1500 input tokens)
 *  - NEVER hand Gemini commerce truth (price/stock/checkout) — only context
 */
export function buildNluPrompt(ctx: TurnContext): string {
  const message = String(ctx.message || '').trim();
  const state = ctx.commerceState.state;

  // Cart summary — count + last item, no prices
  const cart = Array.isArray(ctx.currentCart) ? ctx.currentCart : [];
  const cartSummary =
    cart.length === 0
      ? 'empty'
      : cart.length === 1
        ? `1 item (${cart[0]?.nameSnapshot || 'unknown'})`
        : `${cart.length} items`;

  // Pending product (if AWAITING_VARIANT or AWAITING_QUANTITY)
  const pendingId =
    ctx.commerceState.pendingProductId ||
    ctx.commerceState.lastMentionedProductId ||
    null;
  const pendingProduct = pendingId
    ? ctx.products.find((p) => p.id === pendingId)
    : null;
  const pendingProductLine = pendingProduct
    ? `Pending product: ${pendingProduct.name}${
        pendingProduct.hasVariants
          ? ` (variants: ${pendingProduct.variants?.map((v) => v.name).slice(0, 6).join(', ') || 'none'})`
          : ''
      }`
    : 'Pending product: none';

  // Delivery zones — names only, max 8
  const zones = Array.isArray(ctx.deliveries) ? ctx.deliveries : [];
  const zoneList =
    zones.length === 0
      ? 'none configured'
      : zones
          .slice(0, 8)
          .map((z: any) => z.label || z.name)
          .filter(Boolean)
          .join(', ');

  // Catalog hint — first 8 product names only (full list would blow the prompt)
  const products = Array.isArray(ctx.products) ? ctx.products : [];
  const catalogHint = products
    .slice(0, 8)
    .map((p) => p.name)
    .filter(Boolean)
    .join(', ');

  // Last 3 messages for context (if available)
  const history = Array.isArray(ctx.recentMessages)
    ? ctx.recentMessages.slice(-3)
    : [];
  const historyBlock =
    history.length > 0
      ? history
          .map(
            (m) =>
              `${m.role === 'user' ? 'Customer' : 'Bot'}: ${String(m.content || '').slice(0, 200)}`,
          )
          .join('\n')
      : '(start of conversation)';

  const customerName = ctx.customer?.memory?.name || 'unknown';

  return `You are an NLU classifier for a Ghanaian shopping bot. Classify the customer's latest message into one structured intent + slots. You do not write replies. You do not decide product/price/stock/order facts. You only label what the customer is doing.

CONTEXT
=======
Conversation state: ${state}
Cart: ${cartSummary}
${pendingProductLine}
Delivery zones available: ${zoneList}
Catalog sample: ${catalogHint}
Customer name: ${customerName}

RECENT TURNS
============
${historyBlock}

LATEST CUSTOMER MESSAGE
=======================
"${message}"

CLASSIFICATION RULES
====================
1. Pick ONE primaryIntent from the schema's allowed values. Use "meta_unknown" only if nothing else fits.
2. Set stateAction:
   - "continue_current_state" if the message fills the slot the bot just asked for (e.g. customer in AWAITING_PHONE sends a phone number)
   - "interrupt" if the customer is asking something new mid-flow (price question, product query, "where is delivery to X")
   - "exit_state" if the customer is abandoning or changing their mind ("never mind", "actually cancel")
3. Extract only slots that the customer explicitly mentioned. Don't invent.
4. For productQuery / variantQuery / address / supportIssue, use the customer's own wording verbatim — don't normalize or correct.
5. quantity must be the actual integer the customer said. "3" → 3. "a few" → don't fill. "many" → don't fill.
6. If the message has TWO intents (e.g. "how much is delivery + give me 2"), put the dominant one in primaryIntent and the other in secondaryIntent.
7. Confidence "low" is FINE — use it when the message is genuinely ambiguous, off-topic, or you're guessing. Better to say low than guess high.
8. Reason: ONE short sentence. No essays.

GHANAIAN LANGUAGE NOTES
=======================
- Customers may mix English with Pidgin or Twi. "I dey want", "give me", "i go take" all mean "i want".
- "Charley", "boss", "sis", "bro" are friendly fillers — ignore.
- "Please" / "pls" used as softener everywhere — ignore.
- Phone numbers may have spaces, dashes, or +233 prefix.

Return ONLY the JSON object matching the schema. No prose, no markdown.`;
}