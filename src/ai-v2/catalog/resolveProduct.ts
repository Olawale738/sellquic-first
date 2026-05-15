import type { ProductV2, ResolvedBy } from '../types';
import { normalizeText, tokenize } from './normalize';
import { getProductAvailability } from './availability';

export type ProductResolveResult = {
  status: 'single_match' | 'multiple_matches' | 'no_match';
  confidence: number;
  resolvedBy?: ResolvedBy;
  products: ProductV2[];
  reason: string;
};

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
]);

function cleanQuery(message: string): string {
  return normalizeText(message)
    .replace(
      /\b(do you have|do u have|do you sell|i want|i need|looking for|how much is|price of|show me|find me|get me|give me|i mean|rather|instead)\b/g,
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

function productFullSearchText(product: ProductV2): string {
  return normalizeText(
    [
      product.name,
      product.category,
      product.description,
      product.brand,
      product.sellingStatus,
      ...(Array.isArray(product.tags) ? product.tags : []),
      ...getProductAliases(product),
      ...(Array.isArray(product.variants)
        ? product.variants.map((variant) => variant.name)
        : []),
    ]
      .filter(Boolean)
      .join(' ')
  );
}

function meaningfulTokens(value: string): string[] {
  return tokenize(value)
    .filter((token) => !LANGUAGE_STOPWORDS.has(token))
    .filter((token) => token.length >= 2);
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function buildCatalogTokenFrequency(products: ProductV2[]): Map<string, number> {
  const frequency = new Map<string, number>();

  for (const product of products) {
    const tokens = unique(meaningfulTokens(productFullSearchText(product)));

    for (const token of tokens) {
      frequency.set(token, (frequency.get(token) || 0) + 1);
    }
  }

  return frequency;
}

function tokenRarityWeight(token: string, catalogSize: number, frequency: Map<string, number>): number {
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

function scoreProduct(
  queryTokens: string[],
  product: ProductV2,
  catalogSize: number,
  frequency: Map<string, number>
): ScoredProduct {
  const nameTokens = unique(meaningfulTokens(productNameText(product)));
  const aliasTokens = unique(meaningfulTokens(productAliasText(product)));
  const variantTokens = unique(meaningfulTokens(productVariantText(product)));
  const fullTokens = unique(meaningfulTokens(productFullSearchText(product)));

  let score = 0;
  const matchedTokens: string[] = [];
  const reasons: string[] = [];

  for (const token of queryTokens) {
    const rarity = tokenRarityWeight(token, catalogSize, frequency);

    if (nameTokens.includes(token)) {
      score += 8 * rarity;
      matchedTokens.push(token);
      reasons.push('name_token');
      continue;
    }

    if (aliasTokens.includes(token)) {
      score += 9 * rarity;
      matchedTokens.push(token);
      reasons.push('alias_token');
      continue;
    }

    if (variantTokens.includes(token)) {
      score += 5 * rarity;
      matchedTokens.push(token);
      reasons.push('variant_token');
      continue;
    }

    if (fullTokens.includes(token)) {
      score += 3 * rarity;
      matchedTokens.push(token);
      reasons.push('full_text_token');
      continue;
    }

    const typoNameMatch = nameTokens.find((candidate) =>
      tokenLooksLikeTypo(token, candidate)
    );

    if (typoNameMatch) {
      score += 5 * rarity;
      matchedTokens.push(token);
      reasons.push('name_typo_token');
      continue;
    }

    const typoAliasMatch = aliasTokens.find((candidate) =>
      tokenLooksLikeTypo(token, candidate)
    );

    if (typoAliasMatch) {
      score += 6 * rarity;
      matchedTokens.push(token);
      reasons.push('alias_typo_token');
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

export function resolveProduct(
  message: string,
  products: ProductV2[]
): ProductResolveResult {
  const visibleProducts = products.filter((product) => {
    return getProductAvailability(product).visible;
  });

  const query = cleanQuery(message);

  if (!query) {
    return {
      status: 'no_match',
      confidence: 0,
      products: [],
      reason: 'empty_query',
    };
  }

  const normalizedQuery = normalizeText(query);

  const exactNameMatches = visibleProducts.filter((product) => {
    return productNameText(product) === normalizedQuery;
  });

  if (exactNameMatches.length === 1) {
    return {
      status: 'single_match',
      confidence: 1,
      resolvedBy: 'exact',
      products: exactNameMatches,
      reason: 'exact_product_name_match',
    };
  }

  if (exactNameMatches.length > 1) {
    return {
      status: 'multiple_matches',
      confidence: 0.95,
      resolvedBy: 'exact',
      products: exactNameMatches.slice(0, 6),
      reason: 'multiple_exact_product_name_matches',
    };
  }

  const exactAliasMatches = visibleProducts.filter((product) => {
    return getProductAliases(product).some((alias) => normalizeText(alias) === normalizedQuery);
  });

  if (exactAliasMatches.length === 1) {
    return {
      status: 'single_match',
      confidence: 0.98,
      resolvedBy: 'alias',
      products: exactAliasMatches,
      reason: 'exact_product_alias_match',
    };
  }

  if (exactAliasMatches.length > 1) {
    return {
      status: 'multiple_matches',
      confidence: 0.9,
      resolvedBy: 'alias',
      products: exactAliasMatches.slice(0, 6),
      reason: 'multiple_exact_product_alias_matches',
    };
  }

  const containsNameMatches = visibleProducts.filter((product) => {
    const productName = productNameText(product);

    return (
      productName.includes(normalizedQuery) ||
      normalizedQuery.includes(productName)
    );
  });

  if (containsNameMatches.length === 1) {
    return {
      status: 'single_match',
      confidence: 0.92,
      resolvedBy: 'token',
      products: containsNameMatches,
      reason: 'product_name_contains_query',
    };
  }

  if (containsNameMatches.length > 1) {
    return {
      status: 'multiple_matches',
      confidence: 0.82,
      resolvedBy: 'token',
      products: containsNameMatches.slice(0, 6),
      reason: 'multiple_product_name_contains_matches',
    };
  }

  const queryTokens = meaningfulTokens(query);

  if (!queryTokens.length) {
    return {
      status: 'no_match',
      confidence: 0,
      products: [],
      reason: 'no_meaningful_tokens',
    };
  }

  const frequency = buildCatalogTokenFrequency(visibleProducts);
  const catalogSize = visibleProducts.length;

  const scored = visibleProducts
    .map((product) => scoreProduct(queryTokens, product, catalogSize, frequency))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) {
    return {
      status: 'no_match',
      confidence: 0,
      products: [],
      reason: 'no_token_matches',
    };
  }

  if (isStrongSingle(scored)) {
    const top = scored[0];

    return {
      status: 'single_match',
      confidence: Math.min(0.9, 0.65 + top.score / 50),
      resolvedBy: 'token',
      products: [top.product],
      reason: `strong_weighted_${top.reason}`,
    };
  }

  const topScore = scored[0].score;
  const closeMatches = scored.filter((item) => item.score >= topScore * 0.65);

  return {
    status: 'multiple_matches',
    confidence: Math.min(0.75, 0.35 + topScore / 50),
    resolvedBy: 'token',
    products: closeMatches.slice(0, 6).map((item) => item.product),
    reason: 'ranked_weighted_token_matches',
  };
}