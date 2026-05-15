'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { useFirestore } from '@/firebase';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Loader2, Wallet } from 'lucide-react';

export default function WalletCard() {
  const { activeStore } = useAuth();
  const firestore = useFirestore();
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [vendorRate, setVendorRate] = useState(0.95); // Default 95%

  // 1. Fetch Commission Rate
  useEffect(() => {
      if (!firestore) return;
      const fetchRate = async () => {
          try {
              const settingSnap = await getDoc(doc(firestore, 'settings', 'platform'));
              if (settingSnap.exists()) {
                  const data = settingSnap.data();
                  // FIX: Use ?? so 0 is accepted as a valid number
                  const comm = data.commissionPercentage ?? 5;
                  setVendorRate(1 - (comm / 100)); 
              }
          } catch(e) {
              console.warn("Could not fetch commission rate");
          }
      };
      fetchRate();
  }, [firestore]);

  // 2. Calculate Balance
  useEffect(() => {
    if (!activeStore || !firestore) {
        setLoading(false);
        return;
    }

    setLoading(true);
    const q = query(
      collection(firestore, 'orders'),
      where('storeId', '==', activeStore.id),
      where('status', 'in', ['confirmed', 'fulfilled']),
      where('selectedPaymentMethod', '==', 'paystack') 
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        let total = 0;
        snapshot.forEach(doc => {
            const order = doc.data();
            if (order.totalAmount) {
                total += (order.totalAmount * vendorRate);
            }
        });
        setBalance(total);
        setLoading(false);
    }, (error) => {
        console.error("Error fetching balance: ", error);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [activeStore, firestore, vendorRate]);

  return (
    <div className="animated-border-card">
      <Card className="bg-gradient-to-br from-gray-900 to-gray-800 text-white border-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
            <Wallet className="h-4 w-4" /> Paystack Balance ({(vendorRate * 100).toFixed(0)}%)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <div className="text-2xl font-bold">
              GH₵{balance.toFixed(2)}
            </div>
          )}
          <p className="text-xs text-gray-400 mt-1">
            Processed via Paystack. Payouts are automatic.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}