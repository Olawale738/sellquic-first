'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useFirestore } from '@/firebase';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { useRequireSuperAdmin } from '@/hooks/use-auth';

export default function ActiveUsersPage() {
  useRequireSuperAdmin();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const firestore = useFirestore();

  useEffect(() => {
    if (!firestore) return;
    const fetchActiveUsers = async () => {
        try {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            
            const q = query(
                collection(firestore, 'users'), 
                where('lastSeen', '>=', yesterday), 
                orderBy('lastSeen', 'desc')
            );
            
            const snap = await getDocs(q);
            setUsers(snap.docs.map(d => ({id: d.id, ...d.data()})));
        } catch (error) {
            console.error("Error fetching active users. You might need to create a Firestore index.", error);
        } finally {
            setLoading(false);
        }
    };
    fetchActiveUsers();
  }, [firestore]);

  if(loading) {
    return (
        <div className="flex justify-center items-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
    );
  }

  return (
    <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Daily Active Users ({users.length})</h1>
        <Card>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Last Seen</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {users.length > 0 ? users.map(u => (
                        <TableRow key={u.id}>
                            <TableCell>{u.displayName || 'User'}</TableCell>
                            <TableCell>{u.email}</TableCell>
                            <TableCell>
                                {u.lastSeen?.seconds 
                                    ? format(new Date(u.lastSeen.seconds * 1000), 'PP p') 
                                    : 'Just now'}
                            </TableCell>
                        </TableRow>
                    )) : (
                        <TableRow>
                            <TableCell colSpan={3} className="text-center h-24 text-muted-foreground">
                                No users have been active in the last 24 hours.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </Card>
    </div>
  );
}
