import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET(request: Request) {
  const secret = request.headers.get('authorization')?.split('Bearer ')[1];
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = Timestamp.now();
    const campaignsRef = db.collection('email_campaigns');
    const snapshot = await campaignsRef
      .where('status', '==', 'scheduled')
      .where('scheduledAt', '<=', now)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ message: 'No scheduled campaigns to send.' });
    }

    for (const doc of snapshot.docs) {
      const campaign = doc.data();
      const campaignId = doc.id;

      await doc.ref.update({ status: 'sending' });
      
      const { templateId, segment } = campaign;
      const templateSnap = await db.collection('email_templates').doc(templateId).get();
      if (!templateSnap.exists) continue;
      const template = templateSnap.data()!;

      let usersQuery: any = db.collection('users');
      switch (segment) {
          case 'paid': usersQuery = usersQuery.where('subscription.planId', '!=', 'free'); break;
          case 'free': usersQuery = usersQuery.where('subscription.status', '==', 'pending_plan'); break;
          // ... add all other segment logic from send/route.ts here ...
          default: break;
      }

      const usersSnap = await usersQuery.get();
      const recipients = usersSnap.docs.map((d:any) => ({ uid: d.id, ...d.data() })).filter((u:any) => u.email);

      if (recipients.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < recipients.length; i += batchSize) {
          const batch = recipients.slice(i, i + batchSize);
          await resend.batch.send(
            batch.map((vendor: any) => ({
              from: 'SellQuic <hello@sellquic.com>',
              to: vendor.email,
              subject: template.subject.replace(/{{firstName}}/g, vendor.firstName || 'there'),
              html: template.body.replace(/{{firstName}}/g, vendor.firstName || 'there'),
            }))
          );
        }
      }

      await doc.ref.update({ 
        status: 'sent', 
        sentAt: FieldValue.serverTimestamp(),
        recipientCount: recipients.length
      });
    }

    return NextResponse.json({ success: true, sent: snapshot.size });
  } catch (error: any) {
    console.error('Error in scheduled campaigns cron:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
