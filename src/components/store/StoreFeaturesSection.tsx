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
      { icon: 'Award',          title: 'Curated Collections',    desc: 'Handpicked styles from trending designers and trusted brands.' },
      { icon: 'Truck',          title: 'Nationwide Delivery',    desc: 'Reliable shipping with real-time tracking to your door.' },
      { icon: 'ShieldCheck',    title: 'Secure Checkout',        desc: 'Multiple payment options with full fraud protection built in.' },
      { icon: 'MessageCircle',  title: 'Style Support',          desc: 'Our team helps you find the perfect look for any occasion.' },
      { icon: 'Tag',            title: 'Best Prices',            desc: 'Fashion-forward picks at prices you will love.' },
      { icon: 'BadgeCheck',     title: 'Verified Authentic',     desc: 'Every item sourced and verified for authenticity and quality.' },
    ],
  },
  food: {
    heading: 'Why Order With Us',
    subheading: 'Fresh flavours, fast delivery, and food you can trust every time.',
    features: [
      { icon: 'Leaf',           title: 'Fresh Ingredients',      desc: 'Sourced fresh daily from trusted local suppliers and farms.' },
      { icon: 'Zap',            title: 'Same-Day Delivery',      desc: 'Food prepared and delivered to your door — fast.' },
      { icon: 'ShieldCheck',    title: 'Hygiene Certified',      desc: 'We meet the highest food safety and hygiene standards.' },
      { icon: 'PackageSearch',  title: 'Order Tracking',         desc: 'Real-time updates from kitchen to your doorstep.' },
      { icon: 'Tag',            title: 'Fair Pricing',           desc: 'Great meals and groceries without breaking the bank.' },
      { icon: 'Star',           title: 'Chef Approved',          desc: 'Every dish crafted with skill, care, and quality ingredients.' },
    ],
  },
  beauty: {
    heading: 'Why Shop With Us',
    subheading: 'Authentic beauty products — tested, trusted, and delivered with care.',
    features: [
      { icon: 'BadgeCheck',     title: '100% Authentic',         desc: 'Genuine products sourced directly from trusted global brands.' },
      { icon: 'ShieldCheck',    title: 'Skin Safe',              desc: 'All products vetted and dermatologist approved.' },
      { icon: 'Truck',          title: 'Careful Delivery',       desc: 'Packaged securely and shipped fast to your door.' },
      { icon: 'MessageCircle',  title: 'Beauty Experts',         desc: 'Our team is ready to answer any beauty question you have.' },
      { icon: 'Tag',            title: 'Best Deals',             desc: 'Regular discounts and bundles on your favourite brands.' },
      { icon: 'Star',           title: 'Top Rated',              desc: 'Loved by thousands of satisfied customers nationwide.' },
    ],
  },
  electronics: {
    heading: 'Why Shop With Us',
    subheading: 'Genuine tech, expert advice, and fast delivery — every single time.',
    features: [
      { icon: 'BadgeCheck',     title: 'Official Products',      desc: 'Genuine items with manufacturer codes and full warranty.' },
      { icon: 'Zap',            title: 'Fast Dispatch',          desc: 'Quick order processing and nationwide shipping.' },
      { icon: 'ShieldCheck',    title: 'Secure Payments',        desc: 'Transactions encrypted end-to-end. Shop with confidence.' },
      { icon: 'MessageCircle',  title: 'Tech Support',           desc: 'Expert help for any technical question before or after purchase.' },
      { icon: 'Tag',            title: 'Best Prices',            desc: 'Competitive pricing with regular deals and cashback offers.' },
      { icon: 'Award',          title: 'Warranty Included',      desc: 'Every product comes with a valid manufacturer warranty.' },
    ],
  },
  furniture: {
    heading: 'Why Shop With Us',
    subheading: 'Premium furniture crafted to last — delivered and installed with care.',
    features: [
      { icon: 'Star',           title: 'Premium Quality',        desc: 'Solid materials and expert craftsmanship that stand the test of time.' },
      { icon: 'Truck',          title: 'White-Glove Delivery',   desc: 'Careful handling and delivery right into your room of choice.' },
      { icon: 'ShieldCheck',    title: '30-Day Returns',         desc: 'Easy returns if a piece is not the right fit for your space.' },
      { icon: 'MessageCircle',  title: 'Interior Advice',        desc: 'Our team helps you choose pieces that match your vision.' },
      { icon: 'Tag',            title: 'Fair Pricing',           desc: 'Premium furniture at prices that will not break your budget.' },
      { icon: 'BadgeCheck',     title: 'Verified Craftsmanship', desc: 'Every piece passes our rigorous quality inspection.' },
    ],
  },
  groceries: {
    heading: 'Why Shop With Us',
    subheading: 'Farm-fresh groceries delivered fast — quality you can taste in every bite.',
    features: [
      { icon: 'Leaf',           title: 'Farm Fresh',             desc: 'Produce sourced directly from trusted local farms every day.' },
      { icon: 'Zap',            title: 'Same-Day Delivery',      desc: 'Groceries at your door within hours of placing your order.' },
      { icon: 'BadgeCheck',     title: 'Quality Checked',        desc: 'Every item inspected for freshness before it is dispatched.' },
      { icon: 'PackageSearch',  title: 'Order Tracking',         desc: 'Know exactly where your order is and when it will arrive.' },
      { icon: 'Tag',            title: 'Fair Prices',            desc: 'Best prices on everyday essentials — always.' },
      { icon: 'ShieldCheck',    title: 'Hygiene Certified',      desc: 'Packed under strict hygiene and food safety protocols.' },
    ],
  },
  services: {
    heading: 'Why Work With Us',
    subheading: 'Expert services, transparent pricing, and satisfaction guaranteed.',
    features: [
      { icon: 'Users',          title: 'Expert Team',            desc: 'Experienced professionals with proven track records.' },
      { icon: 'Clock',          title: 'Flexible Scheduling',    desc: 'Book a time that works perfectly for your schedule.' },
      { icon: 'BadgeCheck',     title: 'Satisfaction Guaranteed', desc: 'We stand 100% behind every service we deliver.' },
      { icon: 'Tag',            title: 'Transparent Pricing',    desc: 'Clear quotes upfront — no hidden fees, ever.' },
      { icon: 'Zap',            title: 'Fast Response',          desc: 'We respond to every enquiry within the hour.' },
      { icon: 'ShieldCheck',    title: 'Fully Verified',         desc: 'Every provider background-checked for your peace of mind.' },
    ],
  },
};

const DEFAULT: FeatureConfig = {
  heading: 'Why Shop With Us',
  subheading: 'Everything you need, sourced and delivered with care.',
  features: [
    { icon: 'Star',           title: 'Quality Products',       desc: 'Handpicked items sourced from trusted global suppliers.' },
    { icon: 'Truck',          title: 'Fast Delivery',          desc: 'Reliable shipping with real-time tracking to your door.' },
    { icon: 'ShieldCheck',    title: 'Secure Payments',        desc: 'Multiple payment options with fraud protection built in.' },
    { icon: 'MessageCircle',  title: 'Customer Support',       desc: 'Dedicated support team available when you need help.' },
    { icon: 'Tag',            title: 'Best Prices',            desc: 'Competitive pricing with regular deals and discounts.' },
    { icon: 'BadgeCheck',     title: 'Verified Sellers',       desc: 'Every vendor is verified for quality and reliability.' },
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

// ─── Per-card accent palette — all use the store's primary brand colour ──────
const PALETTE = [
  { iconBg: 'bg-primary/10', iconText: 'text-primary', bar: 'bg-primary', num: 'text-primary/8' },
  { iconBg: 'bg-primary/10', iconText: 'text-primary', bar: 'bg-primary', num: 'text-primary/8' },
  { iconBg: 'bg-primary/10', iconText: 'text-primary', bar: 'bg-primary', num: 'text-primary/8' },
  { iconBg: 'bg-primary/10', iconText: 'text-primary', bar: 'bg-primary', num: 'text-primary/8' },
  { iconBg: 'bg-primary/10', iconText: 'text-primary', bar: 'bg-primary', num: 'text-primary/8' },
  { iconBg: 'bg-primary/10', iconText: 'text-primary', bar: 'bg-primary', num: 'text-primary/8' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function StoreFeaturesSection() {
  const { store } = useStore();
  const { heading, subheading, features } = resolveConfig(store?.category);

  return (
    <section className="py-20 md:py-28 bg-background border-t relative overflow-hidden">

      {/* Subtle decorative background rings */}
      <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary/4 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-primary/4 blur-3xl" />

      <div className="container mx-auto px-4 md:px-6 relative z-10">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="text-center mb-14 md:mb-18">
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-widest mb-4">
            Why Choose Us
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4">{heading}</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-base md:text-lg leading-relaxed">
            {subheading}
          </p>
        </div>

        {/* ── Feature grid ───────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
          {features.map((feature, i) => {
            const Icon    = ICON_MAP[feature.icon];
            const palette = PALETTE[i % PALETTE.length];
            const num     = String(i + 1).padStart(2, '0');

            return (
              <div
                key={i}
                className="group relative rounded-3xl border bg-card overflow-hidden
                           shadow-sm hover:shadow-xl hover:-translate-y-1
                           transition-all duration-300"
              >
                {/* Coloured top accent bar */}
                <div className={`absolute top-0 left-0 right-0 h-1 ${palette.bar}`} />

                {/* Giant faded number decoration */}
                <span
                  aria-hidden
                  className={`absolute -bottom-3 -right-1 text-[7rem] font-black
                              leading-none select-none pointer-events-none
                              ${palette.num}`}
                >
                  {num}
                </span>

                {/* Card body */}
                <div className="relative z-10 p-6 md:p-7 flex flex-col gap-5">

                  {/* Icon bubble */}
                  <div className={`h-14 w-14 rounded-2xl ${palette.iconBg}
                                  flex items-center justify-center shrink-0
                                  group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className={`h-7 w-7 ${palette.iconText}`} />
                  </div>

                  {/* Text */}
                  <div>
                    <h3 className="font-bold text-base md:text-lg mb-2 leading-snug">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {feature.desc}
                    </p>
                  </div>

                  {/* Bottom arrow link */}
                  <div className={`flex items-center gap-1.5 text-xs font-semibold
                                  ${palette.iconText} opacity-0 group-hover:opacity-100
                                  -translate-y-1 group-hover:translate-y-0
                                  transition-all duration-300`}>
                    <span>Learn more</span>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                         className="translate-x-0 group-hover:translate-x-0.5 transition-transform">
                      <path d="M1 6h10M7 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5"
                            strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
