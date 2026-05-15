'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import InstagramImporter from '@/components/dashboard/InstagramImporter';
import { useAuth, useRequireAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Instagram, Loader2, ArrowLeft, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  hasCommerceAccess,
  getCommerceAccessMessage,
  canCreateProduct,
} from '@/lib/subscription-access';

export default function InstagramImportPage() {
  useRequireAuth();
  const { user, activeStore, loading } = useAuth();
  const router = useRouter();
  const firestore = useFirestore();

  const [activeProductCount, setActiveProductCount] = useState(0);

  // Count active (non-archived) products to enforce per-plan caps
  useEffect(() => {
    if (!firestore || !activeStore?.id) return;
    const q = query(
      collection(firestore, 'products'),
      where('storeId', '==', activeStore.id)
    );
    return onSnapshot(q, snap => {
      setActiveProductCount(
        snap.docs.filter(d => d.data().isArchived !== true).length
      );
    });
  }, [firestore, activeStore?.id]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!activeStore) {
    return <div className="p-8 text-center">Please select a store to continue.</div>;
  }

  // After this point, activeStore is non-null
  const subscription = user?.subscription;
  const canManage = hasCommerceAccess(subscription);
  const access = canCreateProduct({ subscription, activeProductCount });
  const isInstagramConnected = activeStore.instagram?.connected === true;

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-6">
      {/* Back Button */}
      <Button variant="ghost" asChild className="mb-2">
        <Link href="/dashboard/products" className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Products
        </Link>
      </Button>

      {!canManage ? (
        // ── GATE 1: NO COMMERCE ACCESS ──
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center bg-white rounded-3xl border shadow-sm">
          <div className="p-4 bg-amber-100 rounded-2xl mb-6">
            <AlertCircle className="h-12 w-12 text-amber-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Choose a plan to import</h2>
          <p className="text-gray-500 max-w-sm mt-2 mb-8">
            {getCommerceAccessMessage(subscription)}
          </p>
          <Button
            size="lg"
            onClick={() => router.push('/dashboard/subscription')}
            className="px-8 font-bold rounded-xl h-14 text-lg"
          >
            View Plans
          </Button>
        </div>
      ) : !access.allowed ? (
        // ── GATE 2: PRODUCT LIMIT REACHED ──
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center bg-white rounded-3xl border shadow-sm">
          <div className="p-4 bg-amber-100 rounded-2xl mb-6">
            <AlertCircle className="h-12 w-12 text-amber-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Product limit reached</h2>
          <p className="text-gray-500 max-w-sm mt-2 mb-8">
            {'reason' in access ? access.reason : ''}
          </p>
          <Button
            size="lg"
            onClick={() => router.push('/dashboard/subscription')}
            className="px-8 font-bold rounded-xl h-14 text-lg"
          >
            Upgrade Plan
          </Button>
        </div>
      ) : !isInstagramConnected ? (
        // ── GATE 3: IG NOT CONNECTED ──
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center bg-white rounded-3xl border shadow-sm">
          <div className="p-4 bg-gradient-to-tr from-purple-500 to-pink-500 rounded-2xl mb-6 shadow-lg shadow-pink-200">
            <Instagram className="h-12 w-12 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Connect Instagram First</h2>
          <p className="text-gray-500 max-w-sm mt-2 mb-8">
            To import your photos and turn them into products, you first need to link your Instagram Business account to your AI Assistant.
          </p>
          <Button
            size="lg"
            onClick={() => router.push('/dashboard/ai-assistant')}
            className="bg-blue-600 hover:bg-blue-700 px-8 font-bold rounded-xl h-14 text-lg transition-all"
          >
            Go to AI Assistant Settings
          </Button>
          <p className="text-[11px] text-gray-400 mt-6 uppercase tracking-widest font-medium">
            Step 1 of 2
          </p>
        </div>
      ) : (
        // ── ALL GATES PASSED → IMPORTER ──
        <InstagramImporter
          storeId={activeStore.id || ''}
          sellerId={activeStore.sellerId || ''}
        />
      )}
    </div>
  );
}