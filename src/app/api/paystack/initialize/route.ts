import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const { orderId } = await request.json();
    if (!orderId) return NextResponse.json({ success: false, message: 'Missing orderId' }, { status: 400 });

    // 1. Fetch Order & Store
    const orderRef = db.collection('orders').doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });

    const order = orderSnap.data()!;
    const storeRef = db.collection('stores').doc(order.storeId);
    const storeSnap = await storeRef.get();
    if (!storeSnap.exists) return NextResponse.json({ success: false, message: 'Store not found' }, { status: 404 });

    const store = storeSnap.data()!;
    const subaccountCode = store.paymentInfo?.subaccount_code;
    
    // Safety: If vendor hasn't set up payout, block payment or fallback (blocking is safer for split)
    if (!subaccountCode) return NextResponse.json({ success: false, message: 'Vendor payout not configured.' }, { status: 400 });

    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) return NextResponse.json({ success: false, message: 'Payment service not configured' }, { status: 500 });

    // 2. Determine Callback URL (Redirect after payment)
    const origin = request.headers.get('origin');
    let callbackUrl;

    if (origin) {
      // Trust the origin if present (works for custom domains and subdomains)
      if (store.customDomain) {
        callbackUrl = `https://${store.customDomain}/order/confirmation?ref=SELLQUIC-ORDER-${orderId}`;
      } else {
        callbackUrl = `https://${store.subdomain}.sellquic.com/order/confirmation?ref=SELLQUIC-ORDER-${orderId}`;
      }
    } else if (store.customDomain) {
      // Fallback 1
      callbackUrl = `https://${store.customDomain}/order/confirmation?ref=SELLQUIC-ORDER-${orderId}`;
    } else {
      // Fallback 2: Manual subdomain construction
      callbackUrl = `https://${store.subdomain}.sellquic.com/order/confirmation?ref=SELLQUIC-ORDER-${orderId}`;
    }

    // 3. Calculate Fees (Split Logic)
    // Fetch Global Commission Setting first (Optional optimization: Cache this)
    const settingsDoc = await db.collection('settings').doc('platform').get();
    let commissionRate = 0; // Default 0%

    if (settingsDoc.exists) {
        const data = settingsDoc.data();
        if (typeof data?.commissionPercentage === 'number') {
            commissionRate = data.commissionPercentage / 100;
        }
    }

    const amountInKobo = Math.ceil(order.totalAmount * 100);
    const platformFee = Math.ceil(amountInKobo * commissionRate);
    
    // Force a specific reference format so Webhook can detect it easily
    // Note: If Paystack rejects duplicates, append a timestamp
    const reference = `SELLQUIC-ORDER-${orderId}-${Date.now()}`;

    // 4. Paystack Payload
    const payload: any = {
      email: order.customerInfo.email || `${order.customerInfo.phone}@sellquic.com`,
      amount: amountInKobo,
      reference,
      subaccount: subaccountCode, 
      transaction_charge: platformFee, // <--- YOUR CUT
      bearer: 'subaccount',            // <--- VENDOR PAYS PROCESSING FEES
      currency: 'GHS',
      callback_url: callbackUrl,
      metadata: {
        type: 'order', // <--- CRITICAL FOR WEBHOOK ROUTING
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

    // Update the order with the reference immediately so we can track it
    await orderRef.update({ 
        paymentReference: reference,
        selectedPaymentMethod: 'paystack' // Mark intent
    });

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