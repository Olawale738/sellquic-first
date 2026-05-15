'use client';

import React, { useEffect } from 'react';
import { AuthProvider } from '@/hooks/use-auth';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import IOSInstallBanner from '@/components/ios-install-banner';
import { FirebaseClientProvider } from '@/firebase';
import { CartProvider } from '@/hooks/use-cart';
import { StoreProvider } from '@/context/store-context';
import { getAnalytics } from "firebase/analytics";
import { useFirebaseApp } from "@/firebase";

function FirebaseAnalytics() {
  const app = useFirebaseApp();
  useEffect(() => {
    if (typeof window !== 'undefined' && app) {
        try {
            getAnalytics(app);
            console.log('✅ Firebase Analytics initialized');
        } catch (error) {
            console.error("Failed to initialize Firebase Analytics", error);
        }
    }
  }, [app]);

  return null;
}

// Re-define the type locally to remove the import dependency and satisfy the type checker.
// The `id` is a literal type 'classic' to match the expected type from the original module.
interface ThemeConfig {
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


// Create a default theme object to avoid importing from '@/themes' at the top level
const defaultTheme: ThemeConfig = {
    id: 'classic',
    name: 'Classic',
    description: 'Clean and minimal. Works for any store.',
    isPremium: false,
    font: { className: 'font-body' },
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
};

export function AppProviders({ children }: { children: React.ReactNode }) {

  return (
    <ErrorBoundary>
      <FirebaseClientProvider>
        <AuthProvider>
          <StoreProvider store={null} activeTheme={defaultTheme} isCustomDomain={false} isDemo={false}>
            <CartProvider>
                <FirebaseAnalytics />
                {children}
                <IOSInstallBanner />
            </CartProvider>
          </StoreProvider>
        </AuthProvider>
      </FirebaseClientProvider>
    </ErrorBoundary>
  );
}
