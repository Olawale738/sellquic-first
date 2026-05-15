
'use client';
import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { useStore } from '@/context/store-context';
import { useFirestore } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export function StoreAnalytics() {
  const { store } = useStore();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const firestore = useFirestore();

  // Log visit to Firestore
  useEffect(() => {
    if (store && firestore) {
      // Simple debounce: check if we've logged a visit for this store in the last 30 minutes
      const lastVisit = localStorage.getItem(`last_visit_${store.id}`);
      if (lastVisit && (Date.now() - parseInt(lastVisit)) < 30 * 60 * 1000) {
        return; // Don't log again
      }
      
      const visitsRef = collection(firestore, 'stores', store.id, 'visits');
      addDoc(visitsRef, {
        timestamp: serverTimestamp(),
        pathname: pathname,
        userAgent: navigator.userAgent,
      }).then(() => {
          localStorage.setItem(`last_visit_${store.id}`, Date.now().toString());
      }).catch(err => console.error("Failed to log visit:", err));
    }
  }, [store, firestore, pathname]);

  // Helper to trigger pageview on route change (for SPAs)
  useEffect(() => {
    if (store?.analytics?.facebookPixelId && (window as any).fbq) {
      (window as any).fbq('track', 'PageView');
    }
    if (store?.analytics?.googleAnalyticsId && (window as any).gtag) {
      (window as any).gtag('config', store.analytics.googleAnalyticsId, {
        page_path: pathname,
      });
    }
  }, [pathname, searchParams, store]);

  if (!store || !store.analytics) return null;

  return (
    <>
      {/* FACEBOOK PIXEL */}
      {store.analytics.facebookPixelId && (
        <Script id="fb-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${store.analytics.facebookPixelId}');
            fbq('track', 'PageView');
          `}
        </Script>
      )}

      {/* GOOGLE ANALYTICS (GA4) */}
      {store.analytics.googleAnalyticsId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${store.analytics.googleAnalyticsId}`}
            strategy="afterInteractive"
          />
          <Script id="google-analytics" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${store.analytics.googleAnalyticsId}');
            `}
          </Script>
        </>
      )}
    </>
  );
}
