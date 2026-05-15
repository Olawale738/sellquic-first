import type {
    KnowledgeProduct,
    ProductSearcher,
  } from './types';
  
  /**
   * Resolves whether the customer's message explicitly names a product, and
   * which one. This runs BEFORE pronoun-based resolveReferent for product-shaped
   * questions (q_price, q_stock, q_variants), so that:
   *
   *   "How much is Accra spice co shito?"   → matches Accra spice co shito
   *   "How much is the akwesi shito?"       → matches Akwasi's shito (typo-tolerant)
   *   "How much is akwesi's shito supreme?" → matches Akwasi's shito *supreme*
   *                                            (catalog-aware: 'supreme' is rare,
   *                                             so the supreme variant beats the
   *                                             plain one)
   *   "How much is it?"                     → returns 'none' → fall back to pending
   *
   * No hardcoded vendor terms. Catalog-aware: tokens that appear in many
   * products (like "shito" in a shito-only store) get downweighted, so the
   * decisive signal comes from rarer tokens.
   *
   * The matcher comes in two flavors:
   *
   *   1. INJECTED — when the orchestrator passes a `ProductSearcher` (i.e. the
   *      production searchProducts), this resolver delegates to it and gets
   *      typo tolerance, alias matching, and common-word downranking from the
   *      existing search subsystem.
   *
   *   2. INLINE FALLBACK — if no searcher is injected, a self-contained matcher
   *      is used. It implements the same philosophy with a small IDF-weighted
   *      token overlap + Levenshtein-1 typo tolerance for tokens of length ≥ 5.
   *      Sufficient for the bestshito test cases above.
   *
   * Always pure. No async. No side effects.
   */
  
  export type ExplicitProductResult =
    | { kind: 'match'; product: KnowledgeProduct; confidence: number }
    | { kind: 'ambiguous'; candidates: KnowledgeProduct[] }
    | { kind: 'none' };
  
  export function resolveExplicitProduct(
    customerMessage: string,
    productsById: Record<string, KnowledgeProduct>,
    searcher?: ProductSearcher,
  ): ExplicitProductResult {
    // Strip generic question scaffolding so the residual is the product
    // reference (or empty).
    const residual = stripQuestionScaffolding(customerMessage);
    const queryTokens = tokenize(residual);
    if (queryTokens.length === 0) return { kind: 'none' };
  
    // If a real searcher was injected, prefer it. It owns the search behavior.
    if (searcher) {
      return resolveViaInjectedSearcher(residual, searcher);
    }
  
    return resolveViaInlineMatcher(queryTokens, productsById);
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Path 1 — injected searcher
  // ─────────────────────────────────────────────────────────────────────────────
  
  function resolveViaInjectedSearcher(
    query: string,
    searcher: ProductSearcher,
  ): ExplicitProductResult {
    let hits: ReturnType<ProductSearcher>;
    try {
      hits = searcher(query);
    } catch {
      // Fail safe — if the injected searcher throws, treat as no explicit match
      // and let pronoun-fallback take over.
      return { kind: 'none' };
    }
  
    if (!Array.isArray(hits) || hits.length === 0) return { kind: 'none' };
  
    // Sort defensively — don't assume the searcher pre-sorts.
    const sorted = [...hits].sort((a, b) => b.score - a.score);
    const top = sorted[0];
    const second = sorted[1];
  
    // Trust the searcher's score absolutely (its scale is searcher-specific)
    // but require some separation between #1 and #2 to avoid coin-flips.
    if (top.score <= 0) return { kind: 'none' };
  
    if (second && second.score > 0 && top.score / second.score < 1.15) {
      return { kind: 'ambiguous', candidates: [top.product, second.product] };
    }
  
    return { kind: 'match', product: top.product, confidence: top.score };
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Path 2 — inline fallback matcher
  // ─────────────────────────────────────────────────────────────────────────────
  
  function resolveViaInlineMatcher(
    queryTokens: string[],
    productsById: Record<string, KnowledgeProduct>,
  ): ExplicitProductResult {
    const products = Object.values(productsById);
    if (products.length === 0) return { kind: 'none' };
  
    // Build per-product searchable token sets (name + aliases).
    const productTokens = new Map<string, Set<string>>();
    for (const p of products) {
      const tokens = new Set<string>();
      for (const t of tokenize(p.name)) tokens.add(t);
      for (const a of p.aliases ?? []) {
        for (const t of tokenize(a)) tokens.add(t);
      }
      productTokens.set(p.id, tokens);
    }
  
    // Document frequency: how many products contain each token.
    const df = new Map<string, number>();
    Array.from(productTokens.values()).forEach((tokens) => {
      tokens.forEach((t) => {
        df.set(t, (df.get(t) ?? 0) + 1);
      });
    });
  
    const N = products.length;
    // A token is "rare" (i.e. discriminative) if it appears in less than half
    // of the catalog. With small catalogs (< 4 items), we relax this so a
    // shared token can still discriminate.
    const rareThreshold = Math.max(1, Math.floor(N / 2));
  
    interface Scored {
      product: KnowledgeProduct;
      score: number;
      rareHits: number;
      /** matched_tokens / product_tokens — measures how fully the query
       *  covers a product's token set. Higher = customer named more of
       *  the product. Used as score tiebreak so that "akwesi shito" prefers
       *  "Akwasi's shito" (2/2) over "Akwasi's shito supreme" (2/3). */
      coverage: number;
    }
  
    const scored: Scored[] = [];
    for (const p of products) {
      const pTokens = productTokens.get(p.id)!;
      let score = 0;
      let rareHits = 0;
      let matched = 0;
  
      for (const qt of queryTokens) {
        const m = findMatchingToken(qt, pTokens);
        if (!m) continue;
        const tokenDf = df.get(m) ?? 1;
        const weight = Math.log((N + 1) / tokenDf);
        score += weight;
        matched++;
        if (tokenDf <= rareThreshold) rareHits++;
      }
  
      const coverage = pTokens.size === 0 ? 0 : matched / pTokens.size;
      scored.push({ product: p, score, rareHits, coverage });
    }
  
    // Sort by score desc, then by coverage desc, then by rareHits desc.
    // Coverage is the key tiebreak: when "akwesi shito" matches both Akwasi's
    // shito and Akwasi's shito supreme on raw score, the one whose tokens
    // are more fully covered by the customer's query wins.
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.coverage !== a.coverage) return b.coverage - a.coverage;
      return b.rareHits - a.rareHits;
    });
  
    const top = scored[0];
    const second = scored[1];
  
    if (top.score === 0) return { kind: 'none' };
    if (top.rareHits === 0) return { kind: 'none' };
  
    // Only declare ambiguity when ALL three signals tie (score, coverage,
    // rareHits) — otherwise the sort above has produced a clear winner.
    const SCORE_EPS = 1e-9;
    const COVERAGE_EPS = 1e-9;
    if (
      second &&
      second.score > 0 &&
      Math.abs(top.score - second.score) < SCORE_EPS &&
      Math.abs(top.coverage - second.coverage) < COVERAGE_EPS &&
      top.rareHits === second.rareHits
    ) {
      return { kind: 'ambiguous', candidates: [top.product, second.product] };
    }
  
    return { kind: 'match', product: top.product, confidence: top.score };
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Tokenization & scaffolding
  // ─────────────────────────────────────────────────────────────────────────────
  
  const STOPWORDS = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'do', 'does', 'did',
    'for', 'from', 'have', 'has', 'how', 'i', 'in', 'is', 'it', 'its', 'me', 'much',
    'my', 'of', 'on', 'or', 'please', 'so', 'that', 'the', 'this', 'to', 'too',
    'we', 'what', 'when', 'where', 'which', 'who', 'why', 'will', 'with',
    'you', 'your', 'they', 'them', 'their', 'about', 'would', 'should',
    'can', 'could', 'one', 'two', 'three', 'just', 'any', 'some',
    // Common e-commerce verbs that aren't product references
    'buy', 'order', 'add', 'get', 'sell', 'sells', 'available', 'there',
    'cost', 'costs', 'price', 'priced', 'amount', 'total',
  ]);
  
  function tokenize(s: string): string[] {
    return s
      .toLowerCase()
      .split(/[^a-z0-9]+/g)
      .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
  }
  
  /**
   * Strip leading question scaffolding so the residual is more focused.
   * Keeps the matcher conservative — anything not stripped here gets handled
   * by the stopword filter at tokenize time.
   */
  function stripQuestionScaffolding(s: string): string {
    let out = s.toLowerCase().trim();
    out = out.replace(/[?!.]+$/g, '').trim();
    out = out.replace(/\s+please\s*$/g, '').trim();
    return out;
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Token matching with light typo tolerance
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Finds a token in `productTokens` matching `queryToken`. Allows Levenshtein
   * distance ≤ 1 for tokens of length ≥ 5 (catches "akwesi" → "akwasi").
   *
   * Returns the *product-side* matched token (so weighting uses the catalog's
   * frequency table, not the query's surface form).
   */
  function findMatchingToken(queryToken: string, productTokens: Set<string>): string | null {
    if (productTokens.has(queryToken)) return queryToken;
    if (queryToken.length < 5) return null;
  
    let matchedToken: string | null = null;

productTokens.forEach((pt) => {
  if (matchedToken) return;
  if (pt.length < 5) return;
  if (Math.abs(pt.length - queryToken.length) > 1) return;
  if (editDistanceAtMost1(queryToken, pt)) {
    matchedToken = pt;
  }
});

return matchedToken;
    return null;
  }
  
  /** Returns true iff Levenshtein distance(a, b) ≤ 1. O(min(|a|,|b|)). */
  function editDistanceAtMost1(a: string, b: string): boolean {
    if (a === b) return true;
    if (Math.abs(a.length - b.length) > 1) return false;
  
    if (a.length === b.length) {
      let diffs = 0;
      for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
          if (++diffs > 1) return false;
        }
      }
      return true;
    }
  
    // |a.length - b.length| === 1 — one insertion/deletion.
    const [shorter, longer] = a.length < b.length ? [a, b] : [b, a];
    let i = 0, j = 0, diffs = 0;
    while (i < shorter.length && j < longer.length) {
      if (shorter[i] !== longer[j]) {
        if (++diffs > 1) return false;
        j++; // skip char in longer string
      } else {
        i++;
        j++;
      }
    }
    return true;
  }