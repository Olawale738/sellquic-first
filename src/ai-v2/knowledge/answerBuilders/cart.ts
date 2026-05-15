import type {
    InformationReply,
    KnowledgeDeliveryZone,
    KnowledgeTurnContext,
    StoreKnowledge,
  } from '../types';
  import { buildResumePrompt } from '../../presentation/buildResumePrompt';
  import { formatMoney } from './product';
  
  /**
   * q_cart_total — builds a deterministic cart breakdown from cart + delivery.
   *
   * Never calls an LLM. Never creates checkout. If cart is non-empty and the
   * customer is at READY_FOR_CHECKOUT, the resume prompt is the checkout
   * confirmation prompt. Otherwise the resume prompt is whatever the current
   * state needs.
   *
   * Format (multi-line):
   *
   *     Your total is GHS 480.00 please:
   *     - Ghanaman shito x2 — GHS 2.00
   *     - Accra spice co shito x2 — GHS 398.00
   *     - Delivery (East legon): GHS 80.00
   */
  export function buildCartTotalAnswer(
    ctx: KnowledgeTurnContext,
    knowledge: StoreKnowledge,
  ): InformationReply {
    const lines = ctx.cart.lines;
  
    if (lines.length === 0) {
      return {
        answerText: 'Your cart is empty please.',
        answerSource: 'cart',
        resume: { kind: 'none' },
        diagnostics: { referentKind: 'cart' },
      };
    }
  
    const currency = inferCurrency(ctx, knowledge);
    const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  
    const zone = currentZone(ctx, knowledge);
    const deliveryFee = zone ? zone.fee : 0;
    const total = subtotal + deliveryFee;
  
    const breakdown: string[] = [];
    for (const l of lines) {
      breakdown.push(
        `- ${l.productName} x${l.quantity} — ${formatMoney(l.unitPrice * l.quantity, currency)}`,
      );
    }
    if (zone) {
      breakdown.push(`- Delivery (${zone.name}): ${formatMoney(zone.fee, zone.currency)}`);
    }
  
    const header = zone
      ? `Your total is ${formatMoney(total, currency)} please:`
      : `Your subtotal is ${formatMoney(subtotal, currency)} please (delivery not selected yet):`;
  
    const answerText = [header, ...breakdown].join('\n');
  
    // Source tag is composite. Validator can split on '+' if it wants to assert
    // each piece corresponds to real data.
    const answerSource = zone
      ? `cart+delivery.zones[${zone.id}]`
      : 'cart';
  
    return {
      answerText,
      answerSource,
      resume: pickResume(ctx, zone),
      diagnostics: { referentKind: 'cart' },
    };
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // helpers
  // ─────────────────────────────────────────────────────────────────────────────
  
  function currentZone(
    ctx: KnowledgeTurnContext,
    knowledge: StoreKnowledge,
  ): KnowledgeDeliveryZone | null {
    const id = ctx.orderSession.selectedDeliveryZoneId ?? null;
    if (!id) return null;
    return knowledge.delivery.zones.find((z) => z.id === id) ?? null;
  }
  
  /**
   * Pick a currency for the composite total. Cart lines and delivery zones in
   * the same store should share a currency, but we don't assume — fall back to
   * the first line's currency, then the first zone's, then 'GHS'.
   */
  function inferCurrency(
    ctx: KnowledgeTurnContext,
    knowledge: StoreKnowledge,
  ): string {
    // Cart lines don't carry currency in our type — pick from product catalog.
    const firstLine = ctx.cart.lines[0];
    if (firstLine) {
      const p = ctx.productsById[firstLine.productId];
      if (p) return p.currency;
    }
    const firstZone = knowledge.delivery.zones[0];
    if (firstZone) return firstZone.currency;
    return 'GHS';
  }
  
  /**
   * Resume prompt selection for q_cart_total:
   *
   *   - READY_FOR_CHECKOUT  → ask to create the checkout link
   *                            (cart total is the natural lead-in to that)
   *   - any other state     → resume the canonical state prompt if defined
   *   - IDLE / BROWSING /
   *     CHECKOUT_CREATED /
   *     HANDOVER             → no resume (handled by buildResumePrompt returning null)
   */
  function pickResume(
    ctx: KnowledgeTurnContext,
    zone: KnowledgeDeliveryZone | null,
  ): InformationReply['resume'] {
    // If delivery isn't picked yet, nudge toward picking one rather than
    // toward checkout — pivot, not state-resume.
    if (!zone && ctx.commerceState !== 'IDLE' && ctx.commerceState !== 'BROWSING') {
      return {
        kind: 'pivot',
        prompt: 'Which delivery zone should I use please?',
      };
    }
  
    const prompt = buildResumePrompt(ctx.commerceState);
    if (!prompt) return { kind: 'none' };
    return { kind: 'state_prompt', state: ctx.commerceState, prompt };
  }