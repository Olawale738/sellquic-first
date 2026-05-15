import { Type } from '@google/genai';
import { callGeminiResilient } from '../gemini/resilientClient';
import type { ProductV2, ProductVariantV2 } from '../types';
import { isVariantPurchasable } from './availability';
import {
  resolveVariant,
  type VariantResolveResult,
} from './resolveVariant';

export async function resolveVariantSmart(
  message: string,
  product: ProductV2,
  apiKey: string | undefined,
): Promise<VariantResolveResult> {
  const deterministicResult = resolveVariant(message, product);

  if (deterministicResult.status !== 'no_match') {
    return deterministicResult;
  }

  if (!apiKey) {
    return deterministicResult;
  }

  const variants = Array.isArray(product.variants) ? product.variants : [];
  if (!variants.length) {
    return deterministicResult;
  }

  let geminiResult: GeminiVariantResult | null = null;
  try {
    geminiResult = await callGeminiForVariant(message, product, variants, apiKey);
  } catch (err) {
    return {
      ...deterministicResult,
      reason: `gemini_failed:${err instanceof Error ? err.message.slice(0, 60) : 'unknown'}`,
    };
  }

  if (!geminiResult) {
    return deterministicResult;
  }

  return interpretGeminiResult(geminiResult, product, variants, deterministicResult);
}

type GeminiVariantResult = {
  matchKind: 'exact' | 'descriptive' | 'ambiguous' | 'none' | 'unclear';
  matchedVariantId?: string;
  ambiguousVariantIds?: string[];
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
};

const VARIANT_RESOLVE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    matchKind: {
      type: Type.STRING,
      enum: ['exact', 'descriptive', 'ambiguous', 'none', 'unclear'],
    },
    matchedVariantId: { type: Type.STRING },
    ambiguousVariantIds: { type: Type.ARRAY, items: { type: Type.STRING } },
    confidence: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
    reasoning: { type: Type.STRING },
  },
  required: ['matchKind', 'confidence', 'reasoning'],
  propertyOrdering: [
    'matchKind',
    'matchedVariantId',
    'ambiguousVariantIds',
    'confidence',
    'reasoning',
  ],
};

async function callGeminiForVariant(
  customerText: string,
  product: ProductV2,
  variants: ProductVariantV2[],
  apiKey: string,
): Promise<GeminiVariantResult> {
  const variantList = variants
    .map((v) => {
      const price = (v as any).price ?? (v as any).amount ?? '';
      return `- id="${v.id}" name="${v.name}"${price !== '' ? ` price=GHS${price}` : ''}`;
    })
    .join('\n');

  const prompt = `You are a product variant resolver for a Ghanaian e-commerce shop.

Map the customer's choice to one of the product's available variants.

PRODUCT: ${product.name}

AVAILABLE VARIANTS:
${variantList}

CUSTOMER MESSAGE: "${customerText}"

YOUR TASK:
1. If customer named a variant exactly or near-exactly, return matchKind="exact" with matchedVariantId.
2. If customer used a descriptor that maps to ONE variant ("the cheap one", "the small one", "the second one"), return matchKind="descriptive" with matchedVariantId.
3. If ambiguous between multiple variants ("medium" with two medium variants), return matchKind="ambiguous" with ambiguousVariantIds.
4. If customer's message doesn't reference any variant ("hello", "ok"), return matchKind="none".
5. If you can't tell, return matchKind="unclear".

IMPORTANT:
- matchedVariantId must be EXACTLY one of the IDs above.
- Do not invent IDs.
- "cheap"/"cheapest" → lowest price. "expensive"/"premium" → highest.
- "small"/"tiny" → smallest. "big"/"large" → largest.

Return ONLY this JSON:
{
  "matchKind": "...",
  "matchedVariantId": "...",
  "ambiguousVariantIds": ["..."],
  "confidence": "high" | "medium" | "low",
  "reasoning": "brief explanation"
}`;

  const outcome = await callGeminiResilient({
    prompt,
    schema: VARIANT_RESOLVE_SCHEMA,
    temperature: 0.1,
    maxOutputTokens: 200,
    kind: 'nlu',
    apiKey,
  });

  if (!outcome.ok) {
    throw new Error(outcome.errorType);
  }

  return JSON.parse(outcome.text) as GeminiVariantResult;
}

function interpretGeminiResult(
  parsed: GeminiVariantResult,
  product: ProductV2,
  variants: ProductVariantV2[],
  deterministicFallback: VariantResolveResult,
): VariantResolveResult {
  const matchKind = parsed.matchKind || 'unclear';

  if (matchKind === 'exact' || matchKind === 'descriptive') {
    if (!parsed.matchedVariantId) {
      return { ...deterministicFallback, reason: `gemini_${matchKind}_missing_variant_id` };
    }
    const variant = variants.find((v) => v.id === parsed.matchedVariantId);
    if (!variant) {
      return {
        ...deterministicFallback,
        reason: `gemini_${matchKind}_unknown_variant_id:${parsed.matchedVariantId}`,
      };
    }
    return {
      status: 'single_match',
      confidence:
        parsed.confidence === 'high' ? 0.92 : parsed.confidence === 'medium' ? 0.78 : 0.6,
      resolvedBy: matchKind === 'exact' ? 'exact' : 'token',
      variant,
      variants: [variant],
      purchasable: isVariantPurchasable(product, variant),
      reason:
        matchKind === 'exact'
          ? `gemini_exact:${parsed.reasoning?.slice(0, 60) || 'matched'}`
          : `gemini_descriptive:${parsed.reasoning?.slice(0, 60) || 'matched'}`,
    };
  }

  if (matchKind === 'ambiguous') {
    const ambiguousIds = parsed.ambiguousVariantIds || [];
    const matchedVariants = ambiguousIds
      .map((id) => variants.find((v) => v.id === id))
      .filter((v): v is ProductVariantV2 => v !== undefined);

    if (matchedVariants.length === 0) {
      return { ...deterministicFallback, reason: 'gemini_ambiguous_no_valid_variants' };
    }
    if (matchedVariants.length === 1) {
      const variant = matchedVariants[0];
      return {
        status: 'single_match',
        confidence: 0.75,
        resolvedBy: 'token',
        variant,
        variants: matchedVariants,
        purchasable: isVariantPurchasable(product, variant),
        reason: `gemini_ambiguous_resolved_single:${variant.name}`,
      };
    }
    return {
      status: 'multiple_matches',
      confidence: 0.7,
      resolvedBy: 'token',
      variants: matchedVariants.slice(0, 5),
      reason: `gemini_ambiguous:${parsed.reasoning?.slice(0, 60) || 'multiple'}`,
    };
  }

  return {
    ...deterministicFallback,
    reason: `gemini_${matchKind}:${parsed.reasoning?.slice(0, 60) || 'no_match'}`,
  };
}