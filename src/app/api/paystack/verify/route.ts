
'use server';

import { NextResponse } from 'next/server';



export async function POST(request: Request) {
  const id = `VERIFY-${Date.now()}`;

  try {
    const { reference } = await request.json();

    console.log(`[${id}] 🔍 Verifying reference: ${reference}`);

    if (!reference) {
      return NextResponse.json(
        { success: false, message: 'Missing reference' },
        { status: 400 }
      );
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      console.error(`[${id}] ❌ Missing PAYSTACK_SECRET_KEY`);
      return NextResponse.json(
        { success: false, message: 'Server configuration error' },
        { status: 500 }
      );
    }

    // 🔐 VERIFY WITH PAYSTACK
    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();

    if (!data?.status || data?.data?.status !== 'success') {
      console.warn(`[${id}] ❌ Verification failed`, data?.message);
      return NextResponse.json(
        { success: false, message: 'Payment not successful' },
        { status: 400 }
      );
    }

    console.log(`[${id}] ✅ Payment verified successfully`);

    // ⚠️ IMPORTANT:
    // NO DATABASE WRITES HERE.
    // Webhook handles subscriptions, credits, coupons, affiliates.

    return NextResponse.json(
      {
        success: true,
        reference,
        amount: data.data.amount,
        paidAt: data.data.paid_at,
      },
      { status: 200 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[${id}] 💥 Verification error:`, msg);

    return NextResponse.json(
      { success: false, message: 'Verification error', error: msg },
      { status: 500 }
    );
  }
}
