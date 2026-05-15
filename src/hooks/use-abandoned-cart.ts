'use client';

import { useEffect, useRef } from 'react';
import { useFirestore } from '@/firebase';
import { doc, setDoc, deleteDoc, serverTimestamp, collection } from 'firebase/firestore';

interface CustomerInfo {
  name: string;
  phone: string;
  email?: string;
  address?: string;
}

export function useAbandonedCart(storeId: string | undefined, cartItems: any[], customerInfo: CustomerInfo) {
  const firestore = useFirestore();
  const checkoutIdRef = useRef<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Initialize or retrieve a Session ID for this checkout attempt
  useEffect(() => {
    if (!firestore) return;
    if (checkoutIdRef.current) return;

    let id = sessionStorage.getItem('sellquic_checkout_id');
    if (!id) {
        id = doc(collection(firestore, 'abandoned_checkouts')).id;
        sessionStorage.setItem('sellquic_checkout_id', id);
    }
    checkoutIdRef.current = id;
  }, [firestore]);

  // 2. The Silent Saver
  useEffect(() => {
    if (!storeId || !firestore || !checkoutIdRef.current || cartItems.length === 0) return;
    if (!customerInfo.phone && !customerInfo.email) return;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(async () => {
      try {
        await setDoc(doc(firestore, 'abandoned_checkouts', checkoutIdRef.current!), {
          id: checkoutIdRef.current,
          storeId,
          items: cartItems.map(item => ({
              id: item.id,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              image: item.images?.[0] || null,
              selectedVariant: item.selectedVariant ? {
                  id: item.selectedVariant.id,
                  name: item.selectedVariant.name,
                  price: item.selectedVariant.price,
              } : null
          })),
          customerInfo,
          totalAmount: cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
          lastUpdated: serverTimestamp(),
          recovered: false,
        }, { merge: true });
        
        console.log("🛒 Cart snapshot saved silently.");
      } catch (err) {
        console.error("Failed to capture cart:", err);
      }
    }, 2000);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [cartItems, customerInfo, storeId, firestore]);

  // 3. Cleanup Function
  const clearAbandonedCart = async () => {
    if (!checkoutIdRef.current || !firestore) return;
    try {
        await deleteDoc(doc(firestore, 'abandoned_checkouts', checkoutIdRef.current));
        sessionStorage.removeItem('sellquic_checkout_id');
        checkoutIdRef.current = null; // Clear the ref
    } catch (e) {
        console.error("Cleanup error", e);
    }
  };

  return { clearAbandonedCart };
}
