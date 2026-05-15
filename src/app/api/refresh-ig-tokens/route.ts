import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

export async function GET() {
  const stores = await db.collection('stores')
    .where('instagram.connected', '==', true)
    .get();

  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  let refreshed = 0;

  for (const doc of stores.docs) {
    const ig = doc.data().instagram || {};
    if (!ig.accessToken || !ig.tokenExpiresAt) continue;

    // Only refresh if expiring within 7 days
    if (ig.tokenExpiresAt > sevenDaysFromNow) continue;

    try {
      const res = await fetch(
        `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${ig.accessToken}`
      );
      const data = await res.json();

      if (data.access_token) {
        const newExpiry = new Date(Date.now() + (data.expires_in || 5184000) * 1000).toISOString();
        await db.collection('stores').doc(doc.id).update({
          'instagram.accessToken': data.access_token,
          'instagram.tokenExpiresAt': newExpiry,
        });
        refreshed++;
        console.log(`[IG Refresh] ✅ Refreshed token for @${ig.username}`);
      }
    } catch (e) {
      console.error(`[IG Refresh] ❌ Failed for store ${doc.id}:`, e);
    }
  }

  return NextResponse.json({ refreshed });
}