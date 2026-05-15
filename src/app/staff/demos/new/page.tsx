
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { collection, addDoc, query, where, getDocs, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import { slugify } from '@/lib/utils';

export default function NewDemoPage() {
  const [storeName, setStoreName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const firestore = useFirestore();

  const handleCreateDemo = async () => {
    if (!storeName.trim()) {
      toast({ title: 'Please enter a name for the demo store.', variant: 'destructive' });
      return;
    }
    if (!firestore || !user) {
        toast({ title: 'Error: Not authenticated', variant: 'destructive'});
        return;
    }

    setIsSaving(true);
    try {
      let slug = slugify(storeName);
      const demoStoresRef = collection(firestore, 'demo_stores');
      
      // Check if slug exists
      const q = query(demoStoresRef, where('slug', '==', slug));
      const querySnapshot = await getDocs(q);

      // If slug exists, append a random number
      if (!querySnapshot.empty) {
        slug = `${slug}-${Math.floor(100 + Math.random() * 900)}`;
      }
      
      const newDemoRef = doc(demoStoresRef, slug);

      await setDoc(newDemoRef, {
        name: storeName,
        slug: slug,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        status: 'draft',
      });

      toast({
        title: 'Demo Store Created!',
        description: `Now you can add products and customize it.`,
      });
      router.push(`/staff/demos/${slug}/edit`);

    } catch (error) {
      console.error('Error creating demo store: ', error);
      toast({
        title: 'Creation Failed',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="max-w-xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Create a New Demo Store
        </CardTitle>
        <CardDescription>
            Give the demo store a name. This will generate a unique link to share with the potential client.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <fieldset disabled={isSaving || authLoading} className="space-y-2">
            <Label htmlFor="store-name">Business Name</Label>
            <Input 
              id="store-name" 
              placeholder="e.g., Akua's Bags & Accessories" 
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
            />
             <p className="text-xs text-muted-foreground">
                URL will be: sellquic.com/demo/{slugify(storeName)}
             </p>
        </fieldset>
      
        <Button onClick={handleCreateDemo} size="lg" disabled={isSaving || authLoading || !storeName.trim()}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isSaving ? 'Creating...' : 'Create & Continue'}
        </Button>
      </CardContent>
    </Card>
  );
}
