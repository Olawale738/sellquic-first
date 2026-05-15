
import crypto from 'crypto';

type SendMetaPurchaseEventArgs = {
  pixelId: string;
  accessToken: string;
  eventId: string;
  orderId: string;
  value: number;
  currency: string;
  customer?: {
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    externalId?: string;
  };
  contents?: Array<{
    id: string;
    quantity: number;
    item_price?: number;
  }>;
  testEventCode?: string;
  eventSourceUrl?: string;
};

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

export async function sendMetaPurchaseEvent(args: SendMetaPurchaseEventArgs) {
  const {
    pixelId,
    accessToken,
    eventId,
    orderId,
    value,
    currency,
    customer,
    contents = [],
    testEventCode,
    eventSourceUrl,
  } = args;

  const user_data: Record<string, any> = {};

  if (customer?.email) user_data.em = [sha256(customer.email)];
  if (customer?.phone) user_data.ph = [sha256(customer.phone)];
  if (customer?.firstName) user_data.fn = [sha256(customer.firstName)];
  if (customer?.lastName) user_data.ln = [sha256(customer.lastName)];
  if (customer?.externalId) user_data.external_id = [sha256(customer.externalId)];

  const payload: Record<string, any> = {
    data: [
      {
        event_name: 'Purchase',
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: 'website',
        event_source_url: eventSourceUrl,
        user_data,
        custom_data: {
          currency,
          value,
          order_id: orderId,
          contents,
          content_type: 'product',
        },
      },
    ],
  };

  if (testEventCode) {
    payload.test_event_code = testEventCode;
  }

  const res = await fetch(
    `https://graph.facebook.com/v20.0/${pixelId}/events?access_token=${accessToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Meta CAPI error: ${JSON.stringify(data)}`);
  }

  return data;
}
