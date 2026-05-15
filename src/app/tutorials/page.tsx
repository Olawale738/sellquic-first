'use client';

import React, { useState } from 'react';
import { Play } from "lucide-react";
import { HomeHeader } from '@/components/landing/HomeHeader';
import { footer } from '@/components/landing/footer';

interface Lesson {
  id: string;
  title: string;
  videoUrl: string;
}

const LESSONS: Lesson[] = [
  { 
    id: "1", 
    title: "Lesson 1: The Ai assistant overview", 
    videoUrl: "https://player.cloudinary.com/embed/?cloud_name=db6kwsmnd&public_id=WhatsApp_Video_2026-04-25_at_11.24.35_AM_rkswy8", 
  },
  { 
    id: "2", 
    title: "Lesson 2: How to connect your Ai to your instagram account", 
    videoUrl: "https://player.cloudinary.com/embed/?cloud_name=db6kwsmnd&public_id=WhatsApp_Video_2026-04-25_at_11.25.42_AM_tjygm4", 
  },
  { 
    id: "3", 
    title: "Lesson 3: Writting a powerful brand intro", 
    videoUrl: "https://player.cloudinary.com/embed/?cloud_name=db6kwsmnd&public_id=WhatsApp_Video_2026-04-25_at_11.26.08_AM_o0kxsi", 
  },
  { 
    id: "4", 
    title: "Lesson 4: Check is your Ai is ready!", 
    videoUrl: "https://res.cloudinary.com/db6kwsmnd/video/upload/v1777234601/WhatsApp_Video_2026-04-25_at_11.26.45_AM_lrxghd.mp4", 
  },
  { 
    id: "5", 
    title: "Lesson 5: Customised your Ai", 
    videoUrl: "https://res.cloudinary.com/db6kwsmnd/video/upload/v1777234594/WhatsApp_Video_2026-04-25_at_11.27.14_AM_gbzbov.mp4", 
  }
];

export default function TutorialsPage() {
  const [activeLesson, setActiveLesson] = useState<Lesson>(LESSONS[0]);

  const handleLessonSelect = (lesson: Lesson) => {
    setActiveLesson(lesson);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="bg-white min-h-screen">
      <HomeHeader />
      
      <main className="pt-32 pb-24 px-6">
        <div className="container mx-auto max-w-5xl">
          
          {/* PLAYER SECTION */}
          <section className="mb-16">
            <h1 className="text-2xl md:text-4xl font-black text-slate-900 leading-tight uppercase tracking-tighter mb-8">
              {activeLesson.title}
            </h1>
            <div className="aspect-video w-full bg-slate-950 rounded-[2rem] overflow-hidden shadow-2xl relative border-[4px] border-slate-900">
                <iframe 
                    key={activeLesson.videoUrl}
                    className="w-full h-full" 
                    src={activeLesson.videoUrl} 
                    title={activeLesson.title} 
                    allow="autoplay; fullscreen; encrypted-media"
                    allowFullScreen
                ></iframe>
            </div>
          </section>

          {/* GRID OF TITLES */}
          <section className="pt-12 border-t border-slate-100">
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400 mb-8">
                All Lessons
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {LESSONS.map((lesson) => (
                <button 
                  key={lesson.id} 
                  onClick={() => handleLessonSelect(lesson)}
                  className={`group text-left p-6 rounded-2xl transition-all duration-300 border flex items-center justify-between ${
                    activeLesson.id === lesson.id 
                    ? 'border-purple-600 bg-purple-50' 
                    : 'border-slate-100 bg-white hover:border-purple-200'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${activeLesson.id === lesson.id ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                        <Play size={16} fill={activeLesson.id === lesson.id ? "currentColor" : "none"} />
                    </div>
                    <span className={`font-black uppercase text-sm tracking-tight ${activeLesson.id === lesson.id ? 'text-purple-600' : 'text-slate-900'}`}>
                        {lesson.title}
                    </span>
                  </div>
                  
                  {activeLesson.id === lesson.id && (
                    <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Watching</span>
                  )}
                </button>
              ))}
            </div>
          </section>

        </div>
      </main>

      <footer />
    </div>
  );
}