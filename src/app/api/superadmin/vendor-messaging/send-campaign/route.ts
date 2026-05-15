import { NextRequest, NextResponse } from 'next/server';
import { authAdmin, db } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { sendAdminVendorTemplateMessage, normalizeGhanaPhone } from '@/lib/whatsapp/admin-vendor-whatsapp';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 1. Auth check
    const idToken = request.headers.get('authorization')?.split('Bearer ')[1];
    if (!idToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    if (userDoc.data()?.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { campaignId, batchSize = 25 } = await request.json();
    if (!campaignId) return NextResponse.json({ error: 'Missing campaignId' }, { status: 400 });

    const limitBatch = Math.min(Math.max(1, batchSize), 50);

    const campaignRef = db.collection('vendor_whatsapp_campaigns').doc(campaignId);
    const campaignSnap = await campaignRef.get();

    if (!campaignSnap.exists) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const campaign = campaignSnap.data()!;
    if (!['ready', 'sending', 'paused'].includes(campaign.status)) {
      return NextResponse.json({ error: `Cannot send from current status: ${campaign.status}` }, { status: 400 });
    }

    // 2. Fetch pending recipients
    const recipientsRef = campaignRef.collection('recipients');
    const pendingSnap = await recipientsRef
      .where('status', '==', 'pending')
      .limit(limitBatch)
      .get();

    if (pendingSnap.empty) {
      // If we thought we were sending but no pending found, update status to sent
      if (campaign.status !== 'sent') {
        await campaignRef.update({ status: 'sent', updatedAt: FieldValue.serverTimestamp() });
      }
      return NextResponse.json({ success: true, message: 'No pending recipients left.', sentCount: 0 });
    }

    const templateName = process.env.ADMIN_VENDOR_WHATSAPP_TEMPLATE_NAME;
    const templateLanguage = process.env.ADMIN_VENDOR_WHATSAPP_TEMPLATE_LANGUAGE || 'en_US';

    if (!templateName) {
      throw new Error('ADMIN_VENDOR_WHATSAPP_TEMPLATE_NAME env variable is missing.');
    }

    let successCount = 0;
    let failCount = 0;

    // 3. Process batch
    for (const docSnap of pendingSnap.docs) {
      const recipient = docSnap.data();
      const phone = normalizeGhanaPhone(recipient.phone);

      if (!phone) {
        await docSnap.ref.update({
          status: 'skipped',
          skippedReason: 'invalid_phone',
          failureReason: 'invalid_phone',
          updatedAt: FieldValue.serverTimestamp(),
        });
      
        failCount++;
        continue;
      }

      const result = await sendAdminVendorTemplateMessage({
        phone,
        templateName,
        templateLanguage,
        variables: [
          recipient.vendorName || 'SellQuic Vendor',
          recipient.businessName || 'your store',
        ],
      });

      // Log the send
      await db.collection('vendor_whatsapp_send_logs').add({
        campaignId,
        recipientPhone: phone,
        vendorId: recipient.vendorId || null,
        storeId: recipient.storeId || null,
        vendorName: recipient.vendorName || null,
        businessName: recipient.businessName || null,
        templateName,
        templateLanguage,
        variables: [
          recipient.vendorName || 'SellQuic Vendor',
          recipient.businessName || 'your store',
        ],
        status: result.success ? 'sent' : 'failed',
        provider: 'meta_whatsapp_cloud_api',
        providerMessageId: result.providerMessageId || null,
        providerResponse: result.providerResponse || null,
        error: result.error || null,
        sentBy: decodedToken.uid,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
        

      // Update recipient record
      await docSnap.ref.update({
        status: result.success ? 'sent' : 'failed',
        providerMessageId: result.providerMessageId || null,
        providerResponse: result.providerResponse || null,
        failureReason: result.error || null,
        sentAt: result.success ? FieldValue.serverTimestamp() : null,
        updatedAt: FieldValue.serverTimestamp(),
      });

      if (result.success) successCount++;
      else failCount++;
    }

    // 4. Update campaign summary
    // Check if any pending remain after this batch
    const remainingSnap = await recipientsRef.where('status', '==', 'pending').limit(1).get();
    const isFinished = remainingSnap.empty;

    await campaignRef.update({
      status: isFinished ? 'sent' : 'sending',
      sentCount: FieldValue.increment(successCount),
      failedCount: FieldValue.increment(failCount),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      sentCount: successCount,
      failedCount: failCount,
      isFinished,
    });
  } catch (error: any) {
    console.error('[Send Campaign Error]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
