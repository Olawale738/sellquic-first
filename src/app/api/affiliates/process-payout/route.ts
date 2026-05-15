
import { NextResponse } from 'next/server';
import { db, authAdmin } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { sendAffiliatePayoutApprovedEmail, sendAffiliatePayoutRejectedEmail } from '@/lib/resend';

export async function POST(request: Request) {
    try {
        const idToken = request.headers.get('authorization')?.split('Bearer ')[1];
        if (!idToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        
        const decodedToken = await authAdmin.verifyIdToken(idToken);
        const adminUserDoc = await db.collection('users').doc(decodedToken.uid).get();
        if (adminUserDoc.data()?.role !== 'superadmin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { requestId, action, reason } = await request.json();
        if (!requestId || !action || !['approve', 'reject'].includes(action)) {
            return NextResponse.json({ error: 'Missing requestId or invalid action' }, { status: 400 });
        }
        if (action === 'reject' && !reason) {
            return NextResponse.json({ error: 'A reason is required for rejection' }, { status: 400 });
        }


        const requestRef = db.collection('payoutRequests').doc(requestId);
        const requestDoc = await requestRef.get();

        if (!requestDoc.exists || requestDoc.data()?.status !== 'pending') {
            return NextResponse.json({ error: 'Request not found or already processed' }, { status: 404 });
        }

        const requestData = requestDoc.data()!;
        const affiliateRef = db.collection('users').doc(requestData.userId);
        const affiliateDoc = await affiliateRef.get();
        const affiliateData = affiliateDoc.data();

        if (!affiliateData) {
            return NextResponse.json({ error: 'Affiliate not found for this request' }, { status: 404 });
        }

        const batch = db.batch();

        if (action === 'approve') {
            batch.update(requestRef, { status: 'approved', processedAt: FieldValue.serverTimestamp() });
            batch.update(affiliateRef, {
                'affiliateWallet.pendingPayout': FieldValue.increment(-requestData.amount),
                'affiliateWallet.paid': FieldValue.increment(requestData.amount),
            });
            
            await sendAffiliatePayoutApprovedEmail({
                to: affiliateData.email,
                name: affiliateData.displayName,
                amount: requestData.amount,
            }).catch(console.error);

        } else { // 'reject'
             batch.update(requestRef, { 
                 status: 'rejected', 
                 processedAt: FieldValue.serverTimestamp(),
                 reason: reason // Save the reason
            });
             batch.update(affiliateRef, {
                'affiliateWallet.pendingPayout': FieldValue.increment(-requestData.amount),
                'affiliateWallet.available': FieldValue.increment(requestData.amount),
            });

            await sendAffiliatePayoutRejectedEmail({
                to: affiliateData.email,
                name: affiliateData.displayName,
                amount: requestData.amount,
                reason: reason,
            }).catch(console.error);
        }
        
        await batch.commit();

        return NextResponse.json({ success: true, message: `Request ${action}d.` });

    } catch (error: any) {
        console.error("Payout Processing Error:", error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
