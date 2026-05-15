
'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { hasCommerceAccess } from '@/lib/subscription-access';
import { useToast } from '@/hooks/use-toast';
import { Copy, Loader2, Gift, Star, AlertCircle, Sparkles, Medal, Award, Crown } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { doc, updateDoc, writeBatch } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';


const RewardCard = ({ icon: Icon, title, description, points, action, disabled, isRedeemed, onRedeem }: {
    icon: React.ElementType;
    title: string;
    description: string;
    points: number;
    action: string;
    disabled: boolean;
    isRedeemed?: boolean;
    onRedeem?: () => void;
}) => (
    <div className="animated-border-card">
        <Card className="flex flex-col h-full">
            <CardHeader className="text-center">
                <Icon className="h-10 w-10 mx-auto text-primary" />
                <CardTitle className="mt-2 text-lg">{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow text-center">
                <p className="text-3xl font-bold">{points} <span className="text-base text-muted-foreground">points</span></p>
            </CardContent>
            <CardFooter>
                 {onRedeem ? (
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                             <Button className="w-full" disabled={disabled || isRedeemed}>
                                {isRedeemed ? 'Redeemed' : action}
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                             <AlertDialogHeader>
                                <AlertDialogTitle>Confirm Redemption</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Are you sure you want to redeem {points} points for a {title}? This will be applied to your next renewal.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={onRedeem}>Yes, Redeem Now</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                ) : (
                    <Button className="w-full" disabled={disabled}>{action}</Button>
                )}
            </CardFooter>
        </Card>
    </div>
);


export default function ReferralsPage() {
    const { user, loading: authLoading, proReferralCount, referralPoints, refreshUser } = useAuth();
    const { toast } = useToast();
    const firestore = useFirestore();
    const [isRedeeming, setIsRedeeming] = useState(false);

    const handleCopyCode = () => {
        if (!user?.referralCode) return;
        navigator.clipboard.writeText(user.referralCode);
        toast({ title: 'Referral Code Copied!' });
    };

    const handleRedeemDiscount = async () => {
        if (!user || !firestore || (referralPoints ?? 0) < 50) return;

        setIsRedeeming(true);
        try {
            const userRef = doc(firestore, 'users', user.uid);
            await updateDoc(userRef, {
                referralPoints: (referralPoints ?? 0) - 50,
                used20PercentDiscount: true 
            });
            await refreshUser();
            toast({
                title: "Discount Redeemed!",
                description: "A 20% discount will be applied to your next renewal."
            });
        } catch (error) {
            console.error("Error redeeming discount:", error);
            toast({ title: "Redemption Failed", variant: "destructive" });
        } finally {
            setIsRedeeming(false);
        }
    };

    if (authLoading || !user?.subscription) {
        return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }
    
    const isFreePlan = !hasCommerceAccess(user?.subscription);
    const referralCode = user.referralCode;
    const hasRedeemed20Percent = (user as any)?.used20PercentDiscount;
    const currentPoints = referralPoints || 0;
    const currentProReferrals = proReferralCount || 0;


    if (isFreePlan) {
        return (
             <Alert className="max-w-xl mx-auto bg-primary/10 border-primary/20 text-primary-foreground">
                <AlertCircle className="h-4 w-4 text-primary" />
                <AlertTitle className="text-primary">Upgrade to Unlock Referrals</AlertTitle>
                <AlertDescription className="text-primary/90">
                The referral program is an exclusive feature for our paying vendors. Upgrade your plan to start earning rewards for referring other sellers.
                </AlertDescription>
                <div className="mt-4">
                    <Button asChild>
                        <Link href="/dashboard/subscription">
                            <Star className="mr-2 h-4 w-4" />
                            View Plans & Upgrade
                        </Link>
                    </Button>
                </div>
            </Alert>
        )
    }

    return (
        <div className="space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Gift className="h-6 w-6"/> Your Referral Program</CardTitle>
                    <CardDescription>Share your unique code. When a new vendor signs up using your code and subscribes to a paid plan, you earn 10 points. Every 100 points equals one free month.</CardDescription>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-6 items-center">
                     <div>
                        <p className="text-sm font-medium text-muted-foreground mb-2">Your Unique Referral Code</p>
                         {referralCode ? (
                            <div className="flex w-full items-center space-x-2">
                                <Input type="text" value={referralCode} readOnly className="font-mono text-lg tracking-widest"/>
                                <Button type="button" size="icon" onClick={handleCopyCode}>
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </div>
                        ) : (
                             <p className="text-muted-foreground">Your referral code is being generated. Please check back shortly.</p>
                        )}
                    </div>
                     <div className="text-center bg-muted/50 p-4 rounded-lg">
                        <p className="text-sm font-medium text-muted-foreground">Total Paid Referrals</p>
                        <p className="text-5xl font-bold">{currentProReferrals}</p>
                        <p className="text-sm font-medium text-muted-foreground mt-2">Current Points</p>
                        <p className="text-3xl font-bold flex items-center justify-center gap-2 text-primary">
                            <Sparkles className="h-6 w-6" /> {currentPoints}
                        </p>
                    </div>
                </CardContent>
            </Card>

            <div>
                 <h2 className="text-2xl font-bold tracking-tight mb-4">Available Rewards</h2>
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <RewardCard 
                        icon={Medal}
                        title="20% Discount"
                        description="Redeem for a 20% discount on your next renewal."
                        points={50}
                        action="Redeem"
                        disabled={currentPoints < 50 || isRedeeming}
                        isRedeemed={hasRedeemed20Percent}
                        onRedeem={handleRedeemDiscount}
                    />
                    <RewardCard 
                        icon={Award}
                        title="1 Free Month"
                        description="Auto-applied on renewal. Max 2 free months per year."
                        points={100}
                        action="Auto-Applied"
                        disabled={true}
                    />
                    <RewardCard 
                        icon={Crown}
                        title="2 Free Months"
                        description="Auto-applied on renewal. Extra points carry over."
                        points={200}
                        action="Auto-Applied"
                        disabled={true}
                    />
                </div>
            </div>
        </div>
    );
}
