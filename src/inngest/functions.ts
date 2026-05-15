import { Inngest } from "inngest";
import { sendWhatsAppResponse, buildInstagramPayloads, sendInstagramMessages } from "@/ai/utils/channelSend";
import { db } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { genAI } from "@/ai/genkit";
import { buildSystemPrompt } from "@/ai/prompts/systemPrompt";
import { tools } from "@/ai/tools";
import { handleToolCall } from "@/ai/handlers";

export const inngest = new Inngest({ id: "sellquic-ai" });

type Channel = "whatsapp" | "instagram";

type BufferedInboundEvent = {
  storeId: string;
  conversationId: string;
  channel: Channel;
  customerPhone?: string;
  version: number;
  messageId?: string;
};

type ComebackRetryEvent = {
  storeId: string;
  conversationId: string;
  triggeringMessage: string;
};

export const whatsappAgent = inngest.createFunction(
  {
    id: "whatsapp-ig-agent",
    retries: 2,
    triggers: [{ event: "ai/message.received" }],
  },
  async ({ event, step }: { event: any; step: any }) => {
    const functionStartTime = Date.now();
    const {
      storeId,
      conversationId,
      channel,
      customerPhone,
      version,
      messageId,
    } = event.data as BufferedInboundEvent;

    

// 1) Debounce bursty message bubbles
if (channel !== "whatsapp" && channel !== "instagram") {
  return { success: true, action: "unsupported_channel" };
}

await step.sleep("debounce-burst", "400ms");

    // 2) Claim only the latest buffered version for this conversation
    const claimed = await step.run("claim-latest-buffer", async () => {
      const convRef = db
        .collection("stores")
        .doc(storeId)
        .collection("ai_conversations")
        .doc(conversationId);

      return await db.runTransaction(async (tx) => {
        const snap = await tx.get(convRef);
        const data = snap.data() || {};

        const latestVersion = Number(data.pendingInboundVersion || 0);
        const pendingText = String(data.pendingInboundText || "").trim();
        const pendingImageUrl = data.pendingInboundImageUrl || null;

        // If a newer message arrived after this event was queued, abort this run.
        if (latestVersion !== Number(version)) {
          return { proceed: false, reason: "stale_version" as const };
        }

        if (!pendingText && !pendingImageUrl) {
          return { proceed: false, reason: "empty_buffer" as const };
        }

        tx.set(
          convRef,
          {
            processingVersion: latestVersion,
            pendingInboundText: FieldValue.delete(),
            pendingInboundImageUrl: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        return {
          proceed: true as const,
          latestVersion,
          message: pendingText,
          imageUrl: pendingImageUrl as string | null,
        };
      });
    });

    if (!claimed.proceed) {
      return { success: true, action: claimed.reason };
    }

   

    // 3) Call the existing AI route with the merged thought
    const aiResult = await step.run("call-ai-chat", async () => {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sellquic.com";

      // Per-store routing: stores with aiV2.channels.{channel} = true go to V2
      const storeSnap = await db.collection("stores").doc(storeId).get();
      const storeData = storeSnap.data() || {};
      const useV2 =
        storeData?.aiV2?.enabled === true &&
        storeData?.aiV2?.channels?.[channel] === true;
      const aiPath = useV2 ? "/api/ai-v2/chat" : "/api/ai/chat";

      const response = await fetch(`${baseUrl}${aiPath}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: claimed.message,
          storeId,
          conversationId,
          imageUrl: claimed.imageUrl,
          customerPhone,
          phone: customerPhone,
          calledByInngest: true,
        }),
        signal: AbortSignal.timeout(120000),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        throw new Error(`AI chat returned ${response.status}: ${errorText}`);
      }

      return await response.json();
    });

    if (!aiResult?.reply || aiResult.reply.type === "silent" || aiResult.reply.type === "handover_active") {
      return { success: true, action: "no_reply_needed" };
    }

    // 4) Load sending context
    const sendContext = await step.run("load-send-context", async () => {
      const storeSnap = await db.collection("stores").doc(storeId).get();
      const storeData = storeSnap.data() || {};

      const convSnap = await db
        .collection("stores")
        .doc(storeId)
        .collection("ai_conversations")
        .doc(conversationId)
        .get();
      const convData = convSnap.data() || {};

      return {
        whatsapp: storeData.whatsapp || {},
        instagram: storeData.instagram || {},
        customerWhatsAppId: convData.customerWhatsAppId || customerPhone || null,
        instagramUserId: convData.instagramUserId || null,
      };
    });

    const freshness = await step.run("freshness-before-send", async () => {
      const convSnap = await db
        .collection("stores")
        .doc(storeId)
        .collection("ai_conversations")
        .doc(conversationId)
        .get();

      const convData = convSnap.data() || {};
      const latestBufferedVersion = Number(convData.pendingInboundVersion || 0);
      const runAgeMs = Date.now() - functionStartTime;

      return {
        stillFresh:
          latestBufferedVersion <= Number(claimed.latestVersion || 0) &&
          runAgeMs < 180_000,
      };
    });

    if (!freshness.stillFresh) {
      return { success: true, action: "newer_message_arrived_skip_send" };
    }



    // 6) Send reply
    await step.run("send-reply", async () => {
      const reply = aiResult.reply;
    
      if (channel === "whatsapp") {
        const { phoneId, accessToken } = sendContext.whatsapp;
        const to = sendContext.customerWhatsAppId;
    
        if (!phoneId || !accessToken || !to) return;
    
        await sendWhatsAppResponse(to, phoneId, reply, accessToken, "https://sellquic.com");
        console.log(`[Inngest] ✅ WA reply sent to ${to} for ${conversationId}`);
        return;
      }
    
      if (channel === "instagram") {
        const { accessToken, accountId } = sendContext.instagram;
        const to = sendContext.instagramUserId;
    
        if (!accessToken || !accountId || !to) return;
    
        const payloads = buildInstagramPayloads(reply, "https://sellquic.com");
        if (payloads.length > 0) {
          await sendInstagramMessages(accountId, to, payloads, accessToken);
          console.log(`[Inngest] ✅ IG reply sent to ${to} for ${conversationId}`);
        }
        return;
      }
    });

    return {
      success: true,
      conversationId,
      channel,
      processedVersion: claimed.latestVersion,
    };
  }
);

export const comebackRetryAgent = inngest.createFunction(
  {
    id: "ai-comeback-retry",
    retries: 2,
    triggers: [{ event: "ai/comeback.retry_requested" }],
  },
  async ({ event, step }: { event: any; step: any }) => {
    const { storeId, conversationId, triggeringMessage } = event.data as ComebackRetryEvent;

    await step.sleep("wait-before-retry", "6s");

    const context = await step.run("load-context", async () => {
      const storeRef = db.collection("stores").doc(storeId);
      const convRef = storeRef.collection("ai_conversations").doc(conversationId);

      const [storeSnap, convSnap, productsSnap, deliveriesSnap] = await Promise.all([
        storeRef.get(),
        convRef.get(),
        db.collection("products").where("storeId", "==", storeId).get(),
        storeRef.collection("deliveries").get(),
      ]);

      const storeData = storeSnap.data() || {};
      const convData = convSnap.data() || {};

      return {
        storeData,
        convData,
        products: productsSnap.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((p: any) => !p.isArchived && !p.archivedAt && p.isOutOfStock !== true),
        deliveries: deliveriesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        hasPendingComeback: !!convData.pendingAiComeback,
        comebackSetAt: convData.pendingAiComeback?.setAt?.toMillis?.() || 0,
        lastUserMessageAt: convData.lastUserMessageAt?.toMillis?.() || 0,
        customerWhatsAppId: convData.customerWhatsAppId || null,
        instagramUserId: convData.instagramUserId || null,
      };
    });

    if (!context.hasPendingComeback) {
      return { success: true, action: "no_pending_comeback" };
    }

    // If the customer already sent a new message after the comeback was queued, abort.
    if (context.lastUserMessageAt > context.comebackSetAt) {
      await step.run("clear-stale-comeback", async () => {
        await db
          .collection("stores")
          .doc(storeId)
          .collection("ai_conversations")
          .doc(conversationId)
          .set(
            {
              pendingAiComeback: FieldValue.delete(),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
      });

      return { success: true, action: "user_already_replied" };
    }

    const aiResult = await step.run("retry-ai", async () => {
      const storeRef = db.collection("stores").doc(storeId);
      const convRef = storeRef.collection("ai_conversations").doc(conversationId);
      const msgRef = convRef.collection("messages");

      const histSnap = await msgRef.orderBy("createdAt", "desc").limit(20).get();

      let history = histSnap.docs.reverse().map((d: any) => {
        const data = d.data();
        return {
          role: data.role === "model" ? "model" : "user",
          parts: [{ text: String(data.content || "") }],
        };
      });

      while (history.length > 0 && history[0].role !== "user") history.shift();

      const systemInstruction = {
        parts: [
          {
            text: buildSystemPrompt(
              context.storeData,
              context.products,
              context.deliveries.map((d: any) => ({ id: d.id, data: () => d })),
              context.convData.currentCart || [],
              context.convData.customerName || null,
              context.convData.customerPhone || null
            ),
          },
        ],
        role: "system",
      } as any;

      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction,
        tools,
      } as any);

      const chat = model.startChat({ history } as any);

      const retryPrompt =
        `[SYSTEM RETRY: Your previous response stalled. The customer is still waiting. ` +
        `Answer the original message now with a real response. Use tools if needed. ` +
        `Do not stall again. Original message was: "${triggeringMessage}"]`;

      const result = (await Promise.race([
        chat.sendMessage([{ text: retryPrompt }]),
        new Promise((_, rej) => setTimeout(() => rej(new Error("TIMEOUT")), 15000)),
      ])) as any;

      return {
        retryText: result?.response?.text()?.trim() || "",
        retryToolCall: result?.response?.functionCalls?.()?.[0] || null,
      };
    });

    // Freshness check again after retry
    const freshCheck = await step.run("freshness-check", async () => {
      const convSnap = await db
        .collection("stores")
        .doc(storeId)
        .collection("ai_conversations")
        .doc(conversationId)
        .get();

      const freshData = convSnap.data() || {};
      return {
        freshLastUserAt: freshData.lastUserMessageAt?.toMillis?.() || 0,
      };
    });

    if (freshCheck.freshLastUserAt > context.comebackSetAt) {
      await step.run("clear-stale-after-retry", async () => {
        await db
          .collection("stores")
          .doc(storeId)
          .collection("ai_conversations")
          .doc(conversationId)
          .set(
            {
              pendingAiComeback: FieldValue.delete(),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
      });

      return { success: true, action: "user_replied_during_retry" };
    }

    const sendResult = await step.run("resolve-and-send", async () => {
      const storeRef = db.collection("stores").doc(storeId);
      const convRef = storeRef.collection("ai_conversations").doc(conversationId);
      const msgRef = convRef.collection("messages");
      const inboxRef = storeRef.collection("inboxThreads").doc(conversationId);

      const refs = { convRef, msgRef, inboxRef };
      const productsById = new Map<string, any>(
        context.products.map((p: any) => [String(p.id), p])
      );

      if (aiResult.retryToolCall) {
        const toolResponse = await handleToolCall(
          aiResult.retryToolCall,
          refs as any,
          productsById,
          triggeringMessage,
          context.storeData,
          conversationId,
          context.deliveries.map((d: any) => ({
            id: d.id,
            data: () => d,
          })) as any
        );

        const toolData = await toolResponse.clone().json().catch(() => null);
        const reply = toolData?.reply;

        if (!reply) {
          return { delivered: false, reason: "tool_no_reply" };
        }

        if (context.convData.channel === "whatsapp" && context.customerWhatsAppId) {
          const { phoneId, accessToken } = context.storeData.whatsapp || {};
          if (phoneId && accessToken) {
            await sendWhatsAppResponse(
              context.customerWhatsAppId,
              phoneId,
              reply,
              accessToken,
              "https://sellquic.com"
            );
          }
        }

        if (context.convData.channel === "instagram" && context.instagramUserId) {
          const { accessToken, accountId } = context.storeData.instagram || {};
          if (accessToken && context.instagramUserId) {
            const payloads = buildInstagramPayloads(reply, "https://sellquic.com");
            if (payloads.length > 0) {
              await sendInstagramMessages(accountId, context.instagramUserId, payloads, accessToken);
            }
          }
        }

        await convRef.set(
          {
            pendingAiComeback: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        return { delivered: true, mode: "tool" };
      }

      if (aiResult.retryText) {
        await msgRef.add({
          role: "model",
          content: aiResult.retryText,
          type: "text",
          isBackgroundRetry: true,
          createdAt: FieldValue.serverTimestamp(),
        });

        await inboxRef.set(
          {
            lastMessagePreview: aiResult.retryText.slice(0, 160),
            lastMessageAt: FieldValue.serverTimestamp(),
            unreadForVendor: false,
          },
          { merge: true }
        );

        await convRef.set(
          {
            pendingAiComeback: FieldValue.delete(),
            lastAssistantMessage: aiResult.retryText,
            lastAssistantMessageAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        if (context.convData.channel === "whatsapp" && context.customerWhatsAppId) {
          const { phoneId, accessToken } = context.storeData.whatsapp || {};
          if (phoneId && accessToken) {
            await sendWhatsAppResponse(
              context.customerWhatsAppId,
              phoneId,
              { type: "text", content: aiResult.retryText },
              accessToken,
              "https://sellquic.com"
            );
          }
        }

        if (context.convData.channel === "instagram" && context.instagramUserId) {
          const { accessToken, accountId } = context.storeData.instagram || {};
          if (accessToken && context.instagramUserId) {
            const payloads = buildInstagramPayloads(
              { type: "text", content: aiResult.retryText },
              "https://sellquic.com"
            );
            if (payloads.length > 0) {
              await sendInstagramMessages(accountId, context.instagramUserId, payloads, accessToken);
            }
          }
        }

        return { delivered: true, mode: "text" };
      }

      return { delivered: false, reason: "empty_retry" };
    });

    return { success: true, ...sendResult };
  }
);