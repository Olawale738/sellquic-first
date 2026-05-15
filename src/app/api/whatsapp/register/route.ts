import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const { storeId } = await request.json();

    if (!storeId) return NextResponse.json({ error: 'Missing storeId' }, { status: 400 });

    // 1. Fetch the stored IDs and Token from Firestore
    const storeDoc = await db.collection('stores').doc(storeId).get();
    if (!storeDoc.exists) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

    const data = storeDoc.data();
    const phoneId = data?.whatsapp?.phoneId;
    const accessToken = data?.whatsapp?.accessToken || process.env.WHATSAPP_ACCESS_TOKEN;

    if (!phoneId || !accessToken) {
      return NextResponse.json({ error: 'Missing WhatsApp credentials in Firestore' }, { status: 400 });
    }

    console.log(`[WA Register] Attempting to register Phone ID: ${phoneId}`);

    // 2. THE CRITICAL HANDSHAKE: The Registration API Call
    // This tells Meta to "Activate" the number for the Cloud API.
    const registerRes = await fetch(
      `https://graph.facebook.com/v21.0/${phoneId}/register`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          pin: String(Math.floor(100000 + Math.random() * 900000)),
        }),
      }
    );

    const registerData = await registerRes.json();

    if (!registerRes.ok) {
      console.error('[WA Register] Meta Error:', JSON.stringify(registerData));
      return NextResponse.json({ 
        error: registerData.error?.message || 'Meta registration failed',
        details: registerData 
      }, { status: registerRes.status });
    }

    // 3. Update Firestore status to confirm registration attempt
    await db.collection('stores').doc(storeId).update({
      'whatsapp.registrationStatus': 'completed',
      'whatsapp.updatedAt': new Date().toISOString(),
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Registration handshake successful! Check Meta dashboard in 2 minutes.' 
    });

  } catch (error: any) {
    console.error('[WA Register] Internal Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}