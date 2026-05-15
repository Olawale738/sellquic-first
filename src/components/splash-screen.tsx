'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export default function SplashScreen() {
    const [isVisible, setIsVisible] = useState(true);

    // This ensures the splash stays for at least 2.5 seconds to finish the animation
    // even if the app loads faster.
    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(false);
        }, 2800);
        return () => clearTimeout(timer);
    }, []);

    if (!isVisible) return null;

    return (
        <motion.div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-white"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
        >
            {/* Background Blur Orb */}
            <motion.div 
                className="absolute w-[500px] h-[500px] bg-gradient-to-tr from-purple-500/20 via-pink-500/20 to-blue-500/20 rounded-full blur-[80px]"
                animate={{ 
                    scale: [1, 1.2, 1],
                    opacity: [0.5, 0.8, 0.5],
                }}
                transition={{ 
                    duration: 3, 
                    repeat: Infinity,
                    ease: "easeInOut" 
                }}
            />

            <div className="relative flex flex-col items-center justify-center z-10">
                {/* 1. THE ICON (Shopping Bag + Bolt) */}
                <div className="relative w-32 h-32 mb-6">
                    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-xl">
                        <defs>
                            <linearGradient id="mainGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#6366f1" />
                                <stop offset="50%" stopColor="#8b5cf6" />
                                <stop offset="100%" stopColor="#d946ef" />
                            </linearGradient>
                        </defs>

                        {/* Bag Body */}
                        <motion.path
                            d="M20 30 H80 L75 85 C75 90 70 90 70 90 H30 C30 90 25 90 25 85 L20 30 Z"
                            fill="url(#mainGradient)"
                            initial={{ scale: 0, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, type: "spring", bounce: 0.5 }}
                        />

                        {/* Bag Handle */}
                        <motion.path
                            d="M35 30 V20 C35 12 42 12 50 12 C58 12 65 12 65 20 V30"
                            stroke="url(#mainGradient)"
                            strokeWidth="8"
                            strokeLinecap="round"
                            fill="none"
                            initial={{ pathLength: 0, opacity: 0 }}
                            animate={{ pathLength: 1, opacity: 1 }}
                            transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
                        />

                        {/* Lightning Bolt (Speed Symbol) */}
                        <motion.path
                            d="M55 40 L40 60 H52 L45 80 L65 55 H52 L60 40 H55 Z"
                            fill="#ffffff"
                            initial={{ scale: 0, opacity: 0, rotate: -20 }}
                            animate={{ scale: 1, opacity: 1, rotate: 0 }}
                            transition={{ duration: 0.4, delay: 0.7, type: "spring" }}
                        />
                    </svg>
                </div>

                {/* 2. THE TEXT (Reveals up) */}
                <div className="overflow-hidden h-14">
                    <motion.h1
                        className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
                        initial={{ y: 50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: 0.6, delay: 0.5, ease: "backOut" }}
                    >
                        SellQuic
                    </motion.h1>
                </div>

                {/* 3. LOADING BAR */}
                <motion.div 
                    className="w-32 h-1.5 bg-gray-100 rounded-full mt-4 overflow-hidden"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                >
                    <motion.div 
                        className="h-full bg-gradient-to-r from-indigo-500 to-pink-500 rounded-full"
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 1.5, delay: 0.9, ease: "easeInOut" }}
                    />
                </motion.div>
            </div>
        </motion.div>
    );
}