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
  | 'draft_only'
  | 'blocked_for_review';

export type AutoStorePaymentStatus =
  | 'complete'
  | 'needs_vendor_input'
  | 'draft'
  | 'blocked';

export type AutoStorePolicySafetyStatus =
  | 'passed'
  | 'warning'
  | 'blocked'
  | 'needs_review';

// ─── Master Meta ────────────────────────────────────────────────────────────

export interface AutoStoreMasterMeta {
  agent_name: string;
  mode: string;
  selected_category: string;
  selected_subcategory: string;
  theme_selected: string;
  theme_reason: string;
  data_sources_used: string[];
  placeholders_created: boolean;
  requires_vendor_confirmation: boolean;
  requires_admin_review: boolean;
}

// ─── Vendor Profile ─────────────────────────────────────────────────────────

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

// ─── Business Identity ───────────────────────────────────────────────────────

export interface AutoStoreBusinessIdentity {
  store_tagline: string;
  brand_voice: string;
  short_description: string;
  long_description: string;
  customer_promise: string;
  trust_message: string;
  about_section: string;
  recommended_logo_style: string;
  recommended_color_mood: string;
  editable: boolean;
}

// ─── Vendor Writeups ─────────────────────────────────────────────────────────

export interface AutoStoreVendorWriteups {
  homepage_intro: string;
  about_us: string;
  our_story: string;
  brand_mission: string;
  brand_values: string[];
  why_shop_with_us: string[];
  our_promise: string;
  customer_welcome_message: string;
  trust_message: string;
  quality_message: string;
  delivery_message: string;
  payment_assurance_message: string;
  customer_support_message: string;
  thank_you_message: string;
  short_store_bio: string;
  footer_description: string;
  editable: boolean;
  placeholder_note: string;
}

// ─── Theme ───────────────────────────────────────────────────────────────────

export interface AutoStoreColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
}

export interface AutoStoreTypography {
  heading_style: string;
  body_style: string;
  accent_style: string;
}

export interface AutoStoreTheme {
  theme_name: string;
  best_for: string;
  color_palette: AutoStoreColorPalette;
  typography: AutoStoreTypography;
  button_style: string;
  card_style: string;
  layout_style: string;
  hero_style: string;
  image_direction: string;
  customer_experience_direction: string;
  editable: boolean;
}

// ─── Storefront ──────────────────────────────────────────────────────────────

export interface AutoStoreHero {
  headline: string;
  subheadline: string;
  primary_cta: string;
  secondary_cta: string;
  banner_image_prompt: string;
  dynamic_presentation: string;
}

export interface AutoStoreSection {
  section_name: string;
  section_type: AutoStoreSectionType;
  headline: string;
  description: string;
  cta: string;
  display_order: number;
  dynamic_behavior: string;
  editable: boolean;
}

export interface AutoStoreHeader {
  logo_area: string;
  menu_items: string[];
  search_enabled: boolean;
  cart_or_inquiry_button: string;
}

export interface AutoStoreTrustSection {
  headline: string;
  trust_points: string[];
  note: string;
}

export interface AutoStoreFooter {
  description: string;
  links: string[];
  contact_summary: string;
  social_links_placeholder: string[];
  powered_by: string;
}

export interface AutoStoreStorefront {
  store_name: string;
  layout_type: string;
  navigation: string[];
  header: AutoStoreHeader;
  hero: AutoStoreHero;
  sections: AutoStoreSection[];
  trust_section: AutoStoreTrustSection;
  footer: AutoStoreFooter;
  editable: boolean;
}

// ─── Dynamic Presentation ────────────────────────────────────────────────────

export interface AutoStoreDynamicPresentation {
  hero_banner_style: string;
  category_card_style: string;
  product_card_style: string;
  featured_carousel_style: string;
  promo_banner_style: string;
  icon_style: string;
  button_animation_suggestion: string;
  mobile_layout_behavior: string;
  empty_state_design: string;
  loading_state_message: string;
  trust_badges_placeholder: string[];
}

// ─── Categories & Products ───────────────────────────────────────────────────

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
  sku: string;
  stock_status: string;
  image_prompt: string;
  customer_benefit: string;
  seo_keywords: string[];
  missing_fields: string[];
  is_ai_placeholder: boolean;
  is_vendor_confirmed: boolean;
  editable: boolean;
}

// ─── Checkout ────────────────────────────────────────────────────────────────

export interface AutoStoreCheckout {
  recommended_flow: string;
  cart_enabled: boolean;
  whatsapp_order_enabled: boolean;
  booking_enabled: boolean;
  preorder_enabled: boolean;
  checkout_cta: string;
  empty_cart_message: string;
  order_confirmation_message: string;
  missing_checkout_fields: string[];
}

// ─── Payments ────────────────────────────────────────────────────────────────

export interface AutoStorePayments {
  payment_status: AutoStorePaymentStatus;
  methods: string[];
  payment_instruction_placeholder: string;
  missing_payment_fields: string[];
}

// ─── Delivery ────────────────────────────────────────────────────────────────

export interface AutoStoreDelivery {
  delivery_status: string;
  delivery_options: string[];
  estimated_delivery_message: string;
  pickup_message: string;
  delivery_faq: string[];
  missing_delivery_fields: string[];
}

// ─── Customer Communication ──────────────────────────────────────────────────

export interface AutoStoreCustomerCommunication {
  order_confirmation: string;
  payment_instruction: string;
  delivery_update: string;
  product_inquiry_reply: string;
  support_reply: string;
  whatsapp_templates: string[];
  email_templates: string[];
}

// ─── Support ─────────────────────────────────────────────────────────────────

export interface AutoStoreFAQItem {
  question: string;
  answer: string;
}

export interface AutoStoreSupport {
  faq: AutoStoreFAQItem[];
  support_policy: string;
  escalation_note: string;
}

// ─── SEO ─────────────────────────────────────────────────────────────────────

export interface AutoStoreSEO {
  homepage_title: string;
  homepage_meta_description: string;
  category_keywords: string[];
  product_keywords: string[];
  image_alt_text_suggestions: string[];
  local_seo_text: string;
  social_share_title: string;
  social_share_description: string;
}

// ─── Marketing ───────────────────────────────────────────────────────────────

export interface AutoStoreMarketing {
  launch_announcement: string;
  whatsapp_broadcast: string;
  instagram_caption: string;
  facebook_caption: string;
  promo_banner_text: string;
  first_week_sales_ideas: string[];
  customer_review_request: string;
  featured_product_message: string;
}

// ─── Vendor Dashboard ────────────────────────────────────────────────────────

export interface AutoStoreVendorDashboard {
  store_completion_score: number;
  onboarding_checklist: string[];
  missing_setup_items: string[];
  recommended_next_actions: string[];
  product_improvement_alerts: string[];
  payment_setup_alerts: string[];
  delivery_setup_alerts: string[];
  seo_alerts: string[];
  dashboard_notifications: string[];
}

// ─── Policy Safety ───────────────────────────────────────────────────────────

export interface AutoStorePolicySafety {
  status: AutoStorePolicySafetyStatus;
  flags: string[];
  safe_edit_suggestions: string[];
}

// ─── Publish Readiness ───────────────────────────────────────────────────────

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

// ─── Admin Review ────────────────────────────────────────────────────────────

export interface AutoStoreAdminReview {
  review_required: boolean;
  reason: string;
  risk_flags: string[];
  recommended_admin_action: string;
}

// ─── Final Response ──────────────────────────────────────────────────────────

export interface AutoStoreFinalResponse {
  summary: string;
  actions_completed: string[];
  actions_requiring_vendor_confirmation: string[];
  next_best_action: string;
}

// ─── Top-level Config ────────────────────────────────────────────────────────

export interface AutoStoreConfig {
  sellquic_master_store_creation: AutoStoreMasterMeta;
  vendor_profile: AutoStoreVendorProfile;
  business_identity: AutoStoreBusinessIdentity;
  vendor_writeups: AutoStoreVendorWriteups;
  theme: AutoStoreTheme;
  storefront: AutoStoreStorefront;
  dynamic_presentation: AutoStoreDynamicPresentation;
  categories: AutoStoreCategory[];
  products: AutoStoreProduct[];
  checkout: AutoStoreCheckout;
  payments: AutoStorePayments;
  delivery: AutoStoreDelivery;
  customer_communication: AutoStoreCustomerCommunication;
  support: AutoStoreSupport;
  seo: AutoStoreSEO;
  marketing: AutoStoreMarketing;
  vendor_dashboard: AutoStoreVendorDashboard;
  policy_safety: AutoStorePolicySafety;
  publish_readiness: AutoStorePublishReadiness;
  admin_review_summary: AutoStoreAdminReview;
  final_response: AutoStoreFinalResponse;
}
