import type { TurnContext } from '../types';
import { buildNluPrompt } from './promptBuilder';
import {
  NLU_RESPONSE_SCHEMA,
  validateGeminiNluResult,
  type GeminiNluResult,
} from './geminiNluSchema';
import { callGeminiResilient } from '../gemini/resilientClient';

export interface GeminiClassifyOutcome {
  ok: boolean;
  result?: GeminiNluResult;
  error?: string;
  latencyMs: number;
  invalidJson?: boolean;
  rawText?: string;
  modelUsed?: string;
  retryCount?: number;
}

/**
 * Calls Gemini for NLU classification through the resilient client.
 *
 * Behaviour:
 * - Resilient client tries primary model (Gemini 3.1 Flash-Lite Preview),
 *   retries once on transient errors, falls back through 2.5 Flash-Lite
 *   then 2.5 Flash before giving up.
 * - 4.5s per attempt (set in resilient client)
 * - Validates JSON against schema before returning
 * - Never throws — caller falls back to deterministic on failure
 */
export async function classifyTurnWithGemini(
  ctx: TurnContext,
): Promise<GeminiClassifyOutcome> {
  const apiKey = process.env.GEMINI_API_KEY || '';
  const prompt = buildNluPrompt(ctx);

  const outcome = await callGeminiResilient({
    prompt,
    schema: NLU_RESPONSE_SCHEMA,
    temperature: 0,
    maxOutputTokens: 500,
    kind: 'nlu',
    apiKey,
  });

  if (!outcome.ok) {
    return {
      ok: false,
      error: outcome.errorType,
      latencyMs: outcome.latencyMs,
    };
  }

  // Parse the JSON (resilient client already verified it parses, but we
  // need the parsed object to validate against schema)
  let parsed: unknown;
  try {
    parsed = JSON.parse(outcome.text);
  } catch {
    return {
      ok: false,
      error: 'invalid_json_after_cascade',
      latencyMs: outcome.latencyMs,
      invalidJson: true,
      rawText: outcome.text,
      modelUsed: outcome.modelUsed,
      retryCount: outcome.retryCount,
    };
  }

  const validated = validateGeminiNluResult(parsed);
  if (!validated) {
    return {
      ok: false,
      error: 'schema_validation_failed',
      latencyMs: outcome.latencyMs,
      rawText: outcome.text,
      modelUsed: outcome.modelUsed,
      retryCount: outcome.retryCount,
    };
  }

  return {
    ok: true,
    result: validated,
    latencyMs: outcome.latencyMs,
    modelUsed: outcome.modelUsed,
    retryCount: outcome.retryCount,
  };
}
