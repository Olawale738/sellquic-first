import { NextResponse } from 'next/server';
import { db, authAdmin } from '@/lib/firebase-admin';
import { sendSms } from '@/lib/mnotify';
import { formatPhoneNumberForApi } from '@/lib/utils';
import { MNotifyResponse } from '@/lib/mnotify';
   
export async function POST(request: Request) {
    try {
        const idToken = request.headers.get('authorization')?.split('Bearer ')[1];
        if (!idToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const decodedToken = await authAdmin.verifyIdToken(idToken);
        const userDoc = await db.collection('users').doc(decodedToken.uid).get();
        if (!userDoc.exists || userDoc.data()?.role !== 'superadmin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
    } catch (error) {
        return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { message, group, numbers: specificNumbers } = body;
    if (!message || !group) return NextResponse.json({ error: 'Missing message or recipient group' }, { status: 400 });

    let phoneNumbers: (string | null)[] = [];

    try {
        if (group === 'specific') {
            if (!specificNumbers || !Array.isArray(specificNumbers)) {
                return NextResponse.json({ error: 'Missing numbers for specific group' }, { status: 400 });
            }
            phoneNumbers = specificNumbers;

        } else if (group === 'no_products_30' || group === 'no_products_60') {
            const productsSnap = await db.collection('products').get();
            const activeStoreIds = new Set<string>();
            productsSnap.docs.forEach(doc => {
                if (doc.data().isArchived !== true) activeStoreIds.add(doc.data().storeId);
            });

            const storesSnap = await db.collection('stores').get();
            const sellersWithProducts = new Set<string>();
            storesSnap.docs.forEach(doc => {
                if (activeStoreIds.has(doc.id)) sellersWithProducts.add(doc.data().sellerId);
            });

            const now = new Date();
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

            const usersSnap = await db.collection('users').get();
            usersSnap.docs.forEach(doc => {
                const data = doc.data();
                if (data.role === 'superadmin' || data.role === 'admin') return;
                if (sellersWithProducts.has(doc.id)) return;
                if (!data.phone) return;

                let createdAt: Date | null = null;
                if (data.createdAt) {
                    createdAt = typeof data.createdAt.toDate === 'function'
                        ? data.createdAt.toDate()
                        : new Date(data.createdAt);
                }
                if (!createdAt) return;

                if (group === 'no_products_30') {
                    if (createdAt <= thirtyDaysAgo && createdAt > sixtyDaysAgo) phoneNumbers.push(data.phone);
                } else {
                    if (createdAt <= sixtyDaysAgo) phoneNumbers.push(data.phone);
                }
            });

        } else {
            const usersRef = db.collection('users');
            let usersQuery;
            switch (group) {
                case 'paid': usersQuery = usersRef.where('subscription.planId', 'in', ['starter', 'standard', 'growth']); break;
                case 'free': usersQuery = usersRef.where('subscription.status', '==', 'pending_plan'); break;
                case 'expired': usersQuery = usersRef.where('subscription.status', '==', 'expired'); break;
                default: usersQuery = usersRef; break;
            }
            const querySnapshot = await usersQuery.get();
            phoneNumbers.push(...querySnapshot.docs.map(doc => doc.data().phone));
        }

        const uniquePhoneNumbers = Array.from(new Set(
            phoneNumbers
                .filter(phone => !!phone)
                .map(phone => formatPhoneNumberForApi(phone!))
                .filter(phone => !!phone)
        ));

        if (uniquePhoneNumbers.length === 0) {
            return NextResponse.json({ message: 'No valid phone numbers found.', sentCount: 0 });
        }

        const results = await Promise.allSettled(uniquePhoneNumbers.map(number => sendSms(number, message)));
        const successfulSends = results.filter(r => r.status === 'fulfilled' && (r.value as MNotifyResponse).status === 'SUCCESS').length;

        return NextResponse.json({
            message: `Broadcast sent. ${successfulSends} successful, ${results.length - successfulSends} failed.`,
            sentCount: successfulSends,
        });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        return NextResponse.json({ error: 'Failed to broadcast SMS', details: errorMessage }, { status: 500 });
    }
}