import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { kv } from '@vercel/kv';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');

    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = Timestamp.now();

    let trialExpiredCount = 0;
    let paidExpiredCount = 0;
    const storeIdsToClear: string[] = [];

    console.log('🔍 Starting subscription expiry check...');

    // 1. Expired trials → mark expired + suspend stores
    const expiredTrialsSnap = await db
      .collection('users')
      .where('subscription.status', '==', 'trial')
      .where('subscription.trialEndsAt', '<=', now)
      .get();

    for (const userDoc of expiredTrialsSnap.docs) {
      const userData = userDoc.data();

      if (userData.isBetaTester) continue;

      const batch = db.batch();

      batch.update(userDoc.ref, {
        'subscription.status': 'expired',
        'subscription.expiredAt': FieldValue.serverTimestamp(),
        'subscription.updatedAt': FieldValue.serverTimestamp(),
        hasUsedTrial: true,
        updatedAt: FieldValue.serverTimestamp(),
      });

      const activePeriodsSnap = await userDoc.ref
        .collection('ai_credit_periods')
        .where('status', '==', 'active')
        .limit(10)
        .get();

      activePeriodsSnap.docs.forEach((periodDoc) => {
        const period = periodDoc.data();

        if (period.source === 'trial') {
          batch.update(periodDoc.ref, {
            status: 'expired',
            remainingCredits: 0,
            expiredAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      });

      const storesSnap = await db
        .collection('stores')
        .where('sellerId', '==', userDoc.id)
        .get();

      storesSnap.docs.forEach((storeDoc) => {
        storeIdsToClear.push(storeDoc.id);

        batch.set(
          storeDoc.ref,
          {
            status: 'suspended',
            suspensionReason: 'subscription_expired',
            aiAssistant: {
              enabled: false,
              channels: {
                web: false,
                whatsapp: false,
                instagram: false,
              },
              updatedAt: FieldValue.serverTimestamp(),
            },
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      });

      await batch.commit();
      trialExpiredCount++;
    }

    // 2. Expired paid subscriptions → mark expired + suspend stores
    const paidUsersSnap = await db
      .collection('users')
      .where('subscription.status', '==', 'active')
      .get();

    for (const userDoc of paidUsersSnap.docs) {
      const userData = userDoc.data();
      const subscription = userData.subscription;

      if (userData.isBetaTester) continue;

      const endDate = subscription?.endDate;

      const isExpired =
        endDate &&
        (
          endDate.toMillis?.() <= now.toMillis() ||
          new Date(endDate).getTime() <= now.toMillis()
        );

      if (!isExpired) continue;

      const batch = db.batch();

      batch.update(userDoc.ref, {
        'subscription.status': 'expired',
        'subscription.expiredAt': FieldValue.serverTimestamp(),
        'subscription.updatedAt': FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      const activePeriodsSnap = await userDoc.ref
        .collection('ai_credit_periods')
        .where('status', '==', 'active')
        .limit(10)
        .get();

      activePeriodsSnap.docs.forEach((periodDoc) => {
        batch.update(periodDoc.ref, {
          status: 'expired',
          remainingCredits: 0,
          expiredAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      });

      const storesSnap = await db
        .collection('stores')
        .where('sellerId', '==', userDoc.id)
        .get();

      storesSnap.docs.forEach((storeDoc) => {
        storeIdsToClear.push(storeDoc.id);

        batch.set(
          storeDoc.ref,
          {
            status: 'suspended',
            suspensionReason: 'subscription_expired',
            aiAssistant: {
              enabled: false,
              channels: {
                web: false,
                whatsapp: false,
                instagram: false,
              },
              updatedAt: FieldValue.serverTimestamp(),
            },
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      });

      await batch.commit();
      paidExpiredCount++;
    }

    await Promise.all(
      storeIdsToClear.map((storeId) =>
        kv.del(`store_context_v4:${storeId}`).catch(() => null)
      )
    );

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      trialsExpired: trialExpiredCount,
      paidExpired: paidExpiredCount,
      storesSuspended: storeIdsToClear.length,
      message: `Expired ${trialExpiredCount} trials and ${paidExpiredCount} paid subscriptions.`,
    });
  } catch (error) {
    console.error('❌ Error in subscription expiry cron:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}