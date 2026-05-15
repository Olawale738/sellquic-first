import { NextResponse } from 'next/server';
import { db, authAdmin } from '@/lib/firebase-admin';

export async function GET(request: Request) {
  try {
    // 1. Auth Check
    const idToken = request.headers.get('authorization')?.split('Bearer ')[1];
    if (!idToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    if (userDoc.data()?.role !== 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // 2. Fetch Active Subscribers
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('subscription.planId', 'in', ['starter', 'standard', 'growth']).get();
    
    const subscribers = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
            id: doc.id,
            name: d.displayName,
            email: d.email,
            plan: d.subscription.planId,
            status: d.subscription.status,
            startDate: d.subscription.startDate,
            endDate: d.subscription.endDate,
            amount: ({ starter: 35, standard: 70, growth: 200, free: 0 } as Record<string, number>)[d.subscription.planId] ?? 0
        };
    });

    // 3. Calculate MRR (Monthly Recurring Revenue)
    const mrr = subscribers.reduce((acc, sub) => acc + sub.amount, 0);

    return NextResponse.json({ subscribers, mrr });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
