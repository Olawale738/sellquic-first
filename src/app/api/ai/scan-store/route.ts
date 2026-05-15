import { NextResponse } from 'next/server';
import { authAdmin, db } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

interface ScanIssue {
  code: string;
  label: string;
  link?: string;
}

interface ProductScanItem {
  productId: string;
  name: string;
  issues: Omit<ScanIssue, 'link'>[];
  score: number;
}

export async function POST(request: Request) {
  try {
    const idToken = request.headers.get('authorization')?.split('Bearer ')[1];
    if (!idToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const userId = decodedToken.uid;
    const { storeId } = await request.json();

    if (!storeId) {
      return NextResponse.json({ error: 'Missing storeId' }, { status: 400 });
    }

    const storeRef = db.collection('stores').doc(storeId);
    const [storeDoc, productsSnapshot, deliveriesSnapshot] = await Promise.all([
      storeRef.get(),
      db.collection('products').where('storeId', '==', storeId).limit(200).get(),
      storeRef.collection('deliveries').get()
    ]);
    
    if (!storeDoc.exists || storeDoc.data()?.sellerId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const storeData = storeDoc.data()!;
    
    const flaggedItems: ProductScanItem[] = [];
    const storeIssues: ScanIssue[] = [];

    // --- 1. Product Issues ---
    for (const doc of productsSnapshot.docs) {
      const product = doc.data();
      const issues: Omit<ScanIssue, 'link'>[] = [];

      if (!product.description || product.description.length < 50) {
        issues.push({ code: 'SHORT_DESC', label: 'Description is too short' });
      }
      if (!product.images || product.images.length < 2) {
        issues.push({ code: 'FEW_IMAGES', label: 'Needs more images' });
      }
      if (product.description && product.description.length < 150 && !product.description.includes(':')) {
        issues.push({ code: 'POTENTIAL_MISSING_SPECS', label: 'Potential missing details' });
      }

      if (issues.length > 0) {
        flaggedItems.push({
          productId: doc.id,
          name: product.name,
          issues,
          score: 100 - (issues.length * 20),
        });
      }
    }

    // --- 2. Store-level Issues ---
    if (deliveriesSnapshot.docs.length === 0) {
        storeIssues.push({
            code: 'NO_DELIVERY_OPTIONS',
            label: 'Add delivery or pickup options so customers know how to get their orders.',
            link: '/dashboard/deliveries'
        });
    }
    
    if (!storeData.paymentInfo?.split_configured) {
         storeIssues.push({
            code: 'SETUP_PAYSTACK',
            label: 'Enable automated payments (Card & MoMo) to get paid instantly.',
            link: '/dashboard/payments'
        });
    }

    if (!storeData.isCodActive && !storeData.isMomoActive) {
         storeIssues.push({
            code: 'ENABLE_MORE_PAYMENT_METHODS',
            label: 'Activate more payment options like Cash on Delivery or Manual MoMo.',
            link: '/dashboard/payments'
        });
    }

    if (!storeData.isReturnPolicyActive) {
      storeIssues.push({
        code: 'NO_RETURN_POLICY',
        label: 'Set up a return policy to build customer trust.',
        link: '/dashboard/deliveries',
      });
    }


    const summary = {
      totalProducts: productsSnapshot.size,
      flagged: flaggedItems.length + storeIssues.length,
    };

    const report = {
      summary: summary,
      items: flaggedItems,
      storeIssues: storeIssues,
    };

    await storeRef.update({
      'aiAssistant.lastScanAt': FieldValue.serverTimestamp(),
      'aiAssistant.scanReport': report,
      'aiAssistant.scanDismissed': false,
    });

    return NextResponse.json({ success: true, report });

  } catch (error: any) {
    console.error('Store Scan Error:', error);
    return NextResponse.json({ error: error.message || 'An unknown error occurred' }, { status: 500 });
  }
}
