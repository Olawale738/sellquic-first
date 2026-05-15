/**
 * @fileOverview Shared WhatsApp helper for SellQuic-to-Vendor communication.
 * Uses the WhatsApp Cloud API to send template messages.
 */

export type WhatsAppSendResult = {
  success: boolean;
  providerMessageId?: string | null;
  providerResponse?: any;
  error?: string | null;
};

/**
 * Formats a phone number to 233XXXXXXXXX format.
 * Handles 0XX, +233XX, and 233XX inputs.
 */
export function normalizeGhanaPhone(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;

  let phone = raw.trim().replace(/[^\d+]/g, '');

  if (phone.startsWith('+')) phone = phone.slice(1);

  // 020... -> 23320...
  if (phone.startsWith('0')) {
    phone = `233${phone.slice(1)}`;
  }

  // Ensure it matches 233 + 9 digits
  if (!/^233\d{9}$/.test(phone)) {
    return null;
  }

  return phone;
}

/**
 * Sends a WhatsApp Template message to a vendor.
 */
export async function sendAdminVendorTemplateMessage({
  phone,
  templateName,
  templateLanguage = 'en_US',
  variables = [],
}: {
  phone: string;
  templateName: string;
  templateLanguage?: string;
  variables?: string[];
}): Promise<WhatsAppSendResult> {
  const phoneNumberId = process.env.ADMIN_VENDOR_WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.ADMIN_VENDOR_WHATSAPP_ACCESS_TOKEN;
  const apiVersion = process.env.ADMIN_VENDOR_WHATSAPP_API_VERSION || 'v21.0';

  if (!phoneNumberId || !accessToken) {
    return {
      success: false,
      error: 'WhatsApp environment variables are missing.',
    };
  }

  const normalizedPhone = normalizeGhanaPhone(phone);
  if (!normalizedPhone) {
    return {
      success: false,
      error: 'Invalid phone number format.',
    };
  }

  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

  const payload: any = {
    messaging_product: 'whatsapp',
    to: normalizedPhone,
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: templateLanguage,
      },
    },
  };

  if (variables.length > 0) {
    payload.template.components = [
      {
        type: 'body',
        parameters: variables.map((text) => ({
          type: 'text',
          text: String(text || '').trim(),
        })),
      },
    ];
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data?.error?.message || 'WhatsApp API error',
        providerResponse: data,
      };
    }

    return {
      success: true,
      providerMessageId: data?.messages?.[0]?.id || null,
      providerResponse: data,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error',
    };
  }
}
