'use server';

import { NextResponse } from 'next/server';
import { db, authAdmin } from '@/lib/firebase-admin';

async function verifySuperAdmin(request: Request) {
  const idToken = request.headers.get('authorization')?.split('Bearer ')[1];
  if (!idToken) return null;

  const decoded = await authAdmin.verifyIdToken(idToken);
  const userDoc = await db.collection('users').doc(decoded.uid).get();

  if (userDoc.data()?.role !== 'superadmin') return null;
  return decoded;
}

export async function GET(request: Request) {
  try {
    const user = await verifySuperAdmin(request);
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const topupsSnap = await db.collectionGroup('credit_topups')
      .where('status', 'in', ['completed', 'granted'])
      .orderBy('paidAt', 'desc')
      .limit(50)
      .get();

    const userIds = Array.from(
      new Set(
        topupsSnap.docs
          .map(d => d.ref.parent.parent?.id)
          .filter(Boolean)
      )
    ) as string[];

    const userMap = new Map<string, any>();

    if (userIds.length > 0) {
      for (let i = 0; i < userIds.length; i += 30) {
        const chunk = userIds.slice(i, i + 30);

        const usersSnap = await db
          .collection('users')
          .where('__name__', 'in', chunk)
          .get();

        usersSnap.docs.forEach(doc => {
          userMap.set(doc.id, doc.data());
        });
      }
    }

    let totalTopUpRevenue = 0;

    const topups = topupsSnap.docs.map(doc => {
      const data = doc.data();
      const userId = doc.ref.parent.parent?.id || null;
      const userData = userId ? userMap.get(userId) : null;

      totalTopUpRevenue += Number(data.amount || 0);

      return {
        id: doc.id,
        userId,
        userName: userData?.displayName || 'Unknown',
        userEmail: userData?.email || 'N/A',
        amount: Number(data.amount || 0),
        credits: Number(data.credits || 0),
        status: data.status || 'completed',
        source: data.source || null,
        reason: data.reason || null,
        periodId: data.periodId || null,
        month: data.month || null,
        paidAt: data.paidAt || data.createdAt || null,
        paystackReference: data.paystackReference || null,
      };
    });

    return NextResponse.json({ topups, totalTopUpRevenue });
  } catch (error: any) {
    console.error('Superadmin Topups GET Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}