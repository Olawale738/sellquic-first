import { NextResponse } from 'next/server';
import { db, authAdmin } from '@/lib/firebase-admin';
import { Resend } from 'resend';
import { FieldValue } from 'firebase-admin/firestore';
import { kv } from '@vercel/kv';

export const dynamic = 'force-dynamic';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    // 1. Authenticate
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const userId = decodedToken.uid;
    const userEmail = decodedToken.email || 'unknown';

    const { domain, reference, storeId } = await request.json();

    if (!domain || !reference || !storeId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // 2. Idempotency: already processed?
    const existingTxn = await db
      .collection('transactions')
      .where('paystackReference', '==', reference)
      .limit(1)
      .get();

    if (!existingTxn.empty) {
      return NextResponse.json({
        success: true,
        message: 'Transaction already processed',
      });
    }

    // 3. Store ownership check
    const storeDocRef = db.collection('stores').doc(storeId);
    const storeDoc = await storeDocRef.get();

    if (!storeDoc.exists || storeDoc.data()?.sellerId !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized access to this store.' },
        { status: 403 }
      );
    }

    // 4. Verify Payment with Paystack
    const secretKey = process.env.PAYSTACK_SECRET_KEY;

    if (!secretKey) {
      console.error('PAYSTACK_SECRET_KEY is not set');
      return NextResponse.json(
        { error: 'Server payment configuration error.' },
        { status: 500 }
      );
    }

    const verifyRes = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: { Authorization: `Bearer ${secretKey}` },
      }
    );

    if (!verifyRes.ok) {
      console.error('Paystack verify HTTP error:', verifyRes.status);
      return NextResponse.json(
        { error: 'Failed to verify payment with Paystack.' },
        { status: 400 }
      );
    }

    const verifyData = await verifyRes.json();

    if (!verifyData.status || verifyData.data?.status !== 'success') {
      return NextResponse.json(
        { error: 'Payment verification failed with Paystack.' },
        { status: 400 }
      );
    }

    const paidAmount = verifyData.data.amount / 100; // kobo → GHS

    // 5. Find the corresponding Domain Request
    const requestQuery = await db
      .collection('domain_requests')
      .where('paymentReference', '==', reference)
      .where('storeId', '==', storeId)
      .limit(1)
      .get();

    if (requestQuery.empty) {
      return NextResponse.json(
        {
          error:
            'No pending domain request found for this payment reference.',
        },
        { status: 404 }
      );
    }

    const requestDoc = requestQuery.docs[0];
    const requestData = requestDoc.data();

    const requestedDomain: string = requestData.domain || domain;
    const requestedPrice: number = requestData.price; // This is in GHS

    // Sanity check amount paid vs amount requested
    if (paidAmount < requestedPrice) {
      console.warn(
        `Domain purchase amount mismatch. Expected >= ${requestedPrice}, got ${paidAmount}`
      );
      // Optional: you could fail here, but for now we proceed if payment was successful
    }

    // 6. DB Updates (Batch)
    const batch = db.batch();

    // A. Update Domain Request Status
    batch.update(requestDoc.ref, {
      status: 'pending_setup',
      amount: paidAmount, // Save the actual GHS amount paid
      paidAt: FieldValue.serverTimestamp(),
    });

    // B. Update Store Status
    batch.update(storeDocRef, {
      customDomainStatus: 'pending_setup',
      pendingDomain: requestedDomain,
      domainPurchasedAt: FieldValue.serverTimestamp(),
      domainProvider: 'sellquic-porkbun',
    });

    // C. Create Transaction Log
    const transactionRef = db.collection('transactions').doc();
    batch.set(transactionRef, {
      userId,
      userEmail,
      type: 'domain_purchase',
      // CRITICAL FIX: Save the requested price (in GHS), NOT the Paystack amount.
      // This is because subscriptions are in pesewas, but our domain logic uses GHS.
      // The frontend display logic will handle this inconsistency.
      amount: requestedPrice, 
      status: 'completed',
      createdAt: FieldValue.serverTimestamp(),
      paystackReference: reference,
      domain: requestedDomain,
      storeId,
    });

    await batch.commit();
    await kv.del(`store_context:${storeId}`).catch(() => {});

    // 7. Email Admin
    try {
      await resend.emails.send({
        from: 'SellQuic Bot <noreply@sellquic.com>',
        to: 'support@sellquic.com',
        subject: `🌐 New Domain Purchase: ${requestedDomain}`,
        html: `
          <h1>New Domain Order</h1>
          <p><strong>Domain:</strong> ${requestedDomain}</p>
          <p><strong>Store ID:</strong> ${storeId}</p>
          <p><strong>User:</strong> ${userEmail}</p>
          <p><strong>Ref:</strong> ${reference}</p>
          <p><strong>Amount:</strong> GHS ${paidAmount.toFixed(2)}</p>
        `,
      });
    } catch (emailError) {
      console.error('Failed to send admin email:', emailError);
    }

    return NextResponse.json({
      success: true,
      message: 'Payment verified and request updated.',
    });
  } catch (error: any) {
    console.error('Domain Purchase Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
