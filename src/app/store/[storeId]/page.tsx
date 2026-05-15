
'use client';
import { StoreHero } from '@/components/store-hero';
import { StoreProductGrid } from '@/components/store-product-grid';
import { FaqSection } from '@/components/store/FaqSection';

export default function StorePage() {
    return (
        <div>
            <StoreHero />
            <StoreProductGrid />
            <FaqSection />
        </div>
    );
}
