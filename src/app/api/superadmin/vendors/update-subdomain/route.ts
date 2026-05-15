
import { NextResponse } from 'next/server';
import { db, authAdmin } from '@/lib/firebase-admin';
import { slugify } from '@/lib/utils';

export async function POST(request: Request) {
    try {
        // 1. Authenticate superadmin
        const idToken = request.headers.get('authorization')?.split('Bearer ')[1];
        if (!idToken) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const decodedToken = await authAdmin.verifyIdToken(idToken);
        const adminUserDoc = await db.collection('users').doc(decodedToken.uid).get();
        if (adminUserDoc.data()?.role !== 'superadmin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // 2. Validate input
        const { storeId, newSubdomain } = await request.json();
        if (!storeId || !newSubdomain) {
            return NextResponse.json({ error: 'Missing storeId or newSubdomain' }, { status: 400 });
        }

        const sanitizedSubdomain = slugify(newSubdomain);
        if (!sanitizedSubdomain) {
            return NextResponse.json({ error: 'Invalid subdomain format.' }, { status: 400 });
        }


        // 3. Check for uniqueness
        const storesRef = db.collection('stores');
        const q = storesRef.where('subdomain', '==', sanitizedSubdomain);
        const snapshot = await q.get();

        if (!snapshot.empty) {
            // Check if the conflicting store is the one we're trying to update
            if (snapshot.docs[0].id !== storeId) {
                return NextResponse.json({ error: 'Subdomain already in use.' }, { status: 409 });
            }
        }

        // 4. Update the document
        const storeRef = db.collection('stores').doc(storeId);
        await storeRef.update({
            subdomain: sanitizedSubdomain
        });

        return NextResponse.json({ success: true, message: `Subdomain updated successfully.`, sanitizedSubdomain });

    } catch (error: any) {
        console.error("Update subdomain error:", error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
