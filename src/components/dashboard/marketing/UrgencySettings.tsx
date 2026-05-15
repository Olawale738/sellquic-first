'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { hasCommerceAccess } from '@/lib/subscription-access';
import { Button } from '@/components/ui/button';
import { Loader2, Timer, ShoppingCart, Lock } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';


export default function UrgencySettings({ store }: { store: any }) {
  const { user } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // Default Settings if none exist
  const [settings, setSettings] = useState(store.marketingSettings || {
    productTimer: {
      enabled: false,
      text: "Offer ends in:",
      durationHours: 24, // Loops every 24 hours
      bgColor: "#FEF2F2", // Light Red
      textColor: "#DC2626" // Red
    },
    cartTimer: {
      enabled: false,
      text: "Your items are reserved for:",
      durationMinutes: 10,
      bgColor: "#EFF6FF", // Light Blue
      textColor: "#2563EB" // Blue
    }
  });

  const isEnterprise = hasCommerceAccess(user?.subscription);

  const handleSave = async () => {
    if (!firestore || !store.id) return;
    setSaving(true);
    try {
      await updateDoc(doc(firestore, 'stores', store.id), {
        marketingSettings: settings
      });
      toast({ title: "Settings Saved", description: "Your timers are live." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (type: 'productTimer' | 'cartTimer', key: string, value: any) => {
    setSettings((prev: any) => ({
      ...prev,
      [type]: { ...prev[type], [key]: value }
    }));
  };

  if (!isEnterprise) {
    return (
        <Card className="border-dashed border-2">
            <CardHeader className="text-center pb-10 pt-10">
                <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-4">
                    <Timer className="h-8 w-8 text-primary" />
                </div>
                <CardTitle>Urgency & FOMO Tools</CardTitle>
                <CardDescription className="max-w-md mx-auto mt-2">
                    Increase sales by 300% with Countdown Timers on products and carts. 
                    Exclusive to the <strong>Business (Enterprise) Plan</strong>.
                </CardDescription>
                <Button asChild className="mt-6 w-fit mx-auto">
                    <Link href="/dashboard/subscription"><Lock className="mr-2 h-4 w-4"/> Upgrade to Unlock</Link>
                </Button>
            </CardHeader>
        </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. PRODUCT PAGE TIMER */}
      <fieldset disabled={true}>
        <Card className="relative overflow-hidden">
            <Badge className="absolute top-4 right-4" variant="secondary">Coming Soon</Badge>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Timer className="h-5 w-5 text-orange-500" /> Product Page Countdown
                </CardTitle>
                <CardDescription>Creates a recurring countdown on product pages (e.g., "Sale ends in...").</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between border-b pb-4">
                    <Label>Enable Timer</Label>
                    <Switch 
                        checked={settings.productTimer.enabled} 
                        onCheckedChange={(c) => updateSetting('productTimer', 'enabled', c)}
                    />
                </div>
                
                <div className={settings.productTimer.enabled ? "space-y-4 opacity-100" : "space-y-4 opacity-50 pointer-events-none"}>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Display Text</Label>
                            <Input 
                                value={settings.productTimer.text} 
                                onChange={(e) => updateSetting('productTimer', 'text', e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Duration (Hours)</Label>
                            <Input 
                                type="number"
                                min={1}
                                max={72}
                                value={settings.productTimer.durationHours} 
                                onChange={(e) => updateSetting('productTimer', 'durationHours', parseInt(e.target.value))}
                            />
                            <p className="text-[10px] text-muted-foreground">The timer resets every X hours.</p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Background Color</Label>
                            <div className="flex gap-2">
                                <Input 
                                    type="color" 
                                    className="w-12 h-10 p-1"
                                    value={settings.productTimer.bgColor} 
                                    onChange={(e) => updateSetting('productTimer', 'bgColor', e.target.value)}
                                />
                                <Input 
                                    value={settings.productTimer.bgColor} 
                                    onChange={(e) => updateSetting('productTimer', 'bgColor', e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Text Color</Label>
                            <div className="flex gap-2">
                                <Input 
                                    type="color" 
                                    className="w-12 h-10 p-1"
                                    value={settings.productTimer.textColor} 
                                    onChange={(e) => updateSetting('productTimer', 'textColor', e.target.value)}
                                />
                                <Input 
                                    value={settings.productTimer.textColor} 
                                    onChange={(e) => updateSetting('productTimer', 'textColor', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Preview */}
                    <div className="p-4 rounded-md border text-center" style={{ backgroundColor: settings.productTimer.bgColor, color: settings.productTimer.textColor }}>
                        <p className="font-bold text-sm uppercase">{settings.productTimer.text}</p>
                        <p className="font-mono text-xl font-bold">02 : 15 : 45</p>
                    </div>
                </div>
            </CardContent>
        </Card>
      </fieldset>

      {/* 2. CART PAGE TIMER */}
      <fieldset disabled={true}>
        <Card className="relative overflow-hidden">
            <Badge className="absolute top-4 right-4" variant="secondary">Coming Soon</Badge>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5 text-blue-500" /> Cart Reservation Timer
                </CardTitle>
                <CardDescription>Creates urgency at checkout (e.g., "Reserved for 10 minutes").</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between border-b pb-4">
                    <Label>Enable Timer</Label>
                    <Switch 
                        checked={settings.cartTimer.enabled} 
                        onCheckedChange={(c) => updateSetting('cartTimer', 'enabled', c)}
                    />
                </div>

                <div className={settings.cartTimer.enabled ? "space-y-4 opacity-100" : "space-y-4 opacity-50 pointer-events-none"}>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Display Text</Label>
                            <Input 
                                value={settings.cartTimer.text} 
                                onChange={(e) => updateSetting('cartTimer', 'text', e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Duration (Minutes)</Label>
                            <Input 
                                type="number"
                                min={1}
                                max={60}
                                value={settings.cartTimer.durationMinutes} 
                                onChange={(e) => updateSetting('cartTimer', 'durationMinutes', parseInt(e.target.value))}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Background Color</Label>
                            <div className="flex gap-2">
                                <Input type="color" className="w-12 h-10 p-1" value={settings.cartTimer.bgColor} onChange={(e) => updateSetting('cartTimer', 'bgColor', e.target.value)} />
                                <Input value={settings.cartTimer.bgColor} onChange={(e) => updateSetting('cartTimer', 'bgColor', e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Text Color</Label>
                            <div className="flex gap-2">
                                <Input type="color" className="w-12 h-10 p-1" value={settings.cartTimer.textColor} onChange={(e) => updateSetting('cartTimer', 'textColor', e.target.value)} />
                                <Input value={settings.cartTimer.textColor} onChange={(e) => updateSetting('cartTimer', 'textColor', e.target.value)} />
                            </div>
                        </div>
                    </div>

                    {/* Preview */}
                    <div className="p-3 rounded-md border text-center text-sm font-medium" style={{ backgroundColor: settings.cartTimer.bgColor, color: settings.cartTimer.textColor }}>
                        {settings.cartTimer.text} <span className="font-bold font-mono ml-2">09:59</span>
                    </div>
                </div>
            </CardContent>
        </Card>
      </fieldset>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || true} size="lg">
            {saving ? <Loader2 className="animate-spin mr-2"/> : null}
            Save Changes
        </Button>
      </div>
    </div>
  );
}
