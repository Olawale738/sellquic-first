'use client';

import { useState, useEffect } from 'react';
import { useStore } from '@/context/store-context';
import { Timestamp } from 'firebase/firestore';
import { Timer } from 'lucide-react';

const calculateTimeLeft = (endDate: Date | Timestamp | null) => {
    if (!endDate) return null;
    const difference = (endDate instanceof Timestamp ? endDate.toDate() : new Date(endDate)).getTime() - new Date().getTime();
    
    if (difference <= 0) return null;

    return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
    };
};

export function FlashSaleTimer() {
    const { store } = useStore();
    const flashSaleSettings = store?.marketing?.flashSale;
    const [timeLeft, setTimeLeft] = useState(calculateTimeLeft(flashSaleSettings?.endDate || null));

    useEffect(() => {
        if (!flashSaleSettings?.active || !flashSaleSettings?.endDate) return;

        const timer = setInterval(() => {
            setTimeLeft(calculateTimeLeft(flashSaleSettings.endDate));
        }, 1000);

        return () => clearInterval(timer);
    }, [flashSaleSettings]);

    if (!flashSaleSettings?.active || !timeLeft) {
        return null;
    }

    const TimerBox = ({ value, label }: { value: number; label: string }) => (
        <div className="flex flex-col items-center">
            <span className="text-xl md:text-2xl font-bold">{String(value).padStart(2, '0')}</span>
            <span className="text-[10px] uppercase tracking-wider">{label}</span>
        </div>
    );

    return (
        <div className="bg-red-600 text-white py-2 px-4 flex items-center justify-center gap-4 md:gap-6">
            <div className="flex items-center gap-2">
                <Timer className="h-5 w-5" />
                <span className="font-semibold text-sm md:text-base hidden sm:inline-block">{flashSaleSettings.title}</span>
            </div>
            <div className="flex items-center gap-3 md:gap-4">
                <TimerBox value={timeLeft.days} label="Days" />
                <span className="text-xl md:text-2xl font-bold">:</span>
                <TimerBox value={timeLeft.hours} label="Hours" />
                <span className="text-xl md:text-2xl font-bold">:</span>
                <TimerBox value={timeLeft.minutes} label="Mins" />
                <span className="text-xl md:text-2xl font-bold">:</span>
                <TimerBox value={timeLeft.seconds} label="Secs" />
            </div>
        </div>
    );
}
