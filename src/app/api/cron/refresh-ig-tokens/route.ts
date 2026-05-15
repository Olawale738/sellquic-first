// src/app/api/cron/refresh-ig-tokens/route.ts
// ── Instagram Token Refresh Cron ─────────────────────────────────────────────
// Runs daily. Refreshes any Instagram long-lived tokens expiring within 7 days.
// Long-lived tokens last 60 days and can be refreshed after 24 hours.

import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

export const maxDuration = 60;

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  // Verify cron secret (Vercel sends this automatically)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[IG Token Refresh] Starting...');

  try {
    const storesSnap = await db.collection('stores')
      .where('instagram.connected', '==', true)
      .get();

    let refreshed = 0;
    let failed = 0;
    let skipped = 0;

    for (const doc of storesSnap.docs) {
      const ig = doc.data().instagram || {};

      if (!ig.accessToken) {
        skipped++;
        continue;
      }

      // Check if token expires within 7 days
      const expiresAt = ig.tokenExpiresAt ? new Date(ig.tokenExpiresAt).getTime() : 0;
      const now = Date.now();

      // If no expiry recorded, or expires within 7 days, refresh it
      if (expiresAt > 0 && (expiresAt - now) > SEVEN_DAYS_MS) {
        skipped++;
        continue;
      }

      try {
        const res = await fetch(
          `https://graph.instagram.com/refresh_access_token?` +
          new URLSearchParams({
            grant_type: 'ig_refresh_token',
            access_token: ig.accessToken,
          })
        );

        const data = await res.json();

        if (data.access_token) {
          const newExpiresAt = new Date(Date.now() + (data.expires_in || 5184000) * 1000).toISOString();

          await db.collection('stores').doc(doc.id).update({
            'instagram.accessToken': data.access_token,
            'instagram.tokenExpiresAt': newExpiresAt,
            'instagram.tokenRefreshedAt': new Date().toISOString(),
          });

          console.log(`[IG Token Refresh] ✅ Refreshed token for store ${doc.id}`);
          refreshed++;
        } else {
          console.error(`[IG Token Refresh] ❌ Failed for store ${doc.id}:`, data.error?.message);

          // If token is invalid/expired, mark as disconnected
          if (data.error?.code === 190 || data.error?.message?.includes('expired')) {
            await db.collection('stores').doc(doc.id).update({
              'instagram.connected': false,
              'instagram.disconnectedReason': 'Token expired and could not be refreshed',
              'instagram.disconnectedAt': new Date().toISOString(),
            });
            console.warn(`[IG Token Refresh] ⚠️ Disconnected store ${doc.id} — token expired`);
          }

          failed++;
        }
      } catch (err: any) {
        console.error(`[IG Token Refresh] ❌ Error for store ${doc.id}:`, err.message);
        failed++;
      }

      // Rate limit: don't hammer Meta API
      await new Promise(r => setTimeout(r, 500));
    }

    const summary = { total: storesSnap.size, refreshed, failed, skipped };
    console.log('[IG Token Refresh] Done:', summary);

    return NextResponse.json({ success: true, ...summary });
  } catch (err: any) {
    console.error('[IG Token Refresh] Fatal error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}