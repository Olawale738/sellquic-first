import { NextRequest, NextResponse } from 'next/server';
import { db, authAdmin } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

const VALID_CAMPAIGN_TYPES = new Set([
  'subscription',
  'trial_reminder',
  'payment_failed',
  'product_update',
  'feature_announcement',
  'onboarding',
  'maintenance',
  'custom',
]);

const VALID_STATUSES = new Set([
  'draft',
  'ready',
  'scheduled',
  'sending',
  'sent',
  'failed',
  'paused',
]);

function parseSchedule(value: unknown): Timestamp | null {
  if (!value || typeof value !== 'string') return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return Timestamp.fromDate(date);
}

function cleanString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function POST(request: NextRequest) {
  try {
    const idToken = request.headers.get('authorization')?.split('Bearer ')[1];

    if (!idToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();

    if (userDoc.data()?.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    const title = cleanString(body.title);
    const type = cleanString(body.type) || 'custom';
    const audienceType = cleanString(body.audienceType) || 'all_vendors';
    const status = cleanString(body.status) || 'draft';
    const messageBody = cleanString(body.messageBody);
    const ctaUrl = cleanString(body.ctaUrl);
    const scheduledAt = parseSchedule(body.scheduledAt);
    const recipients = Array.isArray(body.recipients) ? body.recipients : [];

    if (!title || !messageBody) {
      return NextResponse.json(
        { error: 'Campaign title and message body are required.' },
        { status: 400 }
      );
    }

    if (!VALID_CAMPAIGN_TYPES.has(type)) {
      return NextResponse.json(
        { error: `Invalid campaign type: ${type}` },
        { status: 400 }
      );
    }

    if (!VALID_STATUSES.has(status)) {
      return NextResponse.json(
        { error: `Invalid campaign status: ${status}` },
        { status: 400 }
      );
    }

    if (recipients.length === 0) {
      return NextResponse.json(
        { error: 'At least one recipient preview is required.' },
        { status: 400 }
      );
    }

    const campaignRef = db.collection('vendor_whatsapp_campaigns').doc();

    const normalizedRecipients: any[] = recipients.map((recipient: any) => {
      const recipientStatus = recipient.status === 'pending' ? 'pending' : 'skipped';

      return {
        vendorId: cleanString(recipient.vendorId),
        storeId: cleanString(recipient.storeId),
        vendorName: cleanString(recipient.vendorName),
        businessName: cleanString(recipient.businessName),
        phone: cleanString(recipient.phone),
        planId: cleanString(recipient.planId) || 'free',
        subscriptionStatus: cleanString(recipient.subscriptionStatus) || 'unknown',
        expiryDate: recipient.expiryDate || null,
        whatsappConnected: recipient.whatsappConnected === true,
        status: recipientStatus,
        skippedReason:
          recipientStatus === 'skipped'
            ? cleanString(recipient.skippedReason) || 'not_eligible'
            : null,
        failureReason: null,
        sentAt: null,
        deliveredAt: null,
        readAt: null,
        createdAt: FieldValue.serverTimestamp(),
      };
    });

    const totalRecipients = normalizedRecipients.length;
    const eligibleRecipients = normalizedRecipients.filter(
      (recipient) => recipient.status === 'pending'
    ).length;
    const skippedRecipients = totalRecipients - eligibleRecipients;

    const campaignData = {
      title,
      type,
      audienceType,
      status,
      messageBody,
      ctaUrl,
      templateName: null,
      templateCategory: null,
      scheduledAt,
      createdBy: decodedToken.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      totalRecipients,
      eligibleRecipients,
      skippedRecipients,
      sentCount: 0,
      deliveredCount: 0,
      readCount: 0,
      failedCount: 0,
    };

    // Firestore batch limit is 500 writes. Use 450 to leave room safely.
    let batch = db.batch();
    let writes = 0;

    batch.set(campaignRef, campaignData);
    writes += 1;

    for (const recipient of normalizedRecipients) {
      const recipientId = recipient.vendorId || undefined;
      const recipientRef = recipientId
        ? campaignRef.collection('recipients').doc(recipientId)
        : campaignRef.collection('recipients').doc();

      batch.set(recipientRef, recipient);
      writes += 1;

      if (writes >= 450) {
        await batch.commit();
        batch = db.batch();
        writes = 0;
      }
    }

    if (writes > 0) {
      await batch.commit();
    }

    return NextResponse.json({
      success: true,
      campaignId: campaignRef.id,
      totalRecipients,
      eligibleRecipients,
      skippedRecipients,
      message: 'Campaign saved successfully',
    });
  } catch (error: any) {
    console.error('[Campaign Save Error]:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to save campaign' },
      { status: 500 }
    );
  }
}