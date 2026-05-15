import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { waitUntil } from '@vercel/functions';
import crypto from 'crypto';
import { inngest } from '@/inngest/functions';
import { checkAiAccess } from '@/lib/ai-gatekeeper';

export const maxDuration = 300;
const VERIFY_TOKEN = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN!;
const USE_IG_INGEST = process.env.USE_IG_INGEST === 'true';

// ── Message Deduplication ──
const recentMessages = new Map<string, number>();
const DEDUP_WINDOW_MS = 60_000;

function isDuplicate(messageId: string): boolean {
  const now = Date.now();
  if (recentMessages.size > 500) {
    recentMessages.forEach((ts, key) => {
      if (now - ts > DEDUP_WINDOW_MS) recentMessages.delete(key);
    });
  }
  if (recentMessages.has(messageId)) return true;
  recentMessages.set(messageId, now);
  return false;
}

// ── Signature Verification ──
function verifySignature(signature: string | null, rawBody: string): boolean {
  if (!signature) return false;
  const secrets = [process.env.FACEBOOK_APP_SECRET, process.env.INSTAGRAM_APP_SECRET].filter(Boolean);
  for (const secret of secrets) {
    const expected = `sha256=${crypto.createHmac('sha256', secret as string).update(rawBody, 'utf8').digest('hex')}`;
    if (signature === expected) return true;
  }
  return false;
}

// ── GET — Webhook Verification ──
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get('hub.mode') === 'subscribe' && searchParams.get('hub.verify_token') === VERIFY_TOKEN) {
    console.log('[IG Webhook] Verified ✓');
    return new Response(searchParams.get('hub.challenge'), { status: 200 });
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

// ── POST — Receive Instagram DM Events ──
export async function POST(request: NextRequest) {
  try {
    const arrayBuffer = await request.arrayBuffer();
    const rawBody = Buffer.from(arrayBuffer).toString('utf8');
    const signature = request.headers.get('x-hub-signature-256');

    if (!verifySignature(signature, rawBody)) {
      console.error('[IG Webhook] Rejected — invalid signature');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const processingPromises: Promise<void>[] = [];

    for (const entry of body.entry ?? []) {
      for (const event of entry.messaging ?? []) {
        processingPromises.push(
          handleMessagingEvent(entry.id, event, request).catch(err =>
            console.error('[IG Webhook] Handler error:', err)
          )
        );
      }

      for (const change of entry.changes ?? []) {
        if (change.field === 'messages' && change.value) {
          processingPromises.push(
            handleMessagingEvent(entry.id, change.value, request).catch(err =>
              console.error('[IG Webhook] Handler error:', err)
            )
          );
        }
      }
    }

    
    if (processingPromises.length > 0) {
      waitUntil(Promise.allSettled(processingPromises));
    }
    
    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('[IG Webhook] POST error:', error);
    return NextResponse.json({ status: 'ok' });
  }
}



async function bufferInboundMessage({
  storeId,
  conversationId,
  messageText,
  imageUrl,
  channel,
  customerWhatsAppId,
  instagramUserId,
  clientMessageId,
}: {
  storeId: string;
  conversationId: string;
  messageText: string;
  imageUrl: string | null;
  channel: 'whatsapp' | 'instagram';
  customerWhatsAppId?: string;
  instagramUserId?: string;
  clientMessageId?: string;
}) {
  const convRef = db.collection('stores').doc(storeId).collection('ai_conversations').doc(conversationId);

  const version = await db.runTransaction(async (tx) => {
    const snap = await tx.get(convRef);
    const data = snap.data() || {};

    const existingText = String(data.pendingInboundText || '').trim();
    const incomingText = String(messageText || '').trim();

    const mergedText =
      existingText && incomingText
        ? `${existingText}\n${incomingText}`
        : (incomingText || existingText || '');

    const nextVersion = Number(data.pendingInboundVersion || 0) + 1;

    tx.set(convRef, {
      storeId,
      channel,
      status: 'active',
      updatedAt: FieldValue.serverTimestamp(),
      pendingInboundText: mergedText,
      pendingInboundImageUrl: imageUrl || data.pendingInboundImageUrl || null,
      pendingInboundVersion: nextVersion,
      pendingInboundUpdatedAt: FieldValue.serverTimestamp(),
      processingVersion: data.processingVersion ?? null,
      lastBufferedMessageId: clientMessageId || null,
      ...(customerWhatsAppId ? { customerWhatsAppId } : {}),
      ...(instagramUserId ? { instagramUserId } : {}),
      ...(!snap.exists ? { messageCount: 0, createdAt: FieldValue.serverTimestamp() } : {}),
    }, { merge: true });

    return nextVersion;
  });

  return version;
}
// ── Handle a single DM event ──
async function handleMessagingEvent(entryId: string, event: any, request: NextRequest) {
  if (event.message?.is_echo) return;

  const customerId = event.sender?.id;
  const messageText = event.message?.quick_reply?.payload || event.message?.text || '';
  const messageId = event.message?.mid;
  const attachments = event.message?.attachments || [];
  const imageUrl = attachments.find((a: any) => a.type === 'image')?.payload?.url || null;

  if (!customerId || (!messageText && !imageUrl)) return;
  if (messageId && isDuplicate(messageId)) return;

  const recipientId = event.recipient?.id || entryId;

  console.log(`[IG Webhook] Message from ${customerId} → recipient ${recipientId}`);

 // Try accountId first, then webhookId
 // 1. Fast path: try accountId or webhookId
let storeSnap = await db.collection('stores')
.where('instagram.accountId', '==', recipientId)
.limit(1)
.get();

if (storeSnap.empty) {
storeSnap = await db.collection('stores')
    .where('instagram.webhookId', '==', recipientId)
    .limit(1)
    .get();
}

// 2. Auto-discover: use Conversations API to verify which store owns this DM
if (storeSnap.empty) {
const connectedStores = await db.collection('stores')
    .where('instagram.connected', '==', true)
    .get();

for (const doc of connectedStores.docs) {
    const ig = doc.data().instagram || {};
    if (ig.webhookId || !ig.accessToken) continue;

    try {
        // Check if THIS store's account has a conversation with the sender
        const convRes = await fetch(
            `https://graph.instagram.com/v21.0/me/conversations?user_id=${customerId}&access_token=${ig.accessToken}`
        );
        const convData = await convRes.json();

        if (convRes.ok && convData.data && convData.data.length > 0) {
            // This store HAS a conversation with this customer — it's the right one
            await db.collection('stores').doc(doc.id).update({ 'instagram.webhookId': recipientId });
            console.log(`[IG Webhook] ✅ Verified via Conversations API — saved webhookId ${recipientId} for store ${doc.id} (@${ig.username})`);
            storeSnap = await db.collection('stores').where('instagram.webhookId', '==', recipientId).limit(1).get();
            break;
        }
    } catch { continue; }
}
}

if (storeSnap.empty) {
console.warn(`[IG Webhook] ❌ No store found for recipient: ${recipientId}`);
return;
}

  const storeDoc = storeSnap.docs[0];
  const storeId = storeDoc.id;
  const igData = storeDoc.data().instagram || {};

  if (!igData.connected || !igData.accessToken) {
    console.warn('[IG Webhook] Store found but Instagram not connected or no token.');
    return;
  }

  // Block free users
  const gate = await checkAiAccess(storeId);
  if (!gate.allowed) {
    console.log(`[IG Block] Store ${storeId} blocked — no AI access`);
    return;
  }
  fetch(`https://graph.instagram.com/v21.0/me/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${igData.accessToken}`,
    },
    body: JSON.stringify({
      recipient: { id: customerId },
      sender_action: 'typing_on',
    }),
    signal: AbortSignal.timeout(2000),
  }).catch(e => console.error('[IG Webhook] Typing indicator failed:', e));



  // Get or create conversation
  const conversationId = await getOrCreateConversation(storeId, customerId);


    // Dynamic base URL
     // Dynamic base URL
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${request.headers.get('host')}`;

  if (USE_IG_INGEST) {
    const version = await bufferInboundMessage({
      storeId,
      conversationId,
      messageText,
      imageUrl,
      channel: 'instagram',
      instagramUserId: customerId,
      clientMessageId: messageId,
    });

    await inngest.send({
      name: 'ai/message.received',
      data: {
        storeId,
        conversationId,
        channel: 'instagram',
        version,
        messageId,
      },
    });

    console.log(`[IG Webhook] ✅ Handed to Inngest — conv ${conversationId} v${version}`);
    return;
  }

  // ── DIRECT PATH (fallback when USE_IG_INGEST=false) ───────────────────
  const useV2 =
    storeDoc.data()?.aiV2?.enabled === true &&
    storeDoc.data()?.aiV2?.channels?.instagram === true;
  const aiPath = useV2 ? '/api/ai-v2/chat' : '/api/ai/chat';

  const aiRes = await fetch(`${baseUrl}${aiPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: messageText,
      storeId,
      conversationId,
      clientMessageId: messageId,
      imageUrl,
    }),
  });

  if (!aiRes.ok) {
    console.error(`[IG Webhook] Chat API returned ${aiRes.status}`);
    return;
  }

  const aiData = await aiRes.json();
  if (aiData.reply?.type === 'silent' || aiData.reply?.type === 'handover_active') return;

  const payloads = buildInstagramPayloads(aiData.reply, baseUrl);

  if (payloads.length > 0) {
    await sendInstagramMessages(igData.accountId, customerId, payloads, igData.accessToken);
  }

  return;
}

// ── Build Instagram message payloads ──
function buildInstagramPayloads(reply: any, baseUrl: string): any[] {
  if (!reply) return [];

  let igQuickReplies: any[] | undefined = undefined;
  if (Array.isArray(reply.quickReplies) && reply.quickReplies.length > 0) {
    igQuickReplies = reply.quickReplies.slice(0, 13).map((qr: string) => ({
      content_type: 'text',
      title: String(qr).substring(0, 20),
      payload: String(qr).substring(0, 20),
    }));
  }

  switch (reply.type) {
    case 'text': {
      if (!reply.content) return [];
      const payload: any = { text: reply.content };
      if (igQuickReplies) payload.quick_replies = igQuickReplies;
      return [payload];
    }

    case 'action': {
      if (reply.action !== 'checkout') return reply.content ? [{ text: reply.content }] : [];
      const itemLines = (reply.items || [])
        .map((i: any) => `• ${i.name} x${i.quantity} — GHS ${Number(i.lineTotal ?? i.price * i.quantity).toFixed(2)}`)
        .join('\n');
      const total = reply.total ? `\nTotal: GHS ${Number(reply.total).toFixed(2)}` : '';
      const checkoutUrl = reply.url ? (reply.url.startsWith('http') ? reply.url : `${baseUrl}${reply.url}`) : null;
      const link = checkoutUrl ? `\n\nTap to complete your order 👉 ${checkoutUrl}` : '';
      return [{ text: `Your order is ready 😊\n\n${itemLines}${total}${link}`.trim() }];
    }

    case 'product_cards': {
      const payloads = [];
      if (reply.content) payloads.push({ text: reply.content });
      if (reply.products && reply.products.length > 0) {
        const elements = reply.products.slice(0, 10).map((p: any) => {
          const price = p.variants?.length > 0
            ? `from GHS ${Math.min(...p.variants.map((v: any) => Number(v.price))).toFixed(2)}`
            : `GHS ${Number(p.price).toFixed(2)}`;
            const cleanImageUrl = p.imageUrl
            ? p.imageUrl.replace(/\?alt=media&token=[^&]+/, '?alt=media')
            : null;
          return {
            title: String(p.name).substring(0, 80),
            subtitle: price,
            ...(cleanImageUrl ? { image_url: cleanImageUrl } : {}),
          };
        });
        const templatePayload: any = {
          attachment: { type: 'template', payload: { template_type: 'generic', elements } },
        };
        if (igQuickReplies) templatePayload.quick_replies = igQuickReplies;
        payloads.push(templatePayload);
      }
      return payloads;
    }

    case 'save_info_done':
    case 'handover_active':
      return [];

    default: {
      if (!reply.content && !reply.message) return [];
      const payload: any = { text: reply.content || reply.message };
      if (igQuickReplies) payload.quick_replies = igQuickReplies;
      return [payload];
    }
  }
}

// ── Get or create conversation ──
async function getOrCreateConversation(storeId: string, instagramUserId: string): Promise<string> {
  const storeRef = db.collection('stores').doc(storeId);
  const existing = await storeRef.collection('ai_conversations')
    .where('instagramUserId', '==', instagramUserId)
    .where('channel', '==', 'instagram')
    .where('status', 'in', ['active', 'open'])
    .limit(1)
    .get();

  if (!existing.empty) return existing.docs[0].id;

  const newConv = await storeRef.collection('ai_conversations').add({
    storeId,
    instagramUserId,
    channel: 'instagram',
    source: 'instagram',
    status: 'active',
    messageCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return newConv.id;
}

// ── Send messages via Instagram Graph API ──
async function sendInstagramMessages(igAccountId: string, recipientId: string, payloads: any[], accessToken: string): Promise<void> {
  for (const payload of payloads) {
    const res = await fetch(`https://graph.instagram.com/v21.0/me/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ recipient: { id: recipientId }, message: payload, messaging_type: 'RESPONSE' }),
    });

    if (!res.ok) {
      const err = await res.json();
      console.error('[IG Webhook] Send error:', JSON.stringify(err));

      // Auto-disconnect on expired token
      if (err.error?.code === 190 || err.error?.error_subcode === 463) {
        console.warn(`[IG Webhook] Token expired for ${igAccountId} — marking disconnected`);
        const expiredStore = await db.collection('stores')
          .where('instagram.accountId', '==', igAccountId)
          .limit(1)
          .get();
        if (!expiredStore.empty) {
          await db.collection('stores').doc(expiredStore.docs[0].id).update({
            'instagram.connected': false,
            'instagram.disconnectedReason': 'Token expired',
            'instagram.disconnectedAt': new Date().toISOString(),
          });
        }
      }
    }

    await new Promise(r => setTimeout(r, 400));
  }
}
