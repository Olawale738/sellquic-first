'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot, DocumentData, Timestamp, doc, updateDoc, deleteDoc, writeBatch, getDocs, query, where } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { hasCommerceAccess } from '@/lib/subscription-access';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

import { format, formatDistanceToNow, addMonths } from 'date-fns';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Trash2, Ban, CheckCircle, Star, Download, UserCog, Loader2, ExternalLink, PenSquare } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from '@/components/ui/dropdown-menu';
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { useRequireSuperAdmin } from '@/hooks/use-auth';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAuth, signInWithCustomToken } from 'firebase/auth';
import { useAdminLog } from '@/hooks/use-admin-log';

interface Vendor extends DocumentData {
  uid: string;
  displayName: string;
  email: string;
  subdomain: string; 
  customDomain?: string;
  createdAt: Timestamp;
  status?: 'active' | 'suspended';
  subscription?: { planId: string; status?: string; };
  isBetaTester?: boolean;
  phone?: string;
  stores?: { id: string; subdomain?: string; customDomain?: string; }[];
  role?: 'vendor' | 'affiliate';
}

const getInitials = (name: string) => {
    return name?.charAt(0).toUpperCase() || 'V';
};

const planPrices: Record<string, Record<string, number>> = {
  starter: { monthly: 10000, quarterly: 27000 },
  growth: { monthly: 20000, quarterly: 54000 },
  business: { monthly: 60000, quarterly: 162000 },
};

const getPlanLabel = (planId: string | undefined): string => {
  const labels: Record<string, string> = {
    starter: 'Standard',
    growth: 'Growth',
    business: 'Business',
    none: 'None',
    free: 'None',
  };
  return labels[planId || 'none'] || planId || 'None';
};

export default function VendorManagementPage() {
  const { user, loading: authLoading } = useRequireSuperAdmin();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [planFilter, setPlanFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isImpersonating, setIsImpersonating] = useState<string | null>(null);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [newSubdomain, setNewSubdomain] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const { toast } = useToast();
  const firestore = useFirestore();
  const { log } = useAdminLog();


  useEffect(() => {
    if (!firestore) return;

    const usersUnsub = onSnapshot(collection(firestore, 'users'), async (userSnapshot) => {
        const usersData = userSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as Vendor));
        const storesSnapshot = await getDocs(collection(firestore, 'stores'));
        const storesData = storesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const vendorsWithStores = usersData.map(vendor => {
            const vendorStores = storesData.filter((store: any) => store.sellerId === vendor.uid);
            return {
                ...vendor,
                stores: vendorStores.map((s: any) => ({ id: s.id, subdomain: s.subdomain || '', customDomain: s.customDomain || '' }))
            };
        });

        vendorsWithStores.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
        setVendors(vendorsWithStores);
        setLoading(false);
    });

    return () => usersUnsub();
  }, [firestore]);


  const filteredVendors = useMemo(() => {
    return vendors.filter(vendor => {
        if (vendor.role === 'affiliate') return false;

        const vendorPlan = vendor.subscription?.planId || 'none';
        const planMatch = planFilter === 'all' || vendorPlan === planFilter;
        const statusMatch = statusFilter === 'all' || (vendor.status || 'active') === statusFilter;
        const normalizedSearch = searchTerm.toLowerCase().trim();
const normalizedPhoneSearch = searchTerm.replace(/\D/g, '');

const primaryStore = vendor.stores?.[0];
const subdomain = primaryStore?.subdomain?.toLowerCase() || '';
const customDomain = primaryStore?.customDomain?.toLowerCase() || '';

const matchesName =
  !!normalizedSearch &&
  !!vendor.displayName &&
  vendor.displayName.toLowerCase().includes(normalizedSearch);

const matchesEmail =
  !!normalizedSearch &&
  !!vendor.email &&
  vendor.email.toLowerCase().includes(normalizedSearch);

const matchesStore =
  !!normalizedSearch &&
  (subdomain.includes(normalizedSearch) || customDomain.includes(normalizedSearch));

const matchesPhone =
  normalizedPhoneSearch.length > 0 &&
  !!vendor.phone &&
  vendor.phone.replace(/\D/g, '').includes(normalizedPhoneSearch);

const searchMatch =
  normalizedSearch === '' ? true : (matchesName || matchesEmail || matchesStore || matchesPhone);
        return planMatch && statusMatch && searchMatch;
    });
  }, [vendors, planFilter, statusFilter, searchTerm]);

  const handleExport = () => {
    if (filteredVendors.length === 0) {
        toast({ title: "No data to export", variant: "destructive" });
        return;
    }
    const headers = ["Business Name", "Store Link", "Phone Number"];
    const csvContent = [
        headers.join(','),
        ...filteredVendors.map(vendor => {
            const firstStore = vendor.stores?.[0];
            const storeUrl = firstStore ? `https://${firstStore.customDomain || `${firstStore.subdomain}.sellquic.com`}` : '#';
            return [`"${(vendor.displayName || '').replace(/"/g, '""')}"`, storeUrl, vendor.phone || ''].join(',');
        })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `vendors-export-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
    const handleImpersonate = async (vendor: Vendor) => {
        if (!user) return;
        setIsImpersonating(vendor.uid);
        try {
            const auth = getAuth();
            const idToken = await auth.currentUser?.getIdToken(true);

            const response = await fetch('/api/superadmin/impersonate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                body: JSON.stringify({ targetUserId: vendor.uid })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to get impersonation token.');
            }

            const { token } = await response.json();
            await signInWithCustomToken(auth, token);
            await log({ action: 'vendor.impersonate', targetId: vendor.uid, targetName: vendor.displayName, targetEmail: vendor.email });
            toast({ title: 'Impersonation Successful', description: `Logging in as ${vendor.displayName}...` });
            window.open('/dashboard', '_blank');

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
            toast({ title: 'Impersonation Failed', description: errorMessage, variant: "destructive" });
        } finally {
            setIsImpersonating(null);
        }
    };


  const handleStatusChange = async (vendor: Vendor, newStatus: 'active' | 'suspended') => {
    if (!firestore) return;
    const vendorRef = doc(firestore, 'users', vendor.uid);
    try {
        await updateDoc(vendorRef, { status: newStatus });
        await log({ 
          action: newStatus === 'active' ? 'vendor.activate' : 'vendor.suspend', 
          targetId: vendor.uid, 
          targetName: vendor.displayName, 
          targetEmail: vendor.email 
        });
        toast({ title: `Vendor ${newStatus === 'active' ? 'Activated' : 'Suspended'}` });
    } catch (error) {
        toast({ title: "Update Failed", variant: "destructive" });
    }
  };
  
  const handlePlanChange = async (vendor: Vendor, planId: 'starter' | 'standard' | 'growth' | 'free', billingCycle: 'monthly' | 'quarterly' | null) => {
    if (!firestore) return;
    const vendorRef = doc(firestore, 'users', vendor.uid);
    const batch = writeBatch(firestore);

    try {
        let subscriptionData;
        let amount = 0;
        let durationMonths = 0;

        if (planId !== 'free' && billingCycle) {
            durationMonths = billingCycle === 'quarterly' ? 3 : 1;
            amount = planPrices[planId]?.[billingCycle] || 0;
            subscriptionData = {
                planId: planId,
                status: 'active',
                startDate: new Date(),
                endDate: addMonths(new Date(), durationMonths),
                billingCycle: billingCycle,
            };
        } else {
             subscriptionData = {
                planId: 'none',
                status: 'inactive',
                startDate: new Date(),
                endDate: null,
            };
        }

        batch.update(vendorRef, { subscription: subscriptionData, isBetaTester: planId !== 'free' ? vendor.isBetaTester : false });
        
        if (planId !== 'free') {
            const transactionRef = doc(collection(firestore, "transactions"));
            batch.set(transactionRef, {
                userId: vendor.uid,
                planId: planId,
                amount: amount,
                type: 'manual_upgrade',
                source: 'admin',
                createdAt: new Date(),
                status: 'completed',
                userEmail: vendor.email,
                userName: vendor.displayName,
            });
        }
        await batch.commit();
        await log({ action: 'vendor.plan_change', targetId: vendor.uid, targetName: vendor.displayName, targetEmail: vendor.email, before: { plan: vendor.subscription?.planId || 'none' }, after: { plan: planId, billingCycle } });
        toast({ title: `Plan Changed to ${getPlanLabel(planId)}` });
    } catch (error) {
        toast({ title: "Plan Change Failed", variant: "destructive" });
    }
  };

  const handleDeleteVendor = async (vendor: Vendor) => {
    if (!firestore) return;
    try {
        const batch = writeBatch(firestore);
        
        const storesQuery = query(collection(firestore, "stores"), where("sellerId", "==", vendor.uid));
        const storesSnapshot = await getDocs(storesQuery);
        for (const storeDoc of storesSnapshot.docs) {
            const storeId = storeDoc.id;
            const productsQuery = query(collection(firestore, "products"), where("storeId", "==", storeId));
            const productsSnapshot = await getDocs(productsQuery);
            productsSnapshot.forEach(doc => batch.delete(doc.ref));

            const ordersQuery = query(collection(firestore, "orders"), where("storeId", "==", storeId));
            const ordersSnapshot = await getDocs(ordersQuery);
            ordersSnapshot.forEach(doc => batch.delete(doc.ref));
            
            batch.delete(storeDoc.ref);
        }

        const userRef = doc(firestore, 'users', vendor.uid);
        batch.delete(userRef);
        
        await batch.commit();

        await log({ action: 'vendor.delete', targetId: vendor.uid, targetName: vendor.displayName, targetEmail: vendor.email });

        toast({
            title: "Vendor Deleted",
            description: `"${vendor.displayName}" and all their data have been permanently removed.`,
        });
    } catch (error) {
        console.error("Error deleting vendor and their data:", error);
        toast({ title: "Deletion Failed", variant: "destructive" });
    }
  };
  
    const handleUpdateSubdomain = async () => {
        if (!editingVendor || !newSubdomain.trim() || !firestore) return;
        
        const storeId = editingVendor.stores?.[0]?.id;
        if (!storeId) {
            toast({ title: 'Error', description: 'Store ID not found for this vendor.', variant: 'destructive' });
            return;
        }

        setIsUpdating(true);
        try {
            const auth = getAuth();
            const idToken = await auth.currentUser?.getIdToken();

            const response = await fetch('/api/superadmin/vendors/update-subdomain', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                body: JSON.stringify({ storeId, newSubdomain: newSubdomain.trim() }),
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Failed to update subdomain');

            await log({ action: 'vendor.subdomain_change', targetId: storeId, targetName: editingVendor.displayName || '', before: { subdomain: editingVendor.stores?.[0]?.subdomain }, after: { subdomain: newSubdomain } });
            toast({ title: 'Subdomain Updated!', description: `The new link is ${result.sanitizedSubdomain}.sellquic.com` });
            setIsDialogOpen(false);
            setEditingVendor(null);
        } catch (error: any) {
            toast({ title: 'Update Failed', description: error.message, variant: 'destructive' });
        } finally {
            setIsUpdating(false);
        }
    };

  if (loading || authLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>Vendor Management</CardTitle>
        <CardDescription>View, manage, and impersonate all vendors on the platform.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <Input 
                placeholder="Search by business name, email, store link or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
            />
            <div className="flex gap-2">
                <Select value={planFilter} onValueChange={setPlanFilter}>
                  <SelectTrigger className="w-[140px]"><SelectValue placeholder="Plan" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Plans</SelectItem>
                    <SelectItem value="none">No Plan</SelectItem>
                    <SelectItem value="starter">Standard</SelectItem>
                    <SelectItem value="growth">Growth</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={handleExport} className="sm:ml-auto"><Download className="mr-2 h-4 w-4"/> Export</Button>
            </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendor</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredVendors.map(vendor => (
              <TableRow key={vendor.uid}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9"><AvatarFallback className="bg-secondary text-secondary-foreground">{getInitials(vendor.displayName)}</AvatarFallback></Avatar>
                    <div>
                      <p className="font-medium leading-none">{vendor.displayName}</p>
                      <a 
                        href={`https://${vendor.stores?.[0]?.customDomain || `${vendor.stores?.[0]?.subdomain}.sellquic.com`}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground hover:underline flex items-center gap-1"
                      >
                        @{vendor.stores?.[0]?.subdomain} <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={vendor.subscription?.planId && vendor.subscription.planId !== 'none' ? 'default' : 'secondary'} className="capitalize">
                    {vendor.isBetaTester && <Star className="h-3 w-3 mr-1.5" />}
                    {getPlanLabel(vendor.subscription?.planId)}
                  </Badge>
                </TableCell>
                <TableCell><Badge variant={vendor.status === 'suspended' ? 'destructive' : 'default'} className="capitalize">{vendor.status || 'active'}</Badge></TableCell>
                <TableCell>{vendor.createdAt ? formatDistanceToNow(vendor.createdAt.toDate(), { addSuffix: true }) : 'N/A'}</TableCell>
                <TableCell className="text-right">
                    <AlertDialog>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" disabled={isImpersonating === vendor.uid}>
                                {isImpersonating === vendor.uid ? <Loader2 className="h-4 w-4 animate-spin"/> : <MoreHorizontal className="h-4 w-4" />}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {vendor.stores && vendor.stores.length > 0 && (
                                  <DropdownMenuItem asChild>
                                    <a href={`https://${vendor.stores[0].customDomain || `${vendor.stores[0].subdomain}.sellquic.com`}`} target="_blank" rel="noopener noreferrer" className="flex items-center w-full">
                                      <ExternalLink className="mr-2 h-4 w-4" /> View Store
                                    </a>
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => handleImpersonate(vendor)}>
                                  <UserCog className="mr-2 h-4 w-4" /> Impersonate
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setEditingVendor(vendor); setNewSubdomain(vendor.stores?.[0]?.subdomain || ''); setIsDialogOpen(true); }}>
                                  <PenSquare className="mr-2 h-4 w-4" /> Change Subdomain
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                
                                {/* Change Plan */}
                                <DropdownMenuSub>
                                  <DropdownMenuSubTrigger><Star className="mr-2 h-4 w-4" /><span>Change Plan</span></DropdownMenuSubTrigger>
                                  <DropdownMenuPortal>
                                    <DropdownMenuSubContent>
                                      <DropdownMenuSub>
                                      <DropdownMenuSubTrigger disabled={vendor.subscription?.planId === 'standard'}>Standard</DropdownMenuSubTrigger>
                                        <DropdownMenuPortal>
                                          <DropdownMenuSubContent>
                                            <DropdownMenuItem onClick={() => handlePlanChange(vendor, 'standard', 'monthly')}>Monthly</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handlePlanChange(vendor, 'standard', 'quarterly')}>Quarterly</DropdownMenuItem>
                                          </DropdownMenuSubContent>
                                        </DropdownMenuPortal>
                                      </DropdownMenuSub>
                                      <DropdownMenuSub>
                                        <DropdownMenuSubTrigger disabled={vendor.subscription?.planId === 'growth'}>Growth</DropdownMenuSubTrigger>
                                        <DropdownMenuPortal>
                                          <DropdownMenuSubContent>
                                            <DropdownMenuItem onClick={() => handlePlanChange(vendor, 'growth', 'monthly')}>Monthly</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handlePlanChange(vendor, 'growth', 'quarterly')}>Quarterly</DropdownMenuItem>
                                          </DropdownMenuSubContent>
                                        </DropdownMenuPortal>
                                      </DropdownMenuSub>
                                      <DropdownMenuSub>
                                        <DropdownMenuSubTrigger disabled={vendor.subscription?.planId === 'starter'}>Standard</DropdownMenuSubTrigger>
                                        <DropdownMenuPortal>
                                          <DropdownMenuSubContent>
                                            <DropdownMenuItem onClick={() => handlePlanChange(vendor, 'starter', 'monthly')}>Monthly</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handlePlanChange(vendor, 'starter', 'quarterly')}>Quarterly</DropdownMenuItem>
                                          </DropdownMenuSubContent>
                                        </DropdownMenuPortal>
                                      </DropdownMenuSub>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem disabled={!vendor.subscription?.planId || vendor.subscription?.planId === 'none'} onClick={() => handlePlanChange(vendor, 'free', null)}>
                                        Remove Plan
                                      </DropdownMenuItem>
                                    </DropdownMenuSubContent>
                                  </DropdownMenuPortal>
                                </DropdownMenuSub>

                                <DropdownMenuSeparator />
                                {vendor.status !== 'suspended' ? (
                                  <DropdownMenuItem onClick={() => handleStatusChange(vendor, 'suspended')}>
                                    <Ban className="mr-2 h-4 w-4 text-orange-600" /> Suspend
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onClick={() => handleStatusChange(vendor, 'active')}>
                                    <CheckCircle className="mr-2 h-4 w-4 text-green-600" /> Activate
                                  </DropdownMenuItem>
                                )}
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem className="text-red-600" onClick={(e) => { e.stopPropagation(); }}>
                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Vendor &quot;{vendor.displayName}&quot;?</AlertDialogTitle>
                              <AlertDialogDescription>This will permanently delete this vendor and all their associated store data (products, orders, etc). This action cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteVendor(vendor)}>Yes, Delete Vendor</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
            {filteredVendors.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground h-24">No vendors match the current filters.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
    
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Change Subdomain for {editingVendor?.displayName}</DialogTitle>
                <DialogDescription>
                    The store link will be updated. Make sure to inform the vendor.
                    Current: <strong>{editingVendor?.stores?.[0]?.subdomain}.sellquic.com</strong>
                </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-2">
                <Label htmlFor="subdomain">New Subdomain</Label>
                <div className="flex items-center">
                    <Input id="subdomain" value={newSubdomain} onChange={(e) => setNewSubdomain(e.target.value)} />
                    <span className="text-sm text-muted-foreground ml-2">.sellquic.com</span>
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleUpdateSubdomain} disabled={isUpdating}>
                    {isUpdating && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
                    Save Subdomain
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}