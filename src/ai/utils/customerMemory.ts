import { db } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function fetchAndCacheCustomerMemory(
  storeId: string,
  convRef: any,
  identifier: { phone?: string; igId?: string }
) {
  try {
    let query = db.collection('orders')
      .where('storeId', '==', storeId)
      .where('status', '==', 'fulfilled');

    if (identifier.phone) {
      query = query.where('customerInfo.phone', '==', identifier.phone);
    } else if (identifier.igId) {
      query = query.where('customerInfo.instagramUserId', '==', identifier.igId);
    } else {
      return null;
    }

    const pastOrders = await query.orderBy('createdAt', 'desc').limit(3).get();

    if (pastOrders.empty) {
      await convRef.update({
        customerMemory: 'NEW_CUSTOMER',
        customerMemoryLastChecked: FieldValue.serverTimestamp(),
      });
      return 'NEW_CUSTOMER';
    }

    // Extract customer name from most recent order if not already on conversation
    const mostRecentOrder = pastOrders.docs[0].data();
    const nameFromOrder = mostRecentOrder.customerInfo?.name || null;

    const memoryData = pastOrders.docs.map(doc => {
      const d = doc.data();
      const items = d.items?.map((i: any) => i.productName).filter(Boolean).join(', ');
      return `${items} (GHS ${d.totalAmount})`;
    }).join(' | ');

    const convSnap = await convRef.get();
    const convData = convSnap.data() || {};

    const patch: Record<string, any> = {
      customerMemory: memoryData,
      customerMemoryLastChecked: FieldValue.serverTimestamp(),
    };
    
    // Persist name from most recent order if not already known
    if (nameFromOrder && !convData.customerName) {
      patch.customerName = nameFromOrder;
    }
    
    // Persist phone from most recent order if not already known
    const phoneFromOrder = mostRecentOrder.customerInfo?.phone || null;
    if (phoneFromOrder && !convData.customerPhone) {
      patch.customerPhone = phoneFromOrder;
    }
    
    await convRef.update(patch);
    return memoryData;

  } catch (e) {
    console.error('[Memory Engine] Cache update failed:', e);
    return null;
  }
}