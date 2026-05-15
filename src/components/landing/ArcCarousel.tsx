"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Sparkles, Instagram, Globe, Zap } from 'lucide-react';

const FEATURES = [
  {
    id: 0,
    title: "AI Assistant",
    desc: "Sells for you on WhatsApp, Instagram, and your store 24/7. Takes orders and answers questions.",
    image: "https://firebasestorage.googleapis.com/v0/b/sellquic.firebasestorage.app/o/homepage%20images%2FUntitled%20design%20(70).png?alt=media&token=6da9acf9-a940-4e82-91cf-5146fc05627f", 
    color: "bg-purple-50"
  },
  {
    id: 1,
    title: "Your website",
    desc: "A fully functioning website at your own link. Manage products and orders from your phone.",
    image: "https://firebasestorage.googleapis.com/v0/b/sellquic.firebasestorage.app/o/homepage%20images%2F0BBD63C8-5F9B-4DB2-9AB1-F9E4EC2FC9BB.jpeg?alt=media&token=b248b04a-e95c-4654-8cac-e77e137b1ad0",
    color: "bg-blue-50"
  },
  {
    id: 2,
    title: "Payments",
    desc: "Accept Mobile Money, Visa, and Cash on Delivery. Confirmed automatically.",
    image: "https://firebasestorage.googleapis.com/v0/b/sellquic.firebasestorage.app/o/homepage%20images%2FCopy%20of%20SellQuic-%20Post%20Template%20(4).png?alt=media&token=172b8121-ecba-48aa-b1e9-39683f5e5bb0",
    color: "bg-green-50"
  },
  {
    id: 3,
    title: "Marketing",
    desc: "SEO, Facebook Pixel, and urgency timers built-in and ready to use.",
    image: "https://firebasestorage.googleapis.com/v0/b/sellquic.firebasestorage.app/o/homepage%20images%2FCopy%20of%20SellQuic-%20Post%20Template%20(3).png?alt=media&token=fd28556f-d036-42be-95a6-f49159add149",
    color: "bg-orange-50"
  }
];

export default function ArcCarousel() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % FEATURES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleCardClick = (clickedIndex: number) => {
    setIndex(clickedIndex);
  };

  return (
    <section className="relative w-full bg-[#FBFBFF] py-20 md:py-32 overflow-hidden min-h-[1000px]">
      
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-purple-100/40 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-blue-100/30 rounded-full blur-[140px]" />
      </div>
      
      <div className="max-w-7xl mx-auto px-6 text-center relative z-10">
        
        {/* --- SECTION HEADER --- */}
        <div className="max-w-4xl mx-auto mb-10">
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-4xl md:text-7xl font-[1000] tracking-tighter leading-[0.95] mb-8 uppercase text-[#0A1D3A]"
            >
              One platform. Every part of your <br className="hidden md:block" />
              <span className="bg-gradient-to-r from-[#5722c1] via-[#db2777] to-[#ea580c] bg-clip-text text-transparent">
                business. Powered by AI.
              </span>
            </motion.h2>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-sm md:text-base text-black font-bold leading-relaxed max-w-2xl mx-auto text-center mb-10"
            >
              Africa’s First AI-powered selling platform — now live in Ghana. 
            </motion.p>
        </div>

        {/* --- CLEANED & SMALLER CONNECTIVITY VISUAL --- */}
        <div className="relative w-full max-w-lg mx-auto h-[220px] md:h-[280px] mb-20 flex items-center justify-center">
          {/* Animated Paths converging to center */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 400 300">
            <motion.path 
              d="M100,80 L200,150" stroke="#22c55e" strokeWidth="2" strokeDasharray="6,4" fill="none" opacity="0.4"
              animate={{ strokeDashoffset: [-20, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            />
            <motion.path 
              d="M300,80 L200,150" stroke="#db2777" strokeWidth="2" strokeDasharray="6,4" fill="none" opacity="0.4"
              animate={{ strokeDashoffset: [-20, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            />
            <motion.path 
              d="M200,240 L200,150" stroke="#5722c1" strokeWidth="2" strokeDasharray="6,4" fill="none" opacity="0.4"
              animate={{ strokeDashoffset: [-20, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            />
          </svg>

          {/* Real WhatsApp Icon Node */}
          <motion.div className="absolute top-0 left-0 md:left-10 bg-white/70 backdrop-blur-md border border-white/50 p-3 md:p-4 rounded-2xl shadow-xl flex items-center gap-3">
            <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" className="w-6 h-6 md:w-8 md:h-8" alt="WhatsApp" />
            <span className="text-[9px] font-black uppercase text-gray-700 tracking-widest">WhatsApp</span>
          </motion.div>

          {/* Instagram Node */}
          <motion.div className="absolute top-0 right-0 md:right-10 bg-white/70 backdrop-blur-md border border-white/50 p-3 md:p-4 rounded-2xl shadow-xl flex items-center gap-3">
            <div className="w-6 h-6 md:w-8 md:h-8 bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] rounded-lg flex items-center justify-center text-white">
              <Instagram size={16} />
            </div>
            <span className="text-[9px] font-black uppercase text-gray-700 tracking-widest">Instagram</span>
          </motion.div>

          {/* Website Node */}
          <motion.div className="absolute bottom-0 bg-white/70 backdrop-blur-md border border-white/50 p-3 md:p-4 rounded-2xl shadow-xl flex items-center gap-3">
            <div className="w-6 h-6 md:w-8 md:h-8 bg-primary rounded-lg flex items-center justify-center text-white">
              <Globe size={16} />
            </div>
            <span className="text-[9px] font-black uppercase text-gray-700 tracking-widest">Your Website</span>
          </motion.div>

          {/* Subtle Central Hub Spark (No giant circle) */}
          <div className="w-4 h-4 bg-primary rounded-full blur-sm animate-ping opacity-40" />
          <div className="absolute w-2 h-2 bg-primary rounded-full" />
        </div>

        {/* --- THE ARC CAROUSEL --- */}
        <div className="relative h-[300px] md:h-[450px] mb-10 flex justify-center items-center">
          {FEATURES.map((item, i) => {
            const offset = (i - index + FEATURES.length) % FEATURES.length;
            const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
            const xOffset = isMobile ? 180 : 320;

            const positions = [
              { x: 0, y: -60, s: 1.2, z: 50, o: 1, r: 0 },      
              { x: xOffset, y: 60, s: 0.65, z: 30, o: 0.4, r: 12 },  
              { x: 0, y: 140, s: 0.4, z: 10, o: 0, r: 0 },     
              { x: -xOffset, y: 60, s: 0.65, z: 30, o: 0.4, r: -12 }, 
            ];
            
            const pos = positions[offset];

            return (
              <motion.div
                key={item.id}
                onClick={() => handleCardClick(i)}
                initial={false}
                animate={{
                  x: pos.x,
                  y: pos.y,
                  scale: pos.s,
                  zIndex: pos.z,
                  opacity: pos.o,
                  rotate: pos.r
                }}
                transition={{ type: "spring", stiffness: 90, damping: 20 }}
                className={`absolute top-0 w-40 h-52 md:w-64 md:h-80 ${item.color} rounded-[2rem] md:rounded-[3rem] shadow-2xl overflow-hidden border-4 border-white p-1.5 cursor-pointer`}
              >
                 <img src={item.image} alt={item.title} className="w-full h-full object-cover rounded-[1.7rem] md:rounded-[2.7rem]" />
              </motion.div>
            );
          })}
        </div>

        {/* Central Figure */}
        <div className="relative z-40 flex justify-center -mt-40 md:-mt-64 pointer-events-none">
           <img 
            src="https://firebasestorage.googleapis.com/v0/b/sellquic.firebasestorage.app/o/homepage%20images%2FUntitled%20design%20(64).png?alt=media&token=8481d02e-c414-4973-8760-72e5739b0975" 
            alt="Seller"
            className="w-full max-w-[450px] md:max-w-[650px] object-contain drop-shadow-[0_45px_45px_rgba(0,0,0,0.25)]"
           />
        </div>

        {/* Dynamic Text */}
        <div className="mt-8 md:mt-12 max-w-2xl mx-auto min-h-[140px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <h3 className="text-3xl md:text-6xl font-[1000] text-[#0A1D3A] tracking-tighter uppercase leading-[0.9]">
                {FEATURES[index].title}
              </h3>
              <p className="text-lg md:text-xl text-gray-500 font-medium leading-relaxed">
                {FEATURES[index].desc}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

      </div>
    </section>
  );
}