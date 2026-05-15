'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useFirestore } from '@/firebase';
import { getAuth } from 'firebase/auth';
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { startOfDay, subDays } from 'date-fns';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Bar, BarChart as RechartsBarChart, ResponsiveContainer, XAxis, YAxis, Tooltip as RechartsTooltip } from 'recharts';
import Image from 'next/image';
import Link from 'next/link';

import {
  Loader2, MessageSquare, ShoppingCart, TrendingUp, Bot, UserCheck, Zap,
  DollarSign, BarChart3, RefreshCw, Sparkles, ListChecks, ShoppingBasket,
  HelpCircle, Filter, AlertTriangle, Smile, ShoppingBag, Users, CreditCard,
  PartyPopper, Store, TrendingDown, CheckCircle2, Info, Truck, ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

import { DailyReport } from '@/types/analytics';
import { Product } from '@/types/product';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Analytics {
  overview: {
    totalConversations: number;
    activeConversations: number;
    totalMessages: number;
    avgMessagesPerConvo: number;
    handoverCount: number;
    handoverRate: string;
  };
  revenue: {
    totalRevenue: number;
    aiRevenue: number;
    aiOrderCount: number;
    totalOrderCount: number;
    aiRevenueShare: string;
    conversionRate: string;
    avgOrderValue: number;
  };
  channels: Record<string, number>;
  trends: {
    conversations: Array<{ date: string; count: number }>;
    revenue: Array<{ date: string; amount: number }>;
  };
  recentAiOrders: Array<{
    id: string;
    customerName: string;
    totalAmount: number;
    status: string;
    createdAt: string;
    items: Array<{ name: string; quantity: number; price: number }>;
  }>;
}

interface ActionItem {
  id: string;
  priority: 'high' | 'medium' | 'low';
  icon: React.ElementType;
  title: string;
  description: string;
  link: string;
  linkText: string;
  category: 'setup' | 'sales' | 'delivery' | 'payment' | 'ai';
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CHANNEL_LABELS: Record<string, string> = {
  ai_chat: 'Website Chat',
  web: 'Website Chat',
  instagram: 'Instagram DM',
  whatsapp: 'WhatsApp',
};

const STATUS_COLORS: Record<string, string> = {
  'awaiting-payment': 'bg-yellow-100 text-yellow-800',
  'paid': 'bg-green-100 text-green-800',
  'confirmed': 'bg-blue-100 text-blue-800',
  'delivered': 'bg-green-100 text-green-800',
  'cancelled': 'bg-red-100 text-red-800',
};

// ── Rule Engine ───────────────────────────────────────────────────────────────

function generateActionItems(
  store: any,
  reports: DailyReport[],
  products: Map<string, Product>,
  deliveries: any[]
): ActionItem[] {
  const items: ActionItem[] = [];

  const hasAnyPayment = store?.isPaystackActive || store?.isMomoActive ||
    store?.isBankPaymentActive || store?.isCodActive || store?.momoNumber || store?.bankName;
  if (!hasAnyPayment) {
    items.push({ id: 'no-payment', priority: 'high', icon: CreditCard, title: 'No payment methods active', description: 'Customers cannot complete purchases. Set up at least one payment method to start accepting orders.', link: '/dashboard/payments', linkText: 'Set Up Payments', category: 'payment' });
  }

  if (!store?.isPaystackActive) {
    items.push({ id: 'no-paystack', priority: 'medium', icon: Zap, title: 'Enable Automated Payments (Card & MoMo)', description: 'Accept card and MoMo payments automatically via Paystack. Setup takes 30 seconds and increases checkout completion rates significantly.', link: '/dashboard/payments', linkText: 'Enable Paystack', category: 'payment' });
  }

  if (!deliveries || deliveries.length === 0) {
    items.push({ id: 'no-delivery', priority: 'high', icon: Truck, title: 'No delivery zones configured', description: 'Customers are asking about delivery but your AI has no fee information to share. Add at least one delivery zone so the AI can close sales.', link: '/dashboard/deliveries', linkText: 'Add Delivery Zones', category: 'delivery' });
  }

  if (!store?.isReturnPolicyActive || !store?.returnPolicy) {
    items.push({ id: 'no-refund-policy', priority: 'medium', icon: ShieldCheck, title: 'Add a return & refund policy', description: 'Customers frequently ask about returns. Without a policy, every return question is handed to you manually. A clear policy builds trust and reduces your workload.', link: '/dashboard/deliveries', linkText: 'Add Policy', category: 'setup' });
  }

  if (!store?.deliveryNotice && !store?.deliveryTimeline) {
    items.push({ id: 'no-delivery-timeline', priority: 'low', icon: Truck, title: 'Set a delivery timeline', description: 'Let customers know when to expect their orders (e.g. "1-2 business days"). This reduces "where is my order" messages significantly.', link: '/dashboard/deliveries', linkText: 'Set Timeline', category: 'delivery' });
  }

  if (!store?.isAboutUsActive || !store?.aboutUs) {
    items.push({ id: 'no-about', priority: 'low', icon: Store, title: 'Add an About Us section', description: 'Give your store personality. An about us section builds customer trust and helps your AI represent your brand more authentically.', link: '/dashboard/appearance', linkText: 'Add About Us', category: 'setup' });
  }

  if (reports.length > 0) {
    const deliveryQuestions = reports.reduce((sum, r) => sum + (r.questionCategories?.delivery || 0), 0);
    if (deliveryQuestions > 5 && (!deliveries || deliveries.length === 0)) {
      items.push({ id: 'delivery-questions-high', priority: 'high', icon: HelpCircle, title: `${deliveryQuestions} delivery questions — AI is handing over`, description: 'Customers are repeatedly asking about delivery but the AI has no zones to reference. Every handover is a potential lost sale.', link: '/dashboard/deliveries', linkText: 'Add Delivery Zones', category: 'delivery' });
    }

    const objectionCounts: Record<string, number> = {};
    reports.forEach(r => { if (!r.objectionTypes) return; for (const [k, v] of Object.entries(r.objectionTypes)) objectionCounts[k] = (objectionCounts[k] || 0) + v; });
    const priceObjections = objectionCounts['price'] || objectionCounts['too expensive'] || 0;
    if (priceObjections > 3) {
      const demandMap: Record<string, { name: string; mentions: number }> = {};
      reports.forEach(r => { if (!r.productInterest) return; for (const [pid, data] of Object.entries(r.productInterest)) { if (!demandMap[pid]) demandMap[pid] = { name: data.name, mentions: 0 }; demandMap[pid].mentions += data.mentions || 0; } });
      const topProduct = Object.entries(demandMap).sort((a, b) => b[1].mentions - a[1].mentions)[0];
      items.push({ id: 'price-objections', priority: 'high', icon: TrendingDown, title: `Price objections recorded ${priceObjections} times${topProduct ? ` — "${topProduct[1].name}" most affected` : ''}`, description: 'Customers are hesitating due to price. Consider a limited discount or bundle offer to improve conversion on your top products.', link: '/dashboard/marketing', linkText: 'Create Discount', category: 'sales' });
    }

    const totalMentions = reports.reduce((s, r) => s + (r.conversionFunnel?.browsing || 0), 0);
    const totalCheckouts = reports.reduce((s, r) => s + (r.conversionFunnel?.checkout_created || 0), 0);
    const convRate = totalMentions > 0 ? (totalCheckouts / totalMentions) * 100 : 0;
    if (totalMentions > 10 && convRate < 20) {
      items.push({ id: 'low-ai-conversion', priority: 'medium', icon: TrendingDown, title: `AI browsing-to-checkout rate is low (${convRate.toFixed(1)}%)`, description: 'Many customers are browsing but not checking out via AI. Check that product prices, images, and descriptions are complete and compelling.', link: '/dashboard/products', linkText: 'Review Products', category: 'ai' });
    }

    const totalConversations = reports.reduce((s, r) => s + (r.conversionFunnel?.started || 0), 0);
    const handovers = reports.reduce((s, r) => s + (r.handoverCount || 0), 0);
    const handoverRate = totalConversations > 0 ? (handovers / totalConversations) * 100 : 0;
    if (totalConversations > 5 && handoverRate > 40) {
      items.push({ id: 'high-handover', priority: 'medium', icon: AlertTriangle, title: `AI is handing over ${handoverRate.toFixed(0)}% of conversations`, description: 'The AI is frequently passing conversations to you. Add delivery zones, payment info, and a return policy to reduce handovers.', link: '/dashboard/ai-assistant', linkText: 'Improve AI Setup', category: 'ai' });
    }

    const negSentiment = reports.reduce((s, r) => s + (r.sentiment?.negative || 0), 0);
    const totalSentiment = reports.reduce((s, r) => s + (r.sentiment?.positive || 0) + (r.sentiment?.neutral || 0) + (r.sentiment?.negative || 0), 0);
    const negRate = totalSentiment > 0 ? (negSentiment / totalSentiment) * 100 : 0;
    if (totalSentiment > 5 && negRate > 25) {
      items.push({ id: 'negative-sentiment', priority: 'high', icon: AlertTriangle, title: `${negRate.toFixed(0)}% of customer conversations show negative sentiment`, description: 'A significant portion of customers are frustrated in chats. Review recent conversations to identify and resolve the underlying issues.', link: '/dashboard/inbox', linkText: 'Review Conversations', category: 'sales' });
    }
  }

  const productList = Array.from(products.values());
  const noImage = productList.filter(p => !p.images || p.images.length === 0);
  if (noImage.length > 0) {
    items.push({ id: 'products-no-image', priority: 'medium', icon: ShoppingBag, title: `${noImage.length} product${noImage.length > 1 ? 's' : ''} missing images`, description: 'Products without images are much less likely to convert. Add photos to all your products to improve sales.', link: '/dashboard/products', linkText: 'Update Products', category: 'sales' });
  }

  const noDesc = productList.filter(p => !p.description || p.description.length < 20);
  if (noDesc.length > 0) {
    items.push({ id: 'products-no-description', priority: 'low', icon: ShoppingBag, title: `${noDesc.length} product${noDesc.length > 1 ? 's' : ''} missing descriptions`, description: 'Short or missing descriptions reduce trust and mean the AI cannot answer detailed product questions.', link: '/dashboard/products', linkText: 'Update Products', category: 'sales' });
  }

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const seen = new Set<string>();
  return items
    .filter(item => { if (seen.has(item.id)) return false; seen.add(item.id); return true; })
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}

// ── Small Helpers ─────────────────────────────────────────────────────────────

function MetricCard({ title, value, subtitle, icon: Icon, iconColor, iconBg }: {
  title: string; value: string; subtitle: string; icon: any; iconColor: string; iconBg: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">{title}</p>
            <p className="text-xl font-bold tracking-tight">{value}</p>
            <p className="text-[11px] text-muted-foreground">{subtitle}</p>
          </div>
          <div className={cn('p-2 rounded-lg', iconBg)}>
            <Icon className={cn('h-4 w-4', iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const SentimentBar = ({ label, value, colorClass }: { label: string; value: number; colorClass: string }) => (
  <div>
    <div className="flex justify-between items-center mb-1">
      <span className="text-sm font-medium">{label}</span>
      <span className="text-sm font-bold">{value.toFixed(1)}%</span>
    </div>
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
      <div className={`h-full transition-all ${colorClass}`} style={{ width: `${value}%` }} />
    </div>
  </div>
);

const FunnelStep = ({ icon: Icon, title, value }: { icon: React.ElementType; title: string; value: number }) => (
  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
    <div className="flex items-center gap-3">
      <Icon className="h-5 w-5 text-primary" />
      <p className="font-semibold">{title}</p>
    </div>
    <p className="text-xl font-bold">{value}</p>
  </div>
);

const FunnelDropOff = ({ rate }: { rate: number }) => (
  <div className="flex justify-center items-center gap-2 text-xs text-red-600 font-semibold">
    <div className="w-px h-4 bg-red-200" />
    <span>{rate.toFixed(1)}% drop-off</span>
    <div className="w-px h-4 bg-red-200" />
  </div>
);

// ── Section: Action Items ─────────────────────────────────────────────────────

function ActionItemsSection({ reports, products, loading }: { reports: DailyReport[]; products: Map<string, Product>; loading: boolean }) {
  const { activeStore } = useAuth();
  const firestore = useFirestore();
  const [deliveries, setDeliveries] = useState<any[]>([]);

  useEffect(() => {
    if (!activeStore?.id || !firestore) return;
    const unsub = onSnapshot(query(collection(firestore, 'stores', activeStore.id, 'deliveries')), snap => setDeliveries(snap.docs));
    return () => unsub();
  }, [activeStore?.id, firestore]);

  const actionItems = useMemo(() => {
    if (!activeStore) return [];
    return generateActionItems(activeStore, reports, products, deliveries);
  }, [activeStore, reports, products, deliveries]);

  const priorityColors = { high: 'bg-red-100 text-red-700 border-red-200', medium: 'bg-yellow-100 text-yellow-700 border-yellow-200', low: 'bg-blue-100 text-blue-700 border-blue-200' };
  const priorityBorder = { high: 'border-l-red-500', medium: 'border-l-yellow-500', low: 'border-l-blue-400' };

  if (loading) return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ListChecks /> Action Items</CardTitle>
        <CardDescription>Scanning your store for improvements...</CardDescription>
      </CardHeader>
      <CardContent className="flex h-32 items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
      </CardContent>
    </Card>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ListChecks /> Action Items
              {actionItems.length > 0 && <Badge variant="destructive" className="ml-1">{actionItems.length}</Badge>}
            </CardTitle>
            <CardDescription>Real-time recommendations based on your store data and AI conversations.</CardDescription>
          </div>
          {actionItems.length === 0 && (
            <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
              <CheckCircle2 className="h-5 w-5" /> All good!
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {actionItems.length > 0 ? actionItems.map(item => (
          <div key={item.id} className={`flex items-start gap-4 p-4 rounded-lg border border-l-4 bg-card hover:bg-muted/30 transition-colors ${priorityBorder[item.priority]}`}>
            <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
              <item.icon className="h-4 w-4 text-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-semibold text-sm">{item.title}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize shrink-0 ${priorityColors[item.priority]}`}>{item.priority}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
            </div>
            <Button asChild variant="outline" size="sm" className="shrink-0">
              <Link href={item.link}>{item.linkText}</Link>
            </Button>
          </div>
        )) : (
          <div className="text-center py-12 text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-green-500 opacity-80" />
            <p className="font-semibold text-foreground">Your store is fully optimized</p>
            <p className="text-sm mt-1">No action items right now. Check back as your AI collects more data.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Section: Performance Metrics ─────────────────────────────────────────────

function PerformanceMetricsSection({ analytics, loading, onRefresh }: { analytics: Analytics | null; loading: boolean; onRefresh: () => void }) {
  if (loading) return (
    <div className="flex justify-center items-center py-10">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
  if (!analytics) return null;

  const { overview, revenue, channels, trends, recentAiOrders } = analytics;

  return (
    <div className="space-y-6">
      {/* Metrics Row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard title="AI Revenue" value={`GHS ${revenue.aiRevenue.toLocaleString()}`} subtitle={`${revenue.aiRevenueShare}% of total revenue`} icon={DollarSign} iconColor="text-green-600" iconBg="bg-green-50" />
        <MetricCard title="AI Orders" value={revenue.aiOrderCount.toString()} subtitle={`of ${revenue.totalOrderCount} total orders`} icon={ShoppingCart} iconColor="text-blue-600" iconBg="bg-blue-50" />
        <MetricCard title="Conversations" value={overview.totalConversations.toString()} subtitle={`${overview.activeConversations} active now`} icon={MessageSquare} iconColor="text-purple-600" iconBg="bg-purple-50" />
        <MetricCard title="Conversion Rate" value={`${revenue.conversionRate}%`} subtitle="Chats that led to orders" icon={TrendingUp} iconColor="text-orange-600" iconBg="bg-orange-50" />
      </div>

      {/* Metrics Row 2 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard title="Avg Order Value" value={`GHS ${revenue.avgOrderValue.toLocaleString()}`} subtitle="Per AI-assisted order" icon={BarChart3} iconColor="text-indigo-600" iconBg="bg-indigo-50" />
        <MetricCard title="Messages Handled" value={overview.totalMessages.toLocaleString()} subtitle={`~${overview.avgMessagesPerConvo} per conversation`} icon={Bot} iconColor="text-teal-600" iconBg="bg-teal-50" />
        <MetricCard title="Handovers" value={overview.handoverCount.toString()} subtitle={`${overview.handoverRate}% of conversations`} icon={UserCheck} iconColor="text-amber-600" iconBg="bg-amber-50" />
        <MetricCard title="Automation Rate" value={`${(100 - parseFloat(overview.handoverRate)).toFixed(1)}%`} subtitle="Handled without human help" icon={Zap} iconColor="text-emerald-600" iconBg="bg-emerald-50" />
      </div>

      {/* Channel Breakdown + Revenue Trend */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conversations by Channel</CardTitle>
            <CardDescription>Where your customers are chatting from</CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(channels).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No conversation data yet</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(channels).sort(([, a], [, b]) => b - a).map(([channel, count]) => {
                  const percentage = overview.totalConversations > 0
                    ? ((count / overview.totalConversations) * 100).toFixed(0) : '0';
                  return (
                    <div key={channel} className="space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{CHANNEL_LABELS[channel] || channel}</span>
                        <span className="text-muted-foreground">{count} ({percentage}%)</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all',
                            channel === 'whatsapp' ? 'bg-green-500' :
                            channel === 'instagram' ? 'bg-pink-500' : 'bg-primary'
                          )}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI Revenue Trend</CardTitle>
            <CardDescription>Daily AI-assisted revenue (last 30 days)</CardDescription>
          </CardHeader>
          <CardContent>
            {trends.revenue.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No revenue data yet. AI orders will appear here.</p>
            ) : (
              <div className="space-y-2">
                {trends.revenue.slice(-14).map(({ date, amount }) => {
                  const maxAmount = Math.max(...trends.revenue.map(r => r.amount));
                  const width = maxAmount > 0 ? (amount / maxAmount) * 100 : 0;
                  const displayDate = new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                  return (
                    <div key={date} className="flex items-center gap-3 text-sm">
                      <span className="text-muted-foreground w-16 text-xs flex-shrink-0">{displayDate}</span>
                      <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                        <div className="h-full bg-green-500 rounded transition-all" style={{ width: `${width}%` }} />
                      </div>
                      <span className="font-medium w-20 text-right text-xs">GHS {amount.toFixed(0)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Daily Conversations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daily Conversations</CardTitle>
          <CardDescription>Chat volume over the last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          {trends.conversations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No conversation data yet</p>
          ) : (
            <div className="flex items-end gap-1 h-32">
              {(() => {
                const last14 = trends.conversations.slice(-14);
                const maxCount = Math.max(...last14.map(c => c.count), 1);
                return last14.map(({ date, count }) => {
                  const height = (count / maxCount) * 100;
                  const displayDate = new Date(date).toLocaleDateString('en-GB', { day: 'numeric' });
                  return (
                    <div key={date} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex items-end justify-center" style={{ height: '100px' }}>
                        <div
                          className="w-full max-w-[24px] bg-primary/80 rounded-t transition-all hover:bg-primary"
                          style={{ height: `${Math.max(height, 4)}%` }}
                          title={`${date}: ${count} conversations`}
                        />
                      </div>
                      <span className="text-[9px] text-muted-foreground">{displayDate}</span>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent AI Orders */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent AI-Assisted Orders</CardTitle>
          <CardDescription>Orders created through AI conversations</CardDescription>
        </CardHeader>
        <CardContent>
          {recentAiOrders.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="font-medium">No AI orders yet</p>
              <p className="text-sm mt-1">When customers complete orders through the AI chat, they will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentAiOrders.map(order => (
                <div key={order.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{order.customerName}</p>
                      <Badge variant="outline" className={cn('text-[10px] capitalize', STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-800')}>
                        {order.status.replace(/-/g, ' ')}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {order.items.map(i => `${i.name} x${i.quantity}`).join(', ')}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(order.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <p className="font-bold text-sm flex-shrink-0 ml-3">GHS {order.totalAmount.toFixed(2)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Section: Product Demand ───────────────────────────────────────────────────

function ProductDemandSection({ reports, products, loading }: { reports: DailyReport[]; products: Map<string, Product>; loading: boolean }) {
  const demandAnalytics = useMemo(() => {
    const demandMap = new Map<string, { name: string; mentions: number; checkouts: number }>();
    reports.forEach(report => {
      if (!report.productInterest) return;
      for (const [productId, data] of Object.entries(report.productInterest)) {
        const current = demandMap.get(productId) || { name: data.name, mentions: 0, checkouts: 0 };
        current.mentions += data.mentions || 0;
        current.checkouts += data.checkouts || 0;
        demandMap.set(productId, current);
      }
    });
    return Array.from(demandMap.entries()).map(([id, data]) => {
      const productInfo = products.get(id);
      return {
        id, name: productInfo?.name || data.name,
        imageUrl: productInfo?.images?.[0] || 'https://placehold.co/40x40',
        mentions: data.mentions, checkouts: data.checkouts,
        conversionRate: data.mentions > 0 ? (data.checkouts / data.mentions) * 100 : 0,
      };
    }).sort((a, b) => b.mentions - a.mentions);
  }, [reports, products]);

  if (loading) return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ShoppingBasket /> Product Demand</CardTitle>
        <CardDescription>Top products by customer interest in the last 30 days.</CardDescription>
      </CardHeader>
      <CardContent className="flex h-48 items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
      </CardContent>
    </Card>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingBasket /> Product Demand
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger><Info className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent className="max-w-xs"><p>Products most discussed and added to checkout by the AI assistant in the last 30 days.</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
        <CardDescription>Top products by customer interest in the last 30 days.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[350px]">Product</TableHead>
              <TableHead>Mentions</TableHead>
              <TableHead>AI Checkouts</TableHead>
              <TableHead className="w-[200px]">Interest-to-Checkout Rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {demandAnalytics.length > 0 ? demandAnalytics.map(product => (
              <TableRow key={product.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Image src={product.imageUrl || 'https://placehold.co/40x40'} alt={product.name} width={40} height={40} className="rounded-md object-cover aspect-square" />
                    <span className="font-medium">{product.name}</span>
                  </div>
                </TableCell>
                <TableCell className="font-bold">{product.mentions}</TableCell>
                <TableCell className="font-bold">{product.checkouts}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold w-12">{product.conversionRate.toFixed(1)}%</span>
                    <Progress value={product.conversionRate} className="h-2" />
                  </div>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={4} className="h-48 text-center text-muted-foreground">
                  No product demand data yet. This will populate as customers interact with your AI assistant.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ── Section: Question Intelligence ───────────────────────────────────────────

function QuestionIntelligenceSection({ reports, loading }: { reports: DailyReport[]; loading: boolean }) {
  const questionData = useMemo(() => {
    const counts: Record<string, number> = {};
    reports.forEach(r => { if (!r.questionCategories) return; for (const [k, v] of Object.entries(r.questionCategories)) counts[k] = (counts[k] || 0) + v; });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [reports]);

  if (loading) return (
    <Card className="h-full">
      <CardHeader><CardTitle className="flex items-center gap-2"><HelpCircle /> Top Customer Questions</CardTitle></CardHeader>
      <CardContent className="flex h-48 items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-muted-foreground" /></CardContent>
    </Card>
  );

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><HelpCircle /> Top Customer Questions</CardTitle>
        <CardDescription>What your customers are asking about most.</CardDescription>
      </CardHeader>
      <CardContent>
        {questionData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <RechartsBarChart data={questionData} layout="vertical" margin={{ left: 20 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={100} tick={{ fontSize: 12 }} />
              <RechartsTooltip cursor={{ fill: 'hsl(var(--muted))' }} />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </RechartsBarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-48 items-center justify-center text-center text-sm text-muted-foreground">
            <div><HelpCircle className="h-8 w-8 mb-2 opacity-30 mx-auto" /><p>No question data available yet.</p></div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Section: Conversion Funnel ────────────────────────────────────────────────

function ConversionFunnelSection({ reports, loading }: { reports: DailyReport[]; loading: boolean }) {
  const { funnel, browsingDropOff, checkoutDropOff, paidDropOff } = useMemo(() => {
    const f = { started: 0, browsing: 0, checkout_created: 0, paid: 0 };
    reports.forEach(r => {
      if (!r.conversionFunnel) return;
      f.started += r.conversionFunnel.started || 0;
      f.browsing += r.conversionFunnel.browsing || 0;
      f.checkout_created += r.conversionFunnel.checkout_created || 0;
      f.paid += r.conversionFunnel.paid || 0;
    });
    const drop = (from: number, to: number) => from === 0 ? 0 : ((from - to) / from) * 100;
    return { funnel: f, browsingDropOff: drop(f.started, f.browsing), checkoutDropOff: drop(f.browsing, f.checkout_created), paidDropOff: drop(f.checkout_created, f.paid) };
  }, [reports]);

  if (loading) return (
    <Card className="h-full">
      <CardHeader><CardTitle className="flex items-center gap-2"><Filter /> AI Conversion Funnel</CardTitle></CardHeader>
      <CardContent className="flex h-48 items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-muted-foreground" /></CardContent>
    </Card>
  );

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter /> AI Conversion Funnel
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger><Info className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent className="max-w-xs"><p>Tracks how many customers who start a chat end up making a purchase.</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
        <CardDescription>How customers move from chat to checkout.</CardDescription>
      </CardHeader>
      <CardContent>
        {funnel.started > 0 ? (
          <div className="space-y-4">
            <FunnelStep icon={Users} title="Conversations Started" value={funnel.started} />
            <FunnelDropOff rate={browsingDropOff} />
            <FunnelStep icon={ShoppingBag} title="Browsing Products" value={funnel.browsing} />
            <FunnelDropOff rate={checkoutDropOff} />
            <FunnelStep icon={CreditCard} title="Checkouts Created by AI" value={funnel.checkout_created} />
            <FunnelDropOff rate={paidDropOff} />
            <FunnelStep icon={PartyPopper} title="Purchases Completed" value={funnel.paid} />
          </div>
        ) : (
          <div className="flex h-48 flex-col items-center justify-center text-center text-sm text-muted-foreground">
            <Filter className="h-8 w-8 mb-2 opacity-30" /><p>No conversion data yet.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Section: Objection Intelligence ──────────────────────────────────────────

function ObjectionIntelligenceSection({ reports, loading }: { reports: DailyReport[]; loading: boolean }) {
  const objectionData = useMemo(() => {
    const counts: Record<string, number> = {};
    reports.forEach(r => { if (!r.objectionTypes) return; for (const [k, v] of Object.entries(r.objectionTypes)) counts[k] = (counts[k] || 0) + v; });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [reports]);

  if (loading) return (
    <Card className="h-full">
      <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle /> Objection Intelligence</CardTitle></CardHeader>
      <CardContent className="flex h-48 items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-muted-foreground" /></CardContent>
    </Card>
  );

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><AlertTriangle /> Objection Intelligence</CardTitle>
        <CardDescription>Top reasons customers hesitate to buy.</CardDescription>
      </CardHeader>
      <CardContent>
        {objectionData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <RechartsBarChart data={objectionData} layout="vertical" margin={{ left: 20 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={100} tick={{ fontSize: 12 }} />
              <RechartsTooltip cursor={{ fill: 'hsl(var(--muted))' }} />
              <Bar dataKey="value" fill="hsl(var(--destructive) / 0.7)" radius={[0, 4, 4, 0]} />
            </RechartsBarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-48 items-center justify-center text-center text-sm text-muted-foreground">
            <div><AlertTriangle className="h-8 w-8 mb-2 opacity-30 mx-auto" /><p>No objections recorded yet.</p></div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Section: Sentiment Analysis ───────────────────────────────────────────────

function SentimentAnalysisSection({ reports, loading }: { reports: DailyReport[]; loading: boolean }) {
  const sentimentData = useMemo(() => {
    const t = { positive: 0, neutral: 0, negative: 0 };
    reports.forEach(r => { if (!r.sentiment) return; t.positive += r.sentiment.positive || 0; t.neutral += r.sentiment.neutral || 0; t.negative += r.sentiment.negative || 0; });
    const total = t.positive + t.neutral + t.negative;
    if (total === 0) return null;
    return { positive: (t.positive / total) * 100, neutral: (t.neutral / total) * 100, negative: (t.negative / total) * 100 };
  }, [reports]);

  if (loading) return (
    <Card className="h-full">
      <CardHeader><CardTitle className="flex items-center gap-2"><Smile /> Sentiment Analysis</CardTitle></CardHeader>
      <CardContent className="flex h-48 items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-muted-foreground" /></CardContent>
    </Card>
  );

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Smile /> Sentiment Analysis</CardTitle>
        <CardDescription>The overall mood of customer conversations.</CardDescription>
      </CardHeader>
      <CardContent>
        {sentimentData ? (
          <div className="space-y-4">
            <SentimentBar label="Positive" value={sentimentData.positive} colorClass="bg-green-500" />
            <SentimentBar label="Neutral" value={sentimentData.neutral} colorClass="bg-yellow-500" />
            <SentimentBar label="Negative" value={sentimentData.negative} colorClass="bg-red-500" />
          </div>
        ) : (
          <div className="flex h-48 items-center justify-center text-center text-sm text-muted-foreground">
            <div><Smile className="h-8 w-8 mb-2 opacity-30 mx-auto" /><p>Not enough data for sentiment analysis.</p></div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AiInsightsPage() {
  const { activeStore } = useAuth();
  const firestore = useFirestore();

  // Firestore state (intelligence sections)
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [products, setProducts] = useState<Map<string, Product>>(new Map());
  const [reportsLoading, setReportsLoading] = useState(true);

  // API state (performance metrics section)
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  // Fetch products from Firestore
  useEffect(() => {
    if (!activeStore?.id || !firestore) return;
    const unsub = onSnapshot(
      query(collection(firestore, 'products'), where('storeId', '==', activeStore.id)),
      snap => {
        const m = new Map<string, Product>();
        snap.docs.forEach(d => m.set(d.id, { id: d.id, ...d.data() } as Product));
        setProducts(m);
      }
    );
    return () => unsub();
  }, [activeStore?.id, firestore]);

  // Fetch daily reports from Firestore
  useEffect(() => {
    if (!activeStore?.id || !firestore) { setReportsLoading(false); return; }
    setReportsLoading(true);
    const thirtyDaysAgo = startOfDay(subDays(new Date(), 30));
    const unsub = onSnapshot(
      query(
        collection(firestore, 'stores', activeStore.id, 'reports'),
        where('date', '>=', thirtyDaysAgo.toISOString().split('T')[0]),
        orderBy('date', 'desc'),
        limit(30)
      ),
      snap => { setReports(snap.docs.map(d => d.data() as DailyReport)); setReportsLoading(false); },
      () => setReportsLoading(false)
    );
    return () => unsub();
  }, [activeStore?.id, firestore]);

  // Fetch analytics from API
  const fetchAnalytics = useCallback(async () => {
    if (!activeStore?.id) return;
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`/api/ai/analytics?storeId=${activeStore.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || 'Failed to load analytics'); }
      setAnalytics(await res.json());
    } catch (err: any) {
      setAnalyticsError(err.message);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [activeStore?.id]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="text-primary" /> AI Insights
          </h1>
          <p className="text-muted-foreground text-sm">Your AI-powered commerce intelligence engine. Last 30 days.</p>
        </div>
        <Button onClick={fetchAnalytics} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* 1. Action Items */}
      <ActionItemsSection reports={reports} products={products} loading={reportsLoading} />

      {/* 2. Performance Metrics (API) */}
      {analyticsError ? (
        <div className="text-center py-10">
          <p className="text-muted-foreground mb-4">{analyticsError}</p>
          <Button onClick={fetchAnalytics} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" /> Retry
          </Button>
        </div>
      ) : (
        <PerformanceMetricsSection analytics={analytics} loading={analyticsLoading} onRefresh={fetchAnalytics} />
      )}

      {/* 3. Product Demand */}
      <ProductDemandSection reports={reports} products={products} loading={reportsLoading} />

      {/* 4. Questions + Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <QuestionIntelligenceSection reports={reports} loading={reportsLoading} />
        <ConversionFunnelSection reports={reports} loading={reportsLoading} />
      </div>

      {/* 5. Objections + Sentiment */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ObjectionIntelligenceSection reports={reports} loading={reportsLoading} />
        <SentimentAnalysisSection reports={reports} loading={reportsLoading} />
      </div>
    </div>
  );
}