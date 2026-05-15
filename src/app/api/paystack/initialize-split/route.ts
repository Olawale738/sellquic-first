
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  const initId = `SPLIT-INIT-${Date.now()}`;
  
  try {
    console.log(`[${initId}] 🚀 Initializing split payment...`);
    
    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json({ success: false, message: 'Missing order ID' }, { status: 400 });
    }

    // 1. Fetch Order and Store data
    const orderRef = db.collection('orders').doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
    }

    const order = orderSnap.data()!;
    const storeRef = db.collection('stores').doc(order.storeId);
    const storeSnap = await storeRef.get();

    if (!storeSnap.exists) {
        return NextResponse.json({ success: false, message: 'Store not found' }, { status: 404 });
    }

    const store = storeSnap.data()!;
    const subaccountCode = store.paymentInfo?.subaccount_code;

    // 2. Validate Payout Setup
    if (!subaccountCode) {
        return NextResponse.json({ success: false, message: 'Vendor payout not configured for automated payments.' }, { status: 400 });
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json({ success: false, message: 'Payment service not configured' }, { status: 500 });
    }
    
    // 3. Prepare Paystack Transaction
    const amountInKobo = order.totalAmount * 100;
    const reference = `SELLQUIC-${orderId}`;

    const metadata = {
      orderId: orderId,
      storeId: order.storeId,
      customerName: order.customerInfo.name,
      custom_fields: [
        {
          display_name: "Order Reference",
          variable_name: "order_ref",
          value: order.paymentReference
        }
      ]
    };
    
    console.log(`[${initId}] 💳 Initializing Paystack transaction with subaccount: ${subaccountCode}`);

    const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secretKey}` },
      body: JSON.stringify({ 
          email: order.customerInfo.email || `${order.customerInfo.phone}@sellquic.com`, 
          amount: amountInKobo, 
          reference, 
          subaccount: subaccountCode,
          currency: 'GHS', 
          metadata 
        }),
    });

    const paystackData = await paystackResponse.json();

    if (!paystackData.status) {
      console.error(`[${initId}] ❌ Paystack API Error:`, paystackData);
      return NextResponse.json({ success: false, message: paystackData.message || 'Failed to initialize payment' }, { status: 400 });
    }
    
    console.log(`[${initId}] ✅ Paystack transaction initialized successfully`);

    return NextResponse.json({
        success: true,
        data: {
          reference,
          authorizationUrl: paystackData.data.authorization_url,
          amount: amountInKobo,
        },
      }, { status: 200 });

  } catch (error) {
    console.error(`[${initId}] 💥 Error:`, error);
    return NextResponse.json({ success: false, message: 'Payment initialization failed', error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
