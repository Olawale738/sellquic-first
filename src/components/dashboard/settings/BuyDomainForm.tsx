'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Loader2,
  CheckCircle,
  Clock,
  Globe,
  ExternalLink,
  Trash2,
  Calendar,
  Info,
  RotateCcw,
  Copy,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { getAuth } from 'firebase/auth';
import { useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { usePaystackPayment } from 'react-paystack';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { format, addYears, differenceInDays } from 'date-fns';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// ==================================================================
// MAIN COMPONENT
// ==================================================================
export default function BuyDomainForm({ store }: { store: any }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const auth = getAuth();
  const firestore = useFirestore();

  const [domain, setDomain] = useState('');
  const [status, setStatus] = useState<'idle' | 'searching' | 'available' | 'taken'>('idle');
  const [searchedDomain, setSearchedDomain] = useState('');
  const [price, setPrice] = useState<number>(250);
  const [currentRef, setCurrentRef] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isLoggingRequest, setIsLoggingRequest] = useState(false);

  useEffect(() => {
    setCurrentRef('SELLQUIC-' + Date.now());
  }, []);

  useEffect(() => {
    if (!firestore || !domain.includes('.')) return;

    const fetchPrice = async () => {
      try {
        const settingsRef = doc(firestore, 'settings', 'domains');
        const snap = await getDoc(settingsRef);

        if (snap.exists()) {
          const data = snap.data();
          const prices = (data as any).prices || {};
          const tld = '.' + domain.split('.').pop();

          if (prices[tld]) {
            setPrice(prices[tld]);
          } else {
            setPrice(250);
          }
        }
      } catch (e) {
        console.error('Price fetch error', e);
      }
    };

    fetchPrice();
  }, [firestore, domain]);

  const config = {
    reference: currentRef,
    email: user?.email || 'vendor@sellquic.com',
    amount: price * 100,
    publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || '',
    currency: 'GHS',
  };

  const initializePayment = usePaystackPayment(config) as any;

  const verifyPayment = async () => {
    setIsVerifying(true);
    toast({
      title: 'Verifying Payment',
      description: 'Checking transaction status...',
    });
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/domains/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          domain: searchedDomain || domain,
          reference: currentRef,
          storeId: store.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');

      toast({
        title: 'Success!',
        description: 'Domain request received. Setup started.',
      });
      window.location.reload();
    } catch (error: any) {
      toast({
        title: 'Verification Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure? Your store will immediately revert to the subdomain link.'))
      return;
    setIsDisconnecting(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/stores/${store.id}/disconnect-domain`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to disconnect');
      toast({
        title: 'Domain Disconnected',
        description: 'Your store is back on the subdomain.',
      });
      window.location.reload();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Could not disconnect domain.',
        variant: 'destructive',
      });
      setIsDisconnecting(false);
    }
  };

  const handleReconnect = async () => {
    setIsReconnecting(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/stores/${store.id}/reconnect-domain`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to reconnect');
      toast({
        title: 'Domain Reconnected',
        description: 'Your store is live again!',
      });
      window.location.reload();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Could not reconnect domain.',
        variant: 'destructive',
      });
      setIsReconnecting(false);
    }
  };

  const handleSearch = async () => {
    if (!domain.includes('.')) {
      toast({
        title: 'Invalid Domain',
        description: 'Example: myshop.com',
        variant: 'destructive',
      });
      return;
    }
    setStatus('searching');
    try {
      const res = await fetch(`/api/domain/check?q=${domain}`);
      const data = await res.json();
      setSearchedDomain(domain);
      if (data.available) {
        setStatus('available');
      } else {
        setStatus('taken');
      }
    } catch (e) {
      setStatus('idle');
    }
  };

  const handleInitiatePayment = async () => {
    setIsLoggingRequest(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/domains/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          domain: searchedDomain,
          reference: currentRef,
          storeId: store.id,
          price: price,
        }),
      });

      if (!res.ok) throw new Error('Failed to log request.');

      (initializePayment as any)(
        () => {
          toast({
            title: 'Payment window opened.',
            description:
              "If your dashboard doesn't update automatically, you can click 'I have paid, Verify' as backup.",
          });
        },
        () => {
          toast({ title: 'Payment window closed.' });
        }
      );
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e.message || 'Could not start payment process.',
        variant: 'destructive',
      });
    } finally {
      setIsLoggingRequest(false);
    }
  };

  if (
    store.customDomainStatus === 'pending' ||
    store.customDomainStatus === 'pending_setup'
  ) {
    return (
      <Card className="bg-yellow-50 border-yellow-200">
        <CardHeader>
          <CardTitle className="text-yellow-800 flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" /> Setup In Progress
          </CardTitle>
          <CardDescription className="text-yellow-700 font-bold text-lg">
            {store.pendingDomain}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="bg-white/60 border-yellow-200">
            <Clock className="h-4 w-4 text-yellow-600" />
            <AlertTitle className="text-yellow-800">Please Wait</AlertTitle>
            <AlertDescription className="text-yellow-700 text-xs mt-1">
              We are purchasing and configuring your domain. This manual process
              takes <strong>12–24 hours</strong>. You will receive an email once
              it is live.
            </AlertDescription>
          </Alert>
          <div className="mt-4 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
              className="border-yellow-300 text-yellow-800 hover:bg-yellow-100"
            >
              Check Status
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (store.customDomain) {
    return (
      <div className="space-y-6">
        <ActiveDomainCard
          store={store}
          onDisconnect={handleDisconnect}
          isDisconnecting={isDisconnecting}
        />
        <div className="opacity-80">
          <ConnectExistingDomainForm
            store={store}
            title="Connect a Different Domain"
          />
        </div>
      </div>
    );
  }

  if (store.disconnectedDomain) {
    return (
      <div className="space-y-6">
        <Card className="border-blue-100 bg-white shadow-sm">
          <CardHeader className="bg-blue-50/50 border-b border-blue-50 pb-3">
            <div className="flex justify-between items-center">
              <CardTitle className="text-blue-900 flex items-center gap-2 text-base">
                <Globe className="h-4 w-4" /> Previously Connected
              </CardTitle>
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                Owned
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div>
              <p className="font-bold text-lg text-gray-800">
                {store.disconnectedDomain}
              </p>
              <p className="text-xs text-muted-foreground">
                This domain is configured and ready.
              </p>
            </div>
            <Button
              onClick={handleReconnect}
              disabled={isReconnecting}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isReconnecting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RotateCcw className="h-4 w-4 mr-2" />
              )}
              Reconnect
            </Button>
          </CardContent>
        </Card>

        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Or setup a new one
            </span>
          </div>
        </div>

        <BuyFormSection
          domain={domain}
          setDomain={setDomain}
          status={status}
          handleSearch={handleSearch}
          searchedDomain={searchedDomain}
          price={price}
          initializePayment={handleInitiatePayment}
          verifyPayment={verifyPayment}
          isVerifying={isVerifying}
          isLoggingRequest={isLoggingRequest}
        />

        <ConnectExistingDomainForm store={store} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <BuyFormSection
        domain={domain}
        setDomain={setDomain}
        status={status}
        handleSearch={handleSearch}
        searchedDomain={searchedDomain}
        price={price}
        initializePayment={handleInitiatePayment}
        verifyPayment={verifyPayment}
        isVerifying={isVerifying}
        isLoggingRequest={isLoggingRequest}
      />

      <ConnectExistingDomainForm store={store} />
    </div>
  );
}

// ==================================================================
// BUY NEW DOMAIN SECTION
// ==================================================================
function BuyFormSection({
  domain,
  setDomain,
  status,
  handleSearch,
  searchedDomain,
  price,
  initializePayment,
  verifyPayment,
  isVerifying,
  isLoggingRequest,
}: any) {
  return (
    <Card className="border-primary/10 shadow-md">
      <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" /> Buy a New Domain
        </CardTitle>
        <CardDescription>
          Get a professional .com domain (e.g. myshop.com). We handle the
          technical setup.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        <div className="flex gap-2">
          <Input
            placeholder="Search domain (e.g. menfams.com)"
            value={domain}
            onChange={(e) => setDomain(e.target.value.toLowerCase())}
            className="h-12 text-lg"
            disabled={status === 'searching' || isLoggingRequest}
          />
          <Button
            onClick={handleSearch}
            disabled={status === 'searching' || !domain || isLoggingRequest}
            size="lg"
            className="px-6"
          >
            {status === 'searching' ? (
              <Loader2 className="animate-spin" />
            ) : (
              'Search'
            )}
          </Button>
        </div>

        {status === 'available' && price && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
            <div className="bg-green-50 p-6 rounded-lg border border-green-200 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div>
                <h4 className="font-bold text-green-900 text-lg flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />{' '}
                  {searchedDomain}
                </h4>
                <p className="text-green-700 text-sm">
                  Available for registration
                </p>
              </div>
              <Button
                onClick={initializePayment}
                disabled={isLoggingRequest}
                className="bg-green-600 hover:bg-green-700 text-white font-bold h-12 px-8 shadow-lg"
              >
                {isLoggingRequest && (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                )}
                Pay GHS {price.toFixed(2)}
              </Button>
            </div>
            <div className="flex items-center justify-between px-2">
              <p className="text-xs text-muted-foreground">
                Includes SSL Certificate & Annual Renewal
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={verifyPayment}
                disabled={isVerifying}
              >
                {isVerifying && (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                )}
                I have paid, Verify
              </Button>
            </div>
          </div>
        )}

        {status === 'taken' && (
          <div className="bg-red-50 p-4 rounded-lg flex items-center gap-2 border border-red-200 text-red-800">
            <XCircle className="h-5 w-5" />
            <span className="font-medium">
              Sorry, {searchedDomain} is already taken.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ==================================================================
// CONNECT EXISTING DOMAIN SECTION
// ==================================================================
function ConnectExistingDomainForm({
  store,
  title = 'Connect Existing Domain',
}: {
  store: any;
  title?: string;
}) {
  const [inputDomain, setInputDomain] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const auth = getAuth();
  const { user } = useAuth();

  const handleAdd = async () => {
    if (!inputDomain || !user) return;
    setIsLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/domains/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          domain: inputDomain.toLowerCase().trim(),
          storeId: store.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Domain already exists in Vercel or SellQuic
        if (data.domainAlreadyExists) {
          toast({
            title: 'Domain Already Connected',
            description: data.error || `${inputDomain} is already connected to a SellQuic store or Vercel project. Please disconnect it first.`,
            variant: 'destructive',
          });
        }
        // DNS not pointing to Vercel yet
        else if (data.dnsNotReady) {
          toast({
            title: 'DNS Not Configured',
            description: data.error || `Please add the DNS records shown below and wait 5-30 minutes before trying again.`,
            variant: 'destructive',
          });
        }
        // Invalid domain format
        else if (data.invalidDomain) {
          toast({
            title: 'Invalid Domain',
            description: data.error || `Please enter a valid domain (e.g., yourbrand.com). No http://, https://, or www.`,
            variant: 'destructive',
          });
        }
        // Generic error
        else {
          throw new Error(data.error || 'Failed to connect domain.');
        }
      } else {
        toast({
          title: 'Domain Connected Successfully! 🎉',
          description: `${data.domain} is now linked to your store.`,
        });
        window.location.reload();
      }
    } catch (e: any) {
      toast({
        title: 'Connection Error',
        description: e.message || 'Could not connect domain.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>
          If you already own a domain (e.g., on Namecheap, GoDaddy, Whogohost),
          point it to SellQuic with two DNS records. No need to transfer or change nameservers.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
            Step 1 — Enter your domain
          </label>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. yourbrand.com"
              value={inputDomain}
              onChange={(e) => setInputDomain(e.target.value.toLowerCase().trim())}
              disabled={isLoading}
            />
            <Button onClick={handleAdd} disabled={isLoading || !inputDomain}>
              {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Connect
            </Button>
          </div>
          <p className="text-[11px] text-slate-500">
            Don't include <code>https://</code> or <code>www</code> — just <code>yourbrand.com</code>
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-200 p-4 rounded-md text-sm space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold flex items-center gap-2 text-slate-800">
              <Info className="h-4 w-4 text-blue-500" />
              Step 2 — Add these DNS records
            </p>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="outline" className="cursor-help">
                    Where?
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>
                    Login to your domain provider and go to <strong>DNS Settings</strong>. 
                    Add the records below. Do NOT change nameservers.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <Alert className="bg-blue-50 border-blue-200">
            <AlertTriangle className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-900 text-xs">Vercel Recommendation</AlertTitle>
            <AlertDescription className="text-blue-800 text-[11px]">
              Using the new IP <strong>216.150.1.1</strong> is recommended. The old IP (76.76.21.21) still works.
            </AlertDescription>
          </Alert>

          <div className="grid gap-3">
            <div className="bg-white p-3 rounded border border-slate-200 flex justify-between items-center group">
              <div className="grid grid-cols-3 gap-4 w-full">
                <div className="text-xs text-muted-foreground uppercase">
                  Type<br />
                  <strong className="text-slate-900 text-sm">A</strong>
                </div>
                <div className="text-xs text-muted-foreground uppercase">
                  Name<br />
                  <strong className="text-slate-900 text-sm">@</strong>
                </div>
                <div className="text-xs text-muted-foreground uppercase">
                  Value<br />
                  <strong className="text-slate-900 text-sm">216.150.1.1</strong>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-50 group-hover:opacity-100"
                onClick={() => {
                  navigator.clipboard.writeText('216.150.1.1');
                  toast({ title: 'IP copied' });
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>

            <div className="bg-white p-3 rounded border border-slate-200 flex justify-between items-center group">
              <div className="grid grid-cols-3 gap-4 w-full">
                <div className="text-xs text-muted-foreground uppercase">
                  Type<br />
                  <strong className="text-slate-900 text-sm">CNAME</strong>
                </div>
                <div className="text-xs text-muted-foreground uppercase">
                  Name<br />
                  <strong className="text-slate-900 text-sm">www</strong>
                </div>
                <div className="text-xs text-muted-foreground uppercase">
                  Value<br />
                  <strong className="text-slate-900 text-sm">cname.vercel-dns.com</strong>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-50 group-hover:opacity-100"
                onClick={() => {
                  navigator.clipboard.writeText('cname.vercel-dns.com');
                  toast({ title: 'CNAME copied' });
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            DNS updates take <strong>5–30 minutes</strong>. After adding records, wait and click <strong>Connect</strong> again.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ==================================================================
// ACTIVE DOMAIN CARD
// ==================================================================
function ActiveDomainCard({
  store,
  onDisconnect,
  isDisconnecting,
}: {
  store: any;
  onDisconnect: () => void;
  isDisconnecting: boolean;
}) {
  const isPorkbun =
    store.domainProvider === 'sellquic-porkbun' ||
    store.domainProvider === 'sellquic-manual';

  const purchaseDate = store.domainPurchasedAt?.seconds
    ? new Date(store.domainPurchasedAt.seconds * 1000)
    : new Date();
  const expiryDate = addYears(purchaseDate, 1);
  const daysLeft = differenceInDays(expiryDate, new Date());

  return (
    <Card className="border-green-200 bg-green-50/50">
      <CardHeader className="border-b border-green-100 pb-4">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-green-800">
              <CheckCircle className="h-5 w-5 text-green-600" /> Domain Active
            </CardTitle>
            <a
              href={`https://${store.customDomain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-700 text-xl font-bold flex items-center gap-2 hover:underline"
            >
              {store.customDomain} <ExternalLink className="h-5 w-5" />
            </a>
          </div>
          <Badge
            variant="outline"
            className="bg-white text-green-700 border-green-200 shadow-sm"
          >
            {isPorkbun ? 'Managed by SellQuic' : 'External Provider'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {isPorkbun && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-lg border border-green-100 shadow-sm">
              <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">
                Purchased
              </p>
              <p className="font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4 text-green-600" />
                {format(purchaseDate, 'PP')}
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-green-100 shadow-sm">
              <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">
                Expires
              </p>
              <p className="font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-green-600" />
                {format(expiryDate, 'PP')} ({daysLeft} days left)
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onDisconnect}
            disabled={isDisconnecting}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            {isDisconnecting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            Disconnect Domain
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}