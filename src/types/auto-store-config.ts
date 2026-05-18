export type AutoStoreSectionType =
  | 'categories'
  | 'products'
  | 'about'
  | 'tracking'
  | 'help'
  | 'faq';

export type AutoStorePublishStatus =
  | 'ready_to_publish'
  | 'needs_vendor_input'
  | 'draft';

export interface AutoStoreContact {
  email: string;
  phone: string;
  whatsapp: string;
}

export interface AutoStoreVendorProfile {
  business_name: string;
  business_category: string;
  subcategory: string;
  language: string;
  currency: string;
  contact: AutoStoreContact;
  missing_fields: string[];
}

export interface AutoStoreBusinessIdentity {
  tagline: string;
  brand_voice: string;
  short_description: string;
  long_description: string;
  trust_message: string;
  customer_promise: string;
  visual_direction: string;
}

export interface AutoStoreColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
}

export interface AutoStoreTypography {
  heading_style: string;
  body_style: string;
}

export interface AutoStoreTheme {
  theme_name: string;
  theme_category: string;
  color_palette: AutoStoreColorPalette;
  typography: AutoStoreTypography;
  button_style: string;
  card_style: string;
  layout_style: string;
}

export interface AutoStoreHero {
  headline: string;
  subheadline: string;
  primary_cta: string;
  secondary_cta: string;
  visual_direction: string;
}

export interface AutoStoreSection {
  section_name: string;
  section_type: AutoStoreSectionType;
  headline: string;
  description: string;
  cta: string;
  editable: boolean;
}

export interface AutoStoreFooter {
  description: string;
  links: string[];
  contact_summary: string;
  powered_by: string;
}

export interface AutoStoreStorefront {
  store_name: string;
  navigation: string[];
  hero: AutoStoreHero;
  sections: AutoStoreSection[];
  footer: AutoStoreFooter;
}

export interface AutoStoreCategory {
  name: string;
  description: string;
  display_order: number;
  image_prompt: string;
  editable: boolean;
}

export interface AutoStoreProduct {
  name: string;
  category: string;
  short_description: string;
  long_description: string;
  price: string;
  currency: string;
  variants: string[];
  image_prompt: string;
  seo_keywords: string[];
  is_ai_placeholder: boolean;
  is_vendor_confirmed: boolean;
}

export interface AutoStoreCheckout {
  recommended_flow: string;
  cart_enabled: boolean;
  whatsapp_order_enabled: boolean;
  checkout_cta: string;
  empty_cart_message: string;
  order_confirmation_message: string;
  payment_instruction_placeholder: string;
}

export interface AutoStoreDelivery {
  delivery_status: string;
  delivery_options: string[];
  estimated_delivery_message: string;
  pickup_message: string;
  delivery_faq: string[];
  missing_delivery_fields: string[];
}

export interface AutoStoreSEO {
  page_title: string;
  meta_description: string;
  category_keywords: string[];
  product_keywords: string[];
  social_share_title: string;
  social_share_description: string;
}

export interface AutoStoreMarketing {
  launch_announcement: string;
  whatsapp_broadcast: string;
  instagram_caption: string;
  facebook_caption: string;
  promo_banner_text: string;
  customer_review_request: string;
  first_week_growth_suggestions: string[];
}

export interface AutoStoreVendorDashboard {
  store_completion_score: number;
  onboarding_checklist: string[];
  missing_setup_items: string[];
  recommended_next_actions: string[];
}

export interface AutoStorePublishChecks {
  has_business_name: boolean;
  has_category: boolean;
  has_storefront: boolean;
  has_product_or_inquiry_flow: boolean;
  has_contact_method: boolean;
  has_currency: boolean;
  has_checkout_or_inquiry_path: boolean;
  has_delivery_or_pickup_info: boolean;
  has_payment_method_or_instruction: boolean;
  is_mobile_friendly: boolean;
  has_footer: boolean;
  has_seo_metadata: boolean;
  has_no_critical_policy_issue: boolean;
}

export interface AutoStorePublishReadiness {
  status: AutoStorePublishStatus;
  checks: AutoStorePublishChecks;
  required_vendor_inputs: string[];
}

export interface AutoStoreConfig {
  vendor_profile: AutoStoreVendorProfile;
  business_identity: AutoStoreBusinessIdentity;
  theme: AutoStoreTheme;
  storefront: AutoStoreStorefront;
  categories: AutoStoreCategory[];
  products: AutoStoreProduct[];
  checkout: AutoStoreCheckout;
  delivery: AutoStoreDelivery;
  seo: AutoStoreSEO;
  marketing: AutoStoreMarketing;
  vendor_dashboard: AutoStoreVendorDashboard;
  publish_readiness: AutoStorePublishReadiness;
}
