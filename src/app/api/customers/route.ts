import { NextRequest, NextResponse } from 'next/server';
import { db, authAdmin } from '@/lib/firebase-admin';
import { differenceInDays } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    const idToken = request.headers.get('authorization')?.split('Bearer ')[1];
    if (!idToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = await authAdmin.verifyIdToken(idToken);
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');
    const phoneFilter = searchParams.get('phone');

    if (!storeId) return NextResponse.json({ error: 'Store ID required' }, { status: 400 });

    // Verify Ownership
    const storeDoc = await db.collection('stores').doc(storeId).get();
    if (!storeDoc.exists || storeDoc.data()?.sellerId !== decoded.uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 1. Fetch Data
    const [ordersSnap, convosSnap] = await Promise.all([
      db.collection('orders').where('storeId', '==', storeId).orderBy('createdAt', 'desc').get(),
      db.collection('stores').doc(storeId).collection('ai_conversations').get()
    ]);

    const normalizePhone = (p: string) => p?.replace(/\D/g, '').slice(-10) || '';

    const customersMap = new Map<string, any>();

    // 2. Process Orders
    ordersSnap.docs.forEach(doc => {
      const data = doc.data();
      const rawPhone = data.customerInfo?.phone || '';
      const phone = normalizePhone(rawPhone);
      if (!phone) return;
      if (phoneFilter && normalizePhone(phoneFilter) !== phone) return;

      const current = customersMap.get(phone) || {
        id: phone,
        name: data.customerInfo.name,
        phone: rawPhone,
        email: data.customerInfo.email,
        address: data.customerInfo.address,
        totalOrders: 0,
        totalSpent: 0,
        aiOrders: 0,
        orders: [],
        conversations: [],
        channels: new Set(),
        firstOrderDate: data.createdAt,
        lastOrderDate: data.createdAt,
        totalMessages: 0,
      };

      current.totalOrders += 1;
      current.totalSpent += data.totalAmount || 0;
      if (data.source === 'ai') current.aiOrders += 1;
      
      if (current.orders.length < 10) {
        current.orders.push({
            id: doc.id,
            totalAmount: data.totalAmount,
            status: data.status,
            source: data.source || 'direct',
            items: data.items,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
          });
      }

      // Update to latest info
      if (data.createdAt.toDate() > current.lastOrderDate.toDate()) {
        current.name = data.customerInfo.name;
        current.email = data.customerInfo.email;
        current.address = data.customerInfo.address;
        current.lastOrderDate = data.createdAt;
      }

      customersMap.set(phone, current);
    });

    // 3. Process Conversations
    convosSnap.docs.forEach(doc => {
      const data = doc.data();
      const phone = normalizePhone(data.customerPhone);
      if (!phone) return;
      if (phoneFilter && normalizePhone(phoneFilter) !== phone) return;

      let current = customersMap.get(phone);
      if (!current) {
        current = {
          id: phone, name: data.customerName, phone: data.customerPhone,
          totalOrders: 0, totalSpent: 0, aiOrders: 0, orders: [], conversations: [],
          channels: new Set(), lastOrderDate: null, totalMessages: 0, updatedAt: data.updatedAt
        };
      }

      current.totalMessages += (data.messageCount || 0);
      if (data.channel) current.channels.add(data.channel);
      
      if (current.conversations.length < 5) {
        current.conversations.push({
            id: doc.id,
            channel: data.channel || 'web',
            messageCount: data.messageCount || 0,
            customerName: data.customerName,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
            updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
          });
      }
      
      const convoDate = data.updatedAt || data.createdAt;
      if (!current.lastActivityDate || convoDate.toDate() > current.lastActivityDate.toDate()) {
        current.lastActivityDate = convoDate;
      }

      customersMap.set(phone, current);
    });

    // 4. Final Formatting & Segmentation
    const customers = Array.from(customersMap.values()).map(c => {
      const lastOrder = c.lastOrderDate?.toDate();
      const lastActivity = c.lastActivityDate?.toDate() || lastOrder;
      const daysSinceLastOrder = lastOrder ? differenceInDays(new Date(), lastOrder) : null;

      let segment = 'new';
      if (c.totalOrders >= 5 || c.totalSpent >= 1000) segment = 'vip';
      else if (c.totalOrders >= 2) segment = 'repeat';
      else if (daysSinceLastOrder && daysSinceLastOrder > 60) segment = 'lost';
      else if (daysSinceLastOrder && daysSinceLastOrder > 30) segment = 'at-risk';

      const { firstOrderDate: _f, lastOrderDate: _l, lastActivityDate: _a, updatedAt: _u, ...rest } = c;
return {
  ...rest,
  channels: Array.from(c.channels),
  avgOrderValue: c.totalOrders > 0 ? c.totalSpent / c.totalOrders : 0,
  segment,
  lastActivityDate: lastActivity?.toISOString?.() || null,
  firstOrderDate: c.firstOrderDate?.toDate?.()?.toISOString() || null,
  lastOrderDate: lastOrder?.toISOString() || null,
};
    });

    return NextResponse.json(phoneFilter ? (customers[0] || null) : customers);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}