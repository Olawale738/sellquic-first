
'use client';

import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, DocumentData, Timestamp, doc, updateDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Loader2, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRequireSuperAdmin } from '@/hooks/use-auth';
import { getAuth } from 'firebase/auth';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface PayoutRequest extends DocumentData {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Timestamp;
  payoutInfo: {
      network: string;
      momoNumber: string;
      accountName: string;
  };
  reason?: string;
}

export default function PayoutsPage() {
  useRequireSuperAdmin();
  const [requests, setRequests] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { toast } = useToast();
  const firestore = useFirestore();

  const [rejectionReason, setRejectionReason] = useState('');
  const [currentRequest, setCurrentRequest] = useState<PayoutRequest | null>(null);

  useEffect(() => {
    if (!firestore) return;
    const q = query(collection(firestore, 'payoutRequests'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PayoutRequest)));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching payouts:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [firestore]);

  const handleProcessPayout = async (request: PayoutRequest, action: 'approve' | 'reject', reason?: string) => {
    if (!firestore) return;
    setProcessingId(request.id);
    try {
        const auth = getAuth();
        const idToken = await auth.currentUser?.getIdToken();

        const body: { requestId: string, action: 'approve' | 'reject', reason?: string } = { requestId: request.id, action };
        
        if (action === 'reject') {
            if (!reason || reason.trim() === '') {
                toast({ title: 'Reason required', description: 'Please provide a reason for rejection.', variant: 'destructive'});
                setProcessingId(null);
                return;
            }
            body.reason = reason;
        }

        const response = await fetch('/api/affiliates/process-payout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
            body: JSON.stringify(body),
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error);

        toast({ title: `Payout ${action}d successfully!` });
    } catch (error: any) {
        toast({ title: 'Processing Failed', description: error.message, variant: 'destructive' });
    } finally {
        setProcessingId(null);
        setRejectionReason('');
        setCurrentRequest(null);
    }
  };

  const getStatusVariant = (status: string) => {
      switch(status) {
          case 'pending': return 'secondary';
          case 'approved': return 'default';
          case 'rejected': return 'destructive';
          default: return 'outline';
      }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Affiliate Payout Requests</CardTitle>
        <CardDescription>Review and process pending cash out requests.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? <div className="text-center p-8"><Loader2 className="h-6 w-6 animate-spin mx-auto"/></div> :
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Affiliate</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Payout Details</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map(req => (
              <TableRow key={req.id}>
                <TableCell>
                    <div className="font-medium">{req.userName}</div>
                    <div className="text-sm text-muted-foreground">{req.userEmail}</div>
                </TableCell>
                <TableCell className="font-bold">GHS {req.amount.toFixed(2)}</TableCell>
                <TableCell>
                    {req.payoutInfo ? (
                        <div>
                            <p className="font-semibold">{req.payoutInfo.accountName}</p>
                            <p className="text-xs text-muted-foreground">{req.payoutInfo.network}: {req.payoutInfo.momoNumber}</p>
                        </div>
                    ) : (
                        <span className="text-xs text-muted-foreground">{req.userPhone} (Legacy)</span>
                    )}
                </TableCell>
                <TableCell>
                    <Badge variant={getStatusVariant(req.status)} className="capitalize">
                        {req.status}
                    </Badge>
                     {req.status === 'rejected' && req.reason && <p className="text-xs text-muted-foreground mt-1 max-w-[150px] truncate" title={req.reason}>Reason: {req.reason}</p>}
                </TableCell>
                <TableCell>{format(req.createdAt.toDate(), 'PP p')}</TableCell>
                <TableCell className="text-right">
                    {req.status === 'pending' && (
                        <div className="flex gap-2 justify-end">
                            <Button size="icon" onClick={() => handleProcessPayout(req, 'approve')} disabled={processingId === req.id}>
                                {processingId === req.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Check className="h-4 w-4"/>}
                            </Button>
                            <AlertDialog onOpenChange={(open) => { if(!open) { setRejectionReason(''); setCurrentRequest(null); }}}>
                                <AlertDialogTrigger asChild>
                                    <Button size="icon" variant="destructive" disabled={processingId === req.id} onClick={() => setCurrentRequest(req)}>
                                        <X className="h-4 w-4"/>
                                    </Button>
                                </AlertDialogTrigger>
                                {currentRequest?.id === req.id && (
                                     <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Reject Payout for {currentRequest?.userName}?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Please provide a reason for the rejection. This will be sent to the affiliate.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <div className="space-y-2">
                                            <Label htmlFor="rejection-reason">Reason for Rejection</Label>
                                            <Textarea id="rejection-reason" placeholder="e.g., Payout details incorrect..." value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} />
                                        </div>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction 
                                                onClick={() => {
                                                    if (currentRequest) {
                                                        handleProcessPayout(currentRequest, 'reject', rejectionReason);
                                                    }
                                                }}
                                                disabled={!rejectionReason.trim()}
                                            >
                                                Confirm Reject
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                )}
                            </AlertDialog>
                        </div>
                    )}
                </TableCell>
              </TableRow>
            ))}
             {requests.length === 0 && (
                <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">No payout requests found.</TableCell>
                </TableRow>
             )}
          </TableBody>
        </Table>
        }
      </CardContent>
    </Card>
  );
}

