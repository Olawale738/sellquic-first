import type { LookupOrder } from './resolveOrderLookup';

/**
 * Match a customer's natural-language disambiguation reply against a
 * displayed list of orders.
 *
 * Tries, in priority order:
 *   1. Variant name token ("brown" → matches selectedVariant.name)
 *   2. Product name substring ("coach tote" → matches productName)
 *   3. Month name ("may", "april" → matches createdAt month)
 *   4. Amount ("155" → matches totalAmount)
 *   5. Ordinal ("first", "1", "second", "2", "3rd") → 1-based index
 *
 * Returns the single matching order, or null if zero / multiple.
 */
const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

const ORDINAL_WORDS: Record<string, number> = {
  first: 1, '1st': 1,
  second: 2, '2nd': 2,
  third: 3, '3rd': 3,
};

export function disambiguateOrders(
  message: string,
  shownOrders: LookupOrder[],
): LookupOrder | null {
  const text = String(message || '').toLowerCase().trim();
  if (!text || shownOrders.length === 0) return null;

  // 1. Variant name match
  const byVariant = shownOrders.filter((o) =>
    o.items.some((i) =>
      i.variantName && tokenIncludes(text, i.variantName.toLowerCase())
    )
  );
  if (byVariant.length === 1) return byVariant[0];

  // 2. Product name substring (any item word ≥ 4 chars)
  const byProduct = shownOrders.filter((o) =>
    o.items.some((i) => productNameMatches(text, i.productName))
  );
  if (byProduct.length === 1) return byProduct[0];

  // 3. Month name match
  const monthIdx = MONTHS.findIndex((m) => new RegExp(`\\b${m}\\b`).test(text));
  if (monthIdx !== -1) {
    const byMonth = shownOrders.filter(
      (o) => o.createdAt && o.createdAt.getMonth() === monthIdx
    );
    if (byMonth.length === 1) return byMonth[0];
  }

  // 4. Amount match (exact GHS amount mentioned)
  const amountMatch = text.match(/\b(\d{2,5})\b/);
  if (amountMatch) {
    const amount = Number(amountMatch[1]);
    const byAmount = shownOrders.filter((o) => o.totalAmount === amount);
    if (byAmount.length === 1) return byAmount[0];
  }

  // 5. Ordinal / numeric position
  for (const [word, idx] of Object.entries(ORDINAL_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(text)) {
      if (idx >= 1 && idx <= shownOrders.length) return shownOrders[idx - 1];
    }
  }
  const numMatch = text.match(/^\s*([1-3])\s*$/);
  if (numMatch) {
    const idx = Number(numMatch[1]);
    if (idx >= 1 && idx <= shownOrders.length) return shownOrders[idx - 1];
  }

  return null;
}

function tokenIncludes(haystack: string, needle: string): boolean {
  if (needle.length < 3) return false;
  const re = new RegExp(`\\b${escape(needle)}\\b`, 'i');
  return re.test(haystack);
}

function productNameMatches(message: string, productName: string): boolean {
  const tokens = productName
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 4);
  return tokens.some((t) => message.includes(t));
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}