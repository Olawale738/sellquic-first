'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot, query, where, DocumentData } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useRequireSuperAdmin } from '@/hooks/use-auth';
import { Crown, Gift, User, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface User extends DocumentData {
  uid: string;
  displayName: string;
  email: string;
  referralCode: string;
  used20PercentDiscount?: boolean;
}

interface Referral {
  id: string;
  referredByVendor: string;
  subscription?: {
    planId: string;
  };
}

interface VendorStats {
  vendor: User;
  totalReferrals: number;
  proReferrals: number;
}

const getInitials = (name: string) => name?.charAt(0).toUpperCase() || 'V';

export default function VendorReferralsPage() {
  useRequireSuperAdmin();
  const [vendors, setVendors] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const firestore = useFirestore();

  useEffect(() => {
    if (!firestore) return;

    // Fetch all users who are vendors (have a referral code)
    const vendorsQuery = query(collection(firestore, 'users'), where('referralCode', '!=', null));
    const unsubVendors = onSnapshot(vendorsQuery, (snapshot) => {
      setVendors(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User)));
    });

    // Fetch all users to count referrals
    const allUsersQuery = query(collection(firestore, 'users'));
    const unsubAllUsers = onSnapshot(allUsersQuery, (snapshot) => {
      setAllUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Referral)));
    });

    Promise.all([
      new Promise(resolve => onSnapshot(vendorsQuery, () => resolve(true))),
      new Promise(resolve => onSnapshot(allUsersQuery, () => resolve(true))),
    ]).then(() => setLoading(false));

    return () => {
      unsubVendors();
      unsubAllUsers();
    };
  }, [firestore]);

  const vendorStats = useMemo(() => {
    if (vendors.length === 0 || allUsers.length === 0) return [];

    const stats: VendorStats[] = vendors.map(vendor => {
      const referrals = allUsers.filter(u => u.referredByVendor === vendor.uid);
      const proReferrals = referrals.filter(u => u.subscription?.planId !== 'free').length;

      return {
        vendor,
        totalReferrals: referrals.length,
        proReferrals: proReferrals,
      };
    });

    return stats.sort((a, b) => b.totalReferrals - a.totalReferrals);
  }, [vendors, allUsers]);

  if (loading) {
    return <p>Loading vendor referral data...</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vendor Referrals</CardTitle>
        <CardDescription>Track performance of the vendor-to-vendor referral program.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendor</TableHead>
              <TableHead>Total Referrals</TableHead>
              <TableHead>Pro Referrals</TableHead>
              <TableHead>Reward Redeemed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vendorStats.map(stat => (
              <TableRow key={stat.vendor.uid}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback>{getInitials(stat.vendor.displayName)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{stat.vendor.displayName}</p>
                      <p className="text-xs text-muted-foreground">{stat.vendor.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                    <div className="flex items-center gap-1.5"><Users className="h-4 w-4 text-muted-foreground"/>{stat.totalReferrals}</div>
                </TableCell>
                 <TableCell>
                    <div className="flex items-center gap-1.5"><Crown className="h-4 w-4 text-yellow-500"/>{stat.proReferrals}</div>
                </TableCell>
                <TableCell>
                  {stat.vendor.used20PercentDiscount ? (
                    <Badge variant="default" className="bg-green-100 text-green-800">Yes</Badge>
                  ) : (
                    <Badge variant="secondary">No</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {vendorStats.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  No vendor referral data available.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
