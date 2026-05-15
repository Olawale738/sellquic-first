
import { NextResponse } from 'next/server';
import { db, authAdmin } from '@/lib/firebase-admin';
import { Resend } from 'resend';

export const dynamic = 'force-dynamic';
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    // 1. Authenticate
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

    const { requestId, domain, storeId } = await request.json();

    if (!requestId || !domain || !storeId) {
        return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const batch = db.batch();

    // 2. Update the Request Status
    const requestRef = db.collection('domain_requests').doc(requestId);
    batch.update(requestRef, { 
        status: 'active',
        activatedAt: new Date()
    });

    // 3. Update the Store to LIVE
    const storeRef = db.collection('stores').doc(storeId);
    batch.update(storeRef, {
        customDomain: domain,
        customDomainStatus: 'active',
        pendingDomain: null
    });

    await batch.commit();

    // 4. Notify the Vendor (Optional but recommended)
    const requestDoc = await requestRef.get();
    const userEmail = requestDoc.data()?.userEmail;

    if (userEmail && process.env.RESEND_API_KEY) {
        try {
            await resend.emails.send({
                from: 'SellQuic <noreply@sellquic.com>',
                to: userEmail,
                subject: `🚀 Your domain ${domain} is live!`,
                html: `<p>Great news! We have finished setting up <strong>${domain}</strong>. Your store is now accessible worldwide.</p>`
            });
        } catch(emailError) {
            console.error("Failed to send activation email:", emailError);
            // Don't fail the request if email fails, but log it.
        }
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Activate Domain Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
