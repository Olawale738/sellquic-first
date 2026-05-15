import { NextResponse } from 'next/server';
import { db, authAdmin } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

async function verifySuperAdmin(request: Request) {
  const idToken = request.headers.get('authorization')?.split('Bearer ')[1];
  if (!idToken) return null;
  const decoded = await authAdmin.verifyIdToken(idToken);
  const userDoc = await db.collection('users').doc(decoded.uid).get();
  if (userDoc.data()?.role !== 'superadmin') return null;
  return decoded;
}

// GET — returns platform-wide AI credit stats + per-vendor breakdown
export async function GET(request: Request) {
  try {
    const user = await verifySuperAdmin(request);
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const currentMonth = new Date().toISOString().slice(0, 7);

    // ── FIX 1: Fetch ALL users, then filter out admins in code to catch legacy users ──
    const usersSnap = await db.collection('users').get();
      
    const allVendors = usersSnap.docs
      .map(doc => ({ uid: doc.id, ...doc.data() } as any))
      .filter(u => u.role !== 'superadmin' && u.role !== 'admin'); // Keeps legacy users safely!

    const vendorDetails = await Promise.all(
      allVendors.map(async (vendor) => {
        const creditSnap = await db
  .collection('users')
  .doc(vendor.uid)
  .collection('ai_credit_periods')
  .where('status', '==', 'active')
  .orderBy('periodEnd', 'desc')
  .limit(1)
  .get();
        
        let creditData = {
          totalCredits: 0,
          usedCredits: 0,
          remainingCredits: 0,
        };

        if (!creditSnap.empty) {
          const raw = creditSnap.docs[0].data();
          creditData = {
            totalCredits: Number(raw.totalCredits || 0),
            usedCredits: Number(raw.usedCredits || 0),
            remainingCredits: Number(raw.remainingCredits || 0),
          };
        }

        const percentUsed = creditData.totalCredits > 0 ? (creditData.usedCredits / creditData.totalCredits) * 100 : 0;
        
        const storeSnap = await db.collection('stores')
          .where('sellerId', '==', vendor.uid)
          .limit(1)
          .get();
      
        let storeId = null;
        let storeName = 'N/A';
        let aiEnabled = false;
        
        if (!storeSnap.empty) {
          const storeDoc = storeSnap.docs[0];
          const storeData = storeDoc.data();
        
          storeId = storeDoc.id;
          storeName = storeData.name || 'N/A';
          aiEnabled = storeData.aiAssistant?.enabled === true;
        }

        let promoAccess = null;
        if (vendor.promoAccess) {
          promoAccess = {
            type: vendor.promoAccess.type,
            endsAt: vendor.promoAccess.endsAt?.toDate ? vendor.promoAccess.endsAt.toDate().toISOString() : new Date(vendor.promoAccess.endsAt).toISOString(),
            revokedAt: vendor.promoAccess.revokedAt?.toDate ? vendor.promoAccess.revokedAt.toDate().toISOString() : vendor.promoAccess.revokedAt ? new Date(vendor.promoAccess.revokedAt).toISOString() : null,
            notes: vendor.promoAccess.notes || ''
          };
        }

        return {
          uid: vendor.uid,
          name: vendor.displayName || `${vendor.firstName || ''} ${vendor.lastName || ''}`.trim() || 'Unknown User',
          email: vendor.email,
          storeId,          
          storeName,
          aiEnabled,        
          planId: vendor.subscription?.planId || 'free',
          status: vendor.subscription?.status || 'active',
          totalCredits: creditData.totalCredits,
          usedCredits: creditData.usedCredits,
          remainingCredits: creditData.remainingCredits,
          percentUsed,
          promoAccess 
        };
      })
    );

    // Sort logic (Promos first, then Paid, then Free)
    vendorDetails.sort((a, b) => {
      const aHasPromo = a.promoAccess && !a.promoAccess.revokedAt && new Date(a.promoAccess.endsAt) > new Date();
      const bHasPromo = b.promoAccess && !b.promoAccess.revokedAt && new Date(b.promoAccess.endsAt) > new Date();
      
      if (aHasPromo && !bHasPromo) return -1;
      if (!aHasPromo && bHasPromo) return 1;
      if (a.planId !== 'free' && b.planId === 'free') return -1;
      if (a.planId === 'free' && b.planId !== 'free') return 1;
      return b.percentUsed - a.percentUsed;
    });

    const platformStats = vendorDetails.reduce((acc, vendor) => {
      acc.totalCreditsAllocated += (Number(vendor.totalCredits) || 0);
      acc.totalCreditsUsed += (Number(vendor.usedCredits) || 0);
      acc.totalCreditsRemaining += (Number(vendor.remainingCredits) || 0);
      
      const isExhausted = (Number(vendor.usedCredits) || 0) >= (Number(vendor.totalCredits) || 0) && (Number(vendor.totalCredits) || 0) > 0;
      
      if (vendor.percentUsed >= 80 && !isExhausted) {
          acc.vendorsNearLimit++;
      }
      if (isExhausted) {
          acc.vendorsExhausted++;
      }
      return acc;
    }, {
        // ── FIX 2: Only count stores where the AI toggle is physically turned ON ──
        totalVendorsWithAI: vendorDetails.filter(v => v.aiEnabled).length, 
        totalCreditsAllocated: 0,
        totalCreditsUsed: 0,
        totalCreditsRemaining: 0,
        vendorsNearLimit: 0,
        vendorsExhausted: 0
    });

    return NextResponse.json({
      platformStats,
      vendors: vendorDetails,
    });

  } catch (error: any) {
    console.error("Superadmin AI Credits GET Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}



// POST — manually grant credits to a vendor (100% UNTOUCHED)
export async function POST(request: Request) {
  try {
    const adminUser = await verifySuperAdmin(request);
    if (!adminUser) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { userId, credits, reason } = await request.json();

    if (!userId || !credits || !reason) {
      return NextResponse.json(
        { error: 'Missing userId, credits, or reason' },
        { status: 400 }
      );
    }

    const numericCredits = parseInt(credits, 10);

    if (isNaN(numericCredits) || numericCredits <= 0) {
      return NextResponse.json(
        { error: 'Invalid credit amount' },
        { status: 400 }
      );
    }

    // ✅ GET ACTIVE CREDIT PERIOD (NEW SYSTEM)
    const periodsRef = db
      .collection('users')
      .doc(userId)
      .collection('ai_credit_periods');

    const activeSnap = await periodsRef
      .where('status', '==', 'active')
      .orderBy('periodEnd', 'desc')
      .limit(1)
      .get();

    if (activeSnap.empty) {
      return NextResponse.json(
        { error: 'No active credit period for this user' },
        { status: 400 }
      );
    }

    const periodDoc = activeSnap.docs[0];
    const periodRef = periodDoc.ref;

    const batch = db.batch();

    // ✅ UPDATE ACTIVE PERIOD (THIS IS THE FIX)
    batch.update(periodRef, {
      totalCredits: FieldValue.increment(numericCredits),
      remainingCredits: FieldValue.increment(numericCredits),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // ✅ LOG (keep this)
    const logRef = db
      .collection('users')
      .doc(userId)
      .collection('credit_topups')
      .doc();

    batch.set(logRef, {
      amount: 0,
      credits: numericCredits,
      status: 'granted',
      source: 'admin',
      periodId: periodRef.id,
      reason,
      grantedBy: adminUser.uid,
      createdAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    return NextResponse.json({
      success: true,
      message: `${numericCredits} credits granted to active period.`,
    });

  } catch (error: any) {
    console.error('Superadmin AI Credits POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}