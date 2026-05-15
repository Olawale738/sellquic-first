
import { NextResponse } from 'next/server';
import { sendCustomerOrderEmail } from '@/lib/resend';
import { sendSms } from '@/lib/mnotify';
import { formatPhoneNumberForApi } from '@/lib/utils';

export async function POST(request: Request) {
  const body = await request.json();
  const { customerEmail, storeName, customerPhone, customerName, totalAmount, paymentReference } = body;
  
  const notificationPromises = [];

  // 1. Send Customer Email
  if (customerEmail && process.env.RESEND_API_KEY) {
    notificationPromises.push(sendCustomerOrderEmail(body));
  } else {
    console.warn('Customer email not sent: No email address or RESEND_API_KEY not set.');
  }

  // 2. Send Customer SMS
  if (customerPhone && process.env.MNOTIFY_API_KEY) {
    const formattedPhone = formatPhoneNumberForApi(customerPhone);
    if (formattedPhone) {
      notificationPromises.push(
        sendSms(
          formattedPhone,
          `Hi ${customerName}, your order from ${storeName} (Ref: ${paymentReference}) for GHS ${totalAmount.toFixed(2)} has been received. You will be notified once payment is confirmed.`
        )
      );
    }
  } else {
    console.warn('Customer SMS not sent: No phone number or MNOTIFY_API_KEY not set.');
  }

  try {
    await Promise.all(notificationPromises);
    return NextResponse.json({ success: true, message: 'Customer notifications sent successfully.' });
  } catch (error) {
    console.error('API Error sending customer notifications:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to send customer notifications', details: errorMessage }, { status: 500 });
  }
}
