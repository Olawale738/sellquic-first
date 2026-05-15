'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Shield, Cookie, Instagram, Linkedin, Twitter, Library, Gift, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { HomeHeader } from "@/components/landing/HomeHeader";
import { footer } from "@/components/landing/footer";

const policyLinks = [
    {
        title: "Terms & Conditions",
        description: "The rules and guidelines for using our platform.",
        link: "/terms",
        icon: FileText
    },
    {
        title: "Privacy Policy",
        description: "How we collect, use, and protect your data.",
        link: "/privacy-policy",
        icon: Shield
    },
    {
        title: "Cookie Policy",
        description: "Information about the cookies we use on our site.",
        link: "/cookies",
        icon: Cookie
    },
    {
        title: "Affiliate Policy",
        description: "Terms for participating in our affiliate program.",
        link: "/affiliate-policy",
        icon: Gift
    },
    {
        title: "Data Deletion Policy",
        description: "How to request the deletion of your account and data.",
        link: "/data-deletion",
        icon: Trash2
    }
];

export default function PoliciesPage() {
    return (
        <div className="bg-white flex flex-col min-h-screen">
            <HomeHeader />
            <main className="pt-24 flex-1">
                <div className="bg-gray-50 py-24 sm:py-32">
                    <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center">
                         <Library className="mx-auto h-16 w-16 text-primary" />
                        <h1 className="mt-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">Our Policies</h1>
                        <p className="mt-6 text-lg leading-8 text-gray-600 max-w-2xl mx-auto">
                           Review our terms, privacy, and cookie policies to understand how we operate and protect your data.
                        </p>
                    </div>
                </div>

                <div className="py-24 sm:py-32">
                    <div className="mx-auto max-w-5xl px-6 lg:px-8">
                         <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
                            {policyLinks.map((policy) => (
                                <Link key={policy.title} href={policy.link} className="block">
                                    <Card className="text-center hover:shadow-lg hover:-translate-y-1 transition-transform h-full">
                                        <CardHeader>
                                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                                                <policy.icon className="h-6 w-6 text-primary" />
                                            </div>
                                            <CardTitle className="mt-4">{policy.title}</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-muted-foreground">{policy.description}</p>
                                        </CardContent>
                                    </Card>
                                </Link>
                            ))}
                         </div>
                    </div>
                </div>
            </main>
             <footer />
        </div>
    );
}
