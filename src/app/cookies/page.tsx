'use client';

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Cookie, Instagram, Linkedin, Twitter } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { HomeHeader } from "@/components/landing/HomeHeader";

const cookieTypes = [
    { type: 'Essential Cookies', purpose: 'Required for platform operation and user login.', examples: 'Authentication cookies, session cookies' },
    { type: 'Performance Cookies', purpose: 'Track website traffic and improve load times.', examples: 'Google Analytics cookies' },
    { type: 'Functionality Cookies', purpose: 'Remember user preferences and settings.', examples: 'Language choice, dark/light mode' },
    { type: 'Marketing Cookies', purpose: 'Help deliver relevant content and ads.', examples: 'Facebook Pixel, Meta Ads cookies' },
];

const FooterLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
    <Link href={href} className="text-sm text-gray-300 hover:text-white transition-colors">
        {children}
    </Link>
);

const FooterHeader = ({ children }: { children: React.ReactNode }) => (
    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{children}</h3>
);

const PolicySection = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <div className="space-y-4">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">{title}</h2>
        <div className="space-y-4 text-gray-600 leading-loose">
            {children}
        </div>
    </div>
);


export default function CookiePolicyPage() {
    const currentYear = new Date().getFullYear();
    return (
        <div className="bg-white flex flex-col min-h-screen">
             <HomeHeader />
            <main className="pt-24 flex-1">
                <div className="bg-gray-50 py-24 sm:py-32">
                    <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center">
                         <Cookie className="mx-auto h-16 w-16 text-primary" />
                        <h1 className="mt-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">Cookie Policy</h1>
                        <p className="mt-6 text-lg leading-8 text-gray-600">Effective Date: 1st November 2025</p>
                    </div>
                </div>

                <div className="max-w-4xl mx-auto py-16 px-6 space-y-12">
                    <PolicySection title="1. What Are Cookies?">
                        <p>
                            This Cookie Policy explains how Sellquic Tech Solutions Ltd (“Sellquic,” “we,” “us,” or “our”) uses cookies and similar technologies to recognize you when you visit our website (www.sellquic.com) and use our platform. It explains what these technologies are, why we use them, and your rights to control our use of them.
                        </p>
                        <p>
                           Cookies are small text files placed on your device (computer or mobile) when you visit a website. They help websites function properly, improve user experience, and provide analytical information to website owners.
                        </p>
                        <p>Cookies can be:</p>
                        <ul className="list-disc pl-6 space-y-2">
                            <li><strong>Session cookies:</strong> deleted when you close your browser.</li>
                            <li><strong>Persistent cookies:</strong> remain on your device for a set period or until deleted manually.</li>
                        </ul>
                    </PolicySection>

                    <PolicySection title="2. Why We Use Cookies">
                        <p>
                            Sellquic uses cookies to:
                        </p>
                        <ol className="list-decimal pl-6 space-y-2">
                            <li>Ensure proper website functionality (login sessions, language preferences, and dashboard use).</li>
                            <li>Improve user experience by remembering your preferences and simplifying navigation.</li>
                            <li>Analyze performance and traffic to understand how users interact with our platform.</li>
                            <li>Support marketing efforts, including retargeting and understanding user engagement with ads.</li>
                        </ol>
                    </PolicySection>
                    
                    <PolicySection title="3. Types of Cookies We Use">
                         <div className="overflow-hidden rounded-lg border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Purpose</TableHead>
                                        <TableHead>Examples</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {cookieTypes.map((cookie, index) => (
                                        <TableRow key={index}>
                                            <TableCell className="font-medium">{cookie.type}</TableCell>
                                            <TableCell>{cookie.purpose}</TableCell>
                                            <TableCell>{cookie.examples}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                         </div>
                    </PolicySection>

                    <PolicySection title="4. Third-Party Cookies">
                        <p>
                           Some cookies are placed by trusted third-party services integrated into our website, such as:
                        </p>
                         <ul className="list-disc pl-6 space-y-2">
                            <li><strong>Google Analytics</strong> (website performance and traffic analysis).</li>
                            <li><strong>Meta/Facebook Pixel</strong> (marketing optimization and ad tracking).</li>
                        </ul>
                        <p>
                            These third parties may collect data under their own privacy policies. Sellquic does not control their cookies directly but only integrates them for analytics and marketing optimization.
                        </p>
                    </PolicySection>
                    
                    <PolicySection title="5. How to Control Cookies">
                        <p>
                            You can choose to:
                        </p>
                         <ul className="list-disc pl-6 space-y-2">
                            <li>Accept or decline cookies through our on-site cookie banner.</li>
                            <li>Adjust your browser settings to block or delete cookies at any time.</li>
                        </ul>
                         <p>
                            Please note that disabling essential cookies may limit some features or prevent parts of the Sellquic platform from functioning properly.
                        </p>
                    </PolicySection>

                    <PolicySection title="6. Updates to This Policy">
                         <p>
                            We may update this Cookie Policy periodically to reflect new technologies or legal requirements. When we make updates, the revised policy will be published at www.sellquic.com/cookies, with the latest “Effective Date” shown above.
                        </p>
                    </PolicySection>

                    <PolicySection title="7. Contact">
                        <p>
                            If you have any questions about our Cookie Policy or data handling practices, contact us at: <a href="mailto:hello@sellquic.com" className="text-primary hover:underline">hello@sellquic.com</a>.
                        </p>
                    </PolicySection>
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
