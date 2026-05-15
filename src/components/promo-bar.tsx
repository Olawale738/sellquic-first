
'use client';
import { useStore } from '@/context/store-context';
import { cn } from '@/lib/utils';

export function PromoBar() {
    const { store } = useStore();
    const themeConfig = store?.themeConfig || {};

    const isPromoBarActive = themeConfig.isPromoBarActive ?? store?.isPromoBarActive;
    const promoText = themeConfig.promoText || store?.promoText;

    if (!isPromoBarActive || !promoText) {
        return null;
    }

    const needsScrolling = promoText.length > 50;

    const style = {
        backgroundColor: themeConfig.promoBackgroundColor || store?.brandColor || 'hsl(var(--primary))',
        color: themeConfig.promoTextColor || 'hsl(var(--primary-foreground))',
    };

    return (
        <div 
          style={style}
          className="text-center p-2 text-sm font-medium overflow-hidden whitespace-nowrap"
        >
            {needsScrolling ? (
                <span className="inline-block animate-marquee-infinite">
                    {promoText}
                </span>
            ) : (
                <span>{promoText}</span>
            )}
        </div>
    );
}
