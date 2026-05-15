// src/ai/utils/extractQuantity.ts
export function extractQuantity(text: string): number {
  const numMap: Record<string, number> = { 
    one: 1, two: 2, three: 3, four: 4, five: 5, 
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10 
  };
  const lower = text.toLowerCase();
  for (const [word, val] of Object.entries(numMap)) {
    if (new RegExp(`\\b${word}\\b`).test(lower)) return val;
  }
  const match = text.match(/\b(\d+)\b/);
  if (match) return Math.max(1, parseInt(match[1], 10));
  return 1;
}
