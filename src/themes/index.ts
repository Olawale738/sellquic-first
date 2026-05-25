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
  previewImage: string;
  previewGradient: string;
  font: { className: string };
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
    category: 'fashion', isPremium: true,
    previewImage: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=300&fit=crop&auto=format&q=80',
    previewGradient: 'from-gray-900 to-yellow-700',
    font: { className: playfair.className },
    colors: {
      '--background': '0 0% 6%', '--foreground': '45 60% 88%',
      '--primary': '45 75% 52%', '--primary-foreground': '0 0% 6%',
      '--secondary': '0 0% 12%', '--secondary-foreground': '45 40% 80%',
      '--muted': '0 0% 16%', '--muted-foreground': '0 0% 55%',
      '--accent': '45 75% 52%', '--accent-foreground': '0 0% 6%',
      '--border': '0 0% 20%', '--input': '0 0% 18%', '--ring': '45 75% 52%',
    },
  },

  'fashion-blush': {
    id: 'fashion-blush',
    name: 'Blush',
    description: 'Dusty rose and champagne tones for feminine fashion boutiques.',
    category: 'fashion', isPremium: false,
    previewImage: 'https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?w=600&h=300&fit=crop&auto=format&q=80',
    previewGradient: 'from-rose-200 to-amber-100',
    font: { className: raleway.className },
    colors: {
      '--background': '340 30% 98%', '--foreground': '340 15% 12%',
      '--primary': '340 45% 60%', '--primary-foreground': '0 0% 100%',
      '--secondary': '35 40% 92%', '--secondary-foreground': '340 15% 18%',
      '--muted': '340 20% 94%', '--muted-foreground': '340 8% 48%',
      '--accent': '35 55% 72%', '--accent-foreground': '340 15% 12%',
      '--border': '340 18% 87%', '--input': '340 18% 91%', '--ring': '340 45% 60%',
    },
  },

  'fashion-urban': {
    id: 'fashion-urban',
    name: 'Street Culture',
    description: 'Bold orange-red and white for streetwear and urban fashion drops.',
    category: 'fashion', isPremium: false,
    previewImage: 'https://images.unsplash.com/photo-1523398002811-999ca8dec234?w=600&h=300&fit=crop&auto=format&q=80',
    previewGradient: 'from-orange-500 to-red-600',
    font: { className: josefin.className },
    colors: {
      '--background': '0 0% 98%', '--foreground': '0 0% 5%',
      '--primary': '14 90% 52%', '--primary-foreground': '0 0% 100%',
      '--secondary': '14 20% 94%', '--secondary-foreground': '0 0% 8%',
      '--muted': '0 0% 94%', '--muted-foreground': '0 0% 45%',
      '--accent': '14 90% 52%', '--accent-foreground': '0 0% 100%',
      '--border': '0 0% 88%', '--input': '0 0% 91%', '--ring': '14 90% 52%',
    },
  },

  'fashion-pearl': {
    id: 'fashion-pearl',
    name: 'Pearl',
    description: 'Platinum and ivory minimalism for clean, editorial fashion labels.',
    category: 'fashion', isPremium: false,
    previewImage: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&h=300&fit=crop&auto=format&q=80',
    previewGradient: 'from-slate-200 to-stone-100',
    font: { className: raleway.className },
    colors: {
      '--background': '40 20% 97%', '--foreground': '240 8% 12%',
      '--primary': '240 4% 52%', '--primary-foreground': '0 0% 100%',
      '--secondary': '40 15% 93%', '--secondary-foreground': '240 8% 18%',
      '--muted': '40 12% 91%', '--muted-foreground': '240 4% 50%',
      '--accent': '30 30% 78%', '--accent-foreground': '240 8% 12%',
      '--border': '40 10% 87%', '--input': '40 10% 91%', '--ring': '240 4% 52%',
    },
  },

  'fashion-cobalt': {
    id: 'fashion-cobalt',
    name: 'Cobalt',
    description: 'Electric cobalt blue on crisp white for fashion-forward brands.',
    category: 'fashion', isPremium: false,
    previewImage: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&h=300&fit=crop&auto=format&q=80',
    previewGradient: 'from-blue-600 to-cyan-400',
    font: { className: josefin.className },
    colors: {
      '--background': '0 0% 100%', '--foreground': '220 15% 8%',
      '--primary': '225 80% 48%', '--primary-foreground': '0 0% 100%',
      '--secondary': '225 20% 95%', '--secondary-foreground': '220 15% 14%',
      '--muted': '225 12% 93%', '--muted-foreground': '225 6% 47%',
      '--accent': '195 90% 45%', '--accent-foreground': '0 0% 100%',
      '--border': '225 10% 88%', '--input': '225 10% 92%', '--ring': '225 80% 48%',
    },
  },

  // ── Food & Restaurant ───────────────────────────────────────────────────────

  'food-bistro': {
    id: 'food-bistro',
    name: 'Bistro',
    description: 'Warm amber and terracotta for cozy cafes and food businesses.',
    category: 'food', isPremium: false,
    previewImage: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&h=300&fit=crop&auto=format&q=80',
    previewGradient: 'from-amber-400 to-orange-500',
    font: { className: nunito.className },
    colors: {
      '--background': '36 50% 98%', '--foreground': '20 15% 10%',
      '--primary': '24 90% 48%', '--primary-foreground': '0 0% 100%',
      '--secondary': '36 50% 94%', '--secondary-foreground': '20 15% 15%',
      '--muted': '36 30% 92%', '--muted-foreground': '20 10% 45%',
      '--accent': '15 70% 52%', '--accent-foreground': '0 0% 100%',
      '--border': '36 20% 85%', '--input': '36 20% 90%', '--ring': '24 90% 48%',
    },
  },

  'food-verde': {
    id: 'food-verde',
    name: 'Verde',
    description: 'Fresh green and lime palette for healthy food and juice bars.',
    category: 'food', isPremium: false,
    previewImage: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=600&h=300&fit=crop&auto=format&q=80',
    previewGradient: 'from-green-400 to-lime-500',
    font: { className: outfit.className },
    colors: {
      '--background': '100 25% 98%', '--foreground': '120 20% 8%',
      '--primary': '120 60% 38%', '--primary-foreground': '0 0% 100%',
      '--secondary': '100 30% 93%', '--secondary-foreground': '120 20% 12%',
      '--muted': '100 20% 91%', '--muted-foreground': '120 10% 45%',
      '--accent': '75 85% 45%', '--accent-foreground': '120 20% 8%',
      '--border': '100 15% 85%', '--input': '100 15% 90%', '--ring': '120 60% 38%',
    },
  },

  'food-midnight': {
    id: 'food-midnight',
    name: 'Midnight Kitchen',
    description: 'Dark charcoal and gold for upscale fine dining experiences.',
    category: 'food', isPremium: true,
    previewImage: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&h=300&fit=crop&auto=format&q=80',
    previewGradient: 'from-gray-800 to-yellow-600',
    font: { className: cormorant.className },
    colors: {
      '--background': '220 15% 9%', '--foreground': '45 50% 88%',
      '--primary': '45 70% 55%', '--primary-foreground': '220 15% 9%',
      '--secondary': '220 12% 15%', '--secondary-foreground': '45 30% 78%',
      '--muted': '220 10% 20%', '--muted-foreground': '220 5% 55%',
      '--accent': '45 70% 55%', '--accent-foreground': '220 15% 9%',
      '--border': '220 10% 22%', '--input': '220 10% 18%', '--ring': '45 70% 55%',
    },
  },

  'food-crimson': {
    id: 'food-crimson',
    name: 'Crimson Table',
    description: 'Deep burgundy and cream for Italian restaurants and fine wine bars.',
    category: 'food', isPremium: true,
    previewImage: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&h=300&fit=crop&auto=format&q=80',
    previewGradient: 'from-red-800 to-stone-200',
    font: { className: cormorant.className },
    colors: {
      '--background': '0 20% 99%', '--foreground': '355 20% 12%',
      '--primary': '355 65% 42%', '--primary-foreground': '0 0% 100%',
      '--secondary': '355 15% 94%', '--secondary-foreground': '355 20% 16%',
      '--muted': '355 10% 91%', '--muted-foreground': '355 5% 48%',
      '--accent': '15 85% 55%', '--accent-foreground': '0 0% 100%',
      '--border': '355 12% 86%', '--input': '355 12% 90%', '--ring': '355 65% 42%',
    },
  },

  'food-tropic': {
    id: 'food-tropic',
    name: 'Tropic',
    description: 'Sunshine yellow and aqua for tropical food bars and smoothie shops.',
    category: 'food', isPremium: false,
    previewImage: 'https://images.unsplash.com/photo-1546069901-d5bfd2cbfb1f?w=600&h=300&fit=crop&auto=format&q=80',
    previewGradient: 'from-yellow-400 to-teal-400',
    font: { className: nunito.className },
    colors: {
      '--background': '55 40% 98%', '--foreground': '180 20% 8%',
      '--primary': '175 80% 35%', '--primary-foreground': '0 0% 100%',
      '--secondary': '55 35% 93%', '--secondary-foreground': '180 20% 12%',
      '--muted': '55 25% 91%', '--muted-foreground': '180 10% 46%',
      '--accent': '45 95% 52%', '--accent-foreground': '180 20% 8%',
      '--border': '55 20% 86%', '--input': '55 20% 90%', '--ring': '175 80% 35%',
    },
  },

  // ── Beauty & Cosmetics ──────────────────────────────────────────────────────

  'beauty-rose': {
    id: 'beauty-rose',
    name: 'Rose Luxe',
    description: 'Rose gold and blush pink for premium cosmetics and beauty brands.',
    category: 'beauty', isPremium: false,
    previewImage: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=600&h=300&fit=crop&auto=format&q=80',
    previewGradient: 'from-rose-300 to-pink-400',
    font: { className: lora.className },
    colors: {
      '--background': '330 30% 99%', '--foreground': '330 10% 10%',
      '--primary': '330 50% 55%', '--primary-foreground': '0 0% 100%',
      '--secondary': '330 20% 95%', '--secondary-foreground': '330 10% 15%',
      '--muted': '330 15% 93%', '--muted-foreground': '330 5% 45%',
      '--accent': '15 80% 70%', '--accent-foreground': '330 10% 10%',
      '--border': '330 15% 87%', '--input': '330 15% 91%', '--ring': '330 50% 55%',
    },
  },

  'beauty-sage': {
    id: 'beauty-sage',
    name: 'Botanical',
    description: 'Sage green and cream for clean beauty and natural skincare.',
    category: 'beauty', isPremium: false,
    previewImage: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=600&h=300&fit=crop&auto=format&q=80',
    previewGradient: 'from-green-200 to-stone-100',
    font: { className: dmSans.className },
    colors: {
      '--background': '80 20% 98%', '--foreground': '80 15% 10%',
      '--primary': '150 35% 42%', '--primary-foreground': '0 0% 100%',
      '--secondary': '80 20% 93%', '--secondary-foreground': '80 15% 15%',
      '--muted': '80 15% 91%', '--muted-foreground': '80 8% 46%',
      '--accent': '40 35% 80%', '--accent-foreground': '80 15% 10%',
      '--border': '80 12% 85%', '--input': '80 12% 90%', '--ring': '150 35% 42%',
    },
  },

  'beauty-obsidian': {
    id: 'beauty-obsidian',
    name: 'Obsidian',
    description: 'Deep purple and gold dark luxury for high-end beauty brands.',
    category: 'beauty', isPremium: true,
    previewImage: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=600&h=300&fit=crop&auto=format&q=80',
    previewGradient: 'from-purple-900 to-yellow-600',
    font: { className: cormorant.className },
    colors: {
      '--background': '270 20% 7%', '--foreground': '45 55% 88%',
      '--primary': '280 55% 58%', '--primary-foreground': '0 0% 100%',
      '--secondary': '270 18% 13%', '--secondary-foreground': '45 35% 80%',
      '--muted': '270 14% 18%', '--muted-foreground': '270 6% 55%',
      '--accent': '45 72% 54%', '--accent-foreground': '270 20% 7%',
      '--border': '270 12% 22%', '--input': '270 12% 18%', '--ring': '280 55% 58%',
    },
  },

  'beauty-gold': {
    id: 'beauty-gold',
    name: 'Champagne',
    description: 'Warm champagne gold and ivory for glamour beauty and cosmetics.',
    category: 'beauty', isPremium: true,
    previewImage: 'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=600&h=300&fit=crop&auto=format&q=80',
    previewGradient: 'from-yellow-300 to-amber-100',
    font: { className: lora.className },
    colors: {
      '--background': '0 0% 100%', '--foreground': '30 15% 10%',
      '--primary': '38 65% 48%', '--primary-foreground': '0 0% 100%',
      '--secondary': '38 20% 95%', '--secondary-foreground': '30 15% 15%',
      '--muted': '38 12% 93%', '--muted-foreground': '38 5% 48%',
      '--accent': '38 75% 65%', '--accent-foreground': '30 15% 10%',
      '--border': '38 12% 88%', '--input': '38 12% 92%', '--ring': '38 65% 48%',
    },
  },

  'beauty-cloud': {
    id: 'beauty-cloud',
    name: 'Cloud',
    description: 'Soft lavender and white for dreamy, minimal beauty brands.',
    category: 'beauty', isPremium: false,
    previewImage: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=600&h=300&fit=crop&auto=format&q=80',
    previewGradient: 'from-violet-200 to-pink-100',
    font: { className: poppins.className },
    colors: {
      '--background': '280 25% 99%', '--foreground': '280 12% 12%',
      '--primary': '270 45% 62%', '--primary-foreground': '0 0% 100%',
      '--secondary': '280 18% 95%', '--secondary-foreground': '280 12% 16%',
      '--muted': '280 12% 93%', '--muted-foreground': '280 5% 48%',
      '--accent': '295 35% 70%', '--accent-foreground': '280 12% 12%',
      '--border': '280 10% 88%', '--input': '280 10% 92%', '--ring': '270 45% 62%',
    },
  },

  // ── Electronics & Tech ──────────────────────────────────────────────────────

  'tech-onyx': {
    id: 'tech-onyx',
    name: 'Onyx',
    description: 'Sleek dark navy and electric blue for cutting-edge tech stores.',
    category: 'electronics', isPremium: false,
    previewImage: 'https://images.unsplash.com/photo-1593640408182-31c228f02c25?w=600&h=300&fit=crop&auto=format&q=80',
    previewGradient: 'from-slate-900 to-blue-600',
    font: { className: spaceGrotesk.className },
    colors: {
      '--background': '220 20% 8%', '--foreground': '220 10% 95%',
      '--primary': '210 100% 56%', '--primary-foreground': '0 0% 100%',
      '--secondary': '220 20% 14%', '--secondary-foreground': '220 10% 90%',
      '--muted': '220 15% 20%', '--muted-foreground': '220 10% 55%',
      '--accent': '175 80% 45%', '--accent-foreground': '0 0% 100%',
      '--border': '220 15% 22%', '--input': '220 15% 18%', '--ring': '210 100% 56%',
    },
  },

  'tech-arctic': {
    id: 'tech-arctic',
    name: 'Arctic',
    description: 'Clean white and cobalt Apple-style minimal for premium electronics.',
    category: 'electronics', isPremium: false,
    previewImage: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=600&h=300&fit=crop&auto=format&q=80',
    previewGradient: 'from-white to-blue-500',
    font: { className: dmSans.className },
    colors: {
      '--background': '0 0% 100%', '--foreground': '220 20% 8%',
      '--primary': '220 90% 50%', '--primary-foreground': '0 0% 100%',
      '--secondary': '220 15% 96%', '--secondary-foreground': '220 20% 12%',
      '--muted': '220 12% 94%', '--muted-foreground': '220 8% 46%',
      '--accent': '210 100% 56%', '--accent-foreground': '0 0% 100%',
      '--border': '220 10% 90%', '--input': '220 10% 93%', '--ring': '220 90% 50%',
    },
  },

  'tech-neon': {
    id: 'tech-neon',
    name: 'Neon Grid',
    description: 'Neon green on near-black for gaming setups and cyberpunk tech.',
    category: 'electronics', isPremium: true,
    previewImage: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&h=300&fit=crop&auto=format&q=80',
    previewGradient: 'from-black to-green-500',
    font: { className: spaceGrotesk.className },
    colors: {
      '--background': '120 10% 5%', '--foreground': '120 30% 92%',
      '--primary': '120 100% 42%', '--primary-foreground': '120 10% 5%',
      '--secondary': '120 12% 10%', '--secondary-foreground': '120 20% 85%',
      '--muted': '120 10% 15%', '--muted-foreground': '120 8% 55%',
      '--accent': '160 100% 38%', '--accent-foreground': '120 10% 5%',
      '--border': '120 15% 18%', '--input': '120 15% 14%', '--ring': '120 100% 42%',
    },
  },

  'tech-silver': {
    id: 'tech-silver',
    name: 'Chrome',
    description: 'Steel silver and sky blue for premium consumer electronics.',
    category: 'electronics', isPremium: false,
    previewImage: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&h=300&fit=crop&auto=format&q=80',
    previewGradient: 'from-slate-300 to-blue-300',
    font: { className: dmSans.className },
    colors: {
      '--background': '210 8% 98%', '--foreground': '210 15% 10%',
      '--primary': '210 12% 45%', '--primary-foreground': '0 0% 100%',
      '--secondary': '210 8% 93%', '--secondary-foreground': '210 15% 15%',
      '--muted': '210 6% 91%', '--muted-foreground': '210 5% 47%',
      '--accent': '200 80% 50%', '--accent-foreground': '0 0% 100%',
      '--border': '210 6% 87%', '--input': '210 6% 91%', '--ring': '210 12% 45%',
    },
  },

  'tech-carbon': {
    id: 'tech-carbon',
    name: 'Carbon',
    description: 'Carbon black and neon orange for bold gaming and accessories brands.',
    category: 'electronics', isPremium: true,
    previewImage: 'https://images.unsplash.com/photo-1607252650355-f7fd0460ccdb?w=600&h=300&fit=crop&auto=format&q=80',
    previewGradient: 'from-zinc-900 to-orange-500',
    font: { className: josefin.className },
    colors: {
      '--background': '0 0% 6%', '--foreground': '20 10% 92%',
      '--primary': '20 95% 52%', '--primary-foreground': '0 0% 6%',
      '--secondary': '0 0% 12%', '--secondary-foreground': '20 8% 85%',
      '--muted': '0 0% 18%', '--muted-foreground': '0 0% 55%',
      '--accent': '40 90% 52%', '--accent-foreground': '0 0% 6%',
      '--border': '0 0% 20%', '--input': '0 0% 16%', '--ring': '20 95% 52%',
    },
  },

  // ── Furniture & Home ────────────────────────────────────────────────────────

  'home-scandi': {
    id: 'home-scandi',
    name: 'Scandi',
    description: 'Warm oat and birch tones for Scandinavian-style furniture stores.',
    category: 'furniture', isPremium: false,
    previewImage: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&h=300&fit=crop&auto=format&q=80',
    previewGradient: 'from-amber-100 to-stone-200',
    font: { className: lora.className },
    colors: {
      '--background': '38 30% 97%', '--foreground': '30 18% 12%',
      '--primary': '28 42% 45%', '--primary-foreground': '0 0% 100%',
      '--secondary': '38 25% 92%', '--secondary-foreground': '30 18% 18%',
      '--muted': '38 20% 89%', '--muted-foreground': '30 10% 48%',
      '--accent': '45 50% 68%', '--accent-foreground': '30 18% 12%',
      '--border': '38 16% 83%', '--input': '38 16% 88%', '--ring': '28 42% 45%',
    },
  },

  'home-terra': {
    id: 'home-terra',
    name: 'Terra',
    description: 'Terracotta and cream for earthy, artisan home decor brands.',
    category: 'furniture', isPremium: false,
    previewImage: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&h=300&fit=crop&auto=format&q=80',
    previewGradient: 'from-orange-300 to-stone-200',
    font: { className: outfit.className },
    colors: {
      '--background': '30 25% 98%', '--foreground': '20 20% 10%',
      '--primary': '14 58% 48%', '--primary-foreground': '0 0% 100%',
      '--secondary': '30 22% 93%', '--secondary-foreground': '20 20% 15%',
      '--muted': '30 18% 91%', '--muted-foreground': '20 10% 46%',
      '--accent': '38 60% 72%', '--accent-foreground': '20 20% 10%',
      '--border': '30 14% 85%', '--input': '30 14% 90%', '--ring': '14 58% 48%',
    },
  },

  'home-forest': {
    id: 'home-forest',
    name: 'Forest Lodge',
    description: 'Deep forest green and warm gold for luxury cabin-inspired furniture.',
    category: 'furniture', isPremium: true,
    previewImage: 'https://images.unsplash.com/photo-1618220179428-22790b461013?w=600&h=300&fit=crop&auto=format&q=80',
    previewGradient: 'from-green-900 to-amber-200',
    font: { className: lora.className },
    colors: {
      '--background': '70 15% 97%', '--foreground': '150 20% 10%',
      '--primary': '155 45% 28%', '--primary-foreground': '0 0% 100%',
      '--secondary': '70 12% 92%', '--secondary-foreground': '150 20% 15%',
      '--muted': '70 10% 90%', '--muted-foreground': '150 8% 46%',
      '--accent': '40 50% 65%', '--accent-foreground': '150 20% 10%',
      '--border': '70 8% 85%', '--input': '70 8% 89%', '--ring': '155 45% 28%',
    },
  },

  'home-charcoal': {
    id: 'home-charcoal',
    name: 'Charcoal',
    description: 'Refined charcoal and terracotta accents for contemporary interiors.',
    category: 'furniture', isPremium: false,
    previewImage: 'https://images.unsplash.com/photo-1493663284031-b7e3aaa4b5e8?w=600&h=300&fit=crop&auto=format&q=80',
    previewGradient: 'from-zinc-700 to-stone-200',
    font: { className: dmSans.className },
    colors: {
      '--background': '20 8% 98%', '--foreground': '20 10% 10%',
      '--primary': '20 5% 22%', '--primary-foreground': '20 8% 97%',
      '--secondary': '20 6% 93%', '--secondary-foreground': '20 10% 15%',
      '--muted': '20 5% 91%', '--muted-foreground': '20 4% 47%',
      '--accent': '20 35% 68%', '--accent-foreground': '20 10% 10%',
      '--border': '20 5% 86%', '--input': '20 5% 90%', '--ring': '20 5% 22%',
    },
  },

  'home-linen': {
    id: 'home-linen',
    name: 'Linen',
    description: 'Soft linen and wheat tones for light, airy Scandi-minimal spaces.',
    category: 'furniture', isPremium: false,
    previewImage: 'https://images.unsplash.com/photo-1538688525198-9b88f6f53126?w=600&h=300&fit=crop&auto=format&q=80',
    previewGradient: 'from-stone-200 to-amber-50',
    font: { className: raleway.className },
    colors: {
      '--background': '40 25% 98%', '--foreground': '35 15% 12%',
      '--primary': '35 30% 52%', '--primary-foreground': '0 0% 100%',
      '--secondary': '40 20% 93%', '--secondary-foreground': '35 15% 18%',
      '--muted': '40 15% 91%', '--muted-foreground': '35 8% 48%',
      '--accent': '50 40% 70%', '--accent-foreground': '35 15% 12%',
      '--border': '40 12% 86%', '--input': '40 12% 90%', '--ring': '35 30% 52%',
    },
  },

  // ── Groceries & Produce ─────────────────────────────────────────────────────

  'grocery-harvest': {
    id: 'grocery-harvest',
    name: 'Harvest',
    description: 'Forest green and cream for farm-fresh grocery and produce stores.',
    category: 'groceries', isPremium: false,
    previewImage: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&h=300&fit=crop&auto=format&q=80',
    previewGradient: 'from-green-700 to-stone-100',
    font: { className: poppins.className },
    colors: {
      '--background': '120 20% 98%', '--foreground': '120 15% 10%',
      '--primary': '130 55% 35%', '--primary-foreground': '0 0% 100%',
      '--secondary': '120 20% 94%', '--secondary-foreground': '120 15% 15%',
      '--muted': '120 15% 91%', '--muted-foreground': '120 8% 45%',
      '--accent': '60 75% 50%', '--accent-foreground': '0 0% 10%',
      '--border': '120 12% 84%', '--input': '120 12% 89%', '--ring': '130 55% 35%',
    },
  },

  'grocery-market': {
    id: 'grocery-market',
    name: 'Market Square',
    description: 'Orange and yellow vibrancy for lively market-style grocery stores.',
    category: 'groceries', isPremium: false,
    previewImage: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=600&h=300&fit=crop&auto=format&q=80',
    previewGradient: 'from-orange-400 to-yellow-400',
    font: { className: nunito.className },
    colors: {
      '--background': '45 50% 98%', '--foreground': '30 20% 8%',
      '--primary': '28 95% 50%', '--primary-foreground': '0 0% 100%',
      '--secondary': '45 45% 93%', '--secondary-foreground': '30 20% 14%',
      '--muted': '45 30% 91%', '--muted-foreground': '30 12% 46%',
      '--accent': '50 95% 52%', '--accent-foreground': '30 20% 8%',
      '--border': '45 22% 85%', '--input': '45 22% 90%', '--ring': '28 95% 50%',
    },
  },

  'grocery-organic': {
    id: 'grocery-organic',
    name: 'Organic',
    description: 'Warm earthy brown and cream for organic markets and wholefood stores.',
    category: 'groceries', isPremium: false,
    previewImage: 'https://images.unsplash.com/photo-1453614512568-c4024d13c247?w=600&h=300&fit=crop&auto=format&q=80',
    previewGradient: 'from-amber-700 to-stone-100',
    font: { className: nunito.className },
    colors: {
      '--background': '35 30% 97%', '--foreground': '25 20% 12%',
      '--primary': '25 55% 38%', '--primary-foreground': '0 0% 100%',
      '--secondary': '35 22% 92%', '--secondary-foreground': '25 20% 18%',
      '--muted': '35 15% 90%', '--muted-foreground': '25 10% 48%',
      '--accent': '60 65% 48%', '--accent-foreground': '25 20% 12%',
      '--border': '35 12% 85%', '--input': '35 12% 89%', '--ring': '25 55% 38%',
    },
  },

  'grocery-aqua': {
    id: 'grocery-aqua',
    name: 'Aqua Fresh',
    description: 'Bright aqua and crisp white for modern fresh-food and delivery stores.',
    category: 'groceries', isPremium: false,
    previewImage: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&h=300&fit=crop&auto=format&q=80',
    previewGradient: 'from-cyan-400 to-teal-300',
    font: { className: outfit.className },
    colors: {
      '--background': '180 20% 98%', '--foreground': '180 18% 10%',
      '--primary': '185 70% 40%', '--primary-foreground': '0 0% 100%',
      '--secondary': '180 15% 93%', '--secondary-foreground': '180 18% 15%',
      '--muted': '180 12% 91%', '--muted-foreground': '180 7% 46%',
      '--accent': '75 80% 48%', '--accent-foreground': '180 18% 10%',
      '--border': '180 10% 86%', '--input': '180 10% 90%', '--ring': '185 70% 40%',
    },
  },

  'grocery-violet': {
    id: 'grocery-violet',
    name: 'Berry',
    description: 'Rich berry purple and cream for artisan juice bars and health shops.',
    category: 'groceries', isPremium: false,
    previewImage: 'https://images.unsplash.com/photo-1528825871115-3581a5387919?w=600&h=300&fit=crop&auto=format&q=80',
    previewGradient: 'from-purple-600 to-pink-200',
    font: { className: poppins.className },
    colors: {
      '--background': '280 15% 98%', '--foreground': '280 15% 10%',
      '--primary': '280 55% 45%', '--primary-foreground': '0 0% 100%',
      '--secondary': '280 12% 93%', '--secondary-foreground': '280 15% 16%',
      '--muted': '280 10% 91%', '--muted-foreground': '280 5% 47%',
      '--accent': '310 60% 55%', '--accent-foreground': '0 0% 100%',
      '--border': '280 8% 87%', '--input': '280 8% 91%', '--ring': '280 55% 45%',
    },
  },

  // ── Services & Consulting ───────────────────────────────────────────────────

  'services-slate': {
    id: 'services-slate',
    name: 'Slate',
    description: 'Navy and white professional design for service-based businesses.',
    category: 'services', isPremium: false,
    previewImage: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&h=300&fit=crop&auto=format&q=80',
    previewGradient: 'from-slate-700 to-blue-100',
    font: { className: spaceGrotesk.className },
    colors: {
      '--background': '220 25% 98%', '--foreground': '220 20% 10%',
      '--primary': '220 90% 50%', '--primary-foreground': '0 0% 100%',
      '--secondary': '220 20% 94%', '--secondary-foreground': '220 20% 15%',
      '--muted': '220 15% 91%', '--muted-foreground': '220 10% 45%',
      '--accent': '160 60% 40%', '--accent-foreground': '0 0% 100%',
      '--border': '220 12% 85%', '--input': '220 12% 90%', '--ring': '220 90% 50%',
    },
  },

  'services-spark': {
    id: 'services-spark',
    name: 'Spark',
    description: 'Purple and coral creative agency style for bold consulting brands.',
    category: 'services', isPremium: false,
    previewImage: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&h=300&fit=crop&auto=format&q=80',
    previewGradient: 'from-purple-500 to-rose-400',
    font: { className: dmSans.className },
    colors: {
      '--background': '270 20% 98%', '--foreground': '270 15% 8%',
      '--primary': '270 65% 52%', '--primary-foreground': '0 0% 100%',
      '--secondary': '270 15% 94%', '--secondary-foreground': '270 15% 14%',
      '--muted': '270 12% 92%', '--muted-foreground': '270 6% 46%',
      '--accent': '10 80% 62%', '--accent-foreground': '0 0% 100%',
      '--border': '270 10% 86%', '--input': '270 10% 91%', '--ring': '270 65% 52%',
    },
  },

  'services-dark': {
    id: 'services-dark',
    name: 'Command',
    description: 'Deep navy and electric cyan for bold, premium service agencies.',
    category: 'services', isPremium: true,
    previewImage: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=600&h=300&fit=crop&auto=format&q=80',
    previewGradient: 'from-slate-900 to-cyan-500',
    font: { className: spaceGrotesk.className },
    colors: {
      '--background': '210 25% 7%', '--foreground': '210 15% 94%',
      '--primary': '195 90% 45%', '--primary-foreground': '210 25% 7%',
      '--secondary': '210 20% 13%', '--secondary-foreground': '210 15% 88%',
      '--muted': '210 18% 18%', '--muted-foreground': '210 10% 55%',
      '--accent': '220 80% 60%', '--accent-foreground': '0 0% 100%',
      '--border': '210 16% 22%', '--input': '210 16% 18%', '--ring': '195 90% 45%',
    },
  },

  'services-mint': {
    id: 'services-mint',
    name: 'Mint',
    description: 'Mint green and white for fresh, trustworthy service businesses.',
    category: 'services', isPremium: false,
    previewImage: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=600&h=300&fit=crop&auto=format&q=80',
    previewGradient: 'from-emerald-300 to-teal-100',
    font: { className: dmSans.className },
    colors: {
      '--background': '160 20% 98%', '--foreground': '160 18% 10%',
      '--primary': '162 55% 40%', '--primary-foreground': '0 0% 100%',
      '--secondary': '160 15% 93%', '--secondary-foreground': '160 18% 15%',
      '--muted': '160 12% 91%', '--muted-foreground': '160 6% 46%',
      '--accent': '180 65% 40%', '--accent-foreground': '0 0% 100%',
      '--border': '160 10% 86%', '--input': '160 10% 90%', '--ring': '162 55% 40%',
    },
  },

  'services-coral': {
    id: 'services-coral',
    name: 'Coral Studio',
    description: 'Warm coral and white for creative agencies and design studios.',
    category: 'services', isPremium: false,
    previewImage: 'https://images.unsplash.com/photo-1600880292089-90a7e086ee0c?w=600&h=300&fit=crop&auto=format&q=80',
    previewGradient: 'from-rose-400 to-orange-200',
    font: { className: outfit.className },
    colors: {
      '--background': '10 15% 98%', '--foreground': '10 18% 10%',
      '--primary': '10 75% 52%', '--primary-foreground': '0 0% 100%',
      '--secondary': '10 12% 93%', '--secondary-foreground': '10 18% 15%',
      '--muted': '10 10% 91%', '--muted-foreground': '10 5% 47%',
      '--accent': '340 55% 55%', '--accent-foreground': '0 0% 100%',
      '--border': '10 8% 87%', '--input': '10 8% 91%', '--ring': '10 75% 52%',
    },
  },

  // ── General / Universal ─────────────────────────────────────────────────────

  'retail-classic': {
    id: 'retail-classic',
    name: 'Classic',
    description: 'Clean teal and timeless layout. Works for any store.',
    category: 'general', isPremium: false,
    previewImage: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&h=300&fit=crop&auto=format&q=80',
    previewGradient: 'from-teal-400 to-cyan-200',
    font: { className: ptSans.className },
    colors: {
      '--background': '0 0% 100%', '--foreground': '0 0% 3.9%',
      '--primary': '180 50% 45%', '--primary-foreground': '0 0% 98%',
      '--secondary': '0 0% 96.1%', '--secondary-foreground': '0 0% 9%',
      '--muted': '0 0% 96.1%', '--muted-foreground': '0 0% 45.1%',
      '--accent': '0 0% 96.1%', '--accent-foreground': '0 0% 9%',
      '--border': '0 0% 89.8%', '--input': '0 0% 89.8%', '--ring': '180 50% 45%',
    },
  },

  'retail-mono': {
    id: 'retail-mono',
    name: 'Monochrome',
    description: 'Pure black and white minimal for a bold editorial retail look.',
    category: 'general', isPremium: false,
    previewImage: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=600&h=300&fit=crop&auto=format&q=80',
    previewGradient: 'from-gray-900 to-gray-100',
    font: { className: josefin.className },
    colors: {
      '--background': '0 0% 100%', '--foreground': '0 0% 4%',
      '--primary': '0 0% 8%', '--primary-foreground': '0 0% 98%',
      '--secondary': '0 0% 95%', '--secondary-foreground': '0 0% 8%',
      '--muted': '0 0% 94%', '--muted-foreground': '0 0% 44%',
      '--accent': '0 0% 12%', '--accent-foreground': '0 0% 98%',
      '--border': '0 0% 88%', '--input': '0 0% 91%', '--ring': '0 0% 8%',
    },
  },

  'retail-spectrum': {
    id: 'retail-spectrum',
    name: 'Spectrum',
    description: 'Indigo and vivid accents for energetic multi-category retail.',
    category: 'general', isPremium: false,
    previewImage: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=600&h=300&fit=crop&auto=format&q=80',
    previewGradient: 'from-indigo-600 to-violet-400',
    font: { className: outfit.className },
    colors: {
      '--background': '240 20% 99%', '--foreground': '240 18% 8%',
      '--primary': '240 65% 50%', '--primary-foreground': '0 0% 100%',
      '--secondary': '240 15% 94%', '--secondary-foreground': '240 18% 12%',
      '--muted': '240 12% 92%', '--muted-foreground': '240 6% 46%',
      '--accent': '280 80% 60%', '--accent-foreground': '0 0% 100%',
      '--border': '240 10% 87%', '--input': '240 10% 91%', '--ring': '240 65% 50%',
    },
  },

  'retail-sunset': {
    id: 'retail-sunset',
    name: 'Sunset',
    description: 'Warm sunset orange and coral for vibrant, energetic retail brands.',
    category: 'general', isPremium: false,
    previewImage: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=600&h=300&fit=crop&auto=format&q=80',
    previewGradient: 'from-orange-400 to-rose-400',
    font: { className: poppins.className },
    colors: {
      '--background': '20 25% 98%', '--foreground': '20 20% 8%',
      '--primary': '16 85% 52%', '--primary-foreground': '0 0% 100%',
      '--secondary': '20 20% 93%', '--secondary-foreground': '20 20% 14%',
      '--muted': '20 15% 91%', '--muted-foreground': '20 10% 46%',
      '--accent': '340 65% 56%', '--accent-foreground': '0 0% 100%',
      '--border': '20 12% 86%', '--input': '20 12% 90%', '--ring': '16 85% 52%',
    },
  },

  'retail-ocean': {
    id: 'retail-ocean',
    name: 'Ocean',
    description: 'Deep ocean teal and aqua for calm, trusted retail experiences.',
    category: 'general', isPremium: false,
    previewImage: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=600&h=300&fit=crop&auto=format&q=80',
    previewGradient: 'from-teal-600 to-cyan-300',
    font: { className: lora.className },
    colors: {
      '--background': '200 20% 98%', '--foreground': '200 18% 10%',
      '--primary': '200 75% 35%', '--primary-foreground': '0 0% 100%',
      '--secondary': '200 15% 93%', '--secondary-foreground': '200 18% 15%',
      '--muted': '200 12% 91%', '--muted-foreground': '200 7% 46%',
      '--accent': '175 70% 42%', '--accent-foreground': '0 0% 100%',
      '--border': '200 10% 86%', '--input': '200 10% 90%', '--ring': '200 75% 35%',
    },
  },

  'retail-crimson': {
    id: 'retail-crimson',
    name: 'Crimson',
    description: 'Bold deep crimson and white for confident, powerful retail brands.',
    category: 'general', isPremium: false,
    previewImage: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600&h=300&fit=crop&auto=format&q=80',
    previewGradient: 'from-red-700 to-rose-300',
    font: { className: josefin.className },
    colors: {
      '--background': '0 0% 99%', '--foreground': '355 20% 8%',
      '--primary': '355 80% 45%', '--primary-foreground': '0 0% 100%',
      '--secondary': '355 10% 94%', '--secondary-foreground': '355 20% 13%',
      '--muted': '355 8% 92%', '--muted-foreground': '355 4% 47%',
      '--accent': '20 80% 55%', '--accent-foreground': '0 0% 100%',
      '--border': '355 8% 88%', '--input': '355 8% 91%', '--ring': '355 80% 45%',
    },
  },

  'retail-forest': {
    id: 'retail-forest',
    name: 'Deep Forest',
    description: 'Rich forest green and olive for nature-inspired retail brands.',
    category: 'general', isPremium: false,
    previewImage: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=600&h=300&fit=crop&auto=format&q=80',
    previewGradient: 'from-green-800 to-lime-200',
    font: { className: raleway.className },
    colors: {
      '--background': '120 12% 98%', '--foreground': '150 15% 10%',
      '--primary': '148 60% 32%', '--primary-foreground': '0 0% 100%',
      '--secondary': '120 10% 93%', '--secondary-foreground': '150 15% 15%',
      '--muted': '120 8% 91%', '--muted-foreground': '150 5% 46%',
      '--accent': '60 65% 48%', '--accent-foreground': '150 15% 10%',
      '--border': '120 6% 86%', '--input': '120 6% 90%', '--ring': '148 60% 32%',
    },
  },

  'retail-lavender': {
    id: 'retail-lavender',
    name: 'Lavender',
    description: 'Soft lavender and lilac for calm, elegant multi-category stores.',
    category: 'general', isPremium: false,
    previewImage: 'https://images.unsplash.com/photo-1557683316-973673baf926?w=600&h=300&fit=crop&auto=format&q=80',
    previewGradient: 'from-violet-300 to-purple-100',
    font: { className: poppins.className },
    colors: {
      '--background': '265 20% 99%', '--foreground': '265 12% 12%',
      '--primary': '265 50% 55%', '--primary-foreground': '0 0% 100%',
      '--secondary': '265 15% 95%', '--secondary-foreground': '265 12% 17%',
      '--muted': '265 10% 93%', '--muted-foreground': '265 5% 47%',
      '--accent': '300 40% 65%', '--accent-foreground': '265 12% 12%',
      '--border': '265 8% 88%', '--input': '265 8% 92%', '--ring': '265 50% 55%',
    },
  },

  'retail-golden': {
    id: 'retail-golden',
    name: 'Golden',
    description: 'Rich gold and amber warmth for premium lifestyle retail.',
    category: 'general', isPremium: false,
    previewImage: 'https://images.unsplash.com/photo-1521566652839-697aa473761a?w=600&h=300&fit=crop&auto=format&q=80',
    previewGradient: 'from-yellow-500 to-amber-300',
    font: { className: cormorant.className },
    colors: {
      '--background': '45 35% 98%', '--foreground': '25 20% 8%',
      '--primary': '38 80% 45%', '--primary-foreground': '0 0% 100%',
      '--secondary': '45 28% 93%', '--secondary-foreground': '25 20% 14%',
      '--muted': '45 20% 91%', '--muted-foreground': '25 10% 46%',
      '--accent': '15 65% 52%', '--accent-foreground': '0 0% 100%',
      '--border': '45 16% 86%', '--input': '45 16% 90%', '--ring': '38 80% 45%',
    },
  },

  'retail-midnight': {
    id: 'retail-midnight',
    name: 'Midnight',
    description: 'Deep midnight navy and electric blue for bold, modern stores.',
    category: 'general', isPremium: true,
    previewImage: 'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=600&h=300&fit=crop&auto=format&q=80',
    previewGradient: 'from-slate-950 to-blue-500',
    font: { className: spaceGrotesk.className },
    colors: {
      '--background': '225 30% 7%', '--foreground': '220 15% 95%',
      '--primary': '220 80% 58%', '--primary-foreground': '0 0% 100%',
      '--secondary': '225 25% 13%', '--secondary-foreground': '220 15% 90%',
      '--muted': '225 20% 18%', '--muted-foreground': '220 10% 55%',
      '--accent': '190 85% 55%', '--accent-foreground': '0 0% 100%',
      '--border': '225 18% 22%', '--input': '225 18% 18%', '--ring': '220 80% 58%',
    },
  },

};

// ── Default theme map: one best-fit per category keyword ───────────────────────

export const CATEGORY_THEME_MAP: Record<string, string> = {
  fashion: 'fashion-noir', clothing: 'fashion-noir', apparel: 'fashion-noir',
  shoes: 'fashion-noir', accessories: 'fashion-noir',
  food: 'food-bistro', restaurant: 'food-bistro', catering: 'food-bistro',
  bakery: 'food-bistro', meals: 'food-bistro', snacks: 'food-bistro',
  beauty: 'beauty-rose', cosmetics: 'beauty-rose', skincare: 'beauty-rose',
  haircare: 'beauty-rose', makeup: 'beauty-rose', wellness: 'beauty-rose',
  electronics: 'tech-onyx', phones: 'tech-onyx', gadgets: 'tech-onyx',
  computers: 'tech-onyx', tech: 'tech-onyx',
  furniture: 'home-scandi', home: 'home-scandi', decor: 'home-scandi',
  interior: 'home-scandi', living: 'home-scandi',
  groceries: 'grocery-harvest', supermarket: 'grocery-harvest',
  fresh: 'grocery-harvest', produce: 'grocery-harvest', pantry: 'grocery-harvest',
  services: 'services-slate', consulting: 'services-slate',
  logistics: 'services-slate', repair: 'services-slate', cleaning: 'services-slate',
};

// All 10 universal / general themes shown to every store in addition to category themes
const GENERAL_THEMES = [
  'retail-classic', 'retail-mono', 'retail-spectrum',
  'retail-sunset', 'retail-ocean', 'retail-crimson',
  'retail-forest', 'retail-lavender', 'retail-golden', 'retail-midnight',
];

// ── Per-category theme lists: 5 specific + 10 general = 15 per store ──────────

export const CATEGORY_ALL_THEMES: Record<string, string[]> = {
  fashion:     ['fashion-noir', 'fashion-blush', 'fashion-urban', 'fashion-pearl', 'fashion-cobalt', ...GENERAL_THEMES],
  food:        ['food-bistro', 'food-verde', 'food-midnight', 'food-crimson', 'food-tropic', ...GENERAL_THEMES],
  beauty:      ['beauty-rose', 'beauty-sage', 'beauty-obsidian', 'beauty-gold', 'beauty-cloud', ...GENERAL_THEMES],
  electronics: ['tech-onyx', 'tech-arctic', 'tech-neon', 'tech-silver', 'tech-carbon', ...GENERAL_THEMES],
  furniture:   ['home-scandi', 'home-terra', 'home-forest', 'home-charcoal', 'home-linen', ...GENERAL_THEMES],
  groceries:   ['grocery-harvest', 'grocery-market', 'grocery-organic', 'grocery-aqua', 'grocery-violet', ...GENERAL_THEMES],
  services:    ['services-slate', 'services-spark', 'services-dark', 'services-mint', 'services-coral', ...GENERAL_THEMES],
  general:     GENERAL_THEMES,
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
