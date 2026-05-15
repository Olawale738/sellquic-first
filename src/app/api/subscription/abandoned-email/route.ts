
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { sendAbandonedSubscriptionEmail } from '@/lib/resend';

export async function POST(request: Request) {
  try {
    const { userId, email, name, reference } = await request.json();

    // Check if payment was completed using this reference
    const txSnap = await db.collection('transactions')
      .where('paystackReference', '==', reference)
      .where('status', '==', 'completed')
      .limit(1)
      .get();

    // If they paid, do nothing
    if (!txSnap.empty) {
      return NextResponse.json({ skipped: true, reason: 'payment completed' });
    }

    // Skip if this exact reference was already processed
    const alreadySentSnap = await db.collection('subscription_attempts')
      .where('reference', '==', reference)
      .limit(1)
      .get();

    if (!alreadySentSnap.empty) {
      return NextResponse.json({ skipped: true, reason: 'already processed' });
    }

    await sendAbandonedSubscriptionEmail({ to: email, name });

    // Log it
    await db.collection('subscription_attempts').add({
      userId,
      userEmail: email,
      userName: name,
      reference,
      emailSent: true,
      status: 'abandoned',
      createdAt: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Abandoned email error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
