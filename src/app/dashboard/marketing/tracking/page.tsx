
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { hasCommerceAccess } from '@/lib/subscription-access';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Loader2, LineChart, AlertCircle, Star } from 'lucide-react';
import Link from 'next/link';

interface AnalyticsSettings {
  facebookPixelId: string;
  facebookAccessToken: string;
  facebookTestEventCode: string;
  googleAnalyticsId: string;
}

interface SeoSettings {
  title: string;
  description: string;
}

interface MarketingSettings {
  analytics: AnalyticsSettings;
  seo: SeoSettings;
}

const defaultMarketingSettings: MarketingSettings = {
    analytics: {
        facebookPixelId: '',
        facebookAccessToken: '',
        facebookTestEventCode: '',
        googleAnalyticsId: ''
    },
    seo: {
        title: '',
        description: ''
    }
}


export default function TrackingPage() {
  const { user, activeStore, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const firestore = useFirestore();

  const [settings, setSettings] = useState<MarketingSettings>(defaultMarketingSettings);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const isFreePlan = !hasCommerceAccess(user?.subscription);

  useEffect(() => {
    if (!activeStore || !firestore) return;
    
    const fetchSettings = async () => {
        setIsLoading(true);
        try {
            const storeRef = doc(firestore, 'stores', activeStore.id);
            const snap = await getDoc(storeRef);
            if (snap.exists()) {
                const data = snap.data();
                if (data.marketing) {
                    setSettings({
                        analytics: { ...defaultMarketingSettings.analytics, ...data.marketing.analytics },
                        seo: { ...defaultMarketingSettings.seo, ...data.marketing.seo }
                    });
                }
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    if (!authLoading) fetchSettings();
  }, [activeStore, firestore, authLoading]);

  const handleAnalyticsChange = (field: keyof AnalyticsSettings, value: string) => {
      setSettings(s => ({
          ...s,
          analytics: { ...s.analytics, [field]: value }
      }));
  }
  
  const handleSeoChange = (field: keyof SeoSettings, value: string) => {
      setSettings(s => ({
          ...s,
          seo: { ...s.seo, [field]: value }
      }));
  }

  const handleSave = async () => {
    if (!activeStore || !firestore) return;

    const pixelId = settings.analytics?.facebookPixelId?.trim() || '';
    if (pixelId && !/^\d{8,20}$/.test(pixelId)) {
        toast({
            title: 'Invalid Pixel ID',
            description: 'Facebook Pixel ID should be numeric.',
            variant: 'destructive',
        });
        return;
    }

    setIsSaving(true);
    try {
        const storeRef = doc(firestore, 'stores', activeStore.id);
        await updateDoc(storeRef, {
            'marketing.analytics': settings.analytics,
            'marketing.seo': settings.seo,
        });
        toast({ title: "Tracking & SEO Settings Saved!" });
    } catch (error) {
        toast({ title: "Error", description: "Could not save settings.", variant: "destructive" });
        console.error(error);
    } finally {
        setIsSaving(false);
    }
  };

  if (authLoading || isLoading) {
      return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin"/></div>;
  }

  if (!activeStore) return <div className="p-8">Please select a store.</div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4 md:p-0">
        <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Tracking &amp; SEO</h1>
             {!isFreePlan && (
                <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                </Button>
            )}
        </div>

        <div className="animated-border-card">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <LineChart className="h-5 w-5 text-purple-500" />
                            <CardTitle>Tracking & Analytics</CardTitle>
                        </div>
                        {isFreePlan && (
                             <Button asChild size="sm" className="h-auto px-2 py-1 text-xs">
                                <Link href="/dashboard/subscription">
                                    <Star className="h-3 w-3 mr-1" /> Upgrade
                                </Link>
                            </Button>
                        )}
                    </div>
                    <CardDescription>Connect ads and analyze your store's traffic.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <fieldset disabled={isFreePlan}>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Facebook Pixel ID</Label>
                                <Input 
                                    placeholder="e.g. 123456789012345"
                                    value={settings.analytics?.facebookPixelId || ''}
                                    onChange={(e) => handleAnalyticsChange('facebookPixelId', e.target.value)}
                                />
                            </div>
                           
                             
                            <div className="space-y-2">
                                <Label>Google Analytics ID</Label>
                                <Input 
                                    placeholder="e.g. G-ABC123456"
                                    value={settings.analytics?.googleAnalyticsId || ''}
                                    onChange={(e) => handleAnalyticsChange('googleAnalyticsId', e.target.value)}
                                />
                            </div>
                        </div>
                        {isFreePlan && <p className="text-xs text-muted-foreground mt-2">Upgrade to Premium to enable tracking.</p>}
                    </fieldset>
                    
                    <div className="border-t pt-6 space-y-4">
                         <h3 className="text-lg font-semibold">Search Engine Optimization (SEO)</h3>
                         <div className="space-y-2">
                            <Label>SEO Title</Label>
                            <Input 
                                placeholder="e.g. Best Sneakers in Accra - MyStore"
                                value={settings.seo?.title || ''}
                                onChange={(e) => handleSeoChange('title', e.target.value)}
                                maxLength={60}
                            />
                             <p className="text-xs text-muted-foreground">Appears in Google search results (Max 60 chars).</p>
                        </div>
                        <div className="space-y-2">
                            <Label>SEO Description</Label>
                            <Input 
                                placeholder="e.g. We sell high-quality shoes at affordable prices."
                                value={settings.seo?.description || ''}
                                onChange={(e) => handleSeoChange('description', e.target.value)}
                                maxLength={160}
                            />
                            <p className="text-xs text-muted-foreground">A short summary of your store (Max 160 chars).</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
