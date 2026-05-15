import type { ProductSearchInput, ProductSearchResult } from './types';
import { searchProductsWithFirestoreFallback } from './firestoreProductSearchProvider';

export async function searchProducts(
  input: ProductSearchInput
): Promise<ProductSearchResult> {
  // Production architecture note:
  // This is the single search entry point for AI v2.
  // Later:
  // 1. If Typesense is configured, call Typesense first.
  // 2. If Typesense fails or returns weak/no results, fall back to Firestore weighted search.
  // 3. Handlers should never call raw resolver logic directly.

  return searchProductsWithFirestoreFallback(input);
}