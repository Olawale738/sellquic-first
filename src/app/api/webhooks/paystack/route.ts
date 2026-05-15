
'use server';
import { deductOrderStock } from '@/lib/stock';
import { NextResponse } from 'next/server';
import { FieldValue, Transaction } from 'firebase-admin/firestore';
import { db } from '@/lib/firebase-admin';
import crypto from 'crypto';
import { sendSms } from '@/lib/mnotify';
import { sendOrderNotificationEmail, sendCustomerOrderEmail } from '@/lib/resend';
import { formatPhoneNumberForApi } from '@/lib/utils';
import { addMonths } from 'date-fns';
import { sendMetaPurchaseEvent } from '@/lib/tracking/sendMetaPurchaseEvent';
import { generateEventId } from '@/lib/utils';
import { kv } from '@vercel/kv';


// =======================================================
// 1. ORDER LOGIC
// =======================================================
async function handleOrderCharge(webhookId: string, eventData: any) {
  const { reference, metadata, amount } = eventData;
  const orderId = metadata?.orderId;

  console.log(`[${webhookId}] 🛒 Processing ORDER charge: ${orderId}`);
  if (!orderId) return;

  const orderRef = db.collection('orders').doc(orderId);
  const paymentRef = db.collection('payments').doc(reference);

  await db.runTransaction(async (transaction: Transaction) => {
    const paymentDoc = await transaction.get(paymentRef);
    if (paymentDoc.exists) return; // Idempotency check

    const orderDoc = await transaction.get(orderRef);
    if (!orderDoc.exists) return;

    const orderData = orderDoc.data()!;

    transaction.update(orderRef, {
      status: 'confirmed',
      paymentStatus: 'paid',
      selectedPaymentMethod: 'paystack',
      paidAt: FieldValue.serverTimestamp(),
      paymentReference: reference,
    });

    transaction.set(paymentRef, {
      orderId,
      storeId: orderData.storeId,
      amount: amount,
      status: 'completed',
      gateway: 'paystack',
      paystackReference: reference,
      type: 'order',
      receivedAt: FieldValue.serverTimestamp(),
    });
  });

  // --- Deduct stock after Paystack confirms payment ---
  try {
    const stockOrderDoc = await orderRef.get();
    if (stockOrderDoc.data()?.items) {
      await deductOrderStock(stockOrderDoc.data()!.items);
    }
  } catch (stockErr) {
    console.error(`[${webhookId}] Stock deduction failed:`, stockErr);
  }

  // --- Send Meta Purchase Event ---
  try {
    const freshOrderDoc = await orderRef.get();
    const order = freshOrderDoc.data();
    if (order && !order.metaPurchaseSentAt) {
      const storeDoc = await db.collection('stores').doc(order.storeId).get();
      const storeData = storeDoc.data();
      const pixelId = storeData?.marketing?.analytics?.facebookPixelId?.trim();
      const accessToken = storeData?.marketing?.analytics?.facebookAccessToken?.trim();
      const testEventCode = storeData?.marketing?.analytics?.facebookTestEventCode?.trim();
      if (pixelId && accessToken) {
        const eventId = `purchase_${orderId}`;
        await sendMetaPurchaseEvent({
          pixelId,
          accessToken,
          testEventCode,
          eventId,
          orderId,
          value: Number(order.totalAmount || 0),
          currency: order.currency || 'GHS',
          customer: {
            email: order.customerInfo?.email,
            phone: order.customerInfo?.phone,
            firstName: order.customerInfo?.name?.split(' ')?.[0],
            lastName: order.customerInfo?.name?.split(' ')?.slice(1).join(' ') || '',
            externalId:
              order.customerInfo?.phone ||
              order.customerInfo?.email ||
              orderId,
          },
          contents: Array.isArray(order.items)
            ? order.items.map((item: any) => ({
                id: item.productId || item.id,
                quantity: Number(item.quantity || 1),
                item_price: Number(item.price || 0),
              }))
            : [],
          eventSourceUrl: storeData?.customDomain
            ? `https://${storeData.customDomain}/order/confirmation?id=${orderId}`
            : `https://${storeData?.subdomain}.sellquic.com/order/confirmation?id=${orderId}`,
        });
        await orderRef.update({
          metaPurchaseSentAt: FieldValue.serverTimestamp(),
          metaPurchaseEventId: eventId,
        });
        console.log(`[${webhookId}] ✅ Meta Purchase sent for order ${orderId}`);
      } else {
        console.log(`[${webhookId}] ℹ️ Meta Purchase skipped - missing pixelId or accessToken for store ${order.storeId}`);
      }
    }
  } catch (metaErr) {
    console.error(`[${webhookId}] ⚠️ Meta Purchase send failed for order ${orderId}:`, metaErr);
  }


  // Notifications (Fire and Forget)
  try {
    const orderDoc = await orderRef.get();
    const order = orderDoc.data();
    if (order) {
      const storeDoc = await db.collection('stores').doc(order.storeId).get();
      const storeData = storeDoc.data();

      if (storeData) {
        const sellerDoc = await db.collection('users').doc(storeData.sellerId).get();
        const sellerData = sellerDoc.data();

        if (sellerData?.email && process.env.RESEND_API_KEY) {
          await sendOrderNotificationEmail({
            vendorEmail: sellerData.email, orderId, customerName: order.customerInfo.name,
            customerPhone: order.customerInfo.phone, customerAddress: order.customerInfo.address,
            items: order.items, totalAmount: order.totalAmount, paymentReference: reference,
            deliveryLabel: order.delivery?.label, deliveryFee: order.delivery?.fee || 0,
          });
        }
        if (order.customerInfo.email && process.env.RESEND_API_KEY) {
          await sendCustomerOrderEmail({
            customerEmail: order.customerInfo.email, storeName: storeData.name, orderId,
            totalAmount: order.totalAmount, paymentReference: reference, items: order.items,
          });
        }
        if (sellerData?.phone && process.env.MNOTIFY_API_KEY) {
          const formatted = formatPhoneNumberForApi(sellerData.phone);
          if (formatted) sendSms(formatted, `New Order on ${storeData.name}! GHS ${order.totalAmount}. Check dashboard.`);
        }
        if (order.customerInfo.phone && process.env.MNOTIFY_API_KEY) {
          const formatted = formatPhoneNumberForApi(order.customerInfo.phone);
          if (formatted) sendSms(formatted, `Payment Received! Your order from ${storeData.name} is confirmed.`);
        }
      }
    }
  } catch (e) { console.error(`[${webhookId}] ⚠️ Notifications failed:`, e); }
}

// =======================================================
// 2. SUBSCRIPTION LOGIC (NEW AFFILIATE & COUPON MODEL)
// =======================================================
async function handleSubscriptionCharge(webhookId: string, eventData: any) {
  const { reference, metadata, amount, paid_at } = eventData;
  const { userId, planId, billingCycle, appliedDiscount, aiCredits, signupDiscountApplied } = metadata;

  console.log(`[${webhookId}] 💎 Processing SUBSCRIPTION: ${planId} for user ${userId}`);
  if (!userId || !planId) return;

  const transactionRef = db.collection('transactions').doc(reference);
  const userRef = db.collection('users').doc(userId);

  let referralDocRef: FirebaseFirestore.DocumentReference | null = null;
  let affiliateRef: FirebaseFirestore.DocumentReference | null = null;
  let referralStatus: string | null = null;
  let couponRef: FirebaseFirestore.DocumentReference | null = null;

  let couponCode = appliedDiscount?.code ? appliedDiscount.code.trim().toUpperCase() : null;
  let redemptionRef = couponCode ? db.collection('coupon_redemptions').doc(`${userId}_${couponCode}`) : null;

  // ✅ FIX 1: signupDiscountAppliedBool — read from metadata (set by initialize route)
  const signupDiscountAppliedBool = signupDiscountApplied === true;

  try {
    const userSnap = await userRef.get();
    const referredBy = userSnap.data()?.referredBy;

    if (referredBy) {
      affiliateRef = db.collection('users').doc(referredBy);
      const referralSnap = await affiliateRef.collection('referrals').where('userId', '==', userId).limit(1).get();
      if (!referralSnap.empty) {
        referralDocRef = referralSnap.docs[0].ref;
        referralStatus = referralSnap.docs[0].data()?.status || null;
      }
    }
    if (couponCode) {
      const couponSnapshot = await db.collection('coupons').where('code', '==', couponCode).limit(1).get();
      if (!couponSnapshot.empty) couponRef = couponSnapshot.docs[0].ref;
    }
  } catch (err) { console.error(`[${webhookId}] ⚠️ Pre-reads failed:`, err); }

  const storesSnap = await db
  .collection('stores')
  .where('sellerId', '==', userId)
  .get();

  await db.runTransaction(async (transaction: Transaction) => {
    const txnDoc = await transaction.get(transactionRef);
    if (txnDoc.exists) {
      console.log(`[${webhookId}] ⏭️ Skipping subscription - transaction ${reference} already exists.`);
      return;
    }

    

    // ✅ SAFETY: aiCredits may be undefined if coming from old initialize route (hardcoded prices)
    // Fall back to known plan defaults so vendors never get 0 credits
    const LEGACY_CREDIT_DEFAULTS: Record<string, number> = {
      starter: 0,
      standard: 0,
      growth: 2000,
    };
    const resolvedAiCredits = Number(aiCredits || LEGACY_CREDIT_DEFAULTS[planId] || 0);

    if (referralDocRef && affiliateRef && referralStatus === 'pending') {
      // ✅ FIX 2: newCommission → commission (typo from merge)
      const commission = 20;
      transaction.update(affiliateRef, {
        'affiliateWallet.pending': FieldValue.increment(-commission),
        'affiliateWallet.available': FieldValue.increment(commission),
      });
      transaction.update(referralDocRef, {
        isPro: true, status: 'available', amount: commission, planId, convertedAt: FieldValue.serverTimestamp(),
      });
    }

    if (redemptionRef && couponRef) {
      const redSnap = await transaction.get(redemptionRef);
      if (!redSnap.exists) {
        transaction.set(redemptionRef, {
          userId, couponCode, reference, usedAt: FieldValue.serverTimestamp(),
        });
        transaction.update(couponRef, { usageCount: FieldValue.increment(1) });
      }
    }

    // Mark signup discount as used if it was applied
    if (signupDiscountAppliedBool) {
      transaction.update(userRef, { signupDiscountUsed: true });
    }

    const userSnap2 = await transaction.get(userRef);
    const userData = userSnap2.data() || {};
    const currentEndDate = userData.subscription?.endDate?.toDate?.() || null;
    const now = paid_at ? new Date(paid_at) : new Date();
    const startDate = (currentEndDate && currentEndDate > now) ? currentEndDate : now;
    const endDate = addMonths(startDate, billingCycle === 'quarterly' ? 3 : 1);
    const newPlanCredits = Number(resolvedAiCredits);

    transaction.set(userRef, {
      subscription: {
        planId,
        status: 'active',
        billingCycle,
        startDate,
        endDate,
        updatedAt: FieldValue.serverTimestamp(),
      },
      hasEverPaid: true,   
      aiCredits: FieldValue.delete(),
      isBetaTester: false,
      ...(appliedDiscount ? { used20PercentDiscount: true } : {}),
    }, { merge: true });

    const periodsRef = userRef.collection('ai_credit_periods');

    const existingPeriodsSnap = await periodsRef
    .where('status', 'in', ['active', 'upcoming'])
    .limit(5)
    .get();
  
  const trialPeriodsToExpire: FirebaseFirestore.DocumentReference[] = [];
  const nonTrialEnds: Date[] = [];
  
  existingPeriodsSnap.docs.forEach(doc => {
    const data = doc.data();
  
    // Trial periods get replaced by paid, not chained after.
    if (data.source === 'trial') {
      trialPeriodsToExpire.push(doc.ref);
      return;
    }
  
    const end = data.periodEnd?.toDate?.();
    if (end) nonTrialEnds.push(end);
  });
  
  const latestPeriodEnd: Date | null = nonTrialEnds.length > 0
    ? new Date(Math.max(...nonTrialEnds.map(d => d.getTime())))
    : null;

const periodStart = latestPeriodEnd && latestPeriodEnd > now ? latestPeriodEnd : now;
const periodEnd = addMonths(periodStart, billingCycle === 'quarterly' ? 3 : 1);
const periodStatus = latestPeriodEnd && latestPeriodEnd > now ? 'upcoming' : 'active';

transaction.set(periodsRef.doc(reference), {
  planId,
  status: periodStatus,
  periodStart,
  periodEnd,
  totalCredits: newPlanCredits,
  usedCredits: 0,
  remainingCredits: newPlanCredits,
  source: 'subscription',
  subscriptionReference: reference,
  billingCycle,
  createdAt: FieldValue.serverTimestamp(),
  updatedAt: FieldValue.serverTimestamp(),
});


// Expire any trial periods that were active — paid period replaces them.
trialPeriodsToExpire.forEach(trialRef => {
  transaction.update(trialRef, {
    status: 'expired',
    expiredAt: FieldValue.serverTimestamp(),
    expiredReason: 'replaced_by_paid_subscription',
  });
});
storesSnap.docs.forEach(storeDoc => {
  transaction.set(
    storeDoc.ref,
    {
      status: 'active',
      aiAssistant: {
        enabled: true,
        channels: {
          web: true,
          whatsapp: true,
          instagram: true,
        },
        updatedAt: FieldValue.serverTimestamp(),
      },
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
});

    transaction.set(transactionRef, {
      userId, planId, amount, type: 'subscription', source: 'webhook',
      createdAt: FieldValue.serverTimestamp(), status: 'completed', paystackReference: reference,
      appliedDiscount: appliedDiscount || null,
      signupDiscountApplied: signupDiscountAppliedBool,
    });
  });

  try {
    await Promise.all(
      storesSnap.docs.map(storeDoc =>
        kv.del(`store_context_v3:${storeDoc.id}`).catch(() => null)
      )
    );
  
    console.log(`[${webhookId}] ✅ Cleared AI cache for user ${userId}`);
  } catch (e) {
    console.error(`[${webhookId}] ❌ Cache clear failed`, e);
  }

  // After the transaction, restore archived products
  try {
    const productsRef = db.collection('products');
    const snapshot = await productsRef
      .where('sellerId', '==', userId)
      .where('isArchived', '==', true)
      .where('archivedReason', '==', 'plan_downgrade')
      .get();

    if (!snapshot.empty) {
      const batch = db.batch();
      snapshot.docs.forEach(doc => {
        batch.update(doc.ref, { isArchived: false, archivedAt: null, archivedReason: null });
      });
      await batch.commit();
      console.log(`[${webhookId}] 📦 Restored ${snapshot.size} products for user ${userId}.`);
    }
  } catch (restoreError) {
    console.error(`[${webhookId}] ⚠️ Failed to restore products for user ${userId}:`, restoreError);
  }
}


// =======================================================
// 3. CREDIT TOP-UP LOGIC
// =======================================================
async function handleCreditTopUp(webhookId: string, eventData: any) {
  const { metadata, reference } = eventData;
  const { userId, credits, topupId } = metadata;

  console.log(`[${webhookId}] 🤖 Processing AI Credit Top-up for user ${userId}`);

  if (!userId || !credits || !topupId) {
    console.error(`[${webhookId}] ❌ Missing metadata for credit top-up`, metadata);
    return;
  }

  const numericCredits = Number(credits);

  if (isNaN(numericCredits)) {
    console.error(`[${webhookId}] ❌ Invalid credits value:`, credits);
    return;
  }

  const userRef = db.collection('users').doc(userId);
  const topupRef = userRef.collection('credit_topups').doc(topupId);
  const periodsRef = userRef.collection('ai_credit_periods');

  const activePeriodSnap = await periodsRef
    .where('status', '==', 'active')
    .orderBy('periodEnd', 'desc')
    .limit(1)
    .get();

  if (activePeriodSnap.empty) {
    console.error(`[${webhookId}] ❌ No active credit period found for top-up user ${userId}`);
    return;
  }

  const activePeriodRef = activePeriodSnap.docs[0].ref;

  await db.runTransaction(async (transaction: Transaction) => {
    const topupDoc = await transaction.get(topupRef);

    if (!topupDoc.exists || topupDoc.data()?.status !== 'pending') {
      console.log(`[${webhookId}] ⏭️ Skipping topup ${topupId}`);
      return;
    }

    const activePeriodDoc = await transaction.get(activePeriodRef);

    if (!activePeriodDoc.exists) {
      console.error(`[${webhookId}] ❌ Active period disappeared during transaction`);
      return;
    }

    const periodData = activePeriodDoc.data()!;
    const currentTotal = Number(periodData.totalCredits || 0);
    const currentRemaining = Number(periodData.remainingCredits || 0);

    transaction.update(activePeriodRef, {
      totalCredits: currentTotal + numericCredits,
      remainingCredits: currentRemaining + numericCredits,
      updatedAt: FieldValue.serverTimestamp(),
      lastTopupAt: FieldValue.serverTimestamp(),
    });

    transaction.update(topupRef, {
      status: 'completed',
      paidAt: FieldValue.serverTimestamp(),
      paystackReference: reference,
      appliedToPeriodId: activePeriodRef.id,
    });
  });

  console.log(`[${webhookId}] ✅ Successfully added ${numericCredits} credits to active period for user ${userId}`);
}

// =======================================================
// MAIN ROUTER
// =======================================================
export async function POST(request: Request) {
  const webhookId = `WEBHOOK-${Date.now()}`;

  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-paystack-signature');
    const secretKey = process.env.PAYSTACK_SECRET_KEY;

    if (!signature || !secretKey) return NextResponse.json({ message: 'Config Error' }, { status: 400 });

    const hash = crypto.createHmac('sha512', secretKey).update(rawBody).digest('hex');
    if (hash !== signature) return NextResponse.json({ message: 'Invalid signature' }, { status: 401 });

    const payload = JSON.parse(rawBody);
    const { event, data: eventData } = payload;

    if (event === 'charge.success') {
      const reference = eventData.reference;

      const globalWebhookRef = db.collection('processed_webhooks').doc(reference);
      const globalDoc = await globalWebhookRef.get();

      if (globalDoc.exists) {
        const status = globalDoc.data()?.status;
      
        if (status === 'completed') {
          console.log(`[${webhookId}] 🔁 Webhook for reference ${reference} already completed globally. Skipping.`);
          return NextResponse.json({ received: true });
        }
      
        console.log(`[${webhookId}] ⏳ Webhook for reference ${reference} is already processing. Skipping duplicate.`);
        return NextResponse.json({ received: true });
      }

      await globalWebhookRef.set({
        processedAt: FieldValue.serverTimestamp(),
        event: event,
        type: eventData.metadata?.type || 'unknown',
        status: 'processing'
      }, { merge: true });

      const metadata = eventData.metadata || {};

      if (metadata.type === 'ai_credit_topup') {
        await handleCreditTopUp(webhookId, eventData);
      } else if (metadata.planId || metadata.type === 'subscription') {
        await handleSubscriptionCharge(webhookId, eventData);
      } else if (metadata.type === 'order' || (typeof reference === 'string' && reference.startsWith('SELLQUIC-ORDER-'))) {
        await handleOrderCharge(webhookId, eventData);
      } else {
        console.log(`[${webhookId}] ℹ️ Unknown charge type. Ref: ${reference}`);
      }

      await globalWebhookRef.update({ status: 'completed' });
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error(`[${webhookId}] 💥 Error:`, err);
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 });
  }
}
