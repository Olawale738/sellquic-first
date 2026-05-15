import { Resend } from 'resend';
import { render } from '@react-email/render';
import { AbandonedSubscriptionEmail } from '@/emails/AbandonedSubscriptionEmail';
import * as React from 'react';

interface OrderDetails {
  vendorEmail: string;
  orderId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  items: { productName: string; quantity: number; price: number; variantName?: string | null }[];
  totalAmount: number;
  paymentReference: string;
  deliveryLabel: string | null;
  deliveryFee: number;
  orderNote?: string;
}

interface CustomerEmailDetails {
  customerEmail: string;
  storeName: string;
  orderId: string;
  totalAmount: number;
  paymentReference: string;
  items: { productName: string; quantity: number }[];
}

interface WelcomeEmailDetails {
    to: string;
    firstName: string;
}

export async function sendOrderNotificationEmail(details: OrderDetails) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const {
    vendorEmail,
    orderId,
    customerName,
    customerPhone,
    customerAddress,
    items,
    totalAmount,
    paymentReference,
    deliveryLabel,
    deliveryFee,
    orderNote
  } = details;

  const itemsHtml = items.map(item => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">
        ${item.productName} ${item.variantName ? `(${item.variantName})` : ''} (x${item.quantity})
      </td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">
        GHS ${(item.price * item.quantity).toFixed(2)}
      </td>
    </tr>
  `).join('');

  try {
    const { data, error } = await resend.emails.send({
        from: 'SellQuic <orders@sellquic.com>',
        to: [vendorEmail],
        subject: `🎉 New Order Alert! [${paymentReference}]`,
        html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #5722c1; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">You've Got a New Order!</h1>
            </div>
            <div style="padding: 20px;">
            <p>Hi there,</p>
            <p>Congratulations! You have received a new order. Here are the details:</p>
            
            <div style="background-color: #f9f9f9; border: 1px solid #eee; border-radius: 4px; padding: 15px; margin: 20px 0;">
                <h2 style="margin-top: 0; font-size: 18px; border-bottom: 2px solid #eee; padding-bottom: 10px;">Order Summary</h2>
                <table style="width: 100%; border-collapse: collapse;">
                ${itemsHtml}
                ${deliveryLabel ? `
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;">Delivery: ${deliveryLabel}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">GHS ${deliveryFee ? deliveryFee.toFixed(2) : '0.00'}</td>
                </tr>` : ''}
                <tr style="font-weight: bold;">
                    <td style="padding: 8px; padding-top: 15px;">Total</td>
                    <td style="padding: 8px; padding-top: 15px; text-align: right; font-size: 18px;">GHS ${totalAmount.toFixed(2)}</td>
                </tr>
                </table>
                <p style="text-align: center; margin-top: 15px; font-size: 14px;"><strong>Payment Reference:</strong> ${paymentReference}</p>
            </div>

            <div style="background-color: #f9f9f9; border: 1px solid #eee; border-radius: 4px; padding: 15px;">
                <h2 style="margin-top: 0; font-size: 18px; border-bottom: 2px solid #eee; padding-bottom: 10px;">Customer & Delivery Info</h2>
                <p><strong>Name:</strong> ${customerName}</p>
                <p><strong>Phone:</strong> ${customerPhone}</p>
                <p><strong>Address:</strong> ${customerAddress}</p>
                 ${orderNote ? `<p style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #ddd;"><strong>Note:</strong> ${orderNote}</p>` : ''}
            </div>

            <p style="text-align: center; margin-top: 20px;">
                You can view and manage this order in your SellQuic dashboard.
            </p>
            </div>
            <div style="background-color: #f0f0f0; color: #777; padding: 10px; text-align: center; font-size: 12px;">
            <p>Powered by SellQuic</p>
            </div>
        </div>
        `,
    });

    if (error) {
        console.error('❌ Error sending vendor notification email:', error);
        throw error;
    }

    console.log('✅ Vendor notification email sent successfully:', data);
    } catch (error) {
    console.error('❌ Failed to send email via Resend:', error);
    throw error;
  }
}


export async function sendCustomerOrderEmail(details: CustomerEmailDetails) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { customerEmail, storeName, orderId, totalAmount, paymentReference, items } = details;

  const itemsHtml = items.map(item => `<li>${item.productName} (x${item.quantity})</li>`).join('');

  try {
    const { data, error } = await resend.emails.send({
      from: `${storeName} via SellQuic <orders@sellquic.com>`,
      to: [customerEmail],
      subject: `Your Order from ${storeName} is Confirmed!`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 8px;">
          <div style="background-color: #f9f9f9; padding: 20px; text-align: center; border-bottom: 1px solid #eee;">
            <h1 style="margin: 0; font-size: 24px;">Thank you for your order!</h1>
          </div>
          <div style="padding: 20px;">
            <p>Hi there,</p>
            <p>Your order from <strong>${storeName}</strong> has been received and is awaiting payment confirmation.</p>
            
            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 4px; margin: 20px 0;">
                <h2 style="font-size: 18px; margin-top: 0;">Order Summary</h2>
                <p><strong>Reference:</strong> ${paymentReference}</p>
                <p><strong>Total:</strong> GHS ${totalAmount.toFixed(2)}</p>
                <p><strong>Items:</strong></p>
                <ul>${itemsHtml}</ul>
            </div>
            <p>The seller will contact you shortly regarding delivery. Thanks for shopping!</p>
          </div>
           <div style="background-color: #f0f0f0; color: #777; padding: 10px; text-align: center; font-size: 12px;">
            <p>Powered by SellQuic</p>
            </div>
        </div>
      `,
    });

    if (error) {
      console.error('❌ Error sending customer notification email:', error);
      throw error;
    }

    console.log('✅ Customer notification email sent successfully:', data);
  } catch (error) {
    console.error('❌ Failed to send customer email via Resend:', error);
    throw error;
  }
}

export async function sendWelcomeEmail({ to, firstName }: WelcomeEmailDetails) {
  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    const { data, error } = await resend.emails.send({
      from: 'Rena from SellQuic <hello@sellquic.com>',
      to: [to],
      subject: 'Welcome to SellQuic',
      html: `
        <p>Hi ${firstName},</p>
        <p>Welcome to SellQuic 🎉</p>
        <p>We’re happy you’re here.<br>
        If you sell online or on social media, you already know the stress. Repeating prices, sending product pictures all day, answering the same questions, missing orders when you’re busy, or worrying whether payment has really come in.</p>
        <p>SellQuic was built to make selling easier and more organised, so you can focus on growing your business instead of chasing messages.</p>
        <p>Here’s how SellQuic helps 👇</p>
        <p>🛒 <strong>Your Online Store</strong>.<br>
        Create a simple, mobile friendly online store where all your products are neatly displayed.
        Instead of sending prices and pictures one by one, you can share your store link anywhere you sell online or on social media. Customers can browse and order anytime, even when you’re offline.</p>
        <p>💸 <strong>Accept Local and Global Payments</strong>.<br>
        SellQuic lets your customers pay you locally and internationally through your store and payment links.
        Your payments are tracked in one place, so you don’t have to rely on screenshots or guess whether money has come in.</p>
        <p>🔔 <strong>Instant Order Alerts</strong><br>
        The moment a customer places an order, you get notified instantly.
        No more checking messages all the time or worrying that you missed a sale. You’ll always know when an order comes in.</p>
        <p>📦 <strong>Stay Organised</strong><br>
        All your products, orders, and customers are recorded automatically in one dashboard.
        This helps you stay organised, fulfil orders faster, and run your business more confidently.</p>
        <p>🎁 <strong>Your Free Trial</strong><br>
       Choose Starter, Standard, or Growth from your dashboard. Standard and Growth come with a 7-day free trial — no credit card needed.</p>
        <p>🚀 <strong>Start with one simple step</strong><br>
        Add your first product to your store and share your store link with customers. That’s all it takes to get started.</p>
        <p>If you ever need help, our team is here to support you every step of the way.</p>
        <p>
👉 <a href="https://www.sellquic.com/dashboard">
Click here to go back to your dashboard and finish setting up your store
</a>
</p>
        <p>Welcome once again. We’re excited to support your selling journey.</p>
        <p> </p>
        <p>Warm regards,<br>
        Rena<br>
        For the SellQuic Team</p>
      `
    });

    if (error) {
      console.error('❌ Error sending welcome email:', error);
      throw error;
    }

    console.log('✅ Welcome email sent successfully:', data);
  } catch (error) {
    console.error('❌ Failed to send welcome email via Resend:', error);
    throw error;
  }



  
}
interface VendorQueryDetails {
  vendorEmail: string;
  storeName: string;
  customerName: string;
  customerQuestion: string;
  conversationId: string;
}

export async function sendVendorQueryEmail(details: VendorQueryDetails) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { vendorEmail, storeName, customerName, customerQuestion, conversationId } = details;

  try {
    const { data, error } = await resend.emails.send({
      from: 'SellQuic AI <hello@sellquic.com>',
      to: [vendorEmail],
      subject: `💬 Customer question needs your reply — ${storeName}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #5722c1; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 22px;">A customer has a question for you</h1>
          </div>
          <div style="padding: 20px;">
            <p>Hi there,</p>
            <p>Your AI assistant couldn't answer this question and needs your help:</p>
            <div style="background-color: #f9f9f9; border-left: 4px solid #5722c1; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; font-size: 16px;"><strong>${customerName} asked:</strong></p>
              <p style="margin: 10px 0 0; font-size: 18px; color: #333;">"${customerQuestion}"</p>
            </div>
            <p>Please reply to them directly in your inbox:</p>
            <div style="text-align: center; margin: 25px 0;">
              <a href="https://sellquic.com/dashboard/inbox/${conversationId}" 
                 style="background-color: #5722c1; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 16px;">
                Reply to Customer
              </a>
            </div>
            <p style="color: #777; font-size: 14px;">The customer has been told you'll get back to them shortly.</p>
          </div>
          <div style="background-color: #f0f0f0; color: #777; padding: 10px; text-align: center; font-size: 12px;">
            <p>Powered by SellQuic</p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error('❌ Error sending vendor query email:', error);
      throw error;
    }
    console.log('✅ Vendor query email sent:', data);
  } catch (error) {
    console.error('❌ Failed to send vendor query email:', error);
    throw error;
  }
}