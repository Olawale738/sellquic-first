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

    // Get the disconnected domain
    const storeRef = db.collection('stores').doc(storeId);
    const storeDoc = await storeRef.get();
    const disconnectedDomain = storeDoc.data()?.disconnectedDomain;

    if (!disconnectedDomain) {
        return NextResponse.json({ error: "No disconnected domain found" }, { status: 400 });
    }

    // Restore it
    await storeRef.update({
      customDomain: disconnectedDomain,
      customDomainStatus: 'active', // Assume active since they own it and it was working
      disconnectedDomain: null // Clear the saved field
    });
    
    await kv.del(`store_context:${storeId}`).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
