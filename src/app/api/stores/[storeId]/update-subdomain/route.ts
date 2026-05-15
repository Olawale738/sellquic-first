
import { NextResponse } from 'next/server';
import { db, authAdmin } from '@/lib/firebase-admin';
import { slugify } from '@/lib/utils';

export async function POST(request: Request, { params }: { params: { storeId: string } }) {
    try {
        // 1. Authenticate the request
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized: No token provided' }, { status: 401 });
        }
        const idToken = authHeader.split('Bearer ')[1];
        const decodedToken = await authAdmin.verifyIdToken(idToken);
        const userId = decodedToken.uid;

        // 2. Validate Inputs
        const { storeId } = params;
        const { newSubdomain } = await request.json();

        if (!storeId || !newSubdomain) {
            return NextResponse.json({ error: 'Missing storeId or newSubdomain' }, { status: 400 });
        }

        const cleanedSubdomain = slugify(newSubdomain);
        if (!cleanedSubdomain) {
            return NextResponse.json({ error: 'Invalid subdomain format.' }, { status: 400 });
        }

        // 3. Verify Ownership
        const storeRef = db.collection('stores').doc(storeId);
        const storeDoc = await storeRef.get();

        if (!storeDoc.exists || storeDoc.data()?.sellerId !== userId) {
            return NextResponse.json({ error: 'Forbidden: You do not own this store.' }, { status: 403 });
        }

        // 4. Check for Uniqueness
        const storesCollection = db.collection('stores');
        const q = storesCollection.where('subdomain', '==', cleanedSubdomain);
        const querySnapshot = await q.get();

        if (!querySnapshot.empty) {
            // Check if the found store is the user's own store (i.e., they are just re-saving the same name)
            const isOwnStore = querySnapshot.docs[0].id === storeId;
            if (!isOwnStore) {
                 return NextResponse.json({ error: `The subdomain "${cleanedSubdomain}" is already taken.` }, { status: 409 });
            }
        }
        
        // 5. Update the Document
        await storeRef.update({
            subdomain: cleanedSubdomain,
            updatedAt: new Date(),
        });
        
        return NextResponse.json({ success: true, message: 'Subdomain updated successfully.' });

    } catch (error: any) {
        console.error("Error updating subdomain:", error);
        if (error.code === 'auth/id-token-expired') {
            return NextResponse.json({ error: 'Token expired. Please re-authenticate.' }, { status: 401 });
        }
        return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
    }
}
