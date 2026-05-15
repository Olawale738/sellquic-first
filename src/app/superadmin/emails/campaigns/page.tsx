'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
import { Loader2, Mail, PlusCircle, Send, Calendar as CalendarIcon, Eye, BarChart2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useRequireSuperAdmin } from '@/hooks/use-auth';
import { getAuth } from 'firebase/auth';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';


export default function EmailCampaignsPage() {
    useRequireSuperAdmin();
    const { toast } = useToast();
    const firestore = useFirestore();

    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [templates, setTemplates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSending, setIsSending] = useState(false);
    
    const [selectedTemplate, setSelectedTemplate] = useState('');
    const [selectedSegment, setSelectedSegment] = useState('all');
    const [scheduledAt, setScheduledAt] = useState<Date | undefined>();
    const [customEmail, setCustomEmail] = useState('');
    const [activeTab, setActiveTab] = useState('all');

    useEffect(() => {
        if (!firestore) return;
        setLoading(true);

        const campaignsQuery = query(collection(firestore, 'email_campaigns'), orderBy('createdAt', 'desc'));
        const templatesQuery = query(collection(firestore, 'email_templates'), orderBy('createdAt', 'desc'));

        const unsubCampaigns = onSnapshot(campaignsQuery, (snapshot) => {
            setCampaigns(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        
        const unsubTemplates = onSnapshot(templatesQuery, (snapshot) => {
            setTemplates(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        
        setLoading(false);

        return () => {
            unsubCampaigns();
            unsubTemplates();
        };

    }, [firestore]);


    const handleSendCampaign = async () => {
        if (!selectedTemplate || !selectedSegment) {
            toast({ title: "Please select a template and recipient group.", variant: "destructive" });
            return;
        }
        if (selectedSegment === 'specific' && !customEmail.trim()) {
            toast({ title: "Please enter an email address for testing.", variant: "destructive" });
            return;
        }

        setIsSending(true);
        try {
             const auth = getAuth();
             const idToken = await auth.currentUser?.getIdToken();
             const response = await fetch('/api/superadmin/emails/campaigns/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}`},
                body: JSON.stringify({ 
                    templateId: selectedTemplate, 
                    segment: selectedSegment,
                    scheduledAt: scheduledAt ? scheduledAt.toISOString() : null,
                    customEmail: selectedSegment === 'specific' ? customEmail : null,
                }),
             });
             
             const result = await response.json();
             if (!response.ok) {
                 throw new Error(result.error || 'Failed to send campaign.');
             }

             toast({ title: 'Campaign Sent/Scheduled!', description: result.message });
             setIsDialogOpen(false);
             setScheduledAt(undefined);
             setCustomEmail('');
        } catch (error: any) {
             toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsSending(false);
        }
    };

    const getStatusVariant = (status: string) => {
      switch(status) {
        case 'sent': return 'default';
        case 'sending': return 'secondary';
        case 'scheduled': return 'secondary';
        case 'draft': return 'outline';
        default: return 'outline';
      }
    }

    const filteredCampaigns = useMemo(() => {
        if (activeTab === 'all') {
          return campaigns;
        }
        return campaigns.filter(c => c.status === activeTab);
    }, [campaigns, activeTab]);


    return (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>Email Campaigns</CardTitle>
                            <CardDescription>Send marketing and update emails to your vendors.</CardDescription>
                        </div>
                        <DialogTrigger asChild>
                            <Button><PlusCircle className="mr-2 h-4 w-4" /> New Campaign</Button>
                        </DialogTrigger>
                    </div>
                </CardHeader>
                <CardContent>
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
                        <TabsList>
                            <TabsTrigger value="all">All</TabsTrigger>
                            <TabsTrigger value="sent">Sent</TabsTrigger>
                            <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
                        </TabsList>
                    </Tabs>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Campaign</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Recipients</TableHead>
                                <TableHead>Opens</TableHead>
                                <TableHead>Clicks</TableHead>
                                <TableHead>Open Rate</TableHead>
                                <TableHead>Date</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center h-24">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                                    </TableCell>
                                </TableRow>
                            ) : filteredCampaigns.length > 0 ? (
                                filteredCampaigns.map(c => {
                                    const openRate = c.recipientCount > 0 ? ((c.openCount || 0) / c.recipientCount) * 100 : 0;
                                    return (
                                        <TableRow key={c.id}>
                                            <TableCell className="font-semibold">{c.templateName || 'Unknown Template'}</TableCell>
                                            <TableCell><Badge variant={getStatusVariant(c.status)} className="capitalize">{c.status}</Badge></TableCell>
                                            <TableCell>{c.recipientCount > 0 ? `${c.recipientCount} vendors (${c.segment})` : c.segment === 'specific' ? c.customEmail : '-'}</TableCell>
                                            <TableCell>{c.openCount || 0}</TableCell>
                                            <TableCell>{c.clickCount || 0}</TableCell>
                                            <TableCell>{openRate.toFixed(1)}%</TableCell>
                                            <TableCell>
                                                {c.status === 'scheduled' && c.scheduledAt ? `Scheduled for ${new Date(c.scheduledAt.seconds * 1000).toLocaleString()}` : 
                                                (c.sentAt ? new Date(c.sentAt.seconds * 1000).toLocaleString() : 'Not sent')}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            ) : (
                                 <TableRow>
                                    <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                                        No campaigns found for this filter.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Create New Campaign</DialogTitle>
                    <DialogDescription>Select a template and choose who to send it to. Send immediately or schedule for later.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="template-select">Email Template</Label>
                        <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                            <SelectTrigger id="template-select"><SelectValue placeholder="Select a template..." /></SelectTrigger>
                            <SelectContent>
                                {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="segment-select">Recipient Group</Label>
                        <Select value={selectedSegment} onValueChange={setSelectedSegment}>
                            <SelectTrigger id="segment-select"><SelectValue placeholder="Select recipients..." /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Vendors</SelectItem>
                                <SelectItem value="paid">Paid Vendors Only</SelectItem>
                                <SelectItem value="free">Free Vendors Only</SelectItem>
                                <SelectItem value="inactive_14d">Inactive 14+ days</SelectItem>
                                <SelectItem value="inactive_30d">Inactive 30+ days</SelectItem>
                                <SelectItem value="expiring_7d">Plan expiring in 7 days</SelectItem>
                                <SelectItem value="expiring_30d">Plan expiring in 30 days</SelectItem>
                                <SelectItem value="specific">Specific Email (Test)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {selectedSegment === 'specific' && (
                        <div className="space-y-2">
                            <Label htmlFor="custom-email">Email Address</Label>
                            <Input 
                                id="custom-email"
                                type="email"
                                placeholder="test@example.com"
                                value={customEmail}
                                onChange={(e) => setCustomEmail(e.target.value)}
                            />
                        </div>
                    )}

                     <div className="space-y-2">
                        <Label>Schedule (Optional)</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                variant={"outline"}
                                className={cn(
                                    "w-full justify-start text-left font-normal",
                                    !scheduledAt && "text-muted-foreground"
                                )}
                                >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {scheduledAt ? format(scheduledAt, "PPP") : <span>Send immediately</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar mode="single" selected={scheduledAt} onSelect={setScheduledAt} initialFocus />
                            </PopoverContent>
                        </Popover>
                     </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleSendCampaign} disabled={isSending}>
                        {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4"/>}
                        {scheduledAt ? 'Schedule' : 'Send Now'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
