import { NextRequest, NextResponse } from 'next/server';
import { db, authAdmin } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { format, subDays, isAfter } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. Auth check
    const idToken = request.headers.get('authorization')?.split('Bearer ')[1];
    if (!idToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    if (userDoc.data()?.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const audienceType = searchParams.get('type') || 'all_vendors';

    // 2. Fetch all vendors and stores to perform filtering
    const [usersSnap, storesSnap] = await Promise.all([
      db.collection('users').get(),
      db.collection('stores').get(),
    ]);

    const sellers = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const stores = storesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const recipients = sellers
      .filter((u: any) => u.role !== 'superadmin' && u.role !== 'admin')
      .map((user: any) => {
        const vendorStores = stores.filter((s: any) => s.sellerId === user.id);
        const primaryStore: any = vendorStores[0] || {};
        
        const sub = user.subscription || {};
        const phone = user.phone || user.vendorMessaging?.whatsappPhone;
        const productsCount = (primaryStore.products || []).length;
        const aiEnabled = primaryStore.aiAssistant?.enabled === true;
        const waConnected = !!(primaryStore.whatsapp?.phoneId && primaryStore.whatsapp?.accessToken);

        let eligible = true;
        let skippedReason = null;

        // Base checks (Stricter per request: valid phone + not opted out)
        if (!phone) {
          eligible = false;
          skippedReason = 'missing_phone';
        } else if (user.vendorMessaging?.whatsappOptedOut === true) {
          eligible = false;
          skippedReason = 'opted_out';
        }

        // Audience specific filtering
        if (eligible) {
          switch (audienceType) {
            case 'active_paid_vendors':
              if (sub.planId === 'free' || sub.status !== 'active') eligible = false;
              break;
            case 'trial_vendors':
              if (sub.status !== 'trial') eligible = false;
              break;
            case 'trial_ending_soon':
              if (sub.status !== 'trial' || !sub.trialEndsAt) {
                eligible = false;
              } else {
                const trialEnd = sub.trialEndsAt instanceof Timestamp ? sub.trialEndsAt.toDate() : new Date(sub.trialEndsAt);
                if (!isAfter(trialEnd, now) || isAfter(trialEnd, threeDaysFromNow)) eligible = false;
              }
              break;
            case 'expired_trial_vendors':
              if (sub.status !== 'trial' || !sub.trialEndsAt) {
                eligible = false;
              } else {
                const trialEnd = sub.trialEndsAt instanceof Timestamp ? sub.trialEndsAt.toDate() : new Date(sub.trialEndsAt);
                if (isAfter(trialEnd, now)) eligible = false;
              }
              break;
            case 'subscription_expiring_soon':
              if (sub.planId === 'free' || !sub.endDate) {
                eligible = false;
              } else {
                const end = sub.endDate instanceof Timestamp ? sub.endDate.toDate() : new Date(sub.endDate);
                if (!isAfter(end, now) || isAfter(end, threeDaysFromNow)) eligible = false;
              }
              break;
            case 'payment_failed_vendors':
              if (sub.status !== 'past_due' && sub.status !== 'failed') eligible = false;
              break;
            case 'vendors_without_whatsapp_connected':
              if (waConnected) eligible = false;
              break;
            case 'vendors_without_products':
              if (productsCount > 0) eligible = false;
              break;
            case 'vendors_with_ai_enabled':
              if (!aiEnabled) eligible = false;
              break;
            case 'vendors_without_ai_enabled':
              if (aiEnabled) eligible = false;
              break;
            case 'all_vendors':
            default:
              break;
          }
          
          if (!eligible && !skippedReason) skippedReason = 'not_in_segment';
        }

        return {
          id: user.id,
          storeId: primaryStore.id || null,
          name: user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
          businessName: primaryStore.name || 'No Store',
          phone: phone,
          planId: sub.planId || 'free',
          subscriptionStatus: sub.status || 'inactive',
          expiryDate: sub.endDate || sub.trialEndsAt || null,
          whatsappConnected: waConnected,
          eligible,
          skippedReason,
        };
      });

    return NextResponse.json({
      success: true,
      recipients,
    });

  } catch (error: any) {
    console.error('[Audience Preview Error]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
