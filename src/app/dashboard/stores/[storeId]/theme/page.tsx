'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { themes, CATEGORY_ALL_THEMES } from '@/themes';
import type { ThemeConfig } from '@/themes';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

const CATEGORY_LABELS: Record<string, string> = {
  fashion: 'Fashion',
  food: 'Food',
  beauty: 'Beauty',
  electronics: 'Electronics',
  furniture: 'Furniture',
  groceries: 'Groceries',
  services: 'Services',
  general: 'General',
};

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS);

const themeList: ThemeConfig[] = Object.values(themes);

export default function ThemePickerPage({ params }: { params: { storeId: string } }) {
  const { activeStore } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const storeId = params.storeId || activeStore?.id;

  const [currentTheme, setCurrentTheme] = useState<string>('retail-classic');
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  useEffect(() => {
    if (!storeId || !firestore) return;
    getDoc(doc(firestore, 'stores', storeId))
      .then((snap) => {
        if (snap.exists()) {
          setCurrentTheme(snap.data()?.theme || 'retail-classic');
        }
      })
      .finally(() => setLoading(false));
  }, [storeId, firestore]);

  async function handleApply(themeId: string) {
    if (!storeId || !firestore) return;
    setApplying(themeId);
    try {
      await updateDoc(doc(firestore, 'stores', storeId), { theme: themeId });
      setCurrentTheme(themeId);
      toast({ title: 'Theme applied!', description: `Your store is now using the "${themes[themeId]?.name}" theme.` });
    } catch {
      toast({ title: 'Failed to apply theme', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setApplying(null);
    }
  }

  const filteredThemes =
    activeCategory === 'all'
      ? themeList
      : (CATEGORY_ALL_THEMES[activeCategory] || [])
          .map((id) => themes[id])
          .filter(Boolean) as ThemeConfig[];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Choose Your Store Theme</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Pick a look that matches your brand. Changes take effect immediately on your storefront.
        </p>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={activeCategory === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveCategory('all')}
        >
          All
        </Button>
        {ALL_CATEGORIES.map((cat) => (
          <Button
            key={cat}
            variant={activeCategory === cat ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveCategory(cat)}
          >
            {CATEGORY_LABELS[cat]}
          </Button>
        ))}
      </div>

      {/* Theme Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {filteredThemes.map((theme) => {
          const isSelected = currentTheme === theme.id;
          const isApplying = applying === theme.id;

          return (
            <Card
              key={theme.id}
              className={cn(
                'overflow-hidden transition-all border-2',
                isSelected ? 'border-primary shadow-md' : 'border-transparent hover:border-muted-foreground/30',
              )}
            >
              {/* Photo preview */}
              <div className="relative h-36 w-full overflow-hidden">
                <Image
                  src={theme.previewImage}
                  alt={theme.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, 320px"
                  unoptimized
                />
                {/* Dark scrim on bottom third */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                {/* Color swatches bottom-left */}
                <div className="absolute bottom-2.5 left-3 flex gap-1.5">
                  {Object.entries({
                    primary: theme.colors['--primary'],
                    bg: theme.colors['--background'],
                    accent: theme.colors['--accent'],
                  }).map(([k, hsl]) => (
                    <span
                      key={k}
                      className="h-4 w-4 rounded-full border border-white/40 shadow"
                      style={{ background: `hsl(${hsl})` }}
                      title={k}
                    />
                  ))}
                </div>
                {/* Active checkmark */}
                {isSelected && (
                  <div className="absolute top-2 right-2 h-7 w-7 rounded-full bg-white flex items-center justify-center shadow">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  </div>
                )}
              </div>

              <CardContent className="p-4 space-y-3">
                {/* Name + Category */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm leading-tight">{theme.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{theme.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="text-xs capitalize">
                    {CATEGORY_LABELS[theme.category] || theme.category}
                  </Badge>
                  {theme.isPremium && (
                    <Badge className="text-xs bg-amber-500 text-white hover:bg-amber-500">
                      Premium
                    </Badge>
                  )}
                </div>

                {/* Apply Button */}
                <Button
                  size="sm"
                  className="w-full"
                  variant={isSelected ? 'default' : 'outline'}
                  disabled={isSelected || isApplying}
                  onClick={() => handleApply(theme.id)}
                >
                  {isApplying ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Applying…
                    </>
                  ) : isSelected ? (
                    'Applied'
                  ) : (
                    'Apply'
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
