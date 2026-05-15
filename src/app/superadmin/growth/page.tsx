
'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore } from '@/firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';

export default function GrowthPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const firestore = useFirestore();

  useEffect(() => {
    if (!firestore) return;
    const fetch = async () => {
        // Last 50 Signups
        const q = query(collection(firestore, 'users'), orderBy('createdAt', 'desc'), limit(50));
        const snap = await getDocs(q);
        setUsers(snap.docs.map(d => ({id: d.id, ...d.data()})));
        setLoading(false);
    };
    fetch();
  }, [firestore]);

  if(loading) return <Loader2 className="animate-spin" />;

  return (
    <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold mb-6">Growth & Signups</h1>
        <Card>
            <CardHeader><CardTitle>Recent Signups (Last 50)</CardTitle></CardHeader>
            <CardContent>
                {users.map(u => (
                    <div key={u.id} className="flex justify-between items-center border-b py-2">
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 bg-gray-100 rounded-full flex items-center justify-center font-bold">
                                {u.displayName?.charAt(0) || 'U'}
                            </div>
                            <div>
                                <p className="font-medium">{u.displayName}</p>
                                <p className="text-xs text-muted-foreground">{u.email}</p>
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {u.createdAt?.seconds ? format(new Date(u.createdAt.seconds * 1000), 'PP p') : 'N/A'}
                        </p>
                    </div>
                ))}
            </CardContent>
        </Card>
    </div>
  );
}
