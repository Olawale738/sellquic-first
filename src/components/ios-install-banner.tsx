'use client';

import { useState, useEffect } from 'react';
import { X, Share, PlusSquare } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function IOSInstallBanner() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Check if iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isInStandaloneMode = (window.navigator as any).standalone === true;

    // Only show on iOS Safari and not already installed
    if (!isIOS || isInStandaloneMode) {
      return;
    }

    // Check if dismissed
    const dismissed = localStorage.getItem('ios-install-dismissed');
    const dismissedTime = dismissed ? parseInt(dismissed) : 0;
    const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);

    if (dismissed && daysSinceDismissed < 30) {
      return;
    }

    // Show after 10 seconds
    const timer = setTimeout(() => {
      setShowBanner(true);
    }, 10000);

    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('ios-install-dismissed', Date.now().toString());
    setShowBanner(false);
  };

  if (!showBanner) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 animate-in slide-in-from-bottom-5">
      <Card className="p-4 shadow-lg border-2 border-primary/20 bg-gradient-to-br from-background to-primary/5">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-2">Install SellQuic App</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Install this app on your home screen for quick and easy access.
            </p>

            {/* iOS Installation Steps */}
            <div className="space-y-2 mb-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center text-xs font-semibold text-primary">
                  1
                </div>
                <div className="flex-1 text-sm">
                  <p>Tap the Share button <Share className="inline w-4 h-4 mx-1" /> at the bottom of your screen</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center text-xs font-semibold text-primary">
                  2
                </div>
                <div className="flex-1 text-sm">
                  <p>Select "Add to Home Screen" <PlusSquare className="inline w-4 h-4 mx-1" /></p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center text-xs font-semibold text-primary">
                  3
                </div>
                <div className="flex-1 text-sm">
                  <p>Tap "Add" to install the app</p>
                </div>
              </div>
            </div>

            <Button 
              onClick={handleDismiss} 
              variant="outline" 
              size="sm" 
              className="w-full"
            >
              Got it!
            </Button>
          </div>

          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </Card>
    </div>
  );
}
