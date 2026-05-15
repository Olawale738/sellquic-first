/**
 * Canonical phone form for matching.
 *
 * Normalizes any Ghana phone variant to a 10-digit local form starting
 * with 0. Used for order lookup so a customer typing "0507473998" matches
 * a stored "+233507473998".
 *
 * Returns null if the input is not a recognizable Ghana phone.
 */
export function normalizePhoneForLookup(value: string | null | undefined): string | null {
    if (!value) return null;
    const cleaned = String(value).replace(/[\s\-().+]/g, '');
  
    // International "233..."
    if (/^233[25]\d{8}$/.test(cleaned)) {
      return '0' + cleaned.slice(3);
    }
    // Local "0..." 10 digits
    if (/^0[25]\d{8}$/.test(cleaned)) {
      return cleaned;
    }
    // Last 9 digits with leading 2 or 5 (e.g. customer types just "507473998")
    if (/^[25]\d{8}$/.test(cleaned)) {
      return '0' + cleaned;
    }
    return null;
  }