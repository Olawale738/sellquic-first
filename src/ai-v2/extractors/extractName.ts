/**
 * Extract a safe customer name from a message.
 *
 * Conservative on purpose:
 * - Do not save "yes", "ok", "same" as names.
 * - Avoid Unicode property regex so it works with older TS targets.
 */

const BAD_NAME_REPLIES = new Set([
  'yes',
  'yeah',
  'yep',
  'ok',
  'okay',
  'alright',
  'sure',
  'please',
  'pls',
  'same',
  'use same',
  'no',
  'nope',
]);

export function extractName(text: string): string | null {
  const raw = String(text || '').trim();

  if (!raw) return null;

  const lowered = raw.toLowerCase();

  if (BAD_NAME_REPLIES.has(lowered)) return null;

  const cleaned = raw
    .replace(/\b(my name is|name is|i am|i'm|im|call me|use)\b/gi, ' ')
    .replace(/[^a-zA-Z\s.'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return null;

  const words = cleaned.split(' ').filter(Boolean);

  if (words.length < 1 || words.length > 5) return null;

  const hasLetter = /[a-zA-Z]/.test(cleaned);
  if (!hasLetter) return null;

  return words
    .map((word) => {
      const lower = word.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}