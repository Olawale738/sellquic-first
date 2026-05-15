import { fetchAndCacheCustomerMemory } from './fetchCustomerMemory';
import type { TurnContext } from '../types';

/**
 * Fire-and-forget memory fetch when we just learned a customer's phone.
 *
 * Awaits the fetch (so subsequent turns see fresh cache) but never throws.
 * Callers should NOT branch on the return value for customer-facing copy
 * — memory is a quiet layer.
 */
export async function triggerMemoryFetch(
  ctx: TurnContext,
  phone: string,
): Promise<void> {
  try {
    await fetchAndCacheCustomerMemory(
      ctx.storeId,
      ctx.conversationId,
      phone,
      ctx.customer?.memory ?? null,
    );
  } catch (err) {
    console.error('[customer-memory] trigger failed:', err);
  }
}