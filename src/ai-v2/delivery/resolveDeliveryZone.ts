import type { DeliveryZoneV2 } from '../types';
import { normalizeText, tokenize } from '../catalog/normalize';

export type DeliveryResolveResult = {
  status: 'single_match' | 'multiple_matches' | 'no_match';
  confidence: number;
  zone?: DeliveryZoneV2;
  zones: DeliveryZoneV2[];
  reason: string;
};

const DELIVERY_STOPWORDS = new Set([
  'deliver',
  'delivery',
  'to',
  'at',
  'in',
  'around',
  'near',
  'please',
  'pls',
  'i',
  'am',
  'im',
  'i’m',
  'stay',
  'live',
  'location',
  'area',
]);

function cleanDeliveryQuery(message: string): string {
  return normalizeText(message)
    .replace(/\b(deliver to|delivery to|send to|bring it to|i am at|i am in|i stay at|i stay in|my location is|my area is)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function meaningfulTokens(value: string): string[] {
  return tokenize(value).filter((token) => !DELIVERY_STOPWORDS.has(token));
}

export function resolveDeliveryZone(
  message: string,
  zones: DeliveryZoneV2[]
): DeliveryResolveResult {
  const query = cleanDeliveryQuery(message);

  if (!query) {
    return {
      status: 'no_match',
      confidence: 0,
      zones: [],
      reason: 'empty_delivery_query',
    };
  }

  const normalizedQuery = normalizeText(query);

  const exactMatches = zones.filter((zone) => {
    return normalizeText(zone.label) === normalizedQuery;
  });

  if (exactMatches.length === 1) {
    return {
      status: 'single_match',
      confidence: 1,
      zone: exactMatches[0],
      zones: exactMatches,
      reason: 'exact_delivery_zone_match',
    };
  }

  const containsMatches = zones.filter((zone) => {
    const label = normalizeText(zone.label);
    return label.includes(normalizedQuery) || normalizedQuery.includes(label);
  });

  if (containsMatches.length === 1) {
    return {
      status: 'single_match',
      confidence: 0.9,
      zone: containsMatches[0],
      zones: containsMatches,
      reason: 'delivery_zone_contains_match',
    };
  }

  if (containsMatches.length > 1) {
    return {
      status: 'multiple_matches',
      confidence: 0.72,
      zones: containsMatches.slice(0, 5),
      reason: 'multiple_delivery_zone_contains_matches',
    };
  }

  const queryTokens = meaningfulTokens(query);

  if (!queryTokens.length) {
    return {
      status: 'no_match',
      confidence: 0,
      zones: [],
      reason: 'no_meaningful_delivery_tokens',
    };
  }

  const scored = zones
    .map((zone) => {
      const label = normalizeText(zone.label);
      const score = queryTokens.reduce((sum, token) => {
        return label.includes(token) ? sum + token.length : sum;
      }, 0);

      return { zone, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) {
    return {
      status: 'no_match',
      confidence: 0,
      zones: [],
      reason: 'no_delivery_zone_token_match',
    };
  }

  const topScore = scored[0].score;
  const topMatches = scored
    .filter((item) => item.score === topScore)
    .map((item) => item.zone);

  if (topMatches.length === 1 && topScore >= 4) {
    return {
      status: 'single_match',
      confidence: 0.78,
      zone: topMatches[0],
      zones: topMatches,
      reason: 'strong_delivery_token_match',
    };
  }

  return {
    status: 'multiple_matches',
    confidence: 0.55,
    zones: scored.slice(0, 5).map((item) => item.zone),
    reason: 'ranked_delivery_zone_matches',
  };
}