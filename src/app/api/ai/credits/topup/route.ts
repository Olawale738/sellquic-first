import { NextResponse } from 'next/server';
import { db, authAdmin } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: Request) {
  try {
    // 1. Auth check
    const idToken = request.headers.get('authorization')?.split('Bearer ')[1];
    if (!idToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const userId = decodedToken.uid;

    const { amount } = await request.json();

    // 2. Validate amount
    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount < 5 || numericAmount > 200) {
      return NextResponse.json({ error: 'Invalid amount. Must be between GHS 5 and GHS 200.' }, { status: 400 });
    }

    const credits = numericAmount * 10;

    // 3. Create pending top-up record
    const topupRef = db.collection('users').doc(userId).collection('credit_topups').doc();
    const topupDocId = topupRef.id;

    await topupRef.set({
      amount: numericAmount,
      credits,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
    });
    
    // 4. Initialize Paystack
    const userSnap = await db.collection('users').doc(userId).get();
    const userData = userSnap.data();
    if (!userData?.email) {
      return NextResponse.json({ error: 'User email not found.' }, { status: 400 });
    }

    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userData.email,
          amount: numericAmount * 100, // Paystack uses kobo/pesewas
          currency: 'GHS',
          // Note: NO callback_url here. We want the frontend to handle the close event!
          metadata: {
            type: 'ai_credit_topup',
            userId: userId,
            credits: credits,
            topupId: topupDocId,
            
          }
        }),
    });

    const paystackData = await paystackRes.json();
    
    if (!paystackData.status) {
        throw new Error(paystackData.message || 'Failed to initialize payment.');
    }

    // 5. Return everything to the frontend
    return NextResponse.json({ 
        success: true, 
        accessCode: paystackData.data.access_code, // Connects the frontend to this secure session
        reference: paystackData.data.reference,
        topupId: topupDocId,
    });

  } catch (error: any) {
    console.error('[topup/route.ts] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' }, 
      { status: 500 }
    );
  }
}