import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { startOfYesterday, endOfYesterday, format } from 'date-fns';
import { ConversationSession, DailyReport } from '@/types/analytics';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; 

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const yesterdayStart = startOfYesterday();
  const yesterdayEnd = endOfYesterday();
  const dateKey = format(yesterdayStart, 'yyyy-MM-dd');
  
  let processedStores = 0;
  
  try {
    const storesSnap = await db.collection('stores').get();
    
    for (const storeDoc of storesSnap.docs) {
      const storeId = storeDoc.id;
      const reportRef = db.collection('stores').doc(storeId).collection('reports').doc(dateKey);

      const sessionsQuery = db.collection('stores').doc(storeId).collection('ai_conversations')
  .where('updatedAt', '>=', yesterdayStart)
  .where('updatedAt', '<=', yesterdayEnd);
        
      const sessionsSnap = await sessionsQuery.get();

      if (sessionsSnap.empty) {
        continue;
      }
      
      const dailyReport: DailyReport = {
        date: dateKey,
        totalConversations: sessionsSnap.size,
        totalUsers: new Set(sessionsSnap.docs.map(doc => doc.data().customer?.phone).filter(Boolean)).size,
        conversionFunnel: { started: 0, browsing: 0, checkout_created: 0, paid: 0 },
        productInterest: {},
        questionCategories: {},
        objectionTypes: {},
        handoverCount: 0,
        handoverRate: 0,
        handoverReasons: {},
        sentiment: { positive: 0, neutral: 0, negative: 0 },
        schemaVersion: 1
      };

      let handoverCount = 0;
      for (const sessionDoc of sessionsSnap.docs) {
        const session = sessionDoc.data();

        // Funnel
        dailyReport.conversionFunnel.started++;
        if (session.currentCart?.length > 0) dailyReport.conversionFunnel.browsing++;
        if (session.orderSessionStatus === 'checkout_ready') dailyReport.conversionFunnel.checkout_created++;
        if (session.lastActionData?.action === 'checkout') dailyReport.conversionFunnel.paid++;

        // Product Interest
        const cartItems = session.currentCart || session.lastCheckoutItems || [];
        for (const item of cartItems) {
          const pid = item.productId;
          if (!pid) continue;
          if (!dailyReport.productInterest[pid]) {
            dailyReport.productInterest[pid] = { name: item.nameSnapshot || item.name || 'Unknown', mentions: 0, checkouts: 0 };
          }
          dailyReport.productInterest[pid].mentions += 1;
          if (session.orderSessionStatus === 'checkout_ready') {
            dailyReport.productInterest[pid].checkouts += 1;
          }
        }

        // Questions — infer from awaitingStep
        if (session.awaitingStep) {
          const key = session.awaitingStep;
          dailyReport.questionCategories[key] = (dailyReport.questionCategories[key] || 0) + 1;
        }

        // Channel tracking
        if (session.channel) {
          const key = `channel_${session.channel}`;
          dailyReport.questionCategories[key] = (dailyReport.questionCategories[key] || 0) + 1;
        }

        // Handover
        if (session.status === 'needs_review' || session.handoverMode === true) {
          handoverCount++;
          if (session.handoverReason) {
            dailyReport.handoverReasons[session.handoverReason] =
              (dailyReport.handoverReasons[session.handoverReason] || 0) + 1;
          }
        }

        // Sentiment
        if (session.status === 'needs_review') {
          dailyReport.sentiment.negative += 1;
        } else if (session.orderSessionStatus === 'checkout_ready' || session.lastActionData?.action === 'checkout') {
          dailyReport.sentiment.positive += 1;
        } else {
          dailyReport.sentiment.neutral += 1;
        }
      }
      
      if (dailyReport.totalConversations > 0) {
        dailyReport.handoverCount = handoverCount;
        dailyReport.handoverRate = (handoverCount / dailyReport.totalConversations) * 100;
      }
      
      await reportRef.set(dailyReport);
      processedStores++;
    }

    return NextResponse.json({ success: true, message: `Generated daily reports for ${processedStores} stores.` });
    
  } catch (error: any) {
    console.error("Cron Job Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}