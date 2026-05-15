
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { trackMetaEvent } from '@/lib/tracking/meta';
import { generateEventId } from '@/lib/utils';
import { useStore } from '@/context/store-context';
import AwaitingPaymentPage from '@/app/order/awaiting-payment/[orderId]/page';

function PurchaseTracker({ order }: { order: any }) {
  const { store } = useStore();
  const pixelId = store?.marketing?.analytics?.facebookPixelId;

  useEffect(() => {
    if (!order || !pixelId) return;

    const eventId = generateEventId(order.id);
    const items = order.items || [];
    
    trackMetaEvent(
      'Purchase',
      {
        content_ids: items.map((i: any) => i.productId),
        content_type: 'product',
        value: order.totalAmount,
        currency: 'GHS',
        num_items: items.reduce((sum: number, i: any) => sum + i.quantity, 0),
      },
      eventId
    );
  }, [order, pixelId]);

  return null;
}

function OrderConfirmationContent() {
    const searchParams = useSearchParams();
    const firestore = useFirestore();
    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const ref = searchParams.get('ref');
    const orderId = searchParams.get('id') || (ref ? ref.split('-').pop() : null);

    useEffect(() => {
        if (!orderId || !firestore) {
            setLoading(false);
            return;
        }

        const fetchOrder = async () => {
            const orderSnap = await getDoc(doc(firestore, 'orders', orderId));
            if (orderSnap.exists()) {
                setOrder({ id: orderSnap.id, ...orderSnap.data() });
            }
            setLoading(false);
        };
        fetchOrder();

    }, [orderId, firestore]);
    
    if (loading) {
        return <div className="h-screen w-screen flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>
    }

    if (!order) {
        return <div>Order not found.</div>
    }
    
    return (
        <>
            <PurchaseTracker order={order} />
            <AwaitingPaymentPage orderId={orderId} />
        </>
    );
}


export default function OrderConfirmation() {
    return (
        <Suspense fallback={<div className="h-screen w-screen flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>}>
            <OrderConfirmationContent />
        </Suspense>
    );
}

