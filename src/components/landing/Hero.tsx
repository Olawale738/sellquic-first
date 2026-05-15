'use client';

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { motion } from 'framer-motion';
import { TypeAnimation } from "react-type-animation";
import { ArrowRight, Zap } from "lucide-react";

const Hero = () => {
    return (
        <section className="relative w-full pt-32 pb-20 md:pt-48 md:pb-32 text-center overflow-hidden bg-white">
             
             {/* --- 1. ANIMATED LIVE BACKGROUND --- */}
             <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute top-0 left-1/4 w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-orange-100 rounded-full mix-blend-multiply filter blur-[80px] md:blur-[100px] opacity-60 animate-blob"></div>
                <div className="absolute top-0 right-1/4 w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-purple-100 rounded-full mix-blend-multiply filter blur-[80px] md:blur-[100px] opacity-60 animate-blob animation-delay-2000"></div>
                <div className="absolute -bottom-32 left-1/3 w-[500px] h-[500px] bg-pink-100 rounded-full mix-blend-multiply filter blur-[80px] md:blur-[100px] opacity-60 animate-blob animation-delay-4000"></div>
                
                {/* Noise texture overlay */}
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.15]"></div>
            </div>

            <div className="container relative z-10 mx-auto px-4 md:px-6 flex flex-col items-center">
                
                {/* --- 2. BETA PILL --- */}
                <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="inline-flex items-center gap-2 bg-white/60 backdrop-blur-md border border-white/50 px-4 py-1.5 rounded-full shadow-sm mb-8 hover:scale-105 transition-transform cursor-pointer"
                >
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                    </span>
                    <span className="text-xs md:text-sm font-bold text-gray-700">
                        SellQuic is now Live in Ghana
                    </span>
                    <ArrowRight className="w-3 h-3 text-gray-400" />
                </motion.div>

                {/* --- 3. DYNAMIC HEADLINE --- */}
                <motion.h1 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="max-w-6xl mx-auto text-4xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[1.1] text-slate-900"
                >
                    Stop sending product prices <br className="hidden md:block" />
                    and pictures {" "}
                    
                    <br className="md:hidden" /> 

                    <span className="bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 text-transparent bg-clip-text">
                        <TypeAnimation
                            sequence={[
                                'one by one.',   
                                2000,            
                                'in every DM.',  
                                2000,
                                'manually.',     
                                2000,
                            ]}
                            wrapper="span"
                            speed={50}
                            repeat={Infinity}
                            cursor={true}
                        />
                    </span>
                </motion.h1>

                {/* --- 4. SUBHEADLINE --- */}
                <motion.p 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="mt-8 text-base md:text-2xl text-slate-500 font-medium max-w-2xl mx-auto leading-relaxed"
                >
                    Create <span className="text-black font-bold decoration-orange-300 underline decoration-2 underline-offset-4">a simple website</span> for your products and let your AI Store Assistant handle customer questions, orders, and follow-ups on social media.
                </motion.p>

                {/* --- 5. CTA BUTTONS --- */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.5 }}
                    className="mt-10 flex flex-col items-center gap-6 w-full"
                >
                    <Button 
                        asChild 
                        size="lg" 
                        className="w-full md:w-auto rounded-full bg-black text-white hover:bg-gray-800 font-black text-lg md:text-xl px-10 py-8 shadow-2xl transition-all active:scale-95"
                    >
                        <Link href="/signup">
                            Create Your Free Website
                        </Link>
                    </Button>
                    
                    {/* Text is now wrapped and centered below the button on both mobile and laptop */}
                    <div className="flex items-center justify-center gap-2 text-[9px] md:text-xs text-black font-bold uppercase tracking-wider opacity-80">
    <Zap className="w-3.5 h-3.5 fill-yellow-400 text-yellow-500 shrink-0" />
    <span>No coding • No Tech developer needed • Set up in 5 minutes</span>
</div>
                </motion.div>
            </div>

            <style jsx global>{`
                @keyframes blob {
                    0% { transform: translate(0px, 0px) scale(1); }
                    33% { transform: translate(30px, -50px) scale(1.1); }
                    66% { transform: translate(-20px, 20px) scale(0.9); }
                    100% { transform: translate(0px, 0px) scale(1); }
                }
                .animate-blob {
                    animation: blob 10s infinite;
                }
                .animation-delay-2000 {
                    animation-delay: 2s;
                }
                .animation-delay-4000 {
                    animation-delay: 4s;
                }
            `}</style>
        </section>
    );
};

export default Hero;