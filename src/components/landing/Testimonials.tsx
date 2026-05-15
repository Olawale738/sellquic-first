"use client";

import React from 'react';
import { motion } from 'framer-motion';

const REVIEWS = [
  {
    id: 1,
    quote: "Being a busy mom and a business owner is a juggle, but Sellquic’s AI makes it seamless. I don't have to spend all day in DMs anymore; the AI assistant answers questions and takes orders on autopilot across all my channels. It saves me hours of manual work every day.",
    author: "Hikima, Kiddies must haves",
    logo: "https://firebasestorage.googleapis.com/v0/b/sellquic.firebasestorage.app/o/homepage%20images%2Flogos%2Fstores2FM7cEoI7dJLDPTgKcZF4r2Flogo.webp?alt=media&token=fdb008a7-4393-41c4-be4a-36312aca2637", 
    image: "https://firebasestorage.googleapis.com/v0/b/sellquic.firebasestorage.app/o/homepage%20images%2Flogos%2FCopy%20of%20SellQuic-%20Post%20Template%20(5).png?alt=media&token=1690f210-9781-4f97-af33-091f6bc286b4",
    featured: true
  },
  {
    id: 2,
    quote: "Sellquic is like having a manager who never sleeps. The AI handles my WhatsApp and Instagram inquiries instantly, giving my customers a premium experience while keeping my orders organized. It has turned my skincare brand into a 24/7 automated sales machine.",
    author: "Nana, Clear Body Ghana",
    logo: "https://firebasestorage.googleapis.com/v0/b/sellquic.firebasestorage.app/o/homepage%20images%2Flogos%2Fstores2FH8mpO0DSsF1480ra9jbe2Flogo.webp?alt=media&token=196fcf4e-d93c-4dc6-8073-1cb0aa26200e",
    featured: false
  },
  {
    id: 3,
    quote: "Selling ladies' footwear comes with endless questions about sizes and fits. Sellquic’s AI assistant is a lifesaver—it handles all my sizing queries on Instagram and WhatsApp instantly.",
    author: "Lois, PrettyFeet",
    logo: "https://firebasestorage.googleapis.com/v0/b/sellquic.firebasestorage.app/o/homepage%20images%2Flogos%2Fstores2F12BRyZLA50w8g5V4v8Os2Flogo%20(1).webp?alt=media&token=15b64833-3580-45ba-bdc3-c27c5584795c",
    featured: false
  }
];

export default function Testimonials() {
  const featured = REVIEWS.find(r => r.featured);
  const others = REVIEWS.filter(r => !r.featured);

  return (
    <section className="bg-[#EEF2FF] py-12 md:py-32 overflow-hidden"> 
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        
        {/* --- ADDED HEADER SECTION --- */}
        <div className="text-center max-w-3xl mx-auto mb-16 md:mb-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
           
            <h2 className="text-3xl md:text-6xl font-black text-gray-900 tracking-tighter leading-[1.1] mb-6">
            See what businesses <span className="text-primary">say about SellQuic</span>
            </h2>
            <p className="text-base md:text-xl text-black-300 font-medium leading-relaxed">
              Join 1000+ online businesses using Sellquic AI to automate their sales and reclaim their time.
            </p>
          </motion.div>
        </div>

        <div className="grid lg:grid-cols-12 gap-4 md:gap-6 items-stretch">
          
          {/* LEFT: The Main Glassmorphic Card (Hero on Mobile) */}
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="lg:col-span-7 relative rounded-[2rem] md:rounded-[2.5rem] overflow-hidden min-h-[400px] md:min-h-[550px] flex items-end shadow-2xl group"
          >
            {/* PERFORMANCE: Eager loading for the hero image */}
            <img 
              src={featured?.image} 
              alt="Vendor Success" 
              className="absolute inset-0 w-full h-full object-cover brightness-95 md:brightness-100 transition-transform duration-700 group-hover:scale-105"
              loading="eager"
            />
            
            {/* THE GLASS CARD: Optimized for visibility */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="relative w-full m-3 md:m-8 bg-white/20 backdrop-blur-md border border-white/30 rounded-[1.5rem] md:rounded-[2rem] p-5 md:p-8 shadow-2xl"
            >
              <p className="text-gray-900 text-sm md:text-xl font-bold leading-tight md:leading-relaxed mb-4 md:mb-8 italic">
                "{featured?.quote}"
              </p>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 md:w-12 md:h-12 rounded-full bg-white p-0.5 shadow-lg">
                   <img src={featured?.logo} className="w-full h-full rounded-full object-cover" alt="" />
                </div>
                <span className="font-black text-gray-900 text-xs md:text-lg tracking-tight uppercase text-shadow-sm">
                  {featured?.author}
                </span>
              </div>
            </motion.div>
          </motion.div>

          {/* RIGHT: Stacked Side Cards */}
          <div className="lg:col-span-5 flex flex-col gap-4 md:gap-6">
            {others.map((review, index) => (
              <motion.div 
                key={review.id} 
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.2 }}
                whileHover={{ y: -5 }}
                className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-10 flex flex-col justify-between shadow-sm border border-white/50 hover:shadow-xl transition-all duration-300"
              >
                <p className="text-gray-700 text-xs md:text-lg font-medium leading-snug md:leading-relaxed mb-4 md:mb-8">
                  "{review.quote}"
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center border border-gray-100 overflow-hidden">
                    <img src={review.logo} className="w-full h-full object-cover" alt="" />
                  </div>
                  <span className="font-bold text-gray-900 text-[10px] md:text-base tracking-tight uppercase">
                    {review.author}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}