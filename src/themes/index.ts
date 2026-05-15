
import { PT_Sans } from 'next/font/google';

const ptSans = PT_Sans({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-classic' });

export interface ThemeConfig {
  id: 'classic';
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
};

export const resolveTheme = (themeId: string | undefined): ThemeConfig => {
  return themes[themeId || 'classic'] || themes.classic;
};
