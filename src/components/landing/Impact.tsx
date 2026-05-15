"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Zap, Bell, CheckCircle, ArrowRight } from 'lucide-react';

const STEPS = [
  {
    id: 'replies',
    title: "Instant Replies",
    desc: "Your AI responds to every customer in seconds — any time of day or night.",
    icon: <Zap className="w-5 h-5" />,
  },
  {
    id: 'alerts',
    title: "Real-Time Order Alerts",
    desc: "Get an instant SMS and email the moment a customer places an order.",
    icon: <Bell className="w-5 h-5" />,
  },
  {
    id: 'confirm',
    title: "Automatic Payment Confirmation",
    desc: "No more chasing screenshots. Payments confirmed and logged automatically.",
    icon: <CheckCircle className="w-5 h-5" />,
  }
];

export default function Impact() {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % STEPS.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="relative bg-white py-16 lg:py-32 overflow-hidden">
      <div className="max-w-4xl mx-auto px-6 relative z-10">
        
        {/* SECTION HEADER */}
        <div className="text-center mb-16 lg:mb-20">
          <h2 className="text-4xl lg:text-7xl font-black text-[#0A1D3A] tracking-tighter leading-[0.9] uppercase mb-8">
            Never miss a <br /> <span className="text-[#5722c1]">sale again.</span>
          </h2>
          <p className="text-base md:text-xl text-black-300 font-medium leading-relaxed">
            The moment a customer messages, your AI responds. The moment they order, you get an alert. The moment they pay, it’s confirmed automatically.
          </p>
        </div>

        {/* CENTERED SELECTION LIST */}
        <div className="flex flex-col gap-4">
          {STEPS.map((step, idx) => (
            <button
              key={step.id}
              onClick={() => setActiveStep(idx)}
              className={`w-full text-left p-8 rounded-3xl transition-all duration-300 flex items-start gap-6 border ${
                activeStep === idx 
                ? 'bg-white border-[#5722c1] shadow-[0_20px_50px_-20px_rgba(87,34,193,0.15)] scale-[1.02]' 
                : 'bg-transparent border-transparent opacity-40 hover:opacity-100'
              }`}
            >
              <div className={`p-3 rounded-xl flex-shrink-0 ${activeStep === idx ? 'bg-[#5722c1] text-white' : 'bg-gray-100 text-gray-400'}`}>
                {step.icon}
              </div>
              <div>
                <h4 className="text-xl lg:text-2xl font-black text-[#0A1D3A] mb-2">{step.title}</h4>
                <div className={`transition-all duration-500 overflow-hidden ${activeStep === idx ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'}`}>
                  <p className="text-base lg:text-lg text-gray-500 font-medium leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* FINAL CTA BUTTON (TEXT ADDED BACK) */}
        <div className="mt-20 text-center">
            <button 
                onClick={() => window.location.href = 'https://sellquic.com/signup'}
                className="w-full py-6 bg-[#5722c1] text-white rounded-2xl font-black text-lg lg:text-xl uppercase tracking-widest hover:bg-[#451ba1] transition-all shadow-2xl shadow-purple-500/40 active:scale-95 group"
            >
                <span className="flex items-center justify-center gap-3">
                    Create Your Store Free
                    <ArrowRight className="w-6 h-6 transition-transform group-hover:translate-x-2" />
                </span>
            </button>
        </div>

      </div>
    </section>
  );
}