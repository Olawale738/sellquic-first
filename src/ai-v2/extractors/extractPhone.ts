/**
 * Extract a valid Ghana phone number from text.
 *
 * Accepts:
 * - 0597788056
 * - 0241234567
 * - 233597788056
 * - +233597788056
 * - 059 778 8056
 *
 * Rejects:
 * - 020959874       // too short
 * - 0123456789      // invalid Ghana mobile prefix
 *
 * Returns canonical local format: 10 digits starting with 0.
 * Never pads. Never guesses. Never returns partial matches.
 */
export function extractPhone(text: string): string | null {
  if (!text) return null;

  const raw = String(text).trim();

  // Remove common separators only. Keep + for +233 handling.
  const cleaned = raw.replace(/[\s\-().]/g, '');

  if (!cleaned) return null;

  let candidate = cleaned;

  // +233597788056 -> 233597788056
  if (candidate.startsWith('+233')) {
    candidate = candidate.slice(1);
  }

  // 233597788056 -> 0597788056
  if (/^233[25]\d{8}$/.test(candidate)) {
    return `0${candidate.slice(3)}`;
  }

  // Ghana local mobile number: exactly 10 digits, starts 02x or 05x
  if (/^0[25]\d{8}$/.test(candidate)) {
    return candidate;
  }

  return null;
}