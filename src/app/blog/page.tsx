'use client';

import React, { useEffect, useState } from 'react';
import { ArrowLeft, Calendar, User, ArrowRight, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// PREMIUM LANDING PAGE IMPORTS
import { HomeHeader } from '@/components/landing/HomeHeader';
import { footer } from '@/components/landing/footer';

interface BlogPost {
  tag: string;
  title: string;
  desc: string;
  content: string[];
}

const BLOG_POSTS: Record<string, BlogPost> = {
  "1": {
    tag: "Sourcing Guide",
    title: "How to Import from China to Ghana in 2026",
    desc: "A practical guide for small business vendors on finding suppliers and logistics.",
    content: [
      "Importing from China remains one of the smartest moves a small business owner in Ghana can make. The margins are real, the product variety is wide, and in 2026, the process is more streamlined than ever if you know what you are doing. Whether you sell fashion, beauty supplies, electronics, or home goods, this guide walks you through every step you need to take right now.",
      "Step 1: Find a Legitimate Supplier. Start with Alibaba, 1688.com, or Made-in-China.com. In 2026, these platforms have improved their verification systems, so look for suppliers marked as “Gold Supplier” or “Verified Manufacturer.” Do not stop at the profile. Request product samples before placing any bulk order. A supplier who refuses samples is a supplier you should skip.",
      "Ask specific questions: What is the minimum order quantity? Do they have experience shipping to West Africa? Can they provide a commercial invoice and packing list? The answers will tell you a lot.",
      "Step 2: Use a Trusted Logistics Company. Do not try to manage shipping and clearance on your own. In Ghana, goods from China come in by sea freight inside containers, and the right logistics company handles everything from the Chinese port all the way to your hands.",
      "In 2026, several logistics companies operate routes specifically between China and Ghana, with transparent pricing and regular shipment schedules. Ask for their shipping schedule, their per-kilogram or per-cubic-meter rates, and what their clearance process looks like.",
      "Step 3: Plan Your Inventory and Sales Cycle. One mistake new importers make is treating inventory as a one-time event. The vendors doing well in 2026 are the ones who have figured out their sales cycle and are placing repeat orders before their current stock runs out.",
      "Keep a simple spreadsheet of landed cost per unit — that is your product cost plus shipping plus duties plus logistics fees divided by the number of units. That number is your baseline. Everything above it is profit.",
      "How SellQuic Fits into This: Once your products arrive, SellQuic gives you your own storefront and an AI Store Assistant. The assistant works through Instagram DMs and handles your customer conversations automatically, shared prices, and takes orders 24/7 so you never miss a customer while you are busy sourcing."
    ]
  },
  "2": {
    tag: "Trends",
    title: "The 10 Best Products to Import from China (2026)",
    desc: "Discover the fastest-moving product categories for the Ghanaian market this year.",
    content: [
      "Ghana’s import trade is not slowing down. 2026 is shaping up to be one of the most competitive years yet. The products that move fast are the ones that solve real problems for everyday Ghanaians.",
      "1. Solar-Powered Products: Load shedding isn’t going anywhere. Solar lanterns, solar phone chargers, and small solar home systems are in constant demand.",
      "2. Affordable Wigs and Hair Extensions: The Ghanaian beauty market is massive. Lace front wigs, closures, and bundles remain some of the highest-margin products.",
      "3. Phone Accessories: Cases, screen protectors, wireless earbuds, and fast-charging cables. Low entry price and quick turnover.",
      "4. Ankara-Inspired Fashion Pieces: Chinese manufacturers have gotten very good at producing patterns that speak to African aesthetics.",
      "5. Home Organization Products: Storage bins, kitchen organizers, and bathroom accessories are trending as more Ghanaians invest in their living spaces.",
      "6. Baby and Kids’ Products: Parents never stop spending on their children. Strollers, feeding sets, and educational toys offer strong margins.",
      "7. Fitness and Wellness Products: Resistance bands, yoga mats, and massage guns are being searched for regularly online.",
      "8. LED Lighting: Strip lights and decorative bulbs are affordable to import and easy to sell to event planners or decorators.",
      "9. Kitchen Appliances: Air fryers, electric kettles, and blenders from Chinese manufacturers are significantly cheaper than branded alternatives.",
      "10. Skincare and Beauty Tools: Facial steamers, gua sha tools, and jade rollers are trending across West Africa.",
      "The DM Problem: Enquiries come fast once you start posting. If you manage messages manually, you lose sales. SellQuic AI handles those DMs for you automatically."
    ]
  },
  "3": {
    tag: "Sourcing",
    title: "How to Find Trusted Suppliers on 1688",
    desc: "Navigate China's biggest domestic marketplace even if you don't speak Mandarin.",
    content: [
      "If you sell in Ghana, chances are you have heard about 1688.com. Prices there are significantly lower than AliExpress. This guide walks you through finding reliable suppliers without speaking Mandarin.",
      "Translate the Platform: Open 1688.com in Google Chrome, right-click, and select “Translate to English.” Use simple keywords like “women dress” or “bodycon dress.”",
      "Supplier Profile: Look for how many years they have been active (3+ years is safer). Look for the “实力商家” badge (Verified Merchant). Aim for suppliers who score above 4.5 across description accuracy, communication, and shipping speed.",
      "Vet Before Committing: Never place a large first order. Place a sample order of 2-5 pieces first. Use a China-based sourcing agent to inspect goods before they ship. They typically charge 5-10% and are worth every pesewa.",
      "Relationships: Treat it like a partnership. Pay on time, communicate clearly, and keep a record of every conversation using Google Translate screenshots. This protects you in case of disputes."
    ]
  },
  "4": {
    tag: "Business Advice",
    title: "10 Wholesale Buying Mistakes Vendors Still Make",
    desc: "Stop losing money on slow-moving stock and silent profit killers.",
    content: [
      "1. Buying Too Much of One Item: Buy in variety. Test small quantities first, then restock what actually sells.",
      "2. Choosing Price Over Quality: Cheap input, cheap output. Customers notice quality, and bad quality leads to returns and complaints.",
      "3. Not Knowing Actual Cost Per Unit: Add transport, customs, storage, and damage. Many vendors skip this and wonder why they aren't making profit.",
      "4. Buying Without Checking Data: Look at what moved in the last 30-60 days before your next trip.",
      "5. Ignoring Seasonal Demand: Rhythms like Christmas, Homowo, and school reopening affect what people buy. Don't stock the same thing all year.",
      "6. Letting Suppliers Rush You: A rushed decision is often a bad one. If a deal evaporates when you ask for time, it wasn't a good deal.",
      "7. No Relationship: Consistent buyers get early access to stock and better prices. Relationships are currency.",
      "8. Underestimating Damage: Assume a few items in 50 will arrive damaged. Build that into your pricing.",
      "9. Buying Items You Can't Describe: If you can't answer sizing or fabric questions, you will struggle to sell.",
      "10. Not Tracking Sales Channels: Know if your sales come from IG, WhatsApp, or in person so you can plan your next buy."
    ]
  },
  "5": {
    tag: "Tech & AI",
    title: "5 Free AI Tools African Small Businesses Can Use",
    desc: "Practical tools that save time and make your business look expensive.",
    content: [
      "1. Otter.ai: Transcribes voice notes into text. Record yourself describing new stock and copy it straight into product descriptions.",
      "2. Remove.bg: Removes backgrounds from product photos in seconds. It makes your market stall photos look like a professional studio shoot.",
      "3. SellQuic AI: Connect it to WhatsApp and Instagram. It greets customers and answers common questions while you are at the market or asleep.",
      "4. Looka: Generates professional logos and brand identities in minutes. A consistent brand makes customers trust you faster.",
      "5. Pictory: Turns product photos into short videos for Reels or TikTok automatically. Move your products in motion to win more attention."
    ]
  },
  "6": {
    tag: "Sourcing",
    title: "10 Must-Know Terms Before You Buy from China",
    desc: "Understand the business language of Chinese suppliers to negotiate better.",
    content: [
      "1. MOQ (Minimum Order Quantity): The smallest number of units a supplier will sell you.",
      "2. FOB (Free on Board): Supplier gets goods to the Chinese port; you handle freight from there.",
      "3. EXW (Ex Works): Supplier’s job ends at their factory gate. You handle all trucking and logistics.",
      "4. Lead Time: How long the supplier needs to produce your order before it ships.",
      "5. RFQ (Request for Quotation): A formal message asking for pricing based on your specific details.",
      "6. Sample Fee: Costs for a test item. Many suppliers refund this if you place a bulk order later.",
      "7. Trade Assurance: Alibaba’s buyer protection. Payment is only released once you confirm arrival.",
      "8. OEM: Putting your brand on an existing product.",
      "9. ODM: Rebranding a design the supplier has already created for you.",
      "10. Shipping Agent: The company that handles your logistics, customs, and documentation. Essential for importers."
    ]
  },
  "7": {
    tag: "Marketing",
    title: "How to Take Better Product Photos with AI",
    desc: "Make your products stand out on the timeline without a professional studio.",
    content: [
      "Lighting: Natural daylight is your best friend. Set up near a window. Avoid yellow bulbs. Use white cardboard to reflect light back and fill shadows.",
      "Background: Keep it clean. A white bedsheet or cardboard works for every product. Your product should be the only thing the eye lands on.",
      "Shooting: Take a full flat lay, a close-up for texture, and a lifestyle shot showing the product in use. Use the gridlines on your phone to keep things straight.",
      "AI Editing Tools: Use Remove.bg to clean backgrounds. Use Canva for basic adjustments. Adobe Express on mobile has an AI image enhancer to sharpen blurry photos.",
      "Consistency: Batch your shoots. Pick one morning a week and shoot everything at once so your whole page has a cohesive look."
    ]
  },
  "8": {
    tag: "Women's Fashion",
    title: "Best Women’s Fashion Items to Import to Ghana",
    desc: "The high-performing fashion categories that Ghanaian women love.",
    content: [
      "Occasionwear: Bodycon dresses, sequined midi dresses, and formal sets sell year-round for birthdays, work events, and Sunday service.",
      "Casual Everyday Wear: Linen co-ord sets and wide-leg trouser sets are moving fast. Prioritize breathable fabrics given the Ghanaian climate.",
      "Footwear: Block heels and platform sandals for working women. Flat mules for casual wear. Be careful with Chinese sizing—it often runs small.",
      "Handbags and Accessories: Mini crossbody bags and structured bags are strong sellers. Accessories have a lower shipping cost and are lower risk.",
      "Shapewear and Loungewear: Seamless bodysuits and satin pajama sets have wide appeal and generate high repeat customers.",
      "Communication: Lost sales happen when conversation is too slow. Use SellQuic AI to answer sizing and price questions 24/7."
    ]
  },
  "9": {
    tag: "Men's Fashion",
    title: "Smart Vendor’s Guide to Men’s Fashion",
    desc: "Source the corporate and casual items men in Ghana are looking for.",
    content: [
      "Slim-Fit Shirts: Corporate cotton blends in neutral colors are perennial bestsellers for professionals in Accra and Kumasi.",
      "Casual Polos: Versatile for the climate. Source from suppliers with consistent stitching; cheap polos that fade will lead to complaints.",
      "Cargo Pants and Chinos: Streetwear is massive with young men. Stick to neutral tones like khaki, olive, and navy for maximum turnover.",
      "Sneakers: Mid-range sneakers that mimic global styles sell well. Always request samples to check sole durability.",
      "Accessories: Belts, wallets, and caps are margin boosters. Sell them as add-ons to clothing orders.",
      "Tracksuits: Athleisure is everywhere. Men wear tracksuits for errands, school runs, and casual outings. Full sets in 2-3 colors are best.",
      "Strategy: A focused range of quality basics will outperform a chaotic mix. Let SellQuic AI handle the sizing questions so you can focus on the next collection."
    ]
  }
};

export default function BlogPage() {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    setActiveId(id);
  }, []);

  // --- FULL ARTICLE VIEW ---
  if (activeId && BLOG_POSTS[activeId]) {
    const article = BLOG_POSTS[activeId];
    return (
      <div className="bg-white min-h-screen">
        <HomeHeader />
        <main className="pt-24 md:pt-32 pb-20 px-4">
          <div className="container mx-auto max-w-4xl">
            <button 
                onClick={() => window.location.href = '/blog'} 
                className="flex items-center gap-2 text-slate-400 hover:text-purple-600 font-black mb-8 md:mb-12 uppercase text-[10px] tracking-widest transition-colors"
            >
              <ArrowLeft size={14} /> Back to All Posts
            </button>

            <Badge className="bg-purple-600 mb-4 md:mb-6 uppercase font-black tracking-widest text-[10px]">{article.tag}</Badge>
            <h1 className="text-3xl md:text-7xl font-black text-slate-900 leading-[1.1] md:leading-[0.95] tracking-tighter uppercase mb-8 md:mb-10">
                {article.title}
            </h1>
            
            <div className="flex flex-wrap items-center gap-4 md:gap-6 text-slate-400 font-bold text-[10px] md:text-xs uppercase border-y border-slate-100 py-4 md:py-6 mb-8 md:mb-12">
              <div className="flex items-center gap-2 text-slate-900"><User size={14} /> SellQuic Team</div>
              <div className="flex items-center gap-2"><Calendar size={14} /> March 2024</div>
            </div>

            <div className="prose prose-slate max-w-none">
               {article.content.map((paragraph, index) => (
                 <p key={index} className="text-lg md:text-xl text-slate-600 leading-relaxed font-medium mb-6 md:mb-8">{paragraph}</p>
               ))}
            </div>

            <div className="mt-12 md:mt-20 p-6 md:p-12 bg-[#5722c1] rounded-[2rem] md:rounded-[3rem] text-white text-center shadow-2xl">
               <h2 className="text-2xl md:text-4xl font-black uppercase mb-4 tracking-tighter">Ready to sell smarter?</h2>
               <Button 
                onClick={() => window.location.href = 'https://sellquic.com/signup'} 
                className="w-full sm:w-auto bg-white text-[#5722c1] h-14 md:h-16 px-8 md:px-12 rounded-xl md:rounded-[1.5rem] font-black text-base md:text-xl shadow-xl uppercase tracking-widest hover:scale-105"
               >
                  Create your free website <ArrowRight className="ml-2" />
               </Button>
            </div>
          </div>
        </main>
        <footer />
      </div>
    );
  }

  // --- LIST VIEW (ALL 9 BLOGS) ---
  return (
    <div className="bg-white min-h-screen">
      <HomeHeader />
      <main className="pt-24 md:pt-32 pb-24 px-4">
        <div className="container mx-auto">
          <div className="mb-12 md:mb-16 text-center max-w-3xl mx-auto">
            <button 
                onClick={() => window.location.href = '/resources'} 
                className="flex items-center gap-2 text-slate-400 hover:text-purple-600 font-black mb-6 md:mb-8 uppercase text-[10px] tracking-widest mx-auto transition-colors"
            >
              <ArrowLeft size={14} /> Back to Resources
            </button>
            <h1 className="text-4xl md:text-8xl font-black text-slate-900 leading-[1] tracking-tighter uppercase mb-4 italic">Practical <br className="hidden md:block" /> <span className="text-purple-600 not-italic">Blogs</span></h1>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {Object.entries(BLOG_POSTS).map(([id, post]) => (
              <div 
                key={id} 
                onClick={() => window.location.href = `/blog?id=${id}`} 
                className="group cursor-pointer p-6 md:p-10 bg-slate-950 border border-white/10 rounded-[2rem] md:rounded-[3rem] hover:border-purple-600 transition-all flex flex-col h-full border-b-8 border-b-purple-600 shadow-2xl"
              >
                <Badge variant="outline" className="text-purple-400 border-purple-400 mb-4 md:mb-6 uppercase text-[10px] font-black w-fit">{post.tag}</Badge>
                <h3 className="text-xl md:text-2xl font-black text-white mb-3 md:mb-4 leading-tight group-hover:text-purple-400 transition-colors uppercase tracking-tight">{post.title}</h3>
                <p className="text-slate-400 text-sm font-medium mb-6 md:mb-8 flex-grow">{post.desc}</p>
                <div className="flex items-center gap-2 text-white font-black text-[10px] md:text-xs uppercase tracking-widest group-hover:translate-x-2 transition-transform">
                  Read Article <ArrowRight size={14} className="text-purple-600" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      <footer />
    </div>
  );
}