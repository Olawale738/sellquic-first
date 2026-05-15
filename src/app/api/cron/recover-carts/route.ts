
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  // 1. Security Check (Only allow Vercel Cron to trigger this)
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const now = Date.now();
    const twoHoursAgo = new Date(now - (2 * 60 * 60 * 1000));
    const fourHoursAgo = new Date(now - (4 * 60 * 60 * 1000));

    // 2. Find orders that are stuck in "awaiting-payment" 
    // placed between 2 and 4 hours ago (to avoid nudging too late)
    const pendingOrders = await db.collection('orders')
      .where('status', '==', 'awaiting-payment')
      .where('createdAt', '<=', twoHoursAgo)
      .where('createdAt', '>=', fourHoursAgo)
      .limit(50) // Process in small batches to avoid timeouts
      .get();

    console.log(`[Cron] Found ${pendingOrders.size} abandoned carts to nudge.`);

    const results = [];

    for (const orderDoc of pendingOrders.docs) {
      const order = orderDoc.data();
      const storeId = order.storeId;
      
      // Don't nudge if we've already nudged this order
      if (order.nudgeSent) continue;

      // 3. Get Store & Channel Info
      const storeSnap = await db.collection('stores').doc(storeId).get();
      const storeData = storeSnap.data();
      if (!storeData) continue;

      const customerPhone = order.customerInfo?.phone;
      const checkoutUrl = `${process.env.NEXT_PUBLIC_APP_URL}/checkout/${orderDoc.id}`;
      const itemsPreview = order.items?.[0]?.productName || "your items";

      // 4. Send the Nudge based on the channel
      // (This logic calls the same Meta API logic we used in our webhooks)
      try {
        let nudgeMessage = `Hi ${order.customerInfo?.name || 'there'}! 💕 I noticed you didn't finish your order for ${itemsPreview}. Would you like me to help you complete it? The checkout link is still active for you here 😊 👉 ${checkoutUrl}`;
        
        // If it was a WhatsApp order
        if (order.source === 'whatsapp' && storeData.whatsapp?.accessToken) {
           await sendWhatsAppNudge(customerPhone, storeData.whatsapp.phoneId, storeData.whatsapp.accessToken, nudgeMessage);
        } 
        // If it was an Instagram order
        else if (order.source === 'instagram' && storeData.instagram?.accessToken) {
           await sendInstagramNudge(order.customerInfo.instagramUserId, storeData.instagram.accessToken, nudgeMessage);
        }

        // 5. Mark as nudged so we don't spam them
        await orderDoc.ref.update({ nudgeSent: true, nudgedAt: new Date().toISOString() });
        results.push({ orderId: orderDoc.id, status: 'nudged' });

      } catch (err) {
        console.error(`[Cron] Failed to nudge order ${orderDoc.id}:`, err);
      }
    }

    return NextResponse.json({ success: true, processed: results });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// ── Helpers (Reusing our Meta Logic) ──────────────────────────────────────────
async function sendWhatsAppNudge(to: string, phoneId: string, token: string, text: string) {
  await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ messaging_product: "whatsapp", to, text: { body: text } })
  });
}

async function sendInstagramNudge(recipientId: string, token: string, text: string) {
  await fetch(`https://graph.facebook.com/v21.0/me/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ recipient: { id: recipientId }, message: { text } })
  });
}
