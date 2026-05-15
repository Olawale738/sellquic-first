
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot, query, where, DocumentData, Timestamp } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { format, isPast, addDays, differenceInDays } from 'date-fns';
import { useRequireSuperAdmin } from '@/hooks/use-auth';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Vendor extends DocumentData {
  uid: string;
  displayName: string;
  email: string;
  subscription?: {
      planId: 'starter' | 'standard' | 'growth';
      endDate: Timestamp;
      status: 'active' | 'expired';
  }
}

type TabFilter = 'all' | 'active' | 'due-soon' | 'expired';

const getInitials = (name: string) => name?.charAt(0).toUpperCase() || 'V';

// Helper to calculate status details
const getSubscriptionDetails = (vendor: Vendor) => {
    const sub = vendor.subscription;
    
    // Safety check: if data is malformed
    if (!sub || !sub.endDate) {
        return { label: 'Unknown', color: 'secondary' as const, isExpired: false, isDueSoon: false };
    }

    const endDate = sub.endDate.toDate();
    const now = new Date();
    const _isPast = isPast(endDate);
    
    // Calculate days remaining
    const daysRemaining = differenceInDays(endDate, now);
    const isDueSoon = !_isPast && daysRemaining <= 30;

    if (_isPast) {
        return { label: 'Expired', color: 'destructive' as const, isExpired: true, isDueSoon: false };
    }
    
    if (isDueSoon) {
        return { label: 'Due Soon', color: 'secondary' as const, isExpired: false, isDueSoon: true };
    }

    return { label: 'Active', color: 'default' as const, isExpired: false, isDueSoon: false };
};

export default function ExpiringSubscriptionsPage() {
  useRequireSuperAdmin();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabFilter>('active'); // Default to showing active users
  const firestore = useFirestore();

  useEffect(() => {
    if (!firestore) return;
    
    // FIX 1: Use 'in' instead of '!='. 
    // This is safer and guarantees we only get documents where the field exists.
    // Ensure you have "business" and "enterprise" (or whatever your paid IDs are) listed here.
    const q = query(
        collection(firestore, 'users'), 
        where('subscription.planId', 'in', ['starter', 'standard', 'growth'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedVendors = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as Vendor));
      setVendors(fetchedVendors);
      setLoading(false);
    }, (error) => {
        console.error("Error fetching vendors:", error);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [firestore]);

  const filteredVendors = useMemo(() => {
    let result = vendors;

    // FIX 2: Filter Logic
    if (activeTab === 'active') {
        // Show everyone who is NOT expired (includes Due Soon)
        result = vendors.filter(v => !getSubscriptionDetails(v).isExpired);
    } else if (activeTab === 'expired') {
        result = vendors.filter(v => getSubscriptionDetails(v).isExpired);
    } else if (activeTab === 'due-soon') {
        result = vendors.filter(v => getSubscriptionDetails(v).isDueSoon);
    }
    // 'all' passes through everything

    // Sort by expiration date (soonest first usually makes more sense for admin)
    return result.sort((a,b) => {
        const dateA = a.subscription?.endDate?.toMillis() || 0;
        const dateB = b.subscription?.endDate?.toMillis() || 0;
        return dateA - dateB; 
    });
  }, [vendors, activeTab]);

  if (loading) return <p className="p-8">Loading subscriptions...</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vendor Subscriptions</CardTitle>
        <CardDescription>Manage all paid vendor subscriptions.</CardDescription>
      </CardHeader>
      <CardContent>
         <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabFilter)} className="mb-4">
            <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="active">Active (Paid)</TabsTrigger>
                <TabsTrigger value="due-soon">Due Soon (&lt;30 Days)</TabsTrigger>
                <TabsTrigger value="expired">Expired</TabsTrigger>
            </TabsList>
        </Tabs>

        <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendor</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Expires On</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredVendors.map(vendor => {
                const details = getSubscriptionDetails(vendor);
                
                return (
                    <TableRow key={vendor.uid}>
                        <TableCell>
                        <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-primary/10 text-primary">
                                {getInitials(vendor.displayName)}
                            </AvatarFallback>
                            </Avatar>
                            <div className='grid gap-0.5'>
                            <p className="font-medium leading-none">{vendor.displayName || 'Unknown Name'}</p>
                            <p className="text-xs text-muted-foreground">{vendor.email}</p>
                            </div>
                        </div>
                        </TableCell>
                        <TableCell>
                            <Badge variant="outline" className="capitalize">
                                {vendor.subscription?.planId}
                            </Badge>
                        </TableCell>
                        <TableCell>
                            <div className="flex items-center gap-2">
                                <Badge variant={details.color}>
                                    {details.label}
                                </Badge>
                                {/* Visual Icon Helpers */}
                                {details.label === 'Active' && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                                {details.label === 'Due Soon' && <Clock className="w-4 h-4 text-amber-600" />}
                                {details.label === 'Expired' && <XCircle className="w-4 h-4 text-red-600" />}
                            </div>
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                            {vendor.subscription?.endDate 
                                ? format(vendor.subscription.endDate.toDate(), 'PP') 
                                : 'No Date'}
                        </TableCell>
                    </TableRow>
                )
            })}
            
            {filteredVendors.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                   <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                     <AlertCircle className="h-8 w-8 opacity-50" />
                     <span className="text-sm">No vendors found for this filter.</span>
                   </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </div>
      </CardContent>
    </Card>
  );
}
