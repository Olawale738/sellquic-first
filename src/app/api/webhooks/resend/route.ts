import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const { type, data } = payload;

    // Resend sends tags in an array of {name, value}
    const campaignTag = data?.tags?.find((tag: { name: string; value: string }) => tag.name === 'campaign_id');
    const campaignId = campaignTag?.value;

    if (!campaignId) {
      console.log('Resend webhook ignored: No campaign_id tag found.');
      return NextResponse.json({ success: true, message: 'No campaign ID tag.' });
    }

    const campaignRef = db.collection('email_campaigns').doc(campaignId);
    let updateData: { [key: string]: FieldValue } = {};

    switch (type) {
      case 'email.opened':
        updateData = { openCount: FieldValue.increment(1) };
        break;
      case 'email.clicked':
        updateData = { clickCount: FieldValue.increment(1) };
        break;
      default:
        return NextResponse.json({ success: true, message: `Ignoring event type: ${type}` });
    }

    await campaignRef.update(updateData);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Resend webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
