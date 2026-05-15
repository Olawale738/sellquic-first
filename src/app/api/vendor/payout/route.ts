'use server';

import { NextResponse } from 'next/server';
import { authAdmin, db } from '@/lib/firebase-admin';
import { kv } from '@vercel/kv';

export async function POST(request: Request) {
  // 1. Authenticate Request
  const idToken = request.headers.get('authorization')?.split('Bearer ')[1];
  if (!idToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let decodedToken;
  try {
    decodedToken = await authAdmin.verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const { uid } = decodedToken;
  const { bank_code, account_number, bank_name, business_name, storeId } = await request.json();

  if (!bank_code || !account_number || !bank_name || !business_name || !storeId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
  if (!paystackSecret) {
    console.error('Paystack secret key is not configured.');
    return NextResponse.json({ error: 'Payment service not configured' }, { status: 500 });
  }

  try {
    // 2. Verify user owns the store
    const storeRef = db.collection('stores').doc(storeId);
    const storeDoc = await storeRef.get();
    if (!storeDoc.exists || storeDoc.data()?.sellerId !== uid) {
      return NextResponse.json({ error: 'Forbidden: You do not own this store.' }, { status: 403 });
    }
    
    // 3. Fetch Dynamic Commission Rate
    // We check the global settings to see what % the platform takes
    const settingsDoc = await db.collection('settings').doc('platform').get();
    let platformCommission = 0; // Default fallback
    
    if (settingsDoc.exists) {
        // Use nullish coalescing to allow 0% commission
        platformCommission = settingsDoc.data()?.commissionPercentage ?? 0;
    }

    // 4. Create (or Update) Subaccount on Paystack
    // We create a new subaccount every time to ensure details are fresh. 
    // Paystack handles duplicates gracefully (returns existing code if details match).
    const paystackResponse = await fetch('https://api.paystack.co/subaccount', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        business_name: business_name, // This is the VERIFIED LEGAL NAME from frontend
        settlement_bank: bank_code,
        account_number: account_number,
        percentage_charge: platformCommission, // Dynamic Fee
        description: `Payout for ${business_name} on SellQuic`,
      }),
    });

    const paystackData = await paystackResponse.json();

    if (!paystackData.status) {
      console.error('Paystack Subaccount Error:', paystackData.message);
      return NextResponse.json({ error: paystackData.message || 'Failed to connect bank account.' }, { status: 400 });
    }

    const subaccountCode = paystackData.data.subaccount_code;

    // 5. Save to Firestore
    await storeRef.update({
      paymentInfo: {
        bank_name,
        bank_code,
        account_number,
        account_name: business_name, // Save the verified name
        subaccount_code: subaccountCode,
        split_configured: true,
        commission_rate_at_setup: platformCommission // Good for audit trails
      },
    });

    await kv.del(`store_context:${storeId}`).catch(() => {});

    return NextResponse.json({
      success: true,
      message: 'Payout details configured successfully.',
      subaccount_code: subaccountCode,
    });

  } catch (error) {
    console.error('Error setting up payout:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to set up payout', details: errorMessage }, { status: 500 });
  }
}
