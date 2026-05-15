"use client";

import React from 'react';

const TrustBar = () => {
  const items = [
    "Now Live in Ghana",
    "Complete Selling System",
    "Built for African Online Businesses",
    "Powered by SellQuic AI",
  ];

  return (
    <div className="relative w-full z-20 -my-4 px-4">
      {/* 
         The Glass Container 
         - bg-white/40: Semi-transparent white
         - backdrop-blur-xl: The "frosty" glass effect
         - border-white/40: The crystalline edge
      */}
      <div className="max-w-7xl mx-auto bg-white/40 backdrop-blur-xl border border-white/60 rounded-[2rem] py-6 overflow-hidden shadow-[0_8px_32px_0_rgba(31,38,135,0.07)]">
        
        {/* Side Masks to fade text in/out */}
        <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white/20 to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-white/20 to-transparent z-10 pointer-events-none" />

        {/* Marquee Animation */}
        <div className="flex animate-marquee whitespace-nowrap items-center">
          {[...Array(4)].map((_, groupIndex) => (groupIndex === 0 || groupIndex === 1 || groupIndex === 2 || groupIndex === 3) && (
            <div key={groupIndex} className="flex items-center gap-12 px-6">
              {items.map((item, itemIndex) => (
                <React.Fragment key={itemIndex}>
                  <span className="text-[#5722c1] font-black uppercase tracking-[0.25em] text-[10px] md:text-xs">
                    {item}
                  </span>
                  {/* Designer separator dot */}
                  <div className="w-1.5 h-1.5 rounded-full bg-[#5722c1]/20" />
                </React.Fragment>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TrustBar;