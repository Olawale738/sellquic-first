import { NextRequest, NextResponse } from 'next/server';
import { authAdmin, db } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { sendAdminVendorTemplateMessage, normalizeGhanaPhone } from '@/lib/whatsapp/admin-vendor-whatsapp';

export const dynamic = 'force-dynamic';

async function requireSuperAdmin(request: NextRequest): Promise<string> {
  const idToken = request.headers.get('authorization')?.split('Bearer ')[1];

  if (!idToken) {
    const error = new Error('Unauthorized');
    (error as any).status = 401;
    throw error;
  }

  const decodedToken = await authAdmin.verifyIdToken(idToken);
  const userDoc = await db.collection('users').doc(decodedToken.uid).get();

  if (userDoc.data()?.role !== 'superadmin') {
    const error = new Error('Forbidden');
    (error as any).status = 403;
    throw error;
  }

  return decodedToken.uid;
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  let logRef: FirebaseFirestore.DocumentReference | null = null;

  try {
    const sentBy = await requireSuperAdmin(request);
    const body = await request.json();

    const rawPhone = body.phone;
    const phone = normalizeGhanaPhone(rawPhone);
    const campaignId = body.campaignId || null;

    if (!phone) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid phone number. Use 020..., +233..., or 233...',
        },
        { status: 400 }
      );
    }

    const templateName = body.templateName || process.env.ADMIN_VENDOR_WHATSAPP_TEMPLATE_NAME;
    const templateLanguage = body.templateLanguage || process.env.ADMIN_VENDOR_WHATSAPP_TEMPLATE_LANGUAGE || 'en_US';

    if (!templateName) {
      return NextResponse.json(
        { success: false, error: 'Missing WhatsApp template name.' },
        { status: 400 }
      );
    }

    const variables = Array.isArray(body.variables)
      ? body.variables
      : [
          body.vendorName || 'SellQuic Vendor',
          body.businessName || 'your store',
        ];

    logRef = db.collection('vendor_whatsapp_send_logs').doc();

    await logRef.set({
      campaignId,
      recipientPhone: phone,
      templateName,
      templateLanguage,
      variables,
      status: 'sending',
      provider: 'meta_whatsapp_cloud_api',
      sentBy,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const result = await sendAdminVendorTemplateMessage({
      phone,
      templateName,
      templateLanguage,
      variables,
    });

    await logRef.update({
      status: result.success ? 'sent' : 'failed',
      providerMessageId: result.providerMessageId || null,
      providerResponse: result.providerResponse || null,
      error: result.error || null,
      latencyMs: Date.now() - startedAt,
      sentAt: result.success ? FieldValue.serverTimestamp() : null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error, providerResponse: result.providerResponse },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'WhatsApp message sent.',
      providerMessageId: result.providerMessageId,
      logId: logRef.id,
    });
  } catch (error: any) {
    console.error('[Vendor WhatsApp Send Single Error]', error);

    if (logRef) {
      await logRef.update({
        status: 'failed',
        error: error?.message || 'Unknown error',
        latencyMs: Date.now() - startedAt,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to send WhatsApp message' },
      { status: error?.status || 500 }
    );
  }
}
