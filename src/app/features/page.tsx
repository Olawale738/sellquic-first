"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { 
  MessageSquare, Instagram, Link2, Sparkles, Smartphone, 
  RefreshCcw, Layers, CreditCard, Bell, Search, BarChart3, 
  Zap, ArrowRight, ShieldCheck, CheckCircle2, MessageCircle, 
  LayoutDashboard, PenTool, Globe, Timer, Tag, Megaphone
} from 'lucide-react';

// CORRECT LANDING PAGE IMPORTS
import { HomeHeader } from '@/components/landing/HomeHeader';
import { footer } from '@/components/landing/footer';

// Feature Card Component
const FeatureCard = ({ icon: Icon, title, desc }: any) => (
  <motion.div 
    whileHover={{ y: -5 }}
    className="p-8 bg-white rounded-[2rem] border border-[#0A1D3A]/5 shadow-sm hover:shadow-xl transition-all duration-300"
  >
    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary mb-6">
      <Icon size={24} />
    </div>
    <h3 className="text-xl font-black text-[#0A1D3A] mb-3 uppercase tracking-tight">{title}</h3>
    <p className="text-gray-500 font-medium leading-relaxed text-sm">{desc}</p>
  </motion.div>
);

export default function FeaturesPage() {
  return (
    <div className="bg-[#F6F0DC] min-h-screen">
      <HomeHeader />

      <main className="pt-20">
        {/* --- HERO --- */}
        <section className="pt-32 pb-20 px-6">
          <div className="max-w-7xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-primary/10 mb-8 shadow-sm"
            >
              <Sparkles size={14} className="text-primary" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary tracking-widest">All-In-One Platform</span>
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl md:text-8xl font-black tracking-tighter text-[#0A1D3A] leading-[0.9] mb-10 uppercase"
            >
              Everything your business <br />
              <span className="text-primary italic font-serif font-light lowercase">needs.</span>
            </motion.h1>
            
            <p className="text-xl text-gray-600 max-w-2xl mx-auto font-bold leading-relaxed">
              One AI assistant. One website. Payments, marketing, and customer tools — all built in, all working together, all powered by AI.
            </p>
          </div>
        </section>

        {/* --- AI ASSISTANT --- */}
        <section id="ai" className="py-24 px-6 bg-white rounded-t-[4rem] shadow-[0_-20px_40px_rgba(0,0,0,0.02)]">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col lg:flex-row gap-16 items-start">
              <div className="w-full lg:w-1/3 lg:sticky lg:top-32">
                <h2 className="text-4xl md:text-6xl font-black text-[#0A1D3A] leading-[0.95] mb-6 uppercase tracking-tighter">ONE AI ASSISTANT. SELLING FOR YOU AROUND THE CLOCK.</h2>
                <p className="text-gray-500 font-medium mb-8 text-lg">Your AI assistant works on WhatsApp, Instagram, your store, and your chat link — 24 hours a day, 7 days a week.</p>
                <button 
                  onClick={() => window.location.href = 'https://sellquic.com/signup'}
                  className="bg-primary text-white px-10 py-5 rounded-2xl font-black flex items-center gap-2 hover:scale-105 transition-all shadow-xl shadow-primary/20 uppercase tracking-widest text-sm"
                >
                  Get Your AI Assistant <ArrowRight size={18} />
                </button>
              </div>
              
              <div className="w-full lg:w-2/3 grid md:grid-cols-2 gap-6">
                <FeatureCard icon={MessageSquare} title="WhatsApp" desc="Reply to every WhatsApp message. Automatically. Your AI connects to your WhatsApp Business account and replies instantly — answering questions, taking orders, and confirming payments." />
                <FeatureCard icon={Instagram} title="Instagram DMs" desc="Turn every Instagram DM into a sale. Your AI handles product inquiries, sends prices and images, and closes sales inside the conversation. No delays. No missed messages." />
                <FeatureCard icon={Link2} title="Dedicated Chat Link" desc="One link. Your AI — everywhere. Share it on your bio, WhatsApp status, or flyers. Customers click it and your AI answers immediately — no app needed." />
                <FeatureCard icon={MessageCircle} title="Website Chat" desc="Every SellQuic store has a built-in chat button. When a customer is browsing and has a question, your AI responds instantly right there on the store." />
                <FeatureCard icon={PenTool} title="AI Description Writer" desc="Professional product descriptions. Done in seconds. Type a few keywords and your AI writes a compelling description instantly. Works for fashion, food, beauty, and more." />
                <FeatureCard icon={RefreshCcw} title="Customer Follow-Ups" desc="Know your customers. Never lose one. Your AI remembers every customer, what they bought, when they ordered, and when to follow up." />
                <FeatureCard icon={LayoutDashboard} title="AI Insights" desc="See exactly how your AI is performing. Check how many customers it has chatted with and how many orders it has taken from your dashboard." />
                <FeatureCard icon={ShieldCheck} title="Your Branded AI" desc="Give it a name and set the tone (polite, professional, casual). If a customer asks a sensitive question, your AI steps aside and alerts you instantly by SMS." />
              </div>
            </div>
          </div>
        </section>

        {/* --- ONLINE STORE --- */}
        <section id="store" className="relative py-24 md:py-32 px-6 bg-[#5722c1] overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] z-20">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05)_0%,transparent_80%)] pointer-events-none" />
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="flex flex-col lg:flex-row-reverse gap-16 items-start">
              
              <div className="w-full lg:w-1/3 lg:sticky lg:top-32">
                <h2 className="text-4xl md:text-6xl font-black leading-[0.95] mb-6 text-white uppercase tracking-tighter">
                  YOUR ONLINE STORE. <br /> SET UP IN MINUTES.
                </h2>
                <p className="text-purple-100 font-bold mb-8 text-lg leading-relaxed">
                  When you sign up, you get a fully functioning storefront and your own link, manageable entirely from your phone.
                </p>
                <button 
                  onClick={() => window.location.href = 'https://sellquic.com/signup'}
                  className="bg-white text-[#5722c1] px-10 py-5 rounded-2xl font-black text-lg hover:bg-[#F6F0DC] transition-all hover:scale-105 shadow-2xl uppercase tracking-widest"
                >
                  Set Up Your Store →
                </button>
              </div>
              
              <div className="w-full lg:w-2/3 grid md:grid-cols-2 gap-6">
                <div className="p-8 bg-white/10 backdrop-blur-md border border-white/20 rounded-[2.5rem] text-white transition-all">
                  <Globe className="text-white mb-6" size={40} />
                  <h3 className="text-2xl font-black mb-3 uppercase tracking-tight">Your SellQuic Store</h3>
                  <p className="text-purple-100 text-sm font-medium leading-relaxed">A real business website at your own link (mystore.sellquic.com). Customers can browse, chat with AI, and place orders. No coding needed.</p>
                </div>
                <div className="p-8 bg-white/10 backdrop-blur-md border border-white/20 rounded-[2.5rem] text-white transition-all">
                  <Smartphone className="text-white mb-6" size={40} />
                  <h3 className="text-2xl font-black mb-3 uppercase tracking-tight">Manage from Phone</h3>
                  <p className="text-purple-100 text-sm font-medium leading-relaxed">Add products, manage orders, and update prices from your pocket. SellQuic is built mobile-first for how Ghanaian vendors work.</p>
                </div>
                <div className="p-8 bg-white/10 backdrop-blur-md border border-white/20 rounded-[2.5rem] text-white transition-all">
                  <Instagram className="text-white mb-6" size={40} />
                  <h3 className="text-2xl font-black mb-3 uppercase tracking-tight">Instagram Import</h3>
                  <p className="text-purple-100 text-sm font-medium leading-relaxed">Already selling on Instagram? Connect and import your products into your store in seconds. No manual uploading required.</p>
                </div>
                <div className="p-8 bg-white/10 backdrop-blur-md border border-white/20 rounded-[2.5rem] text-white transition-all">
                  <Layers className="text-white mb-6" size={40} />
                  <h3 className="text-2xl font-black mb-3 uppercase tracking-tight">Product Variations</h3>
                  <p className="text-purple-100 text-sm font-medium leading-relaxed">Sell every size, color, and style. Add variations with their own price and images. Your AI always knows exactly what's in stock.</p>
                </div>
                <div className="p-8 bg-white/10 backdrop-blur-md border border-white/20 rounded-[2.5rem] text-white transition-all">
                  <CheckCircle2 className="text-white mb-6" size={40} />
                  <h3 className="text-2xl font-black mb-3 uppercase tracking-tight">Order Tracking</h3>
                  <p className="text-purple-100 text-sm font-medium leading-relaxed">Every order. Every customer. All in one dashboard. manage deliveries and access full customer details organized and easy to find.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* --- PAYMENTS --- */}
        <section id="payments" className="py-24 px-6 bg-white">
          <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-20 items-center">
            <div>
              <h2 className="text-4xl md:text-6xl font-black text-[#0A1D3A] leading-[0.95] mb-6 uppercase tracking-tighter">GET PAID. AUTOMATICALLY. EVERY TIME.</h2>
              <p className="text-gray-500 font-bold text-lg mb-10">SellQuic handles your payments — no chasing, no screenshots, no manual confirmations. Your money arrives automatically.</p>
              
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-600 mt-1"><CheckCircle2 size={14} /></div>
                  <div>
                    <h4 className="font-black text-[#0A1D3A] uppercase text-sm">Local & Global Payments</h4>
                    <p className="text-gray-500 text-sm">Accept MTN MoMo, Vodafone Cash, AirtelTigo, Visa, and Mastercard. Money arrives in your account the next day.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-600 mt-1"><CheckCircle2 size={14} /></div>
                  <div>
                    <h4 className="font-black text-[#0A1D3A] uppercase text-sm">Real-Time Order Alerts</h4>
                    <p className="text-gray-500 text-sm">The second a customer orders, you get an instant SMS and email with who ordered and how much they paid.</p>
                  </div>
                </div>
              </div>
              <button onClick={() => window.location.href = 'https://sellquic.com/signup'} className="mt-12 bg-primary text-white px-10 py-5 rounded-2xl font-black uppercase tracking-widest text-sm hover:scale-105 transition-all shadow-xl shadow-primary/20">Start Getting Paid →</button>
            </div>
            
            <div className="bg-[#F6F0DC] rounded-[3rem] p-10 relative overflow-hidden shadow-2xl">
               <div className="bg-white p-8 rounded-3xl shadow-xl relative z-10 border border-primary/10">
                  <div className="flex justify-between items-center mb-10">
                     <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white font-black italic">SQ</div>
                     <span className="text-[10px] font-black bg-green-100 text-green-700 px-4 py-1.5 rounded-full uppercase tracking-widest">Confirmed</span>
                  </div>
                  <p className="text-gray-400 text-[10px] font-black uppercase mb-1 tracking-widest">Order Payment Received</p>
                  <p className="text-4xl font-black text-[#0A1D3A] tracking-tighter">GH₵ 1,450.00</p>
                  <div className="mt-10 pt-6 border-t border-gray-50 text-[10px] text-gray-400 font-black uppercase tracking-widest">VIA MTN MOBILE MONEY</div>
               </div>
               <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
            </div>
          </div>
        </section>

        {/* --- MARKETING --- */}
        <section id="marketing" className="py-24 px-6 bg-gray-50">
          <div className="max-w-7xl mx-auto text-center mb-16">
            <h2 className="text-4xl md:text-6xl font-black text-[#0A1D3A] leading-[0.95] uppercase tracking-tighter">GROW YOUR SALES. <br /> WITHOUT EXTRA WORK.</h2>
            <p className="text-gray-500 font-bold mt-4 text-xl">SellQuic's built-in marketing tools help more customers find you and convert — automatically.</p>
          </div>
          
          <div className="max-w-7xl mx-auto grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
             <FeatureCard icon={Search} title="SEO" desc="Get found on Google. Your store is built with SEO in it so when customers search for your products, your store can show up." />
             <FeatureCard icon={BarChart3} title="Facebook & Google Pixel" desc="Run smarter ads. Connect your pixels to track exactly which ads are performing and what customers are buying." />
             <FeatureCard icon={Megaphone} title="Announcement Bar" desc="Add a bold banner to the top of your store to announce a sale or a new product for instant visibility and maximum impact." />
             <FeatureCard icon={Tag} title="Smart Discounts" desc="Auto-calculate discounted prices and display the savings clearly. Makes buying feel like an easy, smart decision for your customers." />
             <FeatureCard icon={Timer} title="Urgency Timers" desc="Create urgency. Sell faster. Add a countdown timer to any sale. When customers see time running out, they stop hesitating and buy." />
          </div>
          <div className="text-center">
            <button onClick={() => window.location.href = 'https://sellquic.com/signup'} className="bg-primary text-white px-12 py-5 rounded-2xl font-black uppercase tracking-widest text-sm hover:scale-105 transition-all shadow-xl shadow-primary/20">Start Selling Smarter →</button>
          </div>
        </section>

        {/* --- FINAL CTA --- */}
        <section className="relative py-24 md:py-40 px-6 overflow-hidden bg-[#5722c1]">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/10 rounded-full blur-[120px] -mr-64 -mt-64" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-black/20 rounded-full blur-[100px] -ml-32 -mb-32" />

          <div className="max-w-5xl mx-auto relative z-10 text-center text-white">
            <h2 className="text-4xl md:text-8xl font-black tracking-tighter leading-[0.95] text-white mb-8 uppercase">
              YOUR CUSTOMERS ARE WAITING. <br />
              <span className="text-[#A5F3FC]">YOUR AI IS READY.</span>
            </h2>

            <p className="text-xl md:text-2xl text-white/80 max-w-2xl mx-auto mb-12 font-bold leading-relaxed">
              Sign up today. Set up your store. Connect WhatsApp and Instagram. 
              Get <span className="text-white underline decoration-[#A5F3FC] decoration-4">7 days free</span> — no credit card needed.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <button 
                onClick={() => window.location.href = 'https://sellquic.com/signup'}
                className="w-full sm:w-auto px-12 py-6 bg-white text-[#5722c1] rounded-2xl font-black text-xl hover:bg-[#F6F0DC] transition-all hover:scale-105 active:scale-95 shadow-2xl flex items-center justify-center gap-3 uppercase tracking-widest"
              >
                Create Your Free Website <ArrowRight size={22} />
              </button>
              
              <button 
                onClick={() => window.location.href = '/pricing'}
                className="w-full sm:w-auto px-12 py-6 bg-transparent border-2 border-white/30 text-white rounded-2xl font-black text-xl hover:bg-white/10 transition-all uppercase tracking-widest"
              >
                View Pricing
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer />
    </div>
  );
}