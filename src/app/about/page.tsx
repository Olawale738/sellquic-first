'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Mail, Heart, Globe, Zap, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// CORRECT IMPORTS FROM YOUR LANDING PAGE
import { HomeHeader } from '@/components/landing/HomeHeader';
import { footer } from '@/components/landing/footer';

const ValueCard = ({ icon: Icon, title, description }: { icon: any, title: string, description: string }) => (
    <motion.div 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-purple-500/5 transition-all group"
    >
        <div className="h-12 w-12 bg-purple-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-purple-600 transition-colors">
            <Icon className="h-6 w-6 text-purple-600 group-hover:text-white transition-colors" />
        </div>
        <h3 className="text-xl font-black text-slate-900 mb-3 uppercase tracking-tight">{title}</h3>
        <p className="text-slate-600 leading-relaxed font-medium">{description}</p>
    </motion.div>
);

export default function AboutPage() {
    return (
        <div className="bg-white flex flex-col min-h-screen">
            <HomeHeader />
            
            <main className="flex-1 pt-24">
                {/* SECTION 1: OUR STORY */}
                <section className="py-20 lg:py-32 overflow-hidden">
                    <div className="container mx-auto px-4">
                        <div className="max-w-4xl mx-auto text-center">
                            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
                                <Badge className="bg-purple-50 text-purple-700 border-none px-4 py-1 mb-6 uppercase font-black tracking-widest text-[10px]">Our Story</Badge>
                                <h1 className="text-4xl md:text-7xl font-extrabold tracking-tight text-slate-900 mb-8 leading-[1.1] uppercase">
                                    Built from the <span className="text-purple-600 italic">hustle</span>, not the boardroom.
                                </h1>
                                <div className="space-y-6 text-lg md:text-xl text-slate-600 font-medium leading-relaxed">
                                    <p>
                                        We didn’t build SellQuic from a boardroom. We built it because we lived the problem. 
                                        We watched vendors who are talented, hardworking, and ambitious manage hundreds of customer messages by hand, 
                                        quote prices from memory, miss sales while they slept, and run entire businesses with nothing but their phones and their hustle.
                                    </p>
                                    <p>
                                        We are vendors too. We know what it feels like to juggle DMs, chase payments, and try to grow a business with no system behind you. 
                                        That experience shaped every decision we made in building SellQuic.
                                    </p>
                                    <p className="font-black text-slate-900 uppercase tracking-tight">
                                        So we built the platform we always needed. A complete selling system that gives African online businesses everything they need to sell, manage their customers, and grow — powered by AI, built for Africa.
                                    </p>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                </section>

                {/* SECTION 2: OUR MISSION */}
                <section className="bg-slate-950 py-24 relative overflow-hidden">
                    <div className="container mx-auto px-4 relative z-10">
                        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="max-w-5xl mx-auto text-center">
                            <p className="text-purple-400 font-black tracking-[0.2em] uppercase text-[10px] mb-6">Our Mission</p>
                            <h2 className="text-3xl md:text-5xl font-bold text-white leading-tight mb-10 italic">
                                “To give every African small business the selling infrastructure they need to grow — regardless of their size, their budget, or where they are starting from.”
                            </h2>
                            <div className="h-1 w-24 bg-purple-600 mx-auto mb-10" />
                            <p className="text-slate-400 text-lg md:text-xl font-medium max-w-3xl mx-auto leading-relaxed">
                                We are not building an app. We are building the complete selling infrastructure for African commerce — 
                                because Africa’s small businesses deserve the same powerful tools that the world’s biggest businesses use, 
                                at a price they can actually afford.
                            </p>
                        </motion.div>
                    </div>
                </section>

                {/* SECTION 3: OUR VALUES */}
                <section className="py-24 lg:py-32 bg-slate-50/50">
                    <div className="container mx-auto px-4">
                        <div className="text-center mb-16">
                            <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter uppercase">What we believe</h2>
                        </div>
                        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                            <ValueCard 
                                icon={Globe} 
                                title="Africa First" 
                                description="Every decision we make starts with what African vendors actually need. Not what works elsewhere. What works here." 
                            />
                            <ValueCard 
                                icon={Users} 
                                title="Built With Vendors" 
                                description="We build with our vendors, not just for them. Their feedback shapes every feature. When they win, we win." 
                            />
                            <ValueCard 
                                icon={Zap} 
                                title="AI for Everyone" 
                                description="Every vendor — big or small — deserves the same AI tools that power the world’s biggest businesses." 
                            />
                            <ValueCard 
                                icon={Heart} 
                                title="Vendor Success" 
                                description="We measure success in vendors who are growing, selling more, and building businesses that truly work for them." 
                            />
                        </div>
                    </div>
                </section>

                {/* SECTION 4: CONTACT (WITH ADDED MISSING INFO) */}
                <section className="py-24">
                    <div className="container mx-auto px-4">
                        <div className="bg-[#5722c1] rounded-[3rem] p-8 md:p-20 text-center max-w-5xl mx-auto text-white shadow-2xl shadow-purple-900/20">
                            <h2 className="text-4xl md:text-6xl font-black mb-8 tracking-tighter uppercase">We&apos;d love to hear from you.</h2>
                            
                            {/* THE MISSING PARAGRAPH ADDED HERE */}
                            <p className="text-purple-100 text-lg md:text-xl font-bold mb-12 max-w-3xl mx-auto leading-relaxed">
                                Whether you are a vendor ready to get started, a business that wants to learn more about SellQuic, 
                                or someone who simply wants to say hello — our door is always open.
                            </p>

                            <div className="flex flex-col items-center gap-4">
                                <div className="h-16 w-16 bg-white/10 rounded-2xl backdrop-blur-sm flex items-center justify-center text-white border border-white/20 mb-2">
                                    <Mail className="h-8 w-8" />
                                </div>
                                <p className="text-sm font-black uppercase tracking-widest text-purple-200">Send us an email</p>
                                <a href="mailto:hello@sellquic.com" className="text-2xl md:text-4xl font-black hover:text-purple-200 transition-colors">
                                    hello@sellquic.com
                                </a>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
            <footer />
        </div>
    );
}