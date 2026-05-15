'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, ChevronRight, ArrowLeft, ArrowRight, LayoutDashboard,
  Megaphone, Bot, Sparkles, SearchCode, Timer, ShoppingBag,
  Image as ImageIcon, Tag, Instagram, Zap, UserCog, PenTool,
  Share2, MessageCircle
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

// USING YOUR LANDING PAGE COMPONENTS
import { HomeHeader } from '@/components/landing/HomeHeader';
import { footer } from '@/components/landing/footer';

const GUIDES_DATA = [
  {
    id: 1,
    title: "Connect Google Analytics",
    category: "Analytics",
    icon: <LayoutDashboard className="w-4 h-4" />,
    description: "Knowing exactly how customers find and use your store is one of the most powerful things you can do for your business.",
    steps: [
      { title: "Open the Menu", detail: "Go to your SellQuic dashboard and click on the menu." },
      { title: "Go to Marketing", detail: "Select Marketing, then click on Tracking & SEO." },
      { title: "Add Your Google Analytics ID", detail: "Scroll to the Tracking & Analytics section and paste your Google Analytics ID." },
      { title: "Save Your Changes", detail: "Click the Save Changes button at the top of the page." },
      { title: "Start Tracking", detail: "Open your GA4 dashboard to see visits and best-sellers." }
    ]
  },
  {
    id: 2,
    title: "Track Sales with Facebook Pixel",
    category: "Marketing",
    icon: <Megaphone className="w-4 h-4" />,
    description: "Facebook Pixel helps you understand which ads and posts are actually bringing in customers.",
    steps: [
      { title: "Access Your Dashboard", detail: "Go to your SellQuic vendor dashboard." },
      { title: "Open Marketing Settings", detail: "Click on the Marketing menu and select Tracking & SEO." },
      { title: "Get Your Pixel ID", detail: "Log in to Facebook Business Manager and find your Pixel ID." },
      { title: "Add the Pixel ID", detail: "Paste the Pixel ID into the Tracking & Analytics section." },
      { title: "Save Your Changes", detail: "Click Save Changes at the top to finish." }
    ]
  },
  {
    id: 3,
    title: "Get Found on Google (SEO)",
    category: "Marketing",
    icon: <SearchCode className="w-4 h-4" />,
    description: "A good SEO title and description helps your store show up when customers search for products like yours.",
    steps: [
      { title: "Access Your Dashboard", detail: "Go to your SellQuic vendor dashboard." },
      { title: "Open Marketing Settings", detail: "Click on Marketing > Tracking & SEO." },
      { title: "Add SEO Details", detail: "Add an SEO Title (under 60 chars) and Description (under 160 chars)." },
      { title: "Save Your Changes", detail: "Click Save Changes to apply settings." }
    ]
  },
  {
    id: 4,
    title: "Three Marketing Tricks for 10x Sales",
    category: "Growth",
    icon: <Sparkles className="w-4 h-4" />,
    description: "Built-in marketing tools designed to create urgency and drive more sales immediately.",
    steps: [
      { title: "Flash Sale Timer", detail: "Marketing > Discounts > Toggle Flash Sale Timer ON." },
      { title: "Store-Wide Sale", detail: "Marketing > Discounts > Toggle Activate Sale ON." },
      { title: "Promotional Bar", detail: "Store Setup > Appearance. Enable Promotional Bar for 'Free Delivery'." }
    ]
  },
  {
    id: 5,
    title: "Add Flash Sale Timer",
    category: "Growth",
    icon: <Timer className="w-4 h-4" />,
    description: "A countdown timer creates urgency and pushes customers to buy now.",
    steps: [
      { title: "Open Marketing", detail: "Go to Marketing > Discounts & Promos." },
      { title: "Turn On the Timer", detail: "Find the Flash Sale Countdown section and switch it ON." },
      { title: "Set Deadline", detail: "Choose your End Date and set the exact End Time." },
      { title: "Save & Preview", detail: "Click Save Changes and check your store live." }
    ]
  },
  {
    id: 6,
    title: "Run a Store-Wide Sale",
    category: "Growth",
    icon: <ShoppingBag className="w-4 h-4" />,
    description: "Automatically apply a discount across all products. Perfect for holiday sales.",
    steps: [
      { title: "Go to Discounts", detail: "Dashboard > Marketing > Discounts & Promos." },
      { title: "Turn On the Sale", detail: "Toggle the 'Activate Sale' switch ON." },
      { title: "Set Your Discount", detail: "Enter a percentage (e.g., '15')." },
      { title: "Save Changes", detail: "Click Save Changes to apply immediately." }
    ]
  },
  {
    id: 7,
    title: "Hero Banner That Stops Scrollers",
    category: "Appearance",
    icon: <ImageIcon className="w-4 h-4" />,
    description: "The hero banner is the first thing customers see. Make it high-impact.",
    steps: [
      { title: "Navigate to Appearance", detail: "Menu > Store Setup > Appearance." },
      { title: "Turn On Hero Banner", detail: "Toggle 'Show Hero Banner' switch ON." },
      { title: "Upload Image", detail: "Click the Background Image area and upload your graphic." },
      { title: "Save & Refresh", detail: "Click Save All Settings and refresh your shop." }
    ]
  },
  {
    id: 8,
    title: "Badges & Crossed-Out Prices",
    category: "Growth",
    icon: <Tag className="w-4 h-4" />,
    description: "Make customers feel like they're getting a deal by showing savings clearly.",
    steps: [
      { title: "Enable Display Options", detail: "In Discounts & Promos, turn ON 'Show Sale Badges' and 'Show Crossed-Out Prices'." },
      { title: "Save Changes", detail: "Click Save Changes at the top of the screen." }
    ]
  },
  {
    id: 9,
    title: "AI Assistant Overview",
    category: "AI",
    icon: <Bot className="w-4 h-4" />,
    description: "Your AI Assistant is the engine that keeps your store running around the clock.",
    steps: [
      { title: "Open AI Settings", detail: "Menu > Store Setup > AI Assistant." },
      { title: "Connect Channels", detail: "Connect Instagram DM or WhatsApp for automatic replies." },
      { title: "Customize Identity", detail: "Set a name (e.g., Ama) and tone (e.g., Professional)." }
    ]
  },
  {
    id: 10,
    title: "Connecting Instagram DM",
    category: "AI",
    icon: <Instagram className="w-4 h-4" />,
    description: "Automatically reply to every customer who messages you on Instagram.",
    steps: [
      { title: "Connect Instagram", detail: "In AI Assistant settings, click 'Connect Instagram'." },
      { title: "Log In", detail: "Enter your Instagram credentials." },
      { title: "Allow Permissions", detail: "Enable access for Messages and Comments." }
    ]
  },
  {
    id: 11,
    title: "AI Readiness Scan",
    category: "AI",
    icon: <Zap className="w-4 h-4" />,
    description: "Checks your store and tells you exactly what needs fixing for best AI performance.",
    steps: [
      { title: "Find Scan Tool", detail: "Menu > Store Setup > AI Assistant." },
      { title: "Run the Scan", detail: "Click the purple 'Scan My Store' button." },
      { title: "Fix Issues", detail: "Review recommendations and click 'Fix'." }
    ]
  },
  {
    id: 12,
    title: "Customisation & Persona",
    category: "AI",
    icon: <UserCog className="w-4 h-4" />,
    description: "Make your AI assistant feel like a natural extension of your brand.",
    steps: [
      { title: "Set Name & Tone", detail: "Enter a name (e.g., Josh) and pick a tone (Polite/Professional)." },
      { title: "Set Handover Rules", detail: "Choose when AI should pass the chat to you." }
    ]
  },
  {
    id: 13,
    title: "Writing a Powerful Brand Intro",
    category: "AI",
    icon: <PenTool className="w-4 h-4" />,
    description: "The Brand Intro is what your AI reads to understand your business correctly.",
    steps: [
      { title: "Write Details", detail: "Include business name, delivery areas, and return policies." },
      { title: "AI Enhancer", detail: "Click the magic wand to expand your description automatically." }
    ]
  },
  {
    id: 14,
    title: "Sharing Your AI Chat Link",
    category: "AI",
    icon: <Share2 className="w-4 h-4" />,
    description: "Let customers chat with your AI assistant from anywhere.",
    steps: [
      { title: "Copy Link", detail: "In AI settings, find 'Share AI Link' and click 'Copy Link'." },
      { title: "Add to Bio", detail: "Paste link in Instagram bio or TikTok profile." }
    ]
  }
];

export default function GuidePage() {
  const [activeGuideId, setActiveGuideId] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");

  // INTEGRATION LOGIC: Check URL for specific guide ID on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id && !isNaN(parseInt(id))) {
      setActiveGuideId(parseInt(id));
    }
  }, []);

  const filteredGuides = useMemo(() => {
    return GUIDES_DATA.filter(g => 
      g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  const activeGuide = GUIDES_DATA.find(g => g.id === activeGuideId) || GUIDES_DATA[0];

  const nextGuide = () => {
    const currentIndex = GUIDES_DATA.findIndex(g => g.id === activeGuideId);
    if (currentIndex < GUIDES_DATA.length - 1) setActiveGuideId(GUIDES_DATA[currentIndex + 1].id);
  };

  const prevGuide = () => {
    const currentIndex = GUIDES_DATA.findIndex(g => g.id === activeGuideId);
    if (currentIndex > 0) setActiveGuideId(GUIDES_DATA[currentIndex - 1].id);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <HomeHeader />

      <main className="flex-1 pt-28 pb-20">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <Badge className="bg-purple-600 text-white hover:bg-purple-700 mb-4 px-4 uppercase font-black tracking-widest text-[10px]">Academy</Badge>
              <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight uppercase">Master Your Store</h1>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Search guides..." 
                className="pl-10 h-12 rounded-2xl border-slate-200 focus:ring-purple-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="grid lg:grid-cols-[380px_1fr] gap-10 items-start">
            <div className="bg-slate-50 border border-slate-100 rounded-[2rem] overflow-hidden lg:sticky lg:top-32">
              <div className="p-6 border-b border-slate-200 bg-white">
                <h3 className="font-black text-slate-900 uppercase tracking-tighter">Tutorial Contents</h3>
              </div>
              <ScrollArea className="h-[400px] lg:h-[65vh]">
                <div className="p-3 space-y-1">
                  {filteredGuides.map((guide) => (
                    <button
                      key={guide.id}
                      onClick={() => setActiveGuideId(guide.id)}
                      className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all text-left ${
                        activeGuideId === guide.id 
                        ? 'bg-white shadow-xl border border-purple-100' 
                        : 'hover:bg-purple-50/50 text-slate-600'
                      }`}
                    >
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${activeGuideId === guide.id ? 'bg-purple-600 text-white' : 'bg-white text-slate-400 border border-slate-200'}`}>
                        {guide.icon}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className={`text-sm font-bold truncate ${activeGuideId === guide.id ? 'text-purple-600' : 'text-slate-900'}`}>{guide.title}</p>
                        <p className="text-[10px] uppercase font-black text-slate-400">Guide {guide.id} of 14</p>
                      </div>
                      <ChevronRight className={`h-4 w-4 ${activeGuideId === guide.id ? 'text-purple-600' : 'opacity-0'}`} />
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            <div className="min-h-[70vh]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeGuideId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="bg-white border border-slate-200 rounded-[3rem] p-8 md:p-16 shadow-2xl border-t-8 border-t-purple-600">
                    <div className="flex items-center justify-between mb-10">
                      <Badge variant="outline" className="text-purple-600 border-purple-200 bg-purple-50 px-4 py-1 font-bold">{activeGuide.category}</Badge>
                      <span className="text-xs font-black text-slate-400 uppercase">Guide {activeGuide.id} / 14</span>
                    </div>

                    <h2 className="text-3xl md:text-5xl font-black text-slate-900 mb-6 leading-tight uppercase tracking-tighter">{activeGuide.title}</h2>
                    <p className="text-xl text-slate-500 mb-12 leading-relaxed max-w-3xl font-medium">{activeGuide.description}</p>

                    <div className="space-y-12">
                      {activeGuide.steps.map((step, index) => (
                        <div key={index} className="relative flex gap-8 group">
                          <div className="flex flex-col items-center">
                            <div className="h-12 w-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-lg shrink-0 z-10 group-hover:bg-purple-600 transition-colors">{index + 1}</div>
                            {index !== activeGuide.steps.length - 1 && <div className="w-1 h-full bg-slate-100 absolute top-12 left-[23px] z-0" />}
                          </div>
                          <div className="pt-1 flex-1">
                            <h3 className="text-2xl font-black text-slate-900 mb-3 uppercase tracking-tight">{step.title}</h3>
                            <div className="text-lg text-slate-600 leading-relaxed bg-slate-50/50 p-6 rounded-3xl border border-slate-100 font-medium">{step.detail}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-12 border-t border-slate-100 mt-16">
                      <Button variant="outline" size="lg" onClick={prevGuide} disabled={activeGuideId === 1} className="rounded-2xl h-14 px-8 border-slate-200 text-slate-600 font-bold w-full sm:w-auto">
                        <ArrowLeft className="mr-2 h-5 w-5" /> Previous
                      </Button>
                      <Button size="lg" onClick={nextGuide} disabled={activeGuideId === 14} className="bg-purple-600 hover:bg-purple-700 rounded-2xl h-14 px-10 font-bold shadow-xl shadow-purple-200 w-full sm:w-auto">
                        Next Tutorial <ArrowRight className="ml-2 h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>

              <div className="mt-10 bg-slate-900 rounded-[2.5rem] p-10 text-white flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl">
                 <div>
                    <h4 className="text-2xl font-black mb-2 uppercase tracking-tight">Still need help?</h4>
                    <p className="text-slate-400 max-w-sm font-medium">Our onboarding team is ready to walk you through the setup on WhatsApp.</p>
                 </div>
                 <Button onClick={() => window.location.href = 'https://wa.me/YOUR_NUMBER'} className="bg-purple-600 hover:bg-purple-700 text-white rounded-2xl px-10 py-8 text-lg font-black w-full md:w-auto uppercase tracking-widest shadow-xl">
                    <MessageCircle className="mr-2 h-5 w-5" /> Chat with Support
                 </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
      <footer />
    </div>
  );
}