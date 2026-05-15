
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot, query, where, DocumentData, Timestamp, doc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Trash2, Ban, CheckCircle, UserCog } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { useRequireSuperAdmin } from '@/hooks/use-auth';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Affiliate extends DocumentData {
  uid: string;
  displayName: string;
  email: string;
  createdAt: Timestamp;
  status?: 'active' | 'suspended';
  affiliateWallet?: { available: number; pending: number; paid: number; pendingPayout?: number; };
  payoutInfo?: { network: string; momoNumber: string; accountName: string; };
  role?: 'vendor' | 'affiliate';
}

const getInitials = (name: string) => {
    return name?.charAt(0).toUpperCase() || 'A';
};

export default function AffiliateManagementPage() {
  useRequireSuperAdmin();
  const [dedicatedAffiliates, setDedicatedAffiliates] = useState<Affiliate[]>([]);
  const [earningVendors, setEarningVendors] = useState<Affiliate[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const firestore = useFirestore();

  useEffect(() => {
    if (!firestore) return;
    setLoading(true);

    const usersRef = collection(firestore, 'users');
    
    // 1. Get dedicated affiliates
    const affiliatesQuery = query(usersRef, where('role', '==', 'affiliate'));
    const unsubAffiliates = onSnapshot(affiliatesQuery, (snapshot) => {
        setDedicatedAffiliates(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as Affiliate)));
    });

    // 2. Get all vendors, then filter for those with earnings
    const vendorsQuery = query(usersRef, where('role', '==', 'vendor'));
    const unsubVendors = onSnapshot(vendorsQuery, (snapshot) => {
        const activeVendors = snapshot.docs
            .map(doc => ({ uid: doc.id, ...doc.data() } as Affiliate))
            .filter(vendor => {
                const wallet = vendor.affiliateWallet;
                return wallet && (wallet.available > 0 || wallet.pending > 0 || wallet.paid > 0);
            });
        setEarningVendors(activeVendors);
    });

    // Handle initial loading state
    Promise.all([
        getDocs(affiliatesQuery),
        getDocs(vendorsQuery),
    ]).finally(() => setLoading(false));

    return () => {
        unsubAffiliates();
        unsubVendors();
    };
  }, [firestore]);


  const affiliates = useMemo(() => {
    const combined = [...dedicatedAffiliates, ...earningVendors];
    const unique = Array.from(new Map(combined.map(item => [item.uid, item])).values());
    unique.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
    return unique;
  }, [dedicatedAffiliates, earningVendors]);

  const filteredAffiliates = useMemo(() => {
    return affiliates.filter(affiliate => {
        const statusMatch = statusFilter === 'all' || (affiliate.status || 'active') === statusFilter;
        const searchMatch = searchTerm === '' || 
                            (affiliate.displayName && affiliate.displayName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                            (affiliate.email && affiliate.email.toLowerCase().includes(searchTerm.toLowerCase()));
        return statusMatch && searchMatch;
    });
  }, [affiliates, statusFilter, searchTerm]);
  
  const handleStatusChange = async (affiliateId: string, newStatus: 'active' | 'suspended') => {
    if (!firestore) return;
    const affiliateRef = doc(firestore, 'users', affiliateId);
    try {
        await updateDoc(affiliateRef, { status: newStatus });
        toast({ title: `User ${newStatus === 'active' ? 'Activated' : 'Suspended'}` });
    } catch (error) {
        toast({ title: "Update Failed", variant: "destructive" });
    }
  };

  const handleDeleteAffiliate = async (affiliateId: string) => {
    if (!firestore) return;
    const affiliateRef = doc(firestore, 'users', affiliateId);
    try {
        await deleteDoc(affiliateRef);
        toast({ title: "User Deleted" });
    } catch (error) {
        toast({ title: "Delete Failed", variant: "destructive" });
    }
  };

  if (loading) {
    return <p>Loading affiliates...</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Affiliate & Partner Management</CardTitle>
        <CardDescription>View dedicated affiliates and vendors earning referral commissions.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <Input placeholder="Search by name or email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-sm"/>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
            </Select>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Available</TableHead>
              <TableHead>Pending</TableHead>
              <TableHead>Paid Out</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAffiliates.map(affiliate => (
              <TableRow key={affiliate.uid}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9"><AvatarFallback className="bg-secondary text-secondary-foreground">{getInitials(affiliate.displayName)}</AvatarFallback></Avatar>
                     <div>
                        <div className="flex items-center gap-2">
                            <p className="font-medium leading-none">{affiliate.displayName}</p>
                            <Badge variant={affiliate.role === 'vendor' ? 'outline' : 'default'} className="capitalize text-xs">{affiliate.role || 'vendor'}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{affiliate.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                    <Badge variant={affiliate.role === 'vendor' ? 'secondary' : 'default'} className="capitalize">{affiliate.role || 'vendor'}</Badge>
                </TableCell>
                <TableCell><Badge variant={affiliate.status === 'suspended' ? 'destructive' : 'default'} className="capitalize">{affiliate.status || 'active'}</Badge></TableCell>
                <TableCell className="font-medium text-green-600">GHS {(affiliate.affiliateWallet?.available || 0).toFixed(2)}</TableCell>
                <TableCell className="text-muted-foreground">GHS {(affiliate.affiliateWallet?.pending || 0).toFixed(2)}</TableCell>
                <TableCell className="font-medium text-blue-600">GHS {(affiliate.affiliateWallet?.paid || 0).toFixed(2)}</TableCell>
                <TableCell>{affiliate.createdAt ? formatDistanceToNow(affiliate.createdAt.toDate(), { addSuffix: true }) : 'N/A'}</TableCell>
                <TableCell className="text-right">
                    <Dialog>
                        <AlertDialog>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DialogTrigger asChild><DropdownMenuItem><UserCog className="mr-2 h-4 w-4" /> View Details</DropdownMenuItem></DialogTrigger>
                                    <DropdownMenuSeparator />
                                    {affiliate.status !== 'suspended' ? (
                                        <DropdownMenuItem onClick={() => handleStatusChange(affiliate.uid, 'suspended')}><Ban className="mr-2 h-4 w-4 text-orange-600" /> Suspend</DropdownMenuItem>
                                    ) : (
                                        <DropdownMenuItem onClick={() => handleStatusChange(affiliate.uid, 'active')}><CheckCircle className="mr-2 h-4 w-4 text-green-600" /> Activate</DropdownMenuItem>
                                    )}
                                    <AlertDialogTrigger asChild><DropdownMenuItem className="text-red-600"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem></AlertDialogTrigger>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Details for {affiliate.displayName}</DialogTitle>
                                    <DialogDescription>{affiliate.email}</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                    <h4 className="font-semibold text-sm">Payout Information</h4>
                                    {affiliate.payoutInfo ? (
                                        <div className="text-sm space-y-1 bg-muted p-3 rounded-md">
                                            <p><strong>Network:</strong> {affiliate.payoutInfo.network}</p>
                                            <p><strong>Number:</strong> {affiliate.payoutInfo.momoNumber}</p>
                                            <p><strong>Account Name:</strong> {affiliate.payoutInfo.accountName}</p>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">No payout details set up by this user.</p>
                                    )}
                                </div>
                            </DialogContent>
                             <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this user.</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteAffiliate(affiliate.uid)}>Yes, Delete</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </Dialog>
                </TableCell>
              </TableRow>
            ))}
            {filteredAffiliates.length === 0 && (<TableRow><TableCell colSpan={8} className="text-center text-muted-foreground h-24">No users match the current filters.</TableCell></TableRow>)}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
