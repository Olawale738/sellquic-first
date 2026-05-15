// src/app/api/ai/analytics/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { db, authAdmin } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const idToken = request.headers.get('authorization')?.split('Bearer ')[1];
    if (!idToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = await authAdmin.verifyIdToken(idToken);
    const storeId = request.nextUrl.searchParams.get('storeId');
    if (!storeId) return NextResponse.json({ error: 'Missing storeId' }, { status: 400 });

    // Verify ownership
    const storeDoc = await db.collection('stores').doc(storeId).get();
    if (!storeDoc.exists || storeDoc.data()?.sellerId !== decoded.uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // ── Fetch all data in parallel ────────────────────────────────────────
    const [
      conversationsSnap,
      allOrdersSnap,
      aiOrdersSnap,
    ] = await Promise.all([
      // All conversations for this store (last 30 days)
      db.collection('stores').doc(storeId)
        .collection('ai_conversations')
        .where('updatedAt', '>=', thirtyDaysAgo)
        .get(),

      // All orders for this store (last 30 days)
      db.collection('orders')
        .where('storeId', '==', storeId)
        .where('createdAt', '>=', thirtyDaysAgo)
        .get(),

      // AI-sourced orders
      db.collection('orders')
        .where('storeId', '==', storeId)
        .where('source', '==', 'ai')
        .where('createdAt', '>=', thirtyDaysAgo)
        .get(),
    ]);

    // ── Process Conversations ─────────────────────────────────────────────
    let totalConversations = 0;
    let totalMessages = 0;
    let handoverCount = 0;
    let activeConversations = 0;
    const channelBreakdown: Record<string, number> = {};
    const dailyConversations: Record<string, number> = {};
    const conversationLengths: number[] = [];

    conversationsSnap.docs.forEach(doc => {
      const data = doc.data();
      totalConversations++;
      totalMessages += data.messageCount || 0;
      conversationLengths.push(data.messageCount || 0);

      if (data.handoverMode === true) handoverCount++;
      if (data.status === 'active' || data.status === 'open') activeConversations++;

      const channel = data.channel || 'web';
      channelBreakdown[channel] = (channelBreakdown[channel] || 0) + 1;

      // Daily breakdown
      const date = data.createdAt?.toDate?.() || data.updatedAt?.toDate?.();
      if (date) {
        const dayKey = date.toISOString().split('T')[0];
        dailyConversations[dayKey] = (dailyConversations[dayKey] || 0) + 1;
      }
    });

    const avgMessagesPerConvo = totalConversations > 0
      ? Math.round(totalMessages / totalConversations)
      : 0;

    // ── Process Orders ────────────────────────────────────────────────────
    let totalOrderCount = allOrdersSnap.size;
    let totalRevenue = 0;
    let aiOrderCount = aiOrdersSnap.size;
    let aiRevenue = 0;

    allOrdersSnap.docs.forEach(doc => {
      const data = doc.data();
      totalRevenue += data.totalAmount || 0;
    });

    const aiOrders: Array<{
      id: string;
      customerName: string;
      totalAmount: number;
      status: string;
      createdAt: string;
      items: any[];
    }> = [];

    const dailyAiRevenue: Record<string, number> = {};

    aiOrdersSnap.docs.forEach(doc => {
      const data = doc.data();
      aiRevenue += data.totalAmount || 0;

      const createdAt = data.createdAt?.toDate?.();
      const dateStr = createdAt ? createdAt.toISOString() : new Date().toISOString();

      if (createdAt) {
        const dayKey = createdAt.toISOString().split('T')[0];
        dailyAiRevenue[dayKey] = (dailyAiRevenue[dayKey] || 0) + (data.totalAmount || 0);
      }

      aiOrders.push({
        id: doc.id,
        customerName: data.customerInfo?.name || 'Unknown',
        totalAmount: data.totalAmount || 0,
        status: data.status || 'unknown',
        createdAt: dateStr,
        items: (data.items || []).map((i: any) => ({
          name: i.productName,
          quantity: i.quantity,
          price: i.price,
        })),
      });
    });

    // Sort AI orders by date descending
    aiOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // ── Conversion Rate ───────────────────────────────────────────────────
    const conversionRate = totalConversations > 0
      ? ((aiOrderCount / totalConversations) * 100).toFixed(1)
      : '0.0';

    // ── Checkout Messages (from conversation messages) ────────────────────
    // Count how many checkout links were generated
    let checkoutLinksGenerated = 0;
    // We'll count from AI orders since each represents a successful checkout generation
    // For generated but not completed, we'd need to scan messages — skip for now
    checkoutLinksGenerated = aiOrderCount; // minimum — actual could be higher

    // ── Build Response ────────────────────────────────────────────────────
    const analytics = {
      // Overview
      overview: {
        totalConversations,
        activeConversations,
        totalMessages,
        avgMessagesPerConvo,
        handoverCount,
        handoverRate: totalConversations > 0
          ? ((handoverCount / totalConversations) * 100).toFixed(1)
          : '0.0',
      },

      // Revenue
      revenue: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        aiRevenue: Math.round(aiRevenue * 100) / 100,
        aiOrderCount,
        totalOrderCount,
        aiRevenueShare: totalRevenue > 0
          ? ((aiRevenue / totalRevenue) * 100).toFixed(1)
          : '0.0',
        conversionRate,
        avgOrderValue: aiOrderCount > 0
          ? Math.round((aiRevenue / aiOrderCount) * 100) / 100
          : 0,
      },

      // Channel breakdown
      channels: channelBreakdown,

      // Daily trends (last 30 days)
      trends: {
        conversations: Object.entries(dailyConversations)
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => a.date.localeCompare(b.date)),
        revenue: Object.entries(dailyAiRevenue)
          .map(([date, amount]) => ({ date, amount: Math.round(amount * 100) / 100 }))
          .sort((a, b) => a.date.localeCompare(b.date)),
      },

      // Recent AI orders
      recentAiOrders: aiOrders.slice(0, 20),
    };

    return NextResponse.json(analytics);

  } catch (error: any) {
    console.error('[AI Analytics] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}