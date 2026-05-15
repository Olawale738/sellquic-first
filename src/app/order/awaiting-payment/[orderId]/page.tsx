
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, DocumentData, Timestamp, updateDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Copy, Check, Banknote, Phone, PartyPopper, AlertCircle, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { WhatsAppButton } from '@/components/whatsapp-button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';
import Link from 'next/link';
import { formatPhoneNumberForApi } from '@/lib/utils';

interface Order extends DocumentData {
    id: string;
    totalAmount: number;
    status: 'awaiting-payment' | 'pending' | 'confirmed' | 'fulfilled';
    createdAt: Timestamp;
    storeId: string;
    paymentReference: string;
    selectedPaymentMethod?: 'paystack' | 'momo' | 'cod';
}

interface Store extends DocumentData {
    name: string;
    sellerId: string;
    momoNumber?: string;
    momoAccountName?: string;
    momoNetwork?: string;
    isBankPaymentActive?: boolean;
    bankName?: string;
    bankAccountName?: string;
    bankAccountNumber?: string;
    bankBranch?: string;
    sellerPhone?: string;
}

export default function AwaitingPaymentPage({ orderId: propOrderId }: { orderId?: string | null }) {
    const params = useParams();
    const orderId = propOrderId || (params?.orderId as string | undefined);
    const router = useRouter();
    const { toast } = useToast();
    const firestore = useFirestore();

    const [order, setOrder] = useState<Order | null>(null);
    const [store, setStore] = useState<Store | null>(null);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'paymentDetails' | 'confirming' | 'confirmed'>('paymentDetails');
    const { width, height } = useWindowSize();

    useEffect(() => {
        if (!orderId || !firestore) {
            if (!orderId) setLoading(false);
            return;
        }

        const fetchOrderAndStore = async () => {
            try {
                const orderSnap = await getDoc(doc(firestore, 'orders', orderId as string));
                if (orderSnap.exists()) {
                    const orderData = { id: orderSnap.id, ...orderSnap.data() } as Order;
                    setOrder(orderData);

                    if (orderData.storeId) {
                        const storeSnap = await getDoc(doc(firestore, 'stores', orderData.storeId));
                        if (storeSnap.exists()) {
                            const storeDetails = storeSnap.data() as Store;
                            
                            // Fetch seller data to get the correct phone number
                            if (storeDetails.sellerId) {
                                try {
                                  const sellerSnap = await getDoc(doc(firestore, 'users', storeDetails.sellerId));
                                  if (sellerSnap.exists()) {
                                    storeDetails.sellerPhone = sellerSnap.data()?.phone;
                                  }
                                } catch (e) {
                                  // silently fail — do NOT break page
                                  storeDetails.sellerPhone = undefined;
                                }
                              }
                            
                            setStore(storeDetails);
                            
                            if (orderData.status === 'awaiting-payment' && !storeDetails.momoNumber) {
                                setView('confirmed');
                            }
                        }
                    }
                } else {
                    toast({ title: 'Order not found', variant: 'destructive' });
                    router.push('/');
                }
            } catch (err) { 
                console.error("Error fetching order/store data:", err); 
                toast({ title: 'Error loading page', variant: 'destructive' });
            } finally { 
                setLoading(false); 
            }
        };
      
        fetchOrderAndStore();
    }, [orderId, firestore, router, toast]);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({ title: 'Copied to clipboard!' });
    };

    const handleConfirmPayment = async () => {
        if (!order || !firestore) return;
        
        setView('confirming');

        try {
             // Simulate a brief delay for user feedback
            await new Promise(resolve => setTimeout(resolve, 1500));

            const orderRef = doc(firestore, 'orders', order.id);
            await updateDoc(orderRef, { status: 'pending' });
            
            setView('confirmed');
        } catch (error) {
            console.error("Error confirming payment:", error);
            toast({ title: "Confirmation Failed", description: "Please try again.", variant: "destructive" });
            setView('paymentDetails'); // Revert view on error
        }
    }

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    if (!order || !store) {
        return (
             <div className="flex h-screen items-center justify-center">
                <p>Could not load payment details.</p>
            </div>
        )
    }
    
     if (order.status !== 'awaiting-payment' && view !== 'confirmed') {
        return (
            <div className="container mx-auto px-4 py-8 text-center">
                 <Alert variant="default" className="max-w-md mx-auto bg-green-50 border-green-200">
                    <Check className="h-4 w-4" />
                    <AlertTitle>Payment Confirmed!</AlertTitle>
                    <AlertDescription>
                        Thank you! your payment has been confirmed. You will receive updates from us  shortly.
                    </AlertDescription>
                </Alert>
                <Button onClick={() => router.push(`/track/${order.id}`)} className="mt-4">
                   
                </Button>
            </div>
        );
    }
    
    if (view === 'confirmed') {
         return (
             <div className="container mx-auto max-w-lg px-4 py-8">
                <Confetti width={width} height={height} recycle={false} numberOfPieces={200} />
                <Card className="shadow-lg text-center">
                    <CardHeader>
                        <PartyPopper className="mx-auto h-16 w-16 text-primary" />
                        <CardTitle className="text-2xl mt-4">Thank You for Your Order!</CardTitle>
                        <CardDescription>We've received your order and will process it shortly.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-lg">"{store.name}" is now confirming your payment.</p>
                        <p className="text-muted-foreground mt-2">You will receive an SMS notification once it's confirmed.</p>
                        <Button onClick={() => router.push(`/track/${order.id}`)} className="mt-6 w-full">
                            Track Your Order Status
                        </Button>
                    </CardContent>
                </Card>
             </div>
         )
    }

    return (
        <div className="container mx-auto max-w-lg px-4 py-8">
            <Card className="shadow-lg">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl">Complete Your Order</CardTitle>
                    <CardDescription>Send payment using one of the options below.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    
                    <div className="bg-primary/10 border-2 border-dashed border-primary/50 text-primary p-4 rounded-lg space-y-1 text-center">
                        <p className="text-sm font-medium">TOTAL AMOUNT</p>
                        <p className="text-4xl font-bold">GHS {order.totalAmount.toFixed(2)}</p>
                         <p className="text-xs font-mono !mt-2">Payment Reference: {order.paymentReference}</p>
                    </div>

                    {store.momoNumber && (
                        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                            <div>
                                <h4 className="text-xs font-bold uppercase text-gray-500 mb-2 flex items-center gap-1">
                                    <Phone className="h-3 w-3" /> Mobile Money
                                </h4>
                                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 flex justify-between items-center">
                                    <div>
                                        <p className="font-bold text-lg text-gray-900">{store.momoNumber}</p>
                                        <p className="text-xs text-gray-500">{store.momoNetwork} • {store.momoAccountName}</p>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={() => copyToClipboard(store.momoNumber || '')}>
                                        <Copy className="h-4 w-4 mr-1"/> Copy
                                    </Button>
                                </div>
                            </div>

                            {store.isBankPaymentActive && (
                                <div className="pt-2 border-t mt-2">
                                    <h4 className="text-xs font-bold uppercase text-gray-500 mb-2 flex items-center gap-1 mt-2">
                                        <Banknote className="h-3 w-3" /> Bank Transfer
                                    </h4>
                                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 space-y-1">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-bold text-gray-900">{store.bankName}</p>
                                                <p className="text-xs text-gray-500">Acc: {store.bankAccountName}</p>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center pt-1">
                                            <p className="font-mono text-sm font-medium">{store.bankAccountNumber}</p>
                                            <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => copyToClipboard(store.bankAccountNumber || '')}>
                                                <Copy className="h-3 w-3"/>
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="bg-blue-50 text-blue-800 text-xs p-3 rounded flex gap-2 items-start">
                                <Info className="h-4 w-4 flex-shrink-0 mt-0.5"/>
                                <p>Use Reference: <strong>{order.paymentReference}</strong> when sending money.</p>
                            </div>
                        </div>
                    )}
                    
                    {order.selectedPaymentMethod !== 'cod' && (
                        store?.sellerPhone ? (
                            <Button 
                                className="w-full h-12 text-base font-semibold bg-[#25D366] hover:bg-[#128C7E] text-white shadow-md hover:shadow-lg transition-all" 
                                onClick={() => {
                                    const formattedPhone = formatPhoneNumberForApi(store.sellerPhone!);
                                    const msg = `Hi, I placed order ${order.paymentReference} (GHS ${order.totalAmount.toFixed(2)}). I have sent the payment.`;
                                    if(formattedPhone) {
                                      window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`, '_blank');
                                    } else {
                                      toast({ title: 'Seller phone number is invalid.' });
                                    }
                                }}
                            >
                                <Phone className="h-5 w-5 mr-2" /> Notify Seller on WhatsApp
                            </Button>
                        ) : (
                            <p className="text-center text-xs text-muted-foreground">
                            Payment sent? The seller will confirm your order shortly 😊
                            </p>
                        )
                    )}
                    
                    <Button size="lg" className="w-full" onClick={handleConfirmPayment} disabled={view === 'confirming'}>
                        {view === 'confirming' ? <Loader2 className="animate-spin mr-2"/> : null}
                        {view === 'confirming' ? 'Confirming...' : "I've Sent Payment"}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
