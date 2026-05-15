"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, Bell, Zap, ShieldCheck, Sparkles } from 'lucide-react';

export default function AiCustomizer() {
  const [tone, setTone] = useState('Friendly');

  return (
    <section className="relative py-16 md:py-32 bg-white overflow-hidden">
      <div className="container mx-auto px-6">
        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* CONTENT SIDE */}
          <div className="lg:col-span-7 w-full">
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 border border-purple-100 mb-6"
            >
              <Sparkles size={12} className="text-[#5722c1]" />
              <span className="text-[10px] font-black uppercase tracking-widest text-[#5722c1]">YOUR BRANDED AI ASSISTANT</span>
            </motion.div>

            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-4xl md:text-7xl font-[1000] leading-[1] tracking-tighter text-gray-900 uppercase mb-6"
            >
              Give your AI <br />
              <span className="text-[#5722c1]">a personality.</span>
            </motion.h2>

            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-base md:text-xl text-gray-600 font-medium leading-relaxed max-w-xl mb-10"
            >
              Customise its name, tone, and welcome message to match exactly how you talk to your customers.
            </motion.p>

            {/* Feature Highlights - Compact for Mobile */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="flex gap-3">
                <div className="shrink-0 w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-[#5722c1]">
                  <Zap size={16} fill="currentColor" />
                </div>
                <div>
                  <h4 className="font-black text-gray-900 uppercase text-[11px] tracking-tight">Smart Handover</h4>
                  <p className="text-gray-500 text-xs leading-tight">SMS alerts when a human is needed.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="shrink-0 w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-[#5722c1]">
                  <ShieldCheck size={16} fill="currentColor" />
                </div>
                <div>
                  <h4 className="font-black text-gray-900 uppercase text-[11px] tracking-tight">Verified Data</h4>
                  <p className="text-gray-500 text-xs leading-tight">AI only uses your approved prices.</p>
                </div>
              </div>
            </div>
          </div>

          {/* WIDGET SIDE (Standalone & Bold) */}
          <div className="lg:col-span-5 w-full relative">
            {/* Background Glow */}
            <div className="absolute inset-0 bg-[#5722c1]/10 blur-[80px] rounded-full" />

            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="relative bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl overflow-hidden"
            >
              {/* Widget Header */}
              <div className="bg-[#5722c1] p-6 md:p-8 text-white relative">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                   <Settings size={80} />
                </div>
                <div className="relative z-10">
                  <div className="flex justify-between items-center mb-4">
                     <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  </div>
                  <h3 className="text-xl md:text-2xl font-black">Configure Ama</h3>
                  <p className="text-white/60 text-xs font-medium">Personalize your AI Agent</p>
                </div>
              </div>

              {/* Widget Body */}
              <div className="p-6 md:p-8 space-y-6 md:space-y-8">
                {/* Tone Selector */}
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 block mb-3">Assistant Tone</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['Friendly', 'Professional', 'Casual', 'Direct'].map((t) => (
                      <button
                        key={t}
                        onClick={() => setTone(t)}
                        className={`py-2.5 px-4 rounded-xl text-[10px] font-black transition-all border-2 ${
                          tone === t 
                          ? 'border-[#5722c1] bg-[#5722c1]/5 text-[#5722c1]' 
                          : 'border-gray-50 text-gray-400 hover:border-gray-200'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Handover Preview - Mobile Optimized */}
                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                  <div className="flex items-center gap-2 mb-3">
                    <Bell className="text-orange-500" size={14} />
                    <span className="text-[10px] font-black text-gray-900 uppercase tracking-tight">System Alert</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-50">
                    <p className="text-[8px] text-gray-400 font-bold mb-1">REAL-TIME NOTIFICATION</p>
                    <p className="text-[11px] font-bold text-gray-800 leading-tight">
                      "Manager, a customer is asking for a discount. Please step in!"
                    </p>
                  </div>
                </div>

                {/* UPDATED BUTTON LOGIC - NO DESIGN CHANGES */}
                <button 
                  onClick={() => window.location.href = 'https://sellquic.com/signup'}
                  className="w-full py-4 bg-[#5722c1] text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-[#451ba1] transition-all shadow-lg shadow-purple-500/20 active:scale-95"
                >
                  Activate Assistant
                </button>
              </div>
            </motion.div>
          </div>

        </div>
      </div>
    </section>
  );
}