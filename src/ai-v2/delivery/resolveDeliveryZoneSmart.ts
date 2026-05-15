import { Type } from '@google/genai';
import { callGeminiResilient } from '../gemini/resilientClient';
import type { DeliveryZoneV2 } from '../types';
import {
  resolveDeliveryZone,
  type DeliveryResolveResult,
} from './resolveDeliveryZone';

/**
 * Smart wrapper around the deterministic resolveDeliveryZone.
 *
 * Strategy:
 *   1. Try deterministic resolver first (fast, no Gemini cost) — handles
 *      exact matches like "tamale", "weija", "adabraka" with vendor labels.
 *   2. If deterministic returns no_match AND apiKey is provided, ask Gemini
 *      to map the customer's location using Ghana geography knowledge.
 *      Handles "kejetia" → Kumasi, "lapaz" → Accra, "asokwa" → Kumasi.
 *   3. Validate Gemini's answer against the actual zone list (Gemini can
 *      hallucinate zone IDs, so we never trust blindly).
 *   4. Return the SAME DeliveryResolveResult shape so handleDeliveryReply
 *      doesn't need to change its branching.
 *
 * Failure modes:
 *   - Gemini timeout (3s) → returns deterministic no_match unchanged
 *   - Gemini returns invalid zone ID → returns deterministic no_match
 *   - Gemini says out_of_coverage → returns deterministic no_match
 *     (handler will list available zones, which is correct UX)
 *   - Gemini says broad_ambiguous (e.g., "accra" with multiple Accra zones)
 *     → returns multiple_matches with the suggested zones
 *
 * The wrapper NEVER throws. Always returns a valid DeliveryResolveResult.
 */
export async function resolveDeliveryZoneSmart(
  message: string,
  zones: DeliveryZoneV2[],
  apiKey: string | undefined,
): Promise<DeliveryResolveResult> {
  // 1. Try deterministic first — fast, free, handles exact/contains/token
  const deterministicResult = resolveDeliveryZone(message, zones);

  // If deterministic found something, trust it.
  if (deterministicResult.status !== 'no_match') {
    return deterministicResult;
  }

  // No API key → can't do geographic mapping, return deterministic
  // no_match so handler lists available zones.
  if (!apiKey) {
    return deterministicResult;
  }

  // 2. Ask Gemini for geographic mapping
  let geminiResult: GeminiZoneResult | null = null;
  try {
    geminiResult = await callGeminiForZone(message, zones, apiKey);
  } catch (err) {
    // Timeout / network / parse error — fall back to deterministic.
    return {
      ...deterministicResult,
      reason: `gemini_failed:${err instanceof Error ? err.message.slice(0, 60) : 'unknown'}`,
    };
  }

  if (!geminiResult) {
    return deterministicResult;
  }

  // 3. Interpret Gemini's answer
  return interpretGeminiResult(geminiResult, message, zones, deterministicResult);
}

// ─────────────────────────────────────────────────────────────────────────
// Gemini call
// ─────────────────────────────────────────────────────────────────────────

type GeminiZoneResult = {
  matchKind: 'exact' | 'sub_area' | 'broad_ambiguous' | 'out_of_coverage' | 'unclear';
  matchedZoneId?: string;
  subAreaName?: string;
  broadArea?: string;
  ambiguousZoneIds?: string[];
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
};

const ZONE_RESOLVE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    matchKind: {
      type: Type.STRING,
      enum: ['exact', 'sub_area', 'broad_ambiguous', 'out_of_coverage', 'unclear'],
    },
    matchedZoneId: { type: Type.STRING },
    subAreaName: { type: Type.STRING },
    broadArea: { type: Type.STRING },
    ambiguousZoneIds: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    confidence: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
    reasoning: { type: Type.STRING },
  },
  required: ['matchKind', 'confidence', 'reasoning'],
  propertyOrdering: [
    'matchKind',
    'matchedZoneId',
    'subAreaName',
    'broadArea',
    'ambiguousZoneIds',
    'confidence',
    'reasoning',
  ],
};

async function callGeminiForZone(
  customerText: string,
  zones: DeliveryZoneV2[],
  apiKey: string,
): Promise<GeminiZoneResult> {
  const zonesList = zones
    .map((z) => `- id="${z.id}" label="${z.label}" fee=GHS${z.fee}`)
    .join('\n');

  const prompt = `You are a delivery zone resolver for a Ghanaian e-commerce shop.

Map the customer's location to one of the vendor's delivery zones using Ghana geography knowledge.

VENDOR ZONES:
${zonesList}

CUSTOMER LOCATION TEXT: "${customerText}"

GHANA GEOGRAPHY (use this knowledge):
- Greater Accra region neighborhoods: Accra Central, Adabraka, Osu, East Legon, Lapaz, Madina, Spintex, Adenta, Tema (own town), Weija, Kasoa (border with Central), Taifa, Dome, Achimota, Dansoman, Teshie, Nungua, La, Labadi, Cantonments, Airport Residential, Roman Ridge, Dzorwulu, Abelemkpe, Tesano
- Kumasi region neighborhoods: Adum, Asokwa, Bantama, Ahodwo, Suame, Kejetia, Tafo, Asafo, Santasi, Patasi, Ahinsan, Kwadaso, Ayigya, Ayeduase
- Tema region: Tema Community 1-25, Sakumono, Ashaiman, Spintex (border with Accra)
- Northern: Tamale, Bolga (Bolgatanga), Wa, Yendi, Walewale
- Western/Central: Takoradi, Sekondi, Cape Coast, Winneba, Kasoa
- Eastern: Koforidua, Akosombo, Nsawam, Aburi
- Volta: Ho, Aflao, Keta

YOUR TASK:
1. If customer named a zone exactly (matches a vendor zone label), return matchKind="exact" with matchedZoneId.
2. If customer named a neighborhood/sub-area inside a known vendor zone (e.g., "kejetia" when vendor delivers to "kumasi"), return matchKind="sub_area" with matchedZoneId AND subAreaName.
3. If customer named a broad region that overlaps with multiple vendor zones (e.g., "accra" when vendor has Adabraka, East Legon, Weija as separate zones), return matchKind="broad_ambiguous" with broadArea AND ambiguousZoneIds (the IDs of the matching zones).
4. If customer's location is clearly outside vendor's coverage (e.g., "Bolga" when vendor only delivers Accra/Kumasi), return matchKind="out_of_coverage".
5. If you can't tell, return matchKind="unclear".

IMPORTANT:
- matchedZoneId must be EXACTLY one of the IDs from the vendor zones list above.
- ambiguousZoneIds must be IDs from the list above.
- Do not invent zone IDs or labels.
- Be confident about Ghana geography but cautious about edge cases (Spintex straddles Accra/Tema border, Kasoa straddles Accra/Central, Ashaiman straddles Tema).

Return ONLY this JSON:
{
  "matchKind": "...",
  "matchedZoneId": "...",
  "subAreaName": "...",
  "broadArea": "...",
  "ambiguousZoneIds": ["..."],
  "confidence": "high" | "medium" | "low",
  "reasoning": "brief explanation"
}`;

  const outcome = await callGeminiResilient({
    prompt,
    schema: ZONE_RESOLVE_SCHEMA,
    temperature: 0.1,
    maxOutputTokens: 250,
    kind: 'delivery_zone',
    apiKey,
  });

  if (!outcome.ok) {
    throw new Error(outcome.errorType);
  }

  const parsed = JSON.parse(outcome.text);
  return parsed as GeminiZoneResult;
}

// ─────────────────────────────────────────────────────────────────────────
// Interpret Gemini's response → DeliveryResolveResult shape
// ─────────────────────────────────────────────────────────────────────────

function interpretGeminiResult(
  parsed: GeminiZoneResult,
  customerText: string,
  zones: DeliveryZoneV2[],
  deterministicFallback: DeliveryResolveResult,
): DeliveryResolveResult {
  const matchKind = parsed.matchKind || 'unclear';

  // exact / sub_area → single match
  if (matchKind === 'exact' || matchKind === 'sub_area') {
    if (!parsed.matchedZoneId) {
      return {
        ...deterministicFallback,
        reason: `gemini_${matchKind}_missing_zone_id`,
      };
    }
    const zone = zones.find((z) => z.id === parsed.matchedZoneId);
    if (!zone) {
      // Gemini hallucinated a zone ID — fall back
      return {
        ...deterministicFallback,
        reason: `gemini_${matchKind}_unknown_zone_id:${parsed.matchedZoneId}`,
      };
    }
    return {
      status: 'single_match',
      confidence: parsed.confidence === 'high' ? 0.92 : parsed.confidence === 'medium' ? 0.78 : 0.6,
      zone,
      zones: [zone],
      reason:
        matchKind === 'sub_area'
          ? `gemini_sub_area:${(parsed.subAreaName || customerText).slice(0, 30)}_in_${zone.label}`
          : `gemini_exact:${parsed.reasoning?.slice(0, 60) || 'matched'}`,
    };
  }

  // broad_ambiguous → multiple matches
  if (matchKind === 'broad_ambiguous') {
    const ambiguousIds = parsed.ambiguousZoneIds || [];
    const matchedZones = ambiguousIds
      .map((id) => zones.find((z) => z.id === id))
      .filter((z): z is DeliveryZoneV2 => z !== undefined);

    if (matchedZones.length === 0) {
      // Gemini said broad but didn't return valid IDs — fall back
      return {
        ...deterministicFallback,
        reason: `gemini_broad_no_valid_zones`,
      };
    }
    if (matchedZones.length === 1) {
      // Only one zone really matches — treat as single
      return {
        status: 'single_match',
        confidence: 0.75,
        zone: matchedZones[0],
        zones: matchedZones,
        reason: `gemini_broad_resolved_single:${matchedZones[0].label}`,
      };
    }
    return {
      status: 'multiple_matches',
      confidence: 0.7,
      zones: matchedZones.slice(0, 5),
      reason: `gemini_broad_ambiguous:${(parsed.broadArea || customerText).slice(0, 30)}`,
    };
  }

  // out_of_coverage / unclear → return deterministic no_match (handler
  // will show the available zones list, which is correct UX)
  return {
    ...deterministicFallback,
    reason: `gemini_${matchKind}:${parsed.reasoning?.slice(0, 60) || 'no_match'}`,
  };
}
