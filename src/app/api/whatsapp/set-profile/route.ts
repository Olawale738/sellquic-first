import { NextRequest, NextResponse } from 'next/server';
import { db, authAdmin } from '@/lib/firebase-admin';

const APP_ID = process.env.FACEBOOK_APP_ID!;
const SYSTEM_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN!;

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await authAdmin.verifyIdToken(authHeader.split('Bearer ')[1]);

    const { storeId } = await request.json();
    if (!storeId) return NextResponse.json({ error: 'Missing storeId' }, { status: 400 });

    const storeDoc = await db.collection('stores').doc(storeId).get();
    const store = storeDoc.data();
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

    const phoneId = store.whatsapp?.phoneId;
    if (!phoneId) return NextResponse.json({ error: 'WhatsApp not connected' }, { status: 400 });

    const logoUrl = store.logoUrl;
    if (!logoUrl) return NextResponse.json({ error: 'No store logo found' }, { status: 400 });

    // 1. Download the logo from Firebase Storage
    const imageRes = await fetch(logoUrl);
    const imageBuffer = Buffer.from(await imageRes.arrayBuffer());
    const contentType = imageRes.headers.get('content-type') || 'image/jpeg';

    // 2. Create upload session
    const sessionRes = await fetch(
      `https://graph.facebook.com/v21.0/${APP_ID}/uploads?file_length=${imageBuffer.length}&file_type=${contentType}&access_token=${SYSTEM_TOKEN}`,
      { method: 'POST' }
    );
    const sessionData = await sessionRes.json();
    
    if (!sessionData.id) {
      console.error('[WA Profile] Upload session failed:', sessionData);
      return NextResponse.json({ error: 'Upload session failed' }, { status: 500 });
    }

    // 3. Upload the image binary
    const uploadRes = await fetch(
      `https://graph.facebook.com/v21.0/${sessionData.id}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `OAuth ${SYSTEM_TOKEN}`,
          'file_offset': '0',
          'Content-Type': contentType,
        },
        body: imageBuffer,
      }
    );
    const uploadData = await uploadRes.json();

    if (!uploadData.h) {
      console.error('[WA Profile] Upload failed:', uploadData);
      return NextResponse.json({ error: 'Image upload failed' }, { status: 500 });
    }

    // 4. Set the business profile with logo + store info
    const profileRes = await fetch(
      `https://graph.facebook.com/v21.0/${phoneId}/whatsapp_business_profile`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SYSTEM_TOKEN}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          about: store.tagline || `Shop at ${store.name}`,
          description: store.aiAssistant?.brandIntro || `Welcome to ${store.name} on SellQuic`,
          websites: [
            store.customDomain
              ? `https://${store.customDomain}`
              : `https://${store.subdomain}.sellquic.com`,
          ],
          vertical: 'RETAIL',
          profile_picture_handle: uploadData.h,
        }),
      }
    );
    const profileData = await profileRes.json();

    if (!profileRes.ok) {
      console.error('[WA Profile] Profile update failed:', profileData);
      return NextResponse.json({ error: 'Profile update failed', details: profileData }, { status: 500 });
    }

    console.log(`[WA Profile] ✅ Profile set for store ${storeId} — logo + info`);
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('[WA Profile] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}