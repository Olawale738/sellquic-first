
'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Zap, TrendingUp, Users, ArrowRight } from 'lucide-react';

export default function AffiliateLandingPage() {
    return (
        <div className="flex flex-col min-h-screen font-sans bg-white text-gray-900 overflow-hidden">
            
            {/* --- HERO SECTION --- */}
            <section className="relative pt-20 pb-32 flex flex-col items-center text-center">
                
                {/* ✨ THE LOVABLE GRADIENT BLOB ✨ */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-[1000px] h-[500px] bg-gradient-to-r from-[#FF5757] via-[#FF0077] to-[#8637E4] rounded-full blur-[100px] opacity-20 -z-10 animate-pulse" />

                <div className="container px-4 mx-auto z-10">
                    {/* Community Avatars Placeholder */}
                    <div className="flex justify-center mb-8 -space-x-4">
                         {/* REPLACE THESE SRCS WITH REAL PICS LATER */}
                         <div className="w-12 h-12 rounded-full border-2 border-white bg-gray-200 overflow-hidden">
                            <img src="https://i.pravatar.cc/100?img=1" alt="User" className="w-full h-full object-cover" />
                         </div>
                         <div className="w-12 h-12 rounded-full border-2 border-white bg-gray-200 overflow-hidden">
                            <img src="https://i.pravatar.cc/100?img=5" alt="User" className="w-full h-full object-cover" />
                         </div>
                         <div className="w-12 h-12 rounded-full border-2 border-white bg-gray-200 overflow-hidden">
                            <img src="https://i.pravatar.cc/100?img=8" alt="User" className="w-full h-full object-cover" />
                         </div>
                    </div>

                    <h2 className="text-sm font-semibold tracking-wide uppercase text-gray-500 mb-4">
                        SellQuic Affiliate Program
                    </h2>

                    <h1 className="text-6xl md:text-8xl font-bold tracking-tight mb-6 text-black leading-[1.1]">
                        Welcome to the <br />
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#FF5757] to-[#8637E4]">
                            Wealth Community
                        </span>
                    </h1>
                    
                    <p className="max-w-2xl mx-auto text-xl md:text-2xl text-gray-600 mb-10 leading-relaxed font-light">
                        Build the future with thousands of creators and vendors. 
                        Refer sellers to SellQuic and earn <span className="font-bold text-black">₵20 cash</span> every time they upgrade.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                        <Button asChild size="lg" className="h-14 px-10 text-lg rounded-full bg-black hover:bg-gray-800 text-white shadow-xl transition-all hover:scale-105">
                            <Link href="/affiliate/register">Join the Community</Link>
                        </Button>
                        <Button asChild variant="outline" size="lg" className="h-14 px-10 text-lg rounded-full border-gray-300 hover:bg-gray-50 text-gray-700">
                            <Link href="/affiliate/login">Affiliate Login</Link>
                        </Button>
                    </div>
                </div>
            </section>

            {/* --- DASHBOARD PREVIEW PLACEHOLDER --- */}
            <section className="container px-4 mx-auto -mt-10 mb-24">
                <div className="relative w-full max-w-5xl mx-auto aspect-[16/9] bg-gray-900 rounded-2xl shadow-2xl border-4 border-white/20 overflow-hidden flex items-center justify-center group">
                    <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-black opacity-90" />
                    
                    {/* REPLACE WITH DASHBOARD SCREENSHOT */}
                    <div className="z-10 text-center">
                         <Zap className="h-16 w-16 text-white/20 mx-auto mb-4" />
                         <p className="text-white/50 text-lg font-medium">Dashboard Preview Image Goes Here</p>
                         <p className="text-white/30 text-sm">(Take a screenshot of your Affiliate Dashboard and put it here)</p>
                    </div>

                    {/* Glowing effect behind image */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                </div>
            </section>

            {/* --- HOW IT WORKS --- */}
            <section className="py-24 bg-gray-50 border-t border-gray-100">
                <div className="container px-4 mx-auto max-w-6xl">
                    <div className="grid md:grid-cols-2 gap-16 items-center">
                        <div>
                            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900">How to get involved</h2>
                            <p className="text-xl text-gray-500 mb-8">
                                It's simple. You have the network, we have the platform. Let's make money together.
                            </p>
                            
                            
                            <div className="space-y-8">
                                {[
                                    { title: 'Sign Up', desc: 'Create your account instantly. No approval needed.' },
                                    { title: 'Share Link', desc: 'Send your unique link to vendors on WhatsApp/IG.' },
                                    { title: 'Get Paid', desc: 'Earn ₵20 cash directly to your MoMo weekly.' }
                                ].map((step, i) => (
                                    <div key={i} className="flex gap-4">
                                        <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center font-bold flex-shrink-0">
                                            {i + 1}
                                        </div>
                                        <div>
                                            <h4 className="text-xl font-bold text-gray-900">{step.title}</h4>
                                            <p className="text-gray-500">{step.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        {/* Feature Image Placeholder */}
                        <div className="relative h-[500px] bg-white rounded-3xl border shadow-sm p-8 flex flex-col justify-center items-center text-center overflow-hidden">
                             <div className="absolute top-0 right-0 w-64 h-64 bg-purple-100 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                             <div className="absolute bottom-0 left-0 w-64 h-64 bg-pink-100 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
                             
                             <img src="/images/mobile-app-mockup.png" alt="" className="opacity-0 absolute" /> {/* Hidden real image slot */}
                             <Users className="h-20 w-20 text-gray-300 mb-4" />
                             <h3 className="text-2xl font-bold text-gray-800">Community First</h3>
                             <p className="text-gray-500 mt-2">Join 500+ other affiliates in our WhatsApp group.</p>
                             
                             <Button variant="outline" className="mt-8 rounded-full">View Community</Button>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-24 bg-white text-center">
                 <h2 className="text-5xl md:text-7xl font-bold tracking-tight mb-8">
                    Ready to earn?
                </h2>
                <Button asChild size="lg" className="h-16 px-12 text-xl rounded-full bg-gradient-to-r from-[#FF5757] to-[#8637E4] text-white hover:opacity-90 shadow-2xl">
                    <Link href="/affiliate/register">Join Program Now <ArrowRight className="ml-2 h-6 w-6" /></Link>
                </Button>
            </section>
        </div>
    );
}