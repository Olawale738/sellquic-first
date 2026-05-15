'use client';
import React, { createContext, useContext, ReactNode } from 'react';
import { DocumentData } from 'firebase/firestore';
import type { ThemeConfig } from '@/themes';

interface Store extends DocumentData {
  faqs?: { question: string; answer: string }[];
  [key: string]: any;
}

interface StoreContextType {
  store: Store | null;
  isCustomDomain: boolean;
  isDemo?: boolean;
  activeTheme: ThemeConfig;
  themeConfig: any; // Added this line
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider = ({
  children,
  store,
  isCustomDomain = false,
  isDemo = false,
  activeTheme, // No default, now required
}: {
  children: ReactNode;
  store: Store | null;
  isCustomDomain?: boolean;
  isDemo?: boolean;
  activeTheme: ThemeConfig; // Now required
}) => {
  const themeConfig = store?.themeConfig || {};
  return (
    <StoreContext.Provider value={{ store, isCustomDomain, isDemo, activeTheme, themeConfig }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (context === undefined) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};
