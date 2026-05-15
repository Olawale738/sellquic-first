
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const { orderId } = await request.json();
    if (!orderId) return NextResponse.json({ success: false, message: 'Missing orderId' }, { status: 400 });

    // Fetch order & store
    const orderRef = db.collection('orders').doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });

    const order = orderSnap.data()!;
    const storeRef = db.collection('stores').doc(order.storeId);
    const storeSnap = await storeRef.get();
    if (!storeSnap.exists) return NextResponse.json({ success: false, message: 'Store not found' }, { status: 404 });

    const store = storeSnap.data()!;
    const subaccountCode = store.paymentInfo?.subaccount_code;
    if (!subaccountCode) return NextResponse.json({ success: false, message: 'Vendor payout not configured.' }, { status: 400 });

    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) return NextResponse.json({ success: false, message: 'Payment service not configured' }, { status: 500 });

    const amountInKobo = order.totalAmount * 100;
    const reference = `SELLQUIC-${orderId}`;
    const callback_url = `${request.headers.get('origin')}/order/confirmed/${orderId}`;


    // Initialize Paystack transaction with split payment
    const payload: any = {
      email: order.customerInfo.email || `${order.customerInfo.phone}@sellquic.com`,
      amount: amountInKobo,
      reference,
      subaccount: subaccountCode, // single vendor split
      currency: 'GHS',
      callback_url: callback_url,
      metadata: {
        orderId: orderId,
        storeId: order.storeId,
        customerName: order.customerInfo.name
      }
    };

    const res = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!data.status) return NextResponse.json({ success: false, message: data.message || 'Failed to initialize payment' }, { status: 400 });

    return NextResponse.json({
      success: true,
      data: {
        reference,
        authorizationUrl: data.data.authorization_url,
        amount: amountInKobo
      }
    });

  } catch (err) {
    console.error('Init split payment error:', err);
    return NextResponse.json({ success: false, message: 'Initialization failed', error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
