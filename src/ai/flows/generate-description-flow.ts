'use server';
/**
 * @fileOverview Generate product descriptions + structured search metadata
 * using Google Generative AI.
 *
 * Returns:
 *   description       — polished product description (existing behavior)
 *   tags              — short customer-searchable terms (3–8)
 *   searchAliases     — alt phrases customers may type (3–8)
 *   useCases?         — when supported by draft/name
 *   colors?           — when supported by draft/name
 *   occasions?        — when supported by draft/name
 *   categorySuggestion? — single category guess, only when confident
 *
 * Vendors approve suggestions in the UI before they're saved (PR2).
 * The output is the producer side only — consumers ignore everything but
 * `description` until PR2 ships.
 *
 * Hallucination guards in the prompt:
 *   - Only suggest attributes supported by the draft or product name.
 *   - When unsure, return fewer items rather than fabricate.
 *   - No medical claims, guaranteed outcomes, or commerce facts
 *     (price/stock/delivery/discount).
 */
import { genAI } from '@/ai/genkit';
import { z } from 'zod';
import { db } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

const GenerateDescriptionInputSchema = z.object({
  userId: z.string(),
  name: z.string().describe('The name of the product.'),
  price: z.string().describe('The price of the product.'),
  stock: z.string().describe('The available stock quantity.'),
  draftDescription: z.string().describe('A user-provided draft description or keywords.'),
});

type GenerateDescriptionInput = z.infer<typeof GenerateDescriptionInputSchema>;

/**
 * Output type. `description` is always present (backward-compatible with
 * the previous shape). All other fields are best-effort and may be empty
 * arrays / undefined.
 */
export type GenerateDescriptionOutput = {
  description: string;
  tags: string[];
  searchAliases: string[];
  useCases?: string[];
  colors?: string[];
  occasions?: string[];
  categorySuggestion?: string;
};

// ── Output sanitization ──────────────────────────────────────────────────

/**
 * Maximum item counts per array. The model will be asked to stay under
 * these; we also enforce them defensively here so a chatty model can't
 * dump 30 tags into the form.
 */
const MAX_TAGS = 8;
const MAX_ALIASES = 8;
const MAX_PER_ATTRIBUTE = 6;

/**
 * Filler/marketing words we never want as tags. Customers don't search
 * for "premium" or "amazing" — vendors who tag with these pollute search.
 */
const TAG_BLOCKLIST = new Set([
  'new', 'hot', 'best', 'top', 'amazing', 'premium', 'quality', 'great',
  'awesome', 'beautiful', 'nice', 'cool', 'good', 'wow', 'must-have',
  'trending', 'viral', 'sale', 'discount', 'cheap', 'affordable',
  'product', 'item', 'product-listing',
]);

function cleanString(value: unknown): string {
  return String(value ?? '').trim();
}

function cleanStringList(
  raw: unknown,
  max: number,
  blocklist?: ReadonlySet<string>,
): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const cleaned = cleanString(item).toLowerCase();
    // Length guard: keep meaningful tokens, drop empties and runaways.
    if (cleaned.length < 2 || cleaned.length > 40) continue;
    if (blocklist?.has(cleaned)) continue;
    if (seen.has(cleaned)) continue;
    seen.add(cleaned);
    out.push(cleaned);
    if (out.length >= max) break;
  }
  return out;
}

function cleanCategory(raw: unknown): string | undefined {
  const s = cleanString(raw);
  if (!s) return undefined;
  if (s.length > 40) return undefined;
  return s;
}

// ── Prompt ───────────────────────────────────────────────────────────────

function buildPrompt(input: GenerateDescriptionInput): string {
  return `You are an expert e-commerce copywriter from Ghana, known for writing detailed, natural, and persuasive product descriptions that don't sound AI-generated.

Your task has TWO parts:

PART 1 — Polish the product description.
Take the user's draft and rewrite it into a compelling, slightly more detailed description of 4–6 sentences. Identify any product attributes mentioned in the draft (size, color, material, fabric, fit, scent, etc.) and weave them into the description. Use the draft as the primary source — make it better, do not invent facts.

TONE FOR DESCRIPTION:
- Natural, conversational, trustworthy.
- AVOID cliché marketing words: "discover", "unleash", "elevate", "experience", "journey", "premium", "amazing", "luxurious", "ultimate".
- Speak directly to the customer as if face-to-face.
- No medical claims. No guaranteed outcomes ("cures acne", "removes wrinkles permanently").
- No commerce claims about price, stock, delivery, or discount.

PART 2 — Suggest search metadata to help customers find this product.
Output structured fields for the vendor to review:

  - tags: 3–8 short, customer-searchable terms. Lowercase. Single or two-word.
    Examples: "red", "wedding", "lace", "size 10", "cotton".
    DO NOT use marketing fluff: "new", "hot", "best", "premium", "quality", "amazing", "must-have", "trending", "sale".
    DO NOT invent attributes that aren't in the draft or product name.

  - searchAliases: 3–8 alternative phrases customers may type when searching.
    Examples for "Red Lace Wedding Gown": ["red gown", "wedding dress", "lace gown", "bridal dress"].
    These are search shortcuts, not synonyms in general — only what real customers searching FOR THIS product would type.

  - useCases: up to 6 (optional). Specific situations the product is for.
    Examples: "graduation", "office wear", "school uniform", "gym".
    Only include when the draft or name strongly supports it.

  - colors: up to 6 (optional). Lowercase color names.
    Only include colors mentioned or visually obvious from the name.

  - occasions: up to 6 (optional). Specific events.
    Examples: "wedding", "birthday party", "church service".
    Only include when supported.

  - categorySuggestion: a single category name (optional). Only suggest
    if you're confident based on the product name and draft. Examples:
    "Dresses", "Bags", "Skincare", "Laptops". Use null/omit if unsure.

CRITICAL RULES:
1. NEVER fabricate attributes. If the draft says "blue dress", do NOT add "red" because red dresses are common.
2. When unsure, return FEWER items. An empty array is better than a wrong one.
3. Each tag/alias must be supported by either the product name or the draft description.
4. No medical advice, no health claims, no diagnosis.
5. No commerce facts (price, stock, delivery time, discount %).

User's Draft: "${input.draftDescription}"

Product Details (for context):
- Name: ${input.name}
- Price: GHS ${input.price}
- Stock: ${input.stock}

Return your response as a JSON object with this exact shape (omit optional fields if you have no confident suggestion):

{
  "description": "Polished 4–6 sentence description here.",
  "tags": ["tag1", "tag2", "tag3"],
  "searchAliases": ["alt phrase 1", "alt phrase 2"],
  "useCases": ["use case 1"],
  "colors": ["color1"],
  "occasions": ["occasion1"],
  "categorySuggestion": "Category Name"
}`;
}

// ── Main ─────────────────────────────────────────────────────────────────

export async function generateDescription(
  input: GenerateDescriptionInput,
): Promise<GenerateDescriptionOutput> {
  try {
    // ── SUBSCRIPTION CHECK (unchanged) ─────────────────────────────────
    const userSnap = await db.collection('users').doc(input.userId).get();
    if (!userSnap.exists) throw new Error('User not found.');

    const sub = userSnap.data()?.subscription;
    let allowed = false;

    if (sub?.status === 'active') {
      allowed = true;
    } else if (sub?.status === 'trial' && sub?.trialEndsAt) {
      const trialEnd = sub.trialEndsAt instanceof Timestamp
        ? sub.trialEndsAt.toDate()
        : new Date(sub.trialEndsAt);
      if (trialEnd > new Date()) allowed = true;
    }

    if (!allowed) {
      throw new Error('Please upgrade your plan to use AI features.');
    }
    // ──────────────────────────────────────────────────────────────────

    const prompt = buildPrompt(input);

    // ── GEMINI WITH FLASH FALLBACK (unchanged) ────────────────────────
    const getModel = (modelName: string) =>
      genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { responseMimeType: 'application/json' } as any,
      });

    let result;
    try {
      result = await getModel('gemini-2.5-pro').generateContent(prompt);
    } catch (err: any) {
      const is503 =
        err?.status === 503 ||
        String(err?.message || '').includes('503') ||
        String(err?.message || '').includes('high demand');
      if (is503) {
        console.warn('[generateDescription] Pro overloaded, falling back to Flash');
        result = await getModel('gemini-2.5-flash').generateContent(prompt);
      } else {
        throw err;
      }
    }
    // ──────────────────────────────────────────────────────────────────

    const responseText = result.response.text();
    if (!responseText) throw new Error('AI returned an empty response.');

    let parsed: any;
    try {
      const clean = responseText.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      throw new Error('Failed to parse AI response as JSON.');
    }

    // Description is required. If missing, fall back to draft so the
    // vendor's existing draft isn't lost — but treat metadata fields as
    // empty so we don't surface garbage.
    const description = cleanString(parsed?.description) || cleanString(input.draftDescription);
    if (!description) throw new Error('Failed to parse description from AI response.');

    const tags = cleanStringList(parsed?.tags, MAX_TAGS, TAG_BLOCKLIST);
    const searchAliases = cleanStringList(parsed?.searchAliases, MAX_ALIASES);
    const useCases = cleanStringList(parsed?.useCases, MAX_PER_ATTRIBUTE);
    const colors = cleanStringList(parsed?.colors, MAX_PER_ATTRIBUTE);
    const occasions = cleanStringList(parsed?.occasions, MAX_PER_ATTRIBUTE);
    const categorySuggestion = cleanCategory(parsed?.categorySuggestion);

    return {
      description,
      tags,
      searchAliases,
      ...(useCases.length ? { useCases } : {}),
      ...(colors.length ? { colors } : {}),
      ...(occasions.length ? { occasions } : {}),
      ...(categorySuggestion ? { categorySuggestion } : {}),
    };
  } catch (error) {
    console.error('Description generation error:', error);
    throw new Error(
      error instanceof Error ? error.message : 'Failed to generate description.',
    );
  }
}