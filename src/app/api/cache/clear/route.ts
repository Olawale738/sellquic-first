// src/app/api/cache/clear/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { authAdmin } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    // 1. Get the Authorization Header and verify the token
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid token' }, { status: 401 });
    }
    const token = authHeader.split('Bearer ')[1];
    
    // This call verifies the user is legit before they can clear any cache
    await authAdmin.verifyIdToken(token);

    // 2. Get the storeId from the request
    const { storeId } = await request.json();
    if (!storeId) {
      return NextResponse.json({ error: 'Missing storeId' }, { status: 400 });
    }

    // 3. 💥 Blow up the Cache! 💥
    const cacheKey = `store_context_v3:${storeId}`;
    await kv.del(cacheKey);

    console.log(`[Cache API] Successfully cleared memory for store: ${storeId}`);
    return NextResponse.json({ success: true, message: 'Cache cleared' });

  } catch (error) {
    console.error('[Cache API] Failed to clear cache:', error);
    // Don't leak detailed error info to client
    if ((error as any).code === 'auth/id-token-expired') {
        return NextResponse.json({ error: 'Token expired, please refresh.' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to clear cache' }, { status: 500 });
  }
}
