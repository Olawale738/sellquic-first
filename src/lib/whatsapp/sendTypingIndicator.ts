export async function sendWhatsAppTypingIndicator(
  messageId: string,  // ← needs the actual message ID now
  phoneId: string,
  token: string
): Promise<void> {
  try {
    await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch (e) {
    console.warn('[WA] Typing indicator skipped:', e);
  }
}