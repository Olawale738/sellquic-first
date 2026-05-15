
'use client';

import Link from 'next/link';
import { Bell, ChevronDown, Menu, Loader2, Mail, X, Send, LogOut, AlertCircle } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { getAuth, signOut } from 'firebase/auth';
import React, { useState, useEffect } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuGroup, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useAuth, useRequireAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import dynamic from 'next/dynamic';
import { FaWhatsapp } from 'react-icons/fa';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn, slugify } from '@/lib/utils';
import { useFirestore } from '@/firebase';
import { doc, getDoc, writeBatch, serverTimestamp, collection, Timestamp } from 'firebase/firestore';
import { sendOtpAction, verifyOtpAction } from '@/lib/actions';
import { Input } from '@/components/ui/input';
import { VerifyEmailBanner } from '@/components/dashboard/VerifyEmailBanner';
import { differenceInDays } from 'date-fns';
import { Rocket } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';


const DashboardSidebar = dynamic(() => import('@/components/dashboard-sidebar'), { ssr: false });

function generateReferralCode(name: string) {
    const prefix = (name || 'USER').substring(0, 4).toUpperCase().replace(/[^A-Z]/g, '');
    const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `${prefix}${randomPart}`;
}

const ActivationScreen = () => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [otp, setOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleResend = async () => {
    if (!user) return;
    setIsResending(true);
    const result = await sendOtpAction(user.uid, user.email!, user.displayName || 'Vendor');
    if (result.success) {
      toast({ title: 'Code Sent!', description: 'A new verification code has been sent to your email.' });
      setResendCooldown(60);
    } else {
      toast({ title: 'Error', description: result.message, variant: 'destructive' });
    }
    setIsResending(false);
  };

  const handleVerify = async () => {
    if (!user || otp.length !== 6) {
      toast({ title: "Invalid Code", description: "Please enter the 6-digit code from your email.", variant: "destructive"});
      return;
    }
    setIsVerifying(true);
    const result = await verifyOtpAction({
        userId: user.uid,
        otp: otp,
        // The following are placeholders as they are required by the function
        // but not used in the simple verify flow.
        email: user.email!,
        firstName: (user as any).firstName || '',
        lastName: (user as any).lastName || '',
        businessName: user.displayName || '',
        phone: (user as any).phone || '',
    });
    if (result.success) {
      toast({ title: "Success!", description: "Your account is activated." });
      window.location.reload();
    } else {
      toast({ title: "Verification Failed", description: result.message, variant: "destructive" });
    }
    setIsVerifying(false);
  };

  return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
        <div className="bg-white p-10 rounded-[3rem] shadow-2xl max-w-sm border border-slate-100">
          <div className="w-20 h-20 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse">
            <Mail className="w-10 h-10 text-[#A155E5]" />
          </div>
          <h2 className="text-2xl font-[1000] italic uppercase mb-2">Activation Required</h2>
          <p className="text-slate-500 text-sm mb-8 leading-relaxed">
            Check your inbox for a 6-digit code to activate your account and store.
          </p>
          <div className="space-y-4">
              <Input 
                placeholder="6-digit code"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                maxLength={6}
                className="h-12 rounded-xl text-center text-2xl font-bold tracking-[10px]"
                disabled={isVerifying}
              />
              <Button onClick={handleVerify} className="w-full bg-[#A155E5] font-bold h-12 rounded-xl" disabled={isVerifying || otp.length !== 6}>
                {isVerifying ? <Loader2 className="animate-spin" /> : "Verify & Activate"}
              </Button>
              <div className="flex justify-between items-center text-xs">
                <Button variant="link" onClick={handleResend} disabled={isResending || resendCooldown > 0} className="text-slate-500 font-bold px-0">
                  {isResending ? <Loader2 className="animate-spin mr-2" /> : null}
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                </Button>
                <Button variant="ghost" onClick={() => signOut(getAuth()).then(() => router.push('/login'))} className="text-slate-400 font-bold px-0 h-auto">Logout</Button>
              </div>
          </div>
        </div>
      </div>
    );
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  useRequireAuth();
  const { user, loading, stores, storesLoaded, activeStore, setActiveStore, isSubscriptionExpired } = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // --- SAFETY NET: AUTO-ACTIVATE VERIFIED USERS ---
  useEffect(() => {
    const auth = getAuth();
    const fbUser = auth.currentUser;
    if (loading || !fbUser || !db || !fbUser.emailVerified) return;

    const finalizeSetup = async () => {
      try {
        const userRef = doc(db, 'users', fbUser.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists() && userSnap.data().status === 'pending_verification') {
          const data = userSnap.data();
          const batch = writeBatch(db);

          batch.update(userRef, {
            status: 'active',
            emailVerified: true,
            isBetaTester: false,
            referralCode: generateReferralCode(data.displayName),
            subscription: {
              planId: null,
              status: 'pending_plan',
              startDate: serverTimestamp(),
              endDate: null,
            },
            updatedAt: serverTimestamp()
          });

          const storeRef = doc(collection(db, 'stores'));
          batch.set(storeRef, {
            sellerId: fbUser.uid,
            name: data.businessName,
            subdomain: data.businessNameSlug,
            createdAt: serverTimestamp(),
            status: 'active'
          });

          await batch.commit();
          window.location.reload(); 
        }
      } catch (e) { console.error("Setup Error:", e); }
    };
    finalizeSetup();
  }, [loading, db, user]);

  // ── SMART TRIAL & PROMO LOGIC ──
  const promo = (user as any)?.promoAccess;
  const isRevoked = !!promo?.revokedAt;
  
  // Safely parse the promo endsAt date (Handles both Firestore Timestamps and strings)
  let promoEndsDate = null;
  if (promo?.endsAt) {
    promoEndsDate = typeof promo.endsAt.toDate === 'function' ? promo.endsAt.toDate() : new Date(promo.endsAt);
  }
  
  const hasActivePromo = promoEndsDate && !isRevoked && promoEndsDate > new Date();
  
  const sub = (user as any)?.subscription || {};
  
  let legacyEndDate = null;
  if (sub?.endDate) {
    legacyEndDate = typeof sub.endDate.toDate === 'function' ? sub.endDate.toDate() : new Date(sub.endDate);
  }
  const isLegacyTrial = sub.status === 'trial' && legacyEndDate && legacyEndDate > new Date();

  const isTrial = hasActivePromo || isLegacyTrial;
  
  let daysLeft = 0;
  if (hasActivePromo && promoEndsDate) {
    daysLeft = differenceInDays(promoEndsDate, new Date());
  } else if (isLegacyTrial && legacyEndDate) {
    daysLeft = differenceInDays(legacyEndDate, new Date());
  }
  
  // 1. Are they on an active paid plan?
  const paidPlans = ['starter', 'standard', 'growth'];
  const isActivelyPaying = sub.status === 'active' && paidPlans.includes(sub.planId);

  // 2. Hide the banner ONLY IF they are paying AND they don't have an active promo
  const hideBanner = isActivelyPaying && !hasActivePromo;

  

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-[#A155E5]" /></div>;

  // --- SECURITY LOCK SCREEN FOR NEW USERS ---
  const isNewUserPendingVerification = user?.status === 'pending_verification';
  if (isNewUserPendingVerification) {
    return <ActivationScreen />;
  }

  const isActiveButNoStore = user &&
    (user.status === 'active' || !user.status) &&
    !user.isSuperAdmin &&
    !user.isAnonymous &&
    storesLoaded &&
    stores.length === 0;

  if (isActiveButNoStore) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
        <div className="bg-white p-10 rounded-[3rem] shadow-2xl max-w-sm border border-slate-100">
          <div className="text-5xl mb-6">⚠️</div>
          <h2 className="text-2xl font-[1000] italic uppercase mb-2">Store Setup Incomplete</h2>
          <p className="text-slate-500 text-sm mb-8 leading-relaxed">
            Your account exists but your store wasn't set up properly. Please sign up again with your details to complete setup, or contact support if you already paid.
          </p>
          <div className="space-y-3">
            <Button
              className="w-full bg-[#A155E5] font-bold h-12 rounded-xl"
              onClick={() => signOut(getAuth()).then(() => router.push('/signup'))}
            >
              Complete Sign Up
            </Button>
            <Button
              variant="ghost"
              className="w-full text-slate-400 font-bold"
              onClick={() => signOut(getAuth()).then(() => router.push('/login'))}
            >
              Logout
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Old users who haven't verified yet - show banner instead of blocking
  const isOldUserUnverified = user && !user.emailVerified && user?.status !== 'pending_verification';

  // --- ACTUAL PRODUCT DASHBOARD UI ---
  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <div className="hidden border-r bg-background md:block">
        <DashboardSidebar isSheetOpen={isSheetOpen} closeSheet={() => setIsSheetOpen(false)} />
      </div>
      <div className="flex flex-col">
        <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild><Button variant="outline" size="icon" className="md:hidden"><Menu size={20} /></Button></SheetTrigger>
            <SheetContent side="left" className="p-0 w-[280px]"><DashboardSidebar isSheetOpen={isSheetOpen} closeSheet={() => setIsSheetOpen(false)} /></SheetContent>
          </Sheet>

          <div className="w-full flex-1">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="flex items-center gap-2">
                            <h1 className="font-bold text-lg">{activeStore?.name || 'Select a Store'}</h1>
                            <ChevronDown size={16} />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                        {stores.map(store => (
                            <DropdownMenuItem key={store.id} onClick={() => {setActiveStore(store); toast({title: `Switched to ${store.name}`})}}>{store.name}</DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
          </div>
          <div className="flex items-center gap-4 px-4">
             <Avatar className="h-8 w-8 ring-2 ring-purple-100">
                <AvatarFallback className="bg-purple-500 text-white font-bold">{(user as any)?.firstName?.charAt(0) || user?.displayName?.charAt(0) || 'A'}</AvatarFallback>
             </Avatar>
             <Button variant="ghost" size="icon" onClick={() => signOut(getAuth())}><LogOut size={18} /></Button>
          </div>
        </header>
        <main className="flex-1 p-6 overflow-y-auto bg-muted/40">
           {isOldUserUnverified && <VerifyEmailBanner user={user} />}
           {!hideBanner && isTrial && daysLeft >= 0 && (
            <div className="bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white text-center py-3 px-4 text-sm font-bold mb-6 rounded-xl shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4 border border-purple-400/30">
              <div className="flex items-center gap-3">
                <Rocket className="h-5 w-5 animate-pulse" />
                <span>
                Your {user?.subscription?.planId
  ? user.subscription.planId.charAt(0).toUpperCase() + user.subscription.planId.slice(1)
  : 'Free'} Trial is active! You have <span className="bg-white/20 px-2 py-1 rounded-md">{daysLeft} {daysLeft === 1 ? 'Day' : 'Days'}</span> remaining.
                </span>
              </div>
              <Button asChild size="sm" variant="secondary" className="whitespace-nowrap bg-white text-purple-700 hover:bg-gray-100 font-bold rounded-full">
                <Link href="/dashboard/subscription">Upgrade Plan</Link>
              </Button>
            </div>
           )}

           {/* IF THE PROMO EXPIRED AND THEY ARE ON A FREE PLAN */}
           {!hideBanner && !isTrial && promo && (!sub.planId || sub.planId === 'free' || sub.planId === 'starter') && (
            <Alert variant="destructive" className="mb-6 bg-red-50 border-red-200">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <AlertTitle className="text-red-800 font-bold text-lg">
                Your VIP AI Trial has ended.
              </AlertTitle>
              <AlertDescription className="text-red-700 mt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <p>
                  Your AI assistant has been paused and will no longer reply to customers. Upgrade to a paid plan to reactivate it immediately!
                </p>
                <Button asChild size="sm" variant="destructive" className="whitespace-nowrap rounded-full font-bold">
                  <Link href="/dashboard/subscription">Reactivate AI</Link>
                </Button>
              </AlertDescription>
            </Alert>
           )}
           {isSubscriptionExpired && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="font-bold">Subscription Expired</AlertTitle>
              <div className="flex justify-between items-center">
                <AlertDescription>
                  Your store is offline. Please renew to continue selling.
                </AlertDescription>
                <Button asChild size="sm" className="ml-4">
                  <Link href="/dashboard/subscription">Renew Plan</Link>
                </Button>
              </div>
            </Alert>
           )}
           {children}
        </main>
      </div>
      
    </div>
  );
}

    