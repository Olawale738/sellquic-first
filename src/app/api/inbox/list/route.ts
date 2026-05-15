import { NextResponse, type NextRequest } from 'next/server';
import { db, authAdmin } from '@/lib/firebase-admin';
import { sanitizeTimestamps } from '@/lib/serialize-firestore';

export async function GET(request: NextRequest) {
  try {
    const idToken = request.headers.get('authorization')?.split('Bearer ')[1];
    if (!idToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const userId = decodedToken.uid;

    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');
    if (!storeId) return NextResponse.json({ error: 'Missing storeId' }, { status: 400 });

    const storeRef = db.collection('stores').doc(storeId);
    const storeSnap = await storeRef.get();
    if (!storeSnap.exists || storeSnap.data()?.sellerId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch inbox threads
    const threadsSnapshot = await storeRef
      .collection('inboxThreads')
      .orderBy('lastMessageAt', 'desc')
      .limit(100)
      .get();

    if (threadsSnapshot.empty) return NextResponse.json([]);

    // Enrich each thread with conversation data in parallel
    const enriched = await Promise.all(
      threadsSnapshot.docs.map(async (doc) => {
        const thread = { id: doc.id, ...doc.data() };

        try {
          const convSnap = await storeRef
            .collection('ai_conversations')
            .doc(doc.id)
            .get();

          if (convSnap.exists) {
            const conv = convSnap.data()!;
            return {
              ...thread,
              customerName: conv.customerName || null,
              customerPhone: conv.customerPhone || null,
              channel: conv.channel || 'webchat',
              status: conv.status || 'active',
              handoverMode: conv.handoverMode || false,
              awaitingStep: conv.awaitingStep || null,
              orderSessionStatus: conv.orderSessionStatus || null,
              pendingAiComeback: conv.pendingAiComeback?.resolved === false ? true : false,
            };
          }
        } catch (_) {}

        return thread;
      })
    );

    return NextResponse.json(sanitizeTimestamps(enriched));

  } catch (error) {
    console.error('Inbox List API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inbox.', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}