
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot, query, where, DocumentData, Timestamp } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { useRequireSuperAdmin } from '@/hooks/use-auth';
import { Badge } from '@/components/ui/badge';
import { UserX } from 'lucide-react';

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

const getInitials = (name: string) => name?.charAt(0).toUpperCase() || 'V';

export default function ExpiredVendorsPage() {
  useRequireSuperAdmin();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const firestore = useFirestore();

  useEffect(() => {
    if (!firestore) return;
    
    const q = query(
        collection(firestore, 'users'), 
        where('subscription.status', '==', 'expired')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedVendors = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as Vendor));
      fetchedVendors.sort((a,b) => {
          const dateA = a.subscription?.endDate?.toMillis() || 0;
          const dateB = b.subscription?.endDate?.toMillis() || 0;
          return dateB - dateA; // Sort by most recently expired
      });
      setVendors(fetchedVendors);
      setLoading(false);
    }, (error) => {
        console.error("Error fetching expired vendors:", error);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [firestore]);

  if (loading) return <p className="p-8">Loading expired vendors...</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><UserX className="h-6 w-6"/> Expired Subscriptions</CardTitle>
        <CardDescription>A list of all vendors with an expired subscription status.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
            <Table>
            <TableHeader>
                <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>Expired Plan</TableHead>
                <TableHead>Expired On</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {vendors.map(vendor => (
                    <TableRow key={vendor.uid}>
                        <TableCell>
                        <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-destructive/10 text-destructive">
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
                        <TableCell className="font-medium tabular-nums">
                            {vendor.subscription?.endDate 
                                ? format(vendor.subscription.endDate.toDate(), 'PP') 
                                : 'No Date'}
                        </TableCell>
                    </TableRow>
                ))}
                
                {vendors.length === 0 && (
                <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                        No vendors with expired subscriptions found.
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
