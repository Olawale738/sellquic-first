/**
 * Detects when a reply has lost conversational context — generic
 * greeting-style ("how can I help?", "what are you looking for?") or
 * a confirmation stall ("let me confirm before...") when the customer
 * just provided real information.
 *
 * Used by the universal re-anchor in the orchestrator: when this
 * returns true AND the conversation has a focus product or established
 * slot, the reply is replaced with the state contract's reAnchor text.
 *
 * This is the safety net that prevents state amnesia from ever
 * reaching the customer.
 */
export function replyHasLostContext(reply: string | null | undefined): boolean {
    if (!reply) return true;
    const text = reply.toLowerCase().trim();
    if (text.length === 0) return true;
  
    // Generic "ready to help" / "how can I help" patterns — these indicate
    // the bot reset to greeting territory.
    if (/i\s+am\s+(here\s+to\s+help|happy\s+to\s+help|ready\s+to\s+assist)/i.test(text)) return true;
    if (/how\s+(can\s+i|may\s+i)\s+(help|assist|be\s+of\s+service)/i.test(text)) return true;
  
    // "What are you looking for / what can I help you find" patterns.
    if (/what\s+(can\s+i\s+help|exactly\s+are\s+you\s+looking\s+for|are\s+you\s+looking\s+for|would\s+you\s+like\s+to\s+(buy|order|find|shop)|item\s+are\s+you\s+looking)/i.test(text)) return true;
    if (/please.{0,10}what\s+(would|can|may|are)\s+you/i.test(text)) return true;
  
    // "Let me confirm before creating checkout" stall — fires when slot
    // capture failed silently and the bot is asking customer to repeat.
    if (/let\s+me\s+confirm.*(before|properly).*?(creating|create|checkout)/i.test(text)) return true;
    if (/please\s+let\s+me\s+confirm\s+the\s+order\s+details/i.test(text)) return true;
  
    return false;
  }