import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const IG_APP_ID = process.env.INSTAGRAM_APP_ID!;
const IG_APP_SECRET = process.env.INSTAGRAM_APP_SECRET!;

export async function GET(request: NextRequest) {
  console.log('[IG Callback] Started — Dynamic Routing enabled');

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const stateRaw = searchParams.get('state');
  const error = searchParams.get('error');

  // 1. DYNAMIC REDIRECTION LOGIC
  let storeId: string;
  let returnTo: string;

  try {
    const decodedState = JSON.parse(decodeURIComponent(stateRaw || '{}'));
    storeId = decodedState.storeId;
    // This 'returnTo' is what we passed from the frontend handleConnect
    returnTo = decodedState.returnTo || 'https://sellquic.com';
    
    if (!storeId) throw new Error('Missing storeId');
  } catch (e) {
    console.error('[IG Callback] Invalid state:', e);
    return NextResponse.redirect('https://sellquic.com/dashboard/ai-assistant?instagram=error');
  }

  // Use the origin we came from for all further Meta calls and redirects
  const REDIRECT_URI = `${request.nextUrl.origin}/api/instagram/callback`;
  const DASHBOARD_URL = `${returnTo}/dashboard/ai-assistant`;

  if (error) {
    return NextResponse.redirect(`${DASHBOARD_URL}?instagram=denied`);
  }

  try {
    // ── Step 1: Exchange code for short-lived token ───────────────────────────
    const shortTokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: IG_APP_ID,
        client_secret: IG_APP_SECRET,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI, // ✅ Now matches the branch
        code: code!,
      }),
    });

    const shortTokenRaw = await shortTokenRes.json();
    console.log('[IG Callback] Token response:', JSON.stringify(shortTokenRaw));
    const shortTokenData = shortTokenRaw.data?.[0] || shortTokenRaw;
    const shortToken = shortTokenData.access_token;
    const igUserIdFromToken = String(shortTokenData.user_id);

    // ── Step 2: Exchange short token for long-lived token (60 days) ───────────
    const longTokenRes = await fetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${IG_APP_SECRET}&access_token=${shortToken}`
    );
    const longTokenData = await longTokenRes.json();
    const accessToken = longTokenData.access_token || shortToken;
    const expiresIn = longTokenData.expires_in || null;

    // ── Step 3: Get profile ──
    const profileRes = await fetch(
      `https://graph.instagram.com/me?fields=id,username,name&access_token=${accessToken}`
    );
    const profileData = await profileRes.json();
    const igAccountId = profileData.id || igUserIdFromToken;
    const igUsername = profileData.username || '';

    // ── Step 4: Subscribe IG account to webhook ──
    const subRes = await fetch(`https://graph.instagram.com/${igAccountId}/subscribed_apps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscribed_fields: ['messages', 'messaging_postbacks'],
        access_token: accessToken,
      }),
    });
    const subData = await subRes.json();
    console.log('[IG Callback] Webhook subscription response:', JSON.stringify(subData));

    // ── Step 5: Save to Firestore ──
    const tokenExpiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;
    await db.collection('stores').doc(storeId).update({
      instagram: {
          connected: true,
          accountId: igAccountId,
          webhookId: null,  // ← ADD THIS — force re-discovery
          igUserId: igUserIdFromToken,
          username: igUsername,
          accessToken: accessToken,
          tokenExpiresAt,
          connectedAt: FieldValue.serverTimestamp(),
      },
  });

    // ✅ REDIRECT BACK TO THE CORRECT URL (Branch, Local, or Prod)
    return NextResponse.redirect(`${DASHBOARD_URL}?instagram=connected`);

  } catch (err: any) {
    console.error('[IG Callback] Error:', err.message, err.stack);
    console.error('[IG Callback] Error:', err);
    return NextResponse.redirect(`${DASHBOARD_URL}?instagram=error`);
  }
}
