// src/lib/stock.ts
// Shared stock deduction utility — used by create-order and paystack webhook

import { db } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

type OrderItem = {
  productId: string;
  quantity: number;
  variantId?: string | null;
  selectedVariant?: { id?: string } | null;
};

/**
 * Deducts stock for each item in an order.
 * - Only deducts if product.manageStock === true
 * - Handles simple products (stock field) and variant products (variants[].stock)
 * - Atomic batch write — all deductions succeed or none do
 * - Non-blocking — never throws, logs errors instead
 */
export async function deductOrderStock(items: OrderItem[]): Promise<void> {
  if (!items || items.length === 0) return;

  try {
    // Fetch all unique products in one round trip
    const uniqueProductIds = Array.from(
      new Set(items.map(i => i.productId).filter(Boolean))
    );

    if (uniqueProductIds.length === 0) return;

    const productRefs = uniqueProductIds.map(pid => db.collection('products').doc(pid));
    const productDocs = await db.getAll(...productRefs);

    const productsById = new Map<string, any>();
    for (const doc of productDocs) {
      if (doc.exists) productsById.set(doc.id, { id: doc.id, ...doc.data() });
    }

    const batch = db.batch();
    let hasUpdates = false;

    for (const item of items) {
      const product = productsById.get(item.productId);

      // Skip products not found or not tracking stock
      if (!product || !product.manageStock) continue;

      let variantId = item.variantId || (item as any).selectedVariant?.id || null;

// Fallback: find variant by name if ID is missing
if (!variantId && (item as any).variantName && Array.isArray(product.variants)) {
  const matchByName = product.variants.find(
    (v: any) => v.name?.toLowerCase() === (item as any).variantName?.toLowerCase()
  );
  if (matchByName) variantId = matchByName.id;
}

      if (variantId && Array.isArray(product.variants) && product.variants.length > 0) {
        // ── Variant product ──────────────────────────────────────────────────
        const variantIndex = product.variants.findIndex(
          (v: any) => String(v.id) === String(variantId)
        );

        if (variantIndex === -1) {
          console.warn(`[Stock] Variant ${variantId} not found on product ${item.productId} — skipping`);
          continue;
        }

        const currentStock = Number(product.variants[variantIndex].stock ?? 0);
        const newStock = Math.max(0, currentStock - item.quantity);

        const updatedVariants = [...product.variants];
updatedVariants[variantIndex] = {
  ...updatedVariants[variantIndex],
  stock: newStock,
};

batch.update(db.collection('products').doc(item.productId), {
  variants: updatedVariants,
  updatedAt: FieldValue.serverTimestamp(),
});
hasUpdates = true;

// Update the in-memory product so subsequent items for the same product
// read the already-updated variant stock, not the stale original
productsById.set(item.productId, { ...product, variants: updatedVariants });

        console.log(`[Stock] ${item.productId} variant ${variantId}: ${currentStock} → ${newStock}`);

      } else {
        // ── Simple product ───────────────────────────────────────────────────
        const currentStock = Number(product.stock ?? 0);
        const newStock = Math.max(0, currentStock - item.quantity);

        batch.update(db.collection('products').doc(item.productId), {
          stock: newStock,
          updatedAt: FieldValue.serverTimestamp(),
        });
        hasUpdates = true;

        console.log(`[Stock] ${item.productId}: ${currentStock} → ${newStock}`);
      }
    }

    if (hasUpdates) {
      await batch.commit();
      console.log(`[Stock] ✅ Deducted stock for ${items.length} item(s)`);
    }

  } catch (err) {
    // Non-blocking — log but never crash the order flow
    console.error('[Stock] ❌ Deduction failed:', err);
  }
}