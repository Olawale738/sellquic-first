'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useRequireSuperAdmin } from '@/hooks/use-auth';
import { useFirestore } from '@/firebase';
import { doc, getDocs, collection, query, orderBy, onSnapshot, limit, where } from 'firebase/firestore';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Loader2,
  ArrowLeft,
  MessageSquare,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Search,
  Filter,
  Send,
  RefreshCw,
  Zap,
  ClipboardList,
  FileText,
  AlertCircle,
  Bot,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { getAuth } from 'firebase/auth';

type Recipient = {
  id: string;
  vendorId: string;
  vendorName: string;
  businessName: string;
  phone: string;
  planId: string;
  subscriptionStatus: string;
  status: 'pending' | 'skipped' | 'sent' | 'delivered' | 'read' | 'failed' | 'sending';
  skippedReason: string | null;
  failureReason: string | null;
  providerMessageId?: string | null;
};

export default function CampaignDetailPage() {
  useRequireSuperAdmin();
  const { campaignId } = useParams();
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('summary');
  const [campaign, setCampaign] = useState<any>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isSendingBatch, setIsSendingBatch] = useState(false);

  // 1. Subscribe to Campaign Metadata
  useEffect(() => {
    if (!firestore || !campaignId) return;

    const unsub = onSnapshot(doc(firestore, 'vendor_whatsapp_campaigns', campaignId as string), (snap) => {
      if (snap.exists()) {
        setCampaign({ id: snap.id, ...snap.data() });
      } else {
        router.push('/superadmin/vendor-messaging');
      }
    });

    return () => unsub();
  }, [firestore, campaignId, router]);

  // 2. Fetch Recipients & Logs
  const fetchDetails = useCallback(async () => {
    if (!firestore || !campaignId) return;
    try {
      const [recipientsSnap, logsSnap] = await Promise.all([
        getDocs(query(collection(firestore, 'vendor_whatsapp_campaigns', campaignId as string, 'recipients'), orderBy('vendorName', 'asc'))),
        getDocs(query(collection(firestore, 'vendor_whatsapp_send_logs'), where('campaignId', '==', campaignId), orderBy('createdAt', 'desc'), limit(100)))
      ]);

      setRecipients(recipientsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Recipient)));
      setLogs(logsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error('[Campaign Detail] Fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, [firestore, campaignId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  // Derived Metrics
  const metrics = useMemo(() => {
    if (!campaign) return null;
    const sentCount = campaign.sentCount || 0;
    const failedCount = campaign.failedCount || 0;
    const totalProcessed = sentCount + failedCount;
    const eligible = campaign.eligibleRecipients || 0;
    const successRate = totalProcessed > 0 ? Math.round((sentCount / totalProcessed) * 100) : 0;
    const progress = eligible > 0 ? Math.round((totalProcessed / eligible) * 100) : 0;
    
    return { sentCount, failedCount, totalProcessed, eligible, successRate, progress };
  }, [campaign]);

  // 3. Batch Sending Logic
  const handleSendBatch = async () => {
    if (isSendingBatch) return;
    setIsSendingBatch(true);
    toast({ title: 'Sending batch...', description: 'Messaging next 25 vendors.' });

    try {
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      
      const res = await fetch('/api/superadmin/vendor-messaging/send-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ campaignId, batchSize: 25 }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send batch');

      toast({ 
        title: 'Batch Complete', 
        description: `Sent: ${data.sentCount}, Failed: ${data.failedCount}. ${data.isFinished ? 'Campaign finished!' : 'More batches remaining.'}` 
      });
      
      fetchDetails(); 
    } catch (err: any) {
      toast({ title: 'Send Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsSendingBatch(false);
    }
  };

  const filteredRecipients = useMemo(() => {
    return recipients.filter((r) => {
      const matchesSearch =
        !search ||
        r.vendorName?.toLowerCase().includes(search.toLowerCase()) ||
        r.businessName?.toLowerCase().includes(search.toLowerCase()) ||
        r.phone?.includes(search);

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'eligible' && r.status === 'pending') ||
        (statusFilter === 'sent' && r.status === 'sent') ||
        (statusFilter === 'failed' && r.status === 'failed') ||
        (statusFilter === 'skipped' && r.status === 'skipped');

      return matchesSearch && matchesStatus;
    });
  }, [recipients, search, statusFilter]);

  const failures = useMemo(() => {
    return recipients.filter(r => r.status === 'failed' || r.status === 'skipped');
  }, [recipients]);

  if (loading || !campaign || !metrics) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto pb-20">
      {/* ── HEADER ── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/superadmin/vendor-messaging')} className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tighter uppercase">{campaign.title}</h1>
              <Badge variant={campaign.status === 'sent' ? 'default' : 'secondary'} className="uppercase text-[10px] h-5">{campaign.status}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1 uppercase tracking-widest font-bold">{campaign.type} • {campaign.audienceType?.replace(/_/g, ' ')}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
           <Button variant="outline" size="sm" onClick={fetchDetails} disabled={isSendingBatch} className="h-9 px-4">
             <RefreshCw className={cn("h-4 w-4 mr-2", isSendingBatch && "animate-spin")} /> Refresh
           </Button>

           {['ready', 'sending', 'paused'].includes(campaign.status) && (
             <Button onClick={handleSendBatch} disabled={isSendingBatch} className="h-9 px-6 font-bold shadow-lg shadow-primary/20">
                {isSendingBatch ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Send Next Batch (25)
             </Button>
           )}
        </div>
      </div>

      {/* ── TABS ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/50 p-1 h-auto flex flex-wrap sm:inline-flex">
          <TabsTrigger value="summary" className="text-xs py-1.5 px-3">Summary</TabsTrigger>
          <TabsTrigger value="recipients" className="text-xs py-1.5 px-3">Recipients ({recipients.length})</TabsTrigger>
          <TabsTrigger value="failures" className="text-xs py-1.5 px-3">Failures ({failures.length})</TabsTrigger>
          <TabsTrigger value="logs" className="text-xs py-1.5 px-3">Raw Logs</TabsTrigger>
          <TabsTrigger value="message" className="text-xs py-1.5 px-3">Message Preview</TabsTrigger>
        </TabsList>

        {/* ── SUMMARY TAB ── */}
        <TabsContent value="summary" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <Card className="md:col-span-2">
                <CardHeader>
                   <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Delivery Progress</CardTitle>
                </CardHeader>
                <CardContent className="space-y-8">
                   <div className="space-y-3">
                      <div className="flex justify-between items-end">
                         <span className="text-3xl font-black">{metrics.progress}%</span>
                         <span className="text-sm text-muted-foreground font-medium">{metrics.totalProcessed} of {metrics.eligible} eligible sent</span>
                      </div>
                      <Progress value={metrics.progress} className="h-3" />
                   </div>

                   <div className="grid grid-cols-3 gap-8 pt-4 border-t">
                      <div>
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Success Rate</p>
                        <p className="text-2xl font-bold text-emerald-600">{metrics.successRate}%</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Successful</p>
                        <p className="text-2xl font-bold">{metrics.sentCount}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Failed</p>
                        <p className={cn("text-2xl font-bold", metrics.failedCount > 0 ? 'text-red-600' : 'text-muted-foreground')}>{metrics.failedCount}</p>
                      </div>
                   </div>
                </CardContent>
             </Card>

             <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Audience Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                     <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Total Detected</span>
                        <span className="font-bold">{campaign.totalRecipients}</span>
                     </div>
                     <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Eligible</span>
                        <span className="font-bold text-blue-600">{campaign.eligibleRecipients}</span>
                     </div>
                     <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Skipped (No Phone/Opt-out)</span>
                        <span className="font-bold text-amber-600">{campaign.skippedRecipients}</span>
                     </div>
                  </CardContent>
                </Card>

                <Card className="bg-muted/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Configuration</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-xs">
                     <p><strong>Template:</strong> {campaign.templateName || 'System Default'}</p>
                     <p><strong>Language:</strong> {campaign.templateLanguage || 'en_US'}</p>
                     <p><strong>Created:</strong> {format(campaign.createdAt.toDate(), 'PPP p')}</p>
                  </CardContent>
                </Card>
             </div>
          </div>
        </TabsContent>

        {/* ── RECIPIENTS TAB ── */}
        <TabsContent value="recipients">
          <Card>
            <CardHeader className="border-b pb-4">
              <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search name, phone..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 w-[130px]"><SelectValue placeholder="All Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="eligible">Pending</SelectItem>
                    <SelectItem value="skipped">Skipped</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow className="bg-muted/20">
                      <TableHead>Vendor</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Details / Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecipients.map(r => (
                      <TableRow key={r.id} className={cn(r.status === 'skipped' && 'opacity-60')}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-bold">{r.vendorName}</span>
                            <span className="text-[10px] text-muted-foreground">{r.businessName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono">{r.phone}</TableCell>
                        <TableCell>
                           <Badge variant={r.status === 'sent' ? 'default' : r.status === 'failed' ? 'destructive' : 'outline'} className="scale-75 origin-left">{r.status}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground italic truncate max-w-[200px]">
                           {r.status === 'failed' ? r.failureReason : r.status === 'skipped' ? r.skippedReason : r.providerMessageId || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── FAILURES TAB ── */}
        <TabsContent value="failures">
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                 <CardHeader><CardTitle>Failure Breakdown</CardTitle></CardHeader>
                 <CardContent className="p-0">
                    <Table className="text-xs">
                       <TableHeader><TableRow className="bg-muted/20"><TableHead>Vendor</TableHead><TableHead>Type</TableHead><TableHead>Reason</TableHead></TableRow></TableHeader>
                       <TableBody>
                          {failures.map(f => (
                            <TableRow key={f.id}>
                               <TableCell><div className="flex flex-col"><span className="font-bold">{f.vendorName}</span><span className="text-muted-foreground">{f.phone}</span></div></TableCell>
                               <TableCell><Badge variant="outline" className="uppercase text-[9px]">{f.status}</Badge></TableCell>
                               <TableCell className="text-red-600 font-medium">{f.failureReason || f.skippedReason?.replace(/_/g, ' ')}</TableCell>
                            </TableRow>
                          ))}
                          {failures.length === 0 && <TableRow><TableCell colSpan={3} className="text-center py-20 text-muted-foreground italic">No failures recorded for this campaign. Great job! ✓</TableCell></TableRow>}
                       </TableBody>
                    </Table>
                 </CardContent>
              </Card>

              <Card>
                 <CardHeader><CardTitle className="text-sm font-bold uppercase tracking-widest">Common Issues</CardTitle></CardHeader>
                 <CardContent className="space-y-6">
                    <div className="p-4 bg-muted/30 rounded-xl space-y-4">
                       <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Missing Phone</p>
                          <p className="text-lg font-bold">{recipients.filter(r => r.skippedReason === 'missing_phone').length}</p>
                       </div>
                       <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Invalid Format</p>
                          <p className="text-lg font-bold">{recipients.filter(r => r.skippedReason === 'invalid_phone').length}</p>
                       </div>
                       <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Meta API Errors</p>
                          <p className="text-lg font-bold">{recipients.filter(r => r.status === 'failed').length}</p>
                       </div>
                    </div>
                    <Alert className="bg-blue-50 border-blue-100">
                       <AlertCircle className="h-4 w-4 text-blue-600" />
                       <AlertDescription className="text-[10px] text-blue-700 leading-tight">Failed messages are not automatically retried. Check the logs to see if the issue is with the template or the recipient's phone number.</AlertDescription>
                    </Alert>
                 </CardContent>
              </Card>
           </div>
        </TabsContent>

        {/* ── LOGS TAB ── */}
        <TabsContent value="logs">
           <Card>
             <CardHeader className="border-b">
                <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2"><ClipboardList className="h-4 w-4" /> Activity Logs</CardTitle>
             </CardHeader>
             <CardContent className="p-0">
                <Table className="text-[11px]">
                   <TableHeader><TableRow className="bg-muted/20"><TableHead>Time</TableHead><TableHead>Vendor</TableHead><TableHead>Status</TableHead><TableHead>Meta Response</TableHead></TableRow></TableHeader>
                   <TableBody>
                      {logs.map(log => (
                        <TableRow key={log.id}>
                           <TableCell className="font-mono text-muted-foreground">{format(log.createdAt.toDate(), 'HH:mm:ss')}</TableCell>
                           <TableCell><span className="font-bold">{log.vendorName}</span><br/><span className="text-muted-foreground">{log.recipientPhone}</span></TableCell>
                           <TableCell><Badge variant={log.status === 'sent' ? 'default' : 'destructive'} className="scale-75 origin-left uppercase">{log.status}</Badge></TableCell>
                           <TableCell className="max-w-[400px] truncate font-mono text-[10px]">{log.status === 'sent' ? log.providerMessageId : log.error || JSON.stringify(log.providerResponse)}</TableCell>
                        </TableRow>
                      ))}
                      {logs.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-20 text-muted-foreground italic">No logs found for this campaign yet.</TableCell></TableRow>}
                   </TableBody>
                </Table>
             </CardContent>
           </Card>
        </TabsContent>

        {/* ── MESSAGE TAB ── */}
        <TabsContent value="message">
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                 <CardHeader><CardTitle>Message Content</CardTitle></CardHeader>
                 <CardContent className="space-y-6">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Raw Body</Label>
                       <div className="p-6 bg-muted/30 border rounded-2xl font-mono text-sm whitespace-pre-wrap leading-relaxed">
                          {campaign.messageBody}
                       </div>
                    </div>
                    {campaign.ctaUrl && (
                      <div className="space-y-2">
                         <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Call to Action (CTA)</Label>
                         <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-100 text-blue-700 rounded-xl text-sm font-medium">
                            <Zap className="h-4 w-4" />
                            <a href={campaign.ctaUrl} target="_blank" rel="noopener" className="underline">{campaign.ctaUrl}</a>
                         </div>
                      </div>
                    )}
                 </CardContent>
              </Card>

              <Card className="border-primary/20 shadow-xl">
                 <CardHeader className="bg-primary text-primary-foreground rounded-t-xl">
                    <CardTitle className="text-sm uppercase font-black tracking-widest flex items-center gap-2"><Bot className="h-4 w-4" /> WhatsApp Preview</CardTitle>
                 </CardHeader>
                 <CardContent className="p-6">
                    <div className="bg-[#ECE5DD] p-4 rounded-xl space-y-3 relative shadow-inner min-h-[300px]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='400' height='400' viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cpattern id='p' width='100' height='100' patternUnits='userSpaceOnUse'%3E%3Cpath d='M10 10h4v4h-4z' fill='%23667788' opacity='0.03'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='400' height='400' fill='url(%23p)'/%3E%3C/svg%3E")` }}>
                       <div className="bg-white p-3 rounded-xl rounded-tl-none shadow-sm max-w-[90%] border border-black/5">
                          <p className="text-xs leading-relaxed">
                             {campaign.messageBody
                               .replace(/{{name}}/g, 'Vendor')
                               .replace(/{{businessName}}/g, 'Your Store')
                             }
                          </p>
                          <div className="flex justify-end items-center gap-1 mt-1 opacity-50">
                             <span className="text-[9px]">12:00 PM</span>
                             <CheckCircle2 className="h-2.5 w-2.5 text-blue-500" />
                          </div>
                       </div>

                       {campaign.ctaUrl && (
                         <div className="flex justify-center">
                            <div className="bg-white w-full rounded-lg py-2 text-center text-blue-600 text-[11px] font-bold shadow-sm border-t-4 border-t-primary/20">
                               Open Link
                            </div>
                         </div>
                       )}
                    </div>
                 </CardContent>
              </Card>
           </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}