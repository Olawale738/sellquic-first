'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { HelpCircle, ChevronDown, Plus } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

const faqs = [
    {
        question: "Is SellQuic like Jumia or Jiji?",
        answer: "No. SellQuic is not a marketplace. You get your own branded, standalone website to attract your customers directly without competitors listed next to you."
    },
    {
        question: "How do I get customers to buy?",
        answer: "Simply share your link on WhatsApp, Instagram, Facebook, TikTok or Snapchat. We recommend offering special discounts or bonuses for customers who buy from your website."
    },
    {
        question: "I already have a website. Can I switch?",
        answer: "Yes. Our team will assist you with the migration. Just email us on hello@sellquic.com or send us a DM on Instagram."
    },
    {
        question: "Can I use my custom domain?",
        answer: "Yes! You can connect your own domain (e.g., myshop.com) or use our free subdomain (e.g., mystore.sellquic.com)."
    },
    {
        question: "How do I create my online store?",
        answer: "It’s super easy! Just sign up, upload your product pictures, add prices, and our AI will write the descriptions. Your store link will be ready in less than 5 minutes."
    },
    {
        question: "How do I get paid?",
        answer: "Money goes straight to you via Mobile Money, Bank Transfer, or Cash on Delivery. We also support automated card payments via Paystack."
    },
    {
        question: "Is there a limit on products?",
        answer: "Free accounts get 5 products. Premium accounts get Unlimited products and advanced features to help you scale."
    },
    {
        question: "Is SellQuic really free?",
        answer: "Yes. It is completely free to start with up to 5 products. Upgrade only when you are ready to grow bigger."
    }
];

export function Faq() {
    return (
        <section className="relative w-full py-24 md:py-32 overflow-hidden bg-[#FBF7EA]">
            
            {/* Animated Glassmorphic Background Elements */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <motion.div 
                    animate={{ 
                        scale: [1, 1.2, 1],
                        rotate: [0, 90, 0],
                        x: [0, 50, 0]
                    }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-orange-200/40 rounded-full blur-[120px]"
                />
                <motion.div 
                    animate={{ 
                        scale: [1, 1.3, 1],
                        rotate: [0, -90, 0],
                        x: [0, -50, 0]
                    }}
                    transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                    className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-purple-200/30 rounded-full blur-[150px]"
                />
            </div>

            <div className="container relative z-10 px-6 mx-auto">
                
                {/* Header Section */}
                <div className="flex flex-col items-center justify-center text-center mb-20">
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="inline-flex items-center gap-2 bg-white/50 backdrop-blur-md border border-white/60 px-4 py-1.5 rounded-full text-sm font-bold shadow-sm mb-6"
                    >
                        <HelpCircle className="w-4 h-4 text-[#0A1D3A]" />
                        <span className="text-[#0A1D3A] uppercase tracking-widest text-[10px]">Support Center</span>
                    </motion.div>
                    
                    <motion.h2 
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 }}
                        className="text-4xl md:text-6xl font-black tracking-tight text-[#0A1D3A] mb-6 leading-tight"
                    >
                        Got Questions? <br/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-purple-600">
                            We've Got Answers.
                        </span>
                    </motion.h2>
                    <p className="max-w-xl text-gray-600 md:text-lg font-medium">
                        Everything you need to know about setting up your branded store and scaling your business in Africa.
                    </p>
                </div>

                {/* FAQ Glassmorphic Accordion */}
                <div className="mx-auto w-full max-w-3xl">
                     <Accordion type="single" collapsible className="space-y-4">
                        {faqs.map((faq, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.1 }}
                            >
                                <AccordionItem 
                                    value={`item-${index}`} 
                                    className="group border-none bg-white/40 backdrop-blur-md border border-white/60 rounded-[1.5rem] overflow-hidden shadow-[0_8px_32px_0_rgba(31,38,135,0.05)] transition-all hover:bg-white/60"
                                >
                                    <AccordionTrigger className="px-8 py-6 text-left font-bold text-[#0A1D3A] text-lg md:text-xl hover:no-underline transition-all">
                                        <div className="flex items-center justify-between w-full">
                                            <span>{faq.question}</span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="px-8 pb-8 text-gray-600 text-base md:text-lg leading-relaxed font-medium">
                                        <div className="pt-2 border-t border-[#0A1D3A]/5">
                                            {faq.answer}
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            </motion.div>
                        ))}
                    </Accordion>
                </div>

                {/* Bottom CTA */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    className="mt-16 text-center"
                >
                    <p className="text-[#0A1D3A]/60 font-bold mb-4 italic">Still have questions?</p>
                    <a 
                        href="mailto:hello@sellquic.com" 
                        className="inline-flex items-center gap-2 text-[#0A1D3A] font-black border-b-2 border-orange-500 hover:text-orange-500 transition-colors"
                    >
                        Talk to our support team directly →
                    </a>
                </motion.div>
            </div>
        </section>
    );
}

export default Faq;