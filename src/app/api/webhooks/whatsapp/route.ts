import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

import { waitUntil } from '@vercel/functions';
import crypto from 'crypto';
import { inngest } from '@/inngest/functions';

const USE_WA_INGEST = process.env.USE_WA_INGEST === 'true';


import { v2 as cloudinary } from 'cloudinary'; // ADD THIS


cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const maxDuration = 300;

const VERIFY_TOKEN = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN || 'sellquic_ig_2026';
const APP_SECRET = process.env.FACEBOOK_APP_SECRET!;

// ── 1. Message Deduplication ────────────────────────────────────────────────
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

// ── 2. Signature Verification ───────────────────────────────────────────────
function verifySignature(signature: string | null, rawBody: string): boolean {
  if (!signature) return false;
  try {
    const expectedSignature = `sha256=${crypto
      .createHmac('sha256', APP_SECRET)
      .update(rawBody, 'utf8')
      .digest('hex')}`;
    return signature === expectedSignature;
  } catch (err) {
    return false;
  }
}

// ── 3. GET: Webhook Handshake ───────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[WA Webhook] Handshake Successful ✓');
    return new Response(challenge, { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

// ── 4. POST: Receive WhatsApp Events ────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-hub-signature-256');

    if (!verifySignature(signature, rawBody)) {
      console.error('[WA Webhook] Rejected — invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const value = body.entry?.[0]?.changes?.[0]?.value;

    if (value?.statuses) return NextResponse.json({ status: 'ok' });
    if (!value || !value.messages) return NextResponse.json({ status: 'ok' });

    const processingPromises: Promise<void>[] = [];

    for (const message of value.messages) {
      if (message.id && isDuplicate(message.id)) continue;
      
      processingPromises.push(
        handleWhatsAppEvent(value.metadata.phone_number_id, message).catch(err =>
          console.error('[WA Webhook] Error processing message:', err)
        )
      );
    }

    if (processingPromises.length > 0) {
      waitUntil(Promise.allSettled(processingPromises));
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('[WA Webhook] POST error:', error);
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




async function handleWhatsAppEvent(phoneId: string, message: any) {
  const customerPhone = message.from;
  const messageText = message.button?.text || message.text?.body || '';
  
  const storeSnap = await db.collection('stores')
    .where('whatsapp.phoneId', '==', phoneId)
    .limit(1)
    .get();

  if (storeSnap.empty) return;
  const storeDoc = storeSnap.docs[0];
  const storeData = storeDoc.data();
  const accessToken = storeData.whatsapp?.accessToken;
  const baseUrl = 'https://sellquic.com';
  if (!accessToken) return;

  if (message.id) {
    fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: message.id,
      }),
    }).catch(e => console.error('[WA] Read receipt failed:', e));
  }



 // Mark as READ — this shows blue ticks AND typing indicator together


  // Fetch real image URL if user sent a photo

let imageUrl = null;
if (message.image?.id) {
  try {
    const mediaRes = await fetch(`https://graph.facebook.com/v21.0/${message.image.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const mediaData = await mediaRes.json();

    const imageRes = await fetch(mediaData.url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const arrayBuffer = await imageRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const uploadRes = await new Promise<any>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'whatsapp_uploads', resource_type: 'image' },
        (error, result) => error ? reject(error) : resolve(result)
      );
      stream.end(buffer);
    });

    imageUrl = uploadRes.secure_url;
  } catch (e) {
    console.error('[WA Webhook] Image upload failed:', e);
  }
}

if (!messageText && !imageUrl) {
  await sendWhatsAppResponse(
    customerPhone,
    phoneId,
    {
      type: 'text',
      content: "So sorry please — I couldn't process the image properly. Could you resend it, or tell me the product name and I’ll check it for you?"
    },
    accessToken,
    baseUrl
  );
  return;
}

const conversationId = `wa_${customerPhone}`;

const convRef = db.collection('stores').doc(storeDoc.id).collection('ai_conversations').doc(conversationId);
const existingConv = await convRef.get();

if (!existingConv.exists) {
  await convRef.set({
    storeId: storeDoc.id,
    customerWhatsAppId: customerPhone,
    channel: 'whatsapp',
    source: 'whatsapp',
    status: 'active',
    messageCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
} else {
  await convRef.set({
    customerWhatsAppId: customerPhone,
    channel: 'whatsapp',
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

if (USE_WA_INGEST) {
  const version = await bufferInboundMessage({
    storeId: storeDoc.id,
    conversationId,
    messageText,
    imageUrl,
    channel: 'whatsapp',
    customerWhatsAppId: customerPhone,
    clientMessageId: message.id,
  });

  await inngest.send({
    name: 'ai/message.received',
    data: {
      storeId: storeDoc.id,
      conversationId,
      channel: 'whatsapp',
      customerPhone,
      version,
      messageId: message.id,
    },
  });

  console.log(`[WA Webhook] ✅ Handed to Inngest — conv ${conversationId} v${version}`);
  return;
}

// ── DIRECT PATH (fallback when USE_WA_INGEST=false) ──────────────────────
const useV2 =
  storeData?.aiV2?.enabled === true &&
  storeData?.aiV2?.channels?.whatsapp === true;
const aiPath = useV2 ? '/api/ai-v2/chat' : '/api/ai/chat';

const aiRes = await fetch(`https://sellquic.com${aiPath}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: messageText,
    storeId: storeDoc.id,
    conversationId,
    clientMessageId: message.id,
    imageUrl,
    customerPhone,
    phone: customerPhone,
  }),
});

if (!aiRes.ok) {
  console.error(`[WA Webhook] Chat API returned ${aiRes.status}`);
  return;
}

const aiData = await aiRes.json();
if (aiData.reply?.type === 'silent' || aiData.reply?.type === 'handover_active') return;

await sendWhatsAppResponse(
  customerPhone,
  phoneId,
  aiData.reply,
  accessToken,
  baseUrl
);

return;
}
// ── 6. Send WhatsApp Response (Text + Images + NO Quick Replies) ─────────────
async function sendWhatsAppResponse(to: string, phoneId: string, reply: any, token: string, baseUrl: string) {
  const url = `https://graph.facebook.com/v21.0/${phoneId}/messages`;
  const common = { messaging_product: "whatsapp", to: to };

  const postToWA = async (body: any) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  
    if (!res.ok) {
      console.error('[WA Webhook] Send Error:', JSON.stringify(data));
  
      if (data?.error?.code === 190) {
        console.warn(`[WA Webhook] Token expired for phone ${phoneId}`);
        const expiredStore = await db.collection('stores')
          .where('whatsapp.phoneId', '==', phoneId)
          .limit(1)
          .get();
  
        if (!expiredStore.empty) {
          await db.collection('stores').doc(expiredStore.docs[0].id).update({
            'whatsapp.status': 'token_expired',
            'whatsapp.disconnectedAt': new Date().toISOString(),
          });
        }
      }
  
      throw new Error(data?.error?.message || 'WhatsApp send failed');
    }
  
    return data;
  };

  const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

  // 1. Handle TEXT responses
  if (reply.type === 'text' || !reply.type) {
    const content = (reply.content || reply.message || 'How can I help you?').replace(/<!--QR:\[.*?\]-->/g, '');
    await postToWA({ ...common, type: "text", text: { body: formatForWhatsApp(content) } });
  } 
  
  // 2. Handle PRODUCT CARDS (Images First, Footer Text Last)
  else if (reply.type === 'product_cards') {
    // A. Send Intro
    if (reply.content) {
      await postToWA({ ...common, type: "text", text: { body: formatForWhatsApp(reply.content) } });
      await wait(500);
    }

  // B. Send Each Product as an IMAGE (with crash protection)
const products = reply.products || [];
for (const p of products.slice(0, 6)) {
  const priceStr = p.variants?.length > 0
    ? `GHS ${Math.min(...p.variants.map((v: any) => Number(v.price)))}`
    : `GHS ${p.price}`;

  // HOTFIX: keep caption tight — name + price only. Long descriptions
  // overwhelm WA viewers and the conversational reply already covers
  // product context.
  const caption = `*${p.name}*\n💰 ${priceStr}`.trim();
  const fallbackText = `*${p.name}*\n💰 ${priceStr}`;

  if (!p.imageUrl) {
    // No image at all — send as text card
    await postToWA({
      ...common,
      type: 'text',
      text: { body: formatForWhatsApp(fallbackText) },
    }).catch(e => console.warn(`[WA] Text card failed for "${p.name}":`, e));
  } else {
    try {
      await postToWA({
        ...common,
        type: 'image',
        image: {
          link: p.imageUrl,
          caption: formatForWhatsApp(caption),
        },
      });
    } catch (imgErr) {
      console.warn(`[WA] Image failed for "${p.name}", falling back to text:`, imgErr);
      await postToWA({
        ...common,
        type: 'text',
        text: { body: formatForWhatsApp(fallbackText) },
      }).catch(e => console.warn(`[WA] Text fallback also failed for "${p.name}":`, e));
    }
  }
  await wait(600);
}

    // C. Send Footer Instruction LAST
    
  }

  // 3. Handle CHECKOUT Action
  else if (reply.type === 'action' && reply.action === 'checkout') {
    const checkoutUrl = reply.url.startsWith('http') ? reply.url : `${baseUrl}${reply.url}`;
    const itemSummary = (reply.items || [])
      .map((i: any) => `• ${i.name} x${i.quantity}`)
      .join('\n');
  
    const bodyText = formatForWhatsApp(
      reply.content?.includes('GHS')
        ? reply.content
        : `${reply.content || 'Your order is ready! 😊'}\n\n${itemSummary}\n\n💰 Total: GHS ${reply.total}`
    );
  
    try {
      await postToWA({
        ...common,
        type: "interactive",
        interactive: {
          type: "cta_url",
          body: {
            text: bodyText.slice(0, 1024),
          },
          action: {
            name: "cta_url",
            parameters: {
              display_text: "Complete Order",
              url: checkoutUrl,
            },
          },
        },
      });
    } catch (err) {
      console.warn('[WA Webhook] CTA send failed, falling back to text:', err);
      const fallbackText = `${bodyText}\n\nComplete your order here: ${checkoutUrl}`;
      await postToWA({
        ...common,
        type: "text",
        text: { body: fallbackText },
      });
    }
  }
}

// ── Helper: Format text for WhatsApp (Bold/Links) ──────────────────────────
function formatForWhatsApp(text: string): string {
    if (!text) return '';
    return text
      .replace(/\*\*(.*?)\*\*/g, '*$1*') // Convert **bold** to *bold*
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$2') // Convert [text](url) to just url
      .trim();
}

