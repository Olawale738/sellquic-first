import { PT_Sans, Playfair_Display, Nunito, Space_Grotesk, Lora, Poppins, DM_Sans, Raleway, Outfit, Cormorant_Garamond, Josefin_Sans } from 'next/font/google';

const ptSans = PT_Sans({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-classic' });
const playfair = Playfair_Display({ subsets: ['latin'], weight: ['400', '600', '700'], variable: '--font-fashion' });
const nunito = Nunito({ subsets: ['latin'], weight: ['400', '600', '700', '800'], variable: '--font-food' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-tech' });
const lora = Lora({ subsets: ['latin'], weight: ['400', '600', '700'], variable: '--font-beauty' });
const poppins = Poppins({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-modern' });
const dmSans = DM_Sans({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-dm' });
const raleway = Raleway({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-raleway' });
const outfit = Outfit({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-outfit' });
const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['400', '600', '700'], variable: '--font-cormorant' });
const josefin = Josefin_Sans({ subsets: ['latin'], weight: ['400', '600', '700'], variable: '--font-josefin' });

export interface ThemeConfig {
  id: string;
  name: string;
  description: string;
  category: string;
  isPremium: boolean;
  previewGradient: string;
  font: {
    className: string;
  };
  colors: {
    '--background': string;
    '--foreground': string;
    '--primary': string;
    '--primary-foreground': string;
    '--secondary': string;
    '--secondary-foreground': string;
    '--muted': string;
    '--muted-foreground': string;
    '--accent': string;
    '--accent-foreground': string;
    '--border': string;
    '--input': string;
    '--ring': string;
  };
}

export const themes: Record<string, ThemeConfig> = {
  // ── Fashion & Clothing ──────────────────────────────────────────────────────

  'fashion-noir': {
    id: 'fashion-noir',
    name: 'Noir Boutique',
    description: 'Black and gold luxury editorial for high-end fashion brands.',
    category: 'fashion',
    isPremium: true,
    previewGradient: 'from-gray-900 to-yellow-700',
    font: { className: playfair.className },
    colors: {
      '--background': '0 0% 6%',
      '--foreground': '45 60% 88%',
      '--primary': '45 75% 52%',
      '--primary-foreground': '0 0% 6%',
      '--secondary': '0 0% 12%',
      '--secondary-foreground': '45 40% 80%',
      '--muted': '0 0% 16%',
      '--muted-foreground': '0 0% 55%',
      '--accent': '45 75% 52%',
      '--accent-foreground': '0 0% 6%',
      '--border': '0 0% 20%',
      '--input': '0 0% 18%',
      '--ring': '45 75% 52%',
    },
  },

  'fashion-blush': {
    id: 'fashion-blush',
    name: 'Blush',
    description: 'Dusty rose and champagne tones for feminine fashion boutiques.',
    category: 'fashion',
    isPremium: false,
    previewGradient: 'from-rose-200 to-amber-100',
    font: { className: raleway.className },
    colors: {
      '--background': '340 30% 98%',
      '--foreground': '340 15% 12%',
      '--primary': '340 45% 60%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '35 40% 92%',
      '--secondary-foreground': '340 15% 18%',
      '--muted': '340 20% 94%',
      '--muted-foreground': '340 8% 48%',
      '--accent': '35 55% 72%',
      '--accent-foreground': '340 15% 12%',
      '--border': '340 18% 87%',
      '--input': '340 18% 91%',
      '--ring': '340 45% 60%',
    },
  },

  'fashion-urban': {
    id: 'fashion-urban',
    name: 'Street Culture',
    description: 'Bold orange-red and white for streetwear and urban fashion drops.',
    category: 'fashion',
    isPremium: false,
    previewGradient: 'from-orange-500 to-red-600',
    font: { className: josefin.className },
    colors: {
      '--background': '0 0% 98%',
      '--foreground': '0 0% 5%',
      '--primary': '14 90% 52%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '14 20% 94%',
      '--secondary-foreground': '0 0% 8%',
      '--muted': '0 0% 94%',
      '--muted-foreground': '0 0% 45%',
      '--accent': '14 90% 52%',
      '--accent-foreground': '0 0% 100%',
      '--border': '0 0% 88%',
      '--input': '0 0% 91%',
      '--ring': '14 90% 52%',
    },
  },

  // ── Food & Restaurant ───────────────────────────────────────────────────────

  'food-bistro': {
    id: 'food-bistro',
    name: 'Bistro',
    description: 'Warm amber and terracotta for cozy cafes and food businesses.',
    category: 'food',
    isPremium: false,
    previewGradient: 'from-amber-400 to-orange-500',
    font: { className: nunito.className },
    colors: {
      '--background': '36 50% 98%',
      '--foreground': '20 15% 10%',
      '--primary': '24 90% 48%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '36 50% 94%',
      '--secondary-foreground': '20 15% 15%',
      '--muted': '36 30% 92%',
      '--muted-foreground': '20 10% 45%',
      '--accent': '15 70% 52%',
      '--accent-foreground': '0 0% 100%',
      '--border': '36 20% 85%',
      '--input': '36 20% 90%',
      '--ring': '24 90% 48%',
    },
  },

  'food-verde': {
    id: 'food-verde',
    name: 'Verde',
    description: 'Fresh green and lime palette for healthy food and juice bars.',
    category: 'food',
    isPremium: false,
    previewGradient: 'from-green-400 to-lime-500',
    font: { className: outfit.className },
    colors: {
      '--background': '100 25% 98%',
      '--foreground': '120 20% 8%',
      '--primary': '120 60% 38%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '100 30% 93%',
      '--secondary-foreground': '120 20% 12%',
      '--muted': '100 20% 91%',
      '--muted-foreground': '120 10% 45%',
      '--accent': '75 85% 45%',
      '--accent-foreground': '120 20% 8%',
      '--border': '100 15% 85%',
      '--input': '100 15% 90%',
      '--ring': '120 60% 38%',
    },
  },

  'food-midnight': {
    id: 'food-midnight',
    name: 'Midnight Kitchen',
    description: 'Dark charcoal and gold for upscale fine dining experiences.',
    category: 'food',
    isPremium: true,
    previewGradient: 'from-gray-800 to-yellow-600',
    font: { className: cormorant.className },
    colors: {
      '--background': '220 15% 9%',
      '--foreground': '45 50% 88%',
      '--primary': '45 70% 55%',
      '--primary-foreground': '220 15% 9%',
      '--secondary': '220 12% 15%',
      '--secondary-foreground': '45 30% 78%',
      '--muted': '220 10% 20%',
      '--muted-foreground': '220 5% 55%',
      '--accent': '45 70% 55%',
      '--accent-foreground': '220 15% 9%',
      '--border': '220 10% 22%',
      '--input': '220 10% 18%',
      '--ring': '45 70% 55%',
    },
  },

  // ── Beauty & Cosmetics ──────────────────────────────────────────────────────

  'beauty-rose': {
    id: 'beauty-rose',
    name: 'Rose Luxe',
    description: 'Rose gold and blush pink for premium cosmetics and beauty brands.',
    category: 'beauty',
    isPremium: false,
    previewGradient: 'from-rose-300 to-pink-400',
    font: { className: lora.className },
    colors: {
      '--background': '330 30% 99%',
      '--foreground': '330 10% 10%',
      '--primary': '330 50% 55%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '330 20% 95%',
      '--secondary-foreground': '330 10% 15%',
      '--muted': '330 15% 93%',
      '--muted-foreground': '330 5% 45%',
      '--accent': '15 80% 70%',
      '--accent-foreground': '330 10% 10%',
      '--border': '330 15% 87%',
      '--input': '330 15% 91%',
      '--ring': '330 50% 55%',
    },
  },

  'beauty-sage': {
    id: 'beauty-sage',
    name: 'Botanical',
    description: 'Sage green and cream for clean beauty and natural skincare.',
    category: 'beauty',
    isPremium: false,
    previewGradient: 'from-green-200 to-stone-100',
    font: { className: dmSans.className },
    colors: {
      '--background': '80 20% 98%',
      '--foreground': '80 15% 10%',
      '--primary': '150 35% 42%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '80 20% 93%',
      '--secondary-foreground': '80 15% 15%',
      '--muted': '80 15% 91%',
      '--muted-foreground': '80 8% 46%',
      '--accent': '40 35% 80%',
      '--accent-foreground': '80 15% 10%',
      '--border': '80 12% 85%',
      '--input': '80 12% 90%',
      '--ring': '150 35% 42%',
    },
  },

  'beauty-obsidian': {
    id: 'beauty-obsidian',
    name: 'Obsidian',
    description: 'Deep purple and gold dark luxury for high-end beauty brands.',
    category: 'beauty',
    isPremium: true,
    previewGradient: 'from-purple-900 to-yellow-600',
    font: { className: cormorant.className },
    colors: {
      '--background': '270 20% 7%',
      '--foreground': '45 55% 88%',
      '--primary': '280 55% 58%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '270 18% 13%',
      '--secondary-foreground': '45 35% 80%',
      '--muted': '270 14% 18%',
      '--muted-foreground': '270 6% 55%',
      '--accent': '45 72% 54%',
      '--accent-foreground': '270 20% 7%',
      '--border': '270 12% 22%',
      '--input': '270 12% 18%',
      '--ring': '280 55% 58%',
    },
  },

  // ── Electronics & Tech ──────────────────────────────────────────────────────

  'tech-onyx': {
    id: 'tech-onyx',
    name: 'Onyx',
    description: 'Sleek dark navy and electric blue for cutting-edge tech stores.',
    category: 'electronics',
    isPremium: false,
    previewGradient: 'from-slate-900 to-blue-600',
    font: { className: spaceGrotesk.className },
    colors: {
      '--background': '220 20% 8%',
      '--foreground': '220 10% 95%',
      '--primary': '210 100% 56%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '220 20% 14%',
      '--secondary-foreground': '220 10% 90%',
      '--muted': '220 15% 20%',
      '--muted-foreground': '220 10% 55%',
      '--accent': '175 80% 45%',
      '--accent-foreground': '0 0% 100%',
      '--border': '220 15% 22%',
      '--input': '220 15% 18%',
      '--ring': '210 100% 56%',
    },
  },

  'tech-arctic': {
    id: 'tech-arctic',
    name: 'Arctic',
    description: 'Clean white and cobalt Apple-style minimal for premium electronics.',
    category: 'electronics',
    isPremium: false,
    previewGradient: 'from-white to-blue-500',
    font: { className: dmSans.className },
    colors: {
      '--background': '0 0% 100%',
      '--foreground': '220 20% 8%',
      '--primary': '220 90% 50%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '220 15% 96%',
      '--secondary-foreground': '220 20% 12%',
      '--muted': '220 12% 94%',
      '--muted-foreground': '220 8% 46%',
      '--accent': '210 100% 56%',
      '--accent-foreground': '0 0% 100%',
      '--border': '220 10% 90%',
      '--input': '220 10% 93%',
      '--ring': '220 90% 50%',
    },
  },

  // ── Furniture & Home ────────────────────────────────────────────────────────

  'home-scandi': {
    id: 'home-scandi',
    name: 'Scandi',
    description: 'Warm oat and birch tones for Scandinavian-style furniture stores.',
    category: 'furniture',
    isPremium: false,
    previewGradient: 'from-amber-100 to-stone-200',
    font: { className: lora.className },
    colors: {
      '--background': '38 30% 97%',
      '--foreground': '30 18% 12%',
      '--primary': '28 42% 45%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '38 25% 92%',
      '--secondary-foreground': '30 18% 18%',
      '--muted': '38 20% 89%',
      '--muted-foreground': '30 10% 48%',
      '--accent': '45 50% 68%',
      '--accent-foreground': '30 18% 12%',
      '--border': '38 16% 83%',
      '--input': '38 16% 88%',
      '--ring': '28 42% 45%',
    },
  },

  'home-terra': {
    id: 'home-terra',
    name: 'Terra',
    description: 'Terracotta and cream for earthy, artisan home decor brands.',
    category: 'furniture',
    isPremium: false,
    previewGradient: 'from-orange-300 to-stone-200',
    font: { className: outfit.className },
    colors: {
      '--background': '30 25% 98%',
      '--foreground': '20 20% 10%',
      '--primary': '14 58% 48%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '30 22% 93%',
      '--secondary-foreground': '20 20% 15%',
      '--muted': '30 18% 91%',
      '--muted-foreground': '20 10% 46%',
      '--accent': '38 60% 72%',
      '--accent-foreground': '20 20% 10%',
      '--border': '30 14% 85%',
      '--input': '30 14% 90%',
      '--ring': '14 58% 48%',
    },
  },

  // ── Groceries & Produce ─────────────────────────────────────────────────────

  'grocery-harvest': {
    id: 'grocery-harvest',
    name: 'Harvest',
    description: 'Forest green and cream for farm-fresh grocery and produce stores.',
    category: 'groceries',
    isPremium: false,
    previewGradient: 'from-green-700 to-stone-100',
    font: { className: poppins.className },
    colors: {
      '--background': '120 20% 98%',
      '--foreground': '120 15% 10%',
      '--primary': '130 55% 35%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '120 20% 94%',
      '--secondary-foreground': '120 15% 15%',
      '--muted': '120 15% 91%',
      '--muted-foreground': '120 8% 45%',
      '--accent': '60 75% 50%',
      '--accent-foreground': '0 0% 10%',
      '--border': '120 12% 84%',
      '--input': '120 12% 89%',
      '--ring': '130 55% 35%',
    },
  },

  'grocery-market': {
    id: 'grocery-market',
    name: 'Market Square',
    description: 'Orange and yellow vibrancy for lively market-style grocery stores.',
    category: 'groceries',
    isPremium: false,
    previewGradient: 'from-orange-400 to-yellow-400',
    font: { className: nunito.className },
    colors: {
      '--background': '45 50% 98%',
      '--foreground': '30 20% 8%',
      '--primary': '28 95% 50%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '45 45% 93%',
      '--secondary-foreground': '30 20% 14%',
      '--muted': '45 30% 91%',
      '--muted-foreground': '30 12% 46%',
      '--accent': '50 95% 52%',
      '--accent-foreground': '30 20% 8%',
      '--border': '45 22% 85%',
      '--input': '45 22% 90%',
      '--ring': '28 95% 50%',
    },
  },

  // ── Services & Consulting ───────────────────────────────────────────────────

  'services-slate': {
    id: 'services-slate',
    name: 'Slate',
    description: 'Navy and white professional design for service-based businesses.',
    category: 'services',
    isPremium: false,
    previewGradient: 'from-slate-700 to-blue-100',
    font: { className: spaceGrotesk.className },
    colors: {
      '--background': '220 25% 98%',
      '--foreground': '220 20% 10%',
      '--primary': '220 90% 50%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '220 20% 94%',
      '--secondary-foreground': '220 20% 15%',
      '--muted': '220 15% 91%',
      '--muted-foreground': '220 10% 45%',
      '--accent': '160 60% 40%',
      '--accent-foreground': '0 0% 100%',
      '--border': '220 12% 85%',
      '--input': '220 12% 90%',
      '--ring': '220 90% 50%',
    },
  },

  'services-spark': {
    id: 'services-spark',
    name: 'Spark',
    description: 'Purple and coral creative agency style for bold consulting brands.',
    category: 'services',
    isPremium: false,
    previewGradient: 'from-purple-500 to-rose-400',
    font: { className: dmSans.className },
    colors: {
      '--background': '270 20% 98%',
      '--foreground': '270 15% 8%',
      '--primary': '270 65% 52%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '270 15% 94%',
      '--secondary-foreground': '270 15% 14%',
      '--muted': '270 12% 92%',
      '--muted-foreground': '270 6% 46%',
      '--accent': '10 80% 62%',
      '--accent-foreground': '0 0% 100%',
      '--border': '270 10% 86%',
      '--input': '270 10% 91%',
      '--ring': '270 65% 52%',
    },
  },

  // ── General Retail ──────────────────────────────────────────────────────────

  'retail-classic': {
    id: 'retail-classic',
    name: 'Classic',
    description: 'Clean teal and timeless layout. Works for any store.',
    category: 'general',
    isPremium: false,
    previewGradient: 'from-teal-400 to-cyan-200',
    font: { className: ptSans.className },
    colors: {
      '--background': '0 0% 100%',
      '--foreground': '0 0% 3.9%',
      '--primary': '180 50% 45%',
      '--primary-foreground': '0 0% 98%',
      '--secondary': '0 0% 96.1%',
      '--secondary-foreground': '0 0% 9%',
      '--muted': '0 0% 96.1%',
      '--muted-foreground': '0 0% 45.1%',
      '--accent': '0 0% 96.1%',
      '--accent-foreground': '0 0% 9%',
      '--border': '0 0% 89.8%',
      '--input': '0 0% 89.8%',
      '--ring': '180 50% 45%',
    },
  },

  'retail-mono': {
    id: 'retail-mono',
    name: 'Monochrome',
    description: 'Pure black and white minimal for a bold editorial retail look.',
    category: 'general',
    isPremium: false,
    previewGradient: 'from-gray-900 to-gray-100',
    font: { className: josefin.className },
    colors: {
      '--background': '0 0% 100%',
      '--foreground': '0 0% 4%',
      '--primary': '0 0% 8%',
      '--primary-foreground': '0 0% 98%',
      '--secondary': '0 0% 95%',
      '--secondary-foreground': '0 0% 8%',
      '--muted': '0 0% 94%',
      '--muted-foreground': '0 0% 44%',
      '--accent': '0 0% 12%',
      '--accent-foreground': '0 0% 98%',
      '--border': '0 0% 88%',
      '--input': '0 0% 91%',
      '--ring': '0 0% 8%',
    },
  },

  'retail-spectrum': {
    id: 'retail-spectrum',
    name: 'Spectrum',
    description: 'Indigo and vivid accents for energetic multi-category retail.',
    category: 'general',
    isPremium: false,
    previewGradient: 'from-indigo-600 to-violet-400',
    font: { className: outfit.className },
    colors: {
      '--background': '240 20% 99%',
      '--foreground': '240 18% 8%',
      '--primary': '240 65% 50%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '240 15% 94%',
      '--secondary-foreground': '240 18% 12%',
      '--muted': '240 12% 92%',
      '--muted-foreground': '240 6% 46%',
      '--accent': '280 80% 60%',
      '--accent-foreground': '0 0% 100%',
      '--border': '240 10% 87%',
      '--input': '240 10% 91%',
      '--ring': '240 65% 50%',
    },
  },
};

export const CATEGORY_THEME_MAP: Record<string, string> = {
  fashion: 'fashion-noir',
  clothing: 'fashion-noir',
  apparel: 'fashion-noir',
  shoes: 'fashion-noir',
  accessories: 'fashion-noir',
  food: 'food-bistro',
  restaurant: 'food-bistro',
  catering: 'food-bistro',
  bakery: 'food-bistro',
  meals: 'food-bistro',
  snacks: 'food-bistro',
  beauty: 'beauty-rose',
  cosmetics: 'beauty-rose',
  skincare: 'beauty-rose',
  haircare: 'beauty-rose',
  makeup: 'beauty-rose',
  wellness: 'beauty-rose',
  electronics: 'tech-onyx',
  phones: 'tech-onyx',
  gadgets: 'tech-onyx',
  computers: 'tech-onyx',
  tech: 'tech-onyx',
  furniture: 'home-scandi',
  home: 'home-scandi',
  decor: 'home-scandi',
  interior: 'home-scandi',
  living: 'home-scandi',
  groceries: 'grocery-harvest',
  supermarket: 'grocery-harvest',
  fresh: 'grocery-harvest',
  produce: 'grocery-harvest',
  pantry: 'grocery-harvest',
  services: 'services-slate',
  consulting: 'services-slate',
  logistics: 'services-slate',
  repair: 'services-slate',
  cleaning: 'services-slate',
};

export const CATEGORY_ALL_THEMES: Record<string, string[]> = {
  fashion: ['fashion-noir', 'fashion-blush', 'fashion-urban'],
  food: ['food-bistro', 'food-verde', 'food-midnight'],
  beauty: ['beauty-rose', 'beauty-sage', 'beauty-obsidian'],
  electronics: ['tech-onyx', 'tech-arctic'],
  furniture: ['home-scandi', 'home-terra'],
  groceries: ['grocery-harvest', 'grocery-market'],
  services: ['services-slate', 'services-spark'],
  general: ['retail-classic', 'retail-mono', 'retail-spectrum'],
};

export const resolveTheme = (themeId: string | undefined): ThemeConfig => {
  return themes[themeId || 'retail-classic'] || themes['retail-classic'];
};

export const resolveThemeByCategory = (category: string | undefined): ThemeConfig => {
  if (!category) return themes['retail-classic'];
  const key = category.toLowerCase().trim();
  const themeId = CATEGORY_THEME_MAP[key] || 'retail-classic';
  return themes[themeId] || themes['retail-classic'];
};
