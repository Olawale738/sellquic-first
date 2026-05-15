import { detectsClearCartIntent } from './cartUpdateVocab';
import { extractQuantity } from './extractQuantity';

export type CartUpdateIntent =
  | {
      type: 'none';
    }
  | {
      type: 'show_cart';
    }
  | {
      type: 'clear_cart';
    }
  | {
      type: 'remove_item';
      productQuery?: string;
      ordinalIndex?: number;
    }
  | {
      type: 'set_quantity';
      quantity: number;
      productQuery?: string;
      ordinalIndex?: number;
    }
  | {
      type: 'adjust_quantity';
      delta: number;
      productQuery?: string;
      ordinalIndex?: number;
    };

type TargetableCartIntent = Exclude<
  CartUpdateIntent,
  { type: 'none' } | { type: 'show_cart' } | { type: 'clear_cart' }
>;

const ORDINAL_WORDS: Record<string, number> = {
  first: 0,
  '1st': 0,
  one: 0,
  second: 1,
  '2nd': 1,
  two: 1,
  third: 2,
  '3rd': 2,
  three: 2,
  fourth: 3,
  '4th': 3,
  four: 3,
  fifth: 4,
  '5th': 4,
  five: 4,
  sixth: 5,
  '6th': 5,
  six: 5,
  seventh: 6,
  '7th': 6,
  seven: 6,
  eighth: 7,
  '8th': 7,
  eight: 7,
  ninth: 8,
  '9th': 8,
  nine: 8,
  tenth: 9,
  '10th': 9,
  ten: 9,
};

function normalizeText(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9’'\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractOrdinalIndex(text: string): number | undefined {
  const value = normalizeText(text);

  for (const [word, index] of Object.entries(ORDINAL_WORDS)) {
    const re = new RegExp(`\\b${word}\\b`, 'i');

    if (re.test(value)) {
      return index;
    }
  }

  const numericMatch = value.match(/\b(?:item\s*)?(\d+)\b/);

  if (numericMatch) {
    const n = Number(numericMatch[1]);

    if (Number.isFinite(n) && n >= 1 && n <= 50) {
      return n - 1;
    }
  }

  return undefined;
}

function cleanProductQuery(text: string): string | undefined {
  const cleaned = normalizeText(text)
    .replace(
      /\b(remove|delete|take out|take off|clear|make|change|set|update|increase|decrease|reduce|add|one more|another one|more|less|quantity|qty|item|number|to|it|the|my|cart|order|please|pls|ok|okay)\b/g,
      ' '
    )
    .replace(/\b\d+\b/g, ' ')
    .replace(/\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|one|two|three|four|five|six|seven|eight|nine|ten)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned.length >= 2 ? cleaned : undefined;
}

function withTarget<T extends TargetableCartIntent>(
  intent: T,
  message: string
): T {
  const ordinalIndex = extractOrdinalIndex(message);
  const productQuery = cleanProductQuery(message);

  return {
    ...intent,
    ...(typeof ordinalIndex === 'number' ? { ordinalIndex } : {}),
    ...(productQuery ? { productQuery } : {}),
  };
}

function isShowCartIntent(value: string): boolean {
  return (
    /\b(show|view|see|check|what'?s|what is|list)\b.*\b(cart|order|items)\b/i.test(
      value
    ) ||
    /\b(what have i ordered|what is in my cart|what's in my cart|cart summary|my cart)\b/i.test(
      value
    )
  );
}

function isRemoveItemIntent(value: string): boolean {
  return /\b(remove|delete|take out|take off)\b/i.test(value);
}

function isSetQuantityIntent(value: string): boolean {
  return /\b(make it|change it to|set it to|update it to|make|change|set|update)\b/i.test(
    value
  );
}

function isAddOneMoreIntent(value: string): boolean {
  return /\b(add one more|one more|add another one|another one|increase by one)\b/i.test(
    value
  );
}

function isReduceOneIntent(value: string): boolean {
  return /\b(remove one|take one out|one less|reduce by one|decrease by one)\b/i.test(
    value
  );
}

export function extractCartUpdateIntent(message: string): CartUpdateIntent {
  const value = normalizeText(message);

  if (!value) {
    return { type: 'none' };
  }

  if (detectsClearCartIntent(value)) {
    return { type: 'clear_cart' };
  }

  if (isShowCartIntent(value)) {
    return { type: 'show_cart' };
  }

  if (isRemoveItemIntent(value)) {
    return withTarget(
      {
        type: 'remove_item',
      },
      value
    );
  }

  if (isAddOneMoreIntent(value)) {
    return withTarget(
      {
        type: 'adjust_quantity',
        delta: 1,
      },
      value
    );
  }

  if (isReduceOneIntent(value)) {
    return withTarget(
      {
        type: 'adjust_quantity',
        delta: -1,
      },
      value
    );
  }

  if (isSetQuantityIntent(value)) {
    const quantity = extractQuantity(value);

    if (quantity && quantity > 0) {
      return withTarget(
        {
          type: 'set_quantity',
          quantity,
        },
        value
      );
    }
  }

  return { type: 'none' };
}