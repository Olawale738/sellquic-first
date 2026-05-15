'use client';

import Script from 'next/script';
import { useCallback, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    _fbq?: any;
    __sellquicPixelIds?: Record<string, boolean>;
    __sellquicLastPageViewKey?: string;
  }
}

type Props = {
  pixelId?: string | null;
};

export default function FacebookPixel({ pixelId }: Props) {
  const cleanPixelId = pixelId?.trim();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const trackPageView = useCallback(() => {
    if (!cleanPixelId) return;
    if (typeof window === 'undefined') return;
    if (!window.fbq) return;

    window.__sellquicPixelIds = window.__sellquicPixelIds || {};

    if (!window.__sellquicPixelIds[cleanPixelId]) {
      window.fbq('init', cleanPixelId);
      window.__sellquicPixelIds[cleanPixelId] = true;
    }

    const pageKey = `${cleanPixelId}:${pathname}?${searchParams.toString()}`;

    if (window.__sellquicLastPageViewKey === pageKey) return;

    window.fbq('track', 'PageView');
    window.__sellquicLastPageViewKey = pageKey;
  }, [cleanPixelId, pathname, searchParams]);

  useEffect(() => {
    trackPageView();
  }, [trackPageView]);

  if (!cleanPixelId) return null;

  return (
    <Script
      id="sellquic-facebook-pixel-base"
      strategy="afterInteractive"
      onReady={trackPageView}
      dangerouslySetInnerHTML={{
        __html: `
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
        `,
      }}
    />
  );
}