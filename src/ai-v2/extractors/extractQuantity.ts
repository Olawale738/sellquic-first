/**
 * @fileOverview Extractor to pull numeric quantities from user messages.
 *
 * Important:
 * - Unknown quantity must return null, not 1.
 * - We do not assume quantity 1 in ecommerce.
 */

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  dozen: 12,
};

export function extractQuantity(text: string): number | null {
  const raw = String(text || '').trim();
  if (!raw) return null;

  const lower = raw.toLowerCase();

  // Reject common non-quantity replies.
  if (/^(yes|yeah|yep|ok|okay|alright|sure|please|pls|no|nope)$/i.test(lower)) {
    return null;
  }

  // Match number words.
  for (const [word, value] of Object.entries(NUMBER_WORDS)) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(lower)) {
      return value;
    }
  }

  // Match digits: "2", "x2", "2 pieces", "qty 3"
  const digitMatch = lower.match(/\b(?:x|qty|quantity)?\s*(\d{1,3})\b/i);
  if (!digitMatch) return null;

  const quantity = Number(digitMatch[1]);

  if (!Number.isFinite(quantity)) return null;
  if (quantity <= 0) return null;

  // Safety cap for now.
  return Math.min(quantity, 99);
}