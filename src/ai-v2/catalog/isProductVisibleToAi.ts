import type { ProductV2 } from '../types';
import { getProductAvailability } from './availability';

export function isProductVisibleToAi(product: ProductV2): boolean {
  return getProductAvailability(product).visible;
}