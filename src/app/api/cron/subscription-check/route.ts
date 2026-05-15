import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = Timestamp.now();

    let trialDowngradedCount = 0;
    let paidExpiredCount = 0;

    console.log('🔍 Starting subscription expiry check...');

    // 1. Expired trials → downgrade to free active
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
        'subscription.planId': 'free',
        'subscription.status': 'active',
        'subscription.billingCycle': 'monthly',
        'subscription.endDate': null,
        'subscription.trialEndsAt': null,
        'subscription.downgradedAt': FieldValue.serverTimestamp(),
        'subscription.updatedAt': FieldValue.serverTimestamp(),
        hasUsedTrial: true,
        updatedAt: FieldValue.serverTimestamp(),
      });

      const activePeriodsSnap = await userDoc.ref
        .collection('ai_credit_periods')
        .where('status', '==', 'active')
        .limit(10)
        .get();

      activePeriodsSnap.docs.forEach(periodDoc => {
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

        storesSnap.docs.forEach(storeDoc => {
          batch.set(
            storeDoc.ref,
            {
              status: 'active',
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
      trialDowngradedCount++;
    }

    // 2. Expired paid subscriptions → mark expired/suspended behavior remains
    const paidUsersSnap = await db
      .collection('users')
      .where('subscription.status', '==', 'active')
      .where('subscription.planId', '!=', 'free')
      .get();

    for (const userDoc of paidUsersSnap.docs) {
      const userData = userDoc.data();
      const subscription = userData.subscription;

      if (userData.isBetaTester) continue;

      if (subscription?.endDate && subscription.endDate <= now) {
        const batch = db.batch();

        batch.update(userDoc.ref, {
          'subscription.status': 'expired',
          'subscription.expiredAt': FieldValue.serverTimestamp(),
          'subscription.updatedAt': FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        const storesSnap = await db
          .collection('stores')
          .where('sellerId', '==', userDoc.id)
          .get();

        storesSnap.docs.forEach(storeDoc => {
          batch.set(
            storeDoc.ref,
            {
              status: 'suspended',
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        });

        await batch.commit();
        paidExpiredCount++;
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      trialsDowngraded: trialDowngradedCount,
      paidExpired: paidExpiredCount,
      message: `Downgraded ${trialDowngradedCount} expired trials and expired ${paidExpiredCount} paid subscriptions.`,
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