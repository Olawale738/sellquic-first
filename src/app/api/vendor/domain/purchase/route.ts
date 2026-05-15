import { NextResponse } from 'next/server';
import { db, authAdmin } from '@/lib/firebase-admin';
import { addDomainToVercel } from '@/lib/vercel-api';

export async function POST(request: Request) {
  try {
    // 1. Authenticate
    const idToken = request.headers.get('authorization')?.split('Bearer ')[1];
    if (!idToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const userId = decodedToken.uid;

    const { domain, reference, storeId } = await request.json();

    if (!domain || !reference || !storeId) {
        return NextResponse.json({ error: 'Missing required parameters.' }, { status: 400 });
    }

    // 2. Verify Payment with Paystack (Crucial Security Step)
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
    });
    const verifyData = await verifyRes.json();

    if (!verifyData.status || verifyData.data.status !== 'success') {
        return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 });
    }
    
    // Check if amount is correct
    if (verifyData.data.amount < 250 * 100) {
        return NextResponse.json({ error: 'Incorrect payment amount for domain.' }, { status: 400 });
    }

    // 3. Manual Step Placeholder
    console.log(`[Domain] Manual Purchase Required for: ${domain}`);
    
    // 4. Update Firestore to 'pending_setup' status
    await db.collection('stores').doc(storeId).update({
        pendingDomain: domain,
        domainProvider: 'sellquic-manual', // Mark as manually handled
        domainPurchasedAt: new Date(),
        customDomainStatus: 'pending_setup'
    });

    // TODO: Send email/notification to admin to manually purchase and set up domain.

    return NextResponse.json({ success: true, message: 'Domain purchase request received. Setup is in progress.' });

  } catch (error: any) {
    console.error("Purchase API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
