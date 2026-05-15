import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const storeId = searchParams.get('storeId');
    const secret = searchParams.get('secret');

    if (secret !== process.env.DEV_ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!storeId) {
      return NextResponse.json({ error: 'Missing storeId' }, { status: 400 });
    }

    const storeRef = db.collection('stores').doc(storeId);
    const storeSnap = await storeRef.get();

    if (!storeSnap.exists) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    await storeRef.set(
      {
        aiV2: {
          enabled: true,
          channels: {
            webchat: true,
            whatsapp: false,
            instagram: false,
          },
        },
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      message: 'AI v2 webchat enabled for this store only.',
      storeId,
      aiV2: {
        enabled: true,
        channels: {
          webchat: true,
          whatsapp: false,
          instagram: false,
        },
      },
    });
  } catch (error: any) {
    console.error('[Enable AI V2 Dev Route] Failed:', error);

    return NextResponse.json(
      {
        error: 'Failed to enable AI v2',
        details: String(error?.message || error),
      },
      { status: 500 }
    );
  }
}