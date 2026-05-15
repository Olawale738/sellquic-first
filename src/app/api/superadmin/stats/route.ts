import { NextResponse } from 'next/server';
import { db, authAdmin } from '@/lib/firebase-admin';
import { startOfToday } from 'date-fns';

export async function GET(request: Request) {
  try {
    // 1. Authenticate
    const idToken = request.headers.get('authorization')?.split('Bearer ')[1];
    if (!idToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    if (userDoc.data()?.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 2. References
    const usersRef = db.collection('users');
    const transactionsRef = db.collection('transactions');

    // ✅ Count Vendors — treat all users as vendors (for now)
    const vendorsSnap = await usersRef.count().get();
    const vendorsCount = vendorsSnap.data().count;

    // DAU (last 24h)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const activeVendorsSnap = await usersRef
      .where('lastSeen', '>=', yesterday)
      .count()
      .get();

    const dauCount = activeVendorsSnap.data().count;

    // Total completed transactions
    const txnSnap = await transactionsRef
      .where('status', '==', 'completed')
      .count()
      .get();
    const txnCount = txnSnap.data().count;

    // Today signups
    const todayStart = startOfToday();
    const todaySignupsSnap = await usersRef
      .where('createdAt', '>=', todayStart)
      .count()
      .get();
    const newSignupsToday = todaySignupsSnap.data().count;

    // Revenue
    const revenueSnap = await transactionsRef
      .where('status', '==', 'completed')
      .select('amount', 'type', 'domain')
      .get();

    let totalSubscriptionRevenueInPesewas = 0;
    let totalDomainRevenueInGHS = 0;

    revenueSnap.forEach(doc => {
      const data = doc.data();
      const amount = data.amount || 0;
      const type = data.type;

      // detect domain purchases even if "type" missing
      const isDomain = type === 'domain_purchase' || !!data.domain;

      if (isDomain) {
        totalDomainRevenueInGHS += amount; // stored in GHS for domains
      } else {
        totalSubscriptionRevenueInPesewas += amount; // pesewas for subscriptions
      }
    });

    return NextResponse.json({
      vendors: vendorsCount,
      dau: dauCount,
      newSignupsToday,
      transactions: txnCount,
      subscriptionRevenue: totalSubscriptionRevenueInPesewas / 100,
      domainRevenue: totalDomainRevenueInGHS,
    });

  } catch (error: any) {
    console.error('Stats API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
