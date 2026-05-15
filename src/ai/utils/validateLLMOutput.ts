import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { saveModelResponse } from '@/ai/handlers';

type ProductLike = {
  id: string;
  name: string;
  price?: number;
  category?: string;
  description?: string;
  manageStock?: boolean;
  stock?: number;
  variants?: Array<{ id: string; name: string; price?: number; stock?: number }>;
};

type DeliveryLike = {
  id: string;
  label: string;
  fee: number;
  type?: string;
};

type Refs = {
  convRef: FirebaseFirestore.DocumentReference;
  msgRef: FirebaseFirestore.CollectionReference;
  inboxRef: FirebaseFirestore.DocumentReference;
};

type ValidateArgs = {
  rawText: string;
  refs: Refs;
  storeData: any;
  conversationId: string;
  products: ProductLike[];
  deliveries: DeliveryLike[];
  convData: any;
  userMsg?: string;
};

function stripFormatting(rawText: string) {
  return rawText
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, ' ')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/<ctrl\d+>/g, '')
    .replace(/call:\w+\{[\s\S]*$/g, '')
    .trim();
}

function removeQuickReplyBlock(rawText: string): string {
  return rawText.replace(/<!--QR:\s*\[.*?\]\s*-->/g, '').trim();
}

async function logViolation(refs: Refs, reason: string, rawText: string) {
  try {
    await refs.convRef.set(
      {
        outputValidationLastFailure: reason,
        outputValidationFailedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch {}
  console.warn('[OutputValidator]', reason, rawText);
}

// ── STATE TRACKER (Silent, does not change the AI's text) ──
function inferAwaitingStep(text: string, convData: any): string | null {
  const t = text.toLowerCase();
  if (/(which one would you like|which would you like|what size|what color|which option)/i.test(t)) return 'variant';
  if (/(how many would you like|how many pairs|how many pieces|quantity)/i.test(t)) return 'quantity';
  if (/(where should we deliver|delivery area|where should we send|where should we bring)/i.test(t)) return 'delivery';
  if (!convData?.customerAddress && /(specific house address|specific address|nearby landmark|house address|landmark)/i.test(t)) return 'address';
  if (!convData?.customerPhone && /(what number can we reach you on|can i grab your number|your whatsapp number|what number should we use)/i.test(t)) return 'phone';
  if (/(full name)/i.test(t)) return 'fullName';
  if (/(should i use your same details|should i go ahead and create the order|shall i go ahead and create the order)/i.test(t)) return 'confirmation';
  return null;
}

async function syncAwaitingStep(convRef: FirebaseFirestore.DocumentReference, text: string, convData: any) {
  const step = inferAwaitingStep(text, convData);
  if (step) {
    await convRef.set(
      {
        awaitingStep: step,
        awaitingSince: FieldValue.serverTimestamp(),
        nudgeCount: 0,
        lastNudgeSent: FieldValue.delete(),
      },
      { merge: true }
    );
  } else {
    await convRef.set(
      {
        awaitingStep: null,
        awaitingSince: FieldValue.delete(),
        nudgeCount: 0,
        lastNudgeSent: FieldValue.delete(),
      },
      { merge: true }
    );
  }
}

export async function validateLLMOutput({
  rawText,
  refs,
  convData,
}: ValidateArgs): Promise<NextResponse> {
  // 1. Clean the raw text output
  let cleaned = stripFormatting(rawText);
  cleaned = removeQuickReplyBlock(cleaned).trim();

  // 2. Safety check for empty outputs
  if (!cleaned) {
    await logViolation(refs, 'empty_output', rawText);
    const fallback = 'Please tell me what you need and I’ll help you.';
    await saveModelResponse(refs, fallback);
    await syncAwaitingStep(refs.convRef, fallback, convData);
    return NextResponse.json({ reply: { type: 'text', content: fallback } });
  }

  // 3. Save exactly what the AI wanted to say! (No robotic interceptors)
  await saveModelResponse(refs, cleaned);
  await syncAwaitingStep(refs.convRef, cleaned, convData);

  return NextResponse.json({ reply: { type: 'text', content: cleaned } });
}