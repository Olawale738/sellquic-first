
// src/app/api/create-order/route.ts
import { deductOrderStock } from '@/lib/stock';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { sendSms } from '@/lib/mnotify';
import { sendOrderNotificationEmail, sendCustomerOrderEmail } from '@/lib/resend';
import { formatPhoneNumberForApi } from '@/lib/utils';

type PaymentMethod = 'paystack' | 'momo' | 'cod';

type IncomingItem = {
  productId?: string;
  productName?: string;
  quantity?: number;
  price?: number;
  image?: string | null;
  variantName?: string | null;

  // Optional/legacy
  id?: string;
  selectedVariant?: { id?: string; name?: string; price?: number; moq?: number; image?: string };
  variantId?: string;
};

type NormalizedItem = {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  image: string | null;
  variantName: string | null;

  // Keep variant id for MOQ checks (lightweight)
  selectedVariant?: { id?: string };
  variantId?: string;
};

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((v) => v !== undefined)
      .map((v) => stripUndefined(v)) as any;
  }
  if (value && typeof value === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(value as any)) {
      if (v === undefined) continue;
      out[k] = stripUndefined(v as any);
    }
    return out;
  }
  return value;
}

function normalizeItems(items: any): { ok: true; items: NormalizedItem[] } | { ok: false; message: string } {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, message: 'Cart items are missing.' };
  }

  const normalized: NormalizedItem[] = [];

  for (let i = 0; i < items.length; i++) {
    const it: IncomingItem = items[i] || {};

    const productId = (it.productId ?? it.id ?? '').toString().trim();
    const quantity = Number(it.quantity);
    const price = Number(it.price);

    if (!productId) return { ok: false, message: `Invalid cart item at position ${i + 1}: missing productId.` };
    if (!Number.isFinite(quantity) || quantity <= 0) return { ok: false, message: `Invalid quantity for item ${productId}.` };
    if (!Number.isFinite(price) || price < 0) return { ok: false, message: `Invalid price for item ${productId}.` };

    const productName = (it.productName ?? '').toString().trim();
    if (!productName) return { ok: false, message: `Invalid cart item ${productId}: missing productName.` };

    const variantName = it.variantName ?? it.selectedVariant?.name ?? null;
    const selectedVariant = it.selectedVariant?.id ? { id: String(it.selectedVariant.id) } : undefined;

    normalized.push(
      stripUndefined({
        productId,
        productName,
        quantity,
        price,
        image: it.image ?? it.selectedVariant?.image ?? null,
        variantName: variantName ? String(variantName) : null,
        selectedVariant,
        variantId: it.variantId ? String(it.variantId) : undefined,
      })
    );
  }

  return { ok: true, items: normalized };
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const body = stripUndefined(rawBody);

    const {
      storeId,
      customerInfo,
      totalAmount,
      paymentReference,
      selectedPaymentMethod,
      delivery,
      orderNote,
    } = body as {
      storeId?: string;
      items?: any;
      customerInfo?: { name?: string; phone?: string; email?: string; address?: string };
      totalAmount?: number;
      paymentReference?: string;
      selectedPaymentMethod?: PaymentMethod;
      delivery?: { label?: string; fee?: number } | null;
      orderNote?: string;
      [k: string]: any;
    };

    // --- Basic validation ---
    if (!storeId || typeof storeId !== 'string') {
      return NextResponse.json({ success: false, message: 'Missing storeId' }, { status: 400 });
    }

    const itemsCheck = normalizeItems((body as any).items);
    if (!itemsCheck.ok) {
      return NextResponse.json({ success: false, message: itemsCheck.message }, { status: 400 });
    }
    const items = itemsCheck.items;

    if (!customerInfo?.name || !customerInfo?.phone || !customerInfo?.address) {
      return NextResponse.json(
        { success: false, message: 'Missing required customer info (name, phone, address).' },
        { status: 400 }
      );
    }

    if (totalAmount === undefined || !Number.isFinite(Number(totalAmount))) {
      return NextResponse.json({ success: false, message: 'Invalid totalAmount' }, { status: 400 });
    }

    if (!paymentReference || typeof paymentReference !== 'string') {
      return NextResponse.json({ success: false, message: 'Missing paymentReference' }, { status: 400 });
    }

    if (!selectedPaymentMethod) {
      return NextResponse.json({ success: false, message: 'Missing selectedPaymentMethod' }, { status: 400 });
    }

    // --- Fetch store & seller ---
    const storeDoc = await db.collection('stores').doc(storeId).get();
    if (!storeDoc.exists) {
      return NextResponse.json({ success: false, message: 'Store not found' }, { status: 404 });
    }
    const storeData = storeDoc.data()!;

    const sellerDoc = await db.collection('users').doc(storeData.sellerId).get();
    const sellerData = sellerDoc.exists ? sellerDoc.data() : null;
    const sellerPhone = sellerData?.phone;
    const sellerEmail = sellerData?.email;

    // --- MOQ validation (safe) ---
    if (storeData.isMoqEnabled) {
      const uniqueProductIds = Array.from(new Set(items.map((i) => i.productId).filter(Boolean)));

      const productRefs = uniqueProductIds.map((pid) => db.collection('products').doc(pid));
      const productDocs = await db.getAll(...productRefs);

      const productsById = new Map<string, any>();
      for (let i = 0; i < productDocs.length; i++) {
        const docSnap = productDocs[i];
        if (!docSnap.exists) continue;
        const data = docSnap.data();
        if (data?.storeId !== storeId) continue; // anti-spoof
        productsById.set(docSnap.id, { id: docSnap.id, ...data });
      }

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const product = productsById.get(item.productId);

        if (!product) {
          return NextResponse.json(
            { success: false, message: `Product not found or not available: ${item.productId}` },
            { status: 400 }
          );
        }

        let moq = product.moq || 1;

        const variantId = item.selectedVariant?.id || item.variantId;
        if (variantId && Array.isArray(product.variants)) {
          const variant = product.variants.find((v: any) => String(v.id) === String(variantId));
          if (variant?.moq) moq = variant.moq;
        }

        if (item.quantity < moq) {
          return NextResponse.json(
            {
              success: false,
              message: `${product.name} requires a minimum order of ${moq} units. You ordered ${item.quantity}.`,
              field: 'items',
            },
            { status: 400 }
          );
        }
      }
    }

    // --- Create order (server-trusted fields ONLY) ---
    const orderRef = db.collection('orders').doc();
    const orderId = orderRef.id;

    const orderData = {
        ...body,
        id: orderId,
        createdAt: FieldValue.serverTimestamp(),
        status: 'awaiting-payment',
        // AI Attribution
        ...(body.aiAssisted && {
          aiAssisted: true,
          aiChannel: body.aiChannel || 'webchat',
        }),
      };
      
    // ********** BUG FIX: SAVE THE ORDER TO DATABASE **********
    await orderRef.set(orderData);
    // ********************************************************


    // --- Deduct stock (COD, MoMo, Bank — payment assumed on order creation) ---
    if (selectedPaymentMethod !== 'paystack') {
      await deductOrderStock(items);
    }

    // --- Notifications (await them; serverless can exit early otherwise) ---
    // Only send for non-paystack (paystack uses webhook success flow)
    if (selectedPaymentMethod !== 'paystack') {
      
      const notificationPromises: Promise<any>[] = [];

      const emailItemsForVendor = items.map((it) => ({
        productName: it.productName,
        quantity: it.quantity,
        price: it.price,
        variantName: it.variantName,
      }));

      const emailItemsForCustomer = items.map((it) => ({
        productName: it.productName,
        quantity: it.quantity,
      }));

      const deliveryLabel: string | null = delivery?.label ?? null;
      const deliveryFee: number = typeof delivery?.fee === 'number' ? delivery.fee : 0;

      // Vendor email
      if (sellerEmail) {
        notificationPromises.push(
          sendOrderNotificationEmail({
            vendorEmail: sellerEmail,
            orderId,
            customerName: customerInfo.name,
            customerPhone: customerInfo.phone,
            customerAddress: customerInfo.address,
            items: emailItemsForVendor,
            totalAmount: Number(totalAmount),
            paymentReference,
            deliveryLabel,
            deliveryFee,
            orderNote,
          })
        );
      }

      // Customer email
      if (customerInfo.email) {
        notificationPromises.push(
          sendCustomerOrderEmail({
            customerEmail: customerInfo.email,
            storeName: storeData.name,
            orderId,
            totalAmount: Number(totalAmount),
            paymentReference,
            items: emailItemsForCustomer,
          })
        );
      }

      // Vendor SMS
      if (sellerPhone) {
        const formattedVendorPhone = formatPhoneNumberForApi(sellerPhone);
        if (formattedVendorPhone) {
          const vendorMsg = `New Order on ${storeData.name}! ${customerInfo.name} ordered GHS ${Number(
            totalAmount
          )}. Ref: ${paymentReference}. Check dashboard.`;
          notificationPromises.push(sendSms(formattedVendorPhone, vendorMsg));
        }
      }

      // Customer SMS
      if (customerInfo.phone) {
        const formattedCustomerPhone = formatPhoneNumberForApi(customerInfo.phone);
        if (formattedCustomerPhone) {
          const customerMsg = `Hi ${customerInfo.name}, your order from ${storeData.name} (Ref: ${paymentReference}) has been received! Please complete payment.`;
          notificationPromises.push(sendSms(formattedCustomerPhone, customerMsg));
        }
      }

      const results = await Promise.allSettled(notificationPromises);
      for (const r of results) {
        if (r.status === 'rejected') console.error('Notification failed:', r.reason);
      }
    }

    if (selectedPaymentMethod === 'momo') {
      return NextResponse.json({
        success: true,
        orderId,
        paymentDetails: {
          type: 'momo',
          number: storeData.momoNumber || null,
          name: storeData.momoName || storeData.name,
          reference: paymentReference,
          note: 'Send payment and use your order reference'
        }
      });
    }
    
    return NextResponse.json({ success: true, orderId });
  } catch (error: any) {
    console.error('Order Creation Error:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed to create order' },
      { status: 500 }
    );
  }
}
