import { NextResponse } from 'next/server';
import { db, authAdmin } from '@/lib/firebase-admin';

export async function GET(req: Request) {
  try {
    const idToken = req.headers.get('authorization')?.split('Bearer ')[1];

    if (!idToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const userId = decodedToken.uid;

    const now = new Date();

    const periodsSnap = await db
      .collection('users')
      .doc(userId)
      .collection('ai_credit_periods')
      .where('status', '==', 'active')
      .orderBy('periodEnd', 'desc')
      .limit(5)
      .get();

    const activeDoc = periodsSnap.docs.find(doc => {
      const data = doc.data();
      const periodStart = data.periodStart?.toDate?.();
      const periodEnd = data.periodEnd?.toDate?.();

      return periodStart && periodEnd && periodStart <= now && periodEnd > now;
    });

    if (!activeDoc) {
      return NextResponse.json({
        planId: null,

        periodId: null,
        usedCredits: 0,
        totalCredits: 0,
        remainingCredits: 0,
        percentUsed: 0,
        status: 'no_active_period',
      });
    }

    const data = activeDoc.data();

    const totalCredits = Number(data.totalCredits || 0);
    const usedCredits = Number(data.usedCredits || 0);
    const remainingCredits = Number(data.remainingCredits || 0);

    const percentUsed =
      totalCredits > 0 ? Math.min(100, (usedCredits / totalCredits) * 100) : 0;

    return NextResponse.json({
      planId: data.planId || 'free',
      periodId: activeDoc.id,
      billingCycle: data.billingCycle || 'monthly',
      periodStart: data.periodStart || null,
      periodEnd: data.periodEnd || null,
      usedCredits,
      totalCredits,
      remainingCredits,
      percentUsed: Math.round(percentUsed),
      status: data.status || 'active',
    });
  } catch (error) {
    console.error('Failed to fetch AI credit period:', error);
    return NextResponse.json(
      {
        planId: null,

        periodId: null,
        usedCredits: 0,
        totalCredits: 0,
        remainingCredits: 0,
        percentUsed: 0,
        status: 'error',
      },
      { status: 200 }
    );
  }
}