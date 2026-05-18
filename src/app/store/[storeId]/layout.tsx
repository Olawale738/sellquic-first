
// This file is now a Server Component
import { db } from "@/lib/firebase-admin";
import { notFound } from "next/navigation";
import { ReactNode } from "react";
import { hasCommerceAccess, getProductLimitForSubscription } from '@/lib/subscription-access';
import { StoreProvider } from '@/context/store-context';
import { sanitizeTimestamps } from "@/lib/serialize-firestore";
import { StoreSuspendedPage } from "@/components/store-suspended-page";
import { hexToHsl } from "@/lib/colors";
import { cn } from "@/lib/utils";
import { Product } from "@/types/product";
import { Metadata, ResolvingMetadata } from 'next';
import { VisitTracker } from '@/components/store/VisitTracker';
import { resolveTheme, resolveThemeByCategory } from '@/themes';
import { StoreHeader } from '@/components/store-header';
import { StoreFooter } from '@/components/store-footer';
import { PromoBar } from '@/components/promo-bar';
import { FlashSaleTimer } from "@/components/store/FlashSaleTimer";
import CartTimer from "@/components/store/CartTimer";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { StoreAIWidget } from "@/components/store/StoreAIWidget";
import { Timestamp } from 'firebase-admin/firestore';
import { ComingSoon } from "@/components/store/coming-soon";
import FacebookPixel from '@/components/FacebookPixel';
export const dynamic = 'force-dynamic';


interface StoreData {
  id: string;
  isSuspended?: boolean;
  sellerPhone?: string | null;
  sellerEmail?: string | null;
  brandColor?: string;
  products: any[];
  categories: any[];
  deliveries: any[];
  [key: string]: any; 
}

async function getStoreData(identifier: string): Promise<StoreData | null> {
  try {
    const normalized = identifier.toLowerCase().trim();
    const storesRef = db.collection("stores");
    let storeQuery;

    if (normalized.includes('.')) {
        console.log(`[Store Layout] Querying custom domain: ${normalized}`);
        storeQuery = storesRef.where("customDomain", "==", normalized).limit(1);
    } else {
        console.log(`[Store Layout] Querying subdomain: ${normalized}`);
        storeQuery = storesRef.where("subdomain", "==", normalized).limit(1);
    }

    const storeSnapshot = await storeQuery.get();
    console.log('🟣 CHAT DEBUG — STORES FOUND:', storeSnapshot.size);

    if (storeSnapshot.empty) {
      console.log('🔴 CHAT DEBUG — STORE NOT FOUND, IDENTIFIER:', normalized);
      console.error(`No store found for identifier: ${normalized}`);
      return null;
    }

    const storeDoc = storeSnapshot.docs[0];
    let storeData = storeDoc.data() as StoreData;
    const sellerRef = db.collection('users').doc(storeData.sellerId);
    const sellerSnap = await sellerRef.get();
    const sellerData = sellerSnap.data();

    
   // --- SUSPENSION LOGIC ---
let isSuspended = false;

// Manual suspension by admin
if (sellerSnap.exists && sellerData?.status === 'suspended') {
  isSuspended = true;
}

// Subscription gate — only suspends explicitly expired subscriptions.
// pending_plan and no_subscription are treated as active (new/pre-trial users).
// Does NOT suspend:
//   • active paid (endDate in future)
//   • active trial (trialEndsAt in future)
//   • legacy free (planId === 'free')
//   • pending_plan (new users who haven't started trial yet)
//   • no_subscription (very old accounts with no sub record)
// DOES suspend:
//   • expired_trial (trial ended, user must pick a plan)
//   • expired_paid (paid plan lapsed, user must renew)
//   • inactive (manually deactivated)
if (sellerSnap.exists && sellerData?.subscription !== undefined) {
  const subStatus = sellerData.subscription?.status;
  if (
    subStatus === 'expired_trial' ||
    subStatus === 'expired_paid' ||
    subStatus === 'inactive'
  ) {
    isSuspended = true;
  }
}
// --- END SUSPENSION LOGIC ---
    
    storeData.isSuspended = isSuspended;
    storeData.sellerPhone = sellerData?.phone || null;
    storeData.sellerEmail = sellerData?.email || null;

    const categoriesRef = storeDoc.ref.collection('categories');
    const deliveriesRef = storeDoc.ref.collection('deliveries');

    const [categoriesSnapshot, deliveriesSnapshot] = await Promise.all([
      categoriesRef.get(),
      deliveriesRef.get(),
    ]);

    const categories = categoriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const deliveries = deliveriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const productsRef = db.collection("products");
    const q = productsRef.where('storeId', '==', storeDoc.id);
    const productsSnapshot = await q.get();
    
    // Per-plan storefront cap. null = unlimited (Standard / Growth / active trial).
// Legacy free → 5, Starter → 10. Trial-expired/pending/paid-expired never reach
// here because the store is already suspended above.
const productLimit = getProductLimitForSubscription(sellerData?.subscription);

let products = productsSnapshot.docs
  .map(doc => ({ id: doc.id, ...doc.data() } as Product))
  .filter(product => product.isArchived !== true);

if (productLimit !== null && products.length > productLimit) {
  products = products.slice(0, productLimit);
}

    const publicStoreData: StoreData = {
      ...storeData,
      id: storeDoc.id,
      products,
      categories,
      deliveries,
    };
    
    if (publicStoreData.marketing?.analytics?.facebookAccessToken) {
      publicStoreData.marketing.analytics.facebookAccessToken = null;
    }
    
    return sanitizeTimestamps(publicStoreData);

  } catch (error) {
    console.error("Error fetching store data:", error);
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: { storeId: string } },
  parent: ResolvingMetadata
): Promise<Metadata> {
  const storeData = await getStoreData(params.storeId);

  if (!storeData) {
    return {
      title: 'Store Not Found - SellQuic',
    };
  }
  
  const seoTitle = storeData.marketing?.seo?.title || storeData.storefrontConfig?.seo?.page_title || storeData.name;
  const seoDescription = storeData.marketing?.seo?.description || storeData.storefrontConfig?.seo?.meta_description || storeData.tagline || `Shop at ${storeData.name}`;


  const previousImages = (await parent).openGraph?.images || [];
  const storeImages = storeData.logoUrl 
    ? [storeData.logoUrl, ...previousImages] 
    : previousImages;

  return {
    title: seoTitle,
    description: seoDescription,
    
    openGraph: {
      title: seoTitle,
      description: seoDescription,
      url: `https://${storeData.customDomain || `${storeData.subdomain}.sellquic.com`}`,
      siteName: 'SellQuic',
      images: storeImages,
      type: 'website',
    },

    twitter: {
      card: 'summary_large_image',
      title: seoTitle,
      description: seoDescription,
      images: storeImages,
    },
    
    icons: {
      icon: storeData.logoUrl || '/favicon.ico',
      apple: storeData.logoUrl || '/apple-touch-icon.png',
    },
  };
}

export default async function StoreLayout({
  params,
  children,
}: {
  params: { storeId: string };
  children: ReactNode;
}) {
  const storeData = await getStoreData(params.storeId);

  if (!storeData) notFound();
  if (storeData.isSuspended) return <StoreSuspendedPage />;
  if (storeData.comingSoon) return <ComingSoon store={storeData} />; // 👈 Added Coming Soon!

  const isCustomDomain = params.storeId.includes('.');
  // Use explicit theme → AI-generated category theme → classic
  const activeTheme = storeData.theme
    ? resolveTheme(storeData.theme)
    : resolveThemeByCategory(storeData.storefrontConfig?.theme_category || storeData.category);
  
  const themeColors = { ...activeTheme.colors };
  if (storeData.brandColor) {
    const hsl = hexToHsl(storeData.brandColor);
    if (hsl) themeColors['--primary'] = hsl;
  }
  
  const styleVariables = Object.fromEntries(
      Object.entries(themeColors).map(([key, value]) => [key, `hsl(${value})`])
  ) as React.CSSProperties;

  return (
    <StoreProvider
      store={storeData}
      isCustomDomain={isCustomDomain}
      activeTheme={activeTheme}
    >
      <FacebookPixel pixelId={storeData.marketing?.analytics?.facebookPixelId || null} />
      <div
        className={cn('flex flex-col min-h-screen font-body', activeTheme.font.className)}
        style={styleVariables}
      >
        <div data-theme={activeTheme.id} className="flex flex-col min-h-screen">
          <VisitTracker storeId={storeData.id} />
          <PromoBar />
          <FlashSaleTimer />
          <CartTimer settings={storeData.marketingSettings?.cartTimer} />
          
          <StoreHeader />
          <main className="flex-1 bg-background">{children}</main>
          <StoreFooter />
          
          <WhatsAppButton />
          <StoreAIWidget />
        </div>
      </div>
    </StoreProvider>
  );
}
