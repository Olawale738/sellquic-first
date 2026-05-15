'use server';

import { db } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

export type SeedResult = {
  success: boolean;
  message: string;
};

export async function seedPlatformSettings(): Promise<SeedResult> {
  try {
    const pricingData = {
      commissionPercentage: 0,
      // ── UPDATED PLANS TO MATCH YOUR NEW PRICING ──
      plans: {
        free: { 
          monthlyPrice: 0, 
          quarterlyPrice: 0, 
          label: "Free", 
          aiCredits: 0, 
          maxProducts: 10 
        },
        starter: { 
          monthlyPrice: 100, 
          quarterlyPrice: 270, 
          label: "Starter", 
          aiCredits: 200, 
          maxProducts: -1 // Unlimited
        },
        growth: { 
          monthlyPrice: 200, 
          quarterlyPrice: 540, 
          label: "Growth", 
          aiCredits: 2000, 
          maxProducts: -1 
        },
        business: { 
          monthlyPrice: 600, 
          quarterlyPrice: 1620, 
          label: "Business", 
          aiCredits: 5000, 
          maxProducts: -1 
        }
      },
      launchOffer: {
        active: true,
        endsAt: "2026-07-31",
        earlyAccessPrice: 150,
        earlyAccessLabel: "Early Access",
        trialDays: 7,
        earlyAccessPlanId: "growth"
      },
      trial: {
        active: true,
        durationDays: 7,
        aiCredits: 500 
      },
      updatedAt: FieldValue.serverTimestamp()
    };

    // We use .set without merge: true to ensure the structure is exactly as defined above
    await db.collection('settings').doc('platform').set(pricingData);

    return { success: true, message: "Pricing (Free, Starter, Growth, Business) seeded successfully!" };
  } catch (error: any) {
    console.error("Seeding error:", error);
    return { success: false, message: error.message || "An unknown error occurred during seeding." };
  }
}

export async function updatePlatformSettings(data: any): Promise<SeedResult> {
  try {
    if (!data.plans || !data.launchOffer || !data.trial) {
        throw new Error("Invalid data structure provided for platform settings.");
    }

    await db.collection('settings').doc('platform').set(data, { merge: true });

    return { success: true, message: "Platform settings updated successfully!" };
  } catch (error: any) {
    console.error("Update platform settings error:", error);
    return { success: false, message: error.message || "An unknown error occurred during settings update." };
  }
}

// ── THE NEW VIP PROMO ACCESS SYSTEM (NO CHANGES MADE HERE) ──

type PromoAction = 'grant' | 'extend' | 'revoke';

export async function managePromoAccessAction(
  userId: string,
  action: PromoAction,
  daysToAdd: number = 14,
  credits: number = 1000
): Promise<SeedResult> {
  try {
    const userRef = db.collection('users').doc(userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) return { success: false, message: 'User not found' };
    const userData = userSnap.data();

    const batch = db.batch();
    const now = new Date();

    if (action === 'grant') {
      const endsAt = new Date();
      endsAt.setDate(endsAt.getDate() + daysToAdd);

      batch.set(userRef, {
        promoAccess: {
          type: 'launch_offer',
          startsAt: FieldValue.serverTimestamp(),
          endsAt: Timestamp.fromMillis(endsAt.getTime()),
          grantedBy: 'admin',
          grantedAt: FieldValue.serverTimestamp(),
          revokedAt: null,
          notes: `Granted ${daysToAdd} days and ${credits} credits.`
        }
      }, { merge: true });

      if (credits > 0) {
        const periodsRef = userRef.collection('ai_credit_periods');
      
        const now = new Date();

const activeSnap = await periodsRef
  .where('status', '==', 'active')
  .orderBy('periodEnd', 'desc')
  .limit(10)
  .get();

const activeDoc = activeSnap.docs.find(doc => {
  const data = doc.data();
  const start = data.periodStart?.toDate?.() || new Date(data.periodStart);
  const end = data.periodEnd?.toDate?.() || new Date(data.periodEnd);
  return start <= now && end > now;
});

if (!activeDoc) {
  return {
    success: false,
    message: 'No active AI credit period found for this user.',
  };
}

const activePeriodRef = activeDoc.ref;
      
        batch.update(activePeriodRef, {
          totalCredits: FieldValue.increment(credits),
          remainingCredits: FieldValue.increment(credits),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    } 
    else if (action === 'extend') {
      const currentEndsAt = userData?.promoAccess?.endsAt?.toDate() || now;
      const newEndsAt = new Date(Math.max(currentEndsAt.getTime(), now.getTime()));
      newEndsAt.setDate(newEndsAt.getDate() + daysToAdd);

      batch.set(userRef, {
        'promoAccess.endsAt': Timestamp.fromMillis(newEndsAt.getTime()),
        'promoAccess.notes': `Extended by ${daysToAdd} days.`,
        'promoAccess.revokedAt': null 
      }, { merge: true });
    } 
    else if (action === 'revoke') {
      batch.set(userRef, {
        'promoAccess.revokedAt': FieldValue.serverTimestamp(),
        'promoAccess.notes': `Revoked by admin.`
      }, { merge: true });
    }

    await batch.commit();

    const messages = {
      grant: `Granted ${daysToAdd}-Day VIP Pass and ${credits} credits!`,
      extend: `Extended VIP Pass by ${daysToAdd} days!`,
      revoke: `VIP Pass has been revoked.`
    };

    return { success: true, message: messages[action] };
  } catch (error: any) {
    console.error('Promo Access Error:', error);
    return { success: false, message: 'Failed to update Promo Access.' };
  }
}