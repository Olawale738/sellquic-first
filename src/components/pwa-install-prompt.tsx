'use client';

import { useState, useEffect } from 'react';
import { X, Download, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOSInstalled = (window.navigator as any).standalone === true;
    
    if (isStandalone || isIOSInstalled) {
      setIsInstalled(true);
      return;
    }

    // Check if user dismissed the prompt before
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    const dismissedTime = dismissed ? parseInt(dismissed) : 0;
    const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);

    // Show again after 7 days
    if (dismissed && daysSinceDismissed < 7) {
      return;
    }

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('📱 PWA install prompt available');
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Show prompt after 30 seconds or on second visit
      const visitCount = parseInt(localStorage.getItem('visit-count') || '0') + 1;
      localStorage.setItem('visit-count', visitCount.toString());

      if (visitCount >= 2) {
        setTimeout(() => setShowPrompt(true), 30000); // 30 seconds
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for successful installation
    window.addEventListener('appinstalled', () => {
      console.log('✅ PWA installed successfully');
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      console.log('❌ No install prompt available');
      return;
    }

    console.log('📲 Showing install prompt...');
    
    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user's response
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response: ${outcome}`);

    if (outcome === 'accepted') {
      console.log('✅ User accepted the install prompt');
      setShowPrompt(false);
    } else {
      console.log('❌ User dismissed the install prompt');
      localStorage.setItem('pwa-install-dismissed', Date.now().toString());
      setShowPrompt(false);
    }

    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    console.log('⏭️ User manually dismissed the prompt');
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    setShowPrompt(false);
  };

  // Don't show if already installed or no prompt available
  if (isInstalled || !showPrompt || !deferredPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 animate-in slide-in-from-bottom-5">
      <Card className="p-4 shadow-lg border-2 border-primary/20 bg-gradient-to-br from-background to-primary/5">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
            <Smartphone className="w-6 h-6 text-primary" />
          </div>
          
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-1">Install SellQuic App</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Get instant access to your store! Install our app for a faster, native experience.
            </p>
            
            <div className="flex gap-2">
              <Button 
                onClick={handleInstallClick} 
                size="sm" 
                className="flex-1"
              >
                <Download className="w-4 h-4 mr-2" />
                Install Now
              </Button>
              <Button 
                onClick={handleDismiss} 
                variant="outline" 
                size="sm"
              >
                Later
              </Button>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Benefits list */}
        <div className="mt-3 pt-3 border-t space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-1.5 h-1.5 bg-primary rounded-full" />
            <span>Works offline</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-1.5 h-1.5 bg-primary rounded-full" />
            <span>Faster load times</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-1.5 h-1.5 bg-primary rounded-full" />
            <span>Native app experience</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
