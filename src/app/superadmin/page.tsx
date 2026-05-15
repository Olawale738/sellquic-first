
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAuth } from 'firebase/auth';
import {
  collection,
  query,
  where,
  getDocs,
  DocumentData,
  orderBy,
  limit
} from 'firebase/firestore';
import { subDays, startOfDay, format } from 'date-fns';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DollarSign,
  Users,
  CreditCard,
  TrendingUp,
  Globe,
  UserCheck,
  UserPlus,
} from 'lucide-react';

import { useRequireSuperAdmin } from '@/hooks/use-auth';
import { useFirestore } from '@/firebase';

// Recharts
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface StatsResponse {
  subscriptionRevenue: number;
  domainRevenue: number;
  vendors: number;
  transactions: number;
  dau: number;
  newSignupsToday: number;
  dailyVisits?: number;
}

interface GrowthPoint {
  date: string;      // "Jan 10"
  newVendors: number;
  revenue: number;   // GHS
}

const getInitials = (name: string) => {
    if (!name) return '';
    const names = name.split(' ');
    if (names.length > 1) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}


export default function SuperAdminDashboard() {
  const { user } = useRequireSuperAdmin();
  const firestore = useFirestore();

  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const [growthData, setGrowthData] = useState<GrowthPoint[]>([]);
  const [loadingCharts, setLoadingCharts] = useState(true);
  
  const [recentSignups, setRecentSignups] = useState<DocumentData[]>([]);

  // 1) Fetch aggregate stats from API
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const auth = getAuth();
        const token = await auth.currentUser?.getIdToken();

        const res = await fetch('/api/superadmin/stats', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error('Failed to fetch stats');

        const data = await res.json();
        setStats(data);
      } catch (error) {
        console.error('Failed to fetch stats', error);
      } finally {
        setLoadingStats(false);
      }
    };

    const fetchRecentSignups = async () => {
        if (!firestore) return;
        try {
            const q = query(collection(firestore, 'users'), orderBy('createdAt', 'desc'), limit(5));
            const snap = await getDocs(q);
            setRecentSignups(snap.docs.map(d => ({id: d.id, ...d.data()})));
        } catch (error) {
            console.error('Failed to fetch recent signups', error);
        }
    }

    if (user) {
        fetchStats();
        fetchRecentSignups();
    }
  }, [user, firestore]);

  // 2) Fetch chart data (user growth + revenue trend) directly from Firestore
  useEffect(() => {
    if (!user || !firestore) return;

    const fetchCharts = async () => {
      try {
        setLoadingCharts(true);

        const today = startOfDay(new Date());
        const thirtyDaysAgo = subDays(today, 29); // 30 days inclusive

        // Pre-build the last 30 days keys
        const dayKeys: string[] = [];
        for (let i = 0; i < 30; i++) {
          const d = subDays(today, 29 - i);
          dayKeys.push(format(d, 'yyyy-MM-dd'));
        }

        // Fetch users created in last 30 days
        const usersQ = query(
          collection(firestore, 'users'),
          where('createdAt', '>=', thirtyDaysAgo)
        );

        // Fetch completed transactions in last 30 days
        const txQ = query(
          collection(firestore, 'transactions'),
          where('status', '==', 'completed'),
          where('createdAt', '>=', thirtyDaysAgo)
        );

        const [usersSnap, txSnap] = await Promise.all([
          getDocs(usersQ),
          getDocs(txQ),
        ]);

        const newVendorsByDate: Record<string, number> = {};
        const revenueByDate: Record<string, number> = {};

        // Aggregate new vendors per day
        usersSnap.forEach(doc => {
          const data = doc.data() as DocumentData;
          const createdAt = data.createdAt?.toDate?.() as Date | undefined;
          if (!createdAt) return;

          const key = format(startOfDay(createdAt), 'yyyy-MM-dd');
          // Ignore if before our window (safety)
          if (key < dayKeys[0]) return;

          newVendorsByDate[key] = (newVendorsByDate[key] || 0) + 1;
        });

        // Aggregate revenue per day (normalize domain vs subscription)
        txSnap.forEach(doc => {
          const data = doc.data() as DocumentData;
          const createdAt =
            data.createdAt?.toDate?.() ||
            data.date?.toDate?.() ||
            null;

          if (!createdAt) return;
          const key = format(startOfDay(createdAt), 'yyyy-MM-dd');
          if (key < dayKeys[0]) return;

          const amount = data.amount || 0;
          const isDomain =
            data.type === 'domain_purchase' || !!data.domain;

          // Match your logic: domain = GHS, others = pesewas
          const amountInGHS = isDomain ? amount : amount / 100;

          revenueByDate[key] = (revenueByDate[key] || 0) + amountInGHS;
        });

        const chartRows: GrowthPoint[] = dayKeys.map(key => ({
          date: format(new Date(key), 'MMM d'),
          newVendors: newVendorsByDate[key] || 0,
          revenue: Number((revenueByDate[key] || 0).toFixed(2)),
        }));

        setGrowthData(chartRows);
      } catch (err) {
        console.error('Failed to fetch chart data', err);
      } finally {
        setLoadingCharts(false);
      }
    };

    fetchCharts();
  }, [user, firestore]);

  if (loadingStats && !stats) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Loading platform analytics...</p>
      </div>
    );
  }

  const cards = [
    {
      title: 'Subscription Revenue',
      value: `GHS ${(stats?.subscriptionRevenue || 0).toFixed(2)}`,
      icon: DollarSign,
      link: '/superadmin/transactions',
      subtext: 'Lifetime from plans',
    },
    {
      title: 'Domain Revenue',
      value: `GHS ${(stats?.domainRevenue || 0).toFixed(2)}`,
      icon: Globe,
      link: '/superadmin/domains',
      subtext: 'Lifetime from domains',
    },
    {
      title: 'Total Vendors',
      value: stats?.vendors || 0,
      icon: Users,
      link: '/superadmin/vendors',
      subtext: 'Registered sellers',
    },
    {
      title: "Today's Visits",
      value: stats?.dailyVisits || 0,
      icon: TrendingUp,
      link: `/superadmin/traffic?today=${stats?.dailyVisits || 0}`,
      subtext: 'Total visits today',
    },
    {
      title: 'Total Transactions',
      value: stats?.transactions || 0,
      icon: CreditCard,
      link: '/superadmin/transactions',
      subtext: 'Successful payments',
    },
    {
      title: 'Active Users (24h)',
      value: stats?.dau || 0,
      icon: UserCheck,
      link: '/superadmin/active-users',
      subtext: 'Vendors active recently',
    },
    {
      title: 'New Signups (Today)',
      value: stats?.newSignupsToday || 0,
      icon: UserPlus,
      link: '/superadmin/growth',
      subtext: 'New vendors today',
    },
  ];

  return (
    <div className="space-y-6">
      {/* TOP STATS GRID */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card, i) => (
          <Link href={card.link} key={i} className="block group">
            <Card className="hover:border-primary cursor-pointer transition-all">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {card.title}
                </CardTitle>
                <card.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
                <p className="text-xs text-muted-foreground">
                  {card.subtext}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* USER GROWTH CHART */}
        <Card>
          <CardHeader>
            <CardTitle>User Growth (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            {loadingCharts ? (
              <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                Loading charts...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={growthData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis allowDecimals={false} />
                  <Tooltip
                    formatter={(value) => [value, 'New Vendors']}
                    labelFormatter={(label) => label}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="newVendors"
                    name="New Vendors"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* REVENUE TREND CHART */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            {loadingCharts ? (
              <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                Loading charts...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={growthData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis />
                  <Tooltip
                    formatter={(value) => [`GHS ${Number(value).toFixed(2)}`, 'Revenue']}
                    labelFormatter={(label) => label}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue (GHS)"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* RECENT SIGNUPS */}
      <Card>
          <CardHeader>
            <CardTitle>Recent Signups</CardTitle>
          </CardHeader>
          <CardContent>
              <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead className="text-right">Date</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {recentSignups.map(user => (
                        <TableRow key={user.id}>
                            <TableCell>
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-9 w-9">
                                        <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
                                    </Avatar>
                                    <span className="font-medium">{user.displayName}</span>
                                </div>
                            </TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">
                                {user.createdAt ? format(user.createdAt.toDate(), 'PP p') : '-'}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
              </Table>
          </CardContent>
      </Card>
    </div>
  );
}
