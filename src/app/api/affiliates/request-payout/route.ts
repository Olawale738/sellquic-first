
import { NextResponse } from 'next/server';
import { db, authAdmin } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: Request) {
    try {
        const idToken = request.headers.get('authorization')?.split('Bearer ')[1];
        if (!idToken) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        const decodedToken = await authAdmin.verifyIdToken(idToken);
        const userId = decodedToken.uid;
        
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const userData = userDoc.data()!;
        const availableBalance = userData.affiliateWallet?.available || 0;
        const payoutInfo = userData.payoutInfo;
        
        if (availableBalance < 60) {
            return NextResponse.json({ error: 'Minimum payout amount is GHS 60.' }, { status: 400 });
        }

        if (!payoutInfo || !payoutInfo.momoNumber || !payoutInfo.network || !payoutInfo.accountName) {
            return NextResponse.json({ error: 'Please set up your payout details before requesting a payout.' }, { status: 400 });
        }


        // Create payout request
        const payoutRef = db.collection('payoutRequests').doc();
        await payoutRef.set({
            userId,
            userName: userData.displayName,
            userEmail: userData.email,
            userPhone: userData.phone,
            payoutInfo: payoutInfo,
            amount: availableBalance,
            status: 'pending',
            createdAt: FieldValue.serverTimestamp(),
        });
        
        // Update user's wallet
        await userRef.update({
            'affiliateWallet.available': 0,
            'affiliateWallet.pendingPayout': FieldValue.increment(availableBalance)
        });

        return NextResponse.json({ success: true, message: 'Payout request submitted.' });

    } catch (error: any) {
        console.error("Payout Request Error:", error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
