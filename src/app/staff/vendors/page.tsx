
'use client';
import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, DocumentData, Timestamp, getDocs } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ExternalLink, MoreHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useRequireStaff } from '@/hooks/use-auth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Vendor extends DocumentData {
  uid: string;
  displayName: string;
  email: string;
  createdAt: Timestamp;
  status?: 'active' | 'suspended';
  subscription?: { planId: 'starter' | 'standard' | 'growth'; };
  stores?: { subdomain?: string; customDomain?: string; }[];
  role?: string;
}

const getInitials = (name: string) => {
    return name?.charAt(0).toUpperCase() || 'V';
};

export default function StaffVendorsPage() {
  useRequireStaff();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const firestore = useFirestore();

  useEffect(() => {
    if (!firestore) return;

    const usersQuery = query(collection(firestore, 'users'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(usersQuery, async (userSnapshot) => {
      const usersData = userSnapshot.docs
        .filter(doc => doc.data().role !== 'staff' && doc.data().role !== 'superadmin')
        .map(doc => ({ uid: doc.id, ...doc.data() } as Vendor));

      const storesSnapshot = await getDocs(collection(firestore, 'stores'));
      const storesData = storesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const vendorsWithStores = usersData.map(vendor => {
            const vendorStores = storesData.filter((store: any) => store.sellerId === vendor.uid);
            return {
                ...vendor,
                stores: vendorStores.map((s: any) => ({ subdomain: s.subdomain || '', customDomain: s.customDomain || '' }))
            };
        });

      setVendors(vendorsWithStores);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [firestore]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>All Vendors</CardTitle>
        <CardDescription>A read-only list of all vendors on the platform.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendor</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center h-24">Loading vendors...</TableCell></TableRow>
            ) : vendors.map(vendor => {
              const firstStore = vendor.stores?.[0];
              const storeUrl = firstStore ? `https://${firstStore.customDomain || `${firstStore.subdomain}.sellquic.com`}` : null;
              
              return (
              <TableRow key={vendor.uid}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback>{getInitials(vendor.displayName)}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{vendor.displayName}</span>
                  </div>
                </TableCell>
                <TableCell>{vendor.email}</TableCell>
                <TableCell>
                  <Badge variant={vendor.subscription?.planId !== 'free' ? 'default' : 'secondary'} className="capitalize">
                    {vendor.subscription?.planId || 'free'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={vendor.status === 'suspended' ? 'destructive' : 'default'} className="capitalize">
                    {vendor.status || 'active'}
                  </Badge>
                </TableCell>
                <TableCell>{vendor.createdAt ? formatDistanceToNow(vendor.createdAt.toDate(), { addSuffix: true }) : 'N/A'}</TableCell>
                <TableCell className="text-right">
                   <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {storeUrl && (
                          <DropdownMenuItem asChild>
                            <a href={storeUrl} target="_blank" rel="noopener noreferrer" className="flex items-center w-full">
                              <ExternalLink className="mr-2 h-4 w-4" /> View Store
                            </a>
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                </TableCell>
              </TableRow>
            )})}
             {!loading && vendors.length === 0 && (
                <TableRow>
                    <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                        No vendors found.
                    </TableCell>
                </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
