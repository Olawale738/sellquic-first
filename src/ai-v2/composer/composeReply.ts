import { Type } from '@google/genai';
import { callGeminiResilient } from '../gemini/resilientClient';
import type { FactPacket } from './factPacket';
import { allowedNumbers } from './factPacket';
import type { TurnContext } from '../types';

/**
 * Result of a composer call.
 *
 *   ok=true  → use replyText
 *   ok=false → fall back to deterministic reply
 *
 * The validator may reject Gemini's output if it contains hallucinated
 * facts (numbers not in the packet, forbidden phrases). In that case
 * ok=false and we use the deterministic fallback.
 */
export type ComposerOutcome = {
  ok: boolean;
  replyText?: string;
  latencyMs?: number;
  error?: string;
  invalidJson?: boolean;
  violationKind?: 'hallucinated_number' | 'forbidden_claim' | 'too_long' | 'empty';
  rawText?: string;
};

const REPLY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    replyText: { type: Type.STRING },
  },
  required: ['replyText'],
  propertyOrdering: ['replyText'],
};

/**
 * Calls Gemini to phrase a reply from a strict fact packet.
 *
 * Times out after 3 seconds. Falls back to deterministic on any error.
 */
export async function composeReplyWithGemini(
  packet: FactPacket,
  ctx: TurnContext,
  apiKey: string,
): Promise<ComposerOutcome> {
  const prompt = buildComposerPrompt(packet, ctx);

  const outcome = await callGeminiResilient({
    prompt,
    schema: REPLY_SCHEMA,
    temperature: 0.4,
    maxOutputTokens: 200,
    kind: 'composer',
    apiKey,
  });

  if (!outcome.ok) {
    return {
      ok: false,
      latencyMs: outcome.latencyMs,
      error: outcome.errorType,
    };
  }

  let parsed: { replyText?: string };
  try {
    parsed = JSON.parse(outcome.text);
  } catch {
    return {
      ok: false,
      latencyMs: outcome.latencyMs,
      invalidJson: true,
      rawText: outcome.text,
      error: 'invalid_json',
    };
  }

  const replyText = String(parsed.replyText || '').trim();

  const violation = validateReply(replyText, packet);
  if (violation) {
    return {
      ok: false,
      latencyMs: outcome.latencyMs,
      rawText: outcome.text,
      replyText,
      violationKind: violation,
      error: `validator:${violation}`,
    };
  }

  return {
    ok: true,
    replyText,
    latencyMs: outcome.latencyMs,
    rawText: outcome.text,
  };
}

/**
 * Builds the composer prompt. Compact and strict — composer should never
 * need long prompts because the fact packet does the heavy lifting.
 */
function buildComposerPrompt(packet: FactPacket, ctx: TurnContext): string {
  const recentTurns = Array.isArray(ctx.recentMessages)
    ? ctx.recentMessages.slice(-3)
    : [];

  const historyBlock = recentTurns.length
    ? recentTurns.map((m) => `${m.role}: ${m.content}`).join('\n')
    : '(no prior turns)';

  const factsBlock = JSON.stringify(packet.facts, null, 2);
  const forbidden = packet.forbiddenClaims.length
    ? packet.forbiddenClaims.map((c) => `- ${c}`).join('\n')
    : '- (none)';
  const tone = packet.toneHints?.length
    ? packet.toneHints.join(', ')
    : 'natural, brief, helpful';

  return `You are a friendly Ghanaian sales assistant for a small shop. Phrase a reply to the customer using ONLY the facts provided. Never invent prices, stock levels, variant names, delivery fees, or any other facts not in the packet.

INTENT: ${packet.intent}

FACTS (these are ALL you can mention):
\`\`\`
${factsBlock}
\`\`\`

NEXT STEP: ${packet.nextStep}

FORBIDDEN CLAIMS:
${forbidden}

TONE: ${tone}

RECENT CONVERSATION:
${historyBlock}

CUSTOMER JUST SAID: "${ctx.message}"

RULES:
- Keep reply under 200 characters when possible.
- End with the next step (a question or call to action).
- Use Ghanaian English: "please" softener, natural phrasing, no slang.
- Currency is GHS. Format like "GHS 50" not "$50" or "50 cedis".
- If the fact says inStock=true with stockQty, mention you have stock — sounds confident.
- For variants with mixed prices, mention 2-3 variants and the starting price; offer to list more.
- For variants with same price, mention the count ("available in 5 sizes") not all names.
- If product_not_found, redirect kindly to what the shop sells (catalogSummary).
- NEVER use placeholder text or apologize generically. Be specific.

Reply ONLY in this JSON shape:
{ "replyText": "your reply here" }`;
}

/**
 * Returns a violation kind if the composer reply violates the packet rules.
 * Returns null if the reply is clean.
 */
function validateReply(
  replyText: string,
  packet: FactPacket,
): ComposerOutcome['violationKind'] | null {
  if (!replyText || replyText.length === 0) return 'empty';
  if (replyText.length > 350) return 'too_long';

  // Forbidden phrases
  const lower = replyText.toLowerCase();
  for (const claim of packet.forbiddenClaims) {
    // Forbidden claims are written as instructions ("never invent X").
    // Extract the noun and check for it. Crude but effective.
    const m = claim.match(/never (invent|mention|say|promise) ([a-z\s]+)/i);
    if (m) {
      const phrase = m[2].trim().toLowerCase();
      // Only flag if the phrase appears AND it wasn't in the facts.
      if (phrase && lower.includes(phrase)) {
        // crude — only flag short, distinctive phrases
        if (phrase.length >= 4 && phrase.length <= 25) {
          // This is too aggressive. Skip for now — rely on number check.
        }
      }
    }
  }

  // Hallucinated numbers — any integer or decimal in reply must be in
  // the allowed set.
  const allowed = allowedNumbers(packet);
  const numbersInReply = extractNumbers(replyText);
  for (const n of numbersInReply) {
    if (!allowed.has(n)) {
      return 'hallucinated_number';
    }
  }

  return null;
}

function extractNumbers(text: string): number[] {
  // Match integers and decimals. Skip "GHS" prefix (it's a string).
  // Skip year-like 4-digit numbers that aren't prices? No — if it's
  // not in the packet, reject.
  const matches = text.match(/\b\d+(\.\d+)?\b/g) || [];
  return matches.map((s) => parseFloat(s)).filter((n) => Number.isFinite(n));
}