
'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/hooks/use-cart';
import { useStore } from '@/context/store-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles } from 'lucide-react';
import Image from 'next/image';
import { StoreBreadcrumbs } from '@/components/store-breadcrumbs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { WhatsAppButton } from '@/components/whatsapp-button';
import Link from 'next/link';

interface DeliveryOption {
  id: string;
  label: string;
  fee: number;
}

export default function DemoCheckoutPage() {
  const { cart, total: cartTotal } = useCart();
  const { store } = useStore();
  const { toast } = useToast();
  const router = useRouter();

  const [customerName, setCustomerName] = useState('John Doe');
  const [customerPhone, setCustomerPhone] = useState('024 123 4567');
  const [customerAddress, setCustomerAddress] = useState('123 Demo Street, Accra');
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryOption | null>(null);

  const deliveryOptions: DeliveryOption[] = store?.deliveries || [];

  const total = useMemo(() => {
    return cartTotal + (selectedDelivery?.fee || 0);
  }, [cartTotal, selectedDelivery]);

  const handlePlaceOrder = async () => {
    if (!store?.id) return;
    try {
        await fetch('/api/demos/log-lead', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ demoId: store.id })
        });
    } catch(err) {
        console.error("Failed to log lead", err);
    }
    router.push('/signup');
  };

  return (
    <div>
      <div className="container mx-auto px-4 md:px-6 py-8">
        <StoreBreadcrumbs />
         <div className="grid md:grid-cols-2 gap-12 mt-6">
            <div className="space-y-6">
              <Card>
                <CardHeader><CardTitle>Your Details</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="e.g., Ama Serwaa" />
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input id="phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="e.g., 0244123456" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Delivery Address</Label>
                    <Textarea id="address" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} placeholder="Your full address including house number and street name."/>
                  </div>
                </CardContent>
              </Card>

              {deliveryOptions.length > 0 && (
                <Card>
                  <CardHeader><CardTitle>Delivery Method</CardTitle></CardHeader>
                  <CardContent>
                    <RadioGroup onValueChange={(value) => setSelectedDelivery(deliveryOptions.find((opt) => opt.id === value) || null)}>
                      {deliveryOptions.map((option) => (
                        <Label key={option.id} htmlFor={option.id} className="flex items-center space-x-3 border p-4 rounded-md cursor-pointer has-[:checked]:border-primary">
                          <RadioGroupItem value={option.id} id={option.id} />
                          <div className="flex-1"><div className="flex justify-between"><span>{option.label}</span><span className="font-medium">GH₵{option.fee.toFixed(2)}</span></div></div>
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
                    cart.map((item) => (
                      <div key={item.id + (item.selectedVariant?.id || '')} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Image src={item.selectedVariant?.image || item.images?.[0] || '/placeholder.svg'} alt={item.name} width={40} height={40} className="rounded-md"/>
                          <span>{item.name} x {item.quantity}</span>
                        </div>
                        <span>GH₵{(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))
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

              <Button size="lg" className="w-full" onClick={handlePlaceOrder} disabled={cart.length === 0}>
                <Sparkles className="mr-2 h-4 w-4" />
                Sign Up to Place Real Orders
              </Button>
            </div>
          </div>
        <WhatsAppButton />
      </div>
    </div>
  );
}
