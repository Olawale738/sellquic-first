import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { authAdmin, db } from '@/lib/firebase-admin';
import type { VendorSignupData, StorefrontConfig } from '@/types/storefront-config';

const STOREFRONT_PROMPT = `You are SellQuic AI Storefront Builder — an expert ecommerce designer, brand strategist, copywriter, and UI/UX generator.

Your task is to automatically create a beautiful, high-converting, fully editable online storefront for a vendor immediately after signup.

Use the vendor's information provided to generate the storefront. Return ONLY valid JSON — no markdown, no explanation, no extra text.

The JSON must follow this exact structure:
{
  "storefront_name": "",
  "theme_name": "",
  "theme_category": "",
  "color_palette": {
    "primary": "",
    "secondary": "",
    "accent": "",
    "background": "",
    "text": ""
  },
  "typography": {
    "heading_font_style": "",
    "body_font_style": ""
  },
  "navigation": [],
  "hero": {
    "headline": "",
    "subheadline": "",
    "primary_cta": "",
    "secondary_cta": "",
    "visual_direction": ""
  },
  "categories": [
    {
      "name": "",
      "description": "",
      "theme_style": "",
      "editable": true
    }
  ],
  "featured_products": [
    {
      "name": "",
      "category": "",
      "description": "",
      "price_placeholder": "",
      "image_prompt": "",
      "variants": [],
      "editable": true
    }
  ],
  "catalog_layout": {
    "style": "",
    "filters": [],
    "sorting_options": [],
    "product_card_style": ""
  },
  "cart": {
    "empty_state": "",
    "subtotal_label": "",
    "checkout_cta": ""
  },
  "order_tracking": {
    "headline": "",
    "description": "",
    "input_placeholder": "",
    "cta": ""
  },
  "help_section": {
    "headline": "",
    "description": "",
    "cta": ""
  },
  "about_section": {
    "headline": "",
    "description": ""
  },
  "contact_section": {
    "email": "",
    "phone": "",
    "location": "",
    "whatsapp_enabled": true
  },
  "footer": {
    "store_name": "",
    "description": "",
    "links": [],
    "copyright": "",
    "powered_by": "SellQuic"
  },
  "editable_fields": [],
  "recommended_admin_controls": [],
  "seo": {
    "page_title": "",
    "meta_description": "",
    "keywords": []
  }
}

Rules:
- theme_category must be one of: fashion, food, beauty, electronics, furniture, groceries, services, general
- color_palette values must be valid hex codes (e.g. #1a1a2e)
- navigation must include: Shop, Categories, Track Order, Contact
- categories must contain 4–6 relevant entries for the vendor's business type
- featured_products must contain 4–6 sample/placeholder products relevant to the vendor
- catalog_layout.style: "grid" or "masonry" or "list"
- editable_fields must list every key the vendor can edit
- recommended_admin_controls: list dashboard controls to suggest
- seo.keywords: 5–8 relevant search keywords
- typography font styles: describe font personality (e.g. "elegant serif", "clean sans-serif", "bold display")
- visual_direction: describe the hero background style (e.g. "warm gradient with product image on right")
- About section tone must match category: fashion=elegant/trendy, food=warm/appetizing, beauty=luxurious, electronics=reliable/modern, services=professional, groceries=fresh/convenient
- Do NOT use placeholder text like "Lorem ipsum". Write real, persuasive copy.
- Make it specific to the vendor's category — never generic.`;

function buildVendorPrompt(data: VendorSignupData): string {
  const parts: string[] = [];
  if (data.vendor_name) parts.push(`Vendor Name: ${data.vendor_name}`);
  if (data.business_category) parts.push(`Business Category: ${data.business_category}`);
  if (data.subcategory) parts.push(`Subcategory/Niche: ${data.subcategory}`);
  if (data.products) parts.push(`Products or Services: ${data.products}`);
  if (data.location) parts.push(`Location: ${data.location}`);
  if (data.email) parts.push(`Contact Email: ${data.email}`);
  if (data.phone) parts.push(`Phone/WhatsApp: ${data.phone}`);
  if (data.business_description) parts.push(`Brand Description: ${data.business_description}`);
  if (data.target_customers) parts.push(`Target Customers: ${data.target_customers}`);
  if (data.price_range) parts.push(`Price Range: ${data.price_range}`);
  if (data.preferences) parts.push(`Vendor Preferences: ${data.preferences}`);

  return parts.join('\n');
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split('Bearer ')[1];
    const decoded = await authAdmin.verifyIdToken(token);

    const body = await req.json();
    const { storeId, vendorData } = body as { storeId?: string; vendorData: VendorSignupData };

    if (!vendorData?.vendor_name && !vendorData?.business_category) {
      return NextResponse.json({ error: 'Missing vendor information' }, { status: 400 });
    }

    if (storeId) {
      const storeSnap = await db.collection('stores').doc(storeId).get();
      if (!storeSnap.exists) {
        return NextResponse.json({ error: 'Store not found' }, { status: 404 });
      }
      if (storeSnap.data()?.sellerId !== decoded.uid) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `${STOREFRONT_PROMPT}\n\nVendor Information:\n${buildVendorPrompt(vendorData)}`;

    const result = await model.generateContent(prompt);
    const rawText = result.response.text().trim();

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[generate-storefront] No JSON found in response:', rawText.slice(0, 200));
      return NextResponse.json({ error: 'AI failed to return valid JSON' }, { status: 500 });
    }

    let storefrontConfig: StorefrontConfig;
    try {
      storefrontConfig = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.error('[generate-storefront] JSON parse error:', parseErr);
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
    }

    if (storeId) {
      await db.collection('stores').doc(storeId).update({
        storefrontConfig,
        storefrontGeneratedAt: new Date(),
      });
    }

    return NextResponse.json({ config: storefrontConfig });
  } catch (error: any) {
    console.error('[generate-storefront]', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
