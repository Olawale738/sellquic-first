export function buildVariantVocab(
  products: Array<{ variants?: Array<{ name?: string }> }>,
): Set<string> {
  const tokens = new Set<string>();
  for (const product of products) {
    for (const variant of product.variants ?? []) {
      const name = String(variant.name || '').toLowerCase();
      for (const word of name.split(/\s+/)) {
        if (word.length >= 2) tokens.add(word);
      }
    }
  }
  return tokens;
}

export interface CombinedOrderIntent {
  productQuery: string | null;
  variantQuery: string | null;
  quantity: number | null;
}

const ADD_VERBS = /\b(i\s+(want|need|will\s+take|'?ll\s+take)|add(?:\s+(?:more|another))?|put|get\s+me|give\s+me|order|buy|i\s+want\s+to\s+buy|include)\b/i;
const QTY_RE   = /(?:^|\s)(\d{1,3})(?:\s|$)/;

// Backwards-compatible fallback. Used only when variantVocab is not provided.
const VARIANT_HINTS = /\b(small|medium|large|xl|xxl|tiny|huge|big|mini|hot|mild|spicy|extra|regular|original|classic|red|blue|black|white|green|yellow|pink|purple|brown|grey|gray)\b/i;

function isProductRef(s: string | null): boolean {
  if (!s) return false;
  const t = s.trim().toLowerCase();
  if (t.length < 3) return false;
  if (/^(of\s+)?(those|them|that|this|it|some|any|one|ones)$/i.test(t)) return false;
  if (/^(yes|yeah|yep|yup|ok|okay|sure|please|alright|aight|no|nope|nah|fine|cool|nice|good|great|done)$/i.test(t)) return false;
  return true;
}

export function extractCombinedOrderIntent(
  rawMessage: string,
  variantVocab?: Set<string>,
): CombinedOrderIntent | null {
  const msg = rawMessage.trim();
  if (msg.length === 0) return null;

  const stripped = msg.replace(/^\s*(yes|yeah|yep|yup|ok|okay|sure|please|alright|aight|no|nope|nah)\b[\s,]*/i, '').trim();
  const cleanMsg = stripped.length >= 3 ? stripped : msg;

  const hasAddVerb = ADD_VERBS.test(cleanMsg);
  const startsWithQty = /^\s*\d{1,3}\b/.test(cleanMsg);
  if (!hasAddVerb && !startsWithQty) return null;

  const qtyMatch = cleanMsg.match(QTY_RE);
  const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : null;

  let residual = cleanMsg
    .replace(ADD_VERBS, ' ')
    .replace(QTY_RE, ' ')
    .replace(/\b(please|pls|kindly|some|the|a|an|of)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  let variantQuery: string | null = null;

  if (variantVocab && variantVocab.size > 0) {
    // Catalog-aware: find the longest contiguous run of tokens that all
    // appear in the live variant vocabulary. Handles multi-word variants
    // ("medium 20ml") as a single phrase, and does NOT match product-name
    // words that happen to overlap with the old hardcoded list (e.g.
    // "black" in a product called "Black Eagle").
    const tokens = residual.split(/\s+/).filter(Boolean);
    let bestStart = -1;
    let bestLen = 0;
    let currStart = -1;
    let currLen = 0;

    for (let i = 0; i < tokens.length; i++) {
      if (variantVocab.has(tokens[i].toLowerCase())) {
        if (currStart === -1) currStart = i;
        currLen++;
        if (currLen > bestLen) {
          bestStart = currStart;
          bestLen = currLen;
        }
      } else {
        currStart = -1;
        currLen = 0;
      }
    }

    if (bestStart !== -1) {
      variantQuery = tokens
        .slice(bestStart, bestStart + bestLen)
        .join(' ')
        .toLowerCase();
      tokens.splice(bestStart, bestLen);
      residual = tokens.join(' ').replace(/\s+/g, ' ').trim();
    }
  } else {
    // No vocab provided — fall back to the legacy hardcoded list so any
    // call site not yet updated keeps working.
    const vMatch = residual.match(VARIANT_HINTS);
    if (vMatch) {
      variantQuery = vMatch[0].toLowerCase();
      residual = residual.replace(VARIANT_HINTS, ' ').replace(/\s+/g, ' ').trim();
    }
  }

  const productQuery = residual.length >= 3 ? residual : null;

  const productOk = isProductRef(productQuery);
  const slotCount =
    (productOk ? 1 : 0) +
    (variantQuery !== null ? 1 : 0) +
    (quantity !== null ? 1 : 0);
  
  if (slotCount < 2) return null;
  
  return {
    productQuery: productOk ? productQuery : null,
    variantQuery,
    quantity,
  };
}