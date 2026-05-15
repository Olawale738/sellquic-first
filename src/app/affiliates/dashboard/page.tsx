
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Copy, Wallet, Users, Check, Clock, ExternalLink, Share2, HelpCircle, Loader2, Edit, Save } from 'lucide-react';
import { FaWhatsapp, FaFacebook, FaInstagram } from 'react-icons/fa';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { collection, query, onSnapshot, DocumentData, doc, updateDoc } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { getAuth } from 'firebase/auth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface Referral extends DocumentData {
    id: string;
    userName: string;
    isPro: boolean;
    createdAt: { seconds: number };
    status: 'pending' | 'paid' | 'available';
    planId?: string;
    amount?: number;
}

interface AffiliateData extends DocumentData {
    clicks?: number;
}

export default function AffiliateDashboard() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const firestore = useFirestore();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [requestingPayout, setRequestingPayout] = useState(false);
  const [affiliateData, setAffiliateData] = useState<AffiliateData | null>(null);

  const [isEditingPayout, setIsEditingPayout] = useState(!user?.payoutInfo);
  const [payoutDetails, setPayoutDetails] = useState({
    network: user?.payoutInfo?.network || '',
    momoNumber: user?.payoutInfo?.momoNumber || '',
    accountName: user?.payoutInfo?.accountName || '',
  });
  const [isSavingPayout, setIsSavingPayout] = useState(false);

  const affiliateLink = `https://sellquic.com/signup?ref=${user?.referralCode}`;
  const shareMessage = `SellQuic gives you your own branded online store — like a simple website, but very affordable.\n\nYou can share your store link on WhatsApp, Instagram and Facebook so customers see everything before chatting you.\n\nCheck it out here:\n👉 ${affiliateLink}\n\nNew sellers get ₵10 off their subscription.`;

  useEffect(() => {
    if (!user || !firestore) return;
    
    const referralsQuery = query(collection(firestore, 'users', user.uid, 'referrals'));
    const unsubReferrals = onSnapshot(referralsQuery, (snapshot) => {
        const referralData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Referral));
        setReferrals(referralData);
    });

    const userDocRef = doc(firestore, 'users', user.uid);
    const unsubUser = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setAffiliateData({ clicks: data.clicks || 0 });
        if(data.payoutInfo) {
            setPayoutDetails(data.payoutInfo);
            setIsEditingPayout(false);
        }
      }
    });

    return () => {
        unsubReferrals();
        unsubUser();
    };
  }, [user, firestore]);

  const stats = useMemo(() => {
    const successfulSubscriptions = referrals.filter(r => r.isPro).length;
    const pendingSubscriptions = referrals.filter(r => !r.isPro).length;
    const totalEarned = (user?.affiliateWallet?.available || 0) + (user?.affiliateWallet?.paid || 0);

    return {
        linkClicks: affiliateData?.clicks || 0,
        successfulSubscriptions,
        pendingSubscriptions,
        totalEarned,
    };
  }, [referrals, user, affiliateData]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard!' });
  };

  const handleSavePayoutDetails = async () => {
    if (!firestore || !user) return;
    if(!payoutDetails.network || !payoutDetails.momoNumber || !payoutDetails.accountName) {
        toast({ title: "All fields are required.", variant: 'destructive'});
        return;
    }
    setIsSavingPayout(true);
    try {
        const userRef = doc(firestore, 'users', user.uid);
        await updateDoc(userRef, {
            payoutInfo: payoutDetails
        });
        toast({ title: 'Payout details saved!' });
        await refreshUser();
        setIsEditingPayout(false);
    } catch (error) {
        toast({ title: 'Error saving details', variant: 'destructive' });
    } finally {
        setIsSavingPayout(false);
    }
  };

  const handleRequestPayout = async () => {
    if (!user) return;
    
    if (!user.payoutInfo) {
        toast({
            title: "Setup Required",
            description: "Please set up your payout details before requesting a payout.",
            variant: "destructive"
        });
        return;
    }

    const availableBalance = user.affiliateWallet?.available || 0;
    if (availableBalance < 60) {
        toast({
            title: "Minimum Not Met",
            description: "You need at least GH₵60 available to request a payout.",
            variant: "destructive"
        });
        return;
    }
    
    setRequestingPayout(true);
    try {
        const auth = getAuth();
        const idToken = await auth.currentUser?.getIdToken();

        const response = await fetch('/api/affiliates/request-payout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
            body: JSON.stringify({ amount: availableBalance })
        });
        
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to submit request.');

        toast({
            title: "Request Submitted!",
            description: "Your payout request has been sent for processing."
        });

    } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
        setRequestingPayout(false);
    }
  };
  
  const isSeller = user?.role !== 'affiliate';
  const hasPendingPayout = (user?.affiliateWallet?.pendingPayout || 0) > 0;

  return (
    <div className="container py-8 px-4 space-y-8">
        <div className="space-y-2">
            <h1 className="text-3xl font-bold">👋 Welcome, {(user as any)?.firstName || 'Affiliate'}</h1>
            <p className="text-muted-foreground max-w-2xl">Earn up to 30% commission for every online seller you refer who subscribes to a paid SellQuic plan.</p>
        </div>

        <Card className="bg-white border-blue-200 shadow-sm">
            <CardHeader>
                <CardTitle>🔗 Your Affiliate Link</CardTitle>
                <CardDescription>This is how you earn. Affiliates are tracked only through this link.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col sm:flex-row gap-2">
                    <Input value={affiliateLink} readOnly className="font-mono bg-gray-50 flex-grow" />
                    <Button onClick={() => copyToClipboard(affiliateLink)} size="icon" variant="outline" className="hidden sm:flex"><Copy className="h-4 w-4" /></Button>
                </div>
                 <div className="mt-4 flex flex-wrap gap-2">
                     <Button onClick={() => copyToClipboard(affiliateLink)} size="sm"><Copy className="h-4 w-4 mr-2" /> Copy Link</Button>
                    <Button asChild variant="outline" size="sm" className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100">
                        <a href={`https://wa.me/?text=${encodeURIComponent(shareMessage)}`} target="_blank" rel="noopener noreferrer"><FaWhatsapp className="h-4 w-4 mr-2" /> Share on WhatsApp</a>
                    </Button>
                </div>
            </CardContent>
        </Card>
        
        <div className="grid lg:grid-cols-2 gap-8">
            <div className="space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle>💼 Affiliate Wallet</CardTitle>
                        <CardDescription>Your earnings summary.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                         <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                            <div><p className="text-sm text-muted-foreground">Available</p><p className="text-3xl font-bold text-green-600">GH₵{(user?.affiliateWallet?.available || 0).toFixed(2)}</p></div>
                            <div><p className="text-sm text-muted-foreground">Pending</p><p className="text-3xl font-bold">GH₵{(user?.affiliateWallet?.pending || 0).toFixed(2)}</p></div>
                            <div><p className="text-sm text-muted-foreground">Payouts</p><p className="text-3xl font-bold text-blue-600">GH₵{(user?.affiliateWallet?.paid || 0).toFixed(2)}</p></div>
                        </div>
                        <p className="text-xs text-center text-muted-foreground pt-2 border-t"><span className="font-semibold">Pending</span> means the seller hasn't completed payment. Once confirmed, it moves to Available.</p>
                    </CardContent>
                </Card>

                 <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Payout Details</CardTitle>
                                <CardDescription>How you'll receive your commissions.</CardDescription>
                            </div>
                            {!isEditingPayout && user?.payoutInfo && (
                                <Button variant="outline" size="sm" onClick={() => setIsEditingPayout(true)}><Edit className="h-3 w-3 mr-2" /> Edit</Button>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        {isEditingPayout ? (
                             <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>MoMo Network</Label>
                                    <Select value={payoutDetails.network} onValueChange={(value) => setPayoutDetails(prev => ({...prev, network: value}))}>
                                        <SelectTrigger><SelectValue placeholder="Select network" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="MTN Mobile Money">MTN Mobile Money</SelectItem>
                                            <SelectItem value="Telecel Cash">Telecel Cash</SelectItem>
                                            <SelectItem value="AT Money">AT Money</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>MoMo Number</Label>
                                    <Input value={payoutDetails.momoNumber} onChange={(e) => setPayoutDetails(prev => ({...prev, momoNumber: e.target.value}))} placeholder="024..." />
                                </div>
                                 <div className="space-y-2">
                                    <Label>Account Name</Label>
                                    <Input value={payoutDetails.accountName} onChange={(e) => setPayoutDetails(prev => ({...prev, accountName: e.target.value}))} placeholder="Official name on MoMo account" />
                                </div>
                                <div className="flex gap-2">
                                    <Button onClick={handleSavePayoutDetails} disabled={isSavingPayout}>
                                        {isSavingPayout && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Save Details
                                    </Button>
                                    {user?.payoutInfo && (
                                        <Button variant="ghost" onClick={() => setIsEditingPayout(false)}>Cancel</Button>
                                    )}
                                </div>
                            </div>
                        ) : (
                             <div className="space-y-2 bg-muted p-4 rounded-md border">
                                <p className="text-sm"><strong className="text-muted-foreground">Network:</strong> {user?.payoutInfo?.network}</p>
                                <p className="text-sm"><strong className="text-muted-foreground">Number:</strong> {user?.payoutInfo?.momoNumber}</p>
                                <p className="text-sm"><strong className="text-muted-foreground">Name:</strong> {user?.payoutInfo?.accountName}</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                 <Card>
                    <CardHeader>
                        <CardTitle>💵 Cash Out / Use Credit</CardTitle>
                         {hasPendingPayout && (
                            <CardDescription className="text-yellow-600 font-semibold pt-2">You have a pending payout of GHS {(user?.affiliateWallet?.pendingPayout || 0).toFixed(2)}. It will be processed shortly.</CardDescription>
                         )}
                    </CardHeader>
                    <CardContent>
                        {isSeller ? (
                            <div className="space-y-4">
                               <Button size="lg" className="w-full" disabled>Use as Subscription Credit (Coming Soon)</Button>
                               <Button onClick={handleRequestPayout} size="lg" variant="outline" className="w-full" disabled={requestingPayout || hasPendingPayout || !user?.payoutInfo}>
                                    {requestingPayout && <Loader2 className="h-4 w-4 mr-2 animate-spin"/>} Request Cash Payout
                               </Button>
                               <p className="text-xs text-center text-muted-foreground">Credit reduces your next subscription. Cashouts are processed weekly.</p>
                            </div>
                        ) : (
                             <div className="space-y-2">
                                <Button onClick={handleRequestPayout} size="lg" className="w-full" disabled={requestingPayout || hasPendingPayout || !user?.payoutInfo}>
                                     {requestingPayout && <Loader2 className="h-4 w-4 mr-2 animate-spin"/>} Cash Out to MoMo
                                </Button>
                                <p className="text-xs text-center text-muted-foreground">Minimum cash out: ₵60. Cash outs are processed weekly.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>📢 Share This Message</CardTitle></CardHeader>
                    <CardContent>
                        <div className="bg-muted p-4 rounded-md text-sm border">
                            <p>{shareMessage.split('👉')[0]}</p>
                            <p className="font-bold my-2">👉 {affiliateLink}</p>
                            <p>{shareMessage.split('👉')[1]?.split('\n').pop()}</p>
                        </div>
                        <Button className="mt-4 w-full" onClick={() => copyToClipboard(shareMessage)}><Copy className="h-4 w-4 mr-2" /> Copy Message</Button>
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-8">
                <Card>
                    <CardHeader><CardTitle>📊 Your Performance</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4">
                        <div className="bg-muted/50 p-4 rounded-lg"><p className="text-sm text-muted-foreground">Link Clicks</p><p className="text-2xl font-bold">{stats.linkClicks}</p></div>
                        <div className="bg-muted/50 p-4 rounded-lg"><p className="text-sm text-muted-foreground">Successful Subscriptions</p><p className="text-2xl font-bold">{stats.successfulSubscriptions}</p></div>
                        <div className="bg-muted/50 p-4 rounded-lg"><p className="text-sm text-muted-foreground">Pending Subscriptions</p><p className="text-2xl font-bold">{stats.pendingSubscriptions}</p></div>
                        <div className="bg-muted/50 p-4 rounded-lg"><p className="text-sm text-muted-foreground">Total Earned</p><p className="text-2xl font-bold">GH₵{stats.totalEarned.toFixed(2)}</p></div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>📜 Earnings History</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Seller</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {referrals.length === 0 ? (
                                    <TableRow><TableCell colSpan={4} className="h-24 text-center">No earnings yet.</TableCell></TableRow>
                                ) : (
                                    referrals.map((ref) => (
                                        <TableRow key={ref.id}>
                                            <TableCell className="text-xs">{ref.createdAt ? format(new Date(ref.createdAt.seconds * 1000), 'd MMM') : ''}</TableCell>
                                            <TableCell className="font-medium">{ref.userName || 'Unknown'}</TableCell>
                                            <TableCell><Badge variant={ref.status === 'paid' ? 'default' : (ref.status === 'available' ? 'secondary' : 'destructive')} className="capitalize">{ref.status || 'pending'}</Badge></TableCell>
                                            <TableCell className="text-right font-bold">GH₵{(ref.amount || 0).toFixed(2)}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                         <p className="text-xs text-muted-foreground mt-4"><strong>Pending:</strong> seller hasn't paid yet. | <strong>Available:</strong> ready for cash out/credit. | <strong>Paid:</strong> already settled.</p>
                    </CardContent>
                </Card>

                <div className="space-y-4 text-sm text-muted-foreground border-t pt-6">
                    <p><strong>🎁 Bonus for Sellers You Refer:</strong> Sellers who join using your affiliate link get ₵10 off their subscription.</p>
                     <p><strong>❓ Need Help?</strong> Chat with SellQuic Support on <a href="https://instagram.com/sellquic" target="_blank" rel="noopener noreferrer" className="font-bold underline text-primary">Instagram</a> or email: <a href="mailto:hello@sellquic.com" className="font-bold underline text-primary">hello@sellquic.com</a></p>
                </div>
            </div>
        </div>
    </div>
  );
}

    