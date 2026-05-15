import { db } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

type NudgeInfo = {
  message: string;
  maxNudges: number;
  contextType: string;
  contextPayload?: Record<string, any> | null;
};

function getRecentRelevantPrompt(convData: any): string | null {
  const lastUserMessage = String(convData.lastUserMessage || '').trim();
  const lastAssistantMessage = String(convData.lastAssistantMessage || '').trim();
  const handoverReason = String(convData.handoverReason || '').trim();

  if (handoverReason) return handoverReason;
  if (lastUserMessage) return lastUserMessage;
  if (lastAssistantMessage) return lastAssistantMessage;

  return null;
}

function conversationLooksClosed(messages: any[]): boolean {
  const lastUserMsg = messages.find((m) => m.role === 'user');
  if (!lastUserMsg) return false;

  const text = String(lastUserMsg.content || '').toLowerCase();
  return /^(thanks|thank you|all good|sorted|never mind|dont want|don't want|cancel it|cancelled|already paid|i paid|payment done|paid already)$/i.test(
    text
  );
}

function shouldSkipNudge(
  convData: any,
  messages: any[],
  now: number
): { skip: boolean; reason?: string } {
  const lastNudgeMs = convData.lastNudgeSent?.toMillis?.() || 0;

  if (lastNudgeMs && now - lastNudgeMs < 60 * 1000) {
    return { skip: true, reason: 'too_recent' };
  }

  const lastUserMessageAt = convData.lastUserMessageAt?.toMillis?.() || 0;
  if (lastNudgeMs && lastUserMessageAt > lastNudgeMs) {
    return { skip: true, reason: 'user_replied_after_nudge' };
  }

  const lastMsg = messages[0];
  if (lastMsg?.role === 'user') {
    return { skip: true, reason: 'last_message_user' };
  }

  if (lastMsg?.isNudge === true) {
    return { skip: true, reason: 'last_message_nudge' };
  }

  if (conversationLooksClosed(messages)) {
    return { skip: true, reason: 'conversation_closed' };
  }

  if (convData.pendingAiComeback?.resolved === false) {
    return { skip: true, reason: 'awaiting_ai_comeback' };
  }

  return { skip: false };
}

function getNudgeMessage(convData: any): NudgeInfo | null {
  const name = String(convData.customerName || '').trim();
  const greeting = name ? `${name}, ` : '';
  const nudgeCount = Number(convData.nudgeCount || 0);
  const recentRelevantPrompt = getRecentRelevantPrompt(convData);
  const isNeedsReview =
    convData.status === 'needs_review' || !!convData.handoverReason;

  if (isNeedsReview) {
    const messages = [
      `${greeting}just checking in — I'm still here with you 😊 The team has been notified. If you have your order reference or number, send it here and I'll keep helping.`,
      `${greeting}thanks for your patience please 🙏 I'm still following this up. You can send your order reference or ask me anything else while you wait 😊`,
    ];

    return {
      message: messages[Math.min(nudgeCount, messages.length - 1)],
      maxNudges: 2,
      contextType: 'needs_review_followup',
      contextPayload: {
        handoverReason: convData.handoverReason || null,
        recentRelevantPrompt,
      },
    };
  }

  if (convData.awaitingStep === 'variant') {
    return {
      message: `${greeting}please which option would you like?`,
      maxNudges: 2,
      contextType: 'awaiting_variant',
      contextPayload: { recentRelevantPrompt },
    };
  }

  if (convData.awaitingStep === 'quantity') {
    return {
      message: `${greeting}how many would you like please?`,
      maxNudges: 2,
      contextType: 'awaiting_quantity',
      contextPayload: { recentRelevantPrompt },
    };
  }

  if (convData.awaitingStep === 'delivery') {
    return {
      message: `${greeting}where should we deliver to please?`,
      maxNudges: 2,
      contextType: 'awaiting_delivery',
      contextPayload: { recentRelevantPrompt },
    };
  }

  if (convData.awaitingStep === 'confirmation') {
    return {
      message: `${greeting}should I go ahead and create the order for you?`,
      maxNudges: 2,
      contextType: 'awaiting_confirmation',
      contextPayload: { recentRelevantPrompt },
    };
  }

  return null;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = Date.now();
    const silenceThreshold = new Date(now - 180 * 1000); // 3 minutes
    const maxAge = new Date(now - 60 * 60 * 1000); // 1 hour

    console.log(`[Nudge Cron] Starting run at ${new Date(now).toISOString()}`);

    const storesSnap = await db
      .collection('stores')
      .where('aiAssistant.enabled', '==', true)
      .get();

    console.log(`[Nudge Cron] Found ${storesSnap.size} stores with AI enabled`);

    let nudged = 0;
    let skipped = 0;

    for (const storeDoc of storesSnap.docs) {
      const storeId = storeDoc.id;
      console.log(`[Nudge Cron] Checking store: ${storeId}`);

      const convosSnap = await storeDoc.ref
        .collection('ai_conversations')
        .where('status', 'in', ['active', 'needs_review'])
        .where('updatedAt', '>', maxAge)
        .where('updatedAt', '<', silenceThreshold)
        .limit(20)
        .get();

      console.log(
        `[Nudge Cron] Found ${convosSnap.size} conversations in store ${storeId}`
      );

      for (const convDoc of convosSnap.docs) {
        const convData = convDoc.data();
        const convId = convDoc.id;

        console.log(
          `[Nudge Debug] Checking conv ${convId} | awaitingStep: ${convData.awaitingStep || 'none'} | nudgeCount: ${convData.nudgeCount || 0} | channel: ${convData.channel}`
        );

        // ── COMEBACK SAFETY NET ─────────────────────────────────────────
        // Background retry in route.ts delivers most answers within 8 seconds.
        // This catches any that failed or timed out after 2+ minutes.
        if (convData.pendingAiComeback?.resolved === false) {
          const lastUserAt = convData.lastUserMessageAt?.toMillis?.() || 0;
          const comebackSetAt = convData.pendingAiComeback?.setAt?.toMillis?.() || 0;
          const minutesSinceComeback = (now - comebackSetAt) / 1000 / 60;

          // Customer already replied after the stall — discard comeback state silently
          if (lastUserAt > comebackSetAt) {
            await convDoc.ref.set(
              {
                pendingAiComeback: FieldValue.delete(),
                updatedAt: FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
            skipped++;
            continue;
          }

          // No triggering message stored — background retry already cleared it
          if (!convData.pendingAiComeback?.triggeringMessage) {
            await convDoc.ref.set(
              {
                pendingAiComeback: FieldValue.delete(),
                updatedAt: FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
            skipped++;
            continue;
          }

          // Comeback is older than 2 minutes — background retry clearly failed
          // Send honest reassurance so customer doesn't keep waiting in silence
          if (minutesSinceComeback > 2) {
            const name = convData.customerName || '';
            const reassurance = name
              ? `Sorry ${name}, I'm still looking into that for you 😊 Give me just a moment please.`
              : `Sorry please, I'm still checking on that for you 😊 Give me just a moment.`;

            const msgRef = convDoc.ref.collection('messages').doc();
            const inboxRef = storeDoc.ref.collection('inboxThreads').doc(convId);
            const batch = db.batch();

            batch.set(msgRef, {
              role: 'model',
              content: reassurance,
              type: 'text',
              isNudge: true,
              createdAt: FieldValue.serverTimestamp(),
            });
            batch.set(
              inboxRef,
              {
                lastMessagePreview: reassurance.slice(0, 160),
                lastMessageAt: FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
            batch.set(
              convDoc.ref,
              {
                pendingAiComeback: FieldValue.delete(),
                lastAssistantMessage: reassurance,
                lastAssistantMessageAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
              },
              { merge: true }
            );

            await batch.commit();

            if (convData.channel === 'whatsapp' && convData.customerWhatsAppId) {
              try {
                const storeData = storeDoc.data();
                const phoneId = storeData?.whatsapp?.phoneId;
                const token = storeData?.whatsapp?.accessToken;

                if (phoneId && token) {
                  await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                      messaging_product: 'whatsapp',
                      to: convData.customerWhatsAppId,
                      type: 'text',
                      text: { body: reassurance },
                    }),
                  });
                }
              } catch (e: any) {
                console.error(
                  `[Comeback] WhatsApp send failed for ${convId}:`,
                  e?.message
                );
              }
            }

            if (convData.channel === 'instagram' && convData.instagramUserId) {
              try {
                const storeData = storeDoc.data();
                const token = storeData?.instagram?.accessToken;

                if (token) {
                  await fetch(`https://graph.instagram.com/v21.0/me/messages`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                      recipient: { id: convData.instagramUserId },
                      message: { text: reassurance },
                      messaging_type: 'RESPONSE',
                    }),
                  });
                }
              } catch (e: any) {
                console.error(
                  `[Comeback] Instagram send failed for ${convId}:`,
                  e?.message
                );
              }
            }

            nudged++;
            continue;
          }

          // Background retry still in progress (< 2 mins) — skip this pass
          skipped++;
          continue;
        }

        // ── NORMAL NUDGE FLOW ───────────────────────────────────────────
        const currentNudgeCount = Number(convData.nudgeCount || 0);
        const nudgeInfo = getNudgeMessage(convData);

        if (!nudgeInfo) {
          console.log(`[Nudge Skip] ${convId} → no nudge info`);
          skipped++;
          continue;
        }

        if (currentNudgeCount >= nudgeInfo.maxNudges) {
          console.log(
            `[Nudge Skip] ${convId} → max nudges reached (${currentNudgeCount}/${nudgeInfo.maxNudges})`
          );
          skipped++;
          continue;
        }

        const recentMsgsSnap = await convDoc.ref
          .collection('messages')
          .orderBy('createdAt', 'desc')
          .limit(5)
          .get();

        const recentMessages = recentMsgsSnap.docs.map((d) => d.data());

        const preflight = shouldSkipNudge(convData, recentMessages, now);
        if (preflight.skip) {
          console.log(`[Nudge Skip] ${convId} → ${preflight.reason}`);
          skipped++;
          continue;
        }

        console.log(
          `[Nudge] Sending nudge to ${convId} (count ${currentNudgeCount + 1})`
        );

        const msgRef = convDoc.ref.collection('messages').doc();
        const inboxRef = storeDoc.ref.collection('inboxThreads').doc(convId);
        const batch = db.batch();

        batch.set(msgRef, {
          role: 'model',
          content: nudgeInfo.message,
          type: 'text',
          isNudge: true,
          createdAt: FieldValue.serverTimestamp(),
        });
        batch.set(
          inboxRef,
          {
            lastMessagePreview: nudgeInfo.message.slice(0, 160),
            lastMessageAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        batch.set(
          convDoc.ref,
          {
            nudgeCount: currentNudgeCount + 1,
            lastNudgeSent: FieldValue.serverTimestamp(),
            lastNudgeMessage: nudgeInfo.message,
            lastNudgeContextType: nudgeInfo.contextType,
            lastNudgeContextPayload: nudgeInfo.contextPayload || null,
            lastAssistantMessage: nudgeInfo.message,
            lastAssistantMessageAt: FieldValue.serverTimestamp(),
            lastAutomationAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        await batch.commit();

        if (convData.channel === 'whatsapp' && convData.customerWhatsAppId) {
          try {
            const storeData = storeDoc.data();
            const phoneId = storeData?.whatsapp?.phoneId;
            const token = storeData?.whatsapp?.accessToken;

            if (!phoneId || !token) {
              console.error(
                `[Nudge] ❌ Missing WhatsApp config for store ${storeId}`
              );
            } else {
              const response = await fetch(
                `https://graph.facebook.com/v21.0/${phoneId}/messages`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    to: convData.customerWhatsAppId,
                    type: 'text',
                    text: { body: nudgeInfo.message },
                  }),
                }
              );

              if (response.ok) {
                console.log(
                  `[Nudge] ✅ WhatsApp SUCCESS sent to ${convData.customerWhatsAppId}`
                );
              } else {
                const errorBody = await response.text();
                console.error(
                  `[Nudge] ❌ WhatsApp FAILED → Status ${response.status} for conv ${convId}`
                );
                console.error(`[Nudge] Error: ${errorBody}`);
              }
            }
          } catch (e: any) {
            console.error(
              `[Nudge] ❌ WhatsApp network error for conv ${convId}:`,
              e?.message || e
            );
          }
        }

        if (convData.channel === 'instagram' && convData.instagramUserId) {
          try {
            const storeData = storeDoc.data();
            const token = storeData?.instagram?.accessToken;

            if (token) {
              const response = await fetch(`https://graph.instagram.com/v21.0/me/messages`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  recipient: { id: convData.instagramUserId },
                  message: { text: nudgeInfo.message },
                  messaging_type: 'RESPONSE',
                }),
              });

              if (response.ok) {
                console.log(
                  `[Nudge] ✅ Instagram SUCCESS sent to ${convData.instagramUserId}`
                );
              } else {
                const errorBody = await response.text();
                console.error(
                  `[Nudge] ❌ Instagram FAILED → Status ${response.status} for conv ${convId}: ${errorBody}`
                );
              }
            }
          } catch (e: any) {
            console.error(
              `[Nudge] ❌ Instagram network error for conv ${convId}:`,
              e?.message || e
            );
          }
        }

        nudged++;
      }
    }

    console.log(`[Nudge Cron] Finished → Sent ${nudged} nudges, skipped ${skipped}`);
    return NextResponse.json({ success: true, nudged, skipped });
  } catch (err: any) {
    console.error('[Nudge Cron] Critical Error:', err);
    return NextResponse.json(
      { error: err?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}