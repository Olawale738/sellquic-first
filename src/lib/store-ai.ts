import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AutoStoreConfig, AutoStoreSection } from '@/types/auto-store-config';
import type { StorefrontConfig } from '@/types/storefront-config';

export interface GenerateAutoStoreParams {
  businessName: string;
  category: string;
  subcategory?: string;
  email?: string;
  phone?: string;
}

export interface GenerateAutoStoreResult {
  storefrontConfig: Partial<StorefrontConfig>;
  autoStoreConfig: AutoStoreConfig;
}

const SYSTEM_INSTRUCTION =
  'You are SellQuic Auto Store Builder AI. Transform vendor signup data into a complete, professional, category-specific ecommerce store configuration. Return ONLY valid JSON — no markdown, no code blocks, no explanation.';

function buildUserPrompt(p: GenerateAutoStoreParams): string {
  const { businessName, category, subcategory, email = '', phone = '' } = p;
  const sub = subcategory || category;

  return `Build a complete store for this vendor. Every field must have real, professional, persuasive content — NEVER use Lorem ipsum. All prices must be "PLACEHOLDER". Mark all AI-generated product data clearly.

Vendor:
- Business Name: ${businessName}
- Category: ${category}
- Subcategory: ${sub}
- Email: ${email}
- Phone/WhatsApp: ${phone}
- Currency: GHS
- Language: English

Return this exact JSON structure with all fields filled:

{
  "vendor_profile": {
    "business_name": "${businessName}",
    "business_category": "${category}",
    "subcategory": "${sub}",
    "language": "English",
    "currency": "GHS",
    "contact": { "email": "${email}", "phone": "${phone}", "whatsapp": "${phone}" },
    "missing_fields": []
  },
  "business_identity": {
    "tagline": "",
    "brand_voice": "",
    "short_description": "",
    "long_description": "",
    "trust_message": "",
    "customer_promise": "",
    "visual_direction": ""
  },
  "theme": {
    "theme_name": "",
    "theme_category": "",
    "color_palette": { "primary": "", "secondary": "", "accent": "", "background": "", "text": "" },
    "typography": { "heading_style": "", "body_style": "" },
    "button_style": "",
    "card_style": "",
    "layout_style": ""
  },
  "storefront": {
    "store_name": "${businessName}",
    "navigation": ["Shop", "Track Order", "Contact"],
    "hero": {
      "headline": "",
      "subheadline": "",
      "primary_cta": "",
      "secondary_cta": "Track My Order",
      "visual_direction": ""
    },
    "sections": [
      { "section_name": "Featured Categories", "section_type": "categories", "headline": "", "description": "", "cta": "Browse All", "editable": true },
      { "section_name": "New Arrivals", "section_type": "products", "headline": "", "description": "", "cta": "Shop Now", "editable": true },
      { "section_name": "About Us", "section_type": "about", "headline": "", "description": "", "cta": "", "editable": true },
      { "section_name": "Order Tracking", "section_type": "tracking", "headline": "", "description": "", "cta": "Track Order", "editable": true },
      { "section_name": "Help & Support", "section_type": "help", "headline": "", "description": "", "cta": "Contact Us", "editable": true },
      { "section_name": "FAQ", "section_type": "faq", "headline": "", "description": "", "cta": "", "editable": true }
    ],
    "footer": { "description": "", "links": ["Shop", "Track Order", "Contact", "About Us"], "contact_summary": "", "powered_by": "SellQuic" }
  },
  "categories": [
    { "name": "", "description": "", "display_order": 1, "image_prompt": "", "editable": true },
    { "name": "", "description": "", "display_order": 2, "image_prompt": "", "editable": true },
    { "name": "", "description": "", "display_order": 3, "image_prompt": "", "editable": true },
    { "name": "", "description": "", "display_order": 4, "image_prompt": "", "editable": true },
    { "name": "", "description": "", "display_order": 5, "image_prompt": "", "editable": true }
  ],
  "products": [
    { "name": "", "category": "", "short_description": "", "long_description": "", "price": "PLACEHOLDER", "currency": "GHS", "variants": [], "image_prompt": "", "seo_keywords": [], "is_ai_placeholder": true, "is_vendor_confirmed": false },
    { "name": "", "category": "", "short_description": "", "long_description": "", "price": "PLACEHOLDER", "currency": "GHS", "variants": [], "image_prompt": "", "seo_keywords": [], "is_ai_placeholder": true, "is_vendor_confirmed": false },
    { "name": "", "category": "", "short_description": "", "long_description": "", "price": "PLACEHOLDER", "currency": "GHS", "variants": [], "image_prompt": "", "seo_keywords": [], "is_ai_placeholder": true, "is_vendor_confirmed": false },
    { "name": "", "category": "", "short_description": "", "long_description": "", "price": "PLACEHOLDER", "currency": "GHS", "variants": [], "image_prompt": "", "seo_keywords": [], "is_ai_placeholder": true, "is_vendor_confirmed": false }
  ],
  "checkout": {
    "recommended_flow": "",
    "cart_enabled": true,
    "whatsapp_order_enabled": true,
    "checkout_cta": "",
    "empty_cart_message": "",
    "order_confirmation_message": "",
    "payment_instruction_placeholder": ""
  },
  "delivery": {
    "delivery_status": "draft",
    "delivery_options": [],
    "estimated_delivery_message": "",
    "pickup_message": "",
    "delivery_faq": [],
    "missing_delivery_fields": ["delivery_zones", "delivery_fee", "dispatch_timeline"]
  },
  "seo": {
    "page_title": "",
    "meta_description": "",
    "category_keywords": [],
    "product_keywords": [],
    "social_share_title": "",
    "social_share_description": ""
  },
  "marketing": {
    "launch_announcement": "",
    "whatsapp_broadcast": "",
    "instagram_caption": "",
    "facebook_caption": "",
    "promo_banner_text": "",
    "customer_review_request": "",
    "first_week_growth_suggestions": []
  },
  "vendor_dashboard": {
    "store_completion_score": 65,
    "onboarding_checklist": [],
    "missing_setup_items": [],
    "recommended_next_actions": []
  },
  "publish_readiness": {
    "status": "needs_vendor_input",
    "checks": {
      "has_business_name": true,
      "has_category": true,
      "has_storefront": true,
      "has_product_or_inquiry_flow": true,
      "has_contact_method": true,
      "has_currency": true,
      "has_checkout_or_inquiry_path": true,
      "has_delivery_or_pickup_info": false,
      "has_payment_method_or_instruction": false,
      "is_mobile_friendly": true,
      "has_footer": true,
      "has_seo_metadata": true,
      "has_no_critical_policy_issue": true
    },
    "required_vendor_inputs": ["payment_method", "delivery_zones", "product_images", "real_pricing"]
  }
}

Category rules:
- theme_category must be one of: fashion, food, beauty, electronics, furniture, groceries, services, general
- Fashion: elegant boutique tone, size/color variants, featured collections
- Food: warm appetizing tone, menu sections, operating hours hints, WhatsApp ordering
- Beauty: clean luxury tone, product benefits, usage notes, skin/hair categories
- Electronics: tech specs tone, warranty placeholders, comparison-style descriptions
- Furniture: calm spacious tone, room-based categories, material/size placeholders
- Groceries: fresh practical tone, fast-shopping layout, reorder friendly
- Services: professional tone, service packages, booking/inquiry CTA
- categories: exactly 5 entries specific to the vendor's category
- products: exactly 4 realistic AI placeholder products for the category
- onboarding_checklist: exactly 6 specific actionable steps for this vendor
- marketing content: ready to copy-paste immediately
- Return ONLY the JSON object`;
}

function findSection(sections: AutoStoreSection[], type: AutoStoreSection['section_type']): AutoStoreSection | undefined {
  return sections?.find((s) => s.section_type === type);
}

function extractStorefrontConfig(cfg: AutoStoreConfig): Partial<StorefrontConfig> {
  const aboutSection = findSection(cfg.storefront?.sections, 'about');
  const helpSection = findSection(cfg.storefront?.sections, 'help');
  const trackingSection = findSection(cfg.storefront?.sections, 'tracking');

  return {
    theme_name: cfg.theme?.theme_name ?? '',
    theme_category: (cfg.theme?.theme_category as StorefrontConfig['theme_category']) ?? 'general',
    color_palette: cfg.theme?.color_palette as StorefrontConfig['color_palette'],
    typography: {
      heading_font_style: cfg.theme?.typography?.heading_style ?? '',
      body_font_style: cfg.theme?.typography?.body_style ?? '',
    },
    navigation: cfg.storefront?.navigation ?? [],
    hero: {
      headline: cfg.storefront?.hero?.headline ?? '',
      subheadline: cfg.storefront?.hero?.subheadline ?? '',
      primary_cta: cfg.storefront?.hero?.primary_cta ?? '',
      secondary_cta: cfg.storefront?.hero?.secondary_cta ?? 'Track My Order',
      visual_direction: cfg.storefront?.hero?.visual_direction ?? '',
    },
    categories: cfg.categories?.map((c) => ({
      name: c.name,
      description: c.description,
      theme_style: '',
      editable: true as const,
    })) ?? [],
    featured_products: cfg.products?.map((p) => ({
      name: p.name,
      category: p.category,
      description: p.short_description,
      price_placeholder: p.price,
      image_prompt: p.image_prompt,
      variants: p.variants,
      editable: true as const,
    })) ?? [],
    cart: {
      empty_state: cfg.checkout?.empty_cart_message ?? '',
      subtotal_label: 'Subtotal',
      checkout_cta: cfg.checkout?.checkout_cta ?? 'Proceed to Checkout',
    },
    order_tracking: {
      headline: trackingSection?.headline ?? 'Track Your Order',
      description: trackingSection?.description ?? 'Enter your order reference to get a live status update.',
      input_placeholder: 'e.g. SQ-2024-00123',
      cta: trackingSection?.cta ?? 'Track Order',
    },
    help_section: {
      headline: helpSection?.headline ?? "Can't find what you're looking for?",
      description: helpSection?.description ?? 'Our team is ready to help.',
      cta: helpSection?.cta ?? 'Contact Us',
    },
    about_section: {
      headline: aboutSection?.headline ?? `About ${cfg.vendor_profile?.business_name ?? ''}`,
      description: aboutSection?.description ?? cfg.business_identity?.long_description ?? '',
    },
    contact_section: {
      email: cfg.vendor_profile?.contact?.email ?? '',
      phone: cfg.vendor_profile?.contact?.phone ?? '',
      location: '',
      whatsapp_enabled: true,
    },
    footer: {
      store_name: cfg.storefront?.store_name ?? '',
      description: cfg.storefront?.footer?.description ?? '',
      links: cfg.storefront?.footer?.links ?? [],
      copyright: `© ${new Date().getFullYear()} ${cfg.storefront?.store_name ?? ''}. All rights reserved.`,
      powered_by: 'SellQuic',
    },
    seo: {
      page_title: cfg.seo?.page_title ?? '',
      meta_description: cfg.seo?.meta_description ?? '',
      keywords: [...(cfg.seo?.category_keywords ?? []), ...(cfg.seo?.product_keywords ?? [])],
    },
    editable_fields: [],
    recommended_admin_controls: [],
    storefront_name: cfg.storefront?.store_name ?? '',
  };
}

export async function generateAutoStoreConfig(
  params: GenerateAutoStoreParams,
): Promise<GenerateAutoStoreResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[store-ai] GEMINI_API_KEY is not set');
    return null;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: buildUserPrompt(params) }] }],
      systemInstruction: SYSTEM_INSTRUCTION,
    });

    const raw = result.response.text().trim();
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      console.error('[store-ai] No JSON found in AI response');
      return null;
    }

    const autoStoreConfig: AutoStoreConfig = JSON.parse(match[0]);
    const storefrontConfig = extractStorefrontConfig(autoStoreConfig);

    return { storefrontConfig, autoStoreConfig };
  } catch (err) {
    console.error('[store-ai] generateAutoStoreConfig failed:', err);
    return null;
  }
}
