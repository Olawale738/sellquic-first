
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCart } from '@/hooks/use-cart';
import { useStore } from '@/context/store-context';
import { generateOrderCode } from '@/lib/order-code';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertCircle } from 'lucide-react';
import Image from 'next/image';
import { StoreBreadcrumbs } from '@/components/store-breadcrumbs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { formatPhoneNumberForApi } from '@/lib/utils';
import { WhatsAppButton } from '@/components/whatsapp-button';
import { getStoreBasePath } from '@/lib/url';
import { useAbandonedCart } from '@/hooks/use-abandoned-cart';
import { doc, getDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import CartTimer from '@/components/store/CartTimer';
import PhoneField from '@/components/ui/PhoneInput';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Product } from '@/types/product';
import { ApplyAiCheckoutToCart } from '@/components/store/ApplyAiCheckoutToCart';
import { Badge } from '@/components/ui/badge';
import imageData from '@/lib/placeholder-images.json';
import { trackMetaEvent } from '@/lib/tracking/meta';
const { placeholderImages } = imageData;


interface DeliveryOption {
  id: string;
  label: string;
  fee: number;
  type: 'delivery' | 'pickup';
}

type PaymentMethod = 'paystack' | 'momo' | 'cod';

const paymentMethodLogos: { [key in PaymentMethod]?: string } = {
    paystack: placeholderImages.find(img => img.id === 'paystack-logo')?.imageUrl,
    momo: placeholderImages.find(img => img.id === 'momo-logo')?.imageUrl,
    cod: placeholderImages.find(img => img.id === 'cod-logo')?.imageUrl,
};

export default function CheckoutPage() {
  const { cart, total: cartTotal, clearCart, addItem } = useCart();
  const { store } = useStore();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const firestore = useFirestore();

  const [customerName, setCustomerName] = useState(searchParams.get('name') || '');
  const rawPhone = searchParams.get('phone') || '';
const formatInitialPhone = (phone: string) => {
  if (!phone) return '';
  if (phone.startsWith('+')) return phone;
  if (phone.startsWith('0')) return '+233' + phone.slice(1);
  if (phone.startsWith('233')) return '+' + phone;
  return phone;
};
const [customerPhone, setCustomerPhone] = useState(formatInitialPhone(rawPhone));
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState(searchParams.get('address') || '');
  const [orderNote, setOrderNote] = useState('');
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryOption | null>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [invalidItemsWarning, setInvalidItemsWarning] = useState<string | null>(null);

  const customerInfoForHook = useMemo(() => ({
      name: customerName,
      phone: customerPhone,
      email: customerEmail,
      address: customerAddress
  }), [customerName, customerPhone, customerEmail, customerAddress]);

  const { clearAbandonedCart } = useAbandonedCart(store?.id, cart, customerInfoForHook);

  const recoveryId = searchParams.get('recovery');

  const deliveryOptions: DeliveryOption[] = store?.deliveries || [];

  useEffect(() => {
    if (cart.length > 0) {
      trackMetaEvent('InitiateCheckout', {
        content_ids: cart.map(i => i.id),
        content_type: 'product',
        value: cartTotal,
        currency: 'GHS',
        num_items: cart.reduce((sum, i) => sum + i.quantity, 0),
      });
    }
  }, [cart, cartTotal]);
  
  useEffect(() => {
    const deliveryId = searchParams.get('deliveryId');
    if (!deliveryId) return;
    if (deliveryOptions.length === 0) return;
    // Only set if not already set by user
    setSelectedDelivery(prev => {
      if (prev) return prev; // user already picked one, don't override
      const match = deliveryOptions.find((d) => d.id === deliveryId);
      return match || prev;
    });
  }, [searchParams, deliveryOptions, store]);

  useEffect(() => {
    const processUrlParams = async () => {
        if (!store || !firestore) return;

        if (recoveryId) {
            try {
                const docRef = doc(firestore, 'abandoned_checkouts', recoveryId);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.customerInfo) {
                        setCustomerName(data.customerInfo.name || '');
                        setCustomerEmail(data.customerInfo.email || '');
                        setCustomerAddress(data.customerInfo.address || '');
                        setCustomerPhone(data.customerInfo.phone || '');
                    }

                    if (data.items && data.items.length > 0) {
                         clearCart(); // Clear before restoring
                         data.items.forEach((item: any) => addItem(item, item.quantity, item.selectedVariant));
                         toast({ title: "Cart Restored!", description: "We found the items you left in your cart." });
                    }
                }
            } catch (error) {
                console.error("Failed to recover cart", error);
            }
        }
    };
    
    processUrlParams();

  }, [recoveryId, firestore, store, clearCart, addItem, toast]);


  
  const availablePaymentMethods = useMemo(() => {
    const methods: { id: PaymentMethod, label: string }[] = [];
    if (store?.paymentInfo?.split_configured && store?.isPaystackActive) {
        methods.push({ id: 'paystack', label: 'Pay with Card or MoMo (Paystack)' });
    }
    if (store?.momoNumber && store?.isMomoActive) {
        methods.push({ id: 'momo', label: 'Manual MoMo / Bank Transfer' });
    }
    if (store?.isCodActive) {
        methods.push({ id: 'cod', label: 'Cash on Delivery' });
    }
    return methods;
  }, [store]);

  useEffect(() => {
      if (availablePaymentMethods.length > 0 && !selectedPaymentMethod) {
          setSelectedPaymentMethod(availablePaymentMethods[0].id);
      }
  }, [availablePaymentMethods, selectedPaymentMethod]);


  const total = useMemo(() => cartTotal + (selectedDelivery?.fee || 0), [cartTotal, selectedDelivery]);

  const handlePlaceOrder = async () => {
    if (!customerName || !customerPhone.trim() || !customerAddress) {
      toast({ title: 'Missing Information', description: 'Please fill in all required fields.', variant: 'destructive' });
      return;
    }

    if (deliveryOptions.length > 0 && !selectedDelivery) {
      toast({ title: 'Select Delivery', description: 'Please choose a delivery option.', variant: 'destructive' });
      return;
    }
    
    if (availablePaymentMethods.length > 0 && !selectedPaymentMethod) {
        toast({ title: 'Select Payment Method', description: 'Please choose how you want to pay.', variant: 'destructive' });
        return;
    }

    if (!store || cart.length === 0) {
      toast({ title: 'Error', description: 'Your cart is empty or the store is unavailable.', variant: 'destructive' });
      return;
    }

    setIsPlacingOrder(true);

    const paymentReference = generateOrderCode(store.name);

    const customerInfo = { name: customerName, phone: customerPhone, address: customerAddress, email: customerEmail };

    const isAiOrder = searchParams.get('source') === 'ai';
const aiChannel = searchParams.get('channel') || null;

const orderData = {
  storeId: store.id,
  subdomain: store.subdomain,
  sellerId: store.sellerId,
  source: searchParams.get('source') || 'direct',
  ...(isAiOrder && {
    aiAssisted: true,
    aiChannel: aiChannel || 'webchat',
  }),
  items: cart.map(item => ({
        productId: item.id,
        productName: item.name,
        quantity: item.quantity,
        price: item.selectedVariant?.price || item.price,
        image: item.images?.[0] || null,
        variantName: item.selectedVariant?.name || null,
        selectedVariant: item.selectedVariant,
        variantId: item.selectedVariant?.id
      })),
      customerInfo,
      delivery: selectedDelivery ? { label: selectedDelivery.label, fee: selectedDelivery.fee } : null,
      totalAmount: total,
      paymentReference,
      selectedPaymentMethod,
      orderNote: orderNote,
    };

    try {
      const createOrderResponse = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });
      const orderResult = await createOrderResponse.json();

      if (!orderResult.success) throw new Error(orderResult.message || 'Failed to create order.');
      const orderId = orderResult.orderId;

      


if (selectedPaymentMethod === 'paystack') {
        const paystackRes = await fetch('/api/paystack/initialize', { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId }),
        });
        const paystackResult = await paystackRes.json();
        
        if (!paystackRes.ok || !paystackResult.success) {
             throw new Error(paystackResult.message || 'Failed to initialize payment.');
        }
        await clearAbandonedCart();
        clearCart();
        
        window.location.href = paystackResult.data.authorizationUrl;

      } else {
        await clearAbandonedCart();
        clearCart();

        router.push(`${getStoreBasePath(store.subdomain)}/order/confirmation?id=${orderId}`);
      }

      

    } catch (error) {
      setIsPlacingOrder(false);
      console.error('Error placing order:', error);
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    }
  };

  return (
    <div>
      <ApplyAiCheckoutToCart />
      <CartTimer settings={store?.marketingSettings?.cartTimer} />
      <div className="container mx-auto px-4 md:px-6 py-8">
        <StoreBreadcrumbs />
        {invalidItemsWarning && (
            <Alert variant="destructive" className="my-4">
                <AlertCircle className="h-4 w-4"/>
                <AlertTitle>Notice</AlertTitle>
                <AlertDescription>{invalidItemsWarning}</AlertDescription>
            </Alert>
        )}
         <div className="grid md:grid-cols-2 gap-12 mt-6">
            <div className="space-y-6">
              <Card>
                <CardHeader><CardTitle>Your Details</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="e.g., Ama Serwaa" disabled={isPlacingOrder} />
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <PhoneField value={customerPhone} onChange={setCustomerPhone} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address (Optional)</Label>
                    <Input id="email" type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="e.g., you@example.com" disabled={isPlacingOrder} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Delivery Address</Label>
                    <Textarea id="address" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} placeholder="Your full address including house number and street name." disabled={isPlacingOrder}/>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="orderNote">Order Note (Optional)</Label>
                    <Textarea id="orderNote" value={orderNote} onChange={(e) => setOrderNote(e.target.value)} placeholder="Any special instructions for your order?" disabled={isPlacingOrder}/>
                  </div>
                </CardContent>
              </Card>

              {deliveryOptions.length > 0 && (
                <Card>
                  <CardHeader><CardTitle>Delivery Method</CardTitle></CardHeader>
                  <CardContent>
                    <RadioGroup value={selectedDelivery?.id} onValueChange={(value) => setSelectedDelivery(deliveryOptions.find((opt) => opt.id === value) || null)}>
                      {deliveryOptions.map((option) => (
                        <Label key={option.id} htmlFor={option.id} className="flex items-center space-x-3 border p-4 rounded-md cursor-pointer has-[:checked]:border-primary mb-2">
                          <RadioGroupItem value={option.id} id={option.id} />
                          <div className="flex-1">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                  <span>{option.label}</span>
                                  {option.fee === 0 && (
                                    <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                                      {option.type === 'pickup' ? 'Free Pickup' : 'Free'}
                                    </Badge>
                                  )}
                                </div>
                              <span className="font-medium">GH₵{option.fee.toFixed(2)}</span>
                            </div>
                          </div>
                        </Label>
                      ))}
                    </RadioGroup>
                  </CardContent>
                </Card>
              )}
               {availablePaymentMethods.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle>Payment Method</CardTitle></CardHeader>
                    <CardContent>
                        <RadioGroup value={selectedPaymentMethod || ''} onValueChange={(val) => setSelectedPaymentMethod(val as PaymentMethod)}>
                            {availablePaymentMethods.map(method => (
                                <Label key={method.id} htmlFor={method.id} className="flex items-center space-x-3 border p-4 rounded-md cursor-pointer has-[:checked]:border-primary mb-2">
                                    <RadioGroupItem value={method.id} id={method.id} />
                                      <div className="flex justify-between items-center w-full">
                                        <span>{method.label}</span>
                                        {paymentMethodLogos[method.id] && (
                                            <Image src={paymentMethodLogos[method.id]!} alt={`${method.label} logo`} width={60} height={20} className="object-contain" data-ai-hint="payment logo"/>
                                        )}
                                      </div>
                                </Label>
                            ))}
                        </RadioGroup>
                    </CardContent>
                  </Card>
              )}
            </div>

            <div className="flex flex-col gap-6">
              <Card className="flex-1">
                <CardHeader><CardTitle>Order Summary</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {cart.length > 0 ? (
                    cart.map((item) => {
                      const unitPrice = item.selectedVariant?.price ?? item.price;
                      return (
                        <div key={item.id + (item.selectedVariant?.id || '')} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <Image src={item.selectedVariant?.image || item.images?.[0] || '/placeholder.svg'} alt={item.name} width={40} height={40} className="rounded-md"/>
                            <span>{item.name} x {item.quantity}</span>
                          </div>
                          <span>GH₵{(unitPrice * item.quantity).toFixed(2)}</span>
                        </div>
                      )
                    })
                  ) : (
                    <p className="text-muted-foreground text-center">Your cart is empty.</p>
                  )}
                  <div className="border-t pt-4 space-y-2 text-sm">
                    <div className="flex justify-between"><span>Subtotal</span><span>GH₵{cartTotal.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span>Delivery</span><span>{selectedDelivery ? `GH₵${selectedDelivery.fee.toFixed(2)}` : 'Select option'}</span></div>
                  </div>
                  <div className="flex justify-between items-center font-bold text-lg border-t pt-4"><span>Total</span><span>GH₵{total.toFixed(2)}</span></div>
                </CardContent>
              </Card>

              <Button
                size="lg"
                className="w-full bg-black text-white hover:bg-black/80 text-lg font-bold"
                onClick={handlePlaceOrder}
                disabled={isPlacingOrder || cart.length === 0}
              >
                {isPlacingOrder ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {selectedPaymentMethod === 'paystack' ? 'Continue to Payment' : 'Place Order'}
              </Button>
            </div>
          </div>
        <WhatsAppButton />
      </div>
    </div>
  );
}

