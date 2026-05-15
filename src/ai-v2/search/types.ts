import type { ProductV2, ResolvedBy } from '../types';

export type ProductSearchStatus =
  | 'single_match'
  | 'multiple_matches'
  | 'no_match';

export type ProductSearchProvider =
  | 'typesense'
  | 'firestore_weighted_fallback';

export type ProductSearchResult = {
  status: ProductSearchStatus;
  confidence: number;
  resolvedBy?: ResolvedBy;
  products: ProductV2[];
  reason: string;
  provider: ProductSearchProvider;
  debug?: {
    query?: string;
    normalizedQuery?: string;
    matchedTokens?: string[];
    scores?: Array<{
      productId: string;
      name: string;
      score: number;
      reason: string;
      matchedTokens: string[];
    }>;
  };
};

export type ProductSearchInput = {
  query: string;
  products: ProductV2[];
  limit?: number;
  storeId?: string;
};