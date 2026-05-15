
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { hasCommerceAccess } from '@/lib/subscription-access';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertCircle, Star } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';

export default function NewStorePage() {
  const [storeName, setStoreName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { user, loading: authLoading, stores } = useAuth();
  const router = useRouter();
  const firestore = useFirestore();

  const isBusinessPlan = hasCommerceAccess(user?.subscription);
const isEnterprisePlan = hasCommerceAccess(user?.subscription);

  let storeLimit: number;
  if (isEnterprisePlan) {
    storeLimit = 5;
  } else if (isBusinessPlan) {
    storeLimit = 1;
  } else {
    storeLimit = 1; // Basic plan
  }

  const limitReached = stores.length >= storeLimit;

  const handleAddStore = async () => {
    if (authLoading || limitReached) return;

    if (!user || !firestore) {
      toast({ title: 'Authentication Error', description: 'You must be logged in.', variant: 'destructive'});
      return;
    }
    if (!storeName) {
      toast({ title: 'Missing Information', description: 'Please enter a name for your new store.', variant: 'destructive'});
      return;
    }

    setIsSaving(true);
    try {
        const subdomain = storeName.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9-]/g, '');

        // Check if subdomain already exists
        const storesRef = collection(firestore, 'stores');
        const q = query(storesRef, where('subdomain', '==', subdomain));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            toast({
                title: 'Store Name Taken',
                description: 'This store name is already in use. Please choose a different one.',
                variant: 'destructive',
            });
            setIsSaving(false);
            return;
        }

        await addDoc(collection(firestore, 'stores'), {
            sellerId: user.uid,
            name: storeName,
            subdomain: subdomain,
            createdAt: new Date(),
        });

        toast({
            title: 'Store Created!',
            description: `The store "${storeName}" has been successfully created.`,
        });
        router.push('/dashboard/stores');
    } catch (error) {
      console.error('Error adding store: ', error);
      toast({
        title: 'Save Failed',
        description: 'There was an error creating your store.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="max-w-xl mx-auto">
      <CardHeader>
        <CardTitle>Create a New Store</CardTitle>
        <CardDescription>Give your new storefront a name. This will also be used to create its unique URL.</CardDescription>
      </CardHeader>
      <CardContent>
        {limitReached && !isEnterprisePlan && (
           <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>You've reached your store limit!</AlertTitle>
            <AlertDescription>
                You can create up to {storeLimit} store(s) on your current plan. To add more, please upgrade your plan.
            </AlertDescription>
             <div className="mt-4">
                <Button asChild>
                    <Link href="/dashboard/subscription">
                        <Star className="mr-2 h-4 w-4" />
                        Upgrade Plan
                    </Link>
                </Button>
            </div>
          </Alert>
        )}
        <fieldset disabled={isSaving || authLoading || limitReached} className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="store-name">Store Name</Label>
                <Input 
                  id="store-name" 
                  placeholder="e.g., Kicks & Co." 
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                />
                 <p className="text-xs text-muted-foreground">
                    URL will be: {storeName.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9-]/g, '')}.sellquic.com
                 </p>
            </div>
          
            <Button onClick={handleAddStore} size="lg">
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSaving ? 'Creating Store...' : 'Create Store'}
            </Button>
        </fieldset>
      </CardContent>
    </Card>
  );
}
