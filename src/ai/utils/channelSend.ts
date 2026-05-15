import { db } from '@/lib/firebase-admin';

function formatForWhatsApp(text: string): string {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '*$1*')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$2')
    .trim();
}

async function sendWhatsAppResponse(to: string, phoneId: string, reply: any, token: string, baseUrl: string) {
  const url = `https://graph.facebook.com/v21.0/${phoneId}/messages`;
  const common = { messaging_product: "whatsapp", to: to };

  const postToWA = async (body: any) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    let data: any = null;
    try { data = await res.json(); } catch {}
    if (!res.ok) {
      console.error('[WA] Send Error:', JSON.stringify(data));
      if (data?.error?.code === 190) {
        const expiredStore = await db.collection('stores').where('whatsapp.phoneId', '==', phoneId).limit(1).get();
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

  if (reply.type === 'text' || !reply.type) {
    const content = (reply.content || reply.message || 'How can I help you?').replace(/<!--QR:\[.*?\]-->/g, '');
    await postToWA({ ...common, type: "text", text: { body: formatForWhatsApp(content) } });
  } else if (reply.type === 'product_cards') {
    if (reply.content) {
      await postToWA({ ...common, type: "text", text: { body: formatForWhatsApp(reply.content) } });
      await wait(500);
    }
    const products = reply.products || [];
    for (const p of products.slice(0, 6)) {
      const priceStr = p.variants?.length > 0 
        ? `GHS ${Math.min(...p.variants.map((v: any) => Number(v.price)))}` 
        : `GHS ${p.price}`;
      const caption = `*${p.name}*\n💰 ${priceStr}\n\n${p.description || ''}`.trim();
      await postToWA({
        ...common,
        type: "image",
        image: { link: p.imageUrl || 'https://images.unsplash.com/photo-1560393464-5c69a73c5770?w=400', caption: formatForWhatsApp(caption) }
      });
      await wait(600);
    }
  } else if (reply.type === 'action' && reply.action === 'checkout') {
    const checkoutUrl = reply.url.startsWith('http') ? reply.url : `${baseUrl}${reply.url}`;
    const itemSummary = (reply.items || []).map((i: any) => `• ${i.name} x${i.quantity}`).join('\n');
    const bodyText = formatForWhatsApp(
      reply.content?.includes('GHS') ? reply.content : `${reply.content || 'Your order is ready! 😊'}\n\n${itemSummary}\n\n💰 Total: GHS ${reply.total}`
    );
    try {
      await postToWA({
        ...common,
        type: "interactive",
        interactive: {
          type: "cta_url",
          body: { text: bodyText.slice(0, 1024) },
          action: { name: "cta_url", parameters: { display_text: "Complete Order", url: checkoutUrl } },
        },
      });
    } catch {
      const fallbackText = `${bodyText}\n\nComplete your order here: ${checkoutUrl}`;
      await postToWA({ ...common, type: "text", text: { body: fallbackText } });
    }
  }
}

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
      const itemLines = (reply.items || []).map((i: any) => `• ${i.name} x${i.quantity} — GHS ${Number(i.lineTotal ?? i.price * i.quantity).toFixed(2)}`).join('\n');
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
          const price = p.variants?.length > 0 ? `from GHS ${Math.min(...p.variants.map((v: any) => Number(v.price))).toFixed(2)}` : `GHS ${Number(p.price).toFixed(2)}`;
          return { title: String(p.name).substring(0, 80), subtitle: price, image_url: p.imageUrl || 'https://placehold.co/400x400' };
        });
        const templatePayload: any = { attachment: { type: 'template', payload: { template_type: 'generic', elements } } };
        if (igQuickReplies) templatePayload.quick_replies = igQuickReplies;
        payloads.push(templatePayload);
      }
      return payloads;
    }
    default: {
      if (!reply.content && !reply.message) return [];
      const payload: any = { text: reply.content || reply.message };
      if (igQuickReplies) payload.quick_replies = igQuickReplies;
      return [payload];
    }
  }
}

async function sendInstagramMessages(igAccountId: string, recipientId: string, payloads: any[], accessToken: string): Promise<void> {
  for (const payload of payloads) {
    const res = await fetch(`https://graph.instagram.com/v21.0/me/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ recipient: { id: recipientId }, message: payload, messaging_type: 'RESPONSE' }),
    });
    if (!res.ok) {
      const err = await res.json();
      console.error('[IG] Send error:', JSON.stringify(err));
      if (err.error?.code === 190 || err.error?.error_subcode === 463) {
        const expiredStore = await db.collection('stores').where('instagram.accountId', '==', igAccountId).limit(1).get();
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

async function sendDirectToChannel({ convData, storeData, reply }: { convData: any; storeData: any; reply: any }) {
  try {
    const channel = convData.channel || (convData.customerWhatsAppId ? 'whatsapp' : null) || (convData.instagramUserId ? 'instagram' : null);
    if (!channel || (channel !== 'whatsapp' && channel !== 'instagram')) return;
    const replyContent = reply?.content || reply?.message;
    if (channel === 'whatsapp' && convData.customerWhatsAppId) {
      const phoneId = storeData?.whatsapp?.phoneId;
      const token = storeData?.whatsapp?.accessToken;
      if (!phoneId || !token) return;
      const url = `https://graph.facebook.com/v21.0/${phoneId}/messages`;
      const common = { messaging_product: 'whatsapp', to: convData.customerWhatsAppId };
      if (reply?.type === 'action' && reply?.action === 'checkout' && reply?.url) {
        await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ ...common, type: 'interactive', interactive: { type: 'cta_url', body: { text: (replyContent || 'Your order is ready!').slice(0, 1024) }, action: { name: 'cta_url', parameters: { display_text: 'Complete Order', url: reply.url } } } }) });
        return;
      }
      if (replyContent) {
        await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ ...common, type: 'text', text: { body: replyContent } }) });
      }
    }
    if (channel === 'instagram' && convData.instagramUserId) {
      const token = storeData?.instagram?.accessToken;
      if (!token) return;
      const textToSend = replyContent || (reply?.type === 'action' && reply?.url ? `Your order is ready! Tap here: ${reply.url}` : null);
      if (textToSend) {
        await fetch(`https://graph.instagram.com/v21.0/me/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ recipient: { id: convData.instagramUserId }, message: { text: textToSend }, messaging_type: 'RESPONSE' }) });
      }
    }
  } catch (e) {
    console.error('[DirectSend] Failed (non-fatal):', e);
  }
}

export { formatForWhatsApp, sendWhatsAppResponse, buildInstagramPayloads, sendInstagramMessages, sendDirectToChannel };