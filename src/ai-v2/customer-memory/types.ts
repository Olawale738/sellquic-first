import type { Timestamp } from 'firebase-admin/firestore';

/**
 * Cached snapshot of a customer's history with this store.
 *
 * Lives at `ai_conversations/{convId}.customerMemory`. Refreshed when
 * stale (> 7 days) or when phone changes. Never used to display order
 * details unless the customer asks; primary use is greeting personalization
 * and skipping redundant phone asks in support flows.
 */
export interface CustomerMemory {
  /** Phone we used to fetch this memory (canonical local form, e.g. 0507...) */
  phone: string;
  /** Customer's name from most recent order, if any */
  name: string | null;
  /** Whether this customer has any non-cancelled orders */
  isReturningCustomer: boolean;
  /** Recent orders (newest first, max 3) — minimal fields only */
  recentOrders: Array<{
    id: string;
    totalAmount: number;
    itemSummary: string;       // "Coach Bag (Brown), Tote Bag and 1 more"
    createdAtMs: number | null;
    status: string | null;
  }>;
  /** When this snapshot was taken */
  fetchedAt: Timestamp;
}

export const CUSTOMER_MEMORY_TTL_DAYS = 7;