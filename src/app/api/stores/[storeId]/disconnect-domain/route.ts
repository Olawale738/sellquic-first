import { NextResponse } from 'next/server';
import { db, authAdmin } from '@/lib/firebase-admin';
import { kv } from '@vercel/kv';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { storeId: string } }
) {
  try {
    const { storeId } = params;
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const token = authHeader.split('Bearer ')[1];
    await authAdmin.verifyIdToken(token);

    // Get current data first to save the domain name
    const storeDoc = await db.collection('stores').doc(storeId).get();
    const storeData = storeDoc.data();

    // Update with disconnect logic
    await db.collection('stores').doc(storeId).update({
      disconnectedDomain: storeData?.customDomain || storeData?.pendingDomain, // Save for reconnect
      customDomain: null,
      customDomainStatus: null,
      pendingDomain: null
    });
    
    await kv.del(`store_context:${storeId}`).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
