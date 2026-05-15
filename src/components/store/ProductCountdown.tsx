'use client';
import { useState, useEffect } from 'react';
import { Timer } from 'lucide-react';

export default function ProductCountdown({ settings }: { settings: any }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    if (!settings?.enabled) return;

    // Logic: Calculate time until next reset cycle based on durationHours
    const durationMs = (settings.durationHours || 24) * 60 * 60 * 1000;
    
    const interval = setInterval(() => {
      const now = Date.now();
      const nextReset = Math.ceil(now / durationMs) * durationMs;
      const remaining = nextReset - now;
      
      if (remaining <= 0) {
        setTimeLeft("00h : 00m : 00s");
      } else {
        const h = Math.floor((remaining / (1000 * 60 * 60)));
        const m = Math.floor((remaining / (1000 * 60)) % 60);
        const s = Math.floor((remaining / 1000) % 60);
        setTimeLeft(`${h.toString().padStart(2, '0')}h : ${m.toString().padStart(2, '0')}m : ${s.toString().padStart(2, '0')}s`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [settings]);

  if (!settings?.enabled) return null;

  return (
    <div 
        className="flex items-center gap-3 p-3 rounded-lg mb-4 animate-in fade-in"
        style={{ backgroundColor: settings.bgColor, color: settings.textColor }}
    >
        <Timer className="h-5 w-5 animate-pulse" />
        <div className="flex flex-col leading-tight">
            <span className="text-xs font-bold uppercase opacity-90">{settings.text}</span>
            <span className="text-lg font-mono font-bold tracking-widest">{timeLeft}</span>
        </div>
    </div>
  );
}
