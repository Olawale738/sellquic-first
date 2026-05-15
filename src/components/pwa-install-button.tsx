'use client';

import { useState, useEffect } from 'react';
import { Download, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOSInstalled = (window.navigator as any).standalone === true;
    
    if (isStandalone || isIOSInstalled) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    setIsInstalling(true);
    deferredPrompt.prompt();

    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    
    setIsInstalling(false);
    setDeferredPrompt(null);
  };

  // Don't show if installed or no prompt available
  if (isInstalled || !deferredPrompt) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={handleInstallClick}
            disabled={isInstalling}
            size="icon"
            className="fixed bottom-4 right-4 h-12 w-12 rounded-full shadow-lg z-40"
          >
            {isInstalling ? (
              <Check className="h-6 w-6 animate-pulse" />
            ) : (
              <Download className="h-6 w-6" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>Install SellQuic App</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
