
'use client';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { useEffect, useState } from 'react';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { Sparkles, Edit } from 'lucide-react';
import { AnimatedCounter } from '@/components/animated-counter';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';

export default function StaffDashboardPage() {
    const { user } = useAuth();
    const firestore = useFirestore();
    const [demoCount, setDemoCount] = useState(0);
    const [recentDemos, setRecentDemos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!firestore) return;

        const demoStoresRef = collection(firestore, 'demo_stores');
        
        const unsubCount = onSnapshot(demoStoresRef, (snapshot) => {
            setDemoCount(snapshot.size);
        });

        const recentDemosQuery = query(demoStoresRef, orderBy('createdAt', 'desc'), limit(5));
        const unsubRecent = onSnapshot(recentDemosQuery, (snapshot) => {
            const demos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setRecentDemos(demos);
            setLoading(false);
        });


        return () => {
            unsubCount();
            unsubRecent();
        };
    }, [firestore]);


    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Welcome, {user?.displayName || 'Staff Member'}!</h1>
            <p className="text-muted-foreground">This is your staff dashboard. Here's a quick overview of demo store performance.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="animated-border-card">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Total Demo Stores</CardTitle>
                            <Sparkles className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                             {loading ? <div className="h-8 w-16 bg-gray-200 animate-pulse rounded-md" /> : <AnimatedCounter to={demoCount} />}
                            <p className="text-xs text-muted-foreground">Total number of demos created.</p>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Recent Demo Stores</CardTitle>
                    <CardDescription>The last 5 demo stores created.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Created</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center h-24">Loading...</TableCell>
                                </TableRow>
                            ) : recentDemos.length > 0 ? (
                                recentDemos.map(demo => (
                                    <TableRow key={demo.id}>
                                        <TableCell className="font-medium">{demo.name}</TableCell>
                                        <TableCell><Badge variant={demo.status === 'published' ? 'default' : 'secondary'}>{demo.status || 'draft'}</Badge></TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {demo.createdAt ? formatDistanceToNow(demo.createdAt.toDate(), { addSuffix: true }) : 'N/A'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button asChild variant="outline" size="sm">
                                                <Link href={`/staff/demos/${demo.slug}/edit`}>
                                                    <Edit className="h-3 w-3 mr-2"/>
                                                    Edit
                                                </Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                                        No demo stores created yet.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
