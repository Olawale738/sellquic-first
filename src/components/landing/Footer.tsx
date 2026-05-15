'use client';

import Image from "next/image";
import Link from "next/link";
import { Instagram, Facebook, Twitter, ShieldCheck } from "lucide-react";

// Simple link component for the footer
const FooterLink = ({ href, children }: { href: string; children: React.ReactNode }) => {
    const isExternal = href.startsWith('http');
    return (
        <Link 
            href={href} 
            className="text-sm text-gray-400 hover:text-white transition-colors"
            target={isExternal ? "_blank" : undefined}
            rel={isExternal ? "noopener noreferrer" : undefined}
        >
            {children}
        </Link>
    );
};


// Styled Header for footer sections
const FooterHeader = ({ children }: { children: React.ReactNode }) => (
    <h3 className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-4">{children}</h3>
);

// Pill Style for category examples
const CategoryPill = ({ text }: { text: string }) => (
    <span className="px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-gray-300">
        {text}
    </span>
);

export function HomeFooter() {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="relative w-full bg-[#050505] text-white pt-20 pb-10 overflow-hidden">
            
            {/* --- BACKGROUND FX --- */}
            <div className="absolute inset-0 pointer-events-none">
                {/* Subtle Grid */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:40px_40px]"></div>
                
                {/* Glowing Orbs */}
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-orange-600/10 rounded-full blur-[120px]"></div>
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-900/10 rounded-full blur-[120px]"></div>
            </div>

            <div className="container relative z-10 mx-auto px-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 lg:gap-8 mb-16">
                    
                    {/* 1. BRAND COLUMN (Span 4) */}
                    <div className="lg:col-span-4 space-y-6">
                        <Link href="/" className="inline-block">
                            <Image 
                                src="/logo-white.png" 
                                alt="SellQuic Logo" 
                                width={140} 
                                height={32} 
                                className="object-contain opacity-90 hover:opacity-100 transition-opacity" 
                            />
                        </Link>
                        <p className="text-sm text-gray-400 leading-relaxed max-w-xs">
                        SellQuic is the fastest, simplest way to launch a beautiful online store that works the way Ghanaian businesses work.
                        </p>
                        
                        {/* System Status Indicator */}
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-900/20 border border-green-900/30">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </span>
                            <span className="text-[10px] font-medium text-green-400 uppercase tracking-wide">Systems Operational</span>
                        </div>
                    </div>
                    
                    {/* 2. NAVIGATION (Span 2) */}
                    <div className="lg:col-span-2">
                        <FooterHeader>Platform</FooterHeader>
                        <div className="flex flex-col space-y-3">
                            <FooterLink href="/about">Why SellQuic</FooterLink>
                            {/* <FooterLink href="/pricing">Pricing</FooterLink> */}
                            <FooterLink href="/features">Features</FooterLink>
                            <FooterLink href="/policies">Our Policies</FooterLink>
                            <FooterLink href="/login">Login</FooterLink>
                        </div>
                    </div>

                    {/* 3. USE CASES (Span 3) */}
                    <div className="lg:col-span-3">
                        <FooterHeader>What Can I Sell?</FooterHeader>
                        <div className="flex flex-wrap gap-2">
                            {["Wigs & Hair", "Clothing", "Skincare", "Sneakers", "Bags", "Electronics", "Food"].map((item) => (
                                <CategoryPill key={item} text={item} />
                            ))}
                        </div>
                    </div>

                     {/* 4. CONTACT (Span 3) */}
                     <div className="lg:col-span-3">
                        <FooterHeader>Support</FooterHeader>
                        <div className="flex flex-col space-y-3">
                            <FooterLink href="mailto:hello@sellquic.com">hello@sellquic.com</FooterLink>
                            <FooterLink href="/affiliates">Affiliate Program</FooterLink>

                            {/* Social Icons */}
                            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/5">
                                <Link href="https://instagram.com/sellquic" className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:bg-orange-500 hover:text-white transition-all">
                                    <Instagram className="h-4 w-4"/>
                                </Link>
                                <Link href="#" className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:bg-blue-600 hover:text-white transition-all">
                                    <Facebook className="h-4 w-4"/>
                                </Link>
                                <Link href="#" className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:bg-sky-500 hover:text-white transition-all">
                                    <Twitter className="h-4 w-4"/>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* BOTTOM BAR */}
                <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
                    <p className="text-xs text-gray-500">
                        © {currentYear} SellQuic Tech Solutions. All Rights Reserved.
                    </p>
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            <ShieldCheck className="w-3 h-3" />
                            <span>Secure Payments by Paystack</span>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    )
}
