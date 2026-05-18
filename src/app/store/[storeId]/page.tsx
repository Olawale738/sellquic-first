'use client';
import { StoreHero } from '@/components/store-hero';
import { StoreProductGrid } from '@/components/store-product-grid';
import { FaqSection } from '@/components/store/FaqSection';
import { CategorySection } from '@/components/store/CategorySection';
import { StoreContactBand } from '@/components/store/StoreContactBand';
import { AboutSection } from '@/components/store/AboutSection';
import { StoreFeaturesSection } from '@/components/store/StoreFeaturesSection';
import { useStore } from '@/context/store-context';

function CategoryStoreLayout() {
  const { store } = useStore();
  const category = (store?.category || '').toLowerCase().trim();

  if (category === 'fashion' || category === 'clothing' || category === 'apparel') {
    return (
      <div className="flex flex-col">
        <StoreHero />
        <CategorySection />
        <StoreProductGrid />
        <StoreFeaturesSection />
        <AboutSection />
        <FaqSection />
        <StoreContactBand />
      </div>
    );
  }

  if (category === 'food' || category === 'restaurant' || category === 'catering' || category === 'bakery') {
    return (
      <div className="flex flex-col">
        <StoreHero />
        <CategorySection />
        <StoreProductGrid />
        <StoreFeaturesSection />
        <AboutSection />
        <StoreContactBand />
      </div>
    );
  }

  if (category === 'beauty' || category === 'cosmetics' || category === 'skincare' || category === 'makeup') {
    return (
      <div className="flex flex-col">
        <StoreHero />
        <CategorySection />
        <StoreProductGrid />
        <StoreFeaturesSection />
        <AboutSection />
        <FaqSection />
        <StoreContactBand />
      </div>
    );
  }

  if (category === 'electronics' || category === 'tech' || category === 'gadgets' || category === 'computers') {
    return (
      <div className="flex flex-col">
        <StoreHero />
        <CategorySection />
        <StoreProductGrid />
        <StoreFeaturesSection />
        <StoreContactBand />
      </div>
    );
  }

  if (category === 'furniture' || category === 'home' || category === 'decor' || category === 'interior') {
    return (
      <div className="flex flex-col">
        <StoreHero />
        <CategorySection />
        <StoreProductGrid />
        <StoreFeaturesSection />
        <AboutSection />
        <StoreContactBand />
      </div>
    );
  }

  if (category === 'groceries' || category === 'supermarket' || category === 'produce' || category === 'fresh') {
    return (
      <div className="flex flex-col">
        <StoreHero />
        <CategorySection />
        <StoreProductGrid />
        <StoreFeaturesSection />
        <StoreContactBand />
      </div>
    );
  }

  if (category === 'services' || category === 'consulting' || category === 'logistics' || category === 'repair') {
    return (
      <div className="flex flex-col">
        <StoreHero />
        <CategorySection />
        <StoreProductGrid />
        <StoreFeaturesSection />
        <AboutSection />
        <FaqSection />
        <StoreContactBand />
      </div>
    );
  }

  // Default / General
  return (
    <div className="flex flex-col">
      <StoreHero />
      <CategorySection />
      <StoreProductGrid />
      <StoreFeaturesSection />
      <AboutSection />
      <FaqSection />
      <StoreContactBand />
    </div>
  );
}

export default function StorePage() {
  return <CategoryStoreLayout />;
}
