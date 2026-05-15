'use server';
import { NextResponse } from 'next/server';
import { db, authAdmin } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

async function verifySuperAdmin(request: Request) {
  const idToken = request.headers.get('authorization')?.split('Bearer ')[1];
  if (!idToken) return null;
  const decoded = await authAdmin.verifyIdToken(idToken);
  const userDoc = await db.collection('users').doc(decoded.uid).get();
  if (userDoc.data()?.role !== 'superadmin') return null;
  return decoded;
}

export async function POST(request: Request) {
  try {
    const user = await verifySuperAdmin(request);
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { templateId, segment, scheduledAt, customEmail } = await request.json();
    if (!templateId || !segment) {
      return NextResponse.json({ error: 'Missing templateId or segment' }, { status: 400 });
    }

    const templateDoc = await db.collection('email_templates').doc(templateId).get();
    if (!templateDoc.exists) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }
    const template = templateDoc.data()!;

    // --- IF SCHEDULING ---
    if (scheduledAt) {
        await db.collection('email_campaigns').add({
            templateId,
            templateName: template.name,
            segment,
            customEmail: segment === 'specific' ? customEmail : null,
            status: 'scheduled',
            scheduledAt: Timestamp.fromDate(new Date(scheduledAt)),
            createdAt: FieldValue.serverTimestamp(),
            sentBy: user.uid,
            openCount: 0,
            clickCount: 0,
            recipientCount: 0, // Will be updated by cron
        });
        return NextResponse.json({ success: true, message: `Campaign scheduled for ${new Date(scheduledAt).toLocaleString()}.` });
    }

    // --- IF SENDING NOW ---
    let recipients: any[] = [];
    let usersQuery: any = db.collection('users');

    if (segment === 'specific') {
        if (!customEmail) return NextResponse.json({ error: 'Missing customEmail for specific segment' }, { status: 400 });
        recipients = [{ email: customEmail, firstName: 'Tester' }];
    } else {
        switch (segment) {
        case 'paid': usersQuery = usersQuery.where('subscription.planId', '!=', 'free'); break;
        case 'free': usersQuery = usersQuery.where('subscription.status', '==', 'pending_plan'); break;
        case 'inactive_14d': {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - 14);
            usersQuery = usersQuery.where('lastLoginAt', '<=', Timestamp.fromDate(cutoff));
            break;
        }
        case 'inactive_30d': {
             const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - 30);
            usersQuery = usersQuery.where('lastLoginAt', '<=', Timestamp.fromDate(cutoff));
            break;
        }
        case 'expiring_7d': {
            const now = new Date();
            const in7 = new Date(); in7.setDate(now.getDate() + 7);
            usersQuery = usersQuery.where('subscription.expiresAt', '>=', Timestamp.fromDate(now)).where('subscription.expiresAt', '<=', Timestamp.fromDate(in7));
            break;
        }
        case 'expiring_30d': {
             const now = new Date();
            const in30 = new Date(); in30.setDate(now.getDate() + 30);
            usersQuery = usersQuery.where('subscription.expiresAt', '>=', Timestamp.fromDate(now)).where('subscription.expiresAt', '<=', Timestamp.fromDate(in30));
            break;
        }
        default: break;
        }
        const usersSnap = await usersQuery.get();
        recipients = usersSnap.docs.map((doc: any) => ({ uid: doc.id, ...doc.data() })).filter((u: any) => u.email);
    }
    
    if (recipients.length === 0) {
      return NextResponse.json({ success: true, message: 'No recipients found for this segment.' });
    }

    const campaignRef = db.collection('email_campaigns').doc();
    const campaignId = campaignRef.id;

    // Get store names for personalisation
    const storeByVendor = new Map<string, string>();
    if (segment !== 'specific' && recipients.length > 0) {
        const uids = recipients.map((r: any) => r.uid).filter(Boolean);
        
        for (let i = 0; i < uids.length; i += 30) {
            const chunk = uids.slice(i, i + 30);
            if(chunk.length > 0) {
              const storesSnap = await db.collection('stores').where('sellerId', 'in', chunk).get();
              storesSnap.docs.forEach(d => {
                storeByVendor.set(d.data().sellerId, d.data().name || 'your store');
              });
            }
        }
    }


    const batchSize = 100;
    let totalSent = 0;

    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      await resend.batch.send(
        batch.map((vendor: any) => ({
          from: 'SellQuic <hello@sellquic.com>',
          to: vendor.email,
          subject: template.subject.replace(/{{firstName}}/g, vendor.firstName || 'there').replace(/\[First Name\]/g, vendor.firstName || 'there').replace(/{{storeName}}/g, storeByVendor.get(vendor.uid) || vendor.displayName || 'your store').replace(/\[Store Name\]/g, storeByVendor.get(vendor.uid) || vendor.displayName || 'your store'),
html: template.body.replace(/{{firstName}}/g, vendor.firstName || 'there').replace(/\[First Name\]/g, vendor.firstName || 'there').replace(/{{storeName}}/g, storeByVendor.get(vendor.uid) || vendor.displayName || 'your store').replace(/\[Store Name\]/g, storeByVendor.get(vendor.uid) || vendor.displayName || 'your store').replace(/{{storeUrl}}/g, vendor.subdomain ? `https://${vendor.subdomain}.sellquic.com` : 'https://sellquic.com').replace(/\[Store URL\]/g, vendor.subdomain ? `https://${vendor.subdomain}.sellquic.com` : 'https://sellquic.com'),
          tags: [{ name: 'campaign_id', value: campaignId }]
        }))
      );
      totalSent += batch.length;
    }

    await campaignRef.set({
      templateId,
      templateName: template.name,
      segment,
      status: 'sent',
      sentAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
      recipientCount: totalSent,
      sentBy: user.uid,
      customEmail: segment === 'specific' ? customEmail : null,
      openCount: 0,
      clickCount: 0,
    });

    return NextResponse.json({
      success: true,
      message: `Campaign sent to ${totalSent} vendor${totalSent !== 1 ? 's' : ''}.`,
    });

  } catch (error: any) {
    console.error('[campaigns/send]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
