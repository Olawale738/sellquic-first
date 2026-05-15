'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, Users } from 'lucide-react';
import { getAuth } from 'firebase/auth';
import { format } from 'date-fns';

export default function AdminSubscriptions() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
        const auth = getAuth();
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch('/api/superadmin/subscriptions', {
            headers: { Authorization: `Bearer ${token}` }
        });
        const json = await res.json();
        setData(json);
        setLoading(false);
    };
    fetchData();
  }, []);

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="p-6 space-y-8">
        <h1 className="text-3xl font-bold">Subscription Analytics</h1>
        
        {/* STATS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Monthly Recurring Revenue (MRR)</CardTitle>
                    <TrendingUp className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">GH₵{data?.mrr?.toFixed(2)}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Active Subscribers</CardTitle>
                    <Users className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{data?.subscribers?.length}</div>
                </CardContent>
            </Card>
        </div>

        {/* LIST */}
        <Card>
            <CardHeader><CardTitle>Subscribers List</CardTitle></CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Vendor</TableHead>
                            <TableHead>Plan</TableHead>
                            <TableHead>Start Date</TableHead>
                            <TableHead>Renews On</TableHead>
                            <TableHead>Amount</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data?.subscribers?.map((sub: any) => (
                            <TableRow key={sub.id}>
                                <TableCell>
                                    <div className="font-medium">{sub.name}</div>
                                    <div className="text-xs text-muted-foreground">{sub.email}</div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant={sub.plan === 'enterprise' ? 'default' : 'secondary'}>
                                        {sub.plan.toUpperCase()}
                                    </Badge>
                                </TableCell>
                                <TableCell>{sub.startDate ? format(new Date(sub.startDate._seconds * 1000), 'PP') : '-'}</TableCell>
                                <TableCell>{sub.endDate ? format(new Date(sub.endDate._seconds * 1000), 'PP') : '-'}</TableCell>
                                <TableCell>GH₵{sub.amount}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    </div>
  );
}