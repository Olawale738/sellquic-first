"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Clock, MessageCircleOff, TrendingDown, AlertCircle } from 'lucide-react';

const Problem = () => {
  return (
    <section className="py-16 lg:py-24 bg-slate-950 text-white overflow-hidden">
      <div className="container mx-auto px-6">
        {/* Changed to flex-col-reverse on mobile to put Image (Right Side) on TOP */}
        <div className="flex flex-col-reverse lg:grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          
          {/* LEFT SIDE: THE PAIN POINTS (Appears second on mobile) */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl md:text-5xl font-extrabold leading-tight mb-6 lg:mb-8">
              Every unanswered message is a <span className="text-orange-500 underline decoration-2 underline-offset-8">lost sale.</span>
            </h2>
            <p className="text-gray-400 text-base md:text-lg mb-8 leading-relaxed max-w-xl">
              Manually responding to every customer on WhatsApp and Instagram is not sustainable. 
              When you don’t reply in time, they move on.
            </p>
            
            <div className="space-y-4 lg:space-y-6">
              {[
                { icon: <Clock className="text-orange-500 w-5 h-5" />, text: "Replies expected in under 5 mins." },
                { icon: <MessageCircleOff className="text-orange-500 w-5 h-5" />, text: "30% of sales lost to late replies." },
                { icon: <TrendingDown className="text-orange-500 w-5 h-5" />, text: "Manual orders lead to mistakes." }
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-4 group">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                    {item.icon}
                  </div>
                  <p className="text-gray-300 font-medium text-sm md:text-lg">{item.text}</p>
                </div>
              ))}
            </div>

            {/* BUTTON UPDATED WITH LINK LOGIC ONLY */}
            <button 
              onClick={() => window.location.href = 'https://sellquic.com/signup'}
              className="w-full lg:w-auto mt-10 bg-orange-500 hover:bg-orange-600 text-white px-10 py-4 rounded-full font-black text-lg transition-all shadow-xl shadow-orange-500/20"
            >
              Get Your AI Assistant →
            </button>
          </motion.div>

          {/* RIGHT SIDE: THE IMAGE VISUAL (Appears first on mobile) */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="relative w-full"
          >
            {/* Optimized Background Glow */}
            <div className="absolute inset-0 bg-[#5722c1]/20 blur-[80px] lg:blur-[120px] rounded-full" />
            
            <div className="relative flex flex-col">
              {/* IMAGE CONTAINER */}
              <div className="relative rounded-[2rem] lg:rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl aspect-[4/5] lg:aspect-square">
                <img 
                  src="https://firebasestorage.googleapis.com/v0/b/sellquic.firebasestorage.app/o/homepage%20images%2FUntitled%20design%20(69).png?alt=media&token=e8325cee-4e32-469f-b7e3-d5f0ecdecc37" 
                  alt="Busy Seller" 
                  className="w-full h-full object-cover"
                  loading="eager" 
                />
              </div>

              {/* OVERLAY CARD */}
              <div className="mt-[-60px] lg:mt-0 lg:absolute lg:inset-0 lg:flex lg:flex-col lg:justify-end lg:p-8 z-20 px-4">
                <div className="bg-slate-900/80 lg:bg-white/10 backdrop-blur-md lg:backdrop-blur-lg border border-white/20 p-5 lg:p-6 rounded-3xl shadow-2xl">
                  
                  <p className="text-white font-bold text-sm md:text-xl leading-snug">
                    "Even while you’re off the clock, your AI assistant stays on — answering messages instantly, guiding customers, and helping close more sales."
                  </p>
                </div>
              </div>
            </div>

            {/* Mobile-optimized Badge */}
            <motion.div 
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-4 -right-2 lg:-top-6 lg:-right-6 bg-red-600 text-white px-4 py-2 lg:p-4 rounded-xl lg:rounded-2xl shadow-2xl font-black text-[10px] lg:text-sm z-30"
            >
              Sales in realtime
            </motion.div>
          </motion.div>

        </div>
      </div>
    </section>
  );
};

export default Problem;