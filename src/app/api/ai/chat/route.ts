import { kv } from '@vercel/kv';
import { NextRequest, NextResponse } from 'next/server';
import Fuse from 'fuse.js';
import { inngest } from '@/inngest/functions';
import { db } from '@/lib/firebase-admin';

import { waitUntil } from '@vercel/functions';
import { genAI } from '@/ai/genkit';
import { FieldValue } from 'firebase-admin/firestore';
import { buildSystemPrompt } from '@/ai/prompts/systemPrompt';
import { tools } from '@/ai/tools';
import { handleToolCall, handleHandover, saveModelResponse } from '@/ai/handlers';
import { AI_TIMEOUT, MAX_PRODUCTS_IN_PROMPT } from '@/ai/constants';
import { extractQuantity } from '@/ai/utils/extractQuantity';
import { Product } from '@/types/product';
import { fetchAndCacheCustomerMemory } from '@/ai/utils/customerMemory';
import { PlatformPricing, PlanId } from '@/lib/pricing';
import { Timestamp } from 'firebase-admin/firestore';
import { checkAiAccess } from '@/lib/ai-gatekeeper';
import { validateLLMOutput } from '@/ai/utils/validateLLMOutput';

export const maxDuration = 300;
const DISABLE_QUICK_REPLIES = true;

// ── Credit Configuration ───────────────────────────────────────────────────
const CREDITS_PER_RESPONSE = 2;

// ── Retry Configuration ──────────────────────────────────────────────────────
const MAX_RETRIES = 1;
const BASE_DELAY_MS = 1000; 
const RETRYABLE_ERRORS = [503, 429, 'UNAVAILABLE', 'RESOURCE_EXHAUSTED', 'TIMEOUT', 'ECONNRESET', 'ETIMEDOUT'];

function isRetryable(err: any): boolean {
  const msg = String(err?.message || err?.status || '');
  const code = err?.status || err?.code || err?.httpStatusCode;
  return RETRYABLE_ERRORS.some(e =>
    (typeof e === 'number' && code === e) || msg.toUpperCase().includes(String(e))
  );
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendWithRetry(
  chat: any,
  messageParts: any[],
  remainingMs: number,
  opts?: {
    fallbackModel?: string;
    systemInstruction?: any;
    history?: any[];
    activeTools?: any[];
  }
): Promise<any> {
  let lastErr: any;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const timeout = Math.max(2000, remainingMs - (attempt * BASE_DELAY_MS * 2));
      const result = await Promise.race([
        chat.sendMessage(messageParts),
        new Promise((_, rej) => setTimeout(() => rej(new Error('TIMEOUT')), timeout))
      ]);
      return result; 
    } catch (err: any) {
      lastErr = err;
      console.warn(`[Chat API] Gemini attempt ${attempt + 1}/${MAX_RETRIES} failed:`, err?.message || err);

      if (!isRetryable(err) || attempt === MAX_RETRIES - 1) break;

      const delay = BASE_DELAY_MS * Math.pow(2, attempt) * (0.75 + Math.random() * 0.5);
      await sleep(delay);
    }
  }

  if (opts?.fallbackModel) {
    console.warn(`[Chat API] Primary model exhausted retries. Falling back to ${opts.fallbackModel}`);
    try {
      const fallbackGenModel = genAI.getGenerativeModel({
        model: opts.fallbackModel,
        systemInstruction: opts.systemInstruction,
        tools: opts.activeTools,
      } as any);

      const fallbackChat = fallbackGenModel.startChat({
        ...(opts.history?.length ? { history: opts.history } : {}),
      } as any);

      const result = await Promise.race([
        fallbackChat.sendMessage(messageParts),
        new Promise((_, rej) => setTimeout(() => rej(new Error('TIMEOUT')), 15000))
      ]);
      console.log(`[Chat API] Fallback to ${opts.fallbackModel} succeeded!`);
      return result;
    } catch (fallbackErr: any) {
      console.error(`[Chat API] Fallback model also failed:`, fallbackErr?.message);
    }
  }

  throw lastErr;
}

function getMimeType(url: string): string {
  const clean = url.split('?')[0].split('/').pop() || '';
  if (clean.endsWith('.png')) return 'image/png';
  if (clean.endsWith('.webp')) return 'image/webp';
  if (clean.endsWith('.heic') || clean.endsWith('.heif')) return 'image/heic';
  return 'image/jpeg';
}

function isRealHandoverScenario(userMessage: string): boolean {
  const t = String(userMessage || '').toLowerCase().trim();

  return (
    /\b(i want (a )?human|real person|talk to someone|call me|speak to (the )?seller|manager)\b/i.test(t) ||
    /\b(paid|payment|charged twice|sent momo but|money left my account|payment dispute)\b/i.test(t) ||
    /\b(wrong item|damaged|broken|received wrong)\b/i.test(t) ||
    /\b(cancel my paid order|change my paid order|modify paid order)\b/i.test(t)
  );
}





function normalizeForComparison(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}


function getAiEffectivePrice(product: any, storeData: any) {
  const marketing = storeData?.marketing || {};
  const globalDiscount =
    marketing.isSiteWideSaleActive ? Number(marketing.siteWideDiscount || 0) : 0;

  const basePrice = Number(product?.price || 0);

  if (globalDiscount > 0) {
    return basePrice * (1 - globalDiscount / 100);
  }

  return basePrice;
}

function getAiEffectiveVariantPrice(variant: any, storeData: any) {
  const marketing = storeData?.marketing || {};
  const globalDiscount =
    marketing.isSiteWideSaleActive ? Number(marketing.siteWideDiscount || 0) : 0;

  const basePrice = Number(variant?.price || 0);

  if (globalDiscount > 0) {
    return basePrice * (1 - globalDiscount / 100);
  }

  return basePrice;
}
function extractCatalogIntent(message: string): { searchTerm: string | null; browse: boolean } {
  const raw = normalizeForComparison(message);

  if (!raw) return { searchTerm: null, browse: false };

  if (
    /^(hi|hello|hey|ok|okay|alright|thanks|thank you|yes|yeah|yep|no|nope)$/i.test(raw) ||
    /\b(my order|my cart|my bag|checkout|delivery|when will|receipt|payment|track|status|address|same details|cancel|confirm|help|link|zone|area)\b/i.test(raw)
  ) {
    return { searchTerm: null, browse: false };
  }

  const browse =
    /\b(show me|what do you have|catalog|browse|all products|all items|show products)\b/i.test(raw);

  const cleaned = raw
    .replace(/^(ok|okay|alright|pls|please|abeg|hello|hi|hey)\b\s*/i, '')
    .replace(/\b(do you have|is there|do you sell|do you carry|is it available|do you stock|i want|i need|looking for|search for|find me|price of|how much is|what about|show me|available)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (browse) return { searchTerm: 'show products', browse: true };

  if (
    cleaned.length >= 3 &&
    cleaned.split(' ').length <= 8 &&
    !/\b(order|cart|checkout|delivery|payment|address|status|link|help)\b/i.test(cleaned)
  ) {
    return { searchTerm: cleaned, browse: false };
  }

  return { searchTerm: null, browse: false };
}




function buildProactiveGroundingBlock(products: Product[], storeData: any): string {
  if (!products.length) return '';

  const lines = products.map((p: any) => {
    const priceText =
      Array.isArray(p.variants) && p.variants.length > 0
        ? `from GHS ${Math.min(...p.variants.map((v: any) => getAiEffectiveVariantPrice(v, storeData))).toFixed(2)}`
        : `GHS ${getAiEffectivePrice(p, storeData).toFixed(2)}`;

    const variantsText =
      Array.isArray(p.variants) && p.variants.length > 0
        ? ` | Variants: ${p.variants.map((v: any) => `${v.name} (${getAiEffectiveVariantPrice(v, storeData).toFixed(2)})`).join(', ')}`
        : '';

    return `- ${p.name} | ${priceText}${variantsText}`;
  });

  return `
[PROACTIVE_GROUNDING]
These are the most relevant grounded catalog matches for the customer's latest message.
If the customer is asking for a specific product and it appears below, do not say it is unavailable.
${lines.join('\n')}
`;
}

function isClearlyNewIntent(message: string): boolean {
  const text = normalizeForComparison(message);

  return (
    /\b(start|new order|fresh order|another order|different order|start fresh)\b/i.test(text) ||
    /\b(show me|what do you have|products|catalog|available|browse)\b/i.test(text) ||
    /\b(track|check my order|order status|lookup)\b/i.test(text) ||
    /\b(resend|link again|checkout link|send the link)\b/i.test(text) ||
    /\b(change address|change location|change delivery|deliver to|new delivery)\b/i.test(text) ||
    /\b(hi|hello|hey|good morning|good afternoon)\b/i.test(text)
  );
}




function isSimpleContinuationReply(message: string): boolean {
  const text = String(message || '').toLowerCase().trim();

  return (
    /^(yes|yeah|yep|ok|okay|alright|sure|please|pls)$/i.test(text) ||
    /^(hello|hi|hey)$/i.test(text) ||
    /^(am still here|i'm still here|im still here|still here)$/i.test(text) ||
    /^(ok are you back|okay are you back|are you back|you there)$/i.test(text) ||
    /^(am still waiting|i'm still waiting|im still waiting|still waiting|waiting)$/i.test(text) ||
    /^(yes i'?m still interested|yes im still interested|still interested)$/i.test(text)
  );
}

function isRecentNudgeReply(convData: any, message: string): boolean {
  const lastNudgeMs = convData.lastNudgeSent?.toMillis?.() || 0;
  if (!lastNudgeMs) return false;

  const withinWindow = Date.now() - lastNudgeMs <= 30 * 60 * 1000; // 30 mins
  if (!withinWindow) return false;

  return isSimpleContinuationReply(message);
}




function extractOrderReference(message: string): string | null {
  const text = String(message || '').trim();

  // Catch BEST- prefixed refs first (most common in your system)
  const bestPrefixed = text.match(/\b(BEST-[A-Z0-9]{5,20})\b/i);
  if (bestPrefixed) return bestPrefixed[1];

  // Generic fallback for other reference formats (e.g. ABCD-12345)
  const genericRef = text.match(/\b([A-Z]{2,10}-[A-Z0-9]{4,20})\b/i);
  if (genericRef) return genericRef[1];

  return null;
}



async function clearAiErrorState(convRef: FirebaseFirestore.DocumentReference) {
  await convRef.set({
    aiErrorFlag: FieldValue.delete(),
    aiErrorContextActive: FieldValue.delete(),
    aiErrorCount: FieldValue.delete(),
    lastAiError: FieldValue.delete(),
    lastAiErrorMessagePreview: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}










function isSameDetailsIntent(message: string): boolean {
  const text = String(message || '').toLowerCase().trim();

  return (
    /\b(use same|same details|same number|same address|same info|same location|same place|same delivery|use my same|use previous address|use the same address|same area)\b/i.test(text) ||
    /^(yes|yes please|yes pls|okay use same|ok use same|alright use same)$/i.test(text)
  );
}

function isNewAddressIntent(message: string): boolean {
  const text = String(message || '').toLowerCase().trim();

  return (
    /\b(new address|new location|different address|different location|change address|change location|update address|update location|deliver to new|use another address|another location|another address)\b/i.test(text)
  );
}


function isHandoverConfirmationIntent(message: string): boolean {
  const text = String(message || '').toLowerCase().trim();
  return /^(yes|yeah|yep|ok|okay|alright|sure|please|pls|go ahead|do that|do it|hand over|handover|connect me|let them handle it)$/i.test(text);
}

function lastAssistantAskedForHandover(lastAssistantMessage: string): boolean {
  const text = String(lastAssistantMessage || '').toLowerCase();
  return (
    /\b(get the team|get our team|get someone|vendor|seller|human|real person|team to sort|team to help|team handle|sort this out for you|confirm it manually|should i get the team|should i get our team|want me to get the team|want me to get our team)\b/i.test(text)
  );
}

function isNeutralRecoveryMessage(message: string): boolean {
  const text = String(message || '').toLowerCase().trim();
  return /^(hi|hello|hey|am back|i'm back|im back|back|yes|yeah|yep|ok|okay|alright|thanks|thank you|still here|you there|still waiting|am still waiting|i'm still waiting|im still waiting|waiting|but am still waiting|but i'm still waiting)$/i.test(text);
}

function isRecoveryIntent(message: string): boolean {
  const text = String(message || '').toLowerCase().trim();
  return isNeutralRecoveryMessage(text) ||
    /\b(i want|i need|available|how much|price|send link|checkout|delivery|address|change address|change location|use same|new address|different address|show me|products|catalog|order)\b/i.test(text);
}

async function clearStuckConversationState(convRef: FirebaseFirestore.DocumentReference) {
  await convRef.set({
    status: 'active',
    // IMPORTANT: Do NOT delete handoverAt or handoverReason — we need them for cooldown
    awaitingStep: FieldValue.delete(),
    awaitingSince: FieldValue.delete(),
    activeFlow: FieldValue.delete(),
    activeFlowStartedAt: FieldValue.delete(),
    aiErrorFlag: FieldValue.delete(),
    aiErrorContextActive: FieldValue.delete(),
    aiErrorCount: FieldValue.delete(),
    lastAiError: FieldValue.delete(),
    lastAiErrorMessagePreview: FieldValue.delete(),
    lastNudgeSent: FieldValue.delete(),
    lastNudgeMessage: FieldValue.delete(),
    lastNudgeContextType: FieldValue.delete(),
    lastNudgeContextPayload: FieldValue.delete(),
    nudgeCount: 0,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function getActiveCreditPeriod(sellerId: string) {
  const now = new Date();
  const periodsRef = db.collection('users').doc(sellerId).collection('ai_credit_periods');

  const activeSnap = await periodsRef
  .where('status', '==', 'active')
  .orderBy('periodEnd', 'desc')
  .limit(10)
  .get();

const activeDoc = activeSnap.docs.find((doc) => {
  const data = doc.data();
  const periodStart = data.periodStart?.toDate?.() || new Date(data.periodStart);
  const periodEnd = data.periodEnd?.toDate?.() || new Date(data.periodEnd);

  return periodStart <= now && periodEnd > now;
});

if (activeDoc) {
  return {
    ref: activeDoc.ref,
    data: activeDoc.data(),
  };
}

  if (!activeSnap.empty) {
    const doc = activeSnap.docs[0];
    const data = doc.data();

    const periodStart = data.periodStart?.toDate?.() || null;
    const periodEnd = data.periodEnd?.toDate?.() || null;

    if (periodStart && periodEnd && periodStart <= now && periodEnd > now) {
      return { ref: doc.ref, data };
    }
  }

  const upcomingSnap = await periodsRef
    .where('status', '==', 'upcoming')
    .orderBy('periodStart', 'asc')
    .limit(1)
    .get();

  if (!upcomingSnap.empty) {
    const doc = upcomingSnap.docs[0];
    const data = doc.data();

    const periodStart = data.periodStart?.toDate?.() || null;
    const periodEnd = data.periodEnd?.toDate?.() || null;

    if (periodStart && periodEnd && periodStart <= now && periodEnd > now) {
      await doc.ref.update({
        status: 'active',
        updatedAt: FieldValue.serverTimestamp(),
      });

      return {
        ref: doc.ref,
        data: {
          ...data,
          status: 'active',
        },
      };
    }
  }

  return null;
}

async function deductAiCredits(sellerId: string, amount: number) {
  if (!sellerId) return { success: false, reason: 'missing_seller' };

  try {
    const activePeriod = await getActiveCreditPeriod(sellerId);

    if (!activePeriod) {
      return { success: false, reason: 'NO_ACTIVE_PERIOD' };
    }

    await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(activePeriod.ref);

      if (!snap.exists) {
        throw new Error('PERIOD_NOT_FOUND');
      }

      const data = snap.data() || {};

      const periodStart = data.periodStart?.toDate?.() || null;
      const periodEnd = data.periodEnd?.toDate?.() || null;
      const now = new Date();

      if (!periodStart || !periodEnd || periodStart > now || periodEnd <= now) {
        throw new Error('PERIOD_NOT_ACTIVE');
      }

      const remainingCredits = Number(data.remainingCredits || 0);

      if (remainingCredits < amount) {
        throw new Error('INSUFFICIENT_CREDITS');
      }

      transaction.update(activePeriod.ref, {
        usedCredits: FieldValue.increment(amount),
        remainingCredits: FieldValue.increment(-amount),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    console.log(`[Billing] Deducted ${amount} credits from seller ${sellerId}`);
    return { success: true };
  } catch (e: any) {
    console.error('[Billing] Failed to deduct credits:', e?.message || e);
    return { success: false, reason: e?.message || 'deduction_failed' };
  }
}

  




async function retryAiComebackInBackground({
  storeId,
  conversationId,
  triggeringMessage,
  storeData,
  products,
  deliveriesDocs,
}: {
  storeId: string;
  conversationId: string;
  triggeringMessage: string;
  storeData: any;
  products: any[];
  deliveriesDocs: any[];
}) {
  try {
    await new Promise(resolve => setTimeout(resolve, 3000));

    const storeRef = db.collection('stores').doc(storeId);
    const convRef = storeRef.collection('ai_conversations').doc(conversationId);
    const msgRef = convRef.collection('messages');
    const inboxRef = storeRef.collection('inboxThreads').doc(conversationId);

    const convSnap = await convRef.get();
    const convData = convSnap.data() || {};

    if (convData.handoverMode === true) {
      await convRef.set({
        pendingAiComeback: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return;
    }

    const lastUserAt = convData.lastUserMessageAt?.toMillis?.() || 0;
    const comebackSetAt = convData.pendingAiComeback?.setAt?.toMillis?.() || 0;
    if (lastUserAt > comebackSetAt) {
      await convRef.set({ pendingAiComeback: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return;
    }

    const histSnap = await msgRef.orderBy('createdAt', 'desc').limit(20).get();
    let history = histSnap.docs.reverse().map((d: any) => {
      const data = d.data();
      return {
        role: data.role === 'model' ? 'model' as const : 'user' as const,
        parts: [{ text: String(data.content || '') }],
      };
    });
    while (history.length > 0 && history[0].role !== 'user') history.shift();

    const systemInstruction = {
      parts: [{ text: buildSystemPrompt(storeData, products, deliveriesDocs, convData.currentCart || [], convData.customerName || null, convData.customerPhone || null) }],
      role: 'system',
    } as any;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', systemInstruction, tools } as any);
    const chat = model.startChat({ history } as any);
    const retryPrompt = `[SYSTEM RETRY: Your previous response stalled. The customer is still waiting. Answer the original message now with a real response. Use tools if needed. Do not stall again. Original message was: "${triggeringMessage}"]`;

    const result = await Promise.race([
      chat.sendMessage([{ text: retryPrompt }]),
      new Promise((_, rej) => setTimeout(() => rej(new Error('TIMEOUT')), 15000)),
    ]) as any;

    // ─── THE FIX: Check for BOTH text and tool calls ─────────────────
    const retryText = result?.response?.text()?.trim();
    const retryToolCall = result?.response?.functionCalls()?.[0];

    // Freshness check — did customer reply while we were retrying?
    const freshSnap = await convRef.get();
    const freshData = freshSnap.data() || {};
    const freshUserAt = freshData.lastUserMessageAt?.toMillis?.() || 0;
    if (freshUserAt > comebackSetAt) {
      await convRef.set({ pendingAiComeback: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return;
    }

    // ─── TOOL CALL PATH (e.g. create_checkout, add_to_cart) ──────────
    if (retryToolCall) {
      const productsById = new Map(products.map((p: any) => [p.id, p]));
      const refs = { convRef, msgRef, inboxRef };

      // Clear comeback state before executing tool
      await convRef.set({ pendingAiComeback: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });

      let toolResponse: Response | undefined;
      try {
        toolResponse = await handleToolCall(
          retryToolCall,
          refs,
          productsById,
          triggeringMessage,
          storeData,
          conversationId,
          deliveriesDocs
        );
      } catch (e) {
        console.error('[BackgroundRetry] Tool call failed:', e);
        return;
      }

      if (!toolResponse) return;

      // Extract reply content to relay to WhatsApp/Instagram
      const toolData = await toolResponse.clone().json().catch(() => null);
      const replyContent = toolData?.reply?.content || toolData?.reply?.message;

      if (!replyContent) {
        console.log(`[BackgroundRetry] ✅ Tool ${retryToolCall.name} executed (no WA/IG relay needed)`);
        return;
      }

      // ── Send to WhatsApp ──
      if (convData.channel === 'whatsapp' && convData.customerWhatsAppId) {
        const phoneId = storeData?.whatsapp?.phoneId;
        const token = storeData?.whatsapp?.accessToken;
        if (phoneId && token) {
          try {
            if (toolData?.reply?.type === 'action' && toolData?.reply?.url) {
              // Checkout → CTA button with link
              await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                  messaging_product: 'whatsapp',
                  to: convData.customerWhatsAppId,
                  type: 'interactive',
                  interactive: {
                    type: 'cta_url',
                    body: { text: replyContent.slice(0, 1024) },
                    action: { name: 'cta_url', parameters: { display_text: 'Complete Order', url: toolData.reply.url } },
                  },
                }),
              });
            } else {
              await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ messaging_product: 'whatsapp', to: convData.customerWhatsAppId, type: 'text', text: { body: replyContent } }),
              });
            }
          } catch (e) {
            console.error('[BackgroundRetry] WA send failed:', e);
          }
        }
      }

      // ── Send to Instagram ──
      if (convData.channel === 'instagram' && convData.instagramUserId) {
        const token = storeData?.instagram?.accessToken;
        if (token) {
          await fetch(`https://graph.instagram.com/v21.0/me/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ recipient: { id: convData.instagramUserId }, message: { text: replyContent }, messaging_type: 'RESPONSE' }),
          }).catch(e => console.error('[BackgroundRetry] IG send failed:', e));
        }
      }

      console.log(`[BackgroundRetry] ✅ Tool call ${retryToolCall.name} executed for ${conversationId}`);
      return;
    }

    // ─── TEXT-ONLY PATH (original behavior, unchanged) ───────────────
    if (!retryText) return;

    const batch = db.batch();
    batch.set(msgRef.doc(), { role: 'model', content: retryText, type: 'text', isBackgroundRetry: true, createdAt: FieldValue.serverTimestamp() });
    batch.set(inboxRef, { lastMessagePreview: retryText.slice(0, 160), lastMessageAt: FieldValue.serverTimestamp(), unreadForVendor: false }, { merge: true });
    batch.set(convRef, { pendingAiComeback: FieldValue.delete(), lastAssistantMessage: retryText, lastAssistantMessageAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await batch.commit();

    if (convData.channel === 'whatsapp' && convData.customerWhatsAppId) {
      const phoneId = storeData?.whatsapp?.phoneId;
      const token = storeData?.whatsapp?.accessToken;
      if (phoneId && token) {
        await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ messaging_product: 'whatsapp', to: convData.customerWhatsAppId, type: 'text', text: { body: retryText } }),
        }).catch(e => console.error('[BackgroundRetry] WhatsApp send failed:', e));
      }
    }

    if (convData.channel === 'instagram' && convData.instagramUserId) {
      const token = storeData?.instagram?.accessToken;
      if (token) {
        await fetch(`https://graph.instagram.com/v21.0/me/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            recipient: { id: convData.instagramUserId },
            message: { text: retryText },
            messaging_type: 'RESPONSE',
          }),
        }).catch(e => console.error('[BackgroundRetry] Instagram send failed:', e));
      }
    }

    console.log(`[BackgroundRetry] ✅ Delivered answer to ${conversationId}`);
  } catch (err: any) {
    console.error('[BackgroundRetry] Failed:', err?.message || err);
  }
}


async function sendDirectToChannel({
  convData,
  storeData,
  reply,
}: {
  convData: any;
  storeData: any;
  reply: any;
}) {
  try {
    const channel = convData.channel ||
      (convData.customerWhatsAppId ? 'whatsapp' : null) ||
      (convData.instagramUserId ? 'instagram' : null);
 
    if (!channel || (channel !== 'whatsapp' && channel !== 'instagram')) return;
 
    const replyContent = reply?.content || reply?.message;
 
    if (channel === 'whatsapp' && convData.customerWhatsAppId) {
      const phoneId = storeData?.whatsapp?.phoneId;
      const token = storeData?.whatsapp?.accessToken;
      if (!phoneId || !token) return;
 
      const url = `https://graph.facebook.com/v21.0/${phoneId}/messages`;
      const common = { messaging_product: 'whatsapp', to: convData.customerWhatsAppId };
 
      if (reply?.type === 'action' && reply?.action === 'checkout' && reply?.url) {
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            ...common,
            type: 'interactive',
            interactive: {
              type: 'cta_url',
              body: { text: (replyContent || 'Your order is ready!').slice(0, 1024) },
              action: { name: 'cta_url', parameters: { display_text: 'Complete Order', url: reply.url } },
            },
          }),
        });
        console.log(`[DirectSend] ✅ Checkout CTA sent to WA ${convData.customerWhatsAppId}`);
        return;
      }
 
      if (replyContent) {
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ...common, type: 'text', text: { body: replyContent } }),
        });
        console.log(`[DirectSend] ✅ Text sent to WA ${convData.customerWhatsAppId}`);
      }
    }
 
    if (channel === 'instagram' && convData.instagramUserId) {
      const token = storeData?.instagram?.accessToken;
      if (!token) return;
 
      const textToSend = replyContent ||
        (reply?.type === 'action' && reply?.url ? `Your order is ready! Tap here: ${reply.url}` : null);
 
      if (textToSend) {
        await fetch(`https://graph.instagram.com/v21.0/me/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            recipient: { id: convData.instagramUserId },
            message: { text: textToSend },
            messaging_type: 'RESPONSE',
          }),
        });
        console.log(`[DirectSend] ✅ Text sent to IG ${convData.instagramUserId}`);
      }
    }
  } catch (e) {
    console.error('[DirectSend] Failed (non-fatal):', e);
  }
}

function isAddAnotherItemIntent(message: string): boolean {
  const text = String(message || '').toLowerCase().trim();
  return (
    /\b(add|include|put)\b/i.test(text) ||
    /\b(i also want|i want (the|a|an)|abeg add|add .+ too|and the|what about the|i need (the|a|an))\b/i.test(text) ||
    /\badd .+ (to )?(my )?(cart|bag|order)\b/i.test(text)
  ) && !/\b(new order|fresh order|start over|clear|cancel)\b/i.test(text);
}

function isExistingOrderChoice(message: string): boolean {
  const text = String(message || '').toLowerCase().trim();
  return /^(existing|same order|current order|add it|add to existing|existing order|continue|merge|yes|yeah|yep|ok|okay|sure)$/i.test(text);
}

function isNewOrderChoice(message: string): boolean {
  const text = String(message || '').toLowerCase().trim();
  return /^(new|new order|fresh|fresh order|separate|separate order|different|start fresh|start over|no)$/i.test(text);
}
 
function isOrderLookupExitIntent(message: string): boolean {
  const text = String(message || '').toLowerCase().trim();
  return (
    /^(hi|hello|hey|ok|okay|alright|thanks|thank you|no|nope|never mind|forget it)$/i.test(text) ||
    /\b(i want|show me|what do you have|products|catalog|browse|start fresh|new order)\b/i.test(text)
  );
}



export async function POST(request: NextRequest) {
  const startTime = Date.now();
  

  // Basic auth check — only allow requests from our own webhooks/frontend
  const origin = request.headers.get('origin') || request.headers.get('referer') || '';
  const isInternal = origin.includes('sellquic') ||
    origin.includes('localhost') ||
    origin.includes('vercel.app') ||
    !origin;

  if (!isInternal) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let sid: string | undefined;
  let cid: string | undefined;
  let message: string | undefined;
  let sellerId: string | undefined;


try {
    const body = await request.json();

    const {
      message: msg,
      storeId: storeId,
      conversationId: convId,
      clientMessageId,
      imageUrl,
      customerPhone: requestCustomerPhone,
      phone: requestPhone,
      calledByInngest,
    } = body;

    sid = storeId;
    cid = convId;
    message = msg;

    // ── AI GATEKEEPER: SUBSCRIPTION ACCESS CONTROL ─────────────────────────

// Ensure storeId exists
if (!sid) {
  return NextResponse.json({ error: 'Missing storeId' }, { status: 400 });
}

// ── SHARED GATEKEEPER ──
const gate = await checkAiAccess(sid!);

if (!gate.allowed) {
  // For web chat, we show a message. (Webhooks already blocked in Step 1)
  return NextResponse.json({ 
    reply: { 
      type: 'text', 
      content: "I'm currently unavailable to assist. Please contact the store directly. Thank you!" 
    } 
  });
}

const resolvedSellerId = gate.sellerId;

const activeCreditPeriod = await getActiveCreditPeriod(resolvedSellerId!);

if (!activeCreditPeriod) {
  return NextResponse.json({
    reply: {
      type: 'text',
      content: "I'm currently unable to reply because this store has no active AI credits. Please contact the store directly."
    }
  });
}

const remainingCredits = Number(activeCreditPeriod.data.remainingCredits || 0);

if (remainingCredits < CREDITS_PER_RESPONSE) {
  return NextResponse.json({
    reply: {
      type: 'text',
      content: "I'm currently unable to reply because this store has used up its AI credits. Please contact the store directly."
    }
  });
}

// ── ACCESS GRANTED → CONTINUE WITH EXISTING CODE ───────────────────────

    if (!message && !imageUrl) {
      return NextResponse.json({ error: 'Empty message' }, { status: 400 });
    }
    if (message && message.length > 1000) {
      return NextResponse.json({
        reply: { type: 'text', content: "Please keep messages short" }
      });
    }

    if (!sid || !cid) {
      return NextResponse.json({ error: 'Missing storeId or conversationId' }, { status: 400 });
    }

    const storeRef = db.collection('stores').doc(sid);
    
    // ── VERCEL KV REDIS CACHE ENGINE ──────────────────────────────────────────
    const CACHE_KEY = `store_context_v4:${sid}`;
    let storeData: any = null;
    let products: Product[] = [];
    let deliveriesDocs: any[] = [];

    try {
      const cachedContext: any = await kv.get(CACHE_KEY);
      
      if (cachedContext) {
        console.log(`[KV Cache] ⚡ HIT for Store: ${sid}`);
        storeData = cachedContext.storeData;
        products = cachedContext.products;
        
        deliveriesDocs = cachedContext.deliveries.map((d: any) => ({
          id: d.id,
          data: () => d
        }));
      }
    } catch (e) {
      console.warn('[KV Cache] Redis fetch failed, falling back to Firebase:', e);
    }

    if (!storeData) {
      console.log(`[KV Cache] 🐢 MISS for Store: ${sid} - Fetching from Firebase...`);
      const [storeSnap, productsSnap, deliveriesSnap] = await Promise.all([
        storeRef.get(),
        db.collection('products').where('storeId', '==', sid).get(),
        storeRef.collection('deliveries').get()
      ]);

      storeData = storeSnap.data() || {};
      
      products = productsSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Product))
        .filter((p: Product) => 
          p.isArchived !== true && 
          p.status !== 'draft' && 
          p.isOutOfStock !== true
        );

      const rawDeliveries = deliveriesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      deliveriesDocs = deliveriesSnap.docs;

      kv.set(CACHE_KEY, {
        storeData,
        products,
        deliveries: rawDeliveries
      }, { ex: 300 }).catch(e => console.warn('[KV Cache] Failed to save to Redis:', e));
    }
    // ──────────────────────────────────────────────────────────────────────────
    
    const productsById = new Map<string, Product>(products.map((p: Product) => [p.id, p]));
    const refs = {
      convRef: storeRef.collection('ai_conversations').doc(cid),
      msgRef: storeRef.collection('ai_conversations').doc(cid).collection('messages'),
      inboxRef: storeRef.collection('inboxThreads').doc(cid)
    };

    const convSnap = await refs.convRef.get();
    const convData = convSnap.data() || {};

    // ── AI TOGGLE & HANDOVER ENFORCEMENT ──
    const activeChannel = convData.channel || (cid?.startsWith('wa_') ? 'whatsapp' : (convData.instagramUserId ? 'instagram' : 'web'));
    const configChannel = activeChannel === 'webchat' ? 'web' : activeChannel;
    
    const isMasterEnabled = storeData.aiAssistant?.enabled !== false;
    const isChannelEnabled = storeData.aiAssistant?.channels?.[configChannel] !== false;
    
    let isHandoverActive = convData.handoverMode === true;

    // Evaluate Auto-Expire / Re-engage before blocking the AI
    if (isHandoverActive) {
      const handoverAt = convData.handoverAt?.toMillis?.() || 0;
      const handoverAgeHours = (Date.now() - handoverAt) / 1000 / 60 / 60;
      const isReEngageIntent = /\b(hi|hello|hey|good morning|good afternoon|start|new order|order|help)\b/i.test(message || '');
    
      if (handoverAgeHours > 2 || isReEngageIntent) {
        await refs.convRef.set({
          handoverMode: FieldValue.delete(),
          handoverAt: FieldValue.delete(),
          status: 'active',
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        isHandoverActive = false; // Release the lock, let AI handle it!
      }
    }

    // If AI is paused (master off, channel off, or handover active), save message to inbox and stop the AI.
    if (!isMasterEnabled || !isChannelEnabled || isHandoverActive) {
      const userMessageRef = clientMessageId ? refs.msgRef.doc(clientMessageId) : refs.msgRef.doc();
    
      await Promise.all([
        userMessageRef.set({
          role: 'user',
          content: message || '',
          imageUrl: imageUrl || null,
          createdAt: FieldValue.serverTimestamp(),
        }),
        refs.inboxRef.set({
          threadId: cid,
          channel: convData.channel || 'ai_chat',
          lastMessageAt: FieldValue.serverTimestamp(),
          lastMessagePreview: imageUrl ? '📷 Image' : (message || ''),
          unreadForVendor: true,
          status: 'open',
        }, { merge: true }),
        refs.convRef.set({
          storeId: sid,
          sellerId: storeData.sellerId,
          updatedAt: FieldValue.serverTimestamp(),
          messageCount: FieldValue.increment(1),
          lastUserMessage: message || '',
          lastUserMessageAt: FieldValue.serverTimestamp(),
          ...(cid?.startsWith('wa_') ? { channel: 'whatsapp' } : {}),
        }, { merge: true }),
      ]);
    
      if (cid?.startsWith('wa_')) {
        const waPhone = requestCustomerPhone || requestPhone || convData.customerWhatsAppId;
    
        if (waPhone) {
          await refs.convRef.set({
            customerWhatsAppId: waPhone,
            channel: 'whatsapp',
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
        }
      }
    
      // Returning 'silent' tells the Inngest queue to safely drop the message without replying
      return NextResponse.json({ reply: { type: 'silent' } }); 
    }

    const maybeSendDirect = (response: any) => {
      if (calledByInngest) return response;
      if (Date.now() - startTime < 20000) return response;
    
      try {
        const isWaOrIg =
          convData.channel === 'whatsapp' ||
          convData.channel === 'instagram' ||
          cid?.startsWith('wa_') ||
          !!convData.instagramUserId;
    
        if (!isWaOrIg) return response;
    
        const cloned = response.clone();
        waitUntil(
          cloned.json()
            .then((data: any) => {
              if (data?.reply) {
                return sendDirectToChannel({ convData, storeData, reply: data.reply });
              }
            })
            .catch(() => {})
        );
      } catch (_) {}
    
      return response;
    };
    const currentDraft = convData.draftOrder || null;
    const userMessageText = String(message || '').trim();

    // ── SESSION CART GUARD ─────────────────────────────────────────────
// If the last cart activity was more than 24 hours ago, clear it.
// Prevents stale items from previous sessions contaminating new orders.
const lastCartActivity = convData.lastCartUpdatedAt?.toMillis?.() || 
convData.lastCheckoutCreatedAt?.toMillis?.() || 0;
const cartAgeHours = (Date.now() - lastCartActivity) / 1000 / 60 / 60;

if (
Array.isArray(convData.currentCart) && 
convData.currentCart.length > 0 && 
cartAgeHours > 24
) {
await refs.convRef.set({
currentCart: [],
lastCheckoutLink: FieldValue.delete(),
lastCheckoutItems: FieldValue.delete(),
lastCheckoutTotal: FieldValue.delete(),
lastCheckoutCreatedAt: FieldValue.delete(),
lastCheckoutDeliveryId: FieldValue.delete(),
lastActionData: FieldValue.delete(),
pendingCheckout: FieldValue.delete(),
updatedAt: FieldValue.serverTimestamp(),
}, { merge: true });

convData.currentCart = [];
convData.lastCheckoutLink = undefined;
convData.lastActionData = null;
}
    
let forcedContext = "";

    // ── CONVERSATION STATE (typed) ────────────────────────────────────────
    type ConversationState = 'discovery' | 'cart_building' | 'address_collection' | 'checkout_pending' | 'post_purchase';
    const conversationState: ConversationState = (() => {
      if (convData.lastCheckoutLink) return 'checkout_pending';
      if (convData.awaitingStep === 'delivery') return 'address_collection';
      if (Array.isArray(convData.currentCart) && convData.currentCart.length > 0) return 'cart_building';
      if (convData.lastOrderLookupReference || convData.activeFlow === 'order_lookup') return 'post_purchase';
      return 'discovery';
    })();

    // ── METADATA ANNOTATION (enhances Gemini, doesn't replace it) ────────
    const messageMetadata: string[] = [];

    if (/\b(resend|send.*(link|button)|link again|where.*link|can't see|abeg send am|drop am again|send am again)\b/i.test(userMessageText)) {
      messageMetadata.push('CUSTOMER_INTENT: is_requesting_checkout_link = true');
    }

    const phoneInMessage = userMessageText.match(/\b0[0-9]{9}\b/);
    if (phoneInMessage) {
      messageMetadata.push(`EXTRACTED_PHONE: ${phoneInMessage[0]}`);
    }

    const refInMessage = extractOrderReference(userMessageText);
    if (refInMessage) {
      messageMetadata.push(`EXTRACTED_ORDER_REF: ${refInMessage}`);
    }

    const ghanaAddress = userMessageText.match(/\b[A-Z]{2}-\d{3,4}-\d{4}\b/i);
    if (ghanaAddress) {
      messageMetadata.push(`EXTRACTED_DIGITAL_ADDRESS: ${ghanaAddress[0]}`);
    }

    const qtyMatch = userMessageText.match(/^\s*(\d{1,3})\s*$/);
    if (qtyMatch) {
      messageMetadata.push(`EXTRACTED_QUANTITY: ${qtyMatch[1]} — customer confirmed this number as their quantity`);
    }

    const metadataBlock = messageMetadata.length > 0
      ? `\n[MESSAGE METADATA — extracted facts, use directly, do not ask for again]\n${messageMetadata.join('\n')}\n`
      : '';


    // ── POST-CHECKOUT ADD-ITEM INTERCEPTOR ────────────────────────────────────
if (!imageUrl) {
  const hasActiveCheckout =
    !!convData.lastCheckoutLink &&
    Array.isArray(convData.currentCart) &&
    convData.currentCart.length > 0;

  // Step A: customer wants to add something after checkout already exists
  if (
    hasActiveCheckout &&
    convData.awaitingStep !== 'checkout_merge_choice' &&
    isAddAnotherItemIntent(userMessageText)
  ) {
    await refs.convRef.set({
      awaitingStep: 'checkout_merge_choice',
      awaitingSince: FieldValue.serverTimestamp(),
      pendingMergeMessage: userMessageText,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    const content = "Sure please! Would you like me to add that to your existing order, or start a new order?";
    await saveModelResponse(refs, content);
    return NextResponse.json({ reply: { type: 'text', content } });
  }

  // Step B: customer answers the merge choice
  if (convData.awaitingStep === 'checkout_merge_choice') {
    if (isNewOrderChoice(userMessageText)) {
      await refs.convRef.set({
        currentCart: [],
        lastCheckoutLink: FieldValue.delete(),
        lastCheckoutItems: FieldValue.delete(),
        lastCheckoutTotal: FieldValue.delete(),
        lastCheckoutCreatedAt: FieldValue.delete(),
        lastCheckoutDeliveryId: FieldValue.delete(),
        lastActionData: FieldValue.delete(),
        pendingCheckout: FieldValue.delete(),
        pendingMergeMessage: FieldValue.delete(),
        awaitingStep: FieldValue.delete(),
        awaitingSince: FieldValue.delete(),
        orderSessionStatus: 'building_cart',
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      await refs.inboxRef.set({
        lastCheckoutLink: FieldValue.delete(),
        lastCheckoutItems: FieldValue.delete(),
        lastCheckoutTotal: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      const content = "No problem please! I've cleared the old order. What would you like to add?";
      await saveModelResponse(refs, content);
      return NextResponse.json({ reply: { type: 'text', content } });
    }

    if (isExistingOrderChoice(userMessageText)) {
      await refs.convRef.set({
        awaitingStep: FieldValue.delete(),
        awaitingSince: FieldValue.delete(),
        pendingMergeMessage: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      const content = "Perfect please! What would you like to add to your existing order?";
      await saveModelResponse(refs, content);
      return NextResponse.json({ reply: { type: 'text', content } });
    }
  }
}



 // ── HYBRID TIER 2: HIGH-CONFIDENCE ONLY INTERCEPTORS ─────────────────────
// Only fire on unambiguous full-message patterns. Everything else → Gemini.
if (!imageUrl) {

  // 1. Clear cart — destructive, high-confidence full-match only
  if (/^(clear (my )?(bag|cart|order)|empty (my )?(bag|cart)|start (over|fresh)|cancel (my )?order)$/i.test(userMessageText)) {
    await refs.convRef.set({
      currentCart: [],
      lastActionData: null,
      draftOrder: FieldValue.delete(),
      pendingCheckout: FieldValue.delete(),
      confirmedReuseDetails: FieldValue.delete(),
      awaitingStep: FieldValue.delete(),
      awaitingSince: FieldValue.delete(),
      lastCheckoutLink: FieldValue.delete(),
      orderSessionStatus: 'idle',
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    const content = "I've completely cleared your bag please! We are starting fresh What would you like to order?";
    await saveModelResponse(refs, content);
    return NextResponse.json({ reply: { type: 'text', content } });
  }

  // 2. Cart inquiry — high-confidence full-match only (instant answer)
  if (/\b((what('s| is)?\s+in\s+my\s+(bag|cart|order))|(show\s+(me\s+)?(my\s+)?(bag|cart|items))|(show\s+me\s+what\s*(is|'?s)?\s*in\s+my\s+(bag|cart|order))|(what\s+am\s+i\s+(ordering|buying))|(what\s+do\s+i\s+have(\s+there)?)|(what\s+did\s+i\s+order)|(show\s+me\s+my\s+order)|(show\s+me\s+my\s+items))\b/i.test(userMessageText)) {
    const latestConvSnap = await refs.convRef.get();
    const latestConvData = latestConvSnap.data() || convData;
    const cartItems = latestConvData.currentCart || [];

    if (cartItems.length > 0) {
      const itemDescriptions = cartItems.map((item: any) => {
        const p = productsById.get(item.productId);
        const v = p?.variants?.find((vv: any) => vv.id === item.variantId);
        const name = item.nameSnapshot || (v ? `${p?.name} (${v.name})` : p?.name || 'Item');
        return `• ${item.quantity}x ${name}`;
      }).join('\n');
      const content = `Here is what you have in your bag so far please:\n\n${itemDescriptions}\n\nWould you like to checkout, or change something?`;
      await saveModelResponse(refs, content);
      return NextResponse.json({ reply: { type: 'text', content } });
    }

    const content = "Your bag is currently empty please. What would you like to order?";
    await saveModelResponse(refs, content);
    return NextResponse.json({ reply: { type: 'text', content } });
  }

  
}

const sameDetailsIntent = isSameDetailsIntent(userMessageText);
const newAddressIntent = isNewAddressIntent(userMessageText);

// ── SAME / NEW ADDRESS CONFIRMATION INTERCEPTOR ─────────────────────

// never leave this to Gemini.
if (!imageUrl && convData.awaitingStep === 'confirmation') {
  if (sameDetailsIntent) {
    const latestConvSnap = await refs.convRef.get();
    const latestConvData = latestConvSnap.data() || convData;
    const pending = latestConvData.pendingCheckout;

    if (pending?.items?.length) {
      // ← RESUME CHECKOUT IMMEDIATELY: No dropping the customer!
      return await handleToolCall(
        {
          name: 'create_checkout',
          args: {
            items: pending.items,
            customerMessage: pending.customerMessage || '',
            deliveryId: pending.deliveryId || undefined,
            customerName: pending.customerName || latestConvData.customerName || undefined,
            customerPhone: pending.customerPhone || latestConvData.customerPhone || undefined,
            customerAddress: pending.customerAddress || latestConvData.customerAddress || undefined,
          },
        },
        refs,
        productsById,
        message || '',
        storeData,
        cid,
        deliveriesDocs
      );
    }

    

    // Safe fallback if pending items were somehow missing
    await refs.convRef.set({
      confirmedReuseDetails: true,
      awaitingStep: FieldValue.delete(),
      awaitingSince: FieldValue.delete(),
      pendingCheckout: FieldValue.delete(),
      nudgeCount: 0,
      lastNudgeSent: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    const content = "Sorry please, I lost the order details there. Could you tell me the items again and I'll recreate it right away? 😊";
    await saveModelResponse(refs, content);
    return NextResponse.json({ reply: { type: 'text', content } });
  }

  if (newAddressIntent) {
    await refs.convRef.set({
      confirmedReuseDetails: FieldValue.delete(),
      awaitingStep: 'delivery',
      awaitingSince: FieldValue.serverTimestamp(),
      pendingCheckout: convData.pendingCheckout || FieldValue.delete(), // KEEP ORDER ALIVE
      nudgeCount: 0,
      lastNudgeSent: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    const content =
      "No problem please Send me the new delivery area or full address and I'll update it for this order right away.";
    await saveModelResponse(refs, content);
    return NextResponse.json({ reply: { type: 'text', content } });
  }
}

const lastAssistantForIntent = String(convData.lastAssistantMessage || '');

if (
  !imageUrl &&
  isHandoverConfirmationIntent(userMessageText) &&
  lastAssistantAskedForHandover(lastAssistantForIntent)
) {
  await clearAiErrorState(refs.convRef);

  return await handleHandover(
    refs,
    storeData,
    message || '',
    "Customer requested vendor/team assistance after payment/support issue."
  );
}

if (!imageUrl) {
  const text = userMessageText
    .toLowerCase()
    .trim()
    .replace(/[^\w\s']/g, " ")
    .replace(/\s+/g, " ");
 
    const isShortAffirmation =
    /^(yes|yeah|yep|yup|yea|yh|ok|okay|sure|pls|please|alright|go|do it|ready|confirmed)$/.test(text);
  
  const isDirectCheckoutPhrase =
    /\b(check ?out|proceed to checkout|continue to checkout|go to checkout|ready to pay|ready to checkout|complete my order|place my order|finish my order|confirm my order|send me (the )?(checkout|payment) link|create (the )?(checkout|link)|generate (the )?(checkout|link)|resend (the )?(checkout|payment) link)\b/.test(text);
  
  const isGhanaianCheckoutPhrase =
    /\b(oya|abeg|make we do am|make i pay|i wan pay|send am|drop am|carry go|run am)\b/.test(text);
  
    
    
    const isCartQuestion =
    /\b((what('s| is)?\s+in\s+my\s+(bag|cart|order))|(show\s+(me\s+)?(my\s+)?(bag|cart|items))|(show\s+me\s+what\s*(is|'?s)?\s*in\s+my\s+(bag|cart|order))|(what\s+am\s+i\s+(ordering|buying))|(what\s+do\s+i\s+have(\s+there)?)|(what\s+did\s+i\s+order)|(show\s+me\s+my\s+order)|(show\s+me\s+my\s+items))\b/i.test(userMessageText);
  
    const isDeliveryTimeQuestion =
  /\b((when will i receive)|(when do i receive)|(how long (will it take|before it arrives|for delivery))|(delivery time)|(when will it arrive)|(when will i get it))\b/i.test(userMessageText);
  
  const lastAssistant = String(convData.lastAssistantMessage || '').toLowerCase();
  const aiJustAskedCheckout =
    /\b(checkout|check out|payment link|checkout link|complete your order|complete the order|ready to order|would you like to checkout|want to checkout|checkout now|tap the button above to complete your order|tap the button above to complete your checkout)\b/.test(lastAssistant);
  
    const isCheckoutIntent =
    !isCartQuestion &&
    !isDeliveryTimeQuestion &&
    convData.awaitingStep !== 'checkout_merge_choice' &&
    (
      isDirectCheckoutPhrase ||
      isGhanaianCheckoutPhrase
    );

  if (isCheckoutIntent) {
    // Grab fresh cart state
    const latestConvSnap = await refs.convRef.get();
    const latestConvData = latestConvSnap.data() || convData;
    const cart = latestConvData.currentCart || [];
 
    const hasCart = Array.isArray(cart) && cart.length > 0;
    const alreadyHasCheckoutLink = !!latestConvData.lastCheckoutLink;
 
    // If checkout link exists, check if cart has changed since it was created
    if (alreadyHasCheckoutLink && latestConvData.lastCheckoutLink) {
      const lastCheckoutItems = latestConvData.lastCheckoutItems || [];
      const cartChanged = (() => {
        if (cart.length !== lastCheckoutItems.length) return true;
        for (const cartItem of cart) {
          const match = lastCheckoutItems.find((ci: any) =>
            ci.productId === cartItem.productId &&
            (ci.variantId || null) === (cartItem.variantId || null)
          );
          if (!match || match.quantity !== cartItem.quantity) return true;
        }
        return false;
      })();
 
      if (!cartChanged) {
        // Cart matches last checkout — safe to resend
        const total = latestConvData.lastCheckoutTotal;
        const resendText = total
          ? `Perfect please! Here's your checkout link again. Total: GHS ${Number(total).toFixed(2)}`
          : `Perfect please! Here's your checkout link again`;
        const resendReply = {
          type: 'action' as const,
          action: 'checkout' as const,
          label: 'Complete Order',
          url: latestConvData.lastCheckoutLink,
          content: resendText,
          total: total ? Number(total) : null,
          items: latestConvData.lastCheckoutItems ?? [],
        };
        await saveModelResponse(refs, resendText, resendReply);
        await clearAiErrorState(refs.convRef);
        return NextResponse.json({ reply: resendReply });
      }
 
      // Cart changed since last checkout — fall through to create new one
      console.log(`[Checkout Interceptor] Cart changed since last checkout — creating new link`);
    }
 
    // If cart has items → create checkout NOW
    if (hasCart) {
      // If a checkout link already exists, customer is adding to an existing order
      // Ask them first instead of silently creating a new checkout
      if (!!latestConvData.lastCheckoutLink) {
        await refs.convRef.set({
          awaitingStep: 'checkout_merge_choice',
          awaitingSince: FieldValue.serverTimestamp(),
          pendingMergeMessage: userMessageText,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });

        const content = "Sure please! Would you like me to add that to your existing order, or start a new order?";
        await saveModelResponse(refs, content);
        return NextResponse.json({ reply: { type: 'text', content } });
      }

      const checkoutItems = cart.map((item: any) => ({
        productId: item.productId,
        variantId: item.variantId || undefined,
        quantity: item.quantity,
      }));
 
      return await handleToolCall(
        {
          name: 'create_checkout',
          args: {
            items: checkoutItems,
            customerName: latestConvData.customerName || undefined,
            customerPhone: latestConvData.customerPhone || undefined,
            customerAddress: latestConvData.customerAddress || undefined,
            deliveryId: latestConvData.lastCheckoutDeliveryId || latestConvData.pendingCheckout?.deliveryId || undefined,
          },
        },
        refs,
        productsById,
        message || '',
        storeData,
        cid,
        deliveriesDocs
      );
    }
 
    // Cart is empty — fall through to Gemini
  }
}
 

// ── ORDER LOOKUP INTERCEPTOR ─────────────────────────────────────
if (!imageUrl && convData.awaitingStep === 'order_lookup') {
  const ref = extractOrderReference(userMessageText);

  if (ref) {
    return await handleToolCall(
      { name: 'lookup_order', args: { paymentReference: ref } },
      refs,
      productsById,
      message || '',
      storeData,
      cid,
      deliveriesDocs
    );
  }

  // Customer moved on — release the state and fall through to Gemini
  if (isOrderLookupExitIntent(userMessageText)) {
    await refs.convRef.set({
      awaitingStep: FieldValue.delete(),
      awaitingSince: FieldValue.delete(),
      activeFlow: FieldValue.delete(),
      activeFlowStartedAt: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    delete convData.awaitingStep;
    delete convData.activeFlow;
    // fall through to Gemini
  } else {
    const content = "Sure please Please send the order reference code (it looks like BEST-XXXXX) and I'll check it right away.";
    await saveModelResponse(refs, content);
    return NextResponse.json({ reply: { type: 'text', content } });
  }
}

       

                // ── STUCK STATE RECOVERY (stops the "One moment please" loop) ─────
                if (!imageUrl && convData.handoverMode !== true) {
                  const needsRecovery = convData.status === 'needs_review' || !!convData.aiErrorFlag || !!convData.aiErrorContextActive;
                  if (needsRecovery && isRecoveryIntent(userMessageText)) {
                    await clearStuckConversationState(refs.convRef);
                    convData.status = 'active';
                  
                    const rawName = convData.customerName || null;
                    const customerNameForMsg = rawName
                      ? rawName.replace(/(.+)\1+/i, '$1').trim()
                      : null;
                  
                    const recoverMsg = customerNameForMsg
                      ? `Sorry ${customerNameForMsg}, I had a little trouble there. What were you looking to order? I'm still here! 😊`
                      : `Sorry please, I had a little trouble there. What were you looking to order? I'm still here! 😊`;
                  

                      const recoveryUserMessageRef = clientMessageId
                      ? refs.msgRef.doc(clientMessageId)
                      : refs.msgRef.doc();
                    
                    await recoveryUserMessageRef.set({
                      role: 'user',
                      content: message || '',
                      imageUrl: imageUrl || null,
                      createdAt: FieldValue.serverTimestamp(),
                    });
                    
                    await refs.inboxRef.set({
                      threadId: cid,
                      channel: convData.channel || 'ai_chat',
                      lastMessageAt: FieldValue.serverTimestamp(),
                      lastMessagePreview: message || '',
                      unreadForVendor: true,
                      status: 'open',
                    }, { merge: true });

                    await saveModelResponse(refs, recoverMsg);
                  
                    return NextResponse.json({
                      reply: { type: 'text', content: recoverMsg }
                    });
                  }
                }

        const recentNudgeReply = isRecentNudgeReply(convData, userMessageText);

       
        // But do NOT treat a reply to a recent nudge as a fresh new intent.
        if (convData.aiErrorContextActive && message && isClearlyNewIntent(message) && !recentNudgeReply) {
          await clearAiErrorState(refs.convRef);
        }

    const msgCount = Number(convData.messageCount || 0);
    if (msgCount > 500) {   // ← raised from 80 to 180 (much better UX)
      return NextResponse.json({
        reply: { type: 'text', content: "We've reached the chat limit for now Please contact us directly for further help!" }
      });
    }
    

    const userMessageRef = clientMessageId ? refs.msgRef.doc(clientMessageId) : refs.msgRef.doc();
    await Promise.all([
      userMessageRef.set({
        role: 'user',
        content: message || '',
        imageUrl: imageUrl || null,
        createdAt: FieldValue.serverTimestamp()
      }),
      refs.inboxRef.set({
        threadId: cid,
        channel: 'ai_chat',
        lastMessageAt: FieldValue.serverTimestamp(),
        lastMessagePreview: imageUrl ? '📷 Image' : (message || ''),
        unreadForVendor: true,
        status: 'open',
      }, { merge: true }),
      refs.convRef.set({
        storeId: sid,
        sellerId: storeData.sellerId,
        status: 'active',
        updatedAt: FieldValue.serverTimestamp(),
        messageCount: FieldValue.increment(1),
        lastUserMessage: message || '',
        lastUserMessageAt: FieldValue.serverTimestamp(),
        ...(!convSnap.exists && { channel: cid?.startsWith('wa_') ? 'whatsapp' : 'webchat' }),
      }, { merge: true })
    ]);


    if (cid?.startsWith('wa_')) {
      // Priority: webhook's actual WA number > existing > saved customer phone
      // requestCustomerPhone/requestPhone come from the webhook's message.from — always the real WA ID
      const waPhone = requestCustomerPhone || requestPhone || convData.customerWhatsAppId;
    
      if (waPhone) {
        await refs.convRef.set({
          customerWhatsAppId: waPhone,
          channel: 'whatsapp',
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
    
        console.log(`[WA Nudge Setup] ✅ Saved customerWhatsAppId = ${waPhone} for conv ${cid}`);
      }
    }

   


       // ── DRAFT ORDER STATE PERSISTENCE & CART SAFETY NET ─────────────────────
       try {
        const trimmedMsg = String(message || '').trim();
        const isNumericQuantity = /^\s*\d{1,3}\s*$/.test(trimmedMsg);
        const numericQty = isNumericQuantity ? Number(trimmedMsg) : null;
  
        // 1. Persist quantity early so final checkout does not drift
        if (numericQty && numericQty > 0) {
          if (!convData.lastActionData?.action || convData.lastActionData.action !== 'checkout') {
            const lastShown = Array.isArray(convData.lastShownProductIds)
              ? convData.lastShownProductIds
              : [];
  
            await refs.convRef.set({
              draftOrder: {
                ...(currentDraft || {}),
                quantity: numericQty,
                ...(lastShown.length === 1 && !convData.draftOrder?.productId
                  ? { productId: lastShown[0] }
                  : {}),
                updatedAt: FieldValue.serverTimestamp(),
              },
              updatedAt: FieldValue.serverTimestamp(),
            }, { merge: true });
          }
        }

        
      } catch (e) {
        console.warn('[DraftOrder / Safety Net] Persistence failed:', e);
      }

    const lastAction = convData.lastActionData;
    const existingCart = convData.currentCart || [];
    const customerName = convData.customerName || null;
    const customerPhone = convData.customerPhone || null;

const isFreshOrderIntent = /\b(new order|new|separate order|fresh order|different order|another order|start new)\b/i.test(message || '');
const hasExistingCheckout =
  convData?.lastActionData?.action === 'checkout' &&
  Array.isArray(convData?.currentCart) &&
  convData.currentCart.length > 0;

if (isFreshOrderIntent && hasExistingCheckout) {
  await refs.convRef.set({
    currentCart: [],
    lastActionData: null,
    draftOrder: null,
    confirmedReuseDetails: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

let effectiveConvData = convData;
let effectiveLastAction = lastAction;
let effectiveExistingCart = existingCart;

if (isFreshOrderIntent && hasExistingCheckout) {
  effectiveConvData = {
    ...convData,
    currentCart: [],
    lastActionData: null,
    draftOrder: null,
    confirmedReuseDetails: undefined,
  };
  effectiveLastAction = null;
  effectiveExistingCart = [];
}

const confirmsReuseDetails = isSameDetailsIntent(message || '');

    if (confirmsReuseDetails) {
      await refs.convRef.set({
        confirmedReuseDetails: true,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    

    const isAskingForOrderTotal = /^(what'?s|what is|how much is|show me) (my|the) (total|order|bill|summary)$|^(total|bill|summary)$/i.test(message?.trim() || '');

    const effectiveHasExistingCheckout = effectiveLastAction?.action === 'checkout' && Array.isArray(effectiveExistingCart) && effectiveExistingCart.length > 0;

    if (effectiveHasExistingCheckout && isAskingForOrderTotal) {
      const total = effectiveLastAction?.total;
      const content = total
        ? `Your order total is GHS ${Number(total).toFixed(2)} please Tap the button above to complete your order`
        : `Your order is ready please Tap the button above to complete your checkout`;
      await saveModelResponse(refs, content);
      await clearAiErrorState(refs.convRef);
      return NextResponse.json({ reply: { type: 'text', content } });
    }
    
    const isModifyingCart = new RegExp(`\\b(add|more|remove|delete|change|please make it|pls make it|instead|replace|increase|decrease|extra|delivery|zone|area|location|another|different|make it|update|switch|\\d+\\s*(pairs?|items?|pieces?|of them|more))\\b`, 'i').test(message || '') ||
    /^no\s+\d+/i.test((message || '').trim());

    if (!imageUrl) {
      if (effectiveHasExistingCheckout && !isModifyingCart) {
        if (/that'?s all|all good|nothing else|i'?m good/i.test(message || '')) {
          const content = "Perfect please! Tap the button above to complete your order. Good luck!";
          await saveModelResponse(refs, content);
          await clearAiErrorState(refs.convRef);
          return NextResponse.json({ reply: { type: 'text', content } });
        }
      }

      

      if (/other areas|more zones|more delivery|all areas/i.test(message || '')) {
        const allZonesList = deliveriesDocs
          .map((d: any) => `${d.data().label} — GHS ${d.data().fee}`)
          .join('\n');
        const content = `Here are all our delivery areas please \n\n${allZonesList}\n\nWhich is closest to you?`;
        await saveModelResponse(refs, content);
        await clearAiErrorState(refs.convRef);
        return NextResponse.json({ reply: { type: 'text', content } });
      }

     

     
    }


    // ── FAQ SHORT-CIRCUIT ─────────────────────────────────────────────
// Instant answer for known questions — skips Gemini entirely
if (!imageUrl && Array.isArray(storeData.aiAssistant?.faqs) && storeData.aiAssistant.faqs.length > 0) {
  const { default: Fuse } = await import('fuse.js');
  const fuse = new Fuse<{ question: string; answer: string }>(storeData.aiAssistant.faqs, {
    keys: ['question'],
    threshold: 0.35,
    minMatchCharLength: 4,
    ignoreLocation: true,
  });

  const faqResults = fuse.search(userMessageText);
  if (faqResults.length > 0 && faqResults[0].item?.answer?.trim()) {
    const answer = String(faqResults[0].item.answer).trim();
    await saveModelResponse(refs, answer);
    await clearAiErrorState(refs.convRef);
    return NextResponse.json({ reply: { type: 'text', content: answer } });
  }
}
    const activeTools = (effectiveHasExistingCheckout && !isModifyingCart)
      ? tools.map(t => ({
          ...t,
          functionDeclarations: (t as any).functionDeclarations?.filter(
            (f: any) => f.name !== 'create_checkout'
          )
        }))
      : tools;

    const histSnap = await refs.msgRef.orderBy('createdAt', 'desc').limit(30).get();
    let history = histSnap.docs.reverse().map(d => {
      const data = d.data();
      if (data.imageUrl && data.role === 'user') {
        return {
          role: 'user' as const,
          parts: [{ text: (data.content ? data.content + ' ' : '') + '[Customer shared an image]' }]
        };
      }
      const baseText = String(data.content || '');
      const searchContext = data.searchResultIds?.length
        ? ` [Products shown: ${data.searchResultIds.join(', ')}]`
        : '';
      return {
        role: data.role === 'model' ? 'model' as const : 'user' as const,
        parts: [{ text: baseText + searchContext }]
      };
    });
    while (history.length > 0 && history[0].role !== 'user') history.shift();
    
    let memoryContext = "CUSTOMER HISTORY: This is a new customer. Welcome them warmly!";
    if (convData.customerMemory) {
      if (convData.customerMemory !== "NEW_CUSTOMER") {
        memoryContext = `\nCUSTOMER HISTORY: Returning customer. Past orders: ${convData.customerMemory}. Welcome them back!`;
      }
    } else if (convData.instagramUserId) {
      const memoryPromise = fetchAndCacheCustomerMemory(sid, refs.convRef, { igId: convData.instagramUserId });
      waitUntil(memoryPromise);
      const quickCheck = await memoryPromise;
      if (quickCheck && quickCheck !== "NEW_CUSTOMER") {
        memoryContext = `\nCUSTOMER HISTORY: Returning customer. Past orders: ${quickCheck}. Welcome them back!`;
      }
    }

    const storeFacts = `
[STRICT STORE FACTS]
Store Name: ${storeData.name || 'Unknown'}
Support Email: ${storeData.email || 'N/A'}
Phone/WhatsApp: ${storeData.phone || 'N/A'}
`;

    const effectiveCustomerName = effectiveConvData.customerName || null;
    const effectiveCustomerPhone = effectiveConvData.customerPhone || null;

    const stateSummary = `
LIVE CONVERSATION STATE:
- Current Commerce State: ${conversationState.toUpperCase()}
- Awaiting Step: ${effectiveConvData.awaitingStep || 'none'}
- Known customer name: ${effectiveCustomerName || 'unknown'}
- Known customer phone: ${effectiveCustomerPhone || 'unknown'}
- Known customer address: ${effectiveConvData.customerAddress || 'unknown'}
- Current DB Cart items: ${effectiveExistingCart.length > 0 ? effectiveExistingCart.map((i: any) => {
    const p = productsById.get(i.productId);
    const v = p?.variants?.find((vv: any) => vv.id === i.variantId);
    return `[ID: ${i.productId}, Variant: ${i.variantId || 'none'}] - ${i.quantity}x ${i.nameSnapshot || (v ? `${p?.name} (${v.name})` : p?.name || 'Item')}`;
  }).join(' | ') : 'empty'}
${effectiveConvData.pendingCheckout?.items ? `- Pending Checkout Items (DO NOT LOSE THESE): ${JSON.stringify(effectiveConvData.pendingCheckout.items)}` : ''}
- Last shown product IDs: ${Array.isArray(effectiveConvData.lastShownProductIds) && effectiveConvData.lastShownProductIds.length > 0 ? effectiveConvData.lastShownProductIds.join(', ') : 'none'}
- Last catalog search term: ${effectiveConvData.lastSearchTerm || 'none'}
- Last action type: ${effectiveLastAction?.action || 'none'}

- Draft quantity: ${effectiveConvData.draftOrder?.quantity ?? 'unknown'}
- Draft productId: ${effectiveConvData.draftOrder?.productId || 'unknown'}
- Draft variantId: ${effectiveConvData.draftOrder?.variantId || 'unknown'}

CRITICAL DRAFT RULES:
- If Draft quantity is known, never reduce it back to 1 unless the customer explicitly changed it.
- If the customer already confirmed quantity earlier, use that confirmed quantity in create_checkout.

CRITICAL CHECKOUT RESUME RULES:
- If Awaiting Step is "delivery" and the customer provides a new address or zone, IMMEDIATELY call create_checkout using the "Pending Checkout Items" listed above + the new address. Do not ask them for items again.
- When calling 'create_checkout', ALWAYS use the exact items listed in 'Current DB Cart items'. Never invent items. If the cart is empty, ask the user to confirm their item first.

CRITICAL CART RULE:
- The moment the customer has confirmed a product + variant/size + quantity, you MUST call add_to_cart immediately.
- Do this BEFORE asking for delivery, address, or checkout.
- Never rely on memory alone to remember selected items. Use the Cart.
- Use create_checkout only when the customer is actually ready to generate the payment link.
- If the customer says "No [quantity] of [item]" or starts their message with "No" followed by a quantity and item, this is a CORRECTION not a cancellation. Call add_to_cart with the corrected items. NEVER call remove_from_cart for a quantity correction.

CRITICAL STATE RULES:
- If the customer says "my usual name", "my usual number", "same as before", or "you know me" — check Known customer name and Known customer phone above before asking. If they are known, use them directly and confirm: "I have [name] and [phone] — shall I use these?" Never ask for details you already have.
- Never ask for customer name if Known customer name is not unknown.
- Never ask for customer phone if Known customer phone is not unknown.
- Never ask for customer address if Known customer address is not unknown.
- If the customer refers to "same as before", prefer the known customer details above.
- If the customer is clearly referring to a product recently shown, prefer Last shown product IDs instead of inventing a new productId.
- Never claim a product option is unavailable unless that exact product/variant was grounded from the catalog or a tool result.
- If you see [GROUNDED TRUTH] in the prompt, use that information immediately to answer the customer's question naturally and persuasively. Do not be robotic.

CART & ORDER STATE AWARENESS:
- Current cart is always in "Current DB Cart items" above. Use it directly to answer any question about the customer's bag, pending items, or current order.
- "what did I order last time", "same as before", "abeg remind me", "what's pending" → answer from cart state above. NEVER call lookup_order for this.
- Only call lookup_order when customer is asking about a PAST PAID order or wants to track/check status of a completed order.
- If cart is empty, just say so warmly. NEVER explain why or claim you cleared it unless the customer explicitly asked you to in this conversation.
- "show me products", "what do you have", "make i see" → call show_products or search_catalog tool. Do not wait for an interceptor.

POST-CHECKOUT BRIDGE RULE:
- If the customer says "I just placed the order", "I paid", "I just sent payment", "when will I receive it" — and there is a recent checkout in the state — DO NOT immediately call lookup_order.
- First ask: "Is this the order I just sent you the link for? If yes, share the reference code from your confirmation and I'll check the status for you 😊"
- Only call lookup_order once the customer provides a reference code or confirms it is a different order.
- Never demand BEST-XXXXX immediately after a checkout link was just sent in the same conversation.
`;



    

    const bareNumberRegex = /^\s*\d{1,3}\s*$/;
    const enrichedMessage = message && bareNumberRegex.test(message)
      ? `I want ${message.trim()} of them`
      : message;

    let messageParts: any[];
    if (imageUrl) {
      messageParts = [
        ...(enrichedMessage ? [{ text: enrichedMessage }] : [{ text: 'The customer sent an image.' }]),
        { fileData: { mimeType: getMimeType(imageUrl), fileUri: imageUrl } }
      ];
    } else {
      messageParts = [{ text: enrichedMessage || '' }];
    }

// ── MASTER CATALOG GATEWAY (Sentient Version) ───────────────────────
if (!imageUrl) {
  const t = String(userMessageText || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const catalog = products; // already fetched + cached above

  // Match: Does user message contain a real product name?
  const mentionedProduct = catalog.find(p => {
    const pName = String(p.name || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const userQuery = t.replace(/\s+/g, ' ').trim();
    return userQuery.includes(pName) || (userQuery.length > 5 && pName.includes(userQuery));
  });
  
  if (mentionedProduct) {
    console.log(`[Master Gateway] 🎯 Injecting Grounded Truth for "${mentionedProduct.name}".`);
    forcedContext = `
  [GROUNDED TRUTH]: We definitely have the "${mentionedProduct.name}" in stock.
  Price: GHS ${getAiEffectivePrice(mentionedProduct, storeData).toFixed(2)}.
  Stock Level: ${mentionedProduct.stock}.
  ID: ${mentionedProduct.id}.
  RULE: Answer naturally. Do NOT say "Let me check." Speak like a helpful shop assistant.
  `;
  } else {
    // No exact match — use Fuse to proactively ground fuzzy matches
    const { default: FuzeLib } = await import('fuse.js');
    const fuse = new FuzeLib(catalog, {
      keys: ['name', 'description', 'tags', 'category'],
      threshold: 0.4,
      minMatchCharLength: 3,
    });
    const fuzzyMatches = fuse.search(t).slice(0, 5).map((r: any) => r.item);
  
    if (fuzzyMatches.length > 0) {
      forcedContext += buildProactiveGroundingBlock(fuzzyMatches, storeData);
    }
  }
} // ← closes the if (!imageUrl) block for Master Catalog Gateway
    // ─────────────────────────────────────────────────────────────────────

// ── NOW build systemInstruction with the populated forcedContext ──
const systemInstruction = {
  parts: [{
    text:
    buildSystemPrompt(
      storeData,
      products,
      deliveriesDocs,
      effectiveExistingCart,
      effectiveCustomerName,
      effectiveCustomerPhone
    ) +
    '\n' +
    storeFacts +
    '\n' +
    forcedContext +
    '\n' +
    metadataBlock +
    '\n' +
    memoryContext +
    '\n' +
    stateSummary
  }],
  role: 'system',
} as any;

const model = genAI.getGenerativeModel({
  model: 'gemini-3.1-pro-preview',
  systemInstruction,
  tools: activeTools,
} as any);

const chat = model.startChat({
  ...(history.length ? { history } : {}),
} as any);
const remaining = Math.max(2000, AI_TIMEOUT - (Date.now() - startTime));
    

    // ── GEMINI CALL WITH RETRY + FALLBACK ────────────────────────────────
    let result;
    try {
      result = await sendWithRetry(chat, messageParts, remaining, {
        fallbackModel: 'gemini-2.5-flash',
        systemInstruction,
        history,
        activeTools,
      });
    } catch (err) {
      console.error('[Gemini] All retries exhausted:', err);
      await refs.convRef.set({
        pendingAiComeback: {
          resolved: false,
          setAt: FieldValue.serverTimestamp(),
          triggeringMessage: message || '',
          retryAttempts: 0,
          lastRetryAt: null,
          retriedAnswer: null,
        },
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      
      await inngest.send({
        name: 'ai/comeback.retry_requested',
        data: {
          storeId: sid!,
          conversationId: cid!,
          triggeringMessage: message || '',
        },
      });
      
      const name = convData.customerName || null;
      const content = name
        ? `Sorry ${name}, give me just a moment please`
        : "Sorry please, give me just a moment";
      await saveModelResponse(refs, content);
      return NextResponse.json({ reply: { type: 'text', content } });
    }

    // ── EMPTY RESPONSE RECOVERY ──────────────────────────────────────────
    if (!result?.response?.text() && !result?.response?.functionCalls()?.length) {
      await refs.convRef.set({
        pendingAiComeback: {
          resolved: false,
          setAt: FieldValue.serverTimestamp(),
          triggeringMessage: message || '',
          retryAttempts: 0,
          lastRetryAt: null,
          retriedAnswer: null,
        },
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      
      await inngest.send({
        name: 'ai/comeback.retry_requested',
        data: {
          storeId: sid!,
          conversationId: cid!,
          triggeringMessage: message || '',
        },
      });
      
      const content = "Sorry please, give me just a moment";
      await saveModelResponse(refs, content);
      return NextResponse.json({ reply: { type: 'text', content } });
    }
    const call = result.response.functionCalls()?.[0];

        // ── GHOST BUTTON DETECTOR ────────────────────────────────────────────
        const rawText = result.response.text();
        const comebackPhrases =
  /\b(one moment please|let me get back to you|i'll get back to you|get back to you shortly|allow me to clarify|let me clarify|let me check with the team|i'll check with the team|i'm flagging this|i'll flag this|getting the team|let me find out|i'll sort this out shortly|let me show the correct item|let me find the correct item|let me check that for you|let me look that up|bear with me|give me a moment|just a moment please|kindly bear with|please bear with)\b/i;
  if (comebackPhrases.test(rawText)) {
  await refs.convRef.set({
    pendingAiComeback: {
      resolved: false,
      setAt: FieldValue.serverTimestamp(),
      triggeringMessage: message || '',
      retryAttempts: 0,
      lastRetryAt: null,
      retriedAnswer: null,
    },
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  await inngest.send({
    name: 'ai/comeback.retry_requested',
    data: {
      storeId: sid!,
      conversationId: cid!,
      triggeringMessage: message || '',
    },
  });
}
if (!call && /\b(i've created (your order|the order|your checkout)|i've just created your checkout|i've updated your order and here|order placed successfully|i've added|added .* to your bag|added .* to your cart|added .* to your order|added it to your bag)\b/i.test(rawText)) {
  console.warn('[Ghost Button] AI claimed tool execution (checkout or cart add) without tool call — firing retry');
  await refs.convRef.set({
    pendingAiComeback: {
      resolved: false,
      setAt: FieldValue.serverTimestamp(),
      triggeringMessage: message || '',
      retryAttempts: 0,
      lastRetryAt: null,
      retriedAnswer: null,
    },
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  await inngest.send({
    name: 'ai/comeback.retry_requested',
    data: {
      storeId: sid!,
      conversationId: cid!,
      triggeringMessage: message || '',
    },
  });

  const content = "One moment please, just sorting that out for you";
  await saveModelResponse(refs, content);
  await clearAiErrorState(refs.convRef);
  return NextResponse.json({ reply: { type: 'text', content } });
}

    if (call) {
      let toolResponse;
      try {
        toolResponse = await handleToolCall(call, refs, productsById, message || '', storeData, cid, deliveriesDocs);
      } catch (err) {
        console.error(`[Tool ${call.name}] crashed:`, err);
        const name = convData.customerName || null;
      
        // Track consecutive tool failures
        const currentErrorCount = Number(convData.aiErrorCount || 0) + 1;
      
        await refs.convRef.set({
          aiErrorFlag: true,
          aiErrorContextActive: true,
          aiErrorCount: currentErrorCount,
          lastAiError: String((err as any)?.message || err || 'Tool failure').slice(0, 300),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      
        // After 2 consecutive failures on the same conversation — notify vendor
        // and reassure customer rather than leaving them hanging
        if (currentErrorCount >= 2) {
          const content = name
            ? `Sorry ${name}, I'm having a little technical issue right now 🙏 I've already notified our team and they'll be with you shortly. You're not waiting alone!`
            : `Sorry please, I'm having a little technical issue right now 🙏 I've already notified our team and they'll be with you shortly. You're not waiting alone!`;
      
          await saveModelResponse(refs, content);
      
          // Silently notify vendor without making it a full handover
          try {
            if (storeData?.sellerId) {
              const { sendSms } = await import('@/lib/mnotify');
              const { formatPhoneNumberForApi } = await import('@/lib/utils');
              const sellerSnap = await db.collection('users').doc(storeData.sellerId).get();
              const sellerPhone = sellerSnap.data()?.phone;
              if (sellerPhone) {
                const formatted = formatPhoneNumberForApi(sellerPhone);
                if (formatted) {
                  await sendSms(
                    formatted,
                    `SellQuic Alert: AI tool failure (${call.name}) for a customer on "${storeData.name}". Customer may need help: https://sellquic.com/dashboard/inbox/${cid}`
                  ).catch(() => {});
                }
              }
            }
          } catch (_) {}
      
          return NextResponse.json({ reply: { type: 'text', content } });
        }
      
        // First failure — warm recovery, ask them to try again
        const content = name
          ? `Sorry ${name}, I had a little hiccup there Could you say that again please?`
          : `Sorry please, I had a little hiccup Could you say that again?`;
        await saveModelResponse(refs, content);
        return NextResponse.json({ reply: { type: 'text', content } });
      }

      if (!toolResponse) {
        const content = "Sorry please, something went wrong on my end Let's try that again!";
        await saveModelResponse(refs, content);
        return NextResponse.json({ reply: { type: 'text', content } });
      }

      const toolData = await toolResponse.clone().json();

      // Silent save — re-run AI for natural follow-up safely
      if (toolData.reply?.type === 'save_info_done') {
        
        const followUp = await sendWithRetry(
          chat, 
          [{ text: '[info saved, continue naturally]' }], 
          remaining, 
          { fallbackModel: 'gemini-2.5-flash', systemInstruction, history, activeTools }
        );
        
        const followRaw = followUp.response.text();
        
        await clearAiErrorState(refs.convRef);
        return maybeSendDirect(await validateLLMOutput({
            rawText: followRaw,
            refs,
            storeData,
            conversationId: cid,
            products,
            deliveries: deliveriesDocs.map((d: any) => ({
              id: d.id,
              label: d.data().label,
              fee: Number(d.data().fee || 0),
              type: d.data().type,
            })),
            convData: (await refs.convRef.get()).data() || convData,
            userMsg: message || '',
        }));
      }

      await clearAiErrorState(refs.convRef);
      await deductAiCredits(resolvedSellerId!, CREDITS_PER_RESPONSE);
      return maybeSendDirect(toolResponse);
    }

    if (rawText.includes('[HANDOVER]')) {
      if (isRealHandoverScenario(message || '')) {
        return await handleHandover(refs, 'AI Handover', storeData, cid);
      }
    
      const cleaned = rawText.replace(/\[HANDOVER\]/gi, '').trim();
      const fallback = cleaned || "Let me sort that out with you please";
    
      await clearAiErrorState(refs.convRef);
      await deductAiCredits(resolvedSellerId!, CREDITS_PER_RESPONSE);
      return maybeSendDirect(await validateLLMOutput({
        rawText: fallback,
        refs,
        storeData,
        conversationId: cid,
        products,
        deliveries: deliveriesDocs.map((d: any) => ({
          id: d.id,
          label: d.data().label,
          fee: Number(d.data().fee || 0),
          type: d.data().type,
        })),
        convData: effectiveConvData,
        userMsg: message || '',
      }));
    }

    await clearAiErrorState(refs.convRef);
    await deductAiCredits(resolvedSellerId!, CREDITS_PER_RESPONSE);
    return maybeSendDirect(await validateLLMOutput({
      rawText,
      refs,
      storeData,
      conversationId: cid,
      products,
      deliveries: deliveriesDocs.map((d: any) => ({
        id: d.id,
        label: d.data().label,
        fee: Number(d.data().fee || 0),
        type: d.data().type,
      })),
      convData: effectiveConvData,
      userMsg: message || '',
    }));

  } catch (err: any) {
    console.error('Chat Error:', err);

    try {
      if (sid && cid) {
        const storeRef = db.collection('stores').doc(sid);
        const refs = {
          convRef: storeRef.collection('ai_conversations').doc(cid),
          msgRef: storeRef.collection('ai_conversations').doc(cid).collection('messages'),
          inboxRef: storeRef.collection('inboxThreads').doc(cid)
        };

        const convSnap = await refs.convRef.get();
        const convData = convSnap.data() || {};

        const rawName = convData.customerName || null;
        const customerNameForMsg = rawName
          ? rawName.replace(/(.+)\1+/i, '$1').trim()
          : null;

        let recoverMsg = "I'm back please What can I help you with?";

        if (convData.currentCart?.length > 0) {
          recoverMsg = customerNameForMsg
            ? `Sorry about that ${customerNameForMsg}, I had a little network blip! Shall we continue?`
            : `Sorry about that please, I had a little network blip! Shall we continue?`;
        } else if (convData.lastCheckoutLink) {
          recoverMsg = customerNameForMsg
            ? `Sorry about that ${customerNameForMsg}, I had a little network blip! Would you like to continue with it, add more items, or clear it and start fresh? 😊`
            : `Sorry about that please, I had a little network blip! Would you like to continue with it, add more items, or clear it and start fresh? 😊`;
        } else {
          recoverMsg = customerNameForMsg
            ? `Sorry ${customerNameForMsg}, I had a little trouble there. What were you looking to order? I'm still here!`
            : `Sorry please, I had a little trouble there. What were you looking to order? I'm still here!`;
        }

        await saveModelResponse(refs, recoverMsg);
        return NextResponse.json({ reply: { type: 'text', content: recoverMsg } });
      }
    } catch (fallbackErr) {
      console.error('[Chat API] Even fallback message failed:', fallbackErr);
    }

    try {
      await db.collection('ai_errors').add({
        storeId: sid || 'unknown',
        conversationId: cid || 'unknown',
        error: String(err?.message || err),
        messagePreview: String(message || '').slice(0, 200) || null,
        timestamp: FieldValue.serverTimestamp(),
      });
    } catch (_) {}

    return NextResponse.json({ error: 'Retry requested' }, { status: 500 });
  }
}

  