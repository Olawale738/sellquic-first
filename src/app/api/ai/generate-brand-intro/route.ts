import { NextRequest, NextResponse } from 'next/server';
import { authAdmin, db } from '@/lib/firebase-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: NextRequest) {
  try {
    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split('Bearer ')[1];
    const decoded = await authAdmin.verifyIdToken(token);

    // Get store
    const { storeId } = await req.json();
    if (!storeId) return NextResponse.json({ error: 'Missing storeId' }, { status: 400 });

    const storeSnap = await db.collection('stores').doc(storeId).get();
    if (!storeSnap.exists) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

    const store = storeSnap.data()!;

    // Verify ownership
    if (store.sellerId !== decoded.uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Gather all available store context
    const parts: string[] = [];

    if (store.name) parts.push(`Business name: ${store.name}`);
    if (store.category) parts.push(`Business category: ${store.category}`);
    if (store.aboutUs && store.isAboutUsActive) parts.push(`About the business: ${store.aboutUs}`);
    if (store.location) parts.push(`Location: ${store.location}`);

    // Payment
    const paymentOptions: string[] = [];
    if (store.isPaystackActive) paymentOptions.push('Paystack (card & MoMo online)');
    if (store.momoNumber) parts.push(`Mobile Money (${store.momoNetwork || 'MoMo'}: ${store.momoNumber})`);
    if (store.bankName) paymentOptions.push(`Bank transfer (${store.bankName})`);
    if (store.isCodActive) paymentOptions.push('Cash on delivery');
    if (paymentOptions.length > 0) parts.push(`Payment methods: ${paymentOptions.join(', ')}`);

    // Delivery
    const deliverySnap = await db.collection('stores').doc(storeId).collection('deliveryZones').get();
    if (!deliverySnap.empty) {
      const zones = deliverySnap.docs.slice(0, 6).map(d => `${d.data().label} (GHS ${d.data().fee})`).join(', ');
      parts.push(`Delivery zones include: ${zones}${deliverySnap.size > 6 ? ` and ${deliverySnap.size - 6} more areas` : ''}`);
    }
    if (store.deliveryTimeline || store.deliveryNotice) {
      parts.push(`Delivery timeline: ${store.deliveryTimeline || store.deliveryNotice}`);
    }

    // Return policy
    if (store.isReturnPolicyActive && store.returnPolicy) {
      parts.push(`Return policy: ${store.returnPolicy}`);
    }

    // Products sample
    const productsSnap = await db.collection('products')
      .where('storeId', '==', storeId)
      .where('isArchived', '!=', true)
      .limit(10)
      .get();

    if (!productsSnap.empty) {
      const productNames = productsSnap.docs.map(d => d.data().name).filter(Boolean).slice(0, 8);
      parts.push(`Sample products: ${productNames.join(', ')}`);
    }

    if (parts.length < 2) {
      return NextResponse.json({
        error: 'Not enough store information to generate. Please fill in your store details first.'
      }, { status: 400 });
    }

    // Generate with Gemini
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-pro-preview' });

    const prompt = `You are writing a brand context paragraph for an AI shop assistant named ${store.aiAssistant?.assistantName || 'Ama'} who works at this business.

Here is everything we know about the business:
${parts.join('\n')}

Write 3–5 sentences of factual, practical background context that the AI assistant should know to answer customer questions accurately.

This is NOT a greeting and NOT a marketing pitch. It is internal knowledge — like briefing a new staff member before their first shift.

Include:
- What the business sells
- Where they are based and delivery coverage if known  
- Payment options available
- Return or refund policy if known
- Any other key operational facts

Rules:
- Plain text only. No formatting, no bullet points, no headers.
- Do not make up any details not provided above.
- Do not mention the AI assistant by name.
- Write in first-person plural (we, us, our) as if the business is speaking.
- Keep it under 550 characters.
- Be specific and factual, not vague or fluffy.`;

    const result = await model.generateContent(prompt);
    const brandIntro = result.response.text().trim();

    if (!brandIntro) {
      return NextResponse.json({ error: 'Generation failed — please try again.' }, { status: 500 });
    }

    return NextResponse.json({ brandIntro });

  } catch (error: any) {
    console.error('[generate-brand-intro]', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
