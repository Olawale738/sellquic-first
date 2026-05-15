'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { hasCommerceAccess } from '@/lib/subscription-access';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ShoppingCart, MessageCircle, Phone, Lock, ArrowUpRight, ChevronDown } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useFirestore } from '@/firebase';
import { collection, query, where, orderBy, onSnapshot, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { formatPhoneNumberForApi } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';


// Define the interface for the cart data
interface AbandonedCart {
    id: string;
    customerInfo?: {
        name?: string;
        phone?: string;
    };
    totalAmount?: number;
    lastUpdated?: Timestamp;
    items?: { name: string; quantity: number }[];
}


const AbandonedCartCard = ({ cart, isPremium, handleRecover, handleDelete }: { cart: AbandonedCart, isPremium: boolean, handleRecover: (cart: AbandonedCart) => void, handleDelete: (id: string) => void }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="animated-border-card bg-white">
             <div className="p-4 cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
                <div className="flex justify-between items-start mb-2">
                    <div className="flex flex-col">
                        {isPremium ? (
                            <>
                                <span className="font-semibold truncate pr-2">{cart.customerInfo?.name || 'Guest'}</span>
                                <span className="text-xs text-muted-foreground">{cart.customerInfo?.phone}</span>
                            </>
                        ) : (
                             <div className="flex items-center gap-2 text-muted-foreground blur-[4px] select-none">
                                <Lock className="h-3 w-3" /> Hidden Contact
                            </div>
                        )}
                    </div>
                    <span className="font-bold text-lg">GH₵ {cart.totalAmount?.toFixed(2)}</span>
                </div>
                 <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <span>{cart.lastUpdated?.seconds ? formatDistanceToNow(new Date(cart.lastUpdated.seconds * 1000), { addSuffix: true }) : 'Just now'}</span>
                     <div className="flex items-center justify-end gap-2">
                        <span>{isOpen ? 'Close' : 'Details'}</span>
                        <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')}/>
                    </div>
                </div>
            </div>
             <CollapsibleContent className="border-t p-4">
                 <div className="space-y-4">
                    <div>
                        <h4 className="font-semibold text-sm mb-1">Items in Cart</h4>
                        <div className="text-sm text-muted-foreground">
                            {cart.items?.map((item: any, index: number) => (
                                <div key={index}>- {item.name} (x{item.quantity})</div>
                            ))}
                        </div>
                    </div>
                     <div className="text-right">
                        {isPremium ? (
                            <div className="flex justify-end gap-2">
                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
                                    onClick={() => handleRecover(cart)}
                                    disabled={!cart.customerInfo?.phone}
                                >
                                    <MessageCircle className="h-4 w-4 mr-2" /> WhatsApp
                                </Button>
                                <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className="text-red-400 hover:text-red-600"
                                    onClick={() => handleDelete(cart.id)}
                                >
                                    &times;
                                </Button>
                            </div>
                        ) : (
                             <Button size="sm" variant="secondary" disabled>
                                <Lock className="h-3 w-3 mr-2" /> Upgrade to Recover
                            </Button>
                        )}
                    </div>
                 </div>
            </CollapsibleContent>
        </Collapsible>
    )
}

export default function AbandonedCartsPage() {
  const { user, activeStore } = useAuth();
  const firestore = useFirestore();
  const [carts, setCarts] = useState<AbandonedCart[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. Check Subscription Status
  const isPremium = hasCommerceAccess(user?.subscription);

  // 2. Fetch Carts
  useEffect(() => {
    if (!activeStore || !firestore) {
        setLoading(false);
        return;
    };

    setLoading(true);
    const q = query(
      collection(firestore, 'abandoned_checkouts'),
      where('storeId', '==', activeStore.id)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AbandonedCart));
      data.sort((a, b) => (b.lastUpdated?.toMillis() || 0) - (a.lastUpdated?.toMillis() || 0));
      setCarts(data);
      setLoading(false);
    }, (error) => {
        console.error("Error fetching abandoned carts: ", error);
        setLoading(false);
    });

    return () => unsub();
  }, [activeStore, firestore]);

  // 3. WhatsApp Recovery Logic
  const handleRecover = (cart: AbandonedCart) => {
    if (!isPremium || !activeStore) return; // Security check
    
    const phone = cart.customerInfo?.phone;
    if (!phone) return;
    
    const formattedPhone = formatPhoneNumberForApi(phone);
    if (!formattedPhone) return;

    // 1. Determine the Base URL (Custom domain or Subdomain)
    const baseUrl = activeStore.customDomain 
        ? `https://${activeStore.customDomain}` 
        : `https://${activeStore.subdomain}.sellquic.com`;

    // 2. Generate the Recovery Link with the ID
    const recoveryLink = `${baseUrl}/checkout?recovery=${cart.id}`;
    
    const message = `Hi ${cart.customerInfo?.name || 'there'}, we noticed you left some items in your cart at ${activeStore.name}. Don't miss out! You can complete your order here: ${recoveryLink}`;
    
    window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleDelete = async (id: string) => {
      if(!confirm("Are you sure you want to remove this entry?")) return;
      if (!firestore) return;
      await deleteDoc(doc(firestore, 'abandoned_checkouts', id));
  }

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
                <ShoppingCart className="h-6 w-6" /> Abandoned Carts
            </h1>
            <p className="text-muted-foreground">Recover lost sales by contacting customers who didn't finish checkout.</p>
        </div>
        {!isPremium && (
             <Button asChild className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-0 shadow-md hover:shadow-lg transition-all">
                <Link href="/dashboard/subscription">Upgrade to Unlock</Link>
             </Button>
        )}
      </div>

      {/* Mobile View */}
      <div className="sm:hidden space-y-4">
          {carts.length === 0 ? (
             <div className="text-center h-48 text-muted-foreground flex flex-col justify-center items-center">
                <ShoppingCart className="h-10 w-10 mx-auto mb-2 opacity-30"/>
                No abandoned carts found recently. Good job!
            </div>
          ) : (
             carts.map((cart) => (
                <AbandonedCartCard 
                    key={cart.id} 
                    cart={cart} 
                    isPremium={isPremium} 
                    handleRecover={handleRecover}
                    handleDelete={handleDelete}
                />
            ))
          )}
      </div>

      {/* Desktop View */}
      <div className="hidden sm:block">
        <Card>
            <CardContent className="p-0">
            <Table>
                <TableHeader>
                <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Cart Value</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {carts.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={5} className="text-center h-48 text-muted-foreground">
                            <ShoppingCart className="h-10 w-10 mx-auto mb-2 opacity-30"/>
                            No abandoned carts found recently. Good job!
                        </TableCell>
                    </TableRow>
                ) : (
                    carts.map((cart: AbandonedCart) => (
                    <TableRow key={cart.id} className={!isPremium ? 'select-none' : ''}>
                        {/* Time */}
                        <TableCell className="text-sm text-muted-foreground">
                            {cart.lastUpdated?.seconds 
                                ? formatDistanceToNow(new Date(cart.lastUpdated.seconds * 1000), { addSuffix: true }) 
                                : 'Just now'}
                        </TableCell>

                        {/* Customer Info (BLURRED IF FREE) */}
                        <TableCell>
                            {isPremium ? (
                                <div className="flex flex-col">
                                    <span className="font-medium">{cart.customerInfo?.name || 'Guest'}</span>
                                    <span className="text-xs text-muted-foreground">{cart.customerInfo?.phone}</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-muted-foreground blur-[4px]">
                                    <Lock className="h-3 w-3" /> Hidden Contact
                                </div>
                            )}
                        </TableCell>

                        {/* Amount */}
                        <TableCell className="font-bold">
                            GH₵ {cart.totalAmount?.toFixed(2)}
                        </TableCell>

                        {/* Items */}
                        <TableCell>
                            <span className="text-xs bg-slate-100 px-2 py-1 rounded-full text-slate-700">
                                {cart.items?.length || 0} items
                            </span>
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right">
                            {isPremium ? (
                                <div className="flex justify-end gap-2">
                                    <Button 
                                        size="sm" 
                                        variant="outline" 
                                        className="text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
                                        onClick={() => handleRecover(cart)}
                                        disabled={!cart.customerInfo?.phone}
                                    >
                                        <MessageCircle className="h-4 w-4 mr-2" /> WhatsApp
                                    </Button>
                                    <Button 
                                        size="icon" 
                                        variant="ghost" 
                                        className="text-red-400 hover:text-red-600"
                                        onClick={() => handleDelete(cart.id)}
                                    >
                                        &times;
                                    </Button>
                                </div>
                            ) : (
                                <Button size="sm" variant="secondary" disabled>
                                    <Lock className="h-3 w-3 mr-2" /> Upgrade to Recover
                                </Button>
                            )}
                        </TableCell>
                    </TableRow>
                    ))
                )}
                </TableBody>
            </Table>
            </CardContent>
        </Card>
      </div>
      
      {!isPremium && carts.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-lg flex flex-col items-center text-center">
              <h3 className="text-lg font-bold text-yellow-900 mb-2">
                  You have {carts.length} potential sales waiting!
              </h3>
              <p className="text-yellow-800 mb-4 max-w-md">
                  Upgrade to unlock customer details and send WhatsApp recovery messages with one click.
              </p>
              <Button asChild>
                  <Link href="/dashboard/subscription">Unlock Revenue Now <ArrowUpRight className="h-4 w-4 ml-2"/></Link>
              </Button>
          </div>
      )}
    </div>
  );
}
