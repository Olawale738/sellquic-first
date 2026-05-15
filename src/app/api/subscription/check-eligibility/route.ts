
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ success: false, message: 'Missing userId' }, { status: 400 });
    }

    // Check if user has paid before
    const hasSubscriptionHistory = await db.collection('transactions')
      .where('userId', '==', userId)
      .where('type', '==', 'subscription')
      .where('status', '==', 'completed')
      .limit(1)
      .get();

    const hasPaidBefore = !hasSubscriptionHistory.empty;

    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    const isEligible = userData?.signupDiscountEligible === true;
    const notUsed = userData?.signupDiscountUsed !== true;

    // ✅ Eligible for NEXT payment (even if subscription expired and they're back on free)
    const isEligibleForSignupDiscount = isEligible && notUsed && hasPaidBefore;

    return NextResponse.json({
      success: true,
      isEligibleForSignupDiscount,
    });
  } catch (err: any) {
    console.error('Check eligibility error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
