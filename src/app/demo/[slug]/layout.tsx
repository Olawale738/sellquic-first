
import { db } from "@/lib/firebase-admin";
import { notFound } from "next/navigation";
import { ReactNode } from "react";
import { StoreProvider } from '@/context/store-context';
import { sanitizeTimestamps } from "@/lib/serialize-firestore";
import { StoreSuspendedPage } from "@/components/store-suspended-page";
import { StoreHeader } from '@/components/store-header';
import { StoreFooter } from '@/components/store-footer';
import { hexToHsl } from "@/lib/colors";
import { cn } from "@/lib/utils";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { PromoBar } from "@/components/promo-bar";

export const dynamic = 'force-dynamic';

async function getDemoStoreData(slug: string) {
  try {
    const demoStoreRef = db.collection("demo_stores").doc(slug);
    const demoStoreDoc = await demoStoreRef.get();

    if (!demoStoreDoc.exists) {
      console.error(`No demo store found for slug: ${slug}`);
      return null;
    }

    const demoStoreData = demoStoreDoc.data() as any;

    if (demoStoreData.status !== 'published') {
      console.log(`Demo store '${slug}' is not published.`);
      return null;
    }

    const productsSnapshot = await demoStoreRef.collection('products').get();
    const products = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // For demos, categories and deliveries can be mocked or fetched if needed
    const categories: any[] = [];
    const deliveries: any[] = [];

    return sanitizeTimestamps({ ...demoStoreData, id: demoStoreDoc.id, products, categories, deliveries });

  } catch (error) {
    console.error("Error fetching demo store data:", error);
    return null;
  }
}

export default async function DemoStoreLayout({
  params,
  children,
}: {
  params: { slug: string };
  children: ReactNode;
}) {
  const storeData = await getDemoStoreData(params.slug);

  if (!storeData) {
    notFound();
  }

  const primaryColorHsl = storeData.brandColor ? hexToHsl(storeData.brandColor) : null;
  const style = primaryColorHsl ? { '--primary': primaryColorHsl } as React.CSSProperties : {};

  return (
    <StoreProvider store={storeData} isCustomDomain={false} isDemo={true}>
      <div className={cn("flex flex-col min-h-screen")} style={style}>
        <PromoBar />
        <StoreHeader />
        <main className="flex-1 bg-background">{children}</main>
        <StoreFooter />
        <WhatsAppButton />
      </div>
    </StoreProvider>
  );
}
