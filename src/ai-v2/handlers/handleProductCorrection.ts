import type { AiTurnResult, TurnContext } from '../types';
import { handleProductSearch } from './handleProductSearch';

function looksLikeProductCorrection(message: string): boolean {
  const text = String(message || '').toLowerCase().trim();

  if (!text) return false;

  return (
    /\b(no|nope|sorry|rather|instead|change|wrong)\b/i.test(text) &&
    /\b(i want|i need|the|this|that|flavor|flavour|shito|product|one)\b/i.test(text)
  );
}

function looksLikeNewProductRequest(message: string): boolean {
  const text = String(message || '').toLowerCase().trim();

  if (!text) return false;

  return /\b(i want|i need|give me|add|looking for|do you have)\b/i.test(text);
}

function stripCorrectionWords(message: string): string {
  return String(message || '')
    .replace(/\b(no|nope|sorry|rather|instead|change|wrong|not that|i mean)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function handleProductCorrection(
  ctx: TurnContext
): Promise<AiTurnResult | null> {
  if (!looksLikeProductCorrection(ctx.message) && !looksLikeNewProductRequest(ctx.message)) {
    return null;
  }

  const cleanedMessage = stripCorrectionWords(ctx.message);

  return handleProductSearch({
    ...ctx,
    message: cleanedMessage || ctx.message,
  });
}