'use client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Users, DollarSign, CreditCard, Eye, Copy, Loader2 } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, XAxis, Tooltip } from 'recharts';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useState, useMemo } from 'react';
import { collection, query, where, onSnapshot, Timestamp, DocumentData, orderBy } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { format, subDays, startOfDay } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AnimatedCounter } from '@/components/animated-counter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getAuth } from 'firebase/auth';

// --- IMPORTS ---
import { UpgradeBanner } from '@/components/dashboard/UpgradeBanner';
import WalletCard from "@/components/dashboard/WalletCard";
import OnboardingSteps from '@/components/dashboard/OnboardingSteps';


interface Order extends DocumentData {
  id: string;
  totalAmount: number;
  status: 'awaiting-payment' | 'pending' | 'confirmed' | 'fulfilled';
  createdAt: Timestamp;
  customerInfo: {
    name: string;
    phone: string;
  };
}

const chartConfig = {
  revenue: {
    label: 'Revenue',
    color: 'hsl(var(--primary))',
  },
};

const getInitials = (name: string) => {
    if (!name) return '';
    const names = name.split(' ');
    if (names.length > 1) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

export default function Dashboard() {
  const { user, activeStore, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const firestore = useFirestore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [visitors, setVisitors] = useState(0);
  const [dataLoading, setDataLoading] = useState(true);
  const [storeUrl, setStoreUrl] = useState('');
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    if (activeStore?.customDomain) {
      setStoreUrl(`https://${activeStore.customDomain}`);
    } else if (activeStore?.subdomain) {
      const rootDomain = 'sellquic.com';
      const protocol = 'https:';
      setStoreUrl(`${protocol}//${activeStore.subdomain}.${rootDomain}`);
    }
  }, [activeStore]);

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('newSignup') === 'true') {
      setShowWelcome(true);
      localStorage.removeItem('newSignup');
    }
  }, []);


  useEffect(() => {
    if (authLoading || !user || !activeStore || !firestore) {
        if (!authLoading) {
            setDataLoading(false);
        }
        return;
    };

    setDataLoading(true);
    const thirtyDaysAgo = subDays(new Date(), 30);

    const ordersQuery = query(
        collection(firestore, 'orders'), 
        where('storeId', '==', activeStore.id)
    );

    const visitsQuery = query(
        collection(firestore, 'stores', activeStore.id, 'visits'),
        where('timestamp', '>=', thirtyDaysAgo)
    );
    
    let initialOrdersLoaded = false;
    let initialVisitsLoaded = false;

    const checkLoadingState = () => {
        if(initialOrdersLoaded && initialVisitsLoaded) {
            setDataLoading(false);
        }
    }

    const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
      const fetchedOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      fetchedOrders.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setOrders(fetchedOrders);
      if(!initialOrdersLoaded) {
        initialOrdersLoaded = true;
        checkLoadingState();
      }
    }, (error) => {
      console.error("Error fetching orders:", error);
      if(!initialOrdersLoaded) {
          initialOrdersLoaded = true;
          checkLoadingState();
      }
    });

    const unsubscribeVisits = onSnapshot(visitsQuery, (snapshot) => {
        setVisitors(snapshot.size);
        if(!initialVisitsLoaded) {
          initialVisitsLoaded = true;
          checkLoadingState();
        }
    }, (error) => {
        console.error("Error fetching visitors:", error);
        if(!initialVisitsLoaded) {
          initialVisitsLoaded = true;
          checkLoadingState();
        }
    });

    return () => {
        unsubscribeOrders();
        unsubscribeVisits();
    };
  }, [user, activeStore, toast, firestore, authLoading]);

  const {
    totalRevenue,
    totalSales,
    newCustomersThisMonth,
    revenueChartData,
    recentSales,
  } = useMemo(() => {
    const confirmedOrders = orders.filter(o => o.status === 'confirmed' || o.status === 'fulfilled');
    
    const totalRevenue = confirmedOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const totalSales = confirmedOrders.length;
    
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const uniqueCustomersThisMonth = new Set(
        orders
            .filter(o => o.createdAt.toDate() >= startOfThisMonth && o.customerInfo.phone)
            .map(o => o.customerInfo.phone)
    );
    const newCustomersThisMonth = uniqueCustomersThisMonth.size;

    const last30Days = Array.from({ length: 30 }, (_, i) => {
        const date = subDays(now, i);
        return format(startOfDay(date), 'yyyy-MM-dd');
    }).reverse();

    const revenueByDay = confirmedOrders.reduce((acc, order) => {
        const dateStr = format(order.createdAt.toDate(), 'yyyy-MM-dd');
        acc[dateStr] = (acc[dateStr] || 0) + order.totalAmount;
        return acc;
    }, {} as Record<string, number>);

    const revenueChartData = last30Days.map(date => ({
        date: format(new Date(date), 'MMM d'),
        revenue: revenueByDay[date] || 0,
    }));
    
    const recentSales = orders.slice(0, 5);

    return { totalRevenue, totalSales, newCustomersThisMonth, revenueChartData, recentSales };
  }, [orders]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(storeUrl).then(() => {
        toast({ title: 'Link Copied!' });
    });
  };

  const handlePreview = async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) await user.getIdToken(true);
    window.open(storeUrl, '_blank');
  };

  if (authLoading) return null; 

  return (
    <div className="space-y-6">

        {/* ── New Signup Welcome Banner ── */}
      {showWelcome && storeUrl && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-600 via-violet-600 to-indigo-600 text-white p-6 md:p-8 shadow-lg">
          {/* Decorative blob */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl pointer-events-none" />
          <button
            onClick={() => setShowWelcome(false)}
            className="absolute top-3 right-3 text-white/60 hover:text-white transition-colors text-xl leading-none"
            aria-label="Dismiss"
          >
            ✕
          </button>
          <div className="relative">
            <p className="text-sm font-semibold uppercase tracking-widest text-white/70 mb-1">🎉 Your store is live!</p>
            <h2 className="text-2xl md:text-3xl font-bold mb-1">
              Welcome to SellQuic, {(user as any)?.firstName || 'Seller'}!
            </h2>
            <p className="text-white/80 text-sm mb-5">
              Your 7-day free trial has started. Your store is ready — share it with customers and start selling.
            </p>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex-1 flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 text-sm font-medium border border-white/30 max-w-sm">
                <span className="truncate">{storeUrl}</span>
                <button
                  onClick={() => { navigator.clipboard.writeText(storeUrl); toast({ title: 'Store link copied!' }); }}
                  className="ml-auto flex-shrink-0 text-white/70 hover:text-white transition-colors"
                  aria-label="Copy link"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
              <div className="flex gap-2">
                <a
                  href={storeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 bg-white text-purple-700 font-semibold text-sm px-4 py-2 rounded-full hover:bg-white/90 transition-colors shadow-sm"
                >
                  <Eye className="h-4 w-4" />
                  View Store
                </a>
                <a
                  href="/dashboard/products/new"
                  className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm text-white font-semibold text-sm px-4 py-2 rounded-full hover:bg-white/30 border border-white/30 transition-colors"
                >
                  Add Products
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {user && !showWelcome && (
            <div className="mb-2">
                <h2 className="text-2xl font-bold">Welcome back, {(user as any).firstName}!</h2>
            </div>
        )}

      <OnboardingSteps />

      {/* 1. UPGRADE BANNER (Appears once) */}
      <UpgradeBanner />

      {/* 2. STORE LINK CARD */}
      {activeStore && storeUrl && (
        <div className="animated-border-card">
        <Card>
            <CardHeader>
                <CardTitle>Your Store Link</CardTitle>
                <CardDescription>Share this link with your customers.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex w-full max-w-md items-center space-x-2">
                    <Input type="text" value={storeUrl} readOnly />
                    <Button type="button" size="icon" onClick={handleCopyLink}>
                        <Copy className="h-4 w-4" />
                    </Button>
                    <Button onClick={handlePreview} variant="outline" className="gap-2">
                        <Eye className="h-4 w-4" />
                        Preview
                    </Button>
                </div>
            </CardContent>
        </Card>
        </div>
      )}

      {/* 3. STATS GRID (Including WALLET CARD) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* WALLET CARD - Inserted here for perfect layout */}
        <WalletCard />

        {/* REVENUE CARD */}
        <div className="animated-border-card">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                {dataLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <AnimatedCounter from={0} to={totalRevenue} prefix="GHS " decimals={2} />}
                </CardContent>
            </Card>
        </div>

        {/* SALES CARD */}
        <div className="animated-border-card">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                {dataLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <AnimatedCounter from={0} to={totalSales} prefix="+" />}
                </CardContent>
            </Card>
        </div>

        {/* VISITORS CARD */}
        <div className="animated-border-card">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Visitors (30d)</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                {dataLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <AnimatedCounter from={0} to={visitors} prefix="+" />}
                </CardContent>
            </Card>
        </div>
      </div>

      {/* 4. CHARTS SECTION */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
        <div className="animated-border-card lg:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle>Revenue - Last 30 Days</CardTitle>
            </CardHeader>
            <CardContent className="pl-2">
                {dataLoading ? (
                    <div className="flex h-[250px] w-full items-center justify-center sm:h-[300px]">
                        <Loader2 className="h-6 w-6 animate-spin"/>
                    </div>
                ) : (
                    <ChartContainer config={chartConfig} className="h-[250px] sm:h-[300px] w-full">
                        <AreaChart data={revenueChartData} margin={{ left: 0, right: 12, top: 5, bottom: 0 }}>
                        <CartesianGrid vertical={false} />
                        <XAxis
                            dataKey="date"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            tickFormatter={(value) => value.slice(0, 3)}
                        />
                        <Tooltip
                            cursor={false}
                            content={
                            <ChartTooltipContent
                                indicator="dot"
                                formatter={(value) => `GHS ${Number(value).toFixed(2)}`}
                            />
                            }
                        />
                        <Area
                            dataKey="revenue"
                            type="natural"
                            fill="var(--color-revenue)"
                            fillOpacity={0.4}
                            stroke="var(--color-revenue)"
                        />
                        </AreaChart>
                    </ChartContainer>
                )}
            </CardContent>
          </Card>
        </div>

        <div className="animated-border-card lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Recent Sales</CardTitle>
              <CardDescription>The last 5 orders from your store.</CardDescription>
            </CardHeader>
            <CardContent>
               <Table>
                  <TableHeader>
                      <TableRow>
                          <TableHead>Customer</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                  </TableHeader>
                   <TableBody>
                      {dataLoading ? (
                           <TableRow>
                                <TableCell colSpan={2} className="text-center py-10">
                                   <Loader2 className="h-6 w-6 animate-spin mx-auto"/>
                                </TableCell>
                           </TableRow>
                      ) : recentSales.length > 0 ? (
                          recentSales.map((order) => (
                            <TableRow key={order.id}>
                              <TableCell className="py-2">
                                 <div className="flex items-center gap-3">
                                      <Avatar className="h-8 w-8 hidden sm:flex">
                                          <AvatarFallback>{getInitials(order.customerInfo.name)}</AvatarFallback>
                                      </Avatar>
                                      <div className='grid gap-0.5'>
                                          <p className="font-medium leading-none text-sm">{order.customerInfo.name}</p>
                                      </div>
                                  </div>
                              </TableCell>
                              <TableCell className="text-right font-medium py-2">GHS {order.totalAmount.toFixed(2)}</TableCell>
                            </TableRow>
                          ))
                      ) : (
                           <TableRow>
                              <TableCell colSpan={2} className="text-center text-muted-foreground py-10">
                                  No sales yet.
                              </TableCell>
                          </TableRow>
                      )}
                  </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}