import { NextRequest, NextResponse } from 'next/server';
import { authAdmin, db } from '@/lib/firebase-admin';
import { generateAutoStoreConfig, type GenerateAutoStoreParams } from '@/lib/store-ai';
import { FieldValue } from 'firebase-admin/firestore';

interface RequestBody {
  storeId?: string;
  vendorData?: GenerateAutoStoreParams & {
    vendor_name?: string;
    business_category?: string;
    subcategory?: string;
    location?: string;
    email?: string;
    phone?: string;
    business_description?: string;
  };
}

function normaliseVendorData(vendorData: RequestBody['vendorData']): GenerateAutoStoreParams | null {
  if (!vendorData) return null;

  const businessName =
    (vendorData as { vendor_name?: string; businessName?: string }).vendor_name ||
    (vendorData as { businessName?: string }).businessName ||
    '';
  const category =
    (vendorData as { business_category?: string; category?: string }).business_category ||
    (vendorData as { category?: string }).category ||
    '';

  if (!businessName && !category) return null;

  return {
    businessName,
    category,
    subcategory: vendorData.subcategory,
    email: vendorData.email,
    phone: vendorData.phone,
  };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const decoded = await authAdmin.verifyIdToken(authHeader.split('Bearer ')[1]);

    const body = (await req.json()) as RequestBody;
    const { storeId, vendorData } = body;

    // Verify store ownership if storeId provided
    let storeParams: GenerateAutoStoreParams | null = null;

    if (storeId) {
      const storeSnap = await db.collection('stores').doc(storeId).get();
      if (!storeSnap.exists) {
        return NextResponse.json({ error: 'Store not found' }, { status: 404 });
      }
      const storeData = storeSnap.data()!;
      if (storeData.sellerId !== decoded.uid) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const sellerSnap = await db.collection('users').doc(storeData.sellerId).get();
      const seller = sellerSnap.data();

      storeParams = {
        businessName: storeData.name ?? '',
        category: storeData.category ?? 'general',
        subcategory: storeData.subcategory ?? '',
        email: seller?.email ?? storeData.email ?? '',
        phone: seller?.phone ?? storeData.sellerPhone ?? '',
      };
    } else {
      storeParams = normaliseVendorData(vendorData);
      if (!storeParams) {
        return NextResponse.json({ error: 'Missing vendor information' }, { status: 400 });
      }
    }

    const result = await generateAutoStoreConfig(storeParams);
    if (!result) {
      return NextResponse.json({ error: 'AI generation failed. Please try again.' }, { status: 500 });
    }

    // Persist to Firestore if store is known
    if (storeId) {
      await db.collection('stores').doc(storeId).update({
        storefrontConfig: result.storefrontConfig,
        autoStoreConfig: result.autoStoreConfig,
        storefrontGeneratedAt: FieldValue.serverTimestamp(),
      });
    }

    return NextResponse.json({
      config: result.storefrontConfig,
      autoStoreConfig: result.autoStoreConfig,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[generate-storefront]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
