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
  'You are SellQuic Master Store Creation AI — the intelligent store creation engine inside SellQuic. ' +
  'Your job is to automatically create powerful, elegant, dynamic, category-based online stores for vendors immediately after signup. ' +
  'You must create premium, well-structured, professional, mobile-first, conversion-focused, and fully editable ecommerce stores based on the category selected by each vendor. ' +
  'Return ONLY valid JSON — no markdown, no code blocks, no explanation.';

function buildUserPrompt(p: GenerateAutoStoreParams): string {
  const { businessName, category, subcategory, email = '', phone = '' } = p;
  const sub = subcategory || category;

  return `You are SellQuic Master Store Creation AI. Create a complete, professional, category-specific master store for this vendor. Every field must have real, professional, persuasive, category-appropriate content — NEVER use Lorem ipsum or placeholder text for copywriting fields. All product prices must remain "PLACEHOLDER". Mark all AI-generated product data clearly with is_ai_placeholder: true.

Vendor details:
- Business Name: ${businessName}
- Category: ${category}
- Subcategory: ${sub}
- Email: ${email}
- Phone/WhatsApp: ${phone}
- Currency: GHS
- Language: English

Category rules:
- Fashion: elegant boutique tone, size/color variants, featured collections
- Food: warm appetizing tone, menu sections, WhatsApp ordering
- Beauty: clean luxury tone, product benefits, skin/hair categories
- Electronics: tech specs tone, warranty placeholders, comparison descriptions
- Furniture: calm spacious tone, room-based categories, material/size
- Groceries: fresh practical tone, fast-shopping layout, reorder friendly
- Services: professional tone, service packages, booking/inquiry CTA
- General: clean flexible marketplace style, mixed categories
- vendor_writeups must be warm, professional, category-appropriate — no fake claims
- support.faq: exactly 5 relevant Q&A pairs for the category
- products: exactly 4 realistic AI placeholder products with customer_benefit filled
- vendor_dashboard.onboarding_checklist: exactly 6 specific actionable steps

Fill in every "" value with real, professional, category-specific content. Return this exact JSON structure:

{
  "sellquic_master_store_creation": {
    "agent_name": "SellQuic Master Store Creation AI",
    "mode": "generate",
    "selected_category": "${category}",
    "selected_subcategory": "${sub}",
    "theme_selected": "",
    "theme_reason": "",
    "data_sources_used": ["vendor_signup_data"],
    "placeholders_created": true,
    "requires_vendor_confirmation": true,
    "requires_admin_review": false
  },
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
    "store_tagline": "",
    "brand_voice": "",
    "short_description": "",
    "long_description": "",
    "customer_promise": "",
    "trust_message": "",
    "about_section": "",
    "recommended_logo_style": "",
    "recommended_color_mood": "",
    "editable": true
  },
  "vendor_writeups": {
    "homepage_intro": "",
    "about_us": "",
    "our_story": "",
    "brand_mission": "",
    "brand_values": [],
    "why_shop_with_us": [],
    "our_promise": "",
    "customer_welcome_message": "",
    "trust_message": "",
    "quality_message": "",
    "delivery_message": "",
    "payment_assurance_message": "",
    "customer_support_message": "",
    "thank_you_message": "",
    "short_store_bio": "",
    "footer_description": "",
    "editable": true,
    "placeholder_note": "These write-ups are AI generated and should be reviewed by the vendor before publishing."
  },
  "theme": {
    "theme_name": "",
    "best_for": "",
    "color_palette": { "primary": "", "secondary": "", "accent": "", "background": "", "surface": "", "text": "" },
    "typography": { "heading_style": "", "body_style": "", "accent_style": "" },
    "button_style": "",
    "card_style": "",
    "layout_style": "",
    "hero_style": "",
    "image_direction": "",
    "customer_experience_direction": "",
    "editable": true
  },
  "storefront": {
    "store_name": "${businessName}",
    "layout_type": "",
    "navigation": ["Shop", "Track Order", "Contact"],
    "header": { "logo_area": "", "menu_items": [], "search_enabled": true, "cart_or_inquiry_button": "" },
    "hero": {
      "headline": "",
      "subheadline": "",
      "primary_cta": "",
      "secondary_cta": "Track My Order",
      "banner_image_prompt": "",
      "dynamic_presentation": ""
    },
    "sections": [
      { "section_name": "Featured Categories", "section_type": "categories", "headline": "", "description": "", "cta": "Browse All", "display_order": 1, "dynamic_behavior": "", "editable": true },
      { "section_name": "New Arrivals", "section_type": "products", "headline": "", "description": "", "cta": "Shop Now", "display_order": 2, "dynamic_behavior": "", "editable": true },
      { "section_name": "About Us", "section_type": "about", "headline": "", "description": "", "cta": "", "display_order": 3, "dynamic_behavior": "", "editable": true },
      { "section_name": "Order Tracking", "section_type": "tracking", "headline": "", "description": "", "cta": "Track Order", "display_order": 4, "dynamic_behavior": "", "editable": true },
      { "section_name": "Help & Support", "section_type": "help", "headline": "", "description": "", "cta": "Contact Us", "display_order": 5, "dynamic_behavior": "", "editable": true },
      { "section_name": "FAQ", "section_type": "faq", "headline": "", "description": "", "cta": "", "display_order": 6, "dynamic_behavior": "", "editable": true }
    ],
    "trust_section": { "headline": "", "trust_points": [], "note": "Trust points are placeholders unless confirmed by vendor" },
    "footer": { "description": "", "links": ["Shop", "Track Order", "Contact", "About Us"], "contact_summary": "", "social_links_placeholder": [], "powered_by": "SellQuic" },
    "editable": true
  },
  "dynamic_presentation": {
    "hero_banner_style": "",
    "category_card_style": "",
    "product_card_style": "",
    "featured_carousel_style": "",
    "promo_banner_style": "",
    "icon_style": "",
    "button_animation_suggestion": "",
    "mobile_layout_behavior": "",
    "empty_state_design": "",
    "loading_state_message": "",
    "trust_badges_placeholder": []
  },
  "categories": [
    { "name": "", "description": "", "display_order": 1, "image_prompt": "", "editable": true },
    { "name": "", "description": "", "display_order": 2, "image_prompt": "", "editable": true },
    { "name": "", "description": "", "display_order": 3, "image_prompt": "", "editable": true },
    { "name": "", "description": "", "display_order": 4, "image_prompt": "", "editable": true },
    { "name": "", "description": "", "display_order": 5, "image_prompt": "", "editable": true }
  ],
  "products": [
    { "name": "", "category": "", "short_description": "", "long_description": "", "price": "PLACEHOLDER", "currency": "GHS", "variants": [], "sku": "AI-001", "stock_status": "placeholder", "image_prompt": "", "customer_benefit": "", "seo_keywords": [], "missing_fields": ["price", "image", "stock"], "is_ai_placeholder": true, "is_vendor_confirmed": false, "editable": true },
    { "name": "", "category": "", "short_description": "", "long_description": "", "price": "PLACEHOLDER", "currency": "GHS", "variants": [], "sku": "AI-002", "stock_status": "placeholder", "image_prompt": "", "customer_benefit": "", "seo_keywords": [], "missing_fields": ["price", "image", "stock"], "is_ai_placeholder": true, "is_vendor_confirmed": false, "editable": true },
    { "name": "", "category": "", "short_description": "", "long_description": "", "price": "PLACEHOLDER", "currency": "GHS", "variants": [], "sku": "AI-003", "stock_status": "placeholder", "image_prompt": "", "customer_benefit": "", "seo_keywords": [], "missing_fields": ["price", "image", "stock"], "is_ai_placeholder": true, "is_vendor_confirmed": false, "editable": true },
    { "name": "", "category": "", "short_description": "", "long_description": "", "price": "PLACEHOLDER", "currency": "GHS", "variants": [], "sku": "AI-004", "stock_status": "placeholder", "image_prompt": "", "customer_benefit": "", "seo_keywords": [], "missing_fields": ["price", "image", "stock"], "is_ai_placeholder": true, "is_vendor_confirmed": false, "editable": true }
  ],
  "checkout": {
    "recommended_flow": "",
    "cart_enabled": true,
    "whatsapp_order_enabled": true,
    "booking_enabled": false,
    "preorder_enabled": false,
    "checkout_cta": "",
    "empty_cart_message": "",
    "order_confirmation_message": "",
    "missing_checkout_fields": []
  },
  "payments": {
    "payment_status": "draft",
    "methods": [],
    "payment_instruction_placeholder": "",
    "missing_payment_fields": ["bank_account", "payment_gateway", "mobile_money"]
  },
  "delivery": {
    "delivery_status": "draft",
    "delivery_options": [],
    "estimated_delivery_message": "",
    "pickup_message": "",
    "delivery_faq": [],
    "missing_delivery_fields": ["delivery_zones", "delivery_fee", "dispatch_timeline"]
  },
  "customer_communication": {
    "order_confirmation": "",
    "payment_instruction": "",
    "delivery_update": "",
    "product_inquiry_reply": "",
    "support_reply": "",
    "whatsapp_templates": [],
    "email_templates": []
  },
  "support": {
    "faq": [],
    "support_policy": "",
    "escalation_note": ""
  },
  "seo": {
    "homepage_title": "",
    "homepage_meta_description": "",
    "category_keywords": [],
    "product_keywords": [],
    "image_alt_text_suggestions": [],
    "local_seo_text": "",
    "social_share_title": "",
    "social_share_description": ""
  },
  "marketing": {
    "launch_announcement": "",
    "whatsapp_broadcast": "",
    "instagram_caption": "",
    "facebook_caption": "",
    "promo_banner_text": "",
    "first_week_sales_ideas": [],
    "customer_review_request": "",
    "featured_product_message": ""
  },
  "vendor_dashboard": {
    "store_completion_score": 65,
    "onboarding_checklist": [],
    "missing_setup_items": [],
    "recommended_next_actions": [],
    "product_improvement_alerts": [],
    "payment_setup_alerts": [],
    "delivery_setup_alerts": [],
    "seo_alerts": [],
    "dashboard_notifications": []
  },
  "policy_safety": { "status": "passed", "flags": [], "safe_edit_suggestions": [] },
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
  },
  "admin_review_summary": { "review_required": false, "reason": "", "risk_flags": [], "recommended_admin_action": "" },
  "final_response": { "summary": "", "actions_completed": [], "actions_requiring_vendor_confirmation": [], "next_best_action": "" }
}

Return ONLY the JSON object above with all "" values filled in with real, professional, category-specific content.`;
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
    theme_category: (cfg.sellquic_master_store_creation?.selected_category?.toLowerCase() as StorefrontConfig['theme_category']) ?? 'general',
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
      visual_direction: cfg.storefront?.hero?.dynamic_presentation ?? '',
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
      page_title: cfg.seo?.homepage_title ?? '',
      meta_description: cfg.seo?.homepage_meta_description ?? '',
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
