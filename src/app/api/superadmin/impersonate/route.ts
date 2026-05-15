
import { NextResponse } from 'next/server';
import { db, authAdmin } from '@/lib/firebase-admin';

export async function POST(request: Request) {
    try {
        // 1. Authenticate the request and verify superadmin role
        const idToken = request.headers.get('authorization')?.split('Bearer ')[1];
        if (!idToken) {
            return NextResponse.json({ error: 'Unauthorized: No token provided.' }, { status: 401 });
        }

        const decodedToken = await authAdmin.verifyIdToken(idToken);
        const requesterUid = decodedToken.uid;

        const userDoc = await db.collection('users').doc(requesterUid).get();
        if (!userDoc.exists || userDoc.data()?.role !== 'superadmin') {
             return NextResponse.json({ error: 'Forbidden: Requester is not a superadmin.' }, { status: 403 });
        }

        // 2. Get the target user ID from the request body
        const { targetUserId } = await request.json();
        if (!targetUserId) {
            return NextResponse.json({ error: 'Bad Request: targetUserId is required.' }, { status: 400 });
        }

        // 3. Create a custom token for the target user
        const customToken = await authAdmin.createCustomToken(targetUserId);

        // 4. Return the token
        return NextResponse.json({ token: customToken }, { status: 200 });

    } catch (error) {
        console.error("Error creating impersonation token:", error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        // Handle specific auth errors if needed
        if ((error as any).code === 'auth/id-token-expired') {
             return NextResponse.json({ error: 'Unauthorized: Token expired.' }, { status: 401 });
        }
        return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status: 500 });
    }
}
