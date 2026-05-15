'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, AlertTriangle, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import PayoutSetupForm from '@/components/dashboard/settings/PayoutSetupForm';
import { useRouter } from 'next/navigation';
import { getAuth } from 'firebase/auth';

interface PaymentSettings {
  momoNumber?: string;
  momoAccountName?: string;
  momoNetwork?: string;
  isBankPaymentActive?: boolean;
  bankName?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankBranch?: string;
  isCodActive?: boolean;
  isMomoActive?: boolean;
}

export default function PaymentsPage() {
  const { user, activeStore, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const firestore = useFirestore();
  const router = useRouter();

  const [settings, setSettings] = useState<PaymentSettings>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!user || !activeStore || !firestore) return;
      setIsLoading(true);
      const storeDocRef = doc(firestore, 'stores', activeStore.id);
      try {
        const docSnap = await getDoc(storeDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setSettings({
            momoNumber: data.momoNumber || '',
            momoAccountName: data.momoAccountName || '',
            momoNetwork: data.momoNetwork || '',
            isBankPaymentActive: data.isBankPaymentActive || false,
            bankName: data.bankName || '',
            bankAccountName: data.bankAccountName || '',
            bankAccountNumber: data.bankAccountNumber || '',
            bankBranch: data.bankBranch || '',
            isCodActive: data.isCodActive || false,
            isMomoActive: data.isMomoActive ?? true, 
          });
        }
      } catch (error) {
        console.error("Error fetching payment settings:", error);
        toast({
          title: "Error",
          description: "Could not fetch your payment settings.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (!authLoading) {
      fetchSettings();
    }
  }, [user, activeStore, authLoading, toast, firestore]);
  
  const handleSettingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setSettings(prev => ({ ...prev, [id]: value }));
  };

  const handleNetworkChange = (value: string) => {
      setSettings(prev => ({ ...prev, momoNetwork: value }));
  };

  const handleSwitchChange = (id: keyof PaymentSettings) => (checked: boolean) => {
    setSettings(prev => ({...prev, [id]: checked}))
  }

  const handleSaveChanges = async () => {
    if (!user || !activeStore || !firestore) {
        toast({ title: "Not authenticated or no active store", variant: "destructive" });
        return;
    }
    
    const isFirstSetup = !activeStore.momoNumber && !activeStore.bankAccountNumber;
    setIsSaving(true);
    try {
        await updateDoc(doc(firestore, 'stores', activeStore.id), {
            momoNumber: settings.momoNumber,
            momoAccountName: settings.momoAccountName,
            momoNetwork: settings.momoNetwork,
            isMomoActive: settings.isMomoActive,
            isBankPaymentActive: settings.isBankPaymentActive,
            bankName: settings.bankName,
            bankAccountName: settings.bankAccountName,
            bankAccountNumber: settings.bankAccountNumber,
            bankBranch: settings.bankBranch,
            isCodActive: settings.isCodActive,
        });

        const auth = getAuth();
        const token = await auth.currentUser?.getIdToken();
        await fetch('/api/cache/clear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ storeId: activeStore.id })
        });

        toast({
            title: "Settings Saved!",
            description: "Your payment details have been updated.",
        });
        
        if(isFirstSetup){
            router.push('/dashboard');
        }

    } catch (error) {
        console.error("Error saving payment settings: ", error);
        toast({
            title: "Save Failed",
            description: "Could not save your payment settings.",
            variant: "destructive",
        });
    } finally {
        setIsSaving(false);
    }
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
        <div className="animated-border-card">
            <Card className="max-w-2xl mx-auto">
                <CardHeader>
                <CardTitle>Payment Details</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Please select a store to manage payment details.</p>
                </CardContent>
            </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-10">
        
        {/* AUTOMATED PAYMENTS SECTION */}
        <div className="space-y-4">
            
            <PayoutSetupForm store={activeStore} />
        </div>
        
        <Separator />
        
        {/* MANUAL PAYMENTS SECTION */}
        <div className="space-y-4">
            <div>
                <h2 className="text-xl font-bold">Manual Payment Methods</h2>
                <p className="text-sm text-muted-foreground">Customers will see these details and pay you directly outside the app.</p>
            </div>

            <div className="animated-border-card">
                <Card>
                <CardHeader>
                    <CardTitle>Mobile Money (Direct)</CardTitle>
                    <CardDescription>
                    Display your MoMo number for customers to send money manually.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between border p-4 rounded-lg">
                        <Label htmlFor="isMomoActive" className="cursor-pointer font-medium">Enable Manual MoMo</Label>
                        <Switch id="isMomoActive" checked={settings.isMomoActive} onCheckedChange={handleSwitchChange('isMomoActive')} />
                    </div>
                    
                    {settings.isMomoActive && (
                        <fieldset disabled={isSaving} className="space-y-4 animate-in slide-in-from-top-2">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="momoNetwork">Network</Label>
                                    <Select value={settings.momoNetwork} onValueChange={handleNetworkChange}>
                                        <SelectTrigger id="momoNetwork">
                                            <SelectValue placeholder="Select..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="MTN">MTN</SelectItem>
                                            <SelectItem value="Telecel">Telecel</SelectItem>
                                            <SelectItem value="AirtelTigo">AirtelTigo</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="momoNumber">Number</Label>
                                    <Input id="momoNumber" placeholder="e.g., 0241234567" value={settings.momoNumber} onChange={handleSettingChange} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="momoAccountName">Account Name</Label>
                                <Input id="momoAccountName" placeholder="e.g., John Doe" value={settings.momoAccountName} onChange={handleSettingChange} />
                            </div>
                        </fieldset>
                    )}
                </CardContent>
                </Card>
            </div>

            <div className="animated-border-card">
                <Card>
                    <CardHeader>
                        <CardTitle>Bank Transfer</CardTitle>
                        <CardDescription>
                        Display bank details for large transactions.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between border p-4 rounded-lg">
                            <Label htmlFor="isBankPaymentActive" className="cursor-pointer font-medium">Enable Bank Transfer</Label>
                            <Switch id="isBankPaymentActive" checked={settings.isBankPaymentActive} onCheckedChange={handleSwitchChange('isBankPaymentActive')} />
                        </div>

                        {settings.isBankPaymentActive && (
                            <fieldset disabled={isSaving} className="space-y-4 animate-in slide-in-from-top-2">
                                <div className="space-y-2">
                                    <Label htmlFor="bankName">Bank Name</Label>
                                    <Input id="bankName" placeholder="e.g., Ghana Commercial Bank" value={settings.bankName} onChange={handleSettingChange} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="bankAccountName">Account Name</Label>
                                    <Input id="bankAccountName" placeholder="e.g., John Kofi Doe" value={settings.bankAccountName} onChange={handleSettingChange} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="bankAccountNumber">Account Number</Label>
                                    <Input id="bankAccountNumber" placeholder="e.g., 9040001234567" value={settings.bankAccountNumber} onChange={handleSettingChange} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="bankBranch">Branch</Label>
                                    <Input id="bankBranch" placeholder="e.g., Accra Main" value={settings.bankBranch} onChange={handleSettingChange} />
                                </div>
                            </fieldset>
                        )}
                    </CardContent>
                </Card>
            </div>
            
            <div className="animated-border-card">
                <Card>
                    <CardHeader>
                        <CardTitle>Cash on Delivery</CardTitle>
                        <CardDescription>
                        Allow customers to pay in cash when they receive the item.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between border p-4 rounded-lg">
                            <Label htmlFor="isCodActive" className="cursor-pointer font-medium">Enable Cash on Delivery</Label>
                            <Switch id="isCodActive" checked={settings.isCodActive} onCheckedChange={handleSwitchChange('isCodActive')} />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>

         <div className="flex justify-end pt-4">
            <Button size="lg" onClick={handleSaveChanges} disabled={isSaving} className="w-full sm:w-auto">
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSaving ? "Saving..." : "Save Payment Details"}
            </Button>
        </div>
    </div>
  );
}
