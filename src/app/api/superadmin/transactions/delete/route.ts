
import { NextResponse } from 'next/server';
import { db, authAdmin } from '@/lib/firebase-admin';

export async function POST(request: Request) {
    try {
        // 1. Authenticate the superadmin
        const idToken = request.headers.get('authorization')?.split('Bearer ')[1];
        if (!idToken) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const decodedToken = await authAdmin.verifyIdToken(idToken);
        const adminUserDoc = await db.collection('users').doc(decodedToken.uid).get();
        if (adminUserDoc.data()?.role !== 'superadmin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // 2. Get the transaction ID from the request body
        const { transactionId } = await request.json();
        if (!transactionId) {
            return NextResponse.json({ error: 'Missing transactionId' }, { status: 400 });
        }
        
        // 3. Delete the document from Firestore
        await db.collection('transactions').doc(transactionId).delete();

        return NextResponse.json({ success: true, message: `Transaction ${transactionId} deleted.` });

    } catch (error: any) {
        console.error("Transaction Deletion Error:", error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
