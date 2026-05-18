'use client';

import { useStore } from '@/context/store-context';
import {
  Star, Truck, ShieldCheck, MessageCircle, Tag, BadgeCheck,
  Leaf, Zap, PackageSearch, Clock, Award, Users,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type IconName = 'Star' | 'Truck' | 'ShieldCheck' | 'MessageCircle' | 'Tag' | 'BadgeCheck'
  | 'Leaf' | 'Zap' | 'PackageSearch' | 'Clock' | 'Award' | 'Users';

interface Feature {
  icon: IconName;
  title: string;
  desc: string;
}

interface FeatureConfig {
  heading: string;
  subheading: string;
  features: Feature[];
}

const ICON_MAP: Record<IconName, React.ElementType> = {
  Star, Truck, ShieldCheck, MessageCircle, Tag, BadgeCheck,
  Leaf, Zap, PackageSearch, Clock, Award, Users,
};

// ─── Category configs ─────────────────────────────────────────────────────────

const FEATURES: Record<string, FeatureConfig> = {
  fashion: {
    heading: 'Why Shop With Us',
    subheading: 'Style that speaks for itself — service that keeps you coming back.',
    features: [
      { icon: 'Award',          title: 'Curated Collections',   desc: 'Handpicked styles from trending designers and trusted brands.' },
      { icon: 'Truck',          title: 'Nationwide Delivery',   desc: 'Reliable shipping with real-time tracking to your door.' },
      { icon: 'ShieldCheck',    title: 'Secure Checkout',       desc: 'Multiple payment options with full fraud protection built in.' },
      { icon: 'MessageCircle',  title: 'Style Support',         desc: 'Our team helps you find the perfect look for any occasion.' },
      { icon: 'Tag',            title: 'Best Prices',           desc: 'Fashion-forward picks at prices you will love.' },
      { icon: 'BadgeCheck',     title: 'Verified Authentic',    desc: 'Every item sourced and verified for authenticity and quality.' },
    ],
  },
  food: {
    heading: 'Why Order With Us',
    subheading: 'Fresh flavours, fast delivery, and food you can trust every time.',
    features: [
      { icon: 'Leaf',           title: 'Fresh Ingredients',     desc: 'Sourced fresh daily from trusted local suppliers and farms.' },
      { icon: 'Zap',            title: 'Same-Day Delivery',     desc: 'Food prepared and delivered to your door — fast.' },
      { icon: 'ShieldCheck',    title: 'Hygiene Certified',     desc: 'We meet the highest food safety and hygiene standards.' },
      { icon: 'PackageSearch',  title: 'Order Tracking',        desc: 'Real-time updates from kitchen to your doorstep.' },
      { icon: 'Tag',            title: 'Fair Pricing',          desc: 'Great meals and groceries without breaking the bank.' },
      { icon: 'Star',           title: 'Chef Approved',         desc: 'Every dish crafted with skill, care, and quality ingredients.' },
    ],
  },
  beauty: {
    heading: 'Why Shop With Us',
    subheading: 'Authentic beauty products — tested, trusted, and delivered with care.',
    features: [
      { icon: 'BadgeCheck',     title: '100% Authentic',        desc: 'Genuine products sourced directly from trusted global brands.' },
      { icon: 'ShieldCheck',    title: 'Skin Safe',             desc: 'All products vetted and dermatologist approved.' },
      { icon: 'Truck',          title: 'Careful Delivery',      desc: 'Packaged securely and shipped fast to your door.' },
      { icon: 'MessageCircle',  title: 'Beauty Experts',        desc: 'Our team is ready to answer any beauty question you have.' },
      { icon: 'Tag',            title: 'Best Deals',            desc: 'Regular discounts and bundles on your favourite brands.' },
      { icon: 'Star',           title: 'Top Rated',             desc: 'Loved by thousands of satisfied customers nationwide.' },
    ],
  },
  electronics: {
    heading: 'Why Shop With Us',
    subheading: 'Genuine tech, expert advice, and fast delivery — every single time.',
    features: [
      { icon: 'BadgeCheck',     title: 'Official Products',     desc: 'Genuine items with manufacturer codes and full warranty.' },
      { icon: 'Zap',            title: 'Fast Dispatch',         desc: 'Quick order processing and nationwide shipping.' },
      { icon: 'ShieldCheck',    title: 'Secure Payments',       desc: 'Transactions encrypted end-to-end. Shop with confidence.' },
      { icon: 'MessageCircle',  title: 'Tech Support',          desc: 'Expert help for any technical question before or after purchase.' },
      { icon: 'Tag',            title: 'Best Prices',           desc: 'Competitive pricing with regular deals and cashback offers.' },
      { icon: 'Award',          title: 'Warranty Included',     desc: 'Every product comes with a valid manufacturer warranty.' },
    ],
  },
  furniture: {
    heading: 'Why Shop With Us',
    subheading: 'Premium furniture crafted to last — delivered and installed with care.',
    features: [
      { icon: 'Star',           title: 'Premium Quality',       desc: 'Solid materials and expert craftsmanship that stand the test of time.' },
      { icon: 'Truck',          title: 'White-Glove Delivery',  desc: 'Careful handling and delivery right into your room of choice.' },
      { icon: 'ShieldCheck',    title: '30-Day Returns',        desc: 'Easy returns if a piece is not the right fit for your space.' },
      { icon: 'MessageCircle',  title: 'Interior Advice',       desc: 'Our team helps you choose pieces that match your vision.' },
      { icon: 'Tag',            title: 'Fair Pricing',          desc: 'Premium furniture at prices that will not break your budget.' },
      { icon: 'BadgeCheck',     title: 'Verified Craftsmanship', desc: 'Every piece passes our rigorous quality inspection.' },
    ],
  },
  groceries: {
    heading: 'Why Shop With Us',
    subheading: 'Farm-fresh groceries delivered fast — quality you can taste in every bite.',
    features: [
      { icon: 'Leaf',           title: 'Farm Fresh',            desc: 'Produce sourced directly from trusted local farms every day.' },
      { icon: 'Zap',            title: 'Same-Day Delivery',     desc: 'Groceries at your door within hours of placing your order.' },
      { icon: 'BadgeCheck',     title: 'Quality Checked',       desc: 'Every item inspected for freshness before it is dispatched.' },
      { icon: 'PackageSearch',  title: 'Order Tracking',        desc: 'Know exactly where your order is and when it will arrive.' },
      { icon: 'Tag',            title: 'Fair Prices',           desc: 'Best prices on everyday essentials — always.' },
      { icon: 'ShieldCheck',    title: 'Hygiene Certified',     desc: 'Packed under strict hygiene and food safety protocols.' },
    ],
  },
  services: {
    heading: 'Why Work With Us',
    subheading: 'Expert services, transparent pricing, and satisfaction guaranteed.',
    features: [
      { icon: 'Users',          title: 'Expert Team',           desc: 'Experienced professionals with proven track records.' },
      { icon: 'Clock',          title: 'Flexible Scheduling',   desc: 'Book a time that works perfectly for your schedule.' },
      { icon: 'BadgeCheck',     title: 'Satisfaction Guaranteed', desc: 'We stand 100% behind every service we deliver.' },
      { icon: 'Tag',            title: 'Transparent Pricing',   desc: 'Clear quotes upfront — no hidden fees, ever.' },
      { icon: 'Zap',            title: 'Fast Response',         desc: 'We respond to every enquiry within the hour.' },
      { icon: 'ShieldCheck',    title: 'Fully Verified',        desc: 'Every provider background-checked for your peace of mind.' },
    ],
  },
};

const DEFAULT: FeatureConfig = {
  heading: 'Products & Services',
  subheading: 'Everything you need, sourced and delivered with care.',
  features: [
    { icon: 'Star',           title: 'Quality Products',      desc: 'Handpicked imports sourced from trusted global suppliers.' },
    { icon: 'Truck',          title: 'Fast Delivery',         desc: 'Reliable shipping with real-time tracking to your door.' },
    { icon: 'ShieldCheck',    title: 'Secure Payments',       desc: 'Multiple payment options with fraud protection built in.' },
    { icon: 'MessageCircle',  title: 'Customer Support',      desc: 'Dedicated support team available when you need help.' },
    { icon: 'Tag',            title: 'Best Prices',           desc: 'Competitive pricing with regular deals and discounts.' },
    { icon: 'BadgeCheck',     title: 'Verified Sellers',      desc: 'Every vendor is verified for quality and reliability.' },
  ],
};

function resolveConfig(category?: string): FeatureConfig {
  if (!category) return DEFAULT;
  const cat = category.toLowerCase().trim();
  for (const [key, config] of Object.entries(FEATURES)) {
    if (cat.includes(key)) return config;
  }
  return DEFAULT;
}

// ─── Icon colour palette ───────────────────────────────────────────────────────
// Cycles through 6 distinct accent colours for visual variety
const ICON_COLOURS = [
  { bg: 'bg-primary/10',    text: 'text-primary' },
  { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' },
  { bg: 'bg-amber-500/10',   text: 'text-amber-600  dark:text-amber-400' },
  { bg: 'bg-blue-500/10',    text: 'text-blue-600   dark:text-blue-400' },
  { bg: 'bg-rose-500/10',    text: 'text-rose-600   dark:text-rose-400' },
  { bg: 'bg-violet-500/10',  text: 'text-violet-600 dark:text-violet-400' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function StoreFeaturesSection() {
  const { store } = useStore();
  const { heading, subheading, features } = resolveConfig(store?.category);

  return (
    <section className="py-16 md:py-20 bg-secondary/30 border-t">
      <div className="container mx-auto px-4 md:px-6">

        {/* Header */}
        <div className="text-center mb-12 md:mb-14">
          <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-2">Why choose us</p>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">{heading}</h2>
          <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed">{subheading}</p>
        </div>

        {/* Feature grid — 2 cols mobile, 3 cols desktop */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
          {features.map((feature, i) => {
            const Icon = ICON_MAP[feature.icon];
            const colour = ICON_COLOURS[i % ICON_COLOURS.length];
            return (
              <div
                key={i}
                className="rounded-2xl border bg-card p-5 md:p-6 flex flex-col gap-3 hover:shadow-md transition-shadow"
              >
                <div className={`h-11 w-11 rounded-xl ${colour.bg} flex items-center justify-center shrink-0`}>
                  <Icon className={`h-5 w-5 ${colour.text}`} />
                </div>
                <div>
                  <p className="font-semibold text-sm md:text-base mb-1">{feature.title}</p>
                  <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
