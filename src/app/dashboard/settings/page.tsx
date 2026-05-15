'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UploadCloud, Instagram, Facebook, Loader2, Copy, Eye, PlusCircle, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useFirestore } from '@/firebase';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import Link from 'next/link';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { getAuth } from 'firebase/auth';

import { doc, updateDoc, getDoc, DocumentData, serverTimestamp } from 'firebase/firestore';


const TikTokIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.04-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
);

interface StoreSettings {
  logoUrl?: string | null;
  tagline?: string;
  brandColor?: string;
  facebook?: string;
  instagram?: string;
  tiktok?: string;
  isAboutUsActive?: boolean;
  aboutUs?: string;
  isPromoBarActive?: boolean;
  promoText?: string;
  isHeroBannerActive?: boolean;
  heroHeadline?: string;
  heroCtaText?: string;
  heroImageUrl?: string | null;
  paymentInfo?: any;
  aiAssistant?: any;
  customDomain?: string;
  isMoqEnabled?: boolean;
  comingSoon?: boolean;
  comingSoonTitle?: string;
  comingSoonMessage?: string;
  comingSoonImageUrl?: string | null;
  subdomain?: string; 
}

type Dirty = Partial<Record<keyof StoreSettings, true>>;

// Helper to recursively remove undefined properties from an object
function removeUndefined(obj: any): any {
  if (obj === undefined) return undefined;
  if (obj === null) return null;
  if (Array.isArray(obj)) return obj.map(removeUndefined).filter(v => v !== undefined);
  if (typeof obj !== 'object') return obj;

  const out: any = {};
  for (const [k, v] of Object.entries(obj)) {
    const cleaned = removeUndefined(v);
    if (cleaned !== undefined) out[k] = cleaned;
  }
  return out;
}


export default function SettingsPage() {
  const { user, activeStore, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const firestore = useFirestore();

  const [settings, setSettings] = useState<StoreSettings>({
    brandColor: '#e11d48',
    facebook: '',
    instagram: '',
    tiktok: '',
    tagline: '',
    isAboutUsActive: false,
    aboutUs: '',
    isPromoBarActive: false,
    promoText: '',
    isHeroBannerActive: false,
    heroHeadline: '',
    heroCtaText: '',
    customDomain: '',
    aiAssistant: {
        enabled: false,
        greetingMessage: '',
        customInstructions: '',
        tone: 'friendly'
    }
  });
  
  const [storeUrl, setStoreUrl] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [heroImageFile, setHeroImageFile] = useState<File | null>(null);
  const [heroImagePreview, setHeroImagePreview] = useState<string | null>(null);
  const [comingSoonImageFile, setComingSoonImageFile] = useState<File | null>(null);
  const [comingSoonImagePreview, setComingSoonImagePreview] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [dirty, setDirty] = useState<Dirty>({});

  useEffect(() => {
    if (activeStore?.customDomain) {
      setStoreUrl(`https://${activeStore.customDomain}`);
    } else if (activeStore?.subdomain) {
      const rootDomain = 'sellquic.com';
      const protocol = 'https:';
      setStoreUrl(`${protocol}//${activeStore.subdomain}.${rootDomain}`);
    }
  }, [activeStore]);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!user || !activeStore || !firestore) {
          setIsLoading(false);
          return;
      };
      setIsLoading(true);
      const storeDocRef = doc(firestore, 'stores', activeStore.id);
      const docSnap = await getDoc(storeDocRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSettings({
          logoUrl: data.logoUrl || null,
          tagline: data.tagline || '',
          brandColor: data.brandColor || '#e11d48',
          facebook: data.facebook || '',
          instagram: data.instagram || '',
          tiktok: data.tiktok || '',
          isAboutUsActive: data.isAboutUsActive || false,
          aboutUs: data.aboutUs || '',
          isPromoBarActive: data.isPromoBarActive || false,
          promoText: data.promoText || '',
          isHeroBannerActive: data.isHeroBannerActive || false,
          heroHeadline: data.heroHeadline || '',
          heroCtaText: data.heroCtaText || '',
          heroImageUrl: data.heroImageUrl || null,
          paymentInfo: data.paymentInfo || null,
          aiAssistant: data.aiAssistant || {
            enabled: false,
            greetingMessage: '',
            customInstructions: '',
            tone: 'friendly'
          },
          customDomain: data.customDomain || '',
          isMoqEnabled: data.isMoqEnabled || false,
          comingSoon: data.comingSoon || false,
          comingSoonTitle: data.comingSoonTitle || '',
          comingSoonMessage: data.comingSoonMessage || '',
          comingSoonImageUrl: data.comingSoonImageUrl || null,
          subdomain: data.subdomain || '',
        });
        if (data.logoUrl) setLogoPreview(data.logoUrl);
        if (data.heroImageUrl) setHeroImagePreview(data.heroImageUrl);
      }
      setIsLoading(false);
    };

    if (!authLoading) {
      fetchSettings();
    }
  }, [user, activeStore, authLoading, firestore]);

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<File | null>>,
    previewSetter: React.Dispatch<React.SetStateAction<string | null>>,
    dirtyField: keyof StoreSettings,
    limitMB: number = 2
  ) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const imageSizeLimit = limitMB * 1024 * 1024;
      if (file.size > imageSizeLimit) {
        toast({
            title: 'Oops! That image is a bit too large.',
            description: `Please choose a file under ${limitMB}MB to ensure a speedy upload.`,
            variant: 'destructive'
        });
        return;
      }
      setter(file);
      previewSetter(URL.createObjectURL(file));
      setDirty(prev => ({...prev, [dirtyField]: true}));
    }
  };

  const uploadImage = async (file: File, path: string): Promise<string> => {
    const storage = getStorage();
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  };

  const handleSaveChanges = async () => {
    if (!user || !activeStore || !firestore) return;

    setIsSaving(true);
    try {
        const settingsToSave: any = { ...settings };
        
        if (logoFile) {
            settingsToSave.logoUrl = await uploadImage(logoFile, `stores/${activeStore.id}/logo.jpg`);
        }

        if (heroImageFile) {
            settingsToSave.heroImageUrl = await uploadImage(heroImageFile, `stores/${activeStore.id}/hero.jpg`);
        }
        if (comingSoonImageFile) {
            settingsToSave.comingSoonImageUrl = await uploadImage(comingSoonImageFile, `stores/${activeStore.id}/coming_soon.jpg`);
        }

        

        settingsToSave.updatedAt = serverTimestamp();
        await updateDoc(doc(firestore, 'stores', activeStore.id), settingsToSave as DocumentData);

        const auth = getAuth();
        const token = await auth.currentUser?.getIdToken();
        await fetch('/api/cache/clear', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ storeId: activeStore.id })
        });

        toast({ title: "Settings Saved!", description: "Updated successfully." });
    } catch (err: any) {
        toast({ title: "Save Failed", description: err.message, variant: "destructive" });
    } finally {
        setIsSaving(false);
    }
  };


  const handleSettingChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setSettings(prev => ({ ...prev, [id]: value }));
    setDirty(prev => ({ ...prev, [id as keyof StoreSettings]: true }));
  };
  
  const handleSwitchChange = (id: keyof StoreSettings) => (checked: boolean) => {
    setSettings(prev => ({...prev, [id]: checked}));
    setDirty(prev => ({ ...prev, [id as keyof StoreSettings]: true }));
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(storeUrl).then(() => {
        toast({
            title: 'Link Copied!',
            description: 'Your store link has been copied to your clipboard.',
        });
    });
  };

  if (isLoading || authLoading) {
    return (
        <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
    );
  }

  if (!activeStore) {
      return (
        <div className="text-center py-10">
            <p className="text-muted-foreground">Please create or select a store to manage settings.</p>
            <Button asChild className="mt-4">
                <Link href="/dashboard/stores">
                    Manage Stores
                </Link>
            </Button>
        </div>
      );
  }

  return (
    <div className="space-y-6">
        {storeUrl && (
            <Card>
                <CardHeader>
                    <CardTitle>Your Store Link</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex w-full flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <Input type="text" value={storeUrl} readOnly className="flex-grow"/>
                        <div className="flex items-center gap-2">
                            <Button type="button" size="icon" onClick={handleCopyLink} className="h-10 w-10">
                                <Copy className="h-4 w-4" />
                            </Button>
                            <Button asChild variant="outline" className="w-full sm:w-auto h-10">
                                <Link href={storeUrl} target="_blank" className="gap-2">
                                    <Eye className="h-4 w-4" />
                                    Preview
                                </Link>
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        )}
        <fieldset disabled={isSaving}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <div className="lg:col-span-1 space-y-6">
                     <Card>
                        <CardHeader><CardTitle>Branding</CardTitle></CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <Label>Store Logo</Label>
                                <div className="flex items-center gap-4">
                                <div className="h-16 w-16 rounded-full border bg-muted flex items-center justify-center overflow-hidden">
                                    {logoPreview ? (
                                    <Image src={logoPreview} alt="Logo preview" width={64} height={64} className="object-cover" />
                                    ) : (
                                    <UploadCloud className="h-8 w-8 text-gray-400" />
                                    )}
                                </div>
                                <Label htmlFor="logo-upload" className="cursor-pointer">
                                    <Button asChild variant="outline">
                                        <span>{logoFile ? 'Change' : 'Upload'}</span>
                                    </Button>
                                    <Input id="logo-upload" type="file" className="sr-only" accept="image/*" onChange={(e) => handleFileChange(e, setLogoFile, setLogoPreview, 'logoUrl', 2)} />
                                </Label>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="brandColor">Brand Color</Label>
                                <div className="relative">
                                    <Input 
                                        id="brandColor" 
                                        type="text"
                                        value={settings.brandColor}
                                        onChange={handleSettingChange}
                                        className="pr-12"
                                    />
                                    <Input 
                                        type="color" 
                                        value={settings.brandColor}
                                        onChange={(e) => setSettings(prev => ({...prev, brandColor: e.target.value}))}
                                        className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 p-1 bg-transparent border-none cursor-pointer"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>Social Media</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="relative">
                                <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                <Input id="instagram" placeholder="instagram-username" className="pl-10" value={settings.instagram} onChange={handleSettingChange}/>
                            </div>
                            <div className="relative">
                                <Facebook className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                <Input id="facebook" placeholder="https://facebook.com/your-page" className="pl-10" value={settings.facebook} onChange={handleSettingChange}/>
                            </div>
                            <div className="relative">
                                <TikTokIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                <Input id="tiktok" placeholder="tiktok-username" className="pl-10" value={settings.tiktok} onChange={handleSettingChange}/>
                            </div>
                        </CardContent>
                    </Card>
                </div>
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader><CardTitle>Content</CardTitle></CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="tagline">Store Tagline</Label>
                                <Input
                                    id="tagline" 
                                    placeholder="e.g., The best kicks in town." 
                                    value={settings.tagline} 
                                    onChange={handleSettingChange}
                                />
                            </div>

                            {/* --- HERO BANNER SECTION --- */}
<div className="border-t border-muted pt-4 mt-4">
    <Collapsible open={settings.isHeroBannerActive} onOpenChange={handleSwitchChange('isHeroBannerActive')}>
        <div className="flex items-center space-x-2 mb-4">
            <Switch 
                id="hero-banner-active" 
                checked={settings.isHeroBannerActive} 
                onCheckedChange={handleSwitchChange('isHeroBannerActive')} 
            />
            <div>
                <Label htmlFor="hero-banner-active" className="cursor-pointer text-base">Enable Hero Banner</Label>
                <p className="text-xs text-muted-foreground">Show a large image with a headline at the top of your store.</p>
            </div>
        </div>
        <CollapsibleContent className="space-y-6 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="heroHeadline">Banner Headline</Label>
                    <Input 
                        id="heroHeadline" 
                        placeholder="e.g., Summer Collection 2024" 
                        value={settings.heroHeadline || ''} 
                        onChange={handleSettingChange} 
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="heroCtaText">Button Text (CTA)</Label>
                    <Input 
                        id="heroCtaText" 
                        placeholder="e.g., Shop Now" 
                        value={settings.heroCtaText || ''} 
                        onChange={handleSettingChange} 
                    />
                </div>
            </div>
            <div className="space-y-2">
                <Label>Banner Image</Label>
                <div className="border-2 border-dashed rounded-md aspect-[16/6] flex items-center justify-center relative overflow-hidden bg-muted">
                    {heroImagePreview ? (
                        <Image src={heroImagePreview} alt="Hero Banner" layout="fill" className="object-cover" />
                    ) : (
                        <div className='text-center p-4'>
                            <UploadCloud className="h-8 w-8 mx-auto text-gray-400" />
                            <span className="text-sm text-muted-foreground">Upload Banner (Recommended 1200x450)</span>
                        </div>
                    )}
                    <Label htmlFor="hero-image-upload" className="absolute inset-0 cursor-pointer" />
                    <Input 
                        id="hero-image-upload" 
                        type="file" 
                        className="sr-only" 
                        accept="image/*" 
                        onChange={(e) => handleFileChange(e, setHeroImageFile, setHeroImagePreview, 'heroImageUrl', 4)} 
                    />
                </div>
            </div>
        </CollapsibleContent>
    </Collapsible>
</div>
                            

                       
                            <div className="flex items-center space-x-2 py-4 border-t border-b border-muted">
                                <Switch 
                                    id="moq-active" 
                                    checked={settings.isMoqEnabled} 
                                    onCheckedChange={handleSwitchChange('isMoqEnabled')} 
                                />
                                <div>
                                    <Label htmlFor="moq-active" className="cursor-pointer text-base">Enable Minimum Order Quantity (MOQ)</Label>
                                    <p className="text-xs text-muted-foreground mt-1">Allow setting a minimum purchase amount for specific products.</p>
                                </div>
                            </div>


                             {/* 👇 ADD THE COMING SOON SECTION HERE 👇 */}
                             <div className="border-b border-muted pb-4">
                                <Collapsible open={settings.comingSoon} onOpenChange={handleSwitchChange('comingSoon')}>
                                    <div className="flex items-center space-x-2 py-4">
                                        <Switch 
                                            id="coming-soon-active" 
                                            checked={settings.comingSoon} 
                                            onCheckedChange={handleSwitchChange('comingSoon')} 
                                        />
                                        <div>
                                            <Label htmlFor="coming-soon-active" className="cursor-pointer text-base">Enable "Coming Soon" Mode</Label>
                                            <p className="text-xs text-muted-foreground mt-1">Hide your store behind a coming soon page.</p>
                                        </div>
                                    </div>
                                    <CollapsibleContent className="space-y-6 pt-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="comingSoonTitle">Headline</Label>
                                            <Input 
                                                id="comingSoonTitle" 
                                                placeholder="e.g., Something big is coming!" 
                                                value={settings.comingSoonTitle || ''} 
                                                onChange={handleSettingChange} 
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="comingSoonMessage">Message</Label>
                                            <Textarea 
                                                id="comingSoonMessage" 
                                                placeholder="e.g., We're launching our new collection soon. Stay tuned!" 
                                                value={settings.comingSoonMessage || ''} 
                                                onChange={handleSettingChange} 
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Background Image</Label>
                                            <div className="border-2 border-dashed rounded-md aspect-[16/6] flex items-center justify-center relative overflow-hidden bg-muted">
                                                {comingSoonImagePreview ? (
                                                    <Image src={comingSoonImagePreview} alt="Coming Soon Image" layout="fill" className="object-cover" />
                                                ) : (
                                                    <div className='text-center p-4'>
                                                        <UploadCloud className="h-8 w-8 mx-auto text-gray-400" />
                                                        <span className="text-sm text-muted-foreground">Upload Image</span>
                                                    </div>
                                                )}
                                                <Label htmlFor="coming-soon-image-upload" className="absolute inset-0 cursor-pointer" />
                                                <Input 
                                                    id="coming-soon-image-upload" 
                                                    type="file" 
                                                    className="sr-only" 
                                                    accept="image/*" 
                                                    onChange={(e) => handleFileChange(e, setComingSoonImageFile, setComingSoonImagePreview, 'comingSoonImageUrl', 4)} 
                                                />
                                            </div>
                                        </div>
                                    </CollapsibleContent>
                                </Collapsible>
                            </div>
                            {/* 👆 END COMING SOON SECTION 👆 */}
                           
                            <Collapsible open={settings.isAboutUsActive} onOpenChange={handleSwitchChange('isAboutUsActive')}>
                                <div className="flex items-center space-x-2 mb-4">
                                    <Switch id="about-us-active" checked={settings.isAboutUsActive} onCheckedChange={handleSwitchChange('isAboutUsActive')} />
                                    <Label htmlFor="about-us-active" className="cursor-pointer">Show "About Us" Section</Label>
                                </div>
                                <CollapsibleContent className="space-y-2">
                                    <Label htmlFor="aboutUs">About Us Content</Label>
                                    <Textarea 
                                        id="aboutUs" 
                                        placeholder="Tell your customers about your store..." 
                                        value={settings.aboutUs} 
                                        onChange={handleSettingChange}
                                        className="min-h-[100px]"
                                    />
                                </CollapsibleContent>
                            </Collapsible>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </fieldset>
        <div className="flex justify-end mt-6">
            <Button size="lg" onClick={handleSaveChanges} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSaving ? "Saving..." : "Save All Settings"}
            </Button>
        </div>
    </div>
  );
}
