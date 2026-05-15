
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { hasCommerceAccess } from '@/lib/subscription-access';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { doc, updateDoc, getDoc, Timestamp } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Loader2, Megaphone, Tag, Percent, Eye, Timer, Calendar as CalendarIcon, AlertCircle, Star } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import UrgencySettings from '@/components/dashboard/marketing/UrgencySettings';


interface MarketingSettings {
  siteWideDiscount: number;
  isSiteWideSaleActive: boolean;
  showDiscountBadges: boolean;
  showOriginalPrice: boolean;
  announcement: {
    active: boolean;
    text: string;
  };
  flashSale: {
    active: boolean;
    endDate: Date | Timestamp | null;
    title: string;
  }
}

const UpgradeBadge = () => (
    <Button asChild variant="secondary" size="sm" className="h-6 px-2 text-xs bg-yellow-100 text-yellow-800 hover:bg-yellow-200">
        <Link href="/dashboard/subscription">
            <Star className="h-3 w-3 mr-1"/> Upgrade
        </Link>
    </Button>
);

export default function DiscountsPage() {
  const { user, activeStore, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const firestore = useFirestore();

  const [settings, setSettings] = useState<MarketingSettings>({
    siteWideDiscount: 0,
    isSiteWideSaleActive: false,
    showDiscountBadges: true,
    showOriginalPrice: true,
    announcement: {
      active: false,
      text: '',
    },
    flashSale: {
      active: false,
      endDate: null,
      title: 'Flash Sale Ends In:'
    }
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [time, setTime] = useState('23:59');

  const isFreePlan = !hasCommerceAccess(user?.subscription);

  // Fetch Settings
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
                    const marketingData = data.marketing;
                    // Convert Firestore Timestamp to Date object
                    if (marketingData.flashSale?.endDate && marketingData.flashSale.endDate.toDate) {
                        marketingData.flashSale.endDate = marketingData.flashSale.endDate.toDate();
                    }
                     setSettings(s => ({
                        ...s,
                        ...marketingData,
                    }));

                    if (marketingData.flashSale?.endDate) {
                        const endDate = marketingData.flashSale.endDate instanceof Timestamp
                            ? marketingData.flashSale.endDate.toDate()
                            : new Date(marketingData.flashSale.endDate);
                        setTime(format(endDate, 'HH:mm'));
                    }
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

  // Save Logic
  const handleSave = async () => {
    if (!activeStore || !firestore) return;
    setIsSaving(true);
    try {
        const settingsToSave = JSON.parse(JSON.stringify(settings));

        if (settingsToSave.flashSale.endDate) {
            const [hours, minutes] = time.split(':').map(Number);
            const newDate = new Date(settings.flashSale.endDate as Date);
            newDate.setHours(hours, minutes, 0, 0);
            settingsToSave.flashSale.endDate = Timestamp.fromDate(newDate);
        }

        const storeRef = doc(firestore, 'stores', activeStore.id);
        await updateDoc(storeRef, {
            marketing: settingsToSave
        });
        toast({ title: "Marketing Settings Saved!", description: "Your store has been updated." });
    } catch (error) {
        toast({ title: "Error", description: "Could not save settings.", variant: "destructive" });
        console.error(error);
    } finally {
        setIsSaving(false);
    }
  };
  
  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
        setSettings(s => ({ ...s, flashSale: {...s.flashSale, endDate: date} }))
    }
  }

  const getEndDate = (): Date | undefined => {
    const { endDate } = settings.flashSale;
    if (!endDate) return undefined;
    return endDate instanceof Timestamp ? endDate.toDate() : new Date(endDate);
  }


  if (authLoading || isLoading) {
      return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin"/></div>;
  }

  if (!activeStore) return <div className="p-8">Please select a store.</div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4 md:p-0">
        <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Marketing & Promotions</h1>
            <Button onClick={handleSave} disabled={isSaving || isFreePlan}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
            </Button>
        </div>

        <Tabs defaultValue="discounts">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="discounts">Discounts & Promos</TabsTrigger>
            <TabsTrigger value="urgency">Urgency Tools</TabsTrigger>
          </TabsList>
          <TabsContent value="discounts" className="mt-6 space-y-6">
            {/* FLASH SALE TIMER */}
            <div className="animated-border-card">
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Timer className="h-5 w-5 text-orange-500" />
                                <CardTitle>Flash Sale Countdown Timer</CardTitle>
                            </div>
                            {isFreePlan && <UpgradeBadge />}
                        </div>
                        <CardDescription>Create urgency by showing a countdown timer on your store.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <fieldset disabled={isFreePlan}>
                            <div className="flex items-center justify-between border p-4 rounded-lg">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Activate Flash Sale Timer</Label>
                                </div>
                                <Switch 
                                    checked={settings.flashSale.active}
                                    onCheckedChange={(c) => setSettings(s => ({ ...s, flashSale: { ...s.flashSale, active: c } }))}
                                />
                            </div>
                            
                            <div className={cn("space-y-4", !settings.flashSale.active && 'opacity-50 pointer-events-none')}>
                                <div className="space-y-2">
                                    <Label>Sale Title</Label>
                                    <Input 
                                        value={settings.flashSale.title}
                                        onChange={(e) => setSettings(s => ({...s, flashSale: {...s.flashSale, title: e.target.value}}))}
                                        placeholder="e.g. Weekend Flash Sale!"
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>End Date</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                            <Button
                                                variant={"outline"}
                                                className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !settings.flashSale.endDate && "text-muted-foreground"
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {settings.flashSale.endDate ? format(getEndDate()!, "PPP") : <span>Pick a date</span>}
                                            </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0">
                                            <Calendar
                                                mode="single"
                                                selected={getEndDate()}
                                                onSelect={handleDateSelect}
                                                initialFocus
                                            />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>End Time</Label>
                                        <Input 
                                            type="time"
                                            value={time}
                                            onChange={(e) => setTime(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </fieldset>
                    </CardContent>
                </Card>
            </div>


            {/* 1. SITE WIDE SALE */}
            <div className="animated-border-card">
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Percent className="h-5 w-5 text-red-500" />
                                <CardTitle>Run a Store-Wide Sale</CardTitle>
                            </div>
                            {isFreePlan && <UpgradeBadge />}
                        </div>
                        <CardDescription>Automatically discount ALL products by a percentage. Great for holiday sales.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <fieldset disabled={isFreePlan}>
                            <div className="flex items-center justify-between border p-4 rounded-lg">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Activate Sale</Label>
                                    <p className="text-sm text-muted-foreground">Turn this ON to apply the discount immediately.</p>
                                </div>
                                <Switch 
                                    checked={settings.isSiteWideSaleActive}
                                    onCheckedChange={(c) => setSettings(s => ({ ...s, isSiteWideSaleActive: c }))}
                                />
                            </div>

                            <div className={settings.isSiteWideSaleActive ? '' : 'opacity-50 pointer-events-none'}>
                                <Label>Discount Percentage (%)</Label>
                                <div className="relative mt-2">
                                    <Input 
                                        type="number" 
                                        min="0" 
                                        max="100" 
                                        value={settings.siteWideDiscount}
                                        onChange={(e) => setSettings(s => ({ ...s, siteWideDiscount: Number(e.target.value) }))}
                                        className="pl-10 text-lg font-bold"
                                    />
                                    <Percent className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                                </div>
                                <p className="text-sm text-muted-foreground mt-2">
                                    Example: If a product is GHS 100 and you set 20%, it will sell for <strong>GHS 80</strong>.
                                </p>
                            </div>
                        </fieldset>
                    </CardContent>
                </Card>
            </div>

            {/* 2. ANNOUNCEMENT BAR */}
            <div className="animated-border-card">
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Megaphone className="h-5 w-5 text-blue-500" />
                                <CardTitle>Announcement Bar</CardTitle>
                            </div>
                            {isFreePlan && <UpgradeBadge />}
                        </div>
                        <CardDescription>Display a message at the very top of your store.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <fieldset disabled={isFreePlan}>
                            <div className="flex items-center justify-between border p-4 rounded-lg">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Show Banner</Label>
                                </div>
                                <Switch 
                                    checked={settings.announcement.active}
                                    onCheckedChange={(c) => setSettings(s => ({ ...s, announcement: { ...s.announcement, active: c } }))}
                                />
                            </div>
                            
                            <div className={settings.announcement.active ? '' : 'opacity-50 pointer-events-none'}>
                                <Label>Message</Label>
                                <Input 
                                    value={settings.announcement.text}
                                    onChange={(e) => setSettings(s => ({ ...s, announcement: { ...s.announcement, text: e.target.value } }))}
                                    placeholder="e.g. Free Delivery on orders over GHS 500!"
                                    className="mt-2"
                                />
                            </div>
                        </fieldset>
                    </CardContent>
                </Card>
            </div>

            {/* 3. VISUAL SETTINGS */}
            <div className="animated-border-card">
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Eye className="h-5 w-5 text-green-500" />
                            <CardTitle>Display Options</CardTitle>
                        </div>
                        <CardDescription>Control how prices and badges appear on your store.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <fieldset disabled={isFreePlan}>
                            <div className="flex items-center justify-between">
                                <Label className="flex items-center gap-2">
                                    <Tag className="h-4 w-4" /> Show "Sale" Badges
                                </Label>
                                <Switch 
                                    checked={settings.showDiscountBadges}
                                    onCheckedChange={(c) => setSettings(s => ({ ...s, showDiscountBadges: c }))}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <Label className="flex items-center gap-2">
                                    <span className="line-through text-muted-foreground">GHS 100</span> Show Crossed-Out Prices
                                </Label>
                                <Switch 
                                    checked={settings.showOriginalPrice}
                                    onCheckedChange={(c) => setSettings(s => ({ ...s, showOriginalPrice: c }))}
                                />
                            </div>
                        </fieldset>
                    </CardContent>
                </Card>
            </div>
          </TabsContent>
          <TabsContent value="urgency" className="mt-6">
            <UrgencySettings store={activeStore} />
          </TabsContent>
        </Tabs>
    </div>
  );
}
