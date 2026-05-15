import { genAI } from '@/ai/genkit';

// ── Retry Configuration ──
export const MAX_RETRIES = 3;
export const BASE_DELAY_MS = 1000;
export const RETRYABLE_ERRORS = [503, 429, 'UNAVAILABLE', 'RESOURCE_EXHAUSTED', 'TIMEOUT', 'ECONNRESET', 'ETIMEDOUT'];

export function isRetryable(err: any): boolean {
  const msg = String(err?.message || err?.status || '');
  const code = err?.status || err?.code || err?.httpStatusCode;
  return RETRYABLE_ERRORS.some(e =>
    (typeof e === 'number' && code === e) || msg.toUpperCase().includes(String(e))
  );
}

export async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function sendWithRetry(
  chat: any,
  messageParts: any[],
  remainingMs: number,
  opts?: {
    fallbackModel?: string;
    systemInstruction?: any;
    history?: any[];
    activeTools?: any[];
  }
): Promise<any> {
  let lastErr: any;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const timeout = Math.max(2000, remainingMs - (attempt * BASE_DELAY_MS * 2));
      const result = await Promise.race([
        chat.sendMessage(messageParts),
        new Promise((_, rej) => setTimeout(() => rej(new Error('TIMEOUT')), timeout))
      ]);
      return result;
    } catch (err: any) {
      lastErr = err;
      console.warn(`[Chat API] Gemini attempt ${attempt + 1}/${MAX_RETRIES} failed:`, err?.message || err);
      if (!isRetryable(err) || attempt === MAX_RETRIES - 1) break;
      const delay = BASE_DELAY_MS * Math.pow(2, attempt) * (0.75 + Math.random() * 0.5);
      await sleep(delay);
    }
  }
  if (opts?.fallbackModel) {
    console.warn(`[Chat API] Primary model exhausted retries. Falling back to ${opts.fallbackModel}`);
    try {
      const fallbackGenModel = genAI.getGenerativeModel({
        model: opts.fallbackModel,
        systemInstruction: opts.systemInstruction,
        tools: opts.activeTools,
      } as any);
      const fallbackChat = fallbackGenModel.startChat({
        ...(opts.history?.length ? { history: opts.history } : {}),
      } as any);
      const result = await Promise.race([
        fallbackChat.sendMessage(messageParts),
        new Promise((_, rej) => setTimeout(() => rej(new Error('TIMEOUT')), 15000))
      ]);
      console.log(`[Chat API] Fallback to ${opts.fallbackModel} succeeded!`);
      return result;
    } catch (fallbackErr: any) {
      console.error(`[Chat API] Fallback model also failed:`, fallbackErr?.message);
    }
  }
  throw lastErr;
}

export function getMimeType(url: string): string {
  const clean = url.split('?')[0].split('/').pop() || '';
  if (clean.endsWith('.png')) return 'image/png';
  if (clean.endsWith('.webp')) return 'image/webp';
  if (clean.endsWith('.heic') || clean.endsWith('.heif')) return 'image/heic';
  return 'image/jpeg';
}

export function isRealHandoverScenario(userMessage: string): boolean {
  const t = String(userMessage || '').toLowerCase().trim();
  return (
    /\b(i want (a )?human|real person|talk to someone|call me|speak to (the )?seller|manager)\b/i.test(t) ||
    /\b(paid|payment|charged twice|sent momo but|money left my account|payment dispute)\b/i.test(t) ||
    /\b(wrong item|damaged|broken|received wrong)\b/i.test(t) ||
    /\b(cancel my paid order|change my paid order|modify paid order)\b/i.test(t)
  );
}

export function normalizeForComparison(value: string): string {
  return String(value || '').toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function isClearlyNewIntent(message: string): boolean {
  const text = normalizeForComparison(message);
  return (
    /\b(start|new order|fresh order|another order|different order|start fresh)\b/i.test(text) ||
    /\b(show me|what do you have|products|catalog|available|browse)\b/i.test(text) ||
    /\b(track|check my order|order status|lookup)\b/i.test(text) ||
    /\b(resend|link again|checkout link|send the link)\b/i.test(text) ||
    /\b(change address|change location|change delivery|deliver to|new delivery)\b/i.test(text) ||
    /\b(hi|hello|hey|good morning|good afternoon)\b/i.test(text)
  );
}

export function isSimpleContinuationReply(message: string): boolean {
  const text = String(message || '').toLowerCase().trim();
  return (
    /^(yes|yeah|yep|ok|okay|alright|sure|please|pls)$/i.test(text) ||
    /^(hello|hi|hey)$/i.test(text) ||
    /^(am still here|i'm still here|im still here|still here)$/i.test(text) ||
    /^(ok are you back|okay are you back|are you back|you there)$/i.test(text) ||
    /^(am still waiting|i'm still waiting|im still waiting|still waiting|waiting)$/i.test(text) ||
    /^(yes i'?m still interested|yes im still interested|still interested)$/i.test(text)
  );
}

export function isRecentNudgeReply(convData: any, message: string): boolean {
  const lastNudgeMs = convData.lastNudgeSent?.toMillis?.() || 0;
  if (!lastNudgeMs) return false;
  const withinWindow = Date.now() - lastNudgeMs <= 30 * 60 * 1000;
  if (!withinWindow) return false;
  return isSimpleContinuationReply(message);
}

export function extractOrderReference(message: string): string | null {
  const text = String(message || '').trim();
  const bestPrefixed = text.match(/\b(BEST-[A-Z0-9]{5,20})\b/i);
  if (bestPrefixed) return bestPrefixed[1];
  const genericRef = text.match(/\b([A-Z]{2,10}-[A-Z0-9]{4,20})\b/i);
  if (genericRef) return genericRef[1];
  return null;
}

export function isSameDetailsIntent(message: string): boolean {
  const text = String(message || '').toLowerCase().trim();
  return (
    /\b(use same|same details|same number|same address|same info|same location|same place|same delivery|use my same|use previous address|use the same address|same area)\b/i.test(text) ||
    /^(yes|yes please|yes pls|okay use same|ok use same|alright use same)$/i.test(text)
  );
}

export function isNewAddressIntent(message: string): boolean {
  const text = String(message || '').toLowerCase().trim();
  return /\b(new address|new location|different address|different location|change address|change location|update address|update location|deliver to new|use another address|another location|another address)\b/i.test(text);
}

export function isNeutralRecoveryMessage(message: string): boolean {
  const text = String(message || '').toLowerCase().trim();
  return /^(hi|hello|hey|am back|i'm back|im back|back|yes|yeah|yep|ok|okay|alright|thanks|thank you|still here|you there|still waiting|am still waiting|i'm still waiting|im still waiting|waiting|but am still waiting|but i'm still waiting)$/i.test(text);
}

export function isRecoveryIntent(message: string): boolean {
  const text = String(message || '').toLowerCase().trim();
  return isNeutralRecoveryMessage(text) ||
    /\b(i want|i need|available|how much|price|send link|checkout|delivery|address|change address|change location|use same|new address|different address|show me|products|catalog|order)\b/i.test(text);
}

export function isOrderLookupExitIntent(message: string): boolean {
  const text = String(message || '').toLowerCase().trim();
  return (
    /^(hi|hello|hey|ok|okay|alright|thanks|thank you|no|nope|never mind|forget it)$/i.test(text) ||
    /\b(i want|show me|what do you have|products|catalog|browse|start fresh|new order)\b/i.test(text)
  );
}