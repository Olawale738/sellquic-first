import { GoogleGenAI } from '@google/genai';

/**
 * Gemini Resilient Client — model cascade with retry + jitter.
 *
 * Strategy:
 *   1. Try primary (Gemini 3.1 Flash-Lite Preview) — newest, fastest, cheapest
 *      for high-volume classification/extraction. Free tier exists. Preview =
 *      may have rate limits.
 *   2. On timeout / 503 / network / invalid JSON → retry once with 400ms backoff
 *      + jitter
 *   3. Still failing → fallback 1 (Gemini 2.5 Flash-Lite, stable) → 1 retry
 *   4. Still failing → fallback 2 (Gemini 2.5 Flash, stable, more capable but
 *      slower/pricier) → 1 retry
 *   5. All Gemini fail → caller falls back to deterministic
 *
 * Health tracking:
 *   - In-memory per-model success/fail counter (resets on cold start)
 *   - If a model has >5 fails in last 10 calls AND <1 minute since last fail,
 *     skip it for 60 seconds (open circuit)
 *   - This prevents hammering an overloaded model every turn
 *
 * Timeout per attempt:
 *   - NLU: 4500ms
 *   - Composer: 5500ms
 *   - Hard total cascade budget: ~12s worst case (3 models × ~4s avg)
 *   - Real cascade rarely runs full chain — primary or fallback 1 usually wins
 */

export type ModelTier = 'primary' | 'fallback_1' | 'fallback_2';

export const MODEL_CHAIN: Record<ModelTier, string> = {
  primary: 'gemini-3.1-flash-lite-preview',
  fallback_1: 'gemini-2.5-flash-lite',
  fallback_2: 'gemini-2.5-flash',
};

export type GeminiCallKind =
  | 'nlu'
  | 'composer'
  | 'delivery_zone'
  | 'turn_plan_extraction'
  | 'fact_packet_composer';

export type GeminiCallOptions = {
  prompt: string;
  schema?: Record<string, unknown>;
  temperature?: number;
  maxOutputTokens?: number;
  kind: GeminiCallKind;
  apiKey: string;
};

export type GeminiCallResult =
  | {
      ok: true;
      text: string;
      modelUsed: string;
      tier: ModelTier;
      retryCount: number;
      latencyMs: number;
    }
  | {
      ok: false;
      errorType: 'all_models_failed' | 'no_api_key' | 'invalid_request';
      errorMessage: string;
      attemptsLog: AttemptLog[];
      latencyMs: number;
    };

type AttemptLog = {
  tier: ModelTier;
  model: string;
  attempt: number;
  outcome: 'success' | 'timeout' | '503' | '429' | 'invalid_json' | 'error';
  latencyMs: number;
  errorMessage?: string;
};

// ─────────────────────────────────────────────────────────────────────────
// Health tracking — module-scoped (per Vercel serverless instance)
// ─────────────────────────────────────────────────────────────────────────

type ModelHealth = {
  recentOutcomes: ('success' | 'fail')[];
  lastFailureAt: number;
  circuitOpenUntil: number;
};

const HEALTH: Record<ModelTier, ModelHealth> = {
  primary: { recentOutcomes: [], lastFailureAt: 0, circuitOpenUntil: 0 },
  fallback_1: { recentOutcomes: [], lastFailureAt: 0, circuitOpenUntil: 0 },
  fallback_2: { recentOutcomes: [], lastFailureAt: 0, circuitOpenUntil: 0 },
};

const HEALTH_WINDOW = 10;
const CIRCUIT_BREAK_FAIL_THRESHOLD = 5;
const CIRCUIT_BREAK_DURATION_MS = 60_000;

function recordOutcome(tier: ModelTier, outcome: 'success' | 'fail'): void {
  const h = HEALTH[tier];
  h.recentOutcomes.push(outcome);
  if (h.recentOutcomes.length > HEALTH_WINDOW) {
    h.recentOutcomes.shift();
  }
  if (outcome === 'fail') {
    h.lastFailureAt = Date.now();
    const recentFails = h.recentOutcomes.filter((o) => o === 'fail').length;
    if (recentFails >= CIRCUIT_BREAK_FAIL_THRESHOLD) {
      h.circuitOpenUntil = Date.now() + CIRCUIT_BREAK_DURATION_MS;
    }
  }
}

function isCircuitOpen(tier: ModelTier): boolean {
  return HEALTH[tier].circuitOpenUntil > Date.now();
}

export function getModelHealthSnapshot(): Record<ModelTier, {
  successRate: number;
  recentCalls: number;
  circuitOpen: boolean;
}> {
  const snapshot: any = {};
  for (const tier of ['primary', 'fallback_1', 'fallback_2'] as ModelTier[]) {
    const h = HEALTH[tier];
    const total = h.recentOutcomes.length;
    const successes = h.recentOutcomes.filter((o) => o === 'success').length;
    snapshot[tier] = {
      successRate: total === 0 ? 1 : successes / total,
      recentCalls: total,
      circuitOpen: isCircuitOpen(tier),
    };
  }
  return snapshot;
}

// ─────────────────────────────────────────────────────────────────────────
// Single-attempt call with timeout
// ─────────────────────────────────────────────────────────────────────────

function getTimeoutMs(kind: GeminiCallKind): number {
  if (kind === 'composer') return 5500;
  if (kind === 'fact_packet_composer') return 5500;
  if (kind === 'turn_plan_extraction') return 5500;
  if (kind === 'delivery_zone') return 4500;
  return 4500; // nlu
}

async function callOnce(
  model: string,
  options: GeminiCallOptions,
): Promise<{ ok: true; text: string; latencyMs: number } | {
  ok: false;
  errorKind: 'timeout' | '503' | '429' | 'invalid_json' | 'error';
  errorMessage: string;
  latencyMs: number;
}> {
  const start = Date.now();
  const timeoutMs = getTimeoutMs(options.kind);

  try {
    const ai = new GoogleGenAI({ apiKey: options.apiKey });

    const config: any = {
      temperature: options.temperature ?? 0.2,
      maxOutputTokens: options.maxOutputTokens ?? 400,
    };

    if (options.schema) {
      config.responseMimeType = 'application/json';
      config.responseSchema = options.schema;
    }

    const callPromise = ai.models.generateContent({
      model,
      contents: options.prompt,
      config,
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('attempt_timeout')), timeoutMs),
    );

    const result: any = await Promise.race([callPromise, timeoutPromise]);
    const latencyMs = Date.now() - start;
    const text = result?.text ?? '';

    if (!text) {
      return {
        ok: false,
        errorKind: 'error',
        errorMessage: 'empty_response',
        latencyMs,
      };
    }

    // If schema requested, validate JSON parses
    if (options.schema) {
      try {
        JSON.parse(text);
      } catch {
        return {
          ok: false,
          errorKind: 'invalid_json',
          errorMessage: 'response_not_valid_json',
          latencyMs,
        };
      }
    }

    return { ok: true, text, latencyMs };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);

    if (msg.includes('attempt_timeout')) {
      return { ok: false, errorKind: 'timeout', errorMessage: msg, latencyMs };
    }

    // Detect 503 / overloaded
    if (msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('overloaded')) {
      return { ok: false, errorKind: '503', errorMessage: msg.slice(0, 120), latencyMs };
    }

    // Detect 429 / rate limit
    if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('rate limit')) {
      return { ok: false, errorKind: '429', errorMessage: msg.slice(0, 120), latencyMs };
    }

    return { ok: false, errorKind: 'error', errorMessage: msg.slice(0, 120), latencyMs };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Try one model with one retry on transient errors
// ─────────────────────────────────────────────────────────────────────────

async function tryModelTier(
  tier: ModelTier,
  options: GeminiCallOptions,
  attemptsLog: AttemptLog[],
): Promise<{ ok: true; text: string; latencyMs: number; retries: number } | { ok: false }> {
  if (isCircuitOpen(tier)) {
    attemptsLog.push({
      tier,
      model: MODEL_CHAIN[tier],
      attempt: 0,
      outcome: 'error',
      latencyMs: 0,
      errorMessage: 'circuit_open',
    });
    return { ok: false };
  }

  const model = MODEL_CHAIN[tier];

  // First attempt
  const first = await callOnce(model, options);
  attemptsLog.push({
    tier,
    model,
    attempt: 1,
    outcome: first.ok ? 'success' : first.errorKind,
    latencyMs: first.latencyMs,
    errorMessage: first.ok ? undefined : first.errorMessage,
  });

  if (first.ok) {
    recordOutcome(tier, 'success');
    return { ok: true, text: first.text, latencyMs: first.latencyMs, retries: 0 };
  }

  recordOutcome(tier, 'fail');

  // Retry only on transient errors (timeout, 503, invalid_json)
  const isRetryable =
    first.errorKind === 'timeout' ||
    first.errorKind === '503' ||
    first.errorKind === 'invalid_json';

  if (!isRetryable) {
    return { ok: false };
  }

  // Backoff with jitter: 300-600ms
  const backoffMs = 300 + Math.floor(Math.random() * 300);
  await new Promise((r) => setTimeout(r, backoffMs));

  const second = await callOnce(model, options);
  attemptsLog.push({
    tier,
    model,
    attempt: 2,
    outcome: second.ok ? 'success' : second.errorKind,
    latencyMs: second.latencyMs,
    errorMessage: second.ok ? undefined : second.errorMessage,
  });

  if (second.ok) {
    recordOutcome(tier, 'success');
    return {
      ok: true,
      text: second.text,
      latencyMs: first.latencyMs + backoffMs + second.latencyMs,
      retries: 1,
    };
  }

  recordOutcome(tier, 'fail');
  return { ok: false };
}

// ─────────────────────────────────────────────────────────────────────────
// Public API — call with full cascade
// ─────────────────────────────────────────────────────────────────────────

export async function callGeminiResilient(
  options: GeminiCallOptions,
): Promise<GeminiCallResult> {
  const startedAt = Date.now();
  const attemptsLog: AttemptLog[] = [];

  if (!options.apiKey) {
    return {
      ok: false,
      errorType: 'no_api_key',
      errorMessage: 'GEMINI_API_KEY not set',
      attemptsLog,
      latencyMs: 0,
    };
  }

  const tiers: ModelTier[] = ['primary', 'fallback_1', 'fallback_2'];

  for (const tier of tiers) {
    const result = await tryModelTier(tier, options, attemptsLog);
    if (result.ok) {
      return {
        ok: true,
        text: result.text,
        modelUsed: MODEL_CHAIN[tier],
        tier,
        retryCount: result.retries,
        latencyMs: Date.now() - startedAt,
      };
    }
  }

  return {
    ok: false,
    errorType: 'all_models_failed',
    errorMessage: 'cascade_exhausted',
    attemptsLog,
    latencyMs: Date.now() - startedAt,
  };
}
