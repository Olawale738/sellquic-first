'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
import { format } from 'date-fns';
import { Loader2, Check } from 'lucide-react';
import { getAuth } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useRequireSuperAdmin } from '@/hooks/use-auth';

type DomainRequest = {
  id: string;
  domain: string;
  userEmail: string;
  status: 'pending_payment' | 'pending_setup' | 'active' | string;
  paymentReference: string;
  createdAt?: string | number | Date;
  storeId: string;
  amount?: number;
};

export default function AdminDomainRequests() {
  useRequireSuperAdmin();

  const [requests, setRequests] = useState<DomainRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const auth = getAuth();
      const idToken = await auth.currentUser?.getIdToken();

      const res = await fetch('/api/superadmin/domains', {
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (!res.ok) throw new Error('Failed to fetch domain requests');

      const data = await res.json();
      setRequests(data || []);
    } catch (error) {
      console.error(error);
      toast({
        title: 'Error',
        description: 'Could not load domain requests.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleActivate = async (req: DomainRequest) => {
    const confirmed = window.confirm(
      `Confirm this domain is fully ready:\n\n` +
        `• You have purchased "${req.domain}" from the registrar\n` +
        `• DNS / nameservers are pointing to SellQuic (Vercel)\n\n` +
        `Click "OK" to mark this domain as Active for the store.`
    );
    if (!confirmed) return;

    setProcessingId(req.id);
    try {
      const auth = getAuth();
      const idToken = await auth.currentUser?.getIdToken();

      const res = await fetch('/api/superadmin/domains/activate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          requestId: req.id,
          domain: req.domain,
          storeId: req.storeId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = data?.error || 'Failed to activate domain';
        throw new Error(msg);
      }

      toast({
        title: 'Domain Activated ✅',
        description: `${req.domain} is now live for the vendor.`,
      });
      fetchRequests();
    } catch (error: any) {
      console.error(error);
      toast({
        title: 'Activation Failed',
        description: error.message || 'Could not mark domain as active.',
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'pending_payment':
        return 'destructive';
      case 'pending_setup':
        return 'default';
      case 'active':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending_payment':
        return 'Pending Payment';
      case 'pending_setup':
        return 'Waiting Setup';
      case 'active':
        return 'Active';
      default:
        return status.replace('_', ' ');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="animate-spin h-6 w-6 text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>SellQuic Domain Orders</CardTitle>
            <CardDescription className="max-w-xl text-xs sm:text-sm">
              These are domains that vendors bought through SellQuic (Paystack +
              manual Porkbun/registrar). Use this page after you’ve{' '}
              <span className="font-semibold">
                bought and configured the domain at the registrar
              </span>{' '}
              to mark it as active for their store.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchRequests}>
            <Loader2 className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Domain</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Payment Ref</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((req) => (
              <TableRow key={req.id}>
                <TableCell className="font-semibold">
                  {req.domain || '-'}
                </TableCell>

                <TableCell className="text-xs sm:text-sm text-muted-foreground">
                  {req.userEmail || '-'}
                </TableCell>

                <TableCell>
                  <Badge
                    variant={getStatusVariant(req.status)}
                    className={
                      req.status === 'pending_setup'
                        ? 'bg-yellow-500/10 text-yellow-800 border-yellow-400/60'
                        : ''
                    }
                  >
                    {getStatusLabel(req.status)}
                  </Badge>
                </TableCell>

                <TableCell className="text-xs font-mono">
                  {typeof req.amount === 'number'
                    ? `GHS ${req.amount.toFixed(2)}`
                    : '—'}
                </TableCell>

                <TableCell className="font-mono text-[11px]">
                  {req.paymentReference || '—'}
                </TableCell>

                <TableCell className="text-xs">
                  {req.createdAt
                    ? format(new Date(req.createdAt), 'PP p')
                    : '—'}
                </TableCell>

                <TableCell className="text-right">
                  {req.status === 'pending_setup' ? (
                    <Button
                      size="sm"
                      onClick={() => handleActivate(req)}
                      disabled={processingId === req.id}
                    >
                      {processingId === req.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="mr-2 h-4 w-4" />
                      )}
                      Mark Active
                    </Button>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">
                      {req.status === 'active'
                        ? 'Already active'
                        : 'No action'}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}

            {requests.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center h-24 text-muted-foreground text-sm"
                >
                  No domain requests yet. When a vendor buys a domain through
                  SellQuic, it will show up here.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
