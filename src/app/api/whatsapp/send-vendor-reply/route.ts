import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let uid: string;
    try {
      const decoded = await getAuth().verifyIdToken(token);
      uid = decoded.uid;
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const {
      message,
      storeId,
      conversationId,
      imageUrl = null,
      fileUrl = null,
      fileName = null,
      type = 'text',
    } = await request.json();

    if ((!message?.trim() && !imageUrl && !fileUrl) || !storeId || !conversationId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // ── Verify vendor owns this store ─────────────────────────────────
    const storeSnap = await db.collection('stores').doc(storeId).get();
    if (!storeSnap.exists) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    const storeData = storeSnap.data()!;
    if (storeData.sellerId !== uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // ── Get conversation to find customer WhatsApp ID ─────────────────
    const convRef = db
      .collection('stores')
      .doc(storeId)
      .collection('ai_conversations')
      .doc(conversationId);

    const convSnap = await convRef.get();

    if (!convSnap.exists) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const convData = convSnap.data()!;
    const customerWhatsAppId = convData.customerWhatsAppId || convData.customerPhone;

    if (!customerWhatsAppId) {
      return NextResponse.json({ error: 'No WhatsApp ID for this customer' }, { status: 400 });
    }

    // ── Get WhatsApp config ───────────────────────────────────────────
    const phoneId = storeData.whatsapp?.phoneId;
    const accessToken = storeData.whatsapp?.accessToken;

    if (!phoneId || !accessToken) {
      return NextResponse.json({ error: 'WhatsApp not configured for this store' }, { status: 400 });
    }

    // ── Build WhatsApp payload ────────────────────────────────────────
    let waPayload: Record<string, any>;

    if (type === 'image' && imageUrl) {
      waPayload = {
        messaging_product: 'whatsapp',
        to: customerWhatsAppId,
        type: 'image',
        image: {
          link: imageUrl,
          ...(message?.trim() ? { caption: message.trim() } : {}),
        },
      };
    } else if (type === 'file' && fileUrl) {
      waPayload = {
        messaging_product: 'whatsapp',
        to: customerWhatsAppId,
        type: 'document',
        document: {
          link: fileUrl,
          ...(fileName ? { filename: fileName } : {}),
          ...(message?.trim() ? { caption: message.trim() } : {}),
        },
      };
    } else {
      waPayload = {
        messaging_product: 'whatsapp',
        to: customerWhatsAppId,
        type: 'text',
        text: { body: message?.trim() || '' },
      };
    }

    // ── Send via WhatsApp Graph API ───────────────────────────────────
    const waRes = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(waPayload),
    });

    if (!waRes.ok) {
      const err = await waRes.json().catch(() => null);
      console.error('[VendorReply] WhatsApp send failed:', JSON.stringify(err));
      return NextResponse.json(
        { error: `WhatsApp error: ${err?.error?.message || waRes.status}` },
        { status: 502 }
      );
    }

    // ── Save message to Firestore ─────────────────────────────────────
    const msgRef = convRef.collection('messages').doc();
    const inboxRef = db
      .collection('stores')
      .doc(storeId)
      .collection('inboxThreads')
      .doc(conversationId);

    const batch = db.batch();

    batch.set(msgRef, {
      role: 'vendor',
      content: message?.trim() || '',
      type,
      imageUrl,
      fileUrl,
      fileName,
      createdAt: FieldValue.serverTimestamp(),
    });

    const preview =
      type === 'image'
        ? (message?.trim() ? `📷 ${message.trim()}` : '📷 Image')
        : type === 'file'
        ? (fileName ? `📎 ${fileName}` : '📎 Attachment')
        : (message?.trim() || '').slice(0, 160);

    batch.set(
      inboxRef,
      {
        lastMessagePreview: preview,
        lastMessageAt: FieldValue.serverTimestamp(),
        unreadForVendor: false,
      },
      { merge: true }
    );

    batch.set(
      convRef,
      {
        lastAssistantMessage: message?.trim() || '',
        lastAssistantMessageAt: FieldValue.serverTimestamp(),
        handoverMode: true,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await batch.commit();

    console.log(`[VendorReply] ✅ Sent to ${customerWhatsAppId} for conv ${conversationId}`);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[VendorReply] Error:', err?.message || err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}