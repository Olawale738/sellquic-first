/**
 * Extract ordinal/numeric selection from messages like:
 * - first one
 * - 1
 * - number 2
 * - second
 * - the 3rd one
 *
 * Returns zero-based index.
 */

const ORDINAL_WORDS: Record<string, number> = {
  first: 0,
  second: 1,
  third: 2,
  fourth: 3,
  fifth: 4,
  sixth: 5,
};

const NUMBER_WORDS: Record<string, number> = {
  one: 0,
  two: 1,
  three: 2,
  four: 3,
  five: 4,
  six: 5,
};

export function extractOrdinalSelection(text: string): number | null {
  const raw = String(text || '').toLowerCase().trim();

  if (!raw) return null;

  // 1. Prefer explicit ordinals first: "second", "third", etc.
  for (const [word, index] of Object.entries(ORDINAL_WORDS)) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(raw)) {
      return index;
    }
  }

  // 2. Match numeric selections like "number 2", "option 2", "2nd", "2"
  const explicitNumberMatch = raw.match(
    /\b(?:number|no\.?|option|item)?\s*(\d{1,2})(?:st|nd|rd|th)?\b/i
  );

  if (explicitNumberMatch) {
    const value = Number(explicitNumberMatch[1]);

    if (Number.isFinite(value) && value > 0) {
      return value - 1;
    }
  }

  // 3. Only use number words if the message looks like a selection.
  // This prevents "second one" being captured as "one".
  const looksLikeSelection =
    /\b(the|option|number|item|one)\b/i.test(raw) || raw.split(/\s+/).length <= 3;

  if (looksLikeSelection) {
    for (const [word, index] of Object.entries(NUMBER_WORDS)) {
      if (new RegExp(`\\b${word}\\b`, 'i').test(raw)) {
        return index;
      }
    }
  }

  return null;
}