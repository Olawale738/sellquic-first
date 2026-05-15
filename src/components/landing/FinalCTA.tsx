"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link'; // Added Link import

const FinalCTA = () => {
  return (
    <section className="py-12 md:py-24 px-4 md:px-6 bg-white">
      <div className="container mx-auto max-w-5xl">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-primary rounded-[2.5rem] md:rounded-[4rem] p-8 md:p-20 text-center text-white relative overflow-hidden shadow-2xl"
        >
          {/* Decorative background glows */}
          <div className="absolute top-0 right-0 w-48 h-48 md:w-96 md:h-96 bg-orange-500/20 rounded-full -mr-16 -mt-16 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-32 h-32 md:w-64 md:h-64 bg-white/5 rounded-full -ml-8 -mb-8 blur-2xl pointer-events-none" />
          
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 px-4 py-1.5 rounded-full mb-6 backdrop-blur-sm">
              <Sparkles size={14} className="text-orange-300" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Ready to start?</span>
            </div>

            <h2 className="text-2xl sm:text-3xl md:text-6xl font-black tracking-tight leading-[1.1] mb-6 uppercase">
              Your customers are <br className="hidden md:block" /> messaging right now. <br />
              <span className="text-orange-300 italic font-serif lowercase tracking-normal">Is your AI ready?</span>
            </h2>

            <p className="text-sm md:text-xl text-primary-foreground/90 mb-10 max-w-2xl mx-auto font-medium leading-relaxed">
              Sign up today. No credit card needed. <br className="md:hidden" /> 
              Your AI starts selling for you from day one.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              {/* START FREE TRIAL LINK */}
              <Link href="/signup" className="w-full sm:w-auto">
                <button className="w-full bg-white text-primary px-8 md:px-12 py-4 md:py-5 rounded-2xl font-black text-base md:text-xl hover:bg-orange-50 transition-all hover:scale-105 active:scale-95 shadow-xl flex items-center justify-center gap-2">
                  Start Free Trial <ArrowRight size={20} />
                </button>
              </Link>
              
              {/* VIEW PRICING LINK */}
              <Link href="#" className="w-full sm:w-auto">
                <button className="w-full border-2 border-white/20 text-white px-8 md:px-12 py-4 md:py-5 rounded-2xl font-black text-base md:text-xl hover:bg-white/10 transition-all">
                  View Pricing
                </button>
              </Link>
            </div>
            
            <div className="mt-10 flex flex-col md:flex-row items-center justify-center gap-4 text-[10px] md:text-sm text-primary-foreground/60 font-bold uppercase tracking-widest">
              <span>No Credit Card Required</span>
              <span className="hidden md:block">•</span>
              <span>7-Day Free Trial</span>
              <span className="hidden md:block">•</span>
              <span>Cancel Anytime</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default FinalCTA;