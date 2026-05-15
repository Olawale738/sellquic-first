
import { NextResponse } from 'next/server';
import { db, authAdmin } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// This new endpoint logs the initial domain request BEFORE payment.
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const userId = decodedToken.uid;
    const userEmail = decodedToken.email || 'unknown';

    const { domain, reference, storeId, price } = await request.json();

    if (!domain || !reference || !storeId || !price) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const requestRef = db.collection('domain_requests').doc();
    await requestRef.set({
      id: requestRef.id,
      storeId,
      userId,
      userEmail,
      domain,
      status: 'pending_payment', // Initial status
      amount: price,
      paymentReference: reference,
      createdAt: FieldValue.serverTimestamp(),
      provider: 'manual_concierge',
    });

    return NextResponse.json({ success: true, message: 'Request logged successfully.' });

  } catch (error: any) {
    console.error("Domain Request Logging Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
