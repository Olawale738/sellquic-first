import { PT_Sans, Playfair_Display, Nunito, Space_Grotesk, Lora, Poppins } from 'next/font/google';

const ptSans = PT_Sans({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-classic' });
const playfair = Playfair_Display({ subsets: ['latin'], weight: ['400', '600', '700'], variable: '--font-fashion' });
const nunito = Nunito({ subsets: ['latin'], weight: ['400', '600', '700', '800'], variable: '--font-food' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-tech' });
const lora = Lora({ subsets: ['latin'], weight: ['400', '600', '700'], variable: '--font-beauty' });
const poppins = Poppins({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-modern' });

export interface ThemeConfig {
  id: string;
  name: string;
  description: string;
  isPremium: boolean;
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
  classic: {
    id: 'classic',
    name: 'Classic',
    description: 'Clean and minimal. Works for any store.',
    isPremium: false,
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

  // Fashion — elegant boutique, soft luxury
  fashion: {
    id: 'fashion',
    name: 'Boutique',
    description: 'Elegant boutique style with soft luxury colours and editorial layouts.',
    isPremium: false,
    font: { className: playfair.className },
    colors: {
      '--background': '30 20% 98%',
      '--foreground': '0 0% 10%',
      '--primary': '340 40% 35%',
      '--primary-foreground': '0 0% 98%',
      '--secondary': '30 20% 94%',
      '--secondary-foreground': '0 0% 15%',
      '--muted': '30 15% 92%',
      '--muted-foreground': '0 0% 45%',
      '--accent': '45 60% 70%',
      '--accent-foreground': '0 0% 10%',
      '--border': '30 15% 85%',
      '--input': '30 15% 90%',
      '--ring': '340 40% 35%',
    },
  },

  // Food — warm, appetising, rounded
  food: {
    id: 'food',
    name: 'Flavour',
    description: 'Warm, appetising colours and rounded cards for food businesses.',
    isPremium: false,
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
      '--accent': '48 95% 55%',
      '--accent-foreground': '20 15% 10%',
      '--border': '36 20% 85%',
      '--input': '36 20% 90%',
      '--ring': '24 90% 48%',
    },
  },

  // Beauty & Cosmetics — clean luxury, soft gradients
  beauty: {
    id: 'beauty',
    name: 'Luxe',
    description: 'Clean luxury feel with soft gradients and premium product cards.',
    isPremium: false,
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

  // Electronics — dark modern tech
  electronics: {
    id: 'electronics',
    name: 'TechDark',
    description: 'Sleek dark theme with sharp cards and feature highlights.',
    isPremium: false,
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

  // Furniture & Home — calm neutral, spacious
  furniture: {
    id: 'furniture',
    name: 'Haven',
    description: 'Calm neutral palette with spacious layouts for home & furniture stores.',
    isPremium: false,
    font: { className: lora.className },
    colors: {
      '--background': '40 30% 97%',
      '--foreground': '30 15% 12%',
      '--primary': '25 45% 42%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '40 25% 93%',
      '--secondary-foreground': '30 15% 18%',
      '--muted': '40 20% 90%',
      '--muted-foreground': '30 10% 48%',
      '--accent': '140 30% 45%',
      '--accent-foreground': '0 0% 100%',
      '--border': '40 15% 84%',
      '--input': '40 15% 89%',
      '--ring': '25 45% 42%',
    },
  },

  // Groceries — fresh green/natural
  groceries: {
    id: 'groceries',
    name: 'Fresh',
    description: 'Fresh green and natural tones for grocery and produce stores.',
    isPremium: false,
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

  // Services — professional landing-page style
  services: {
    id: 'services',
    name: 'Pro',
    description: 'Professional, trust-first design for service-based businesses.',
    isPremium: false,
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
};

export const CATEGORY_THEME_MAP: Record<string, string> = {
  fashion: 'fashion',
  clothing: 'fashion',
  apparel: 'fashion',
  shoes: 'fashion',
  accessories: 'fashion',
  food: 'food',
  restaurant: 'food',
  catering: 'food',
  bakery: 'food',
  meals: 'food',
  snacks: 'food',
  beauty: 'beauty',
  cosmetics: 'beauty',
  skincare: 'beauty',
  haircare: 'beauty',
  makeup: 'beauty',
  wellness: 'beauty',
  electronics: 'electronics',
  phones: 'electronics',
  gadgets: 'electronics',
  computers: 'electronics',
  tech: 'electronics',
  furniture: 'furniture',
  home: 'furniture',
  decor: 'furniture',
  interior: 'furniture',
  living: 'furniture',
  groceries: 'groceries',
  supermarket: 'groceries',
  fresh: 'groceries',
  produce: 'groceries',
  pantry: 'groceries',
  services: 'services',
  consulting: 'services',
  logistics: 'services',
  repair: 'services',
  cleaning: 'services',
};

export const resolveTheme = (themeId: string | undefined): ThemeConfig => {
  return themes[themeId || 'classic'] || themes.classic;
};

export const resolveThemeByCategory = (category: string | undefined): ThemeConfig => {
  if (!category) return themes.classic;
  const key = category.toLowerCase().trim();
  const themeId = CATEGORY_THEME_MAP[key] || 'classic';
  return themes[themeId] || themes.classic;
};
