'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { PlayCircle, FileText, ArrowRight, Search, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

import { HomeHeader } from '@/components/landing/HomeHeader';
import { footer } from '@/components/landing/footer';

const TUTORIALS_PREVIEW = [
  { 
    id: "1", 
    title: "The Ai assistant overview", 
    img: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=500",
    duration: "2:15"
  },
  { 
    id: "2", 
    title: "Lesson 4: Check, is your Ai is ready?", 
    img: "https://images.unsplash.com/photo-1556742044-3c52d6e88c62?auto=format&fit=crop&q=80&w=500",
    duration: "3:40"
  },
  { 
    id: "3", 
    title: "AI Configuration", 
    img: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&q=80&w=500",
    duration: "4:10"
  },
];

const BLOG_PREVIEW = [
  { id: 1, title: "How to Import From China to Ghana in 2026", desc: "A step-by-step guide to finding suppliers and logistics.", tag: "Sourcing" },
  { id: 2, title: "10 Best Products to Sell in Ghana (2026)", desc: "Product categories that move fast and keep customers back.", tag: "Trends" },
  { id: 3, title: "Find Trusted Suppliers on 1688", desc: "Navigate China’s biggest marketplace easily.", tag: "Sourcing" },
];

const GUIDES_PREVIEW = [
  { id: 1, title: "Connect Google Analytics", desc: "See what's actually selling." },
  { id: 2, title: "Track Every Sale with Facebook Pixel", desc: "Know which ads are driving money." },
  { id: 3, title: "SEO Title & Description", desc: "Get found on Google in 1 minute." },
  { id: 4, title: "Three Marketing Tricks for 10x Sales", desc: "Flash sales and hero banners." },
];

export default function ResourcesPage() {
  return (
    <div className="bg-white min-h-screen">
      <HomeHeader />

      <main className="pt-24 md:pt-28 px-4">
        
        {/* --- HERO --- */}
        <section className="py-12 md:py-20 bg-slate-50 border-b border-slate-100 rounded-[2rem] md:rounded-none">
          <div className="container mx-auto text-center px-4">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Badge className="bg-purple-600 text-white px-4 py-1 mb-6 uppercase font-black tracking-widest text-[10px]">Resources Hub</Badge>
              <h1 className="text-3xl md:text-7xl font-black text-slate-900 tracking-tighter mb-4 md:mb-6 uppercase leading-[1.1]">
                Everything You Need to <br className="hidden md:block" /> <span className="text-purple-600">Grow Your Business.</span>
              </h1>
              <p className="text-base md:text-xl text-slate-600 max-w-2xl mx-auto mb-8 md:mb-10 font-bold leading-relaxed">
                Free tutorials, practical guides, and expert blog posts — all built for African vendors.
              </p>
              
              <div className="relative max-w-xl mx-auto">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <Input placeholder="Search for sourcing, AI, or store setup..." className="h-14 md:h-16 pl-12 rounded-xl md:rounded-2xl border-slate-200 shadow-xl focus:ring-purple-600 font-bold text-sm" />
              </div>
            </motion.div>
          </div>
        </section>

        {/* --- SECTION 1: VIDEO TUTORIALS (UPDATED) --- */}
        <section className="py-16 md:py-24 container mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 md:mb-12 gap-4">
            <div>
               <h2 className="text-2xl md:text-4xl font-[1000] text-slate-900 uppercase tracking-tighter">SellQuic Academy</h2>
               <p className="text-slate-500 font-bold text-sm md:text-base italic">The masterclass for modern African vendors.</p>
            </div>
            <Button onClick={() => window.location.href = '/tutorials'} variant="ghost" className="w-fit text-purple-600 font-black uppercase text-[10px] md:text-xs tracking-widest p-0 h-auto hover:bg-transparent hover:translate-x-1 transition-transform">
              Explore All Tutorials <ArrowRight className="ml-2" size={16} />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {TUTORIALS_PREVIEW.map((lesson) => (
              <div 
                key={lesson.id} 
                onClick={() => window.location.href = `/tutorials`} 
                className="group cursor-pointer"
              >
                <div className="relative aspect-video bg-slate-950 rounded-[1.5rem] md:rounded-[2rem] mb-5 overflow-hidden shadow-lg border-2 border-transparent group-hover:border-purple-600 transition-all">
                   <img 
                    src={lesson.img} 
                    alt={lesson.title} 
                    className="w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity"
                   />
                   <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 md:w-16 md:h-16 bg-white rounded-full flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
                         <Play className="text-purple-600 fill-purple-600 ml-1" size={24} />
                      </div>
                   </div>
                   <div className="absolute bottom-4 left-4">
                      <span className="bg-black/50 backdrop-blur-md text-white text-[9px] font-black px-2 py-1 rounded uppercase tracking-widest">
                        {lesson.duration}
                      </span>
                   </div>
                </div>
                <div className="flex items-center gap-3">
                   <span className="text-purple-600 font-black text-xs uppercase tracking-widest">Lesson {lesson.id}</span>
                   <div className="h-px bg-slate-100 flex-grow" />
                </div>
                <h3 className="font-black text-lg md:text-xl text-slate-900 group-hover:text-purple-600 transition-colors uppercase tracking-tight mt-2">
                    {lesson.title}
                </h3>
              </div>
            ))}
          </div>
        </section>

        {/* --- SECTION 2: BLOGS --- */}
        <section className="py-16 md:py-24 bg-slate-950 text-white rounded-[2rem] md:rounded-[4rem] px-6 md:px-12">
          <div className="container mx-auto">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 md:mb-16 gap-6">
              <div>
                <Badge className="bg-purple-600 mb-4 uppercase font-black tracking-[0.2em]">From the Blog</Badge>
                <h2 className="text-3xl md:text-6xl font-black uppercase tracking-tighter">Practical Blogs</h2>
              </div>
              <Button 
                onClick={() => window.location.href = '/blog'} 
                className="w-full md:w-auto bg-transparent border border-white/30 text-white hover:bg-white/10 font-black uppercase text-[10px] md:text-xs tracking-widest px-8 h-12 rounded-xl transition-all"
              >
                View All Posts
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {BLOG_PREVIEW.map((blog) => (
                <div key={blog.id} onClick={() => window.location.href = `/blog?id=${blog.id}`} className="cursor-pointer p-6 md:p-10 bg-white/5 border border-white/10 rounded-[1.5rem] md:rounded-[2.5rem] hover:bg-white/10 transition-all group border-b-4 border-b-purple-600 flex flex-col">
                  <Badge variant="outline" className="text-purple-400 border-purple-400 mb-4 md:mb-6 uppercase text-[10px] font-black w-fit">{blog.tag}</Badge>
                  <h3 className="text-lg md:text-xl font-black mb-3 md:mb-4 leading-tight group-hover:text-purple-400 transition-colors uppercase tracking-tight">{blog.title}</h3>
                  <p className="text-slate-400 text-xs md:text-sm font-medium mb-6 md:mb-8 flex-grow">{blog.desc}</p>
                  <Button variant="ghost" className="p-0 h-auto text-white group-hover:translate-x-2 transition-all font-black text-[10px] uppercase tracking-widest w-fit">
                    Read Post <ArrowRight className="ml-2" size={14} />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* --- SECTION 3: GUIDES --- */}
        <section className="py-16 md:py-24 container mx-auto px-2">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 md:mb-12 gap-4">
            <div>
               <h2 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tighter">How-To Guides</h2>
               <p className="text-slate-500 font-bold text-sm md:text-base">Follow at your own pace.</p>
            </div>
            <Button onClick={() => window.location.href = '/guide'} className="w-full md:w-auto bg-purple-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] md:text-xs h-12 px-8">
              View All Guides <ArrowRight className="ml-2" size={16} />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {GUIDES_PREVIEW.map((guide) => (
              <div 
                key={guide.id}
                onClick={() => window.location.href = `/guide?id=${guide.id}`}
                className="flex items-center justify-between p-4 md:p-6 bg-white border border-slate-100 rounded-[1.2rem] md:rounded-[1.5rem] hover:border-purple-200 hover:shadow-2xl transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3 md:gap-4">
                   <div className="h-10 w-10 md:h-12 md:w-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600">
                      <FileText size={20} />
                   </div>
                   <div>
                      <span className="font-black text-slate-800 uppercase tracking-tight text-xs md:text-sm block">{guide.title}</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase">{guide.desc}</span>
                   </div>
                </div>
                <ArrowRight size={18} className="text-slate-300 group-hover:text-purple-600 group-hover:translate-x-2 transition-all" />
              </div>
            ))}
          </div>
        </section>

        {/* --- FINAL CTA --- */}
        <section className="py-12 md:py-24">
          <div className="max-w-5xl mx-auto bg-[#5722c1] rounded-[2rem] md:rounded-[3.5rem] p-8 md:p-16 text-center relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20" />
            <h2 className="text-2xl md:text-6xl font-black text-white mb-4 md:mb-6 uppercase tracking-tighter leading-tight">Ready to start <br className="hidden md:block" /> selling smarter?</h2>
            <p className="text-purple-100 text-sm md:text-lg mb-8 md:mb-10 max-w-xl mx-auto font-bold">Start your 7-day free trial today. No credit card needed.</p>
            <Button 
              onClick={() => window.location.href = 'https://sellquic.com/signup'}
              size="lg" className="w-full sm:w-auto bg-white text-[#5722c1] hover:bg-slate-50 h-16 md:h-20 px-8 md:px-12 rounded-xl md:rounded-[1.5rem] font-black text-base md:text-xl shadow-2xl"
            >
              Start Free Trial <ArrowRight className="ml-2" />
            </Button>
          </div>
        </section>

      </main>

      <footer />
    </div>
  );
}