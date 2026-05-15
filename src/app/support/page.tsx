'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LifeBuoy, BookOpen, MessageSquare, Instagram, Linkedin, Twitter } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { HomeHeader } from "@/components/landing/HomeHeader";

const articles = [
    { title: "Getting Started: Creating Your First Store", link: "#" },
    { title: "How to Add Products and Variants", link: "#" },
    { title: "Setting Up Mobile Money Payments", link: "#" },
    { title: "Managing and Fulfilling Orders", link: "#" },
    { title: "Understanding Your Dashboard Analytics", link: "#" },
];

const FooterLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
    <Link href={href} className="text-sm text-gray-300 hover:text-white transition-colors">
        {children}
    </Link>
);

const FooterHeader = ({ children }: { children: React.ReactNode }) => (
    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{children}</h3>
);

export default function SupportPage() {
    const currentYear = new Date().getFullYear();
    return (
        <div className="bg-white flex flex-col min-h-screen">
            <HomeHeader />
            <main className="pt-24 flex-1">
                <div className="bg-gray-50 py-24 sm:py-32">
                    <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center">
                        <LifeBuoy className="mx-auto h-16 w-16 text-primary" />
                        <h1 className="mt-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">Help & Support</h1>
                        <p className="mt-6 text-lg leading-8 text-gray-600 max-w-2xl mx-auto">
                           We're here to help you succeed. Find answers to your questions, browse articles, or get in touch with our team.
                        </p>
                        <div className="mt-8 max-w-md mx-auto">
                             <div className="relative">
                                <Input placeholder="Search for help..." className="h-12 text-lg pl-4 pr-12" />
                                <Button size="icon" className="absolute right-2 top-1/2 -translate-y-1/2">
                                    <LifeBuoy className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="py-24 sm:py-32">
                    <div className="mx-auto max-w-7xl px-6 lg:px-8">
                         <div className="grid grid-cols-1 gap-12 lg:grid-cols-3">
                            <div className="lg:col-span-2">
                                <h2 className="text-3xl font-bold tracking-tight text-gray-900 mb-8">Popular Articles</h2>
                                <div className="space-y-4">
                                    {articles.map(article => (
                                        <Link href={article.link} key={article.title}>
                                            <Card className="hover:bg-gray-50 hover:shadow-md transition-all">
                                                <CardContent className="p-6">
                                                    <p className="font-semibold text-lg">{article.title}</p>
                                                </CardContent>
                                            </Card>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <Card className="bg-primary text-primary-foreground">
                                    <CardHeader>
                                        <CardTitle>Can't find an answer?</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="mb-4">Our support team is happy to help you with any questions you may have.</p>
                                        <Button variant="secondary" className="w-full">
                                            <MessageSquare className="mr-2 h-4 w-4"/> Contact Support
                                        </Button>
                                    </CardContent>
                                </Card>
                            </div>
                         </div>
                    </div>
                </div>
            </main>
             <footer className="w-full bg-black text-primary-foreground z-[70] rounded-t-xl">
                <div className="container mx-auto px-6 py-12 w-full">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
                        <div className="col-span-2 md:col-span-1">
                            <Link href="#" className="flex items-center gap-2 mb-2">
                                <Image src="/logo-white.png" alt="SellQuic Logo" width={140} height={32} />
                            </Link>
                            <p className="text-sm text-gray-300">The smartest way to manage your business</p>
                        </div>
                        
                   

                        <div className="space-y-4">
                            <FooterHeader>Learn</FooterHeader>
                            <div className="flex flex-col space-y-2">
                                <Link href="/about">Why SellQuic</Link>
                                <Link href="/pricing">Pricing</Link>
                                <Link href="/policies">Our Policies</Link>
                            </div>
                        </div>

                         <div className="col-span-2 md:col-span-2 lg:col-span-1 space-y-4">
                            <FooterHeader>What Can I Sell?</FooterHeader>
                            <div className="flex flex-col space-y-2">
                                <FooterLink href="#">wigs</FooterLink>
                                <FooterLink href="#">clothes</FooterLink>
                                <FooterLink href="#">skincare</FooterLink>
                                <FooterLink href="#">shoes</FooterLink>
                                <FooterLink href="#">bags</FooterLink>
                            </div>
                        </div>
                         <div className="col-span-2 md:col-span-1 space-y-4">
                            <FooterHeader>Contact Us</FooterHeader>
                            <div className="flex flex-col space-y-2">
                                <FooterLink href="mailto:hello@sellquic.com">hello@sellquic.com</FooterLink>
                                
                            </div>
                        </div>
                    </div>
                    
                    <div className="mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between">
                        <p className="text-xs text-gray-400 text-center md:text-left">
                            © {currentYear} SellQuic Tech Solutions. All Rights Reserved
                        </p>
                        <div className="flex space-x-4 mt-4 md:mt-0">
                            <Link href="https://instagram.com/sellquic" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white"><Instagram className="h-5 w-5"/></Link>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
