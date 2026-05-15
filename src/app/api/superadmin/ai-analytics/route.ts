import { NextResponse } from 'next/server';
import { db, authAdmin } from '@/lib/firebase-admin';

export async function GET(request: Request) {
  try {
    // Auth check
    const idToken = request.headers.get('authorization')?.split('Bearer ')[1];
    if (!idToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    if (userDoc.data()?.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(request.url);
    const period = url.searchParams.get('period') || '30'; // days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(period));

    // 1. Fetch ALL recent orders
    const allOrdersSnap = await db.collection('orders')
      .where('createdAt', '>=', cutoffDate)
      .orderBy('createdAt', 'desc')
      .get();

    const allOrders = allOrdersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];

    // 2. Separate AI vs Manual orders
    const aiOrders = allOrders.filter(o => o.aiAssisted === true);
    const manualOrders = allOrders.filter(o => !o.aiAssisted);

    // 3. Revenue calculations
    const totalRevenue = allOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const aiRevenue = aiOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const manualRevenue = manualOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    // 4. Average order values
    const aiAOV = aiOrders.length > 0 ? aiRevenue / aiOrders.length : 0;
    const manualAOV = manualOrders.length > 0 ? manualRevenue / manualOrders.length : 0;

    // 5. Channel breakdown
    const channelStats: Record<string, { orders: number; revenue: number }> = {};
    for (const order of aiOrders) {
      const ch = order.aiChannel || 'webchat';
      if (!channelStats[ch]) channelStats[ch] = { orders: 0, revenue: 0 };
      channelStats[ch].orders++;
      channelStats[ch].revenue += order.totalAmount || 0;
    }

    // 6. Daily trend (last N days)
    const dailyTrend: Record<string, { ai: number; manual: number; aiRevenue: number; manualRevenue: number }> = {};
    for (const order of allOrders) {
      const date = order.createdAt?.toDate?.()
        ? order.createdAt.toDate().toISOString().slice(0, 10)
        : new Date(order.createdAt?._seconds * 1000 || Date.now()).toISOString().slice(0, 10);

      if (!dailyTrend[date]) dailyTrend[date] = { ai: 0, manual: 0, aiRevenue: 0, manualRevenue: 0 };

      if (order.aiAssisted) {
        dailyTrend[date].ai++;
        dailyTrend[date].aiRevenue += order.totalAmount || 0;
      } else {
        dailyTrend[date].manual++;
        dailyTrend[date].manualRevenue += order.totalAmount || 0;
      }
    }

    // Sort by date
    const trendArray = Object.entries(dailyTrend)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({ date, ...data }));

    // 7. Top vendors by AI revenue
    const vendorAiRevenue: Record<string, { sellerId: string; revenue: number; orders: number; storeName: string }> = {};
    for (const order of aiOrders) {
      const sid = order.sellerId || 'unknown';
      if (!vendorAiRevenue[sid]) {
        vendorAiRevenue[sid] = { sellerId: sid, revenue: 0, orders: 0, storeName: '' };
      }
      vendorAiRevenue[sid].revenue += order.totalAmount || 0;
      vendorAiRevenue[sid].orders++;
    }

    // Fetch store names for top vendors
    const topVendorIds = Object.keys(vendorAiRevenue).slice(0, 20);
    if (topVendorIds.length > 0) {
      const storesSnap = await db.collection('stores')
        .where('sellerId', 'in', topVendorIds.slice(0, 10))
        .get();
      for (const doc of storesSnap.docs) {
        const data = doc.data();
        if (vendorAiRevenue[data.sellerId]) {
          vendorAiRevenue[data.sellerId].storeName = data.name || 'Unknown Store';
        }
      }
    }

    const topVendors = Object.values(vendorAiRevenue)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // 8. Recent AI orders for the table
    const recentAiOrders = aiOrders.slice(0, 50).map(o => ({
      id: o.id,
      storeName: o.subdomain || o.storeId,
      customerName: o.customerInfo?.name || 'Unknown',
      customerPhone: o.customerInfo?.phone || '',
      channel: o.aiChannel || 'webchat',
      amount: o.totalAmount || 0,
      status: o.status || 'unknown',
      paymentMethod: o.selectedPaymentMethod || 'unknown',
      itemCount: o.items?.length || 0,
      createdAt: o.createdAt?.toDate?.()
        ? o.createdAt.toDate().toISOString()
        : new Date((o.createdAt?._seconds || 0) * 1000).toISOString(),
    }));

    // 9. AI Conversation stats
    let totalConversations = 0;
    let activeConversations = 0;
    

    // 10. Conversion rate
    const conversionRate = totalConversations > 0
      ? ((aiOrders.length / totalConversations) * 100).toFixed(1)
      : '0.0';

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalOrders: allOrders.length,
          aiOrders: aiOrders.length,
          manualOrders: manualOrders.length,
          aiPercentage: allOrders.length > 0 ? ((aiOrders.length / allOrders.length) * 100).toFixed(1) : '0.0',
          totalRevenue,
          aiRevenue,
          manualRevenue,
          aiAOV: Math.round(aiAOV * 100) / 100,
          manualAOV: Math.round(manualAOV * 100) / 100,
          totalConversations,
          activeConversations,
          conversionRate,
        },
        channelStats,
        dailyTrend: trendArray,
        topVendors,
        recentAiOrders,
      },
    });
  } catch (err: any) {
    console.error('[AI Analytics API]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}