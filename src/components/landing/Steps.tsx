"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { 
  ShoppingCart, Instagram, MessageSquare, 
  Smartphone, Zap, Sparkles 
} from 'lucide-react';

const STEPS = [
  {
    title: "1. Create your store",
    desc: "Sign up, add business details, and upload products. Your AI learns everything from here.",
    color: "bg-[#FF6B6B]",
    textColor: "text-white"
  },
  {
    title: "2. Customise your AI",
    desc: "Give your AI a name, set the tone, and connect WhatsApp. Done in minutes.",
    color: "bg-white",
    textColor: "text-[#5722c1]"
  },
  {
    title: "3. AI starts selling",
    desc: "Your AI replies, takes orders, and follows up — day and night. You just check your dashboard.",
    color: "bg-[#A5F3FC]",
    textColor: "text-[#0A1D3A]"
  }
];

// Optimized Floating Icon: Reduced animation complexity for performance
const FloatingIcon = ({ icon: Icon, top, left, right, bottom, delay = 0 }: any) => (
  <motion.div
    initial={{ opacity: 0 }}
    whileInView={{ opacity: 0.2 }}
    animate={{ y: [0, -10, 0] }}
    transition={{ duration: 4, repeat: Infinity, delay, ease: "linear" }}
    style={{ position: 'absolute', top, left, right, bottom }}
    className="hidden lg:block text-[#5722c1]"
  >
    <Icon size={32} />
  </motion.div>
);

export default function Steps() {
  return (
    <section className="relative w-full bg-[#FBF7EA] overflow-hidden py-12 lg:py-24">
      
      {/* PERFORMANCE FIX: Replaced heavy animated blobs with lightweight static radial gradients */}
      <div className="absolute inset-0 z-0 opacity-30 pointer-events-none">
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-purple-200 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-100 rounded-full blur-[100px] translate-x-1/2 translate-y-1/2" />
      </div>

      {/* Limited icons to improve mobile rendering speed */}
      <FloatingIcon icon={ShoppingCart} top="15%" left="8%" />
      <FloatingIcon icon={MessageSquare} bottom="15%" left="5%" />
      <FloatingIcon icon={Instagram} top="25%" right="10%" />

      <div className="max-w-[1400px] mx-auto px-6 relative z-10 w-full">
        {/* Changed to flex-col-reverse: Image (Right Side) comes FIRST on mobile */}
        <div className="flex flex-col-reverse lg:flex-row items-center justify-between gap-12 lg:gap-20">
          
          {/* LEFT CONTENT: TEXT & CARDS */}
          <div className="w-full lg:w-1/2 flex flex-col items-start">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              className="inline-flex items-center gap-2 bg-white border border-[#5722c1]/10 px-4 py-1.5 rounded-full mb-6 shadow-sm"
            >
              <Sparkles size={14} className="text-[#5722c1]" />
              <span className="text-[#5722c1] text-[10px] font-black uppercase tracking-[0.2em]">Setup in minutes</span>
            </motion.div>

            <motion.h2 
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="text-4xl md:text-7xl lg:text-[5.5rem] font-black leading-[1] tracking-tighter text-[#0A1D3A] mb-8"
            >
              Setup, Sell, <br /> & <span className="text-[#5722c1]">Grow your Business.</span>
            </motion.h2>
            
            <div className="flex flex-col gap-3 w-full max-w-lg">
              {STEPS.map((step, idx) => (
                <div
                  key={idx}
                  className={`${step.color} p-5 rounded-2xl shadow-sm border border-black/5 flex flex-col justify-center transition-transform active:scale-95`}
                >
                  <h4 className={`text-[10px] font-black uppercase tracking-widest ${step.textColor} mb-1 opacity-70`}>
                    {step.title}
                  </h4>
                  <p className={`${step.textColor} font-bold text-sm md:text-base leading-snug`}>
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT CONTENT: THE SUCCESS FIGURE (Appears first on mobile) */}
          <div className="w-full lg:w-1/2 flex justify-center lg:justify-end items-end relative">
             {/* Simple Navy circle backdrop */}
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] md:w-[500px] md:h-[500px] bg-[#0A1D3A] rounded-full z-0" />
             
             {/* Person Image with Shimmer Effect */}
             <motion.div
               initial={{ opacity: 0, scale: 0.9 }}
               whileInView={{ opacity: 1, scale: 1 }}
               transition={{ duration: 0.5 }}
               className="relative z-10 w-full max-w-[550px] group"
             >
                <img 
                  src="https://firebasestorage.googleapis.com/v0/b/sellquic.firebasestorage.app/o/homepage%20images%2FGenerated%20Image%20April%2024%2C%202026%20-%2011_36PM.jpg?alt=media&token=caa937be-01c4-4b4c-ac82-9752417da56d" 
                  alt="Successful Seller" 
                  className="w-full h-auto object-contain drop-shadow-2xl brightness-110 group-hover:brightness-125 transition-all duration-700"
                  loading="eager" 
                />
                {/* Subtle Shimmer Overlay */}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-full pointer-events-none" />
             </motion.div>
          </div>

        </div>
      </div>
    </section>
  );
}