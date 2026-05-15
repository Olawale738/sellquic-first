/**
 * Attribute lexicon for product search scoring.
 *
 * This file is DATA, not logic. Add words here whenever vendors find that
 * a customer-facing attribute term isn't being recognized by search.
 *
 * Design rules:
 *   - All entries lowercase. Tokens compared after normalization.
 *   - Multi-word phrases not supported here — those need scorer changes.
 *     Use single tokens only.
 *   - English / Ghanaian-context for now. Localize when pan-African.
 *   - Keep lists tight. Adding 50 fashion words doesn't help if vendors
 *     don't actually populate them in product data.
 */

export const COLORS: ReadonlySet<string> = new Set([
    'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink',
    'black', 'white', 'grey', 'gray', 'brown', 'beige', 'cream',
    'navy', 'maroon', 'gold', 'silver', 'bronze', 'multicolor',
    'tan', 'khaki', 'olive', 'turquoise', 'teal', 'magenta',
    'burgundy', 'wine', 'ivory', 'nude',
  ]);
  
  export const OCCASIONS: ReadonlySet<string> = new Set([
    'wedding', 'weddings', 'graduation', 'graduations',
    'church', 'service', 'sunday',
    'party', 'parties', 'birthday',
    'office', 'work', 'professional', 'corporate', 'meeting',
    'casual', 'everyday', 'daily',
    'formal', 'evening',
    'school', 'gym', 'workout', 'sport', 'sports',
    'beach', 'travel', 'travelling',
    'home', 'lounge',
    'naming', 'engagement', 'funeral',
  ]);
  
  export const STYLES: ReadonlySet<string> = new Set([
    'straight', 'flared', 'fitted', 'loose', 'slim',
    'oversized', 'classic', 'modern', 'vintage', 'retro',
    'sporty', 'elegant', 'chic', 'smart', 'trendy',
    'short', 'long', 'midi', 'mini', 'maxi',
    'sleeveless', 'strapless', 'crop', 'bodycon',
    'jumbo', 'big', 'small', 'large', 'medium',
  ]);
  
  export const USE_CASES: ReadonlySet<string> = new Set([
    // skincare / beauty needs
    'acne', 'oily', 'dry', 'sensitive', 'pigmentation', 'dark', 'spots',
    'brightening', 'whitening', 'lightening', 'moisturizing', 'hydrating',
    'anti-aging', 'wrinkle', 'wrinkles', 'firming',
  
    // health / body
    'weight', 'fat', 'muscle', 'fitness',
  
    // tech / device use
    'gaming', 'business', 'student', 'students', 'developer',
    'editing', 'design', 'streaming',
  
    // baby / kids
    'baby', 'newborn', 'toddler', 'infant', 'kids',
  
    // fashion fit/use
    'maternity', 'plus-size', 'plus',
  ]);
  
  /**
   * Combined lookup. Returns the lexicon category a token belongs to,
   * or null if it isn't a known attribute term.
   *
   * Used by the scorer to apply an attribute bonus when:
   *   1. The query token is in the lexicon, AND
   *   2. The same token is matched against a product field.
   *
   * Both conditions matter — having "red" in the query alone means nothing
   * if no product actually has "red" in its name/description/tags.
   */
  export type AttributeKind = 'color' | 'occasion' | 'style' | 'use_case';
  
  export function lookupAttribute(token: string): AttributeKind | null {
    const t = token.toLowerCase();
    if (COLORS.has(t)) return 'color';
    if (OCCASIONS.has(t)) return 'occasion';
    if (STYLES.has(t)) return 'style';
    if (USE_CASES.has(t)) return 'use_case';
    return null;
  }