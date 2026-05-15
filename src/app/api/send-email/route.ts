
import { NextResponse } from 'next/server';
import { sendOrderNotificationEmail } from '@/lib/resend';
import { db } from '@/lib/firebase-admin';
import { sendSms } from '@/lib/mnotify';
import { formatPhoneNumberForApi } from '@/lib/utils';


export async function POST(request: Request) {
  const body = await request.json();
  const { storeId, orderId, customerName, totalAmount, paymentReference } = body;

  if (!storeId) {
    return NextResponse.json({ success: false, message: 'Missing storeId.' }, { status: 400 });
  }

  try {
    // Fetch store details securely on the server
    const storeDoc = await db.collection('stores').doc(storeId).get();
    if (!storeDoc.exists) {
      return NextResponse.json({ success: false, message: 'Store not found.' }, { status: 404 });
    }
    const storeData = storeDoc.data();
    if (!storeData) {
        return NextResponse.json({ success: false, message: 'Store data is missing.' }, { status: 500 });
    }
    
    // Fetch seller details to get email and phone
    const sellerDoc = await db.collection('users').doc(storeData.sellerId).get();
    const sellerData = sellerDoc.data();
    
    const vendorEmail = sellerData?.email;
    const vendorPhone = sellerData?.phone;

    const notificationPromises = [];

    // 1. Send Vendor Email
    if (vendorEmail && process.env.RESEND_API_KEY) {
      notificationPromises.push(
        sendOrderNotificationEmail({ ...body, vendorEmail })
      );
    } else {
        console.warn('Vendor email not sent: No email address or RESEND_API_KEY not set.');
    }

    // 2. Send Vendor SMS
    if (vendorPhone && process.env.MNOTIFY_API_KEY) {
      const formattedVendorPhone = formatPhoneNumberForApi(vendorPhone);
      if(formattedVendorPhone) {
        notificationPromises.push(
          sendSms(
            formattedVendorPhone,
            `New Order! You have a new order (#${paymentReference}) from ${customerName} for GHS ${totalAmount.toFixed(2)}. Check your dashboard.`
          )
        );
      }
    } else {
        console.warn('Vendor SMS not sent: No phone number or MNOTIFY_API_KEY not set.');
    }

    await Promise.all(notificationPromises);

    return NextResponse.json({ success: true, message: 'Vendor notifications sent successfully.' });
  } catch (error) {
    console.error('API Error sending vendor notifications:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to send vendor notifications', details: errorMessage }, { status: 500 });
  }
}
