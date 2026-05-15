/**
 * Semantic value normalizers and parsers for slot capture.
 * Single source of truth for cleaning what customers say into
 * canonical values handlers can store.
 */

// ─── NAME ───────────────────────────────────────────────────────────

const NAME_LEADING_FILLERS: RegExp[] = [
    /^i\s+(am|said\s+am|said\s+i'?m|am\s+called|am\s+also\s+known\s+as)\s+/i,
    /^i'?m\s+/i,
    /^my\s+(name\s+is|name'?s|full\s+name\s+is)\s+/i,
    /^the\s+name\s+is\s+/i,
    /^(they|people)\s+call\s+me\s+/i,
    /^you\s+can\s+call\s+me\s+/i,
    /^call\s+me\s+/i,
    /^name'?s?\s+/i,
    /^it'?s\s+/i,
    /^this\s+is\s+/i,
    /^am\s+/i, // pidgin: "am maurice"
    /^na\s+me\s+be\s+/i, // pidgin: "na me be Maurice"
  ];
  
  const NAME_TRAILING_FILLERS: RegExp[] = [
    /\s+(here|please|thanks|thank\s+you|sir|madam|ma|bro|sis|paa|abi)\.?$/i,
  ];
  
  export function normalizeName(raw: string | null | undefined): string | null {
    if (!raw) return null;
    let cleaned = String(raw).trim();
    if (cleaned.length === 0) return null;
    for (const re of NAME_LEADING_FILLERS) cleaned = cleaned.replace(re, '');
    for (const re of NAME_TRAILING_FILLERS) cleaned = cleaned.replace(re, '');
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    if (cleaned.length < 2 || cleaned.length > 80) return null;
    if (/[?]$/.test(cleaned)) return null;
    if (cleaned.split(/\s+/).length > 6) return null;
    return cleaned
      .split(/\s+/)
      .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
      .join(' ');
  }
  
  // ─── ADDRESS ────────────────────────────────────────────────────────
  
  const ADDRESS_LEADING_FILLERS: RegExp[] = [
    /^i\s+(live|stay|am|am\s+staying|reside)\s+(at|in|on|near|around|by)\s+/i,
    /^i'?m\s+(at|in|on|near|around|by)\s+/i,
    /^my\s+(place|house|location|address)\s+is\s+(at|in|on|near|around|by)?\s*/i,
    /^(my|the)\s+address\s+is\s+/i,
    /^(send\s+it|deliver(\s+it)?|bring\s+it)\s+to\s+/i,
    /^(am|i'?m)\s+(in|at|around|near|on)\s+/i,
  ];
  
  export function normalizeAddress(raw: string | null | undefined): string | null {
    if (!raw) return null;
    let cleaned = String(raw).trim();
    if (cleaned.length === 0) return null;
    for (const re of ADDRESS_LEADING_FILLERS) cleaned = cleaned.replace(re, '');
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    if (cleaned.length < 2 || cleaned.length > 200) return null;
    return cleaned;
  }
  
  // ─── VARIANT MATCHING ───────────────────────────────────────────────
  
  /**
   * Normalize text for variant matching. Handles common abbreviation
   * patterns like "3yrs", "3 years", "3year" → all become "3 years".
   */
  function normalizeVariantText(s: string): string {
    return String(s)
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      // Age units: "3yrs" / "3yr" / "3 yrs" / "3 yr" / "3year" → "3 years"
      .replace(/(\d+)\s*(yrs?|years?)\b/g, (_, n) => `${n} years`)
      .replace(/(\d+)\s*(mo|mos|month|months)\b/g, (_, n) => `${n} months`)
      // Size letters: normalize case
      .replace(/\b(xxxl|xxl|xl|l|m|s|xs)\b/gi, (m) => m.toUpperCase());
  }
  
  export type VariantLike = {
    name: string;
    inStock?: boolean;
    id?: string;
    imageUrl?: string;
    price?: number;
  };
  
  export function matchVariantInMessage(
    message: string,
    variants: VariantLike[],
  ): VariantLike | null {
    if (!message || !Array.isArray(variants) || variants.length === 0) return null;
    const text = normalizeVariantText(message);
  
    // Pass 1: full variant name appears in message
    for (const v of variants) {
      const vNorm = normalizeVariantText(v.name);
      if (vNorm.length >= 1 && text.includes(vNorm)) return v;
    }
  
    // Pass 2: numeric tokens — if customer typed "3", match a variant
    // whose normalized name contains "3" (e.g. "3 years"). Only fires
    // when the customer's message is short and number-shaped.
    const customerNumbers: string[] = text.match(/\b\d+\b/g) || [];
    if (customerNumbers.length > 0 && text.replace(/\d+/g, '').trim().length < 20) {
      for (const num of customerNumbers) {
        for (const v of variants) {
          const vNumbers: string[] = normalizeVariantText(v.name).match(/\b\d+\b/g) || [];
        if (vNumbers.includes(num)) return v;
        }
      }
    }
  
    return null;
  }
  
  // ─── QUANTITY PARSING ───────────────────────────────────────────────
  
  const NUMBER_WORDS: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    a: 1, an: 1, single: 1, couple: 2, few: 3,
  };
  
  /**
   * Parse quantity from natural-language messages at AWAITING_QUANTITY.
   * Examples that return 1: "1", "1 set", "add 1", "one", "just 1",
   * "make it 1", "i want 1", "i'll take 1 set".
   * Returns null if no clear quantity is present.
   */
  export function parseQuantityFromMessage(message: string): number | null {
    if (!message) return null;
    const text = message.toLowerCase().trim();
    if (text.length === 0) return null;
  
    // Pattern 1: bare number with optional unit
    let m = text.match(
      /^(\d+)\s*(set|sets|piece|pieces|pcs|pack|packs|item|items|of\s+them)?\s*$/i,
    );
    if (m) {
      const n = parseInt(m[1], 10);
      if (n >= 1 && n <= 999) return n;
    }
  
    // Pattern 2: word number with optional unit
    m = text.match(
      /^(one|two|three|four|five|six|seven|eight|nine|ten|a|an|single|couple|few)\s*(set|sets|piece|pieces|item|items)?\s*$/i,
    );
    if (m) {
      const n = NUMBER_WORDS[m[1].toLowerCase()];
      if (n) return n;
    }
  
    // Pattern 3: "add N" / "make it N" / "i want N" / "give me N" / "i'll take N"
    m = text.match(
      /\b(?:add|make\s+it|just|give\s+me|i\s+want|i'?ll\s+take|i\s+need|let\s+me\s+have|let\s+me\s+get|put|include|order|get\s+me)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b/i,
    );
    if (m) {
      const raw = m[1].toLowerCase();
      const n = /^\d+$/.test(raw) ? parseInt(raw, 10) : NUMBER_WORDS[raw];
      if (n && n >= 1 && n <= 999) return n;
    }
  
    // Pattern 4: "N set(s)" anywhere in a short message
    if (text.length <= 40) {
      m = text.match(/\b(\d+)\s*(set|sets|piece|pieces|pack|packs)\b/i);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n >= 1 && n <= 999) return n;
      }
    }
  
    return null;
  }