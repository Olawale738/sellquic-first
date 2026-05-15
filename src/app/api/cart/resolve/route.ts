'use server';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

type ResolveRequest = {
  storeId: string;
  items: { productId: string; quantity: number }[];
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ResolveRequest;

    const storeId = String(body?.storeId || '').trim();
    const items = Array.isArray(body?.items) ? body.items : [];

    if (!storeId || items.length === 0) {
      return NextResponse.json({ success: false, message: 'Missing storeId/items' }, { status: 400 });
    }

    const rawIds = items
  .map((i: any) => String(i?.productId || '').trim())
  .filter(Boolean);

const seen: Record<string, true> = {};
const productIds: string[] = [];

for (const id of rawIds) {
  if (!seen[id]) {
    seen[id] = true;
    productIds.push(id);
  }
}




    if (productIds.length === 0) {
      return NextResponse.json({ success: false, message: 'No valid productIds' }, { status: 400 });
    }

    // Firestore "in" supports max 30
    const chunks: string[][] = [];
    for (let i = 0; i < productIds.length; i += 30) chunks.push(productIds.slice(i, i + 30));

    const products: any[] = [];
    for (const chunk of chunks) {
      const snap = await db
        .collection('products')
        .where('__name__', 'in', chunk)
        .get();

      for (const doc of snap.docs) {
        const data = doc.data() as any;

        // enforce store match + not archived
        if (data.storeId !== storeId) continue;
        if (data.isArchived === true) continue;

        products.push({
          id: doc.id,
          name: data.name,
          price: data.price,
          images: data.images || [],
          stock: data.stock,
          storeId: data.storeId,
          // include variants if your cart uses them
          variants: data.variants || [],
        });
      }
    }

    return NextResponse.json({ success: true, products });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, message: e?.message || 'Failed to resolve products' },
      { status: 500 }
    );
  }
}
