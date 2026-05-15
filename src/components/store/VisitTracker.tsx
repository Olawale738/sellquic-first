'use client';
import { useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

export function VisitTracker({ storeId }: { storeId: string }) {
  const firestore = useFirestore();

  useEffect(() => {
    if (!firestore || !storeId) return;

    // Check Session Storage to prevent duplicate counts on refresh
    const sessionKey = `visited_${storeId}`;
    if (sessionStorage.getItem(sessionKey)) return;

    const logVisit = async () => {
      try {
        // Log to Subcollection: stores/{storeId}/visits
        await addDoc(collection(firestore, 'stores', storeId, 'visits'), {
          timestamp: serverTimestamp(),
          userAgent: navigator.userAgent,
        });
        
        sessionStorage.setItem(sessionKey, 'true');
      } catch (err) {
        // Silent fail (don't annoy user)
        console.error("Tracking Error", err);
      }
    };

    logVisit();
  }, [firestore, storeId]);

  return null;
}
