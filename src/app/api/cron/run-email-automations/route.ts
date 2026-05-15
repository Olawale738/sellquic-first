export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// ── Helpers ────────────────────────────────────────────────────────────────────

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(23, 59, 59, 999);
  return d;
}

function daysFromNowStart(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Build a dedup key — one email per vendor per automation per day
function dedupKey(automationId: string, userId: string): string {
  const today = new Date().toISOString().split('T')[0];
  return `${automationId}:${userId}:${today}`;
}

// ── Fetch vendors for each trigger type ───────────────────────────────────────

async function getVendorsForTrigger(
  trigger: string,
  delayDays: number
): Promise<Array<{ uid: string; email: string; firstName: string; storeName?: string; planExpiry?: Date }>> {

  const usersRef = db.collection('users');
  const storesRef = db.collection('stores');

  switch (trigger) {

    case 'signup': {
      // Vendors who signed up exactly delayDays ago
      const targetDate = daysAgo(delayDays);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);

      const snap = await usersRef
        .where('createdAt', '>=', Timestamp.fromDate(targetDate))
        .where('createdAt', '<', Timestamp.fromDate(nextDay))
        .get();

      return snap.docs.map(d => ({
        uid: d.id,
        email: d.data().email,
        firstName: d.data().firstName || 'there',
        storeName: d.data().displayName || 'your store',
      })).filter(u => u.email);
    }

    case 'inactive': {
      // Vendors who haven't logged in for exactly delayDays days
      const targetDate = daysAgo(delayDays);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);

      const snap = await usersRef
        .where('lastLoginAt', '>=', Timestamp.fromDate(targetDate))
        .where('lastLoginAt', '<', Timestamp.fromDate(nextDay))
        .get();

      return snap.docs.map(d => ({
        uid: d.id,
        email: d.data().email,
        firstName: d.data().firstName || 'there',
        storeName: d.data().displayName || 'your store',
      })).filter(u => u.email);
    }

    case 'expiring': {
      // Vendors whose plan expires in exactly delayDays days from now
      const targetStart = daysFromNowStart(delayDays);
      const targetEnd = daysFromNow(delayDays);

      const snap = await usersRef
        .where('subscription.expiresAt', '>=', Timestamp.fromDate(targetStart))
        .where('subscription.expiresAt', '<=', Timestamp.fromDate(targetEnd))
        .get();

      return snap.docs.map(d => ({
        uid: d.id,
        email: d.data().email,
        firstName: d.data().firstName || 'there',
        storeName: d.data().displayName || 'your store',
        planExpiry: d.data().subscription?.expiresAt?.toDate?.(),
      })).filter(u => u.email);
    }

    case 'first_order': {
      // Vendors who got their first order exactly delayDays ago
      // Check stores that have exactly 1 order and it was placed delayDays ago
      const targetDate = daysAgo(delayDays);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);

      const ordersSnap = await db.collection('orders')
        .where('createdAt', '>=', Timestamp.fromDate(targetDate))
        .where('createdAt', '<', Timestamp.fromDate(nextDay))
        .get();

      // Get unique storeIds from today's orders
      const storeIds = Array.from(new Set(ordersSnap.docs.map(d => d.data().storeId).filter(Boolean)));
      if (storeIds.length === 0) return [];

      const vendors: any[] = [];
      for (const storeId of storeIds) {
        // Check if this store has exactly 1 order total (it's their first)
        const totalOrders = await db.collection('orders')
          .where('storeId', '==', storeId)
          .count()
          .get();

        if (totalOrders.data().count !== 1) continue;

        const storeSnap = await storesRef.doc(storeId as string).get();
        if (!storeSnap.exists) continue;

        const sellerId = storeSnap.data()?.sellerId;
        if (!sellerId) continue;

        const userSnap = await usersRef.doc(sellerId).get();
        if (!userSnap.exists || !userSnap.data()?.email) continue;

        vendors.push({
          uid: sellerId,
          email: userSnap.data()!.email,
          firstName: userSnap.data()!.firstName || 'there',
          storeName: storeSnap.data()?.name || 'your store',
        });
      }
      return vendors;
    }

    case 'no_login': {
      // Vendors who signed up delayDays ago but have never logged in since signup
      const targetDate = daysAgo(delayDays);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);

      const snap = await usersRef
        .where('createdAt', '>=', Timestamp.fromDate(targetDate))
        .where('createdAt', '<', Timestamp.fromDate(nextDay))
        .get();

      // Filter those who never logged in (lastLoginAt same as createdAt or not set)
      return snap.docs
        .filter(d => {
          const data = d.data();
          const created = data.createdAt?.toDate?.()?.getTime?.();
          const lastLogin = data.lastLoginAt?.toDate?.()?.getTime?.();
          return !lastLogin || Math.abs(lastLogin - created) < 60000; // within 1 min = never logged in
        })
        .map(d => ({
          uid: d.id,
          email: d.data().email,
          firstName: d.data().firstName || 'there',
          storeName: d.data().displayName || 'your store',
        }))
        .filter(u => u.email);
    }

    default:
      return [];
  }
}

// ── Main cron handler ─────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const secret = request.headers.get('authorization')?.split('Bearer ')[1];
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: any[] = [];
  let totalSent = 0;
  let totalSkipped = 0;

  try {
    // Fetch all active automations
    const automationsSnap = await db.collection('email_automations')
      .where('isActive', '==', true)
      .get();

    if (automationsSnap.empty) {
      return NextResponse.json({ success: true, message: 'No active automations.', totalSent: 0 });
    }

    for (const autoDoc of automationsSnap.docs) {
      const automation = autoDoc.data();
      const automationId = autoDoc.id;

      try {
        // Fetch the template
        const templateSnap = await db.collection('email_templates').doc(automation.templateId).get();
        if (!templateSnap.exists) {
          results.push({ automation: automation.name, status: 'skipped', reason: 'Template not found' });
          continue;
        }
        const template = templateSnap.data()!;

        // Get matching vendors for this trigger
        const vendors = await getVendorsForTrigger(automation.trigger, automation.delayDays);

        if (vendors.length === 0) {
          results.push({ automation: automation.name, status: 'no_recipients', sent: 0 });
          continue;
        }

        // Dedup — Firestore "in" supports max 30 values
        const dedupKeys = vendors.map(v => dedupKey(automationId, v.uid));
        
        const alreadySent = new Set<string>();
        
        for (let i = 0; i < dedupKeys.length; i += 30) {
          const chunk = dedupKeys.slice(i, i + 30);
          const snap = await db.collection('email_automation_log')
            .where('dedupKey', 'in', chunk)
            .get();
        
          snap.docs.forEach(d => alreadySent.add(d.data().dedupKey));
        }

        const toSend = vendors.filter(v => !alreadySent.has(dedupKey(automationId, v.uid)));
        totalSkipped += vendors.length - toSend.length;


        if (toSend.length === 0) {
          results.push({ automation: automation.name, status: 'all_already_sent', sent: 0 });
          continue;
        }

        // Send in batches of 100 (Resend batch limit)
        const batchSize = 100;
        let sentCount = 0;

        for (let i = 0; i < toSend.length; i += batchSize) {
          const batch = toSend.slice(i, i + batchSize);

          const emailPayloads = batch.map(vendor => ({
            from: 'SellQuic <hello@sellquic.com>',
            to: vendor.email,
            subject: template.subject
  .replace(/{{firstName}}/g, vendor.firstName)
  .replace(/\[First Name\]/g, vendor.firstName)
  .replace(/{{storeName}}/g, vendor.storeName || 'your store')
  .replace(/\[Store Name\]/g, vendor.storeName || 'your store'),
html: template.body
  .replace(/{{firstName}}/g, vendor.firstName)
  .replace(/\[First Name\]/g, vendor.firstName)
  .replace(/{{storeName}}/g, vendor.storeName || 'your store')
  .replace(/\[Store Name\]/g, vendor.storeName || 'your store')
              .replace(/{{planExpiry}}/g, vendor.planExpiry
                ? vendor.planExpiry.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
                : 'soon'
              ),
          }));

          await resend.batch.send(emailPayloads);
          sentCount += batch.length;
          totalSent += batch.length;

          // Log sends to prevent duplicates
          const logBatch = db.batch();
          for (const vendor of batch) {
            const logRef = db.collection('email_automation_log').doc();
            logBatch.set(logRef, {
              automationId,
              userId: vendor.uid,
              dedupKey: dedupKey(automationId, vendor.uid),
              sentAt: FieldValue.serverTimestamp(),
              trigger: automation.trigger,
              templateId: automation.templateId,
            });
          }
          await logBatch.commit();
        }

        // Update automation sent count
        await autoDoc.ref.update({
          sentCount: (automation.sentCount || 0) + sentCount,
          lastRunAt: FieldValue.serverTimestamp(),
        });

        results.push({ automation: automation.name, status: 'sent', sent: sentCount });

      } catch (autoError: any) {
        console.error(`[email-automations] Error in automation ${automation.name}:`, autoError);
        results.push({ automation: automation.name, status: 'error', error: autoError.message });
      }
    }

    return NextResponse.json({
      success: true,
      totalSent,
      totalSkipped,
      results,
    });

  } catch (error: any) {
    console.error('[email-automations] Fatal error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
