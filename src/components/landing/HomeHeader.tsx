'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import { Menu, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function HomeHeader() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Updated order: Features, Pricing, Resources, About Us
    const navLinks = [
        { name: "Features", href: "/features" },
        { name: "Pricing", href: "/pricing" },
        { name: "Resources", href: "/resources", hasDropdown: true },
        { name: "About Us", href: "/about" },
    ];

    return (
        <header className="fixed top-6 left-0 right-0 z-50 flex justify-center px-4">
            <div className="w-full max-w-6xl bg-white border border-gray-200/80 shadow-lg shadow-gray-500/10 rounded-full px-6 py-2.5 flex items-center justify-between transition-all duration-300">
                
                {/* 1. Logo Section */}
                <div className="flex items-center shrink-0">
                    <Link href="/" className="flex items-center">
                        <Image 
                            src="/logo.png" 
                            alt="SellQuic Logo" 
                            width={110} 
                            height={30} 
                            className="object-contain"
                            priority
                        />
                    </Link>
                </div>

                {/* 2. Desktop Navigation (Centered) */}
                <nav className="hidden md:flex items-center gap-7 absolute left-1/2 -translate-x-1/2">
                    {navLinks.map((link) => (
                        <Link 
                            key={link.name}
                            href={link.href}
                            className="group flex items-center gap-1 text-[13px] font-bold text-gray-600 hover:text-[#5722c1] transition-all"
                        >
                            {link.name}
                            {link.hasDropdown && (
                                <ChevronDown size={14} className="group-hover:rotate-180 transition-transform duration-300 opacity-50" />
                            )}
                        </Link>
                    ))}
                </nav>

                {/* 3. Right Side Actions */}
                <div className="flex items-center gap-2">
                    <Link 
                        className="text-[13px] font-bold text-gray-900 hover:text-[#5722c1] px-4 py-2 transition-all hidden lg:block" 
                        href="/login"
                    >
                        Log in
                    </Link>

                    <Button asChild className="hidden md:inline-flex rounded-full bg-[#5722c1] hover:bg-[#451ba1] text-white border-0 px-6 py-5 font-black text-[13px] shadow-lg shadow-purple-500/20 transition-transform hover:scale-105 active:scale-95">
                        <Link href="/signup">Create a store</Link>
                    </Button>

                    {/* Mobile Menu Toggle */}
                    <div className="md:hidden flex items-center">
                        <button 
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="text-gray-900 hover:text-[#5722c1] focus:outline-none ml-2 transition-transform active:scale-95"
                        >
                            {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu Dropdown */}
            {isMobileMenuOpen && (
                <div className="absolute top-24 left-4 right-4 z-40">
                    <div className="bg-white/95 backdrop-blur-xl border border-white/50 shadow-2xl rounded-[2rem] p-8 flex flex-col gap-6 md:hidden animate-in slide-in-from-top-5 zoom-in-95 fade-in duration-300 origin-top">
                        <nav className="flex flex-col gap-5 text-center">
                            {navLinks.map((link) => (
                                <Link 
                                    key={link.name}
                                    className="text-xl font-black text-gray-900 hover:text-[#5722c1] py-2 border-b border-gray-50" 
                                    href={link.href}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    {link.name}
                                </Link>
                            ))}
                            
                            <div className="flex flex-col gap-4 mt-4">
                                <Button asChild className="w-full rounded-2xl bg-[#5722c1] text-white hover:bg-[#451ba1] py-7 text-lg font-black shadow-xl shadow-purple-500/20">
                                    <Link href="/signup" onClick={() => setIsMobileMenuOpen(false)}>Create Store</Link>
                                </Button>
                                <Button asChild variant="outline" className="w-full rounded-2xl border-gray-200 text-gray-700 hover:bg-gray-50 py-7 text-lg font-bold">
                                    <Link href="/login" onClick={() => setIsMobileMenuOpen(false)}>Log in</Link>
                                </Button>
                            </div>
                        </nav>
                    </div>
                </div>
            )}
        </header>
    );
}