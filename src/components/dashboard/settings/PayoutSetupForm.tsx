'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CreditCard, CheckCircle, AlertTriangle, Pencil, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { getAuth } from 'firebase/auth';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { updateDoc, doc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useRouter } from 'next/navigation';

interface Bank {
    id: number;
    name: string;
    code: string;
    active: boolean;
}

export default function PayoutSetupForm({ store }: { store: any }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const firestore = useFirestore();
  const router = useRouter();
  
  // State
  const [bankCode, setBankCode] = useState(store.paymentInfo?.bank_code || '');
  const [accountNumber, setAccountNumber] = useState(store.paymentInfo?.account_number || '');
  const [verifiedAccountName, setVerifiedAccountName] = useState<string | null>(store.paymentInfo?.account_name || null);
  
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(true);
  
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isPaystackActive, setIsPaystackActive] = useState(store.isPaystackActive ?? false);

  const isConfigured = store.paymentInfo?.split_configured;

  // 1. Fetch Banks on Mount
  useEffect(() => {
      const fetchBanks = async () => {
          try {
              const res = await fetch('/api/general/banks');
              const data = await res.json();
              if (Array.isArray(data)) {
                  setBanks(data);
              }
          } catch (e) {
              console.error("Failed to load banks");
          } finally {
              setLoadingBanks(false);
          }
      };
      fetchBanks();
  }, []);

  // 2. Auto-Verify Effect
  useEffect(() => {
    if ((isConfigured && !isEditing)) return;

    const handler = setTimeout(() => {
      // Logic: Verify if bank is selected and number is valid length (min 10)
      if (accountNumber.length >= 10 && bankCode) {
         if (accountNumber !== store.paymentInfo?.account_number || bankCode !== store.paymentInfo?.bank_code || !verifiedAccountName) {
            handleVerifyAccount();
         }
      } else {
        setVerifiedAccountName(null);
      }
    }, 1000);

    return () => clearTimeout(handler);
  }, [accountNumber, bankCode, isConfigured, isEditing]);

  const handleVerifyAccount = async () => {
    setIsVerifying(true);
    setVerifiedAccountName(null);
    try {
      const auth = getAuth();
      const idToken = await auth.currentUser?.getIdToken();

      const response = await fetch('/api/vendor/payout/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ account_number: accountNumber, bank_code: bankCode }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not verify account.');
      
      setVerifiedAccountName(result.account_name);
      toast({ title: 'Account Verified!', description: `Name: ${result.account_name}` });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      toast({ title: 'Verification Failed', description: errorMessage, variant: 'destructive' });
      setVerifiedAccountName(null);
    } finally {
      setIsVerifying(false);
    }
  };


  const handleSetupPayouts = async () => {
    if (!user || !store || !firestore) {
      toast({ title: 'Authentication Error', variant: 'destructive' });
      return;
    }
    if (!verifiedAccountName) {
      toast({ title: 'Please verify your account details first.', variant: 'destructive' });
      return;
    }
    const isFirstSetup = !isConfigured;
    setIsSaving(true);
    try {
      const auth = getAuth();
      const idToken = await auth.currentUser?.getIdToken();
      
      const selectedBank = banks.find(b => b.code === bankCode);

      const response = await fetch('/api/vendor/payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({
          storeId: store.id,
          business_name: verifiedAccountName, 
          bank_code: bankCode,
          account_number: accountNumber,
          bank_name: selectedBank?.name || 'Unknown Bank',
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to setup payouts.');
      }
      toast({ title: 'Payouts Configured!', description: 'Your bank details have been saved for automated payouts.' });
      
      await updateDoc(doc(firestore, 'stores', store.id), { isPaystackActive: true });
      setIsPaystackActive(true);
      setIsEditing(false);
      
      if(isFirstSetup){
        router.push('/dashboard');
      } else {
        window.location.reload();
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      toast({ title: 'Setup Failed', description: errorMessage, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleTogglePaystack = async (checked: boolean) => {
    if (!isConfigured) {
        toast({ title: 'Setup Required', description: 'Please set up your payout account before enabling it.', variant: 'destructive' });
        return;
    }
    if (!firestore || !store) return;
    setIsSaving(true);
    try {
        await updateDoc(doc(firestore, 'stores', store.id), { isPaystackActive: checked });

        const auth = getAuth();
        const token = await auth.currentUser?.getIdToken();
        await fetch('/api/cache/clear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ storeId: store.id })
        });
        
        setIsPaystackActive(checked);
        toast({ title: `Paystack payments ${checked ? 'enabled' : 'disabled'}.` });
    } catch (error) {
         toast({ title: 'Update Failed', variant: 'destructive' });
    } finally {
        setIsSaving(false);
    }
  }

  return (
    <div className="animated-border-card">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard /> Automated Payouts
            <Badge variant="default" className="bg-primary/10 text-primary border border-primary/20">Beta</Badge>
          </CardTitle>
          <CardDescription>Receive payments automatically via Card, Apple Pay, and Mobile Money.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            
            <div className="text-xs bg-muted p-4 rounded-lg border space-y-2">
                <p className="font-bold text-sm text-foreground">Key Information</p>
                <ul className="list-disc pl-4 space-y-1.5 text-muted-foreground">
                    <li>Payments are confirmed instantly.</li>
                    <li>Funds arrive within <strong>T+1 (next working day)</strong>.</li>
                    <li>Paystack fee: <strong>1.95%</strong> per transaction.</li>
                    <li className="text-destructive font-semibold">Important: Ensure your account details are correct.</li>
                </ul>
            </div>
            
          {isConfigured && !isEditing ? (
            <div className='space-y-4'>
                <Alert variant="default" className="bg-green-50 border-green-200 text-green-800">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertTitle>Payouts Active!</AlertTitle>
                    <AlertDescription className="flex justify-between items-start mt-2">
                        <div>
                            Your account is set up for automated payouts to: <br/>
                            <strong>{store.paymentInfo.account_name}</strong> <br/> 
                            {store.paymentInfo.bank_name} (...{store.paymentInfo.account_number.slice(-4)})
                        </div>
                    </AlertDescription>
                </Alert>
                
                <div className="flex justify-end">
                    <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                        <Pencil className="h-3 w-3 mr-2" /> Change Details
                    </Button>
                </div>

                <div className="flex items-center space-x-2 pt-4 border-t">
                    <Switch id="isPaystackActive" checked={isPaystackActive} onCheckedChange={handleTogglePaystack} disabled={isSaving}/>
                    <Label htmlFor="isPaystackActive">Enable automated payments at checkout</Label>
                </div>
            </div>
          ) : (
            <fieldset disabled={isSaving} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bank-code">Bank / Mobile Money</Label>
                <Select value={bankCode} onValueChange={setBankCode} disabled={loadingBanks}>
                  <SelectTrigger id="bank-code">
                    <SelectValue placeholder={loadingBanks ? "Loading banks..." : "Select your bank or MoMo"} />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {banks.map(bank => (
                      <SelectItem key={bank.id} value={bank.code}>
                        {bank.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-number">Account / MoMo Number</Label>
                <div className="relative">
                    <Input
                      id="account-number"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      placeholder="Enter account number"
                    />
                    {isVerifying && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin"/>}
                </div>
              </div>

              {verifiedAccountName && (
                 <div className="space-y-2">
                    <Label>Verified Account Name</Label>
                    <Input 
                        value={verifiedAccountName}
                        readOnly
                        className="bg-muted font-semibold text-green-700"
                    />
                </div>
              )}

              <div className="flex gap-2">
                {isEditing && (
                    <Button variant="ghost" onClick={() => setIsEditing(false)}>
                        Cancel
                    </Button>
                )}
                <Button className="flex-1" onClick={handleSetupPayouts} disabled={isSaving || isVerifying || !verifiedAccountName}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isSaving ? 'Saving...' : 'Save & Enable Payouts'}
                </Button>
              </div>
            </fieldset>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
