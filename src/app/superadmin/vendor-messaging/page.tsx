'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  PlusCircle,
  MessageSquare,
  Calendar,
  Send,
  MoreHorizontal,
  ChevronRight,
  Bot,
  Zap,
  AlertCircle,
  TrendingUp,
  XCircle,
  CheckCircle2,
  Filter,
  Search,
  Users,
  ClipboardList,
  FileText,
  RefreshCw,
  Clock,
  Phone,
  Globe,
  Star,
} from 'lucide-react';
import { useFirestore } from '@/firebase';
import { collection, query, orderBy, onSnapshot, getDocs, where, limit } from 'firebase/firestore';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { getAuth } from 'firebase/auth';

/* ─── Metric Card Component ─── */
function StatCard({ title, value, subtext, icon: Icon, colorClass }: any) {
  return (
    <Card className="border shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{title}</p>
          <div className={cn("p-1.5 rounded-lg bg-muted", colorClass)}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className="text-2xl font-black tracking-tight">{value}</div>
        <p className="text-[10px] text-muted-foreground mt-1 font-medium">{subtext}</p>
      </CardContent>
    </Card>
  );
}

/* ─── Main Dashboard Page ─── */
export default function VendorMessagingDashboard() {
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();

  const [activeTab, setActiveTab] = useState('overview');
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);

  // Filters
  const [campSearch, setCampSearch] = useState('');
  const [campStatus, setCampStatus] = useState('all');
  const [vendorSearch, setVendorSearch] = useState('');

  useEffect(() => {
    if (!firestore) return;

    // Listen to campaigns
    const q = query(collection(firestore, 'vendor_whatsapp_campaigns'), orderBy('createdAt', 'desc'));
    const unsubCamps = onSnapshot(q, (snap) => {
      setCampaigns(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.error(err);
      toast({ title: 'Access Denied', variant: 'destructive' });
    });

    // Fetch Recent Logs
    const logQuery = query(collection(firestore, 'vendor_whatsapp_send_logs'), orderBy('createdAt', 'desc'), limit(50));
    const unsubLogs = onSnapshot(logQuery, (snap) => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Fetch Vendors (Simplified Browser)
    const usersQuery = query(collection(firestore, 'users'), orderBy('createdAt', 'desc'), limit(100));
    const unsubUsers = onSnapshot(usersQuery, (snap) => {
      setVendors(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubCamps();
      unsubLogs();
      unsubUsers();
    };
  }, [firestore, toast]);

  // Derived Stats
  const stats = useMemo(() => {
    const totalCamps = campaigns.length;
    const ready = campaigns.filter(c => c.status === 'ready').length;
    const sending = campaigns.filter(c => c.status === 'sending').length;
    const sent = campaigns.filter(c => c.status === 'sent').length;
    const totalSent = campaigns.reduce((sum, c) => sum + (c.sentCount || 0), 0);
    const totalFailed = campaigns.reduce((sum, c) => sum + (c.failedCount || 0), 0);
    const successRate = totalSent + totalFailed > 0 
      ? Math.round((totalSent / (totalSent + totalFailed)) * 100) 
      : 0;

    return { totalCamps, ready, sending, sent, totalSent, totalFailed, successRate };
  }, [campaigns]);

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter(c => {
      const matchesSearch = !campSearch || c.title?.toLowerCase().includes(campSearch.toLowerCase());
      const matchesStatus = campStatus === 'all' || c.status === campStatus;
      return matchesSearch && matchesStatus;
    });
  }, [campaigns, campSearch, campStatus]);

  const filteredVendors = useMemo(() => {
    return vendors.filter(v => {
      const q = vendorSearch.toLowerCase();
      return !vendorSearch || 
             v.displayName?.toLowerCase().includes(q) || 
             v.businessName?.toLowerCase().includes(q) || 
             v.phone?.includes(q) ||
             v.email?.toLowerCase().includes(q);
    });
  }, [vendors, vendorSearch]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft': return <Badge variant="secondary">Draft</Badge>;
      case 'ready': return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Ready</Badge>;
      case 'sending': return <Badge className="bg-yellow-100 text-yellow-800 animate-pulse border-yellow-200">Sending</Badge>;
      case 'sent': return <Badge className="bg-green-100 text-green-800 border-green-200">Sent</Badge>;
      case 'failed': return <Badge variant="destructive">Failed</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-muted-foreground" /></div>;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            Vendor Messaging Center
          </h1>
          <p className="text-sm text-muted-foreground">Command center for outbound vendor WhatsApp communications.</p>
        </div>
        <Button asChild className="shadow-lg shadow-primary/20 font-bold">
          <Link href="/superadmin/vendor-messaging/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            New Campaign
          </Link>
        </Button>
      </div>

      {/* ── KPI GRID ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Campaigns" value={stats.totalCamps} subtext={`${stats.sending} currently active`} icon={MessageSquare} />
        <StatCard title="Messages Sent" value={stats.totalSent.toLocaleString()} subtext="Successful delivery" icon={Send} colorClass="text-emerald-600" />
        <StatCard title="Total Failures" value={stats.totalFailed.toLocaleString()} subtext="API or phone errors" icon={XCircle} colorClass="text-red-600" />
        <StatCard title="Avg Success Rate" value={`${stats.successRate}%`} subtext="Overall delivery performance" icon={TrendingUp} colorClass="text-blue-600" />
      </div>

      {/* ── TABS ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/50 p-1 h-auto flex flex-wrap sm:inline-flex">
          <TabsTrigger value="overview" className="text-xs py-1.5 px-3">Overview</TabsTrigger>
          <TabsTrigger value="campaigns" className="text-xs py-1.5 px-3">Campaigns ({campaigns.length})</TabsTrigger>
          <TabsTrigger value="recipients" className="text-xs py-1.5 px-3">Recipient Browser</TabsTrigger>
          <TabsTrigger value="logs" className="text-xs py-1.5 px-3">Live Logs</TabsTrigger>
          <TabsTrigger value="templates" className="text-xs py-1.5 px-3">Templates</TabsTrigger>
        </TabsList>

        {/* ── OVERVIEW TAB ── */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base">Recent Campaigns</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {campaigns.slice(0, 5).map(c => (
                    <div key={c.id} onClick={() => router.push(`/superadmin/vendor-messaging/${c.id}`)} className="flex items-center justify-between p-4 hover:bg-muted/30 cursor-pointer group transition-colors">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{c.title}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{c.type} • {c.audienceType?.replace(/_/g, ' ')}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {getStatusBadge(c.status)}
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
                <Button variant="ghost" className="w-full text-xs text-muted-foreground h-10 border-t rounded-none" onClick={() => setActiveTab('campaigns')}>View All Campaigns</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base">Recent Activity Logs</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {logs.slice(0, 6).map(l => (
                    <div key={l.id} className="flex items-center gap-3 p-4">
                      <div className={cn("h-2 w-2 rounded-full shrink-0", l.status === 'sent' ? 'bg-emerald-500' : 'bg-red-500')} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold leading-none">{l.vendorName || l.recipientPhone}</p>
                        <p className="text-[10px] text-muted-foreground mt-1 truncate">{l.status === 'sent' ? `Message ID: ${l.providerMessageId}` : l.error || 'Failed to send'}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">{formatDistanceToNow(l.createdAt?.toDate ? l.createdAt.toDate() : new Date(), { addSuffix: true })}</span>
                    </div>
                  ))}
                </div>
                <Button variant="ghost" className="w-full text-xs text-muted-foreground h-10 border-t rounded-none" onClick={() => setActiveTab('logs')}>View All Logs</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── CAMPAIGNS TAB ── */}
        <TabsContent value="campaigns">
          <Card>
            <CardHeader className="border-b pb-4">
              <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search campaigns..." value={campSearch} onChange={e => setCampSearch(e.target.value)} className="pl-9 h-9 text-sm" />
                </div>
                <div className="flex items-center gap-2">
                   <Select value={campStatus} onValueChange={setCampStatus}>
                     <SelectTrigger className="h-9 w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
                     <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="ready">Ready</SelectItem>
                        <SelectItem value="sending">Sending</SelectItem>
                        <SelectItem value="sent">Sent</SelectItem>
                     </SelectContent>
                   </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/20">
                    <TableHead>Title</TableHead>
                    <TableHead>Audience</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Metrics</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCampaigns.map(c => {
                    const total = (c.sentCount || 0) + (c.failedCount || 0);
                    const rate = total > 0 ? Math.round((c.sentCount / total) * 100) : 0;
                    return (
                      <TableRow key={c.id} className="cursor-pointer hover:bg-muted/20" onClick={() => router.push(`/superadmin/vendor-messaging/${c.id}`)}>
                        <TableCell>
                          <p className="font-semibold text-sm">{c.title}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">{c.type}</p>
                        </TableCell>
                        <TableCell className="text-xs capitalize">{c.audienceType?.replace(/_/g, ' ')}</TableCell>
                        <TableCell>{getStatusBadge(c.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end">
                            <p className="text-sm font-bold">{c.sentCount || 0} / {c.totalRecipients || 0}</p>
                            {total > 0 && <p className={cn("text-[10px] font-bold", rate > 80 ? 'text-emerald-600' : 'text-amber-600')}>{rate}% Success</p>}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{c.createdAt?.toDate ? format(c.createdAt.toDate(), 'MMM d, yyyy') : '-'}</TableCell>
                        <TableCell><ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredCampaigns.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center py-20 text-muted-foreground italic">No campaigns found matching filters.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── RECIPIENT BROWSER TAB ── */}
        <TabsContent value="recipients">
          <Card>
             <CardHeader className="border-b">
                <div className="flex items-center gap-4">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search name, phone, email, store..." value={vendorSearch} onChange={e => setVendorSearch(e.target.value)} className="pl-9 h-9 text-sm" />
                  </div>
                  <Button variant="outline" size="sm" className="gap-2"><Filter className="h-4 w-4" /> Filter</Button>
                </div>
             </CardHeader>
             <CardContent className="p-0">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow className="bg-muted/20">
                      <TableHead>Vendor / Store</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Activity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVendors.map(v => (
                      <TableRow key={v.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-bold">{v.displayName || 'Unnamed'}</span>
                            <span className="text-muted-foreground">{v.businessName || 'No store'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {v.phone || '-'}</span>
                            <span className="text-muted-foreground">{v.email || '-'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{v.subscription?.planId || 'free'}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={v.status === 'suspended' ? 'destructive' : 'default'} className="scale-75 origin-left">{v.status || 'active'}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{v.lastSeen?.toDate ? formatDistanceToNow(v.lastSeen.toDate(), { addSuffix: true }) : '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
             </CardContent>
          </Card>
        </TabsContent>

        {/* ── LOGS TAB ── */}
        <TabsContent value="logs">
          <Card>
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2"><Clock className="h-4 w-4" /> Live Global Logs</CardTitle>
                <span className="text-[10px] text-muted-foreground">Showing last 50 events</span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
               <Table className="text-[11px]">
                 <TableHeader>
                   <TableRow className="bg-muted/20">
                     <TableHead>Timestamp</TableHead>
                     <TableHead>Recipient</TableHead>
                     <TableHead>Template</TableHead>
                     <TableHead>Status</TableHead>
                     <TableHead>Details</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                    {logs.map(l => (
                      <TableRow key={l.id}>
                        <TableCell className="font-mono text-muted-foreground">{l.createdAt?.toDate ? format(l.createdAt.toDate(), 'HH:mm:ss') : '-'}</TableCell>
                        <TableCell>
                           <div className="flex flex-col">
                              <span className="font-bold">{l.vendorName || '-'}</span>
                              <span className="text-muted-foreground">{l.recipientPhone}</span>
                           </div>
                        </TableCell>
                        <TableCell className="font-mono text-blue-600">{l.templateName}</TableCell>
                        <TableCell>
                           <Badge variant={l.status === 'sent' ? 'default' : 'destructive'} className="scale-75 origin-left uppercase text-[9px]">{l.status}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-muted-foreground italic">
                           {l.status === 'sent' ? l.providerMessageId : l.error || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                 </TableBody>
               </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TEMPLATES TAB ── */}
        <TabsContent value="templates">
          <Card>
             <CardHeader className="border-b flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2"><FileText className="h-4 w-4" /> Approved Templates</CardTitle>
                  <CardDescription>Manual registry of WhatsApp templates approved by Meta.</CardDescription>
                </div>
                <Button variant="outline" size="sm" disabled><PlusCircle className="h-3.5 w-3.5 mr-1.5" /> Register Template</Button>
             </CardHeader>
             <CardContent className="p-10 text-center text-muted-foreground space-y-4">
                <div className="bg-muted/50 p-6 rounded-2xl max-w-md mx-auto border border-dashed">
                  <Globe className="h-10 w-10 mx-auto mb-4 opacity-30" />
                  <p className="font-bold text-foreground">Cloud API Integration Pending</p>
                  <p className="text-xs mt-2 leading-relaxed">Template management is currently handled via environment variables. Full Meta catalog synchronization will be available in the next release.</p>
                </div>
             </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
