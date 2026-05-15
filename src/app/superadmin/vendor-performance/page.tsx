'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  collection, onSnapshot, DocumentData, Timestamp
} from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useRequireSuperAdmin } from '@/hooks/use-auth';
import {
  TrendingUp, ShoppingBag, Users, Package,
  Search, ArrowUpDown, ArrowUp, ArrowDown,
  AlertTriangle, ChevronDown, Activity,
  Clock, Zap, BarChart3, FilterX
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Order extends DocumentData {
  id: string;
  sellerId: string;
  storeId: string;
  totalAmount: number;
  status: string; // e.g., 'pending', 'processing', 'confirmed', 'fulfilled', 'cancelled'
  createdAt: Timestamp;
}

interface Seller extends DocumentData {
  uid: string;
  displayName: string;
  email: string;
  createdAt?: Timestamp;
}

interface StoreDoc extends DocumentData {
  id: string;
  sellerId: string;
}

interface ProductDoc extends DocumentData {
  id: string;
  storeId: string;
  isArchived?: boolean;
}

interface VendorPerformance {
  sellerId: string;
  name: string;
  email: string;
  totalRevenue: number;
  totalOrders: number;
  fulfilledOrders: number;
  cancelledOrders: number;
  avgOrderValue: number;
  productCount: number;
  joinedAt: Date | null;
  lastOrderAt: Date | null;
  fulfilmentRate: number;
}

type SortKey = 'totalRevenue' | 'totalOrders' | 'avgOrderValue' | 'productCount' | 'fulfilmentRate' | 'lastOrderAt' | 'joinedAt';
type SortDir = 'asc' | 'desc';
type ActivityFilter = 'all' | 'active' | 'inactive' | 'new' | 'no_orders';
type ProductFilter = 'all' | 'none' | 'low' | 'healthy';
type RevenueFilter = 'all' | 'zero' | 'low' | 'mid' | 'high';
type AttentionFilter = 'none' | 'ordersNoProducts' | 'newNoActivity' | 'wentSilent';

const PAGE_SIZE = 25;

// ── Helpers ───────────────────────────────────────────────────────────────────

const getInitials = (name: string) => name?.charAt(0).toUpperCase() || 'V';
const fmtGHS = (n: number) =>
  `GHS ${n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const daysSince = (date: Date | null) =>
  date ? Math.floor((Date.now() - date.getTime()) / 86400000) : 9999;

function activityBadge(v: VendorPerformance) {
  const d = daysSince(v.lastOrderAt);
  if (v.totalOrders === 0) return { label: 'No Orders', cls: 'bg-gray-100 text-gray-500' };
  if (d <= 30) return { label: 'Active', cls: 'bg-emerald-100 text-emerald-700' };
  if (d <= 90) return { label: 'Slow', cls: 'bg-amber-100 text-amber-700' };
  return { label: 'Inactive', cls: 'bg-red-100 text-red-600' };
}

function FulfilmentBar({ rate, total }: { rate: number; total: number }) {
  if (total === 0) return <span className="text-xs text-gray-300">—</span>;
  const color = rate >= 80 ? 'bg-emerald-500' : rate >= 50 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="w-14 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${rate}%` }} />
      </div>
      <span className="text-xs font-medium tabular-nums">{rate}%</span>
    </div>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
        active
          ? 'bg-gray-900 text-white border-gray-900'
          : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-800'
      }`}
    >
      {children}
    </button>
  );
}

function SortTh({ label, sortKey: k, current, dir, onSort }: {
  label: string; sortKey: SortKey; current: SortKey; dir: SortDir; onSort: (k: SortKey) => void;
}) {
  const active = current === k;
  return (
    <th onClick={() => onSort(k)} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-gray-900 whitespace-nowrap">
      <span className="inline-flex items-center gap-1">
        {label}
        {active
          ? dir === 'desc' ? <ArrowDown className="h-3 w-3 text-gray-900" /> : <ArrowUp className="h-3 w-3 text-gray-900" />
          : <ArrowUpDown className="h-3 w-3 text-gray-300" />}
      </span>
    </th>
  );
}

function AttentionCard({ icon, title, count, color, items, emptyMsg, onClick, isActive }: {
  icon: React.ReactNode; title: string; count: number; color: string;
  items: { name: string; sub: string }[]; emptyMsg: string; onClick: () => void; isActive: boolean;
}) {
  return (
    <Card 
      onClick={onClick}
      className={`border shadow-sm cursor-pointer transition-all hover:shadow-md ${isActive ? 'ring-2 ring-gray-900 ring-offset-1' : ''}`}
    >
      <CardHeader className="pb-2 pt-4 px-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${color}`}>{icon}</div>
            <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          </div>
          {count > 0 && (
            <span className="text-xs font-bold bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">{count}</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-4">
        {items.length === 0 ? (
          <p className="text-xs text-gray-400">{emptyMsg}</p>
        ) : (
          <ul className="space-y-2">
            {items.slice(0, 3).map((item, i) => (
              <li key={i} className="flex items-center gap-2">
                <Avatar className="h-6 w-6 flex-shrink-0">
                  <AvatarFallback className="text-[10px] bg-gray-100">{getInitials(item.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate leading-tight">{item.name}</p>
                  <p className="text-[10px] text-gray-400 truncate">{item.sub}</p>
                </div>
              </li>
            ))}
            {items.length > 3 && <p className="text-[10px] text-gray-500 font-medium pt-1">Click to see all {items.length} vendors &rarr;</p>}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function VendorPerformancePage() {
  useRequireSuperAdmin();

  const firestore = useFirestore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [stores, setStores] = useState<StoreDoc[]>([]);
  const [products, setProducts] = useState<ProductDoc[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [productFilter, setProductFilter] = useState<ProductFilter>('all');
  const [revenueFilter, setRevenueFilter] = useState<RevenueFilter>('all');
  const [attentionFilter, setAttentionFilter] = useState<AttentionFilter>('none');
  
  const [sortKey, setSortKey] = useState<SortKey>('totalRevenue');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!firestore) return;
    let loaded = { orders: false, sellers: false, stores: false, products: false };
    const tryDone = () => { if (Object.values(loaded).every(Boolean)) setLoading(false); };

    const unsubs = [
      onSnapshot(collection(firestore, 'orders'), snap => {
        setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
        loaded.orders = true; tryDone();
      }),
      onSnapshot(collection(firestore, 'users'), snap => {
        setSellers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as Seller)));
        loaded.sellers = true; tryDone();
      }),
      onSnapshot(collection(firestore, 'stores'), snap => {
        setStores(snap.docs.map(d => ({ id: d.id, ...d.data() } as StoreDoc)));
        loaded.stores = true; tryDone();
      }),
      onSnapshot(collection(firestore, 'products'), snap => {
        setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProductDoc)));
        loaded.products = true; tryDone();
      }),
    ];

    return () => unsubs.forEach(u => u());
  }, [firestore]);

  const storeToSeller = useMemo(() => {
    const m = new Map<string, string>();
    stores.forEach(s => { if (s.sellerId) m.set(s.id, s.sellerId); });
    return m;
  }, [stores]);

  const productsBySeller = useMemo(() => {
    const m = new Map<string, number>();
    products.forEach(p => {
      if (p.isArchived) return;
      const sid = storeToSeller.get(p.storeId);
      if (sid) m.set(sid, (m.get(sid) || 0) + 1);
    });
    return m;
  }, [products, storeToSeller]);

  const vendorPerformance = useMemo((): VendorPerformance[] => {
    const map = new Map<string, VendorPerformance>();

    sellers.forEach(seller => {
      map.set(seller.uid, {
        sellerId: seller.uid,
        name: seller.displayName || 'Unknown',
        email: seller.email || '',
        totalRevenue: 0, totalOrders: 0, fulfilledOrders: 0, cancelledOrders: 0,
        avgOrderValue: 0,
        productCount: productsBySeller.get(seller.uid) || 0,
        joinedAt: seller.createdAt?.toDate?.() ?? null,
        lastOrderAt: null,
        fulfilmentRate: 0,
      });
    });

    orders.forEach(order => {
      const sellerId = order.sellerId || storeToSeller.get(order.storeId);
      if (!sellerId) return;
      const p = map.get(sellerId);
      if (!p) return;

      // Track all orders regardless of status for accurate fulfillment rate
      p.totalOrders += 1; 

      // Only count revenue for orders that are not cancelled
      if (['confirmed', 'fulfilled', 'processing', 'pending', 'delivered', 'shipped'].includes(order.status)) {
        p.totalRevenue += order.totalAmount || 0;
        const d = order.createdAt?.toDate?.() ?? null;
        if (d && (!p.lastOrderAt || d > p.lastOrderAt)) p.lastOrderAt = d;
      }
      
      if (order.status === 'fulfilled' || order.status === 'delivered') p.fulfilledOrders += 1;
      if (order.status === 'cancelled') p.cancelledOrders += 1;
    });

    map.forEach(p => {
      const validOrdersForRevenue = p.totalOrders - p.cancelledOrders;
      p.avgOrderValue = validOrdersForRevenue > 0 ? p.totalRevenue / validOrdersForRevenue : 0;
      
      // Fulfilment Rate = Fulfilled / (Total Orders - Cancelled). 
      // (Pending/Processing orders hurt the rate until fulfilled)
      const denominator = p.totalOrders - p.cancelledOrders;
      p.fulfilmentRate = denominator > 0 ? Math.round((p.fulfilledOrders / denominator) * 100) : 0;
    });

    return Array.from(map.values());
  }, [sellers, orders, productsBySeller, storeToSeller]);

  const kpis = useMemo(() => {
    const active = vendorPerformance.filter(v => daysSince(v.lastOrderAt) <= 30 && v.totalOrders > 0);
    const vendorsWithSales = vendorPerformance.filter(v => v.totalOrders > 0);
    
    const gmv = vendorPerformance.reduce((s, v) => s + v.totalRevenue, 0);
    const totalOrders = vendorPerformance.reduce((s, v) => s + v.totalOrders, 0);
    
    // Fixed: Avg Rev is now Platform GMV divided by the number of vendors who have actually sold something.
    const avgRevActive = vendorsWithSales.length > 0 ? gmv / vendorsWithSales.length : 0;
    
    const f = vendorPerformance.reduce((s, v) => s + v.fulfilledOrders, 0);
    const nonCancelledOrders = totalOrders - vendorPerformance.reduce((s, v) => s + v.cancelledOrders, 0);
    const overallFulfilment = nonCancelledOrders > 0 ? Math.round((f / nonCancelledOrders) * 100) : 0;
    
    return { gmv, totalOrders, activeCount: active.length, avgRevActive, overallFulfilment };
  }, [vendorPerformance]);

  const attention = useMemo(() => ({
    ordersNoProducts: vendorPerformance
      .filter(v => v.totalOrders > 0 && v.productCount === 0)
      .map(v => ({ name: v.name, sub: `${v.totalOrders} orders — no products` })),
    newNoActivity: vendorPerformance
      .filter(v => daysSince(v.joinedAt) <= 14 && v.totalOrders === 0)
      .map(v => ({ name: v.name, sub: `Joined ${daysSince(v.joinedAt)}d ago` })),
    wentSilent: vendorPerformance
      .filter(v => v.totalOrders > 0 && daysSince(v.lastOrderAt) > 60)
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .map(v => ({ name: v.name, sub: `Last order ${daysSince(v.lastOrderAt)}d ago` })),
  }), [vendorPerformance]);

  const filtered = useMemo(() => {
    let data = [...vendorPerformance];
    
    // Apply search
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(v => v.name.toLowerCase().includes(q) || v.email.toLowerCase().includes(q));
    }

    // Apply Attention Quick Filters
    if (attentionFilter === 'ordersNoProducts') {
      data = data.filter(v => v.totalOrders > 0 && v.productCount === 0);
    } else if (attentionFilter === 'newNoActivity') {
      data = data.filter(v => daysSince(v.joinedAt) <= 14 && v.totalOrders === 0);
    } else if (attentionFilter === 'wentSilent') {
      data = data.filter(v => v.totalOrders > 0 && daysSince(v.lastOrderAt) > 60);
    }

    // Apply standard filters (Only if not using attention filters)
    if (attentionFilter === 'none') {
      if (activityFilter !== 'all') {
        data = data.filter(v => {
          const d = daysSince(v.lastOrderAt);
          const j = daysSince(v.joinedAt);
          if (activityFilter === 'active') return d <= 30 && v.totalOrders > 0;
          if (activityFilter === 'inactive') return d > 90 && v.totalOrders > 0;
          if (activityFilter === 'new') return j <= 30;
          if (activityFilter === 'no_orders') return v.totalOrders === 0;
          return true;
        });
      }
      if (productFilter !== 'all') {
        data = data.filter(v => {
          if (productFilter === 'none') return v.productCount === 0;
          if (productFilter === 'low') return v.productCount >= 1 && v.productCount <= 3;
          if (productFilter === 'healthy') return v.productCount > 3;
          return true;
        });
      }
      if (revenueFilter !== 'all') {
        data = data.filter(v => {
          if (revenueFilter === 'zero') return v.totalRevenue === 0;
          if (revenueFilter === 'low') return v.totalRevenue > 0 && v.totalRevenue < 500;
          if (revenueFilter === 'mid') return v.totalRevenue >= 500 && v.totalRevenue < 2000;
          if (revenueFilter === 'high') return v.totalRevenue >= 2000;
          return true;
        });
      }
    }

    // Apply Sorting
    data.sort((a, b) => {
      let av: any = a[sortKey];
      let bv: any = b[sortKey];
      if (av instanceof Date) av = av.getTime();
      if (bv instanceof Date) bv = bv.getTime();
      av = av ?? (sortDir === 'desc' ? -Infinity : Infinity);
      bv = bv ?? (sortDir === 'desc' ? -Infinity : Infinity);
      return sortDir === 'desc' ? bv - av : av - bv;
    });
    return data;
  }, [vendorPerformance, search, activityFilter, productFilter, revenueFilter, attentionFilter, sortKey, sortDir]);

  const paginated = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = paginated.length < filtered.length;

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(k); setSortDir('desc'); }
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearch('');
    setActivityFilter('all');
    setProductFilter('all');
    setRevenueFilter('all');
    setAttentionFilter('none');
    setPage(1);
  };

  const setKPIFilter = (type: string) => {
    handleClearFilters();
    if (type === 'active') setActivityFilter('active');
    if (type === 'orders') setActivityFilter('inactive'); // Just an example, maybe show all vendors with > 0 orders
    document.getElementById('vendor-table')?.scrollIntoView({ behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center gap-3 text-gray-400">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-800 border-t-transparent" />
        <span className="text-sm">Loading vendor data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6 max-w-[1400px] mx-auto">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-gray-900">Vendor Performance</h1>
        <p className="text-sm text-gray-500 mt-0.5">{vendorPerformance.length} vendors · Live</p>
      </div>

      {/* KPIs - Now Clickable */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card onClick={handleClearFilters} className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="inline-flex p-1.5 rounded-lg mb-2 text-emerald-600 bg-emerald-50"><TrendingUp className="h-4 w-4" /></div>
            <p className="text-xl font-bold text-gray-900 leading-tight">{fmtGHS(kpis.gmv)}</p>
            <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">Platform GMV (Clear Filters)</p>
          </CardContent>
        </Card>

        <Card onClick={() => { handleClearFilters(); setSortKey('totalOrders'); }} className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="inline-flex p-1.5 rounded-lg mb-2 text-blue-600 bg-blue-50"><ShoppingBag className="h-4 w-4" /></div>
            <p className="text-xl font-bold text-gray-900 leading-tight">{kpis.totalOrders.toLocaleString()}</p>
            <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">Total Orders</p>
          </CardContent>
        </Card>


        <Card onClick={() => { handleClearFilters(); setSortKey('fulfilmentRate'); setSortDir('asc'); }} className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="inline-flex p-1.5 rounded-lg mb-2 text-rose-600 bg-rose-50"><Zap className="h-4 w-4" /></div>
            <p className="text-xl font-bold text-gray-900 leading-tight">{kpis.overallFulfilment}%</p>
            <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">Platform Fulfilment</p>
          </CardContent>
        </Card>
      </div>

      {/* Needs Attention - Now Clickable to Filter */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" /> Needs Attention (Click to filter)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <AttentionCard
            icon={<Package className="h-3.5 w-3.5 text-red-600" />}
            title="Orders but No Products"
            count={attention.ordersNoProducts.length}
            color="bg-red-50"
            items={attention.ordersNoProducts}
            emptyMsg="All vendors with orders have products listed ✓"
            isActive={attentionFilter === 'ordersNoProducts'}
            onClick={() => {
              setAttentionFilter(prev => prev === 'ordersNoProducts' ? 'none' : 'ordersNoProducts');
              setPage(1);
            }}
          />
          <AttentionCard
            icon={<Clock className="h-3.5 w-3.5 text-amber-600" />}
            title="New — No Orders Yet"
            count={attention.newNoActivity.length}
            color="bg-amber-50"
            items={attention.newNoActivity}
            emptyMsg="All new vendors have placed orders ✓"
            isActive={attentionFilter === 'newNoActivity'}
            onClick={() => {
              setAttentionFilter(prev => prev === 'newNoActivity' ? 'none' : 'newNoActivity');
              setPage(1);
            }}
          />
          <AttentionCard
            icon={<Activity className="h-3.5 w-3.5 text-blue-600" />}
            title="Went Silent (60+ days)"
            count={attention.wentSilent.length}
            color="bg-blue-50"
            items={attention.wentSilent}
            emptyMsg="No vendors have gone silent ✓"
            isActive={attentionFilter === 'wentSilent'}
            onClick={() => {
              setAttentionFilter(prev => prev === 'wentSilent' ? 'none' : 'wentSilent');
              setPage(1);
            }}
          />
        </div>
      </div>

      {/* Table Section */}
      <div id="vendor-table">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">All Vendors</h2>
          <span className="text-xs text-gray-400">{filtered.length} results</span>
        </div>

        {/* Filters */}
        <Card className="border shadow-sm mb-4">
          <CardContent className="px-4 py-3 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="relative max-w-xs flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  placeholder="Search name or email..."
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  className="pl-8 h-8 text-sm"
                />
              </div>

              {attentionFilter !== 'none' ? (
                <div className="flex items-center gap-2 bg-amber-50 text-amber-800 px-3 py-1.5 rounded-full text-xs font-medium border border-amber-200">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Showing "Needs Attention" Filter
                  <button onClick={handleClearFilters} className="ml-2 hover:bg-amber-200 p-0.5 rounded-full transition-colors">
                    <FilterX className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] text-gray-400 font-medium">Activity</span>
                    {([['all','All'],['active','Active'],['inactive','Inactive'],['new','New (30d)'],['no_orders','No Orders']] as [ActivityFilter,string][]).map(([f,l]) => (
                      <Pill key={f} active={activityFilter===f} onClick={() => { setActivityFilter(f); setPage(1); }}>{l}</Pill>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] text-gray-400 font-medium">Products</span>
                    {([['all','All'],['none','None'],['low','1–3'],['healthy','4+']] as [ProductFilter,string][]).map(([f,l]) => (
                      <Pill key={f} active={productFilter===f} onClick={() => { setProductFilter(f); setPage(1); }}>{l}</Pill>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] text-gray-400 font-medium">Revenue</span>
                    {([['all','All'],['zero','None'],['low','<500'],['mid','500–2k'],['high','>2k']] as [RevenueFilter,string][]).map(([f,l]) => (
                      <Pill key={f} active={revenueFilter===f} onClick={() => { setRevenueFilter(f); setPage(1); }}>{l}</Pill>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {(search || activityFilter !== 'all' || productFilter !== 'all' || revenueFilter !== 'all' || attentionFilter !== 'none') && (
              <button
                onClick={handleClearFilters}
                className="text-[11px] text-gray-400 hover:text-gray-700 underline underline-offset-2 flex items-center gap-1 mt-2"
              >
                Clear all filters
              </button>
            )}
          </CardContent>
        </Card>

        <Card className="border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50/80">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Vendor</th>
                  <SortTh label="Orders" sortKey="totalOrders" current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortTh label="Revenue" sortKey="totalRevenue" current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortTh label="Avg Order" sortKey="avgOrderValue" current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortTh label="Products" sortKey="productCount" current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortTh label="Fulfilment" sortKey="fulfilmentRate" current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortTh label="Last Active" sortKey="lastOrderAt" current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortTh label="Joined" sortKey="joinedAt" current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginated.map(vendor => {
                  const badge = activityBadge(vendor);
                  return (
                    <tr key={vendor.sellerId} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 flex-shrink-0">
                            <AvatarFallback className="text-xs font-semibold bg-gray-100 text-gray-600">
                              {getInitials(vendor.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 text-sm leading-tight truncate max-w-[160px]">{vendor.name}</p>
                            <p className="text-[11px] text-gray-400 truncate max-w-[160px]">{vendor.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-semibold text-gray-900">{vendor.totalOrders}</span>
                        {vendor.cancelledOrders > 0 && (
                          <span className="text-[10px] text-red-400 ml-1" title="Cancelled Orders">−{vendor.cancelledOrders}</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`font-semibold ${vendor.totalRevenue > 0 ? 'text-emerald-700' : 'text-gray-300'}`}>
                          {fmtGHS(vendor.totalRevenue)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-gray-600 tabular-nums">
                        {vendor.avgOrderValue > 0 ? fmtGHS(vendor.avgOrderValue) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3.5">
                        {vendor.productCount === 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                            <AlertTriangle className="h-3 w-3" /> None
                          </span>
                        ) : (
                          <span className="text-gray-700 font-medium">{vendor.productCount}</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5" title="Fulfilled / (Total Orders - Cancelled)">
                        <FulfilmentBar rate={vendor.fulfilmentRate} total={vendor.totalOrders - vendor.cancelledOrders} />
                      </td>
                      <td className="px-4 py-3.5 text-[12px] text-gray-500 tabular-nums">
                        {vendor.lastOrderAt ? `${daysSince(vendor.lastOrderAt)}d ago` : 'Never'}
                      </td>
                      <td className="px-4 py-3.5 text-[12px] text-gray-500">
                        {vendor.joinedAt
                          ? vendor.joinedAt.toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: '2-digit' })
                          : '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-sm text-gray-400">
                      No vendors match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {hasMore && (
            <div className="border-t px-5 py-4 flex items-center justify-between bg-gray-50/50">
              <p className="text-xs text-gray-400">Showing {paginated.length} of {filtered.length} vendors</p>
              <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} className="text-xs h-8 gap-1.5">
                Load more <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          {!hasMore && filtered.length > PAGE_SIZE && (
            <div className="border-t px-5 py-3 bg-gray-50/50">
              <p className="text-xs text-gray-400 text-center">All {filtered.length} vendors loaded</p>
            </div>
          )}
        </Card>

        <p className="text-[11px] text-gray-400 text-center mt-3">
          Revenue excludes cancelled orders. Fulfilment rate is calculated as: Fulfilled Orders ÷ (Total Orders - Cancelled Orders).
        </p>
      </div>
    </div>
  );
}