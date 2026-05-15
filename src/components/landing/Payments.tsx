"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Smartphone, Globe, Truck, Zap, ShieldCheck, CreditCard } from 'lucide-react';
import Link from 'next/link';

const METHODS = [
  {
    title: "Instant Mobile Money",
    desc: "MTN, Telecel, and AirtelTigo Money — instantly confirmed.",
    icon: <Smartphone className="text-orange-500" />
  },
  {
    title: "Visa & Mastercard",
    desc: "Accept card payments from customers anywhere in the world.",
    icon: <Globe className="text-blue-400" />
  },
  {
    title: "Payment on Delivery",
    desc: "Build trust by letting customers pay when they receive orders.",
    icon: <Truck className="text-emerald-400" />
  },
  {
    title: "Next-Day Payouts",
    desc: "No waiting. Your money lands in your account automatically.",
    icon: <Zap className="text-purple-400" />
  }
];

export default function Payments() {
  return (
    <section className="relative py-24 md:py-32 bg-[#050505] text-white overflow-hidden">
      {/* Designer Background: Deep Glows */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-[#5722c1]/20 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-orange-500/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="flex flex-col lg:flex-row gap-16 lg:gap-24 items-center">
          
          {/* --- LEFT SIDE: CONTENT --- */}
          <div className="w-full lg:w-1/2">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-8"
            >
              <ShieldCheck size={14} className="text-[#5722c1]" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-300">Secure Settlement</span>
            </motion.div>

            <h2 className="text-4xl md:text-7xl font-black mb-8 leading-[0.9] tracking-tighter uppercase">
              Accept Global & <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#5722c1] to-orange-500">Local Payments.</span>
            </h2>
            
            <p className="text-lg md:text-xl text-gray-400 mb-12 font-medium leading-relaxed max-w-xl">
              From Momo in Kumasi to Visa in Vancouver, Sellquic handles the checkout so you can focus on the product.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
              {METHODS.map((m, i) => (
                <div key={i} className="group">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 border border-white/10">
                    {m.icon}
                  </div>
                  <h4 className="font-black text-white uppercase text-sm tracking-widest mb-2">{m.title}</h4>
                  <p className="text-sm text-gray-500 leading-relaxed">{m.desc}</p>
                </div>
              ))}
            </div>

            <Link href="https://sellquic.com/signup" className="contents">
  <button className="mt-14 w-full sm:w-auto bg-white text-black px-10 py-5 rounded-2xl font-black text-lg hover:bg-[#5722c1] hover:text-white transition-all shadow-2xl active:scale-95">
    Start Accepting Payments
  </button>
</Link>
          </div>

          {/* --- RIGHT SIDE: REALISTIC CARDS --- */}
          <div className="w-full lg:w-1/2 flex justify-center perspective-1000">
            <div className="relative w-full max-w-[450px] aspect-square flex items-center justify-center">
               
               {/* REALISTIC VISA CARD */}
               <motion.div 
                 initial={{ opacity: 0, rotateY: 20, y: 40 }}
                 whileInView={{ opacity: 1, rotateY: -15, y: 0 }}
                 viewport={{ once: true }}
                 transition={{ duration: 1, ease: "easeOut" }}
                 className="relative w-full max-w-[380px] h-[240px] bg-gradient-to-br from-gray-800 via-gray-900 to-black rounded-[1.5rem] p-8 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] border border-white/10 overflow-hidden group"
               >
                  {/* Card Reflection Shimmer */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                  
                  <div className="flex justify-between items-start mb-12">
                    {/* Silver Chip */}
                    <div className="w-12 h-10 bg-gradient-to-br from-gray-300 to-gray-500 rounded-md relative overflow-hidden">
                       <div className="absolute inset-0 opacity-20 bg-[grid-pattern]" />
                    </div>
                    <div className="text-2xl font-black italic text-white/40 tracking-tighter">VISA</div>
                  </div>

                  <div className="space-y-4">
                    <div className="h-2 w-48 bg-white/10 rounded-full" />
                    <div className="flex gap-4">
                       <div className="h-2 w-12 bg-white/10 rounded-full" />
                       <div className="h-2 w-12 bg-white/10 rounded-full" />
                    </div>
                  </div>

                  <div className="absolute bottom-8 right-8">
                     <div className="flex gap-1 opacity-20">
                        <div className="w-8 h-8 rounded-full bg-red-500" />
                        <div className="w-8 h-8 rounded-full bg-orange-500 -ml-4" />
                     </div>
                  </div>
               </motion.div>

               {/* REALISTIC MOMO NOTIFICATION */}
               <motion.div 
                 initial={{ opacity: 0, x: 50 }}
                 whileInView={{ opacity: 1, x: 0 }}
                 viewport={{ once: true }}
                 transition={{ delay: 0.5, duration: 0.8 }}
                 className="absolute top-0 right-[-20px] md:right-0 z-20 w-full max-w-[280px]"
               >
                  <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-5 shadow-2xl ring-1 ring-black/50">
                    <div className="flex items-center gap-4 mb-4">
                       <div className="w-10 h-10 bg-[#FFCC00] rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                          <img src="https://upload.wikimedia.org/wikipedia/commons/a/af/MTN_Logo.svg" className="w-6 h-6" alt="MTN" />
                       </div>
                       <div>
                          <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Instant Alert</p>
                          <p className="text-sm font-black text-white">Payment Received</p>
                       </div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                       <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-400 font-bold">Amount</span>
                          <span className="text-sm font-black text-green-400">+ GH₵ 850.00</span>
                       </div>
                    </div>
                  </div>
               </motion.div>

               

            </div>
          </div>

        </div>
      </div>

      <style jsx>{`
        .perspective-1000 {
          perspective: 1200px;
        }
      `}</style>
    </section>
  );
}