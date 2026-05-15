import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

const APP_ID = process.env.FACEBOOK_APP_ID!;
const APP_SECRET = process.env.FACEBOOK_APP_SECRET!;
const SYSTEM_USER_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN!;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const stateStr = searchParams.get('state');
  const origin = request.nextUrl.origin;
  const redirectUri = `${origin}/api/whatsapp/callback`;

  // ── 1. Handle Denied Access ──
  if (!code || !stateStr) {
    const error = searchParams.get('error_description') || 'Access Denied by user.';
    return new NextResponse(`
      <html><body>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'WA_ERROR', error: '${error}' }, '*');
            window.close();
          } else {
            window.location.href = '${origin}/dashboard/ai-assistant?error=${encodeURIComponent(error)}';
          }
        </script>
        <p>Connection failed. Redirecting...</p>
      </body></html>
    `, { headers: { 'Content-Type': 'text/html' } });
  }

  let storeId: string;
  try {
    const state = JSON.parse(decodeURIComponent(stateStr));
    storeId = state.storeId;
    if (!storeId) throw new Error('State object missing storeId');
  } catch(e) {
    console.error('[WA Callback] Invalid state:', e);
    return new NextResponse(`
      <html><body>
        <script>
          if (window.opener) {
            window.close();
          } else {
            window.location.href = '${origin}/dashboard/ai-assistant?error=Invalid+session';
          }
        </script>
      </body></html>
    `, { headers: { 'Content-Type': 'text/html' } });
  }

  try {
    // ── 2. Exchange code for User Access Token ──
    const tokenRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?` +
      new URLSearchParams({
        client_id: APP_ID,
        client_secret: APP_SECRET,
        redirect_uri: redirectUri,
        code,
      })
    );
    const tokenData = await tokenRes.json();
    const userToken = tokenData.access_token;
    if (!userToken) {
  console.error('[WA Exchange] Token response:', JSON.stringify(tokenData));
  throw new Error('Failed to get access token: ' + (tokenData.error?.message || JSON.stringify(tokenData)));
}

    // ── 3. Find WABA ID via Token Debug ──
    let wabaId = null;
    const debugRes = await fetch(
      `https://graph.facebook.com/v21.0/debug_token?input_token=${userToken}&access_token=${APP_ID}|${APP_SECRET}`
    );
    const debugData = await debugRes.json();

    if (debugData.data?.granular_scopes) {
      const waScope = debugData.data.granular_scopes.find(
        (s: any) => s.scope === 'whatsapp_business_messaging' || s.scope === 'whatsapp_business_management'
      );
      if (waScope?.target_ids?.length > 0) {
        wabaId = waScope.target_ids[0];
      }
    }

    // Fallback if debug_token fails
    if (!wabaId) {
      const bizRes = await fetch(`https://graph.facebook.com/v21.0/me/businesses?fields=whatsapp_business_accounts`, { headers: { Authorization: `Bearer ${userToken}` } });
      const bizData = await bizRes.json();
      wabaId = bizData?.data?.[0]?.whatsapp_business_accounts?.data?.[0]?.id;
    }

    if (!wabaId) throw new Error('Could not identify your WhatsApp Business Account.');

    // ── 4. Get Phone Number ID ──
    const phoneRes = await fetch(`https://graph.facebook.com/v21.0/${wabaId}/phone_numbers`, { headers: { Authorization: `Bearer ${userToken}` } });
    const phoneData = await phoneRes.json();
    const phoneId = phoneData.data?.[0]?.id;
    const phoneNumber = phoneData.data?.[0]?.display_phone_number;

    if (!phoneId) throw new Error('No phone number found in your WhatsApp account.');

    // ── 5. Automatic Registration Handshake ──
    console.log(`[WA Callback] Automatically registering Phone ID: ${phoneId}`);
    const registerRes = await fetch(
      `https://graph.facebook.com/v21.0/${phoneId}/register`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          pin: String(Math.floor(100000 + Math.random() * 900000)),
        }),
      }
    );
    const registerData = await registerRes.json();
    if (!registerRes.ok) {
        console.warn('[WA Callback] Auto-registration note:', registerData.error?.message);
    }

    // ── 6. Subscribe App to Webhooks ──
    await fetch(
      `https://graph.facebook.com/v21.0/${wabaId}/subscribed_apps`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${SYSTEM_USER_TOKEN}` },
      }
    );

    // ── 7. Save to Firestore ──
    await db.collection('stores').doc(storeId).update({
      'whatsapp.status': 'active',
      'whatsapp.accessToken': SYSTEM_USER_TOKEN,
      'whatsapp.phoneId': phoneId,
      'whatsapp.wabaId': wabaId,
      'whatsapp.phoneNumber': phoneNumber,
      'whatsapp.connectedAt': new Date().toISOString(),
      'whatsapp.registrationStatus': 'completed'
    });


    autoSetWhatsAppProfile(storeId, phoneId).catch(e =>
      console.warn('[WA Callback] Profile auto-set failed (non-blocking):', e)
  );



    // ── 8. Success Response (handles both popup and mobile redirect) ──
    return new NextResponse(`
      <html><body>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'WA_SUCCESS' }, '*');
            window.close();
          } else {
            window.location.href = '${origin}/dashboard/ai-assistant?whatsapp_success=true';
          }
        </script>
        <p>WhatsApp AI is now Connected! 🚀 Redirecting...</p>
      </body></html>
    `, { headers: { 'Content-Type': 'text/html' } });

  } catch (error: any) {
    console.error('[WA Callback Error]', error);
    const safeMessage = (error.message || 'Unknown error').replace(/'/g, "\\'");
    return new NextResponse(`
      <html><body>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'WA_ERROR', error: '${safeMessage}' }, '*');
            window.close();
          } else {
            window.location.href = '${origin}/dashboard/ai-assistant?error=${encodeURIComponent(error.message || 'Connection failed')}';
          }
        </script>
        <p>Error: ${error.message}. Redirecting...</p>
      </body></html>
    `, { headers: { 'Content-Type': 'text/html' } });
  }
}
async function autoSetWhatsAppProfile(storeId: string, phoneId: string) {
  const TOKEN = process.env.WHATSAPP_ACCESS_TOKEN!;
  const APP_ID_LOCAL = process.env.FACEBOOK_APP_ID!;

  const storeDoc = await db.collection('stores').doc(storeId).get();
  const store = storeDoc.data();
  if (!store) return;

  // Set text profile info first
  await fetch(`https://graph.facebook.com/v21.0/${phoneId}/whatsapp_business_profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
      body: JSON.stringify({
          messaging_product: 'whatsapp',
          about: store.tagline || `Shop at ${store.name}`,
          description: store.aiAssistant?.brandIntro || `Welcome to ${store.name}`,
          websites: [store.customDomain ? `https://${store.customDomain}` : `https://${store.subdomain}.sellquic.com`],
          vertical: 'RETAIL',
      }),
  });

  // Try logo upload if exists
  if (!store.logoUrl) return;

  const imageRes = await fetch(store.logoUrl);
  const imageBuffer = Buffer.from(await imageRes.arrayBuffer());
  const contentType = imageRes.headers.get('content-type') || 'image/jpeg';

  if (imageBuffer.length > 5 * 1024 * 1024 || imageBuffer.length < 1000) return;

  const sessionRes = await fetch(
      `https://graph.facebook.com/v21.0/${APP_ID_LOCAL}/uploads?file_length=${imageBuffer.length}&file_type=${contentType}&access_token=${TOKEN}`,
      { method: 'POST' }
  );
  const sessionData = await sessionRes.json();
  if (!sessionData.id) return;

  const uploadRes = await fetch(`https://graph.facebook.com/v21.0/${sessionData.id}`, {
      method: 'POST',
      headers: { 'Authorization': `OAuth ${TOKEN}`, 'file_offset': '0', 'Content-Type': contentType },
      body: imageBuffer,
  });
  const uploadData = await uploadRes.json();
  if (!uploadData.h) return;

  await fetch(`https://graph.facebook.com/v21.0/${phoneId}/whatsapp_business_profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
      body: JSON.stringify({ messaging_product: 'whatsapp', profile_picture_handle: uploadData.h }),
  });

  console.log(`[WA Profile] ✅ Logo + profile set for ${store.name}`);
}