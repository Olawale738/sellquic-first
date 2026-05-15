'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRequireSuperAdmin } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Bot, TrendingUp, ShoppingCart, MessageSquare, ArrowUpRight, ArrowDownRight, RefreshCw, Instagram, Globe, Store, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getAuth } from 'firebase/auth';
import { format } from 'date-fns';
import { AnimatedCounter } from '@/components/animated-counter';

/* ─── Channel Helpers ─── */
const channelConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  whatsapp: {
    label: 'WhatsApp',
    color: 'bg-green-100 text-green-800 border-green-200',
    icon: <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>,
  },
  instagram: {
    label: 'Instagram',
    color: 'bg-pink-100 text-pink-800 border-pink-200',
    icon: <Instagram className="h-4 w-4" />,
  },
  webchat: {
    label: 'Web Chat',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: <Globe className="h-4 w-4" />,
  },
  storefront: {
    label: 'Storefront',
    color: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: <Store className="h-4 w-4" />,
  },
};

function ChannelBadge({ channel }: { channel: string }) {
  const config = channelConfig[channel] || channelConfig.webchat;
  return (
    <Badge variant="outline" className={`${config.color} gap-1.5`}>
      {config.icon}
      {config.label}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    'fulfilled': 'bg-green-100 text-green-800',
    'processing': 'bg-blue-100 text-blue-800',
    'pending': 'bg-yellow-100 text-yellow-800',
    'awaiting-payment': 'bg-orange-100 text-orange-800',
    'cancelled': 'bg-red-100 text-red-800',
    'confirmed': 'bg-green-100 text-green-800',
  };
  return (
    <Badge variant="outline" className={styles[status] || 'bg-gray-100 text-gray-800'}>
      {status.replace(/-/g, ' ')}
    </Badge>
  );
}

/* ─── Metric Card ─── */
function MetricCard({ title, value, subtext, trend, icon }: {
  title: string;
  value: string | number;
  subtext: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardDescription className="text-sm">{title}</CardDescription>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">
          {typeof value === 'number' ? <AnimatedCounter to={value} /> : value}
        </div>
        <div className="flex items-center gap-1 mt-1">
          {trend === 'up' && <ArrowUpRight className="h-3 w-3 text-green-600" />}
          {trend === 'down' && <ArrowDownRight className="h-3 w-3 text-red-600" />}
          <p className="text-xs text-muted-foreground">{subtext}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Channel Stat Card ─── */
function ChannelStatCard({ channel, orders, revenue }: { channel: string; orders: number; revenue: number }) {
  const config = channelConfig[channel] || channelConfig.webchat;
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${config.color}`}>
              {config.icon}
            </div>
            <span className="font-semibold">{config.label}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-2xl font-bold">{orders}</p>
            <p className="text-xs text-muted-foreground">orders</p>
          </div>
          <div>
            <p className="text-2xl font-bold">₵{revenue.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">revenue</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Simple Bar Chart ─── */
function SimpleBarChart({ data }: { data: Array<{ date: string; ai: number; manual: number }> }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        No order data yet. Orders will appear here as they come in.
      </div>
    );
  }

  const maxVal = Math.max(...data.map(d => d.ai + d.manual), 1);

  return (
    <div className="flex items-end gap-1 h-48">
      {data.slice(-14).map((d, i) => {
        const aiHeight = (d.ai / maxVal) * 100;
        const manualHeight = (d.manual / maxVal) * 100;
        const dayLabel = format(new Date(d.date), 'dd');
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5" title={`${d.date}: ${d.ai} AI, ${d.manual} manual`}>
            <div className="w-full flex flex-col justify-end" style={{ height: '160px' }}>
              {d.manual > 0 && (
                <div className="w-full bg-muted rounded-t-sm" style={{ height: `${manualHeight}%` }} />
              )}
              {d.ai > 0 && (
                <div className="w-full bg-primary rounded-t-sm" style={{ height: `${aiHeight}%` }} />
              )}
            </div>
            <span className="text-[10px] text-muted-foreground">{dayLabel}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Main Page ─── */
export default function AiAnalyticsPage() {
  useRequireSuperAdmin();
  const { toast } = useToast();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');
  const [channelFilter, setChannelFilter] = useState('all');

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = await getAuth().currentUser?.getIdToken();
      if (!token) throw new Error('Not authenticated');

      const res = await fetch(`/api/superadmin/ai-analytics?period=${period}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch analytics');
      const result = await res.json();
      setData(result.data);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [period]);

  const filteredOrders = useMemo(() => {
    if (!data?.recentAiOrders) return [];
    if (channelFilter === 'all') return data.recentAiOrders;
    return data.recentAiOrders.filter((o: any) => o.channel === channelFilter);
  }, [data, channelFilter]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8" />
      </div>
    );
  }

  const overview = data?.overview || {};
  const channels = data?.channelStats || {};
  const trend = data?.dailyTrend || [];
  const topVendors = data?.topVendors || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="h-6 w-6" />
            AI Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track AI-assisted sales across WhatsApp, Instagram, and Web Chat
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchData}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Overview Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="AI-Assisted Orders"
          value={overview.aiOrders || 0}
          subtext={`${overview.aiPercentage || 0}% of all orders`}
          icon={<Bot className="h-5 w-5" />}
        />
        <MetricCard
          title="AI Revenue"
          value={`₵${(overview.aiRevenue || 0).toLocaleString()}`}
          subtext={`vs ₵${(overview.manualRevenue || 0).toLocaleString()} manual`}
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <MetricCard
          title="AI Avg Order Value"
          value={`₵${(overview.aiAOV || 0).toFixed(0)}`}
          subtext={`Manual: ₵${(overview.manualAOV || 0).toFixed(0)}`}
          icon={<ShoppingCart className="h-5 w-5" />}
        />
        <MetricCard
          title="Conversion Rate"
          value={`${overview.conversionRate || 0}%`}
          subtext={`${overview.totalConversations || 0} conversations → ${overview.aiOrders || 0} orders`}
          icon={<MessageSquare className="h-5 w-5" />}
        />
      </div>

      {/* Channel Breakdown + Trend Chart */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Channel Cards */}
        <div className="space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">By Channel</h3>
          {Object.keys(channels).length > 0 ? (
            Object.entries(channels).map(([ch, stats]: [string, any]) => (
              <ChannelStatCard key={ch} channel={ch} orders={stats.orders} revenue={stats.revenue} />
            ))
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
                No AI orders yet. Channel data will appear here as orders come in.
              </CardContent>
            </Card>
          )}
        </div>

        {/* Trend Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Orders Trend</CardTitle>
            <CardDescription>AI (purple) vs Manual (gray) orders per day</CardDescription>
          </CardHeader>
          <CardContent>
            <SimpleBarChart data={trend} />
            <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-sm bg-primary" />
                AI-Assisted
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-sm bg-muted" />
                Manual
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Vendors by AI Revenue */}
      {topVendors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Vendors by AI Revenue</CardTitle>
            <CardDescription>Vendors generating the most revenue through AI-assisted sales</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="text-right">AI Orders</TableHead>
                  <TableHead className="text-right">AI Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topVendors.map((v: any, i: number) => (
                  <TableRow key={v.sellerId}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground w-5">{i + 1}.</span>
                        <span className="font-medium">{v.storeName || v.sellerId}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{v.orders}</TableCell>
                    <TableCell className="text-right font-semibold">₵{v.revenue.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Recent AI Orders */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <CardTitle className="text-base">AI-Assisted Orders</CardTitle>
              <CardDescription>{filteredOrders.length} orders</CardDescription>
            </div>
            <Tabs value={channelFilter} onValueChange={setChannelFilter}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
                <TabsTrigger value="instagram">Instagram</TabsTrigger>
                <TabsTrigger value="webchat">Web Chat</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {filteredOrders.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order: any) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{order.customerName}</p>
                        <p className="text-xs text-muted-foreground">{order.customerPhone}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{order.storeName}</TableCell>
                    <TableCell><ChannelBadge channel={order.channel} /></TableCell>
                    <TableCell>{order.itemCount}</TableCell>
                    <TableCell className="font-semibold">₵{order.amount.toLocaleString()}</TableCell>
                    <TableCell><StatusBadge status={order.status} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(order.createdAt), 'PP')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-12 text-center">
              <Bot className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <h3 className="font-semibold mb-1">No AI-assisted orders yet</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                When customers place orders through your AI assistants on WhatsApp, Instagram, or Web Chat, they&apos;ll appear here with full attribution data.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}