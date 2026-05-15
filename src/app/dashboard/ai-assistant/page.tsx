'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useAuth, useRequireAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import {
  Loader2, Sparkles, Edit, CheckCircle2, AlertTriangle,
  Copy, Plus, Trash2, Wand2, Instagram, AlertCircle as AlertCircleIcon,
  Unlink, MessageCircle, Phone, PlusCircle, Link as LinkIcon,
  ChevronDown, ChevronUp, ArrowRight, Check, Bot, Zap, User,
  Palette, HelpCircle, Settings2, RefreshCw,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import Link from 'next/link';
import { getAuth } from 'firebase/auth';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

declare global {
  interface Window { PaystackPop: any; }
}

const forceTopLevelRedirect = (url: string) => {
  const a = document.createElement('a');
  a.href = url; a.target = '_top'; a.rel = 'noopener noreferrer';
  a.style.display = 'none'; document.body.appendChild(a);
  a.click(); document.body.removeChild(a);
};

// ─── TopUpDialog ────────────────────────────────────────────────────────────
function TopUpDialog({ open, onOpenChange, onConfirm }: {
  open: boolean; onOpenChange: (open: boolean) => void; onConfirm: (amount: number) => void;
}) {
  const [amount, setAmount] = useState(10);
  const [customAmount, setCustomAmount] = useState('');
  const presets = [5, 10, 20, 50, 100];
  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value; setCustomAmount(val);
    const num = Number(val);
    if (val !== '' && num >= 5 && num <= 200) setAmount(num);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Top Up AI Credits</DialogTitle></DialogHeader>
        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label>Quick Amounts</Label>
            <div className="flex flex-wrap gap-2">
              {presets.map(p => (
                <Button key={p} variant={amount === p ? 'default' : 'outline'} onClick={() => { setAmount(p); setCustomAmount(p.toString()); }}>
                  GHS {p}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="custom-amount">Custom Amount (GHS)</Label>
            <Input id="custom-amount" type="number" min="5" max="200" value={customAmount} onChange={handleCustomChange} placeholder="Min 5, Max 200" />
          </div>
          <div className="text-center p-4 bg-muted rounded-lg border">
            <p className="text-sm text-muted-foreground">You'll receive</p>
            <p className="text-2xl font-bold text-primary">{amount * 10} Credits</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onConfirm(amount)} disabled={amount < 5}>Pay GHS {amount} with Paystack</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── AICreditWidget ──────────────────────────────────────────────────────────
function AICreditWidget() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isToppingUp, setIsToppingUp] = useState(false);
  const [isTopUpDialogOpen, setIsTopUpDialogOpen] = useState(false);
  const auth = getAuth();
  const { toast } = useToast();

  const fetchCredits = useCallback(async () => {
    const token = await getAuth().currentUser?.getIdToken();
    if (!token) { setLoading(false); return; }
    try {
      const res = await fetch('/api/ai/credits', { headers: { Authorization: `Bearer ${token}` } });
      setData(await res.json());
    } catch { console.error('Failed to fetch credits'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js'; script.async = true;
    document.body.appendChild(script);
    return () => { if (document.body.contains(script)) document.body.removeChild(script); };
  }, []);

  useEffect(() => { if (auth.currentUser) fetchCredits(); }, [auth.currentUser?.uid, fetchCredits]);

  const handleTopUp = async (amount: number) => {
    if (!window.PaystackPop) { toast({ title: 'Payment system not ready', variant: 'destructive' }); return; }
    const userEmail = user?.email || auth.currentUser?.email;
    if (!userEmail) { toast({ title: 'Login required', variant: 'destructive' }); return; }
    setIsToppingUp(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/ai/credits/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      const handler = window.PaystackPop.setup({
        key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
        email: userEmail,
        access_code: result.accessCode,
        amount: Math.round(amount * 100),
        currency: 'GHS',
        ref: result.reference,
        onSuccess: (response: any) => {
          setIsTopUpDialogOpen(false);
          handleVerify(response.reference, amount);
        },
        
        callback: (response: any) => {
          setIsTopUpDialogOpen(false);
          handleVerify(response.reference, amount);
        },
        
        onClose: () => {
          setIsTopUpDialogOpen(false);
          setIsToppingUp(false);
        },
      });
      handler.openIframe();
    } catch (error: any) { toast({ title: 'Top-up Failed', description: error.message, variant: 'destructive' }); setIsToppingUp(false); }
  };

  const handleVerify = async (reference: string, amount: number) => {
    toast({ title: 'Processing...', description: 'Verifying your payment.' });
    try {
      const res = await fetch('/api/paystack/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reference }) });
      const verifyData = await res.json();
      if (!verifyData.success) throw new Error(verifyData.message || 'Verification failed');
      toast({ title: 'Payment confirmed!' });
      setTimeout(async () => { await fetchCredits(); toast({ title: 'Top-up Successful! 🚀', description: `${amount * 10} credits added.` }); setIsToppingUp(false); }, 3000);
    } catch { toast({ title: 'Verification Error', variant: 'destructive' }); setIsToppingUp(false); }
  };

  if (loading) return <Card className="h-[180px] flex items-center justify-center"><Loader2 className="animate-spin" /></Card>;
  if (!data || (data.totalCredits === 0 && !data.planId)) return null;

  const isWarning = data.percentUsed >= 80;
  const isDanger = data.percentUsed >= 90;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-sm font-medium">Monthly AI Credits</CardTitle>
          <Zap className="h-4 w-4 text-primary fill-primary" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-end">
          <div className="text-2xl font-bold">{data.usedCredits} <span className="text-muted-foreground text-sm font-normal">/ {data.totalCredits}</span></div>
          <div className="text-sm font-medium">{data.percentUsed}% used</div>
        </div>
        <Progress value={data.percentUsed} className={isDanger ? 'bg-red-100' : ''} />
        {isDanger && <div className="text-xs font-medium text-center text-red-600 bg-red-100 border border-red-200 rounded p-2 flex items-center justify-center gap-1"><AlertCircleIcon className="h-3 w-3" /> Critical: AI will stop soon</div>}
        {isWarning && !isDanger && <div className="text-xs font-medium text-center text-amber-700 bg-amber-100 border border-amber-200 rounded p-2">Warning: Low credits remaining</div>}
        <Button
  className="w-full mt-2"
  size="sm"
  onClick={() => setIsTopUpDialogOpen(true)}
  disabled={isToppingUp}
>
  {isToppingUp ? (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Processing...
    </>
  ) : (
    <>
      <PlusCircle className="mr-2 h-4 w-4" />
      Top Up Credits
    </>
  )}
</Button>
      </CardContent>
      <TopUpDialog open={isTopUpDialogOpen} onOpenChange={setIsTopUpDialogOpen} onConfirm={handleTopUp} />
    </Card>
  );
}

// ─── ChatLinkCard ────────────────────────────────────────────────────────────
function ChatLinkCard({ chatUrl, isEnabled }: { chatUrl: string; isEnabled: boolean }) {
  const { toast } = useToast();
  return (
    <Card className={cn('border-2 transition-colors', isEnabled ? 'border-primary/50 bg-primary/5' : 'border-dashed border-muted-foreground/20')}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary"><LinkIcon className="h-4 w-4 text-primary-foreground" /></div>
          <CardTitle className="text-base">Share AI Link</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {isEnabled ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-background border">
              <p className="text-sm font-medium truncate flex-1">{chatUrl}</p>
            </div>
            <Button onClick={() => { navigator.clipboard.writeText(chatUrl); toast({ title: 'AI chat link copied!' }); }} className="w-full gap-2 font-bold shadow-md">
              <Copy className="h-4 w-4" /> Copy Link
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">The SellQuic team must enable your AI Assistant to generate your shareable chat link.</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── InstagramConnectCard ────────────────────────────────────────────────────
function InstagramConnectCard({ storeId, instagramData, activeStore }: {
  storeId: string; instagramData?: { connected?: boolean; username?: string }; activeStore: any;
}) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const auth = getAuth();
  const isConnected = instagramData?.connected === true;

  const handleConnect = async () => {
    try {
      const igAppId = process.env.NEXT_PUBLIC_INSTAGRAM_APP_ID!;
      const redirectUri = `${window.location.origin}/api/instagram/callback`;
      const scope = 'instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments';
      const state = encodeURIComponent(JSON.stringify({ storeId, returnTo: window.location.origin }));
      const url = `https://www.instagram.com/oauth/authorize?client_id=${igAppId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&response_type=code&state=${state}`;
      setTimeout(() => forceTopLevelRedirect(url), 0);
    } catch (e: any) { toast({ title: 'Connection failed', description: e.message, variant: 'destructive' }); }
  };

  const handleDisconnect = async () => {
    if (!firestore) return;
    setIsDisconnecting(true);
    try {
      await updateDoc(doc(firestore, 'stores', storeId), { 'instagram.connected': false, 'instagram.accessToken': null });
      toast({ title: 'Instagram disconnected.' });
    } catch (e: any) { toast({ title: 'Failed to disconnect', description: e.message, variant: 'destructive' }); }
    finally { setIsDisconnecting(false); }
  };

  return (
    <Card className={cn('border-2 transition-colors', isConnected ? 'border-green-200 bg-green-50/30' : 'border-dashed border-muted-foreground/20')}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500"><Instagram className="h-4 w-4 text-white" /></div>
          <CardTitle className="flex items-center gap-2 text-base">
            Instagram DM
            {isConnected && <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">✓ Connected</span>}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {isConnected ? (
          <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
            <div><p className="text-sm font-medium text-green-900">@{instagramData?.username || 'Connected'}</p><p className="text-xs text-green-700">AI is replying to DMs 24/7</p></div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border">
            <div>
              <p className="text-sm font-medium">AI Auto-Replies</p>
              <p className="text-xs text-muted-foreground mt-0.5">Pause AI on Instagram without disconnecting.</p>
            </div>
            <Switch 
              checked={activeStore?.aiAssistant?.channels?.instagram !== false} 
              onCheckedChange={async (checked) => {
                if (!firestore) return;
                try {
                  await updateDoc(doc(firestore, 'stores', storeId), { 'aiAssistant.channels.instagram': checked });
                  toast({ title: checked ? 'AI enabled on Instagram' : 'AI paused on Instagram' });
                } catch (e) { toast({ title: 'Failed to update', variant: 'destructive' }); }
              }} 
            />
          </div>

          <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleConnect} className="flex-1">Reconnect</Button>
              <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={isDisconnecting} className="text-destructive"><Unlink className="h-4 w-4" /></Button>
            </div>
          </div>
        ) : (
          <Button onClick={handleConnect} className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0 gap-2 font-bold py-5 shadow-md">
            <Instagram className="h-4 w-4" /> Connect Instagram
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ─── WhatsAppConnectCard ─────────────────────────────────────────────────────
function WhatsAppConnectCard({ storeId, whatsappData, activeStore }: {
  storeId: string; whatsappData?: { status?: string; phoneNumber?: string }; activeStore: any;
}) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const auth = getAuth();
  const isConnected = whatsappData?.status === 'active';

  const handleConnect = async () => {
    try {
      const configId = process.env.NEXT_PUBLIC_WA_CONFIG_ID;
      const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || '1898671297438792';
      const redirectUri = `${window.location.origin}/api/whatsapp/callback`;
      const scope = 'business_management,whatsapp_business_management,whatsapp_business_messaging';
      const setupData = {
        business: { name: activeStore.name, email: auth.currentUser?.email || '', website: activeStore.customDomain ? `https://${activeStore.customDomain}` : `https://${activeStore.subdomain}.sellquic.com`, address: { country: 'GH' }, timezone: 'UTC' },
        phone: { displayName: activeStore.name, category: 'RETAIL', description: activeStore.tagline || `Shop at ${activeStore.name} on SellQuic.` },
      };
      const url = `https://www.facebook.com/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&response_type=code&config_id=${configId}&state=${encodeURIComponent(JSON.stringify({ storeId }))}&extras=${encodeURIComponent(JSON.stringify({ setup: setupData, sessionInfoVersion: '3' }))}`;
      const ua = navigator.userAgent;
      const isInAppBrowser = /FBAN|FBAV|Instagram|WhatsApp|Snapchat|Twitter|Line|Telegram|SamsungBrowser/i.test(ua);
      const isMobile = window.innerWidth < 1024 || /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
      if (isInAppBrowser) { window.open(url, '_blank', 'noopener,noreferrer'); toast({ title: 'Opening in browser...' }); return; }
      if (isMobile) { setTimeout(() => forceTopLevelRedirect(url), 0); return; }
      const popup = window.open(url, 'whatsapp-connect', 'width=800,height=900');
      const messageHandler = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.type === 'WA_SUCCESS') { toast({ title: 'WhatsApp AI is Live! 🚀' }); window.removeEventListener('message', messageHandler); setTimeout(() => window.location.reload(), 1000); }
        if (event.data?.type === 'WA_ERROR') { toast({ title: 'Connection failed', description: event.data.error, variant: 'destructive' }); window.removeEventListener('message', messageHandler); }
      };
      window.addEventListener('message', messageHandler);
      const interval = setInterval(() => { if (popup?.closed) { clearInterval(interval); window.removeEventListener('message', messageHandler); } }, 500);
    } catch (e: any) { toast({ title: 'Connection failed', description: e.message, variant: 'destructive' }); }
  };

  const handleDisconnect = async () => {
    if (!firestore || !confirm('Are you sure? This will stop the AI from replying on WhatsApp.')) return;
    setIsDisconnecting(true);
    try {
      await updateDoc(doc(firestore, 'stores', storeId), { 'whatsapp.status': 'inactive', 'whatsapp.accessToken': null, 'whatsapp.phoneId': null });
      toast({ title: 'WhatsApp disconnected.' });
    } catch (e: any) { toast({ title: 'Failed to disconnect', description: e.message, variant: 'destructive' }); }
    finally { setIsDisconnecting(false); }
  };

  return (
    <Card className={cn('border-2 transition-colors', isConnected ? 'border-green-200 bg-green-50/30' : 'border-dashed border-muted-foreground/20')}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#25D366]"><MessageCircle className="h-4 w-4 text-white" /></div>
          <CardTitle className="flex items-center gap-2 text-base">
            WhatsApp
            {isConnected && <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">✓ Active</span>}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {isConnected ? (
          <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
            <Phone className="h-5 w-5 text-green-600 shrink-0" />
            <p className="text-sm font-medium text-green-900">{whatsappData?.phoneNumber || 'Connected'}</p>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border">
            <div>
              <p className="text-sm font-medium">AI Auto-Replies</p>
              <p className="text-xs text-muted-foreground mt-0.5">Pause AI on WhatsApp without disconnecting.</p>
            </div>
            <Switch 
              checked={activeStore?.aiAssistant?.channels?.whatsapp !== false} 
              onCheckedChange={async (checked) => {
                if (!firestore) return;
                try {
                  await updateDoc(doc(firestore, 'stores', storeId), { 'aiAssistant.channels.whatsapp': checked });
                  toast({ title: checked ? 'AI enabled on WhatsApp' : 'AI paused on WhatsApp' });
                } catch (e) { toast({ title: 'Failed to update', variant: 'destructive' }); }
              }} 
            />
          </div>

          <button onClick={() => { const clean = (whatsappData?.phoneNumber || '').replace(/[\s+\-()]/g, ''); navigator.clipboard.writeText(`https://wa.me/${clean}`); toast({ title: 'WhatsApp link copied!' }); }} className="w-full flex items-center justify-center gap-2 text-xs text-primary hover:underline cursor-pointer py-1">
            <Copy className="h-3 w-3" /> Copy your WhatsApp link
          </button>
          <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={async () => { const token = await auth.currentUser?.getIdToken(); const res = await fetch('/api/whatsapp/set-profile', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ storeId }) }); const data = await res.json(); data.success ? toast({ title: 'WhatsApp profile synced!' }) : toast({ title: 'Sync failed', description: data.error, variant: 'destructive' }); }} className="flex-1 text-xs">
                Sync Profile
              </Button>
              <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={isDisconnecting} className="text-destructive"><Unlink className="h-4 w-4" /></Button>
            </div>
          </div>
        ) : (
          <Button onClick={handleConnect} className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white border-0 gap-2 font-bold py-5 shadow-md">
            <MessageCircle className="h-4 w-4" /> Connect WhatsApp
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────
type FAQItem = { question: string; answer: string };

const defaultSettings = {
  enabled: false,
  assistantName: 'Ama',
  assistantLabel: 'Shop Assistant',
  gender: 'female',
  tone: 'polite',
  greetingTemplate: 'Hello 👋 Welcome to {{storeName}}. How can I help you today?',
  brandIntro: '',
  faqs: [] as FAQItem[],
  qualifyingQuestion: null as string | null,
  escalationTriggers: {
    lastPrice: true, paymentProof: true, urgentDelivery: true,
    refundsComplaints: true, customOrders: true, wholesale: true, uncertainty: true,
  },
  notify: { inbox: true, whatsapp: false, sms: false },
};

// ─── WhatsApp Preview ────────────────────────────────────────────────────────
function WhatsAppPreview({ storeName, assistantName, greeting, qualifyingQuestion }: {
  storeName: string; assistantName: string; greeting: string; qualifyingQuestion?: string;
}) {
  const resolvedGreeting = greeting
    .replace(/{{storeName}}/g, storeName)
    .replace(/{{assistantName}}/g, assistantName);

  return (
    <div className="mx-auto max-w-[320px]">
      {/* Phone shell */}
      <div className="rounded-[28px] border-4 border-gray-800 bg-gray-800 shadow-2xl overflow-hidden">
        {/* Status bar */}
        <div className="bg-gray-800 px-5 py-1.5 flex justify-between items-center">
          <span className="text-white text-[10px] font-medium">9:41</span>
          <div className="flex gap-1 items-center">
            <div className="w-3 h-1.5 bg-white rounded-sm opacity-80" />
            <div className="w-1 h-1.5 bg-white rounded-sm opacity-60" />
            <div className="w-1 h-1.5 bg-white rounded-sm opacity-40" />
          </div>
        </div>

        {/* WhatsApp header */}
        <div className="bg-[#075E54] px-3 py-2 flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center shrink-0">
            <Bot className="h-4 w-4 text-gray-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold truncate">{storeName}</p>
            <p className="text-[#B2DFDB] text-[10px]">online</p>
          </div>
        </div>

        {/* Chat area */}
        <div className="bg-[#ECE5DD] min-h-[220px] p-3 space-y-2" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d4c9bb' fill-opacity='0.3'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }}>
          {/* Greeting bubble */}
          <div className="flex justify-start">
            <div className="bg-white rounded-[12px] rounded-tl-none px-3 py-2 max-w-[220px] shadow-sm">
              <p className="text-[12px] text-gray-800 leading-relaxed">{resolvedGreeting}</p>
              <p className="text-[10px] text-gray-400 text-right mt-1">just now ✓✓</p>
            </div>
          </div>

          {/* Qualifying question bubble */}
          {qualifyingQuestion && (
            <div className="flex justify-start">
              <div className="bg-white rounded-[12px] rounded-tl-none px-3 py-2 max-w-[220px] shadow-sm">
                <p className="text-[12px] text-gray-800 leading-relaxed">{qualifyingQuestion}</p>
                <p className="text-[10px] text-gray-400 text-right mt-1">just now ✓✓</p>
              </div>
            </div>
          )}
        </div>

        {/* Input bar */}
        <div className="bg-[#F0F0F0] px-2 py-2 flex items-center gap-2">
          <div className="flex-1 bg-white rounded-full px-3 py-1.5">
            <p className="text-[11px] text-gray-400">Type a message</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── AI Setup Wizard ─────────────────────────────────────────────────────────
function AISetupWizard({
  initialSettings,
  storeName,
  onComplete,
  onGenerateBrandIntro,
  isGenerating,
}: {
  initialSettings: typeof defaultSettings;
  storeName: string;
  onComplete: (draft: Partial<typeof defaultSettings>) => void;
  onGenerateBrandIntro: () => Promise<string>;
  isGenerating: boolean;
}) {
  const [step, setStep] = useState(1);
  const TOTAL_STEPS = 5;

  const [draft, setDraft] = useState({
    assistantName: initialSettings.assistantName || 'Ama',
    tone: initialSettings.tone || 'polite',
    brandIntro: initialSettings.brandIntro || '',
    qualifyingQuestion: initialSettings.qualifyingQuestion || '',
    greetingTemplate: initialSettings.greetingTemplate || '',
  });

  // Auto-build greeting when name changes
  const buildGreeting = (name: string) =>
    `Hello 👋 Welcome to {{storeName}}! I'm ${name}, your shopping assistant. How can I help you today?`;

  const handleNameChange = (name: string) => {
    setDraft(prev => ({
      ...prev,
      assistantName: name,
      greetingTemplate: buildGreeting(name),
    }));
  };

  const handleGenerate = async () => {
    const result = await onGenerateBrandIntro();
    if (result) setDraft(prev => ({ ...prev, brandIntro: result }));
  };

  const progress = ((step - 1) / (TOTAL_STEPS - 1)) * 100;

  const ghanaNames = ['Ama', 'Abena', 'Adwoa', 'Akua', 'Yaa', 'Efua', 'Afia', 'Adjoa'];
  const qualifyingExamples = [
    'Are you shopping for yourself or as a gift?',
    'Are you buying for a child or adult?',
    'What\'s the occasion?',
    'Are you shopping for male or female?',
  ];

  return (
    <div className="space-y-0">
      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-4 px-1">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground shrink-0">Step {step} of {TOTAL_STEPS}</span>
      </div>

      {/* Step 1 — Name */}
      {step === 1 && (
        <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Give your AI a name 😊</h3>
            <p className="text-sm text-muted-foreground">This is what customers will see when they chat with you.</p>
          </div>
          <div className="space-y-3">
            <Input
              value={draft.assistantName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Ama, Yaa, Abena..."
              className="text-base h-12"
              autoFocus
            />
            <div>
              <p className="text-xs text-muted-foreground mb-2">Popular choices</p>
              <div className="flex flex-wrap gap-2">
                {ghanaNames.map(name => (
                  <button
                    key={name}
                    onClick={() => handleNameChange(name)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-sm font-medium border transition-all',
                      draft.assistantName === name
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background hover:bg-muted border-border'
                    )}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <Button
            className="w-full h-12 text-base gap-2"
            onClick={() => setStep(2)}
            disabled={!draft.assistantName.trim()}
          >
            Next <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Step 2 — Tone */}
      {step === 2 && (
        <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">How should {draft.assistantName} speak?</h3>
            <p className="text-sm text-muted-foreground">Choose the personality that fits your brand.</p>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {[
              { value: 'polite', label: 'Warm & Friendly 😊', desc: 'Polite, helpful, uses "please" — great for fashion, beauty, food' },
              { value: 'professional', label: 'Professional 💼', desc: 'Clear and business-like — great for electronics, services, B2B' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setDraft(prev => ({ ...prev, tone: opt.value }))}
                className={cn(
                  'w-full text-left p-4 rounded-xl border-2 transition-all',
                  draft.tone === opt.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40 bg-background'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm">{opt.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                  </div>
                  {draft.tone === opt.value && <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />}
                </div>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="h-12 px-5" onClick={() => setStep(1)}>Back</Button>
            <Button className="flex-1 h-12 text-base gap-2" onClick={() => setStep(3)}>
              Next <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3 — Brand Intro */}
      {step === 3 && (
        <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Tell {draft.assistantName} about your business</h3>
            <p className="text-sm text-muted-foreground">
              What you sell, who your customers are, how you deliver, how you accept payment.
              <span className="block mt-1 text-primary font-medium">The more you add, the smarter {draft.assistantName} becomes.</span>
            </p>
          </div>
          <div className="space-y-2">
            <Textarea
              value={draft.brandIntro}
              onChange={(e) => setDraft(prev => ({ ...prev, brandIntro: e.target.value }))}
              placeholder={`e.g. We sell natural hair care products handmade in Ghana. Our bestsellers are the Growth Oil (GHS 85) and Moisture Cream (GHS 65). We ship across Ghana in 1-2 days. We accept MoMo, card, and cash on delivery in Accra.`}
              rows={5}
              className="text-sm resize-none"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full gap-2 border-dashed text-primary hover:text-primary hover:bg-primary/5"
            >
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {isGenerating ? 'Writing your intro...' : `✨ Let ${draft.assistantName} write this for me`}
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="h-12 px-5" onClick={() => setStep(2)}>Back</Button>
            <Button variant="ghost" className="h-12 px-4 text-muted-foreground" onClick={() => setStep(4)}>Skip</Button>
            <Button className="flex-1 h-12 text-base gap-2" onClick={() => setStep(4)}>
              Next <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 4 — Qualifying Question */}
      {step === 4 && (
        <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Should {draft.assistantName} ask a question first?</h3>
            <p className="text-sm text-muted-foreground">
              This is asked right after the greeting. It helps {draft.assistantName} give better recommendations from the start.
            </p>
          </div>
          <div className="space-y-3">
            <Input
              value={draft.qualifyingQuestion || ''}
              onChange={(e) => setDraft(prev => ({ ...prev, qualifyingQuestion: e.target.value }))}
              placeholder="Type your question or tap an example below..."
              className="text-sm h-12"
            />
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground font-medium">Examples — tap to use</p>
              <div className="flex flex-col gap-1.5">
                {qualifyingExamples.map(q => (
                  <button
                    key={q}
                    onClick={() => setDraft(prev => ({ ...prev, qualifyingQuestion: q }))}
                    className={cn(
                      'text-left text-sm px-3 py-2 rounded-lg border transition-all',
                      draft.qualifyingQuestion === q
                        ? 'bg-primary/5 border-primary/40 text-primary font-medium'
                        : 'bg-muted/30 border-transparent hover:border-primary/20'
                    )}
                  >
                    "{q}"
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="h-12 px-5" onClick={() => setStep(3)}>Back</Button>
            <Button
              variant="ghost"
              className="h-12 px-4 text-muted-foreground"
              onClick={() => { setDraft(prev => ({ ...prev, qualifyingQuestion: '' })); setStep(5); }}
            >
              Skip
            </Button>
            <Button className="flex-1 h-12 text-base gap-2" onClick={() => setStep(5)}>
              Preview <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 5 — Preview */}
      {step === 5 && (
        <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Here's how {draft.assistantName} will greet customers 👇</h3>
            <p className="text-sm text-muted-foreground">This is what they'll see when they first message you.</p>
          </div>

          <WhatsAppPreview
            storeName={storeName}
            assistantName={draft.assistantName}
            greeting={draft.greetingTemplate || buildGreeting(draft.assistantName)}
            qualifyingQuestion={draft.qualifyingQuestion || undefined}
          />

          <div className="flex gap-2">
            <Button variant="outline" className="h-12 px-5" onClick={() => setStep(4)}>Edit</Button>
            <Button
              className="flex-1 h-12 text-base gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white border-0"
              onClick={() => onComplete({ ...draft, greetingTemplate: draft.greetingTemplate || buildGreeting(draft.assistantName) })}
            >
              <Check className="h-5 w-5" /> Looks good — Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Accordion Section ───────────────────────────────────────────────────────
function AccordionSection({
  icon, title, summary, isOpen, onToggle, children,
}: {
  icon: React.ReactNode; title: string; summary?: string;
  isOpen: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="border rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3.5 bg-background hover:bg-muted/40 transition-colors"
      >
        <div className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0">{icon}</div>
        <div className="flex-1 text-left min-w-0">
          <p className="font-medium text-sm">{title}</p>
          {summary && !isOpen && <p className="text-xs text-muted-foreground truncate mt-0.5">{summary}</p>}
        </div>
        {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 pt-1 border-t bg-muted/20 space-y-3">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── AI Settings Accordion ───────────────────────────────────────────────────
function AISettingsAccordion({
  settings, storeName, onChange, onGenerateBrandIntro, isGenerating,
}: {
  settings: typeof defaultSettings; storeName: string;
  onChange: (updates: Partial<typeof defaultSettings>) => void;
  onGenerateBrandIntro: () => Promise<string>; isGenerating: boolean;
}) {
  const [openSection, setOpenSection] = useState<string | null>(null);
  const toggle = (id: string) => setOpenSection(prev => prev === id ? null : id);

  const handleGenerate = async () => {
    const result = await onGenerateBrandIntro();
    if (result) onChange({ brandIntro: result });
  };

  return (
    <div className="space-y-2">
      {/* Personality */}
      <AccordionSection
        icon={<User className="h-3.5 w-3.5" />}
        title="AI Personality"
        summary={`${settings.assistantName} · ${settings.tone === 'polite' ? 'Warm & Friendly' : 'Professional'}`}
        isOpen={openSection === 'personality'}
        onToggle={() => toggle('personality')}
      >
        <div className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <Label className="text-xs">Assistant Name</Label>
            <Input
              value={settings.assistantName}
              onChange={(e) => onChange({ assistantName: e.target.value })}
              className="h-10 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tone</Label>
            <Select value={settings.tone} onValueChange={(v) => onChange({ tone: v })}>
              <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="polite">Warm & Friendly 😊</SelectItem>
                <SelectItem value="professional">Professional 💼</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">First Message</Label>
            <p className="text-xs text-muted-foreground">Use <code className="bg-muted px-1 rounded">{'{{storeName}}'}</code> and <code className="bg-muted px-1 rounded">{'{{assistantName}}'}</code></p>
            <Textarea
              value={settings.greetingTemplate}
              onChange={(e) => onChange({ greetingTemplate: e.target.value })}
              rows={2}
              className="text-sm resize-none"
            />
            {settings.greetingTemplate && (
              <div className="p-2.5 rounded-lg bg-muted text-xs text-muted-foreground border">
                <span className="font-medium text-foreground">Preview: </span>
                {settings.greetingTemplate
                  .replace(/{{storeName}}/g, storeName)
                  .replace(/{{assistantName}}/g, settings.assistantName)}
              </div>
            )}
          </div>
        </div>
      </AccordionSection>

      {/* Brand Voice */}
      <AccordionSection
        icon={<Sparkles className="h-3.5 w-3.5" />}
        title="Brand Voice"
        summary={settings.brandIntro ? settings.brandIntro.slice(0, 60) + '...' : 'Not set yet'}
        isOpen={openSection === 'brand'}
        onToggle={() => toggle('brand')}
      >
        <div className="space-y-2 pt-1">
          <Textarea
            value={settings.brandIntro}
            onChange={(e) => onChange({ brandIntro: e.target.value })}
            placeholder="What do you sell, who are your customers, how do you deliver?"
            rows={4}
            className="text-sm resize-none"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full gap-2 border-dashed text-primary hover:text-primary"
          >
            {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            {isGenerating ? 'Writing...' : 'Re-generate with AI'}
          </Button>
        </div>
      </AccordionSection>

      {/* Conversation Starter */}
      <AccordionSection
        icon={<HelpCircle className="h-3.5 w-3.5" />}
        title="Conversation Starter"
        summary={settings.qualifyingQuestion || 'No qualifying question set'}
        isOpen={openSection === 'conversation'}
        onToggle={() => toggle('conversation')}
      >
        <div className="space-y-2 pt-1">
          <p className="text-xs text-muted-foreground">Asked after the greeting to help the AI give better recommendations.</p>
          <Input
            value={settings.qualifyingQuestion || ''}
            onChange={(e) => onChange({ qualifyingQuestion: e.target.value })}
            placeholder="e.g. Are you shopping for yourself or as a gift?"
            className="h-10 text-sm"
          />
        </div>
      </AccordionSection>

      {/* Advanced — handover rules hidden here */}
      <AccordionSection
        icon={<Settings2 className="h-3.5 w-3.5" />}
        title="Advanced"
        summary="Handover rules & notifications"
        isOpen={openSection === 'advanced'}
        onToggle={() => toggle('advanced')}
      >
        <div className="space-y-3 pt-1">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Hand over to you when...</p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(settings.escalationTriggers).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2">
                  <Checkbox
                    id={`adv-${key}`}
                    checked={value}
                    onCheckedChange={(c: boolean) =>
                      onChange({ escalationTriggers: { ...settings.escalationTriggers, [key]: c } })
                    }
                  />
                  <label htmlFor={`adv-${key}`} className="text-xs cursor-pointer">
                    {{
                      lastPrice: 'Last price asked',
                      paymentProof: 'Payment proof needed',
                      urgentDelivery: 'Urgent delivery',
                      refundsComplaints: 'Refunds & complaints',
                      customOrders: 'Custom orders',
                      wholesale: 'Wholesale inquiry',
                      uncertainty: 'AI is unsure',
                    }[key] || key}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
      </AccordionSection>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function AIAssistantPage() {
  useRequireAuth();
  const { activeStore, loading } = useAuth();
  const { toast } = useToast();
  const firestore = useFirestore();
  const auth = getAuth();

  const [settings, setSettings] = useState(defaultSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [chatUrl, setChatUrl] = useState('');
  const [wizardVisible, setWizardVisible] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('whatsapp_success')) toast({ title: 'WhatsApp AI is Live! 🚀' });
    if (params.get('instagram') === 'connected') toast({ title: 'Instagram connected! 🎉' });
    if (params.get('error')) toast({ title: 'Connection failed', description: params.get('error') || '', variant: 'destructive' });
    window.history.replaceState({}, '', window.location.pathname);
  }, [toast]);

  useEffect(() => {
    if (activeStore) {
      if (activeStore.customDomain) setChatUrl(`https://${activeStore.customDomain}/chat`);
      else if (activeStore.subdomain) setChatUrl(`https://${activeStore.subdomain}.sellquic.com/chat`);
    }
  }, [activeStore]);

  useEffect(() => {
    if (activeStore?.aiAssistant) {
      const ai = activeStore.aiAssistant;
      setSettings({
        ...defaultSettings,
        ...ai,
        faqs: Array.isArray(ai.faqs) ? ai.faqs : [],
        escalationTriggers: { ...defaultSettings.escalationTriggers, ...(ai.escalationTriggers || {}) },
        notify: { ...defaultSettings.notify, ...(ai.notify || {}) },
      });
      // Wizard needed if no brandIntro AND still using default name
      const isConfigured = !!(ai.brandIntro || (ai.assistantName && ai.assistantName !== 'Ama'));
      setSetupComplete(isConfigured);
      setWizardVisible(!isConfigured);
    }
  }, [activeStore]);

  const handleSave = async () => {
    if (!activeStore || !firestore) return;
    setIsSaving(true);
    try {
      const { lastScanAt, lastScanSummary, ...configToSave } = settings as any;
      await updateDoc(doc(firestore, 'stores', activeStore.id), {
        aiAssistant: { ...activeStore.aiAssistant, ...configToSave, updatedAt: serverTimestamp() },
      });
      const token = await auth.currentUser?.getIdToken();
      await fetch('/api/cache/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ storeId: activeStore.id }),
      });
      toast({ title: 'AI Assistant settings saved!' });
    } catch { toast({ title: 'Save Failed', variant: 'destructive' }); }
    finally { setIsSaving(false); }
  };

  const handleGenerateBrandIntro = async (): Promise<string> => {
    if (!activeStore) return '';
    setIsGenerating(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/ai/generate-brand-intro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ storeId: activeStore.id }),
      });
      const result = await res.json();
      setSettings(prev => ({ ...prev, brandIntro: result.brandIntro }));
      toast({ title: 'Brand intro generated! ✨' });
      return result.brandIntro || '';
    } catch {
      toast({ title: 'Generation failed', variant: 'destructive' });
      return '';
    } finally { setIsGenerating(false); }
  };

  const handleWizardComplete = async (draft: Partial<typeof defaultSettings>) => {
    const updated = { ...settings, ...draft };
    setSettings(updated);
    setSetupComplete(true);
    setWizardVisible(false);
    // Auto-save
    if (!activeStore || !firestore) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(firestore, 'stores', activeStore.id), {
        aiAssistant: { ...activeStore.aiAssistant, ...draft, updatedAt: serverTimestamp() },
      });
      const token = await auth.currentUser?.getIdToken();
      await fetch('/api/cache/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ storeId: activeStore.id }),
      });
      toast({ title: `${draft.assistantName || 'Your AI'} is ready! 🎉`, description: 'Setup saved. You can edit anytime below.' });
    } catch { toast({ title: 'Save failed', variant: 'destructive' }); }
    finally { setIsSaving(false); }
  };

  const handleSettingsChange = (updates: Partial<typeof defaultSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  const handleFaqChange = (index: number, field: 'question' | 'answer', value: string) => {
    const newFaqs = [...(settings.faqs || [])];
    newFaqs[index] = { ...newFaqs[index], [field]: value };
    setSettings(prev => ({ ...prev, faqs: newFaqs }));
  };

  const addFaq = () => setSettings(prev => ({ ...prev, faqs: [...(prev.faqs || []), { question: '', answer: '' }] }));
  const removeFaq = (index: number) => setSettings(prev => ({ ...prev, faqs: (prev.faqs || []).filter((_: any, i: number) => i !== index) }));

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!activeStore) return <div className="p-8 text-center text-muted-foreground">Please select a store.</div>;

  const storeName = activeStore.name || 'Your Store';

  return (
    <div className="space-y-4 max-w-2xl mx-auto pb-24">
      {/* Header */}
      <div className="flex justify-between items-center px-2 pt-2">
        <div>
          <h1 className="text-xl font-bold">AI Assistant</h1>
          <p className="text-sm text-muted-foreground">Your 24/7 automated sales assistant.</p>
        </div>
        {setupComplete && (
          <Button onClick={handleSave} disabled={isSaving} size="sm">
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        )}
      </div>

      {/* Connect cards */}
      <div className="grid grid-cols-1 gap-3 px-2">
      <InstagramConnectCard storeId={activeStore.id} instagramData={(activeStore as any).instagram} activeStore={activeStore} />
      <WhatsAppConnectCard storeId={activeStore.id} whatsappData={(activeStore as any).whatsapp} activeStore={activeStore} />
    <ChatLinkCard chatUrl={chatUrl} isEnabled={settings.enabled} />
      <AICreditWidget />
</div>

      {/* AI Setup Section */}
      <div className="px-2">
        {wizardVisible ? (
          <Card className="border-primary/30 bg-gradient-to-b from-primary/5 to-background">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Set up your AI</CardTitle>
                  <CardDescription className="text-xs">Takes about 2 minutes</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <AISetupWizard
                initialSettings={settings}
                storeName={storeName}
                onComplete={handleWizardComplete}
                onGenerateBrandIntro={handleGenerateBrandIntro}
                isGenerating={isGenerating}
              />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center">
                    <Check className="h-3.5 w-3.5 text-green-600" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold">
                      {settings.assistantName} is set up
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {settings.tone === 'polite' ? 'Warm & Friendly' : 'Professional'} · Tap any section to edit
                    </CardDescription>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setWizardVisible(true)}
                  className="text-xs text-muted-foreground gap-1"
                >
                  <RefreshCw className="h-3 w-3" /> Redo setup
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <AISettingsAccordion
                settings={settings}
                storeName={storeName}
                onChange={handleSettingsChange}
                onGenerateBrandIntro={handleGenerateBrandIntro}
                isGenerating={isGenerating}
              />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Train Your AI — FAQ */}
      <div className="px-2">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Train Your AI
                    {(settings.faqs || []).length > 0 && (
                      <Badge variant="secondary" className="text-xs font-normal">
                        {(settings.faqs || []).filter((f: FAQItem) => f.question && f.answer).length} ready
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="mt-0.5 text-xs">
                    When a customer asks a matching question, your AI responds instantly with your exact words.
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Starter suggestions */}
            {(settings.faqs || []).length < 3 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Quick add — tap to use</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    'What are your delivery charges?',
                    'How long does delivery take?',
                    'Do you accept MoMo payment?',
                    'What is your return policy?',
                    'Do you deliver outside Accra?',
                    'Can I pay on delivery?',
                    'Do you have a physical store?',
                    'How do I track my order?',
                  ].filter(q =>
                    !(settings.faqs || []).some((f: FAQItem) =>
                      f.question.toLowerCase().includes(q.toLowerCase().slice(0, 15))
                    )
                  ).slice(0, 5).map((q, i) => (
                    <button
                      key={i}
                      onClick={() => setSettings(prev => ({ ...prev, faqs: [...(prev.faqs || []), { question: q, answer: '' }] }))}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-muted hover:bg-primary/10 hover:text-primary border border-border hover:border-primary/30 transition-colors cursor-pointer"
                    >
                      <Plus className="h-3 w-3" /> {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* FAQ list */}
            {(settings.faqs || []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed border-muted rounded-xl">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <p className="font-medium text-sm">No training data yet</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">Add questions customers ask most. Your AI answers them instantly.</p>
                <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={addFaq}>
                  <PlusCircle className="h-4 w-4" /> Add first question
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {(settings.faqs || []).map((faq: FAQItem, index: number) => (
                  <div
                    key={index}
                    className={cn(
                      'p-3.5 border rounded-xl relative transition-colors',
                      faq.question && faq.answer ? 'border-green-200 bg-green-50/30' : 'border-amber-200 bg-amber-50/30'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-1.5">
                        {faq.question && faq.answer
                          ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                          : <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                        <span className="text-xs font-medium text-muted-foreground">
                          {faq.question && faq.answer ? 'Ready' : 'Needs an answer'}
                        </span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removeFaq(index)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <Input
                        placeholder="Customer question e.g. Do you deliver to Kumasi?"
                        value={faq.question || ''}
                        onChange={(e) => handleFaqChange(index, 'question', e.target.value)}
                        className="text-sm bg-background h-10"
                      />
                      <Textarea
                        placeholder="Your exact answer e.g. Yes! We deliver to Kumasi for GHS 25, takes 1-2 days."
                        value={faq.answer || ''}
                        onChange={(e) => handleFaqChange(index, 'answer', e.target.value)}
                        rows={2}
                        className="text-sm bg-background resize-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(settings.faqs || []).length > 0 && (
              <Button variant="outline" onClick={addFaq} className="w-full gap-2 border-dashed">
                <PlusCircle className="h-4 w-4" /> Add another question
              </Button>
            )}

            {(settings.faqs || []).length > 0 && (
              <p className="text-xs text-center text-muted-foreground">
                {(settings.faqs || []).filter((f: FAQItem) => f.question && f.answer).length} of {(settings.faqs || []).length} questions ready ·{' '}
                <button onClick={handleSave} className="text-primary underline underline-offset-2">Save changes to activate</button>
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Floating save bar — shows when there are unsaved changes */}
      {setupComplete && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t z-50 md:hidden">
          <Button onClick={handleSave} disabled={isSaving} className="w-full h-12 text-base">
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      )}
    </div>
  );
}