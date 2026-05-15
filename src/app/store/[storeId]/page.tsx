'use client';
import { StoreHero } from '@/components/store-hero';
import { StoreProductGrid } from '@/components/store-product-grid';
import { FaqSection } from '@/components/store/FaqSection';
import { CategorySection } from '@/components/store/CategorySection';
import { OrderTrackingSection } from '@/components/store/OrderTrackingSection';
import { HelpSection } from '@/components/store/HelpSection';
import { AboutSection } from '@/components/store/AboutSection';

export default function StorePage() {
  return (
    <div>
      <StoreHero />
      <CategorySection />
      <StoreProductGrid />
      <AboutSection />
      <OrderTrackingSection />
      <HelpSection />
      <FaqSection />
    </div>
  );
}
