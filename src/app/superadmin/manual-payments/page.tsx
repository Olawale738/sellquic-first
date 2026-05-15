
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot, query, where, doc, updateDoc, writeBatch, Timestamp } from 'firebase/firestore';
import { addMonths } from 'date-fns';
import { useFirestore } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { useRequireSuperAdmin } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Loader2, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface UpgradeRequest {
    id: string;
    userId: string;
    userName: string;
    userEmail: string;
    requestedPlanId: 'business' | 'enterprise';
    requestedCycle: 'monthly' | 'quarterly';
    status: 'pending' | 'approved' | 'rejected';
    createdAt: Timestamp;
}

const planPrices: Record<string, Record<string, number>> = {
  business: { monthly: 6900, quarterly: 19900 },
  enterprise: { monthly: 12900, quarterly: 36900 },
};

export default function ManualPaymentsPage() {
    useRequireSuperAdmin();
    const [requests, setRequests] = useState<UpgradeRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('pending');
    const firestore = useFirestore();
    const { toast } = useToast();

    useEffect(() => {
        if (!firestore) return;
        const q = query(collection(firestore, 'manualUpgradeRequests'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedRequests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UpgradeRequest));
            fetchedRequests.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
            setRequests(fetchedRequests);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching upgrade requests:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [firestore]);

    const handleApprove = async (request: UpgradeRequest) => {
        if (!firestore) return;
        setProcessingId(request.id);
        
        const userRef = doc(firestore, 'users', request.userId);
        const requestRef = doc(firestore, 'manualUpgradeRequests', request.id);
        const batch = writeBatch(firestore);

        try {
            const durationMonths = request.requestedCycle === 'quarterly' ? 3 : 1;
            const subscriptionData = {
                planId: request.requestedPlanId,
                status: 'active',
                startDate: new Date(),
                endDate: addMonths(new Date(), durationMonths),
                billingCycle: request.requestedCycle,
            };
            batch.update(userRef, { subscription: subscriptionData });
            
            const transactionRef = doc(collection(firestore, "transactions"));
            batch.set(transactionRef, {
                userId: request.userId,
                planId: request.requestedPlanId,
                amount: planPrices[request.requestedPlanId]?.[request.requestedCycle] || 0,
                type: 'manual_upgrade',
                source: 'manual',
                createdAt: new Date(),
                status: 'completed',
                userEmail: request.userEmail,
                userName: request.userName,
            });

            batch.update(requestRef, { status: 'approved' });
            
            await batch.commit();

            toast({ title: "Upgrade Approved", description: `${request.userName}'s plan has been upgraded.` });
        } catch (error) {
            console.error("Error approving upgrade:", error);
            toast({ title: "Approval Failed", variant: 'destructive' });
        } finally {
            setProcessingId(null);
        }
    };
    
    const handleReject = async (request: UpgradeRequest) => {
        if (!firestore) return;
        setProcessingId(request.id);
        const requestRef = doc(firestore, 'manualUpgradeRequests', request.id);
        try {
            await updateDoc(requestRef, { status: 'rejected' });
            toast({ title: "Request Rejected", variant: 'destructive' });
        } catch (error) {
            console.error("Error rejecting request:", error);
            toast({ title: "Action Failed", variant: 'destructive' });
        } finally {
            setProcessingId(null);
        }
    };

    const filteredRequests = useMemo(() => {
        return requests.filter(req => req.status === activeTab);
    }, [requests, activeTab]);

    if (loading) {
        return <p>Loading manual payment requests...</p>;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Manual Upgrade Requests</CardTitle>
                <CardDescription>Review and process manual payment submissions from users.</CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
                    <TabsList>
                        <TabsTrigger value="pending">Pending</TabsTrigger>
                        <TabsTrigger value="approved">Approved</TabsTrigger>
                        <TabsTrigger value="rejected">Rejected</TabsTrigger>
                    </TabsList>
                </Tabs>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead>Requested Plan</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredRequests.map(req => (
                            <TableRow key={req.id}>
                                <TableCell>
                                    <div className="font-medium">{req.userName}</div>
                                    <div className="text-sm text-muted-foreground">{req.userEmail}</div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className="capitalize">
                                        {req.requestedPlanId} ({req.requestedCycle})
                                    </Badge>
                                </TableCell>
                                <TableCell>{formatDistanceToNow(req.createdAt.toDate(), { addSuffix: true })}</TableCell>
                                <TableCell className="text-right">
                                    {activeTab === 'pending' && (
                                        <div className="flex gap-2 justify-end">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="text-green-600 border-green-600 hover:bg-green-50 hover:text-green-700"
                                                onClick={() => handleApprove(req)}
                                                disabled={processingId === req.id}
                                            >
                                                {processingId === req.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Check className="h-4 w-4"/>}
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                onClick={() => handleReject(req)}
                                                disabled={processingId === req.id}
                                            >
                                                 {processingId === req.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <X className="h-4 w-4"/>}
                                            </Button>
                                        </div>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                        {filteredRequests.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center">
                                    No {activeTab} requests found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}
