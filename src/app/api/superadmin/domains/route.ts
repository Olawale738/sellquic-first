
import { NextResponse } from 'next/server';
import { db, authAdmin } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // 1. Verify Admin
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await authAdmin.verifyIdToken(token);
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();

    if (!userDoc.exists || userDoc.data()?.role !== 'superadmin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 2. Fetch Requests from Firestore
    const snapshot = await db.collection('domain_requests')
      .orderBy('createdAt', 'desc')
      .get();

    const requests = snapshot.docs.map(doc => {
      const data = doc.data();
      // Serialize Timestamp for the client
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null,
        activatedAt: data.activatedAt ? data.activatedAt.toDate().toISOString() : null,
      };
    });

    return NextResponse.json(requests);

  } catch (error: any) {
    console.error("Fetch Domain Requests Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
