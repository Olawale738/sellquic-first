'use client';

import { HomeHeader } from '@/components/landing/HomeHeader';
import Hero from '@/components/landing/Hero';
import TrustBar from '@/components/landing/TrustBar';
import Problem from '@/components/landing/Problem';
import AiCustomizer from '@/components/landing/AiCustomizer';
import Impact from '@/components/landing/Impact';
import Steps from '@/components/landing/Steps';
import ArcCarousel from '@/components/landing/ArcCarousel';
import Payments from '@/components/landing/Payments';
import Faq from '@/components/landing/Faq';
import Testimonials from '@/components/landing/Testimonials';
import FinalCTA from '@/components/landing/FinalCTA';
import Ainsight from '@/components/landing/Ainsight';
import Inbox from '@/components/landing/Inbox';
import { HomeFooter } from '@/components/landing/Footer';

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <HomeHeader />
      <Hero />
      <TrustBar />
      <Problem />
      <ArcCarousel />
      <AiCustomizer />
      <Ainsight />
      <Payments />
      <Steps />
      <Impact />
      <Inbox />
      <Testimonials />
      <Faq />
      <FinalCTA />
      <HomeFooter />
    </main>
  );
}