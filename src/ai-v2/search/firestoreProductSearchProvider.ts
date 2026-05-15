import type { ProductV2, ResolvedBy } from '../types';
import { normalizeText, tokenize } from '../catalog/normalize';
import { getProductAvailability } from '../catalog/availability';
import { lookupAttribute } from './attributeLexicon';
import type { ProductSearchInput, ProductSearchResult } from './types';

type ScoredProduct = {
  product: ProductV2;
  score: number;
  matchedTokens: string[];
  reason: string;
};

const LANGUAGE_STOPWORDS = new Set([
  'can',
  'you',
  'please',
  'pls',
  'show',
  'me',
  'i',
  'want',
  'need',
  'looking',
  'for',
  'do',
  'u',
  'have',
  'sell',
  'price',
  'how',
  'much',
  'is',
  'the',
  'a',
  'an',
  'of',
  'to',
  'get',
  'find',
  'give',
  'am',
  'im',
  'in',
  'on',
  'with',
  'and',
  'or',
  'this',
  'that',
  'one',
  'item',
  'product',
  'mean',
]);

function cleanQuery(message: string): string {
  return normalizeText(message)
    .replace(
      /\b(do you have|do u have|do you sell|i want|i need|looking for|how much is|price of|show me|find me|get me|give me|i mean|rather|instead|not that|no not)\b/g,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim();
}

function getProductAliases(product: ProductV2): string[] {
  const rawAliases =
    (product as any).searchAliases ||
    (product as any).aliases ||
    (product as any).keywords ||
    [];

  return Array.isArray(rawAliases)
    ? rawAliases.map((alias) => String(alias || '')).filter(Boolean)
    : [];
}

function productNameText(product: ProductV2): string {
  return normalizeText(product.name || '');
}

function productAliasText(product: ProductV2): string {
  return normalizeText(getProductAliases(product).join(' '));
}

function productVariantText(product: ProductV2): string {
  return normalizeText(
    Array.isArray(product.variants)
      ? product.variants.map((variant) => variant.name).join(' ')
      : ''
  );
}

function productCategoryText(product: ProductV2): string {
  return normalizeText(product.category || '');
}

function productTagsText(product: ProductV2): string {
  return normalizeText(
    Array.isArray((product as any).tags)
      ? ((product as any).tags as unknown[]).map((t) => String(t || '')).join(' ')
      : ''
  );
}

function productDescriptionText(product: ProductV2): string {
  return normalizeText((product as any).description || '');
}

// productFullSearchText was removed — its bag-of-words approach gave
// long descriptions disproportionate scoring power. Replaced by per-field
// scoring (name / alias / category / tags / variants / description).

function meaningfulTokens(value: string): string[] {
  return tokenize(value)
    .filter((token) => !LANGUAGE_STOPWORDS.has(token))
    .filter((token) => token.length >= 2);
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

/**
 * Singular/plural-tolerant token equality.
 *
 * Returns true when:
 *   - tokens are identical, OR
 *   - one is the trailing-s plural of the other AND both length >= 4
 *
 * Length floor avoids false positives like "is/i" or "as/a".
 *
 * Examples:
 *   tokensEqual("dress", "dresses")  → true
 *   tokensEqual("bag", "bags")        → true
 *   tokensEqual("laptop", "laptops") → true
 *   tokensEqual("boss", "bos")       → false (length floor)
 *   tokensEqual("class", "clas")     → false (length floor)
 */
function tokensEqual(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < 4 || b.length < 4) return false;
  if (a.length === b.length) return false;

  const [shorter, longer] = a.length < b.length ? [a, b] : [b, a];

  // Regular plural: shorter + "s"  (dress→dressS would be wrong, see below)
  if (longer === shorter + 's') return true;

  // -es plural: applies when the singular ends in s, x, z, ch, sh.
  //   dress → dresses
  //   box   → boxes
  //   bus   → buses
  //   church→ churches
  //   wish  → wishes
  if (longer === shorter + 'es') {
    const lastChar = shorter[shorter.length - 1];
    const lastTwo = shorter.slice(-2);
    if (
      lastChar === 's' ||
      lastChar === 'x' ||
      lastChar === 'z' ||
      lastTwo === 'ch' ||
      lastTwo === 'sh'
    ) {
      return true;
    }
  }

  // -ies plural: singular ends in consonant + "y"
  //   baby → babies   (baby's last char "y" → ies)
  //   lady → ladies
  // Implementation: shorter ends with "y", longer ends with "ies",
  // and stem before is identical.
  if (
    shorter.endsWith('y') &&
    longer.endsWith('ies') &&
    shorter.slice(0, -1) === longer.slice(0, -3)
  ) {
    return true;
  }

  return false;
}

/**
 * Plural-tolerant `includes` for token lists.
 */
function tokenInList(token: string, list: string[]): boolean {
  for (const candidate of list) {
    if (tokensEqual(token, candidate)) return true;
  }
  return false;
}

function buildCatalogTokenFrequency(products: ProductV2[]): Map<string, number> {
  const frequency = new Map<string, number>();

  for (const product of products) {
    // Frequency analysis spans all scored fields — same fields that
    // scoreProduct() looks at, so rarity weighting reflects the actual
    // search corpus.
    const allText = [
      productNameText(product),
      productAliasText(product),
      productCategoryText(product),
      productTagsText(product),
      productVariantText(product),
      productDescriptionText(product),
    ].join(' ');

    const tokens = unique(meaningfulTokens(allText));

    for (const token of tokens) {
      frequency.set(token, (frequency.get(token) || 0) + 1);
    }
  }

  return frequency;
}

function tokenRarityWeight(
  token: string,
  catalogSize: number,
  frequency: Map<string, number>
): number {
  const count = frequency.get(token) || 0;

  if (!catalogSize || !count) return 2.5;

  const ratio = count / catalogSize;

  if (ratio >= 0.75) return 0.25;
  if (ratio >= 0.5) return 0.5;
  if (ratio >= 0.3) return 0.9;
  if (ratio >= 0.15) return 1.4;

  return 2.3;
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array.from({ length: b.length + 1 }, () => 0);

  for (let i = 1; i <= a.length; i++) {
    current[0] = i;

    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost
      );
    }

    for (let j = 0; j <= b.length; j++) {
      previous[j] = current[j];
    }
  }

  return previous[b.length];
}

function tokenLooksLikeTypo(queryToken: string, candidateToken: string): boolean {
  if (queryToken.length < 4 || candidateToken.length < 4) return false;

  const maxLength = Math.max(queryToken.length, candidateToken.length);
  const distance = levenshteinDistance(queryToken, candidateToken);

  if (maxLength <= 5) return distance <= 1;

  return distance <= 2;
}
/**
 * Per-field weights. Higher = stronger evidence the product matches.
 *
 * The order in scoreProduct() also matters — we check fields in
 * decreasing-weight order so the "best" reason wins.
 *
 *   alias    9   vendor-curated equivalent terms
 *   name     8   product title
 *   category 7   structural metadata about WHAT this product IS
 *   tags     6   curated descriptors
 *   variant  5   option sub-names not already in parent name
 *   description 1 (capped) — bag of marketing copy, weak signal
 */
const WEIGHT_NAME = 8;
const WEIGHT_ALIAS = 9;
const WEIGHT_CATEGORY = 7;
const WEIGHT_TAGS = 6;
const WEIGHT_VARIANT = 5;
const WEIGHT_DESCRIPTION = 1;

const WEIGHT_NAME_TYPO = 5;
const WEIGHT_ALIAS_TYPO = 6;

/**
 * Maximum total score a product can earn from description-token matches.
 * Keeps long product descriptions (e.g. 485-word medical scale entries)
 * from dominating queries with shared tokens like "body" or "fat".
 */
const DESCRIPTION_SCORE_CAP = 4;

/**
 * Bonus multiplier when a matched token is also a known attribute word
 * (color / occasion / style / use_case). Applied to the field-weighted
 * score, not to the rarity weight.
 */
const ATTRIBUTE_BONUS = 1.5;

/**
 * Stage 2B — minimum score floor.
 *
 * Below this, "matches" are too weak to surface to the customer. Returning
 * "we don't carry that" is more honest than recommending a product whose
 * only signal is one description token. Calibrated from the test script:
 * good matches score 22+, weak ones land in the 6-12 range.
 */
const MIN_RESULT_SCORE = 12;

/**
 * Stage 2B — close-match threshold for multiple_matches.
 *
 * Old value 0.65 was too loose — it let attribute-only siblings ride
 * alongside the real winner. With core-noun gating in place, surviving
 * candidates have already been filtered, so we can also tighten this.
 */
const CLOSE_MATCH_RATIO = 0.75;

/**
 * Stage 2B — discriminating-rarity threshold.
 *
 * A query token is "discriminating" only when its rarity weight is
 * at least this value. Tokens shared across most of the catalog
 * (e.g. "shito" in a shito-only store) are NOT discriminating, even
 * though they pass the stopword / lexicon filters.
 */
const DISCRIMINATING_RARITY = 0.9;

/**
 * Classify query tokens into:
 *   - attributeTokens   : color / occasion / style / use_case (per lexicon)
 *   - coreTokens        : non-attribute, non-stopword tokens that are
 *                          rare enough across the catalog to discriminate
 *
 * coreTokens drives the Stage 2B core-noun gate: if the query has any
 * discriminating core token AND at least one product matches it, then
 * candidates that don't match any core token are filtered out.
 */
function classifyQueryTokens(
  queryTokens: string[],
  catalogSize: number,
  frequency: Map<string, number>
): { attributeTokens: string[]; coreTokens: string[] } {
  const attributeTokens: string[] = [];
  const coreTokens: string[] = [];

  for (const token of queryTokens) {
    if (lookupAttribute(token)) {
      attributeTokens.push(token);
      continue;
    }
    const rarity = tokenRarityWeight(token, catalogSize, frequency);
    if (rarity >= DISCRIMINATING_RARITY) {
      coreTokens.push(token);
    }
    // Non-attribute tokens with low rarity (very common in catalog) are
    // dropped from both buckets — they don't discriminate either way.
  }

  return { attributeTokens, coreTokens };
}

function scoreProduct(
  queryTokens: string[],
  product: ProductV2,
  catalogSize: number,
  frequency: Map<string, number>
): ScoredProduct {
  const nameTokens = unique(meaningfulTokens(productNameText(product)));
  const aliasTokens = unique(meaningfulTokens(productAliasText(product)));
  const categoryTokens = unique(meaningfulTokens(productCategoryText(product)));
  const tagTokens = unique(meaningfulTokens(productTagsText(product)));

  // Variants are deduped against the parent name. A variant called
  // "Boys' Casual ... (Black)" should not contribute "boys" / "casual"
  // again — those already scored on the name. Only tokens unique to the
  // variant (e.g. "black", "green") count.
  const rawVariantTokens = unique(meaningfulTokens(productVariantText(product)));
  const variantTokens = rawVariantTokens.filter((t) => !nameTokens.includes(t));

  const descriptionTokens = unique(meaningfulTokens(productDescriptionText(product)));

  let score = 0;
  let descriptionScoreSpent = 0;
  const matchedTokens: string[] = [];
  const reasons: string[] = [];

  for (const token of queryTokens) {
    const rarity = tokenRarityWeight(token, catalogSize, frequency);
    const attribute = lookupAttribute(token);
    const attributeMul = attribute ? ATTRIBUTE_BONUS : 1;

    // Field-by-field check, decreasing weight order.
    // Uses plural-tolerant matching so "dress" matches "dresses".
    if (tokenInList(token, aliasTokens)) {
      score += WEIGHT_ALIAS * rarity * attributeMul;
      matchedTokens.push(token);
      reasons.push(attribute ? `alias_${attribute}_token` : 'alias_token');
      continue;
    }

    if (tokenInList(token, nameTokens)) {
      score += WEIGHT_NAME * rarity * attributeMul;
      matchedTokens.push(token);
      reasons.push(attribute ? `name_${attribute}_token` : 'name_token');
      continue;
    }

    if (tokenInList(token, categoryTokens)) {
      score += WEIGHT_CATEGORY * rarity * attributeMul;
      matchedTokens.push(token);
      reasons.push(attribute ? `category_${attribute}_token` : 'category_token');
      continue;
    }

    if (tokenInList(token, tagTokens)) {
      score += WEIGHT_TAGS * rarity * attributeMul;
      matchedTokens.push(token);
      reasons.push(attribute ? `tag_${attribute}_token` : 'tag_token');
      continue;
    }

    if (tokenInList(token, variantTokens)) {
      score += WEIGHT_VARIANT * rarity * attributeMul;
      matchedTokens.push(token);
      reasons.push(attribute ? `variant_${attribute}_token` : 'variant_token');
      continue;
    }

    // Description bucket — capped to prevent long marketing copy
    // from creating false high-confidence matches.
    if (tokenInList(token, descriptionTokens)) {
      const remainingCap = DESCRIPTION_SCORE_CAP - descriptionScoreSpent;
      if (remainingCap > 0) {
        const tokenScore = Math.min(
          remainingCap,
          WEIGHT_DESCRIPTION * rarity * attributeMul
        );
        score += tokenScore;
        descriptionScoreSpent += tokenScore;
        matchedTokens.push(token);
        reasons.push(attribute ? `description_${attribute}_token` : 'description_token');
      }
      continue;
    }

    // Typo tolerance — tighter than before, only against name and alias.
    // We deliberately do NOT typo-match against description; description
    // typos are too easy to false-positive on.
    const typoNameMatch = nameTokens.find((candidate) =>
      tokenLooksLikeTypo(token, candidate)
    );
    if (typoNameMatch) {
      score += WEIGHT_NAME_TYPO * rarity * attributeMul;
      matchedTokens.push(token);
      reasons.push('name_typo_token');
      continue;
    }

    const typoAliasMatch = aliasTokens.find((candidate) =>
      tokenLooksLikeTypo(token, candidate)
    );
    if (typoAliasMatch) {
      score += WEIGHT_ALIAS_TYPO * rarity * attributeMul;
      matchedTokens.push(token);
      reasons.push('alias_typo_token');
      continue;
    }
  }

  const coverage = queryTokens.length
    ? unique(matchedTokens).length / queryTokens.length
    : 0;

  score += coverage * 10;

  return {
    product,
    score,
    matchedTokens: unique(matchedTokens),
    reason: unique(reasons).join('_') || 'no_match',
  };
}

function isStrongSingle(scored: ScoredProduct[]): boolean {
  if (scored.length === 0) return false;
  if (scored.length === 1) return scored[0].score >= 8;

  const [first, second] = scored;

  return first.score >= 10 && first.score >= second.score * 1.35;
}

function toDebugScores(scored: ScoredProduct[]) {
  return scored.slice(0, 8).map((item) => ({
    productId: item.product.id,
    name: item.product.name,
    score: Math.round(item.score * 100) / 100,
    reason: item.reason,
    matchedTokens: item.matchedTokens,
  }));
}

function buildResult(input: {
  status: ProductSearchResult['status'];
  confidence: number;
  resolvedBy?: ResolvedBy;
  products: ProductV2[];
  reason: string;
  query: string;
  normalizedQuery: string;
  matchedTokens?: string[];
  scored?: ScoredProduct[];
}): ProductSearchResult {
  return {
    status: input.status,
    confidence: input.confidence,
    resolvedBy: input.resolvedBy,
    products: input.products,
    reason: input.reason,
    provider: 'firestore_weighted_fallback',
    debug: {
      query: input.query,
      normalizedQuery: input.normalizedQuery,
      matchedTokens: input.matchedTokens || [],
      scores: input.scored ? toDebugScores(input.scored) : [],
    },
  };
}

export async function searchProductsWithFirestoreFallback({
  query: rawQuery,
  products,
  limit = 6,
}: ProductSearchInput): Promise<ProductSearchResult> {
  const visibleProducts = products.filter((product) => {
    return getProductAvailability(product).visible;
  });

  const query = cleanQuery(rawQuery);
  const normalizedQuery = normalizeText(query);

  if (!query) {
    return buildResult({
      status: 'no_match',
      confidence: 0,
      products: [],
      reason: 'empty_query',
      query: rawQuery,
      normalizedQuery,
    });
  }

  const exactNameMatches = visibleProducts.filter((product) => {
    return productNameText(product) === normalizedQuery;
  });

  if (exactNameMatches.length === 1) {
    return buildResult({
      status: 'single_match',
      confidence: 1,
      resolvedBy: 'exact',
      products: exactNameMatches,
      reason: 'exact_product_name_match',
      query: rawQuery,
      normalizedQuery,
    });
  }

  if (exactNameMatches.length > 1) {
    return buildResult({
      status: 'multiple_matches',
      confidence: 0.95,
      resolvedBy: 'exact',
      products: exactNameMatches.slice(0, limit),
      reason: 'multiple_exact_product_name_matches',
      query: rawQuery,
      normalizedQuery,
    });
  }

  const exactAliasMatches = visibleProducts.filter((product) => {
    return getProductAliases(product).some((alias) => {
      return normalizeText(alias) === normalizedQuery;
    });
  });

  if (exactAliasMatches.length === 1) {
    return buildResult({
      status: 'single_match',
      confidence: 0.98,
      resolvedBy: 'alias',
      products: exactAliasMatches,
      reason: 'exact_product_alias_match',
      query: rawQuery,
      normalizedQuery,
    });
  }

  if (exactAliasMatches.length > 1) {
    return buildResult({
      status: 'multiple_matches',
      confidence: 0.9,
      resolvedBy: 'alias',
      products: exactAliasMatches.slice(0, limit),
      reason: 'multiple_exact_product_alias_matches',
      query: rawQuery,
      normalizedQuery,
    });
  }

  const containsNameMatches = visibleProducts.filter((product) => {
    const productName = productNameText(product);

    return (
      productName.includes(normalizedQuery) ||
      normalizedQuery.includes(productName)
    );
  });

  if (containsNameMatches.length === 1) {
    return buildResult({
      status: 'single_match',
      confidence: 0.92,
      resolvedBy: 'token',
      products: containsNameMatches,
      reason: 'product_name_contains_query',
      query: rawQuery,
      normalizedQuery,
    });
  }

  if (containsNameMatches.length > 1) {
    return buildResult({
      status: 'multiple_matches',
      confidence: 0.82,
      resolvedBy: 'token',
      products: containsNameMatches.slice(0, limit),
      reason: 'multiple_product_name_contains_matches',
      query: rawQuery,
      normalizedQuery,
    });
  }

  const queryTokens = meaningfulTokens(query);

  if (!queryTokens.length) {
    return buildResult({
      status: 'no_match',
      confidence: 0,
      products: [],
      reason: 'no_meaningful_tokens',
      query: rawQuery,
      normalizedQuery,
    });
  }

  const frequency = buildCatalogTokenFrequency(visibleProducts);
  const catalogSize = visibleProducts.length;

  const scored = visibleProducts
    .map((product) => scoreProduct(queryTokens, product, catalogSize, frequency))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) {
    return buildResult({
      status: 'no_match',
      confidence: 0,
      products: [],
      reason: 'no_token_matches',
      query: rawQuery,
      normalizedQuery,
    });
  }

  // ─── Stage 2B core-noun gate ──────────────────────────────────────────
  // Filter out candidates that match only attribute tokens when the query
  // also has a discriminating core token AND at least one product actually
  // matches that core token.
  const { coreTokens } = classifyQueryTokens(queryTokens, catalogSize, frequency);

  let gated = scored;
  let gateApplied = false;

  if (coreTokens.length > 0) {
    const matchesAnyCore = (item: ScoredProduct) =>
      item.matchedTokens.some((mt) =>
        coreTokens.some((ct) => tokensEqual(mt, ct))
      );

    const candidatesWithCore = scored.filter(matchesAnyCore);

    if (candidatesWithCore.length > 0) {
      // At least one product matched a core token — drop everything that
      // didn't. This is the "red dress for wedding" → drop handbag rule.
      gated = candidatesWithCore;
      gateApplied = true;
    }
    // else: nothing matched the core token. Don't filter — let the
    // attribute-only matches survive so we can still respond. The score
    // floor below will still demote weak ones.
  }

  // ─── Stage 2B minimum score floor ─────────────────────────────────────
  // Below MIN_RESULT_SCORE, results are too weak to recommend honestly.
  const aboveFloor = gated.filter((item) => item.score >= MIN_RESULT_SCORE);

  if (!aboveFloor.length) {
    return buildResult({
      status: 'no_match',
      confidence: 0,
      products: [],
      reason: gateApplied
        ? 'no_match_after_core_noun_gate_below_floor'
        : 'no_match_below_score_floor',
      query: rawQuery,
      normalizedQuery,
      scored, // keep the original scored list for debug visibility
    });
  }
  if (isStrongSingle(aboveFloor)) {
    const top = aboveFloor[0];

    return buildResult({
      status: 'single_match',
      confidence: Math.min(0.9, 0.65 + top.score / 50),
      resolvedBy: 'token',
      products: [top.product],
      reason: gateApplied
        ? `strong_weighted_core_gated_${top.reason}`
        : `strong_weighted_${top.reason}`,
      query: rawQuery,
      normalizedQuery,
      matchedTokens: top.matchedTokens,
      scored,
    });
  }

  const topScore = aboveFloor[0].score;
  const closeMatches = aboveFloor.filter(
    (item) => item.score >= topScore * CLOSE_MATCH_RATIO
  );

  return buildResult({
    status: 'multiple_matches',
    confidence: Math.min(0.75, 0.35 + topScore / 50),
    resolvedBy: 'token',
    products: closeMatches.slice(0, limit).map((item) => item.product),
    reason: gateApplied
      ? 'ranked_weighted_core_gated_matches'
      : 'ranked_weighted_token_matches',
    query: rawQuery,
    normalizedQuery,
    matchedTokens: unique(closeMatches.flatMap((item) => item.matchedTokens)),
    scored,
  });
}