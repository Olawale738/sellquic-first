import { db } from '@/lib/firebase-admin';
import type {
  CartItemV2,
  Channel,
  DeliveryZoneV2,
  OrderSessionV2,
  ProductV2,
  TurnContext,
} from '../types';
import {
  normalizeLegacyCommerceState,
  isCommerceStateExpired,
  createCommerceState,
} from '../state/commerceState';
import { getProductAvailability } from '../catalog/availability';


async function loadRecentMessages(
  storeRef: FirebaseFirestore.DocumentReference,
  conversationId: string,
  limit: number = 6,
): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
  try {
    const snap = await storeRef
      .collection('ai_conversations')
      .doc(conversationId)
      .collection('messages')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    const messages = snap.docs
      .map((doc) => {
        const data = doc.data();
        // Tolerate multiple historical role shapes:
        //   - data.role === 'user' | 'assistant'
        //   - data.from === 'customer' / 'bot' / 'ai'
        //   - data.sender === 'user' / 'bot'
        const isUser =
          data.role === 'user' ||
          data.from === 'customer' ||
          data.from === 'user' ||
          data.sender === 'user';
        const role: 'user' | 'assistant' = isUser ? 'user' : 'assistant';

        const content =
          (typeof data.content === 'string' && data.content) ||
          (typeof data.text === 'string' && data.text) ||
          (typeof data.message === 'string' && data.message) ||
          '';
        if (!content) return null;
        return {
          role,
          content: content.slice(0, 500),
        };
      })
      .filter(Boolean) as Array<{ role: 'user' | 'assistant'; content: string }>;

    // Firestore returned newest-first; reverse to chronological,
    // then drop the most recent user message (= current turn's input).
    const chronological = messages.reverse();
    if (
      chronological.length > 0 &&
      chronological[chronological.length - 1].role === 'user'
    ) {
      chronological.pop();
    }
    return chronological;
  } catch (err) {
    console.warn('[loadTurnContext] failed to load recent messages:', err);
    return [];
  }
}

type LoadTurnContextInput = {
  storeId: string;
  conversationId: string;
  channel?: Channel;
  message: string;
  imageUrl?: string | null;
};

function inferChannel(
  conversationId: string,
  convData: any,
  explicitChannel?: Channel
): Channel {
  if (explicitChannel) return explicitChannel;
  if (convData?.channel === 'whatsapp') return 'whatsapp';
  if (convData?.channel === 'instagram') return 'instagram';
  if (convData?.channel === 'webchat') return 'webchat';
  if (conversationId?.startsWith('wa_')) return 'whatsapp';
  if (convData?.instagramUserId) return 'instagram';

  return 'webchat';
}

function normalizeCart(convData: any, products: ProductV2[]): CartItemV2[] {
  const rawCart: unknown[] = Array.isArray(convData?.currentCart)
    ? convData.currentCart
    : [];

  return rawCart
    .map((rawItem: unknown): CartItemV2 => {
      const item = rawItem as any;

      const product = products.find((p) => p.id === item.productId);
      const variant = product?.variants?.find((v) => v.id === item.variantId);

      return {
        productId: String(item.productId || ''),
        variantId: item.variantId || null,
        quantity: Number(item.quantity || 0),

        nameSnapshot: item.nameSnapshot || product?.name || undefined,
        variantNameSnapshot: item.variantNameSnapshot || variant?.name || null,
        unitPriceSnapshot:
          typeof item.unitPriceSnapshot === 'number'
            ? item.unitPriceSnapshot
            : undefined,
        imageUrlSnapshot: item.imageUrlSnapshot || product?.images?.[0] || null,
      };
    })
    .filter((item: CartItemV2) => {
      return Boolean(item.productId) && Number.isFinite(item.quantity);
    });
}

function safeParseCheckoutUrl(url?: string | null): URL | null {
  if (!url) return null;

  try {
    return new URL(url, 'https://sellquic.com');
  } catch {
    return null;
  }
}

function normalizeOrderSession(
  convData: any,
  deliveries: DeliveryZoneV2[]
): OrderSessionV2 {
  const lastAction = convData?.lastActionData || null;

  const checkoutUrl =
    convData?.lastCheckoutLink ||
    (lastAction?.action === 'checkout' ? lastAction.url : null) ||
    null;

  const parsedCheckoutUrl = safeParseCheckoutUrl(checkoutUrl);
  const deliveryIdFromUrl =
    parsedCheckoutUrl?.searchParams.get('deliveryId') || null;

  const deliveryId =
    convData?.orderSession?.deliveryId ||
    convData?.selectedDeliveryId ||
    deliveryIdFromUrl ||
    null;

  const deliveryZone = deliveryId
    ? deliveries.find((zone) => zone.id === deliveryId) || null
    : null;

  const customerAddress =
    convData?.orderSession?.customerAddress ||
    convData?.customerAddress ||
    parsedCheckoutUrl?.searchParams.get('address') ||
    null;

  const checkoutTotal =
    typeof convData?.orderSession?.checkoutTotal === 'number'
      ? convData.orderSession.checkoutTotal
      : typeof lastAction?.total === 'number'
        ? lastAction.total
        : null;

  if (checkoutUrl) {
    return {
      status: 'checkout_created',
      deliveryId,
      deliveryLabel: deliveryZone?.label || null,
      deliveryFee:
        typeof deliveryZone?.fee === 'number' ? deliveryZone.fee : null,
      customerAddress,
      checkoutUrl,
      checkoutTotal,
      checkoutCreatedAt: convData?.checkoutCreatedAt || null,
    };
  }

  return {
    status: 'building_cart',
    deliveryId,
    deliveryLabel: deliveryZone?.label || null,
    deliveryFee:
      typeof deliveryZone?.fee === 'number' ? deliveryZone.fee : null,
    customerAddress,
    checkoutUrl: null,
    checkoutTotal: null,
    checkoutCreatedAt: null,
  };
}

function normalizeDeliveryZone(id: string, data: any): DeliveryZoneV2 {
  return {
    id,
    label: String(data?.label || '').trim(),
    fee: Number(data?.fee || 0),
    type: String(data?.type || 'delivery').trim() || 'delivery',
  };
}

export async function loadTurnContext(
  input: LoadTurnContextInput
): Promise<TurnContext> {
  const storeRef = db.collection('stores').doc(input.storeId);
  const convRef = storeRef.collection('ai_conversations').doc(input.conversationId);
  const recentMessages = await loadRecentMessages(storeRef, input.conversationId);

  const [storeSnap, convSnap, productsSnap, deliveriesSnap] = await Promise.all([
    storeRef.get(),
    convRef.get(),
    db.collection('products').where('storeId', '==', input.storeId).get(),
    storeRef.collection('deliveries').get(),
  ]);

  const storeData: any = {
    id: storeSnap.id,
    ...(storeSnap.data() || {}),
  };

  const convData: any = convSnap.data() || {};

  const products: ProductV2[] = productsSnap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() } as ProductV2))
    .filter((product: ProductV2) => getProductAvailability(product).visible);

  const deliveries: DeliveryZoneV2[] = deliveriesSnap.docs
    .map((doc) => normalizeDeliveryZone(doc.id, doc.data()))
    .filter((zone: DeliveryZoneV2) => {
      return Boolean(zone.label) && Number.isFinite(zone.fee);
    });

  let commerceState = convData?.commerceState
    ? convData.commerceState
    : normalizeLegacyCommerceState(convData);

  if (isCommerceStateExpired(commerceState)) {
    commerceState = createCommerceState('IDLE');
  }

  const currentCart = normalizeCart(convData, products);
  const orderSession = normalizeOrderSession(convData, deliveries);
  const channel = inferChannel(input.conversationId, convData, input.channel);

  return {
    storeId: input.storeId,
    sellerId: storeData.sellerId || convData.sellerId || undefined,
    conversationId: input.conversationId,
    channel,

    message: input.message,
    imageUrl: input.imageUrl || null,

    storeData,
    convData,

    products,
    deliveries,

    currentCart,
    orderSession,
    commerceState,

    customer: {
      name: convData.customerName || null,
      phone: convData.customerPhone || null,
      address: convData.customerAddress || orderSession.customerAddress || null,
      instagramUserId: convData.instagramUserId || null,
      whatsappId: convData.customerWhatsAppId || null,
      memory: convData.customerMemory ?? null,
    },
    recentMessages,
  };
}