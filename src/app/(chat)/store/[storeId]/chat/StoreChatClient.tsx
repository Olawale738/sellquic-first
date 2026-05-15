'use client';

import { StoreProvider } from '@/context/store-context';
import { StoreAIWidget } from '@/components/store/StoreAIWidget';
import { resolveTheme } from '@/themes';
import { hexToHsl } from '@/lib/colors';
import { cn } from '@/lib/utils';
import { useParams } from 'next/navigation';

export default function StoreChatClient({ store }: { store: any }) {
  const params = useParams();
  const storeId = params.storeId as string;
  const isCustomDomain = storeId.includes('.');
  
  const activeTheme = resolveTheme(store.theme);

  const themeColors = { ...activeTheme.colors };
  if (store.brandColor) {
    const hsl = hexToHsl(store.brandColor);
    if (hsl) themeColors['--primary'] = hsl;
  }
  
  const styleVariables = Object.fromEntries(
      Object.entries(themeColors).map(([key, value]) => [key, `hsl(${value})`])
  ) as React.CSSProperties;

  return (
    <StoreProvider store={store} isCustomDomain={isCustomDomain} activeTheme={activeTheme}>
      <div
        className={cn('w-full h-[100dvh] overflow-hidden', activeTheme.font.className)}
        style={styleVariables}
        data-theme={activeTheme.id}
      >
        <StoreAIWidget fullscreen />
      </div>
    </StoreProvider>
  );
}