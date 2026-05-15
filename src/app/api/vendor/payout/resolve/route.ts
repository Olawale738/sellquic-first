
'use server';

import { NextResponse } from 'next/server';
import { authAdmin } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  // 1. Authenticate
  const idToken = request.headers.get('authorization')?.split('Bearer ')[1];
  if (!idToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await authAdmin.verifyIdToken(idToken);
  } catch (error) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const { account_number, bank_code } = await request.json();

  if (!account_number || !bank_code) {
    return NextResponse.json({ error: 'Account number and bank code are required.' }, { status: 400 });
  }

  const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
  if (!paystackSecret) {
    console.error('Paystack secret key is not configured.');
    return NextResponse.json({ error: 'Payment service not configured' }, { status: 500 });
  }

  const url = `https://api.paystack.co/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
      },
    });

    const data = await response.json();

    if (!response.ok || !data.status) {
      return NextResponse.json({ error: data.message || 'Failed to resolve account.' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      account_name: data.data.account_name,
      account_number: data.data.account_number,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Account resolution failed', details: errorMessage }, { status: 500 });
  }
}
