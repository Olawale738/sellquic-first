'use client';
import React, { useEffect, useState, useMemo } from 'react';

import { useFirestore } from '@/firebase';
import { useRequireSuperAdmin } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Bot, Zap, AlertTriangle, Search, Gift, Users, CreditCard, RefreshCw, Sparkles, ShieldBan, ShieldCheck, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getAuth } from 'firebase/auth';
import { format, isPast, differenceInDays } from 'date-fns';
import { Switch } from '@/components/ui/switch';
import { AnimatedCounter } from '@/components/animated-counter';
import { managePromoAccessAction } from '@/app/actions/admin';

const MetricCard = ({ title, value, subtext }: { title: string; value: number | string; subtext: string }) => (
  <Card>
    <CardHeader className="pb-2">
      <CardDescription>{title}</CardDescription>
      <CardTitle className="text-3xl">{typeof value === 'number' ? <AnimatedCounter to={value} /> : value}</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-xs text-muted-foreground">{subtext}</p>
    </CardContent>
  </Card>
);

export default function AiManagementPage() {
  useRequireSuperAdmin();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [platformStats, setPlatformStats] = useState<any>(null);
  const [vendors, setVendors] = useState<any[]>([]);
  const [topups, setTopups] = useState<any[]>([]);
  const [totalTopUpRevenue, setTotalTopUpRevenue] = useState(0);
  const [loading, setLoading] = useState(true);

  const [isGrantDialogOpen, setIsGrantDialogOpen] = useState(false);
  const [isVipDialogOpen, setIsVipDialogOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  
  const [grantAmount, setGrantAmount] = useState('');
  const [grantReason, setGrantReason] = useState('');
  const [isGranting, setIsGranting] = useState(false);
  const [isVipActioning, setIsVipActioning] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
const [statusFilter, setStatusFilter] = useState('all');
const [visibleCount, setVisibleCount] = useState(20);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = await getAuth().currentUser?.getIdToken();
      if (!token) throw new Error('Not authenticated');
      
      const creditsRes = await fetch('/api/superadmin/ai-credits', { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      
      if (!creditsRes.ok) throw new Error('Failed to fetch credits data');
      const creditsData = await creditsRes.json();
      setPlatformStats(creditsData.platformStats);
      setVendors(creditsData.vendors);
      
      // Topups are optional — don't let them block the main data
      try {
        const topupsRes = await fetch('/api/superadmin/ai-credits/topups', { 
          headers: { Authorization: `Bearer ${token}` } 
        });
        if (topupsRes.ok) {
          const topupsData = await topupsRes.json();
          setTopups(topupsData.topups || []);
          setTotalTopUpRevenue(topupsData.totalTopUpRevenue || 0);
        }
      } catch {
        // topups failed silently
      }
      
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    setVisibleCount(20);
  }, [searchTerm, statusFilter]);

  const filteredVendors = useMemo(() => {
    return vendors.filter(v => {
      const searchMatch = v.name?.toLowerCase().includes(searchTerm.toLowerCase()) || v.email?.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!searchMatch) return false;
      if (statusFilter === 'all') return true;
      
      const percent = v.percentUsed || 0;
      const isExhausted = v.usedCredits >= v.totalCredits && v.totalCredits > 0;
      const isFree = v.planId === 'free' || v.planId === 'starter';
      
      if (statusFilter === 'ok') return !isFree && percent < 80;
      if (statusFilter === 'low') return !isFree && percent >= 80 && !isExhausted;
      if (statusFilter === 'exhausted') return !isFree && isExhausted;
      if (statusFilter === 'free') return isFree;
      
      return false;
    });
  }, [vendors, searchTerm, statusFilter]);

  const visibleVendors = useMemo(() => {
    return filteredVendors.slice(0, visibleCount);
  }, [filteredVendors, visibleCount]);

  const openGrantDialog = (vendor: any) => {
    setSelectedVendor(vendor);
    setGrantAmount('');
    setGrantReason('');
    setIsGrantDialogOpen(true);
  };

  const openVipDialog = (vendor: any) => {
    setSelectedVendor(vendor);
    setIsVipDialogOpen(true);
  };

  const handleGrantCredits = async () => {
    if (!selectedVendor || !grantAmount || !grantReason) {
      toast({ title: 'Please fill all fields', variant: 'destructive' });
      return;
    }
    setIsGranting(true);
    try {
      const token = await getAuth().currentUser?.getIdToken();
      if (!token) throw new Error('Not authenticated');

      const res = await fetch('/api/superadmin/ai-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          userId: selectedVendor.uid,
          credits: parseInt(grantAmount),
          reason: grantReason,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to grant credits.');
      }
      
      toast({ title: 'Success', description: `${grantAmount} credits granted to ${selectedVendor.name}.` });
      fetchData(); // Refresh data
      setIsGrantDialogOpen(false);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsGranting(false);
    }
  };

  const handlePromoAction = async (action: 'grant' | 'extend' | 'revoke') => {
    if (!selectedVendor) return;
    const confirmMsg = action === 'revoke' 
      ? 'Are you sure you want to REVOKE this VIP Pass immediately?' 
      : `Are you sure you want to ${action} the 14-Day VIP Pass?`;
    
    if (!confirm(confirmMsg)) return;

    setIsVipActioning(true);
    const res = await managePromoAccessAction(selectedVendor.uid, action, 14, 1000);
    
    if (res.success) {
      toast({ title: "Success!", description: res.message });
      fetchData();
      setIsVipDialogOpen(false);
    } else {
      toast({ title: "Error", description: res.message, variant: "destructive" });
    }
    setIsVipActioning(false);
  };

  const handleToggleAI = async (vendor: any, enabled: boolean) => {
    try {
      const token = await getAuth().currentUser?.getIdToken();
      if (!token) throw new Error('Not authenticated');
  
      const storeId = vendor.storeId;
      if (!storeId) {
        toast({ title: 'Error', description: 'No store found for this vendor.', variant: 'destructive' });
        return;
      }
  
      if (!firestore) return;
  
      const { doc: firestoreDoc, updateDoc: firestoreUpdate, serverTimestamp } = await import('firebase/firestore');
      await firestoreUpdate(firestoreDoc(firestore, 'stores', storeId), {
        'aiAssistant.enabled': enabled,
        'aiAssistant.updatedAt': serverTimestamp(),
      });
  
      await fetch('/api/cache/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ storeId }),
      }).catch(() => {});
  
      setVendors(prev => prev.map(v => 
        v.uid === vendor.uid ? { ...v, aiEnabled: enabled } : v
      ));
  
      toast({ 
        title: enabled ? 'AI Activated! 🚀' : 'AI Deactivated', 
        description: `AI assistant ${enabled ? 'enabled' : 'disabled'} for ${vendor.name}'s store.` 
      });
    } catch (error: any) {
      toast({ title: 'Failed to toggle AI', description: error.message, variant: 'destructive' });
    }
  };
  
  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>;

  return (
    <>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">AI Credit Management</h1>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard title="Vendors with AI" value={platformStats?.totalVendorsWithAI || 0} subtext="On paid/trial plans" />
          <MetricCard title="Credits Used (This Month)" value={(platformStats?.totalCreditsUsed || 0).toLocaleString()} subtext={`of ${(platformStats?.totalCreditsAllocated || 0).toLocaleString()}`} />
          <MetricCard title="Vendors Near Limit (>80%)" value={platformStats?.vendorsNearLimit || 0} subtext="Monitor usage" />
          <MetricCard title="Vendors Exhausted" value={platformStats?.vendorsExhausted || 0} subtext="AI assistant disabled" />
        </div>

        {/* Vendor Table */}
        <Card>
          <CardHeader>
            <CardTitle>Vendor Credit Usage</CardTitle>
            <div className="flex justify-between items-center gap-2 pt-2">
                <Input placeholder="Search name or email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="max-w-xs" />
                <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v)} className="hidden sm:block">
                  <TabsList>
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="ok">Paid (OK)</TabsTrigger>
                    <TabsTrigger value="low">Low/Exhausted</TabsTrigger>
                    <TabsTrigger value="free">Free Users</TabsTrigger>
                  </TabsList>
                </Tabs>
                <Button onClick={fetchData} variant="outline" size="icon"><RefreshCw className="h-4 w-4" /></Button>
            </div>
          </CardHeader>
          <CardContent>
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Vendor</TableHead>
        <TableHead>Store</TableHead>
        <TableHead>Plan</TableHead>
        <TableHead className="w-[200px]">Usage</TableHead>
        <TableHead>Status</TableHead>
        <TableHead className="text-right">Actions</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {visibleVendors.map(v => {
        const isExhausted = v.usedCredits >= v.totalCredits && v.totalCredits > 0;
        const isLow = v.percentUsed >= 80 && !isExhausted;
        const isFree = v.planId === 'free' || v.planId === 'starter';

        let promoBadge = null;
        const p = v.promoAccess;
        const hasActivePromo = p && !p.revokedAt && new Date(p.endsAt) > new Date();

        if (p) {
          if (p.revokedAt) {
            promoBadge = <Badge variant="destructive" className="mt-1 text-[10px]"><ShieldBan className="w-3 h-3 mr-1"/> Trial Revoked</Badge>;
          } else if (new Date(p.endsAt) < new Date()) {
            promoBadge = <Badge variant="destructive" className="mt-1 text-[10px]"><Clock className="w-3 h-3 mr-1"/> Trial Expired</Badge>;
          } else {
            const daysLeft = differenceInDays(new Date(p.endsAt), new Date());
            promoBadge = <Badge className="bg-purple-100 text-purple-700 mt-1 hover:bg-purple-200 text-[10px]"><Sparkles className="w-3 h-3 mr-1"/> {daysLeft} Days Left</Badge>;
          }
        }

        return (
          <TableRow key={v.uid} className={isFree && !hasActivePromo ? "bg-slate-50/50" : ""}>
            <TableCell>
              <div className="font-medium">{v.name}</div>
              <div className="text-xs text-muted-foreground">{v.email}</div>
            </TableCell>
            <TableCell>{v.storeName}</TableCell>
            <TableCell>
              <div className="flex flex-col items-start">
                <Badge variant={isFree ? "outline" : "secondary"} className="capitalize">{v.planId}</Badge>
                {promoBadge}
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <Progress value={v.percentUsed} className={`w-24 h-1.5 ${isFree && !hasActivePromo ? "opacity-50" : ""}`} />
                <span className="text-xs font-mono text-muted-foreground">{v.usedCredits}/{v.totalCredits}</span>
              </div>
            </TableCell>
            <TableCell>
              {isFree && !hasActivePromo ? <span className="text-xs text-slate-400">No Access</span> :
               isExhausted ? <Badge variant="destructive">Exhausted</Badge> :
               isLow ? <Badge className="bg-amber-100 text-amber-800">Low</Badge> :
               <Badge variant="outline">OK</Badge>}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">{v.aiEnabled ? 'AI On' : 'AI Off'}</span>
                  <Switch
                    checked={v.aiEnabled || false}
                    onCheckedChange={(checked) => handleToggleAI(v, checked)}
                  />
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  className="border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100"
                  onClick={() => openVipDialog(v)}
                >
                  <Sparkles className="w-4 h-4 mr-1" /> VIP Pass
                </Button>

                <Button size="sm" variant="outline" onClick={() => openGrantDialog(v)}>
                  Grant Credits
                </Button>
              </div>
            </TableCell>
          </TableRow>
        );
      })}

      {filteredVendors.length === 0 && (
        <TableRow>
          <TableCell colSpan={6} className="h-24 text-center">
            No vendors match the current filter.
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  </Table>

  {filteredVendors.length > visibleCount && (
    <div className="mt-4 flex justify-center">
      <Button
        variant="outline"
        onClick={() => setVisibleCount((prev) => prev + 20)}
      >
        Load More
      </Button>
    </div>
  )}
</CardContent>
        </Card>

        {/* Top-up History */}
        <Card>
            <CardHeader>
                <CardTitle>Recent Credit Top-Ups</CardTitle>
                <CardDescription>Total Top-Up Revenue: <span className="font-bold">GHS {totalTopUpRevenue.toFixed(2)}</span></CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader><TableRow><TableHead>Vendor</TableHead><TableHead>Amount</TableHead><TableHead>Credits</TableHead><TableHead>Date</TableHead><TableHead>Reference</TableHead></TableRow></TableHeader>
                    <TableBody>
                         {topups.length > 0 ? topups.map(t => (
                            <TableRow key={t.id}>
                                <TableCell><div className="font-medium">{t.userName}</div><div className="text-xs text-muted-foreground">{t.userEmail}</div></TableCell>
                                <TableCell className="font-semibold">GHS {t.amount.toFixed(2)}</TableCell>
                                <TableCell>{t.credits}</TableCell>
                                <TableCell>{t.paidAt ? format(new Date(typeof t.paidAt === 'string' ? t.paidAt : t.paidAt._seconds * 1000), 'PP p') : '-'}</TableCell>
                                <TableCell className="font-mono text-xs">{t.paystackReference}</TableCell>
                            </TableRow>
                        )) : (
                            <TableRow><TableCell colSpan={5} className="h-24 text-center">No top-ups have been made yet.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
      </div>

      {/* Grant Credits Dialog */}
      <Dialog open={isGrantDialogOpen} onOpenChange={setIsGrantDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant Credits to {selectedVendor?.name}</DialogTitle>
            <DialogDescription>This action will be logged.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Credits to Add</Label>
              <Input type="number" placeholder="e.g., 1000" value={grantAmount} onChange={e => setGrantAmount(e.target.value)} />
            </div>
             <div className="space-y-2">
              <Label>Reason for Grant</Label>
              <Input placeholder="e.g., Support issue" value={grantReason} onChange={e => setGrantReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsGrantDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleGrantCredits} disabled={isGranting || !grantAmount || !grantReason}>
              {isGranting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Grant Credits
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* VIP PROMO DIALOG */}
      <Dialog open={isVipDialogOpen} onOpenChange={setIsVipDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-purple-600"/> VIP Trial Management</DialogTitle>
            <DialogDescription>Manage the 14-Day VIP Pass for {selectedVendor?.name}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {!selectedVendor?.promoAccess || selectedVendor?.promoAccess?.revokedAt || new Date(selectedVendor?.promoAccess?.endsAt) < new Date() ? (
              <div className="text-center space-y-4 py-6">
                <p className="text-sm text-muted-foreground">This user does not currently have an active VIP Trial.</p>
                <Button className="w-full bg-purple-600 hover:bg-purple-700" onClick={() => handlePromoAction('grant')} disabled={isVipActioning}>
                  {isVipActioning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                  Grant 14-Day VIP Trial (+1000 Credits)
                </Button>
              </div>
            ) : (
              <div className="space-y-4 py-2">
                <div className="bg-purple-50 border border-purple-100 p-4 rounded-lg text-center">
                  <p className="text-sm font-semibold text-purple-800">VIP Pass is currently Active!</p>
                  <p className="text-xs text-purple-600 mt-1">Expires: {format(new Date(selectedVendor.promoAccess.endsAt), 'PPP p')}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Button variant="outline" className="w-full" onClick={() => handlePromoAction('extend')} disabled={isVipActioning}>
                    {isVipActioning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clock className="mr-2 h-4 w-4" />}
                    Extend by 14 Days
                  </Button>
                  <Button variant="destructive" className="w-full" onClick={() => handlePromoAction('revoke')} disabled={isVipActioning}>
                    {isVipActioning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldBan className="mr-2 h-4 w-4" />}
                    Revoke Pass Now
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}