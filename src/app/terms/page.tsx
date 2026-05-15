'use client';

import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import { FileText, Instagram, Linkedin, Twitter } from "lucide-react";
import { HomeHeader } from "@/components/landing/HomeHeader";

const PolicySection = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <div className="space-y-4">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">{title}</h2>
        <div className="space-y-4 text-gray-600 leading-loose">
            {children}
        </div>
    </div>
);

const FooterLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
    <Link href={href} className="text-sm text-gray-300 hover:text-white transition-colors">
        {children}
    </Link>
);

const FooterHeader = ({ children }: { children: React.ReactNode }) => (
    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{children}</h3>
);

export default function TermsPage() {
    const currentYear = new Date().getFullYear();
    return (
        <div className="bg-white flex flex-col min-h-screen">
            <HomeHeader />
            <main className="pt-24 flex-1">
                <div className="bg-gray-50 py-24 sm:py-32">
                    <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center">
                         <FileText className="mx-auto h-16 w-16 text-primary" />
                        <h1 className="mt-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">Terms and Conditions</h1>
                        <p className="mt-6 text-lg leading-8 text-gray-600">Effective Date: 1st November 2025</p>
                    </div>
                </div>

                <div className="max-w-4xl mx-auto py-16 px-6 space-y-12">
                     <PolicySection title="1. Introduction">
                        <p>
                            Welcome to Sellquic, a digital commerce tool that helps small businesses and individual sellers create online
                            store links, showcase products, and communicate easily with buyers. These Terms and Conditions (“Terms”)
                            govern your use of Sellquic’s website, platform, and related services (“the Platform”). By creating an account
                            or using the Platform, you agree to be bound by these Terms. If you disagree with any part, you must not
                            use Sellquic.
                        </p>
                    </PolicySection>

                    <PolicySection title="2. Definitions">
                        <p>
                            ‘Sellquic’ means the online platform provided by Sellquic Tech Solutions Ltd. ‘User’ or ‘Seller’ refers to anyone
                            using the Platform to create or manage a store. ‘Buyer’ means a person interacting with a Seller’s store link.
                            ‘Store Link’ refers to the online page generated for sellers to display products. ‘Plans’ means the Free, Pro,
                            and Premium subscription tiers. ‘We’, ‘Us’, ‘Our’ refer to Sellquic Tech Solutions Ltd.
                        </p>
                    </PolicySection>

                    <PolicySection title="3. Account Registration and Responsibility">
                        <p>
                            To access Sellquic, users must create an account with accurate details. You agree to keep your login
                            information confidential, provide truthful business information, and use the Platform only for legitimate
                            commerce. Sellquic may suspend or terminate any account found to be fraudulent, inactive, or violating
                            these Terms.
                        </p>
                    </PolicySection>

                    <PolicySection title="4. Acceptable Use Policy">
                        <p>
                            Users must not list or sell prohibited, counterfeit, or illegal goods, post misleading or harmful content,
                            attempt to hack, scrape, or interfere with the Platform’s operations, or use Sellquic to spam or defraud
                            buyers. We reserve the right to remove listings or terminate accounts to protect platform integrity.
                        </p>
                    </PolicySection>

                    <PolicySection title="5. Subscription Plans and Payments">
                        <p>
                            Sellquic offers Free, Pro, and Premium plans. Payments are processed securely via Paystack or Hubtel.
                            Subscriptions renew automatically unless cancelled before the renewal date. Refunds are not issued for
                            mid-cycle cancellations. During beta or promotional periods, free access or discounts may apply
                            temporarily.
                        </p>
                    </PolicySection>

                    <PolicySection title="6. Data Collection and Privacy">
                        <p>
                            We collect basic data such as name, business name, contact details, and product information. Data is stored
                            securely in line with Ghana’s Data Protection Act (2012) and retained for up to 30 days after account
                            deletion. We do not sell or share data without consent, except as required by law.
                        </p>
                    </PolicySection>

                    <PolicySection title="7. AI and Automated Descriptions">
                        <p>
                            Sellquic uses AI to generate product descriptions. You are responsible for verifying and editing all AI-
                            generated content before publishing. Sellquic is not liable for inaccuracies or misrepresentations produced
                            by automated tools.
                        </p>
                    </PolicySection>

                    <PolicySection title="8. WhatsApp Integration and Notifications">
                        <p>
                            Sellquic connects sellers and buyers via WhatsApp notifications. We are not affiliated with or endorsed by
                            Meta. Users agree to comply with WhatsApp’s own terms when using these integrations.
                        </p>
                    </PolicySection>

                    <PolicySection title="9. Intellectual Property Rights">
                        <p>
                            The Sellquic name, logo, and platform design are the property of Sellquic Tech Solutions Ltd. Users retain
                            ownership of their product content but grant Sellquic a limited license to display it for platform use and
                            marketing.
                        </p>
                    </PolicySection>

                    <PolicySection title="10. Referral and Rewards Programs">
                        <p>
                            Referral rewards or bonuses are non-transferable and may be modified or cancelled at any time. Fraudulent
                            or duplicate referrals will result in account suspension.
                        </p>
                    </PolicySection>

                    <PolicySection title="11. Limitation of Liability">
                        <p>
                            Sellquic provides its Platform 'as is' and disclaims all warranties. We are not liable for lost sales, income, or
                            damages from technical issues or third-party services. Total liability shall not exceed the user’s last
                            subscription fee.
                        </p>
                    </PolicySection>

                    <PolicySection title="12. Indemnification">
                        <p>
                            Users agree to indemnify and hold harmless Sellquic, its team, and affiliates from claims or damages
                            resulting from misuse or violation of these Terms.
                        </p>
                    </PolicySection>

                    <PolicySection title="13. Suspension or Termination">
                        <p>
                            Accounts may be terminated for violating Terms or engaging in illegal activity. Users can delete their
                            accounts anytime. Deleted data may not be recoverable.
                        </p>
                    </PolicySection>

                    <PolicySection title="14. Amendments">
                        <p>
                            Sellquic may update these Terms at any time with notice. Continued use means acceptance of updated
                            Terms.
                        </p>
                    </PolicySection>

                    <PolicySection title="15. Governing Law">
                        <p>
                            These Terms are governed by the laws of the Republic of Ghana. Disputes will be handled in Ghanaian
                            courts.
                        </p>
                    </PolicySection>

                    <PolicySection title="16. Contact">
                        <p>
                            For support or inquiries, contact: <a href="mailto:hello@sellquic.com" className="text-primary hover:underline">hello@sellquic.com</a> | www.sellquic.com
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
