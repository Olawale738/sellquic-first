import { NextResponse } from 'next/server';
import { db, authAdmin } from '@/lib/firebase-admin';

// GET — fetch current pricing (public, used by subscription page)
export async function GET() {
  try {
    const doc = await db.collection('settings').doc('platform').get();
    if (!doc.exists) {
      return NextResponse.json({ success: false, message: 'Pricing not configured' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: doc.data() });
  } catch (err) {
    console.error('[API Pricing GET]', err);
    return NextResponse.json({ success: false, message: 'Failed to fetch pricing' }, { status: 500 });
  }
}

// POST — update pricing (super admin only)
export async function POST(request: Request) {
  try {
    // Admin Authentication Check
    const idToken = request.headers.get('authorization')?.split('Bearer ')[1];
    if (!idToken) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    if (userDoc.data()?.role !== 'superadmin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { plans, launchOffer, trial, commissionPercentage } = body;

    const updatePayload: any = {};
    if (plans) updatePayload.plans = plans;
    if (launchOffer) updatePayload.launchOffer = launchOffer;
    if (trial) updatePayload.trial = trial;
    if (commissionPercentage !== undefined) updatePayload.commissionPercentage = commissionPercentage;

    if (Object.keys(updatePayload).length === 0) {
        return NextResponse.json({ success: false, message: 'No valid data provided for update.' }, { status: 400 });
    }

    await db.collection('settings').doc('platform').set(updatePayload, { merge: true });

    return NextResponse.json({ success: true, message: 'Pricing updated' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[API Pricing POST]', err);
    return NextResponse.json({ success: false, message: 'Failed to update pricing', error: msg }, { status: 500 });
  }
}
