
'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { format, startOfMonth } from 'date-fns';
import { Loader2 } from 'lucide-react';

export default function RevenueReportPage() {
  const [txns, setTxns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const firestore = useFirestore();

  useEffect(() => {
    if (!firestore) return;
    const fetch = async () => {
        const start = startOfMonth(new Date());
        const q = query(collection(firestore, 'transactions'), where('createdAt', '>=', start), where('status', '==', 'completed'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        
        const data = snap.docs.map(d => {
            const raw = d.data();
            // All amounts are in pesewas, convert to GHS
            let amt = (Number(raw.amount) || 0) / 100;
            
            return { id: d.id, ...raw, amount: amt };
        });
        
        setTxns(data);
        setLoading(false);
    };
    fetch();
  }, [firestore]);

  const total = txns.reduce((sum, t) => sum + t.amount, 0);
  const subs = txns.filter(t => t.type !== 'domain_purchase').reduce((sum, t) => sum + t.amount, 0);
  const domains = txns.filter(t => t.type === 'domain_purchase').reduce((sum, t) => sum + t.amount, 0);

  if(loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold">Monthly Revenue Report for {format(new Date(), 'MMMM yyyy')}</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4"><p className="text-sm text-muted-foreground">Total Revenue</p><p className="text-2xl font-bold">GH₵ {total.toFixed(2)}</p></Card>
            <Card className="p-4"><p className="text-sm text-muted-foreground">Subscriptions</p><p className="text-2xl font-bold text-green-600">GH₵ {subs.toFixed(2)}</p></Card>
            <Card className="p-4"><p className="text-sm text-muted-foreground">Domains</p><p className="text-2xl font-bold text-blue-600">GH₵ {domains.toFixed(2)}</p></Card>
        </div>
        
        <Card>
            <CardHeader><CardTitle>Transactions (This Month)</CardTitle></CardHeader>
            <CardContent>
                {txns.map(t => (
                    <div key={t.id} className="flex justify-between border-b py-2">
                        <div>
                            <p className="font-bold">{t.type === 'subscription' ? 'Plan Upgrade' : (t.type === 'domain_purchase' ? 'Domain Purchase' : 'Other')}</p>
                            <p className="text-xs text-muted-foreground">{t.userEmail}</p>
                        </div>
                        <div className="text-right">
                            <p className="font-bold">GH₵ {t.amount.toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground">{t.createdAt?.seconds ? format(new Date(t.createdAt.seconds * 1000), 'PP') : 'N/A'}</p>
                        </div>
                    </div>
                ))}
                {txns.length === 0 && <p className="text-muted-foreground text-center p-8">No transactions this month.</p>}
            </CardContent>
        </Card>
    </div>
  );
}
