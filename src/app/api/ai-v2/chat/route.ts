import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '@/lib/firebase-admin';
import { runAiTurn } from '@/ai-v2/orchestrator/runAiTurn';
import { checkAiAccess } from '@/lib/ai-gatekeeper';
import type { AiV2Reply, Channel } from '@/ai-v2/types';

export const maxDuration = 60;

const HANDOVER_AUTO_EXPIRE_HOURS = 2;
const RE_ENGAGE_RE = /\b(hi|hello|hey|good morning|good afternoon|good evening|start|new order|order|help)\b/i;

type AiV2ChatRequest = {
  storeId?: string;
  conversationId?: string;
  clientMessageId?: string;
  message?: string | null;
  imageUrl?: string | null;
  channel?: Channel;
  customerPhone?: string | null;
  phone?: string | null;
  calledByInngest?: boolean;
};

function isValidChannel(value: unknown): value is Channel {
  return value === 'webchat' || value === 'whatsapp' || value === 'instagram';
}

/**
 * Resolve the channel for this turn. Priority:
 * 1. Request body channel (webhooks pass it explicitly)
 * 2. Conversation's persisted channel
 * 3. wa_ prefix → whatsapp
 * 4. instagramUserId present → instagram
 * 5. Default → webchat
 */
function inferChannel(input: {
  requestChannel: Channel | undefined;
  conversationId: string;
  convData: any;
}): Channel {
  if (input.requestChannel) return input.requestChannel;
  if (input.convData?.channel === 'whatsapp') return 'whatsapp';
  if (input.convData?.channel === 'instagram') return 'instagram';
  if (input.conversationId.startsWith('wa_')) return 'whatsapp';
  if (input.convData?.instagramUserId) return 'instagram';
  return 'webchat';
}

/**
 * V1 stores the master toggle channel keys as 'web' / 'whatsapp' / 'instagram'.
 * V2's own toggle uses 'webchat' / 'whatsapp' / 'instagram'.
 * This resolves the V1-side key.
 */
function v1ChannelKey(channel: Channel): string {
  return channel === 'webchat' ? 'web' : channel;
}

function normalizeReplyContent(reply: AiV2Reply): string {
  if (reply.type === 'text') return reply.content;
  if (reply.type === 'product_cards') return reply.content;
  if (reply.type === 'action') return reply.content;
  return '';
}

async function saveUserMessage(input: {
  storeId: string;
  conversationId: string;
  clientMessageId?: string | null;
  message: string;
  imageUrl?: string | null;
  channel: Channel;
  customerWhatsAppId?: string | null;
  conversationExists: boolean;
}) {
  const convRef = db
    .collection('stores')
    .doc(input.storeId)
    .collection('ai_conversations')
    .doc(input.conversationId);

  const msgRef = input.clientMessageId
    ? convRef.collection('messages').doc(input.clientMessageId)
    : convRef.collection('messages').doc();

  await Promise.all([
    msgRef.set({
      role: 'user',
      content: input.message,
      imageUrl: input.imageUrl || null,
      type: 'text',
      createdAt: FieldValue.serverTimestamp(),
    }),

    convRef.set(
      {
        storeId: input.storeId,
        status: 'active',
        updatedAt: FieldValue.serverTimestamp(),
        lastUserMessage: input.message,
        lastUserMessageAt: FieldValue.serverTimestamp(),
        lastMessageAt: FieldValue.serverTimestamp(),
        messageCount: FieldValue.increment(1),
        // Channel is set on initial creation only — never overwrite
        // a conversation's channel from a later request.
        ...(!input.conversationExists ? { channel: input.channel } : {}),
        // For WA conversations, persist the WA id whenever present.
        ...(input.customerWhatsAppId
          ? {
              customerWhatsAppId: input.customerWhatsAppId,
              channel: 'whatsapp',
            }
          : {}),
      },
      { merge: true },
    ),

    db
      .collection('stores')
      .doc(input.storeId)
      .collection('inboxThreads')
      .doc(input.conversationId)
      .set(
        {
          threadId: input.conversationId,
          channel: 'ai_chat',
          lastMessageAt: FieldValue.serverTimestamp(),
          lastMessagePreview: input.imageUrl ? '📷 Image' : input.message,
          unreadForVendor: true,
          status: 'open',
          storeId: input.storeId,
        },
        { merge: true },
      ),
  ]);
}

async function saveAssistantMessage(input: {
  storeId: string;
  conversationId: string;
  reply: AiV2Reply;
}) {
  if (input.reply.type === 'silent') return;

  const convRef = db
    .collection('stores')
    .doc(input.storeId)
    .collection('ai_conversations')
    .doc(input.conversationId);

  const msgRef = convRef.collection('messages').doc();
  const content = normalizeReplyContent(input.reply);
  const isCheckout =
    input.reply.type === 'action' && input.reply.action === 'checkout';

  await Promise.all([
    msgRef.set(
      {
        role: 'model',
        content,
        createdAt: FieldValue.serverTimestamp(),
        type: input.reply.type,
        ...(input.reply.type === 'product_cards'
          ? { products: input.reply.products }
          : {}),
        ...(isCheckout ? { actionData: input.reply } : {}),
      },
      { merge: true },
    ),

    convRef.set(
      {
        updatedAt: FieldValue.serverTimestamp(),
        lastAssistantMessage: content,
        lastAssistantMessageAt: FieldValue.serverTimestamp(),
        lastMessageAt: FieldValue.serverTimestamp(),
        messageCount: FieldValue.increment(1),
      },
      { merge: true },
    ),

    db
      .collection('stores')
      .doc(input.storeId)
      .collection('inboxThreads')
      .doc(input.conversationId)
      .set(
        {
          lastMessagePreview: content.slice(0, 160),
          lastMessageAt: FieldValue.serverTimestamp(),
          unreadForVendor: false,
        },
        { merge: true },
      ),
  ]);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AiV2ChatRequest;

    const storeId = String(body.storeId || '').trim();
    const conversationId = String(body.conversationId || '').trim();
    const clientMessageId = body.clientMessageId
      ? String(body.clientMessageId).trim()
      : null;
    const message = String(body.message || '').trim();
    const imageUrl = body.imageUrl || null;
    const requestChannel = isValidChannel(body.channel) ? body.channel : undefined;
    const customerPhone = body.customerPhone || body.phone || null;

    if (!storeId) {
      return NextResponse.json({ error: 'Missing storeId' }, { status: 400 });
    }
    if (!conversationId) {
      return NextResponse.json({ error: 'Missing conversationId' }, { status: 400 });
    }
    if (!message && !imageUrl) {
      return NextResponse.json({ error: 'Missing message' }, { status: 400 });
    }

    // ── Load store + conversation
    const convRef = db
      .collection('stores')
      .doc(storeId)
      .collection('ai_conversations')
      .doc(conversationId);

    const [storeSnap, convSnap] = await Promise.all([
      db.collection('stores').doc(storeId).get(),
      convRef.get(),
    ]);

    const storeData = storeSnap.data() || {};
    const convData = convSnap.data() || {};

    const channel = inferChannel({
      requestChannel,
      conversationId,
      convData,
    });

    // ── 1. AI access gate (subscription / plan eligibility) ──
    const gate = await checkAiAccess(storeId);
    if (!gate.allowed) {
      return NextResponse.json({
        reply: {
          type: 'text',
          content:
            "I'm currently unavailable to assist. Please contact the store directly.",
        },
      });
    }

    // ── 2. V2 enablement check (per-channel) ──
    const aiV2Enabled = storeData?.aiV2?.enabled === true;
    const aiV2ChannelEnabled =
      storeData?.aiV2?.channels?.[channel] === true;

    if (!aiV2Enabled || !aiV2ChannelEnabled) {
      return NextResponse.json(
        { error: `AI v2 is not enabled for ${channel} on this store.` },
        { status: 403 },
      );
    }

    // ── 3. Master AI toggle + V1 channel toggle (vendor pause) ──
    const isMasterEnabled = storeData?.aiAssistant?.enabled !== false;
    const v1Channel = v1ChannelKey(channel);
    const isV1ChannelEnabled =
      storeData?.aiAssistant?.channels?.[v1Channel] !== false;

    // ── 4. Handover detection with auto-expire ──
    let isHandoverActive = convData?.handoverMode === true;
    if (isHandoverActive) {
      const handoverAt = convData.handoverAt?.toMillis?.() || 0;
      const handoverAgeHours =
        handoverAt > 0 ? (Date.now() - handoverAt) / 1000 / 60 / 60 : 0;
      const isReEngage = RE_ENGAGE_RE.test(message);

      if (handoverAgeHours > HANDOVER_AUTO_EXPIRE_HOURS || isReEngage) {
        await convRef.set(
          {
            handoverMode: FieldValue.delete(),
            handoverAt: FieldValue.delete(),
            status: 'active',
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        isHandoverActive = false;
      }
    }

    // Compute WA id once — used in both paused and active paths.
    const customerWhatsAppId =
      conversationId.startsWith('wa_')
        ? customerPhone || convData.customerWhatsAppId || null
        : null;

    // ── 5. AI paused (master off / channel off / handover) → silent reply ──
    if (!isMasterEnabled || !isV1ChannelEnabled || isHandoverActive) {
      await saveUserMessage({
        storeId,
        conversationId,
        clientMessageId,
        message,
        imageUrl,
        channel,
        customerWhatsAppId,
        conversationExists: convSnap.exists,
      });
      return NextResponse.json({
        reply: { type: 'silent', reason: 'ai_paused' },
      });
    }

    // ── 6. Idempotency check ──
    if (clientMessageId) {
      const userMsgSnap = await convRef
        .collection('messages')
        .doc(clientMessageId)
        .get();

      if (userMsgSnap.exists) {
        const userCreatedAt = userMsgSnap.data()?.createdAt;
        if (userCreatedAt) {
          const replySnap = await convRef
            .collection('messages')
            .where('role', '==', 'model')
            .where('createdAt', '>', userCreatedAt)
            .orderBy('createdAt', 'asc')
            .limit(1)
            .get();

          if (!replySnap.empty) {
            const cached = replySnap.docs[0].data();
            const cachedReply: AiV2Reply = cached.actionData ?? {
              type: (cached.type as any) || 'text',
              content: cached.content || '',
              ...(cached.products ? { products: cached.products } : {}),
            };
            return NextResponse.json({
              reply: cachedReply,
              debug: {
                stateBefore: 'idempotent_dedup',
                stateAfter: 'idempotent_dedup',
                handler: 'route_idempotency',
                reason: 'duplicate_post_returned_cached_reply',
              },
            });
          }
        }
      }
    }

    // ── 7. Save user message ──
    await saveUserMessage({
      storeId,
      conversationId,
      clientMessageId,
      message,
      imageUrl,
      channel,
      customerWhatsAppId,
      conversationExists: convSnap.exists,
    });

    // ── 8. Run V2 orchestrator ──
    const result = await runAiTurn({
      storeId,
      conversationId,
      channel,
      message,
      imageUrl,
    });

    // ── 9. Save assistant message ──
    await saveAssistantMessage({
      storeId,
      conversationId,
      reply: result.reply,
    });

    // TODO(post-migration): credit deduction.
    // Once getActiveCreditPeriod / deductAiCredits are extracted from
    // V1's chat route into a shared module (e.g. src/lib/ai-credits.ts),
    // wire them in here:
    //
    //   const period = await getActiveCreditPeriod(gate.sellerId!);
    //   if (period) await deductAiCredits(gate.sellerId!, CREDITS_PER_RESPONSE);
    //
    // For preview branch this is acceptable. For production, deduction
    // must run before this route returns success.

    return NextResponse.json({
      reply: result.reply,
      debug: result.debug || null,
    });
  } catch (error: any) {
    console.error('[AI V2 Chat Route] Failed:', error);
    return NextResponse.json(
      {
        error: 'AI v2 chat failed',
        details:
          process.env.NODE_ENV === 'development'
            ? String(error?.message || error)
            : undefined,
      },
      { status: 500 },
    );
  }
}