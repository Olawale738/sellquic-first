'use client';

import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import { Gift, Instagram, Linkedin, Twitter } from "lucide-react";
import { HomeHeader } from "@/components/landing/HomeHeader";
import { footer } from "@/components/landing/footer";

const PolicySection = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <div className="space-y-4">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">{title}</h2>
        <div className="space-y-4 text-gray-600 leading-loose">
            {children}
        </div>
    </div>
);

export default function AffiliatePolicyPage() {
    return (
        <div className="bg-white flex flex-col min-h-screen">
            <HomeHeader />
            <main className="pt-24 flex-1">
                <div className="bg-gray-50 py-24 sm:py-32">
                    <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center">
                         <Gift className="mx-auto h-16 w-16 text-primary" />
                        <h1 className="mt-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">Affiliate Program Policy</h1>
                        <p className="mt-6 text-lg leading-8 text-gray-600">Last updated: October 26, 2025</p>
                    </div>
                </div>

                <div className="max-w-4xl mx-auto py-16 px-6 space-y-12">
                     <PolicySection title="1. Introduction & Acceptance">
                        <p>
                            Welcome to the SellQuic Affiliate Program. This policy governs your participation as an affiliate. By registering for the program, you agree to these terms. SellQuic reserves the right to update this policy at any time.
                        </p>
                    </PolicySection>

                    <PolicySection title="2. Commission & Referrals">
                        <p>
                            Affiliates earn a <strong>30% commission</strong> for each new user who signs up using their unique referral link or code and subscribes to any paid SellQuic plan (Premium or Business).
                        </p>
                         <ul className="list-disc pl-6 space-y-2">
                            <li>Commissions are only earned on the first subscription purchase by a new referred user.</li>
                            <li>Referrals are tracked automatically via unique links or codes. Manual attribution is not possible.</li>
                            <li>A referral is considered successful only after the referred user's payment for a subscription is confirmed.</li>
                        </ul>
                    </PolicySection>
                    
                    <PolicySection title="3. Payouts">
                        <p>
                            Commissions are paid out weekly. The minimum payout balance is <strong>GH₵60.00</strong>.
                        </p>
                         <ul className="list-disc pl-6 space-y-2">
                            <li>Payouts are made directly to the Mobile Money (MoMo) account you provide in your affiliate dashboard.</li>
                            <li>It is your responsibility to ensure your payout details are accurate. SellQuic is not liable for payments sent to an incorrect number provided by you.</li>
                            <li>A commission becomes "Available" for payout after the referred user's payment is confirmed and any applicable refund period has passed.</li>
                        </ul>
                    </PolicySection>
                    
                    <PolicySection title="4. Prohibited Activities">
                        <p>
                           To maintain the integrity of the program, the following activities are strictly prohibited and will result in immediate termination from the program and forfeiture of all commissions:
                        </p>
                         <ul className="list-disc pl-6 space-y-2">
                            <li><strong>Spamming:</strong> Sending unsolicited emails or messages.</li>
                            <li><strong>Misleading Ads:</strong> Using false claims or impersonating SellQuic in advertisements.</li>
                            <li><strong>Self-Referrals:</strong> Signing up through your own affiliate link.</li>
                             <li><strong>Coupon Misuse:</strong> Posting your affiliate code on coupon-only websites without prior content.</li>
                             <li><strong>Brand Bidding:</strong> Bidding on keywords like "SellQuic" or variations in paid search ads.</li>
                        </ul>
                    </PolicySection>

                    <PolicySection title="5. Termination">
                        <p>
                           SellQuic reserves the right to terminate any affiliate account at any time for violation of this policy or for any other reason, at our sole discretion. Upon termination, all unpaid commissions will be forfeited.
                        </p>
                    </PolicySection>

                    <PolicySection title="6. Contact">
                        <p>
                            For questions about the affiliate program, please contact us at: <a href="mailto:hello@sellquic.com" className="text-primary hover:underline">hello@sellquic.com</a>.
                        </p>
                    </PolicySection>
                </div>
            </main>
             <footer />
        </div>
    );
}

    
