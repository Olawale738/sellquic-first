import { NextResponse } from 'next/server';
import { db, authAdmin } from '@/lib/firebase-admin';
import { THEME_STRATEGIES } from '@/lib/ai-prompts';
import { GoogleGenerativeAI } from "@google/generative-ai";
// Ensure this file exists or update the path
import imageData from '@/lib/placeholder-images.json'; 

const { placeholderImages } = imageData;

function getImage(id: string): string {
  return placeholderImages.find(img => img.id === id)?.imageUrl || '';
}

// Stock images per theme
const THEME_IMAGES: Record<string, any> = {
  glow: {
    hero: getImage('glow-hero'),
    promo: getImage('glow-promo'),
    categories: [getImage('glow-category-1'), getImage('glow-category-2')],
  },
  urban: {
    hero: getImage('urban-hero'),
    promo: getImage('urban-promo'),
    categories: [getImage('urban-category-1'), getImage('urban-category-2')],
  },
  onyx: {
    hero: getImage('onyx-hero'), 
    promo: getImage('onyx-promo-section'),
    categories: [getImage('onyx-category-1'), getImage('onyx-category-2')],
  },
};

export async function POST(request: Request) {
  try {
    const idToken = request.headers.get('authorization')?.split('Bearer ')[1];
    if (!idToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const decoded = await authAdmin.verifyIdToken(idToken);
    const { storeId, themeId } = await request.json();
    
    if (!storeId || !themeId) {
      return NextResponse.json({ error: 'Missing storeId or themeId' }, { status: 400 });
    }

    // 1. Verify Ownership
    const storeDoc = await db.collection('stores').doc(storeId).get();
    if (!storeDoc.exists || storeDoc.data()?.sellerId !== decoded.uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const storeData = storeDoc.data()!;
    const storeName = storeData.name || 'My Store';
    
    // 2. Fetch Context (Categories & Products)
    const categoriesSnap = await db.collection('stores').doc(storeId).collection('categories').get();
    const categories = categoriesSnap.docs.map(d => d.data().name);

    const productsSnap = await db.collection('products')
      .where('storeId', '==', storeId)
      .limit(10)
      .get();
    const productNames = productsSnap.docs.map(d => d.data().name).filter(Boolean);

    const images = THEME_IMAGES[themeId] || THEME_IMAGES.glow;

    // 3. Initialize Gemini (FIXED SYNTAX)
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });
    
    const prompt = `You are a world-class branding expert for a ${themeId === 'glow' ? 'Beauty/Wellness' : themeId === 'urban' ? 'Streetwear/Fashion' : 'Luxury/Premium'} brand.
Generate a complete store configuration for "${storeName}". 

Category: ${categories.join(', ') || 'General'}
Products: ${productNames.slice(0, 5).join(', ')}

Generate ONLY a JSON object (no markdown, no explanation):
{
  "hero1_headline": "Short punchy headline (max 6 words)",
  "hero1_subtext": "Subtext (max 12 words)",
  "hero1_button": "CTA (e.g. Shop Now)",
  "promo_headline": "Promo headline (e.g. 20% OFF)",
  "promo_subtext": "Promo subtext (max 20 words)",
  "aboutUs": "Professional 3-paragraph brand story (warm, authentic)",
  "deliveryInfo": "Clear delivery timeline for Ghana (e.g. 2-3 days in Accra)",
  "returnPolicy": "Friendly 7-day return policy",
  "tagline": "Catchy 5-word tagline",
  "faqs": [
    {"q": "How long does delivery take?", "a": "..."},
    {"q": "Are your products authentic?", "a": "..."},
    {"q": "Do you offer pick-ups?", "a": "..."}
  ]
}`;

    const result = await model.generateContent(prompt);
    const rawText = result.response.text().replace(/```json|```/g, '').trim();
    
    let ai: any = {};
    try {
      ai = JSON.parse(rawText);
    } catch (e) {
      // Fallback if AI output is messy
      ai = { hero1_headline: `Welcome to ${storeName}`, tagline: 'Quality products, delivered with love' };
    }

    // 4. Build Final Config (Merge AI content with stock images)
    const themeConfig = {
      hero1_image: images.hero,
      hero1_headline: ai.hero1_headline,
      hero1_subtext: ai.hero1_subtext,
      hero1_button: ai.hero1_button,
      promo_image: images.promo,
      promo_headline: ai.promo_headline,
      promo_subtext: ai.promo_subtext,
      faqs: ai.faqs || [],
      deliveryInfo: ai.deliveryInfo || ""
    };

    return NextResponse.json({ 
      success: true, 
      themeConfig,
      aboutUs: ai.aboutUs,
      returnPolicy: ai.returnPolicy,
      tagline: ai.tagline
    });

  } catch (error: any) {
    console.error('Theme Generate Error:', error);
    return NextResponse.json({ error: 'Failed to generate store' }, { status: 500 });
  }
}