export type BusinessCategory =
  | 'fashion'
  | 'food'
  | 'beauty'
  | 'electronics'
  | 'furniture'
  | 'groceries'
  | 'services'
  | 'general';

export interface StorefrontColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
}

export interface StorefrontTypography {
  heading_font_style: string;
  body_font_style: string;
}

export interface StorefrontHero {
  headline: string;
  subheadline: string;
  primary_cta: string;
  secondary_cta: string;
  visual_direction: string;
}

export interface StorefrontCategory {
  name: string;
  description: string;
  theme_style: string;
  editable: true;
}

export interface StorefrontProduct {
  name: string;
  category: string;
  description: string;
  price_placeholder: string;
  image_prompt: string;
  variants: string[];
  editable: true;
}

export interface CatalogLayout {
  style: string;
  filters: string[];
  sorting_options: string[];
  product_card_style: string;
}

export interface CartConfig {
  empty_state: string;
  subtotal_label: string;
  checkout_cta: string;
}

export interface OrderTrackingConfig {
  headline: string;
  description: string;
  input_placeholder: string;
  cta: string;
}

export interface HelpSection {
  headline: string;
  description: string;
  cta: string;
}

export interface AboutSection {
  headline: string;
  description: string;
}

export interface ContactSection {
  email: string;
  phone: string;
  location: string;
  whatsapp_enabled: boolean;
}

export interface FooterConfig {
  store_name: string;
  description: string;
  links: string[];
  copyright: string;
  powered_by: 'SellQuic';
}

export interface StorefrontSEO {
  page_title: string;
  meta_description: string;
  keywords: string[];
}

export interface StorefrontConfig {
  storefront_name: string;
  theme_name: string;
  theme_category: BusinessCategory;
  color_palette: StorefrontColorPalette;
  typography: StorefrontTypography;
  navigation: string[];
  hero: StorefrontHero;
  categories: StorefrontCategory[];
  featured_products: StorefrontProduct[];
  catalog_layout: CatalogLayout;
  cart: CartConfig;
  order_tracking: OrderTrackingConfig;
  help_section: HelpSection;
  about_section: AboutSection;
  contact_section: ContactSection;
  footer: FooterConfig;
  editable_fields: string[];
  recommended_admin_controls: string[];
  seo: StorefrontSEO;
}

export interface VendorSignupData {
  vendor_name: string;
  business_category: string;
  subcategory?: string;
  products?: string;
  location?: string;
  email?: string;
  phone?: string;
  business_description?: string;
  target_customers?: string;
  price_range?: string;
  preferences?: string;
  uploaded_assets?: string;
}
