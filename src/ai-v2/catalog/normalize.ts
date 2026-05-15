export function normalizeText(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/([a-z])['’‘`]s\b/g, '$1')
    .replace(/[’‘`]/g, "'")
    .replace(/'/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(' ')
    .map((x) => x.trim())
    .filter(Boolean);
}

export function normalizeProductName(value: string): string {
  return normalizeText(value)
    .replace(/\b(set|piece|pcs|pack)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}