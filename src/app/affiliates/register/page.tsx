
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, Zap } from 'lucide-react';
import { createUserWithEmailAndPassword, updateProfile, getAuth } from 'firebase/auth';
import { useFirestore } from '@/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { nanoid } from 'nanoid';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import Link from 'next/link';

export default function AffiliateRegister() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [isSeller, setIsSeller] = useState<string | undefined>(undefined);
  const [promotionChannel, setPromotionChannel] = useState('');
  const [agreedToPolicy, setAgreedToPolicy] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const auth = getAuth();
  const firestore = useFirestore();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore) {
        toast({ title: 'Error', description: 'Could not connect to the database.', variant: 'destructive'});
        return;
    }
    if (!agreedToPolicy) {
        toast({ title: "Agreement Required", description: "You must agree to the Affiliate Policy to continue.", variant: "destructive" });
        return;
    }
    setIsLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const firstName = name.split(' ')[0].toUpperCase();
      const code = `${firstName}${nanoid(4).toUpperCase()}`;

      // Set the main user document in the `users` collection
      await setDoc(doc(firestore, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        displayName: name,
        phone: phone,
        role: 'affiliate', // Set user role to affiliate
        isSeller: isSeller === 'yes',
        promotionChannel: promotionChannel,
        referralCode: code,
        affiliateWallet: { available: 0, pending: 0, paid: 0 },
        createdAt: serverTimestamp(),
      });
      
      await updateProfile(user, { displayName: name });
      
      // Send welcome email - Fire and forget
      fetch('/api/emails/affiliate-welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, name: name }),
      }).catch(err => console.error("Failed to send welcome email:", err));


      toast({ title: "Welcome!", description: "Account created successfully." });
      router.push('/affiliates/dashboard');

    } catch (error: any) {
      let title = 'Signup Failed';
      let description = 'An unexpected error occurred. Please try again.';
      switch (error.code) {
        case 'auth/email-already-in-use':
          title = 'Email Already in Use';
          description = 'This email is already registered. Please try logging in instead.';
          break;
        case 'auth/invalid-email':
          title = 'Invalid Email';
          description = 'Please enter a valid email address.';
          break;
        case 'auth/weak-password':
          title = 'Weak Password';
          description = 'Your password should be at least 6 characters long.';
          break;
      }
      toast({ title, description, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow-xl border-none">
        <CardHeader className="text-center space-y-2">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <Zap className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Become an Affiliate</CardTitle>
            <CardDescription>Start earning upto 30% Commission per referral today.</CardDescription>
        </CardHeader>
        <CardContent>
            <form onSubmit={handleRegister} className="space-y-6">
                <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input required placeholder="Kwame Mensah" value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label>Phone Number (WhatsApp / MoMo)</Label>
                    <Input required type="tel" placeholder="055..." value={phone} onChange={e => setPhone(e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label>Email Address</Label>
                    <Input required type="email" placeholder="kwame@example.com" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label>Password</Label>
                    <Input required type="password" value={password} onChange={e => setPassword(e.target.value)} />
                </div>
                
                <div className="space-y-3">
                    <Label>Are you currently an online seller?</Label>
                    <RadioGroup onValueChange={setIsSeller} value={isSeller} className="flex gap-4">
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="yes" id="seller-yes" />
                            <Label htmlFor="seller-yes">Yes</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="no" id="seller-no" />
                            <Label htmlFor="seller-no">No</Label>
                        </div>
                    </RadioGroup>
                </div>
                
                <div className="space-y-2">
                    <Label htmlFor="promotion-channel">Where will you mainly promote SellQuic?</Label>
                     <Select onValueChange={setPromotionChannel} value={promotionChannel}>
                        <SelectTrigger id="promotion-channel">
                            <SelectValue placeholder="Select a platform" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="whatsapp">WhatsApp</SelectItem>
                            <SelectItem value="instagram">Instagram</SelectItem>
                            <SelectItem value="facebook">Facebook</SelectItem>
                            <SelectItem value="multiple">Multiple Platforms</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-center space-x-2">
                    <Checkbox id="terms" checked={agreedToPolicy} onCheckedChange={(checked) => setAgreedToPolicy(checked as boolean)} />
                    <Label htmlFor="terms" className="text-sm text-muted-foreground">
                        I agree to the <Link href="/affiliate-policy" target="_blank" className="underline hover:text-primary">SellQuic Affiliate Policy</Link>
                    </Label>
                </div>

                <Button type="submit" className="w-full h-12 text-lg" disabled={isLoading}>
                    {isLoading ? <Loader2 className="animate-spin" /> : "Create My Affiliate Account"}
                </Button>
            </form>
        </CardContent>
      </Card>
    </div>
  );
}
