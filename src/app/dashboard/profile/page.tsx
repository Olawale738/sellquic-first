'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, UserCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth, updateProfile } from 'firebase/auth';
import { ChangeEmailForm } from './email-form';

export default function ProfilePage() {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const { toast } = useToast();
  const firestore = useFirestore();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setFirstName((user as any).firstName || '');
      setLastName((user as any).lastName || '');
      setPhone((user as any).phone || '');
    }
  }, [user]);

  const handleSaveChanges = async () => {
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser || !firestore) {
      toast({ title: 'Not authenticated', variant: 'destructive' });
      return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      toast({ title: 'First and Last name are required', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const newDisplayName = `${firstName.trim()} ${lastName.trim()}`;

      // Update Firestore
      await updateDoc(doc(firestore, 'users', currentUser.uid), {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        displayName: newDisplayName,
        phone: phone.trim(),
        updatedAt: serverTimestamp()
      });

      // Update Firebase Auth Profile
      if (currentUser.displayName !== newDisplayName) {
        await updateProfile(currentUser, {
          displayName: newDisplayName
        });
      }

      await refreshUser();

      toast({
        title: 'Profile Updated! ✨',
        description: 'Your changes have been saved.',
      });
    } catch (error: any) {
      console.error('Error saving profile:', error);
      toast({
        title: 'Save Failed',
        description: error.message || 'Could not save profile details.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#A155E5]" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-10">
        <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-[#A155E5]/10 rounded-2xl text-[#A155E5]">
                <UserCircle size={28} />
            </div>
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Account Settings</h1>
                <p className="text-sm text-slate-500 font-medium">Manage your personal and business identity.</p>
            </div>
        </div>

        <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b">
                <CardTitle className="text-lg">Personal Details</CardTitle>
                <CardDescription>
                This information is used to identify you and your stores.
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="firstName">First Name</Label>
                        <Input
                            id="firstName"
                            placeholder="e.g. Ama"
                            className="h-11 focus-visible:ring-[#A155E5]"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                        />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input
                            id="lastName"
                            placeholder="e.g. Serwaa"
                            className="h-11 focus-visible:ring-[#A155E5]"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                        />
                    </div>
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="phone">WhatsApp Number</Label>
                    <Input
                        id="phone"
                        type="tel"
                        placeholder="e.g. +233244123456"
                        className="h-11 focus-visible:ring-[#A155E5]"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                    />
                    <p className="text-[10px] text-slate-400 italic">Format: +233244XXXXXX</p>
                </div>
                
                <Button 
                    size="lg" 
                    onClick={handleSaveChanges} 
                    disabled={isSaving}
                    className="bg-[#A155E5] hover:bg-[#8e46d1] text-white font-bold transition-all shadow-md"
                >
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {isSaving ? 'Saving Changes...' : 'Save Profile'}
                </Button>
            </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b">
                <CardTitle className="text-lg">Email Address</CardTitle>
                <CardDescription>
                Update your login and notification email.
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
                <div className="space-y-2 mb-6">
                    <Label className="text-slate-500">Current Email</Label>
                    <Input type="email" value={user.email || ''} disabled className="bg-slate-50 border-slate-200" />
                </div>
                <ChangeEmailForm currentEmail={user.email || ''} />
            </CardContent>
        </Card>
    </div>
  );
}
