'use client';
import { useState, useEffect } from 'react';
import { Clock, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useCart } from '@/hooks/use-cart';

export default function CartTimer({ settings }: { settings: any }) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const { clearCart } = useCart();


  // Helper to start/reset the timer
  const startTimer = () => {
    const durationSecs = (settings.durationMinutes || 10) * 60;
    const endTime = Date.now() + (durationSecs * 1000);
    sessionStorage.setItem('sellquic_cart_expiry', endTime.toString());
    setIsExpired(false);
    return endTime;
  };

  useEffect(() => {
    if (!settings?.enabled) return;

    let endTime = parseInt(sessionStorage.getItem('sellquic_cart_expiry') || '0');

    // If no timer exists, start one
    if (!endTime) {
        endTime = startTimer();
    }

    const interval = setInterval(() => {
        const diff = Math.floor((endTime - Date.now()) / 1000);
        
        if (diff <= 0) {
            // TIMER ENDED
            setTimeLeft(0);
            setIsExpired(true);
            // Optionally: You could disable the checkout button here via context
        } else {
            setTimeLeft(diff);
            setIsExpired(false);
        }
    }, 1000);

    return () => clearInterval(interval);
  }, [settings]);

  const handleReclaim = () => {
      // "Fake" check to see if stock exists (simulated delay)
      const btn = document.getElementById('reclaim-btn');
      if(btn) btn.innerHTML = "Checking stock...";
      
      setTimeout(() => {
          startTimer();
      }, 800);
  };

  if (!settings?.enabled || timeLeft === null) return null;

  // --- SHOW OVERLAY IF EXPIRED ---
  if (isExpired) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
            <Card className="max-w-md w-full p-6 text-center space-y-4 shadow-2xl border-red-200">
                <div className="mx-auto bg-red-100 p-4 rounded-full w-fit">
                    <AlertTriangle className="h-8 w-8 text-red-600" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-red-700">Reservation Expired</h2>
                    <p className="text-muted-foreground mt-2">
                        Your items were released to other customers because the reservation time ran out.
                    </p>
                </div>
                <Button 
                    id="reclaim-btn"
                    size="lg" 
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold"
                    onClick={handleReclaim}
                >
                    <RefreshCw className="mr-2 h-4 w-4" /> Try to Reclaim Items
                </Button>
                <p className="text-xs text-muted-foreground">
                    * If successful, your cart will be reserved for another {settings.durationMinutes} minutes.
                </p>
            </Card>
        </div>
      );
  }

  // --- SHOW NORMAL TIMER ---
  const m = Math.floor(timeLeft / 60);
  const s = timeLeft % 60;

  return (
    <div 
        className="w-full text-center p-3 text-sm font-medium flex items-center justify-center gap-2 sticky top-0 z-10 shadow-md transition-colors duration-500"
        style={{ 
            backgroundColor: timeLeft < 60 ? '#FEF2F2' : settings.bgColor, // Turn red when < 1 min
            color: timeLeft < 60 ? '#DC2626' : settings.textColor 
        }}
    >
        <Clock className={`h-4 w-4 ${timeLeft < 60 ? 'animate-pulse' : ''}`} />
        <span>
            {timeLeft < 60 ? "Hurry! Items released in:" : settings.text} 
            <span className="font-bold font-mono text-base ml-2">
                {m}:{s.toString().padStart(2, '0')}
            </span>
        </span>
    </div>
  );
}