import type { FactPacket } from './factPacket';
import type { InformationHandlerOutput } from '../handlers/handleInformationQuestion';
import type { TurnContext } from '../types';
import type { QuestionIntent } from '../knowledge/types';

/**
 * Translates an InformationHandlerOutput (deterministic answer + telemetry)
 * into a strict FactPacket the composer can speak from.
 *
 * Rule: the composer NEVER sees data the handler hasn't already verified
 * against the database. Everything in the packet is grounded in
 * StoreKnowledge / catalog / orders.
 *
 * Returns null if this question type isn't safe for composer (e.g. cart
 * total — composer should not paraphrase money math).
 */
export function buildFactPacketForInformationQuestion(
  intent: QuestionIntent,
  info: InformationHandlerOutput,
  ctx: TurnContext,
): FactPacket | null {
  const reply = info.reply;
  const referent = info.telemetry.referent;
  const productId = info.telemetry.referentProductId;

  // Composer only handles a small set of safe intents for now.
  const SAFE_INTENTS: QuestionIntent[] = [
    'q_price',
    'q_stock',
    'q_variants',
    'q_refund_policy',
    'q_location',
    'q_hours',
    'q_about_store',
    'q_unknown',
  ];
  if (!SAFE_INTENTS.includes(intent)) return null;

  // For price/stock/variants we need a resolved product to extract facts.
  if (
    (intent === 'q_price' || intent === 'q_stock' || intent === 'q_variants') &&
    referent !== 'product'
  ) {
    // Composer can still phrase a "which product?" clarifier, but we keep
    // that deterministic for now to avoid composer hallucinating.
    return null;
  }

  const product =
    productId && Array.isArray(ctx.products)
      ? ctx.products.find((p) => p.id === productId)
      : null;

  // ── q_price ─────────────────────────────────────────────────────────
  if (intent === 'q_price' && product) {
    const variants = Array.isArray(product.variants) ? product.variants : [];
    const pricedVariants = variants.filter(
      (v: any) => typeof v.price === 'number',
    );
    const prices = pricedVariants.map((v: any) => v.price as number);

    const allSame =
      prices.length > 0 && prices.every((p) => p === prices[0]);

    if (variants.length === 0) {
      // Single-price product
      return {
        intent: 'ask_price',
        allowedAction: 'speak_only',
        facts: {
          productName: product.name,
          price: Number(product.price || 0),
          currency: 'GHS',
          inStock: product.isOutOfStock !== true && product.stock !== 0,
          stockQty:
            typeof (product as any).stockQty === 'number'
              ? (product as any).stockQty
              : null,
        },
        nextStep: 'ask if they want to add to cart and how many',
        forbiddenClaims: [
          'never invent variants',
          'never invent discount',
          'never promise delivery time',
        ],
        toneHints: ['proactive Ghanaian sales assistant', 'brief', 'friendly'],
      };
    }

    if (allSame) {
      // Variants exist but all same price
      return {
        intent: 'ask_price',
        allowedAction: 'speak_only',
        facts: {
          productName: product.name,
          price: prices[0],
          currency: 'GHS',
          totalVariants: variants.length,
          variants: variants.slice(0, 5).map((v: any) => ({
            name: String(v.name || ''),
            price: typeof v.price === 'number' ? v.price : undefined,
            inStock: v.isOutOfStock !== true && v.stock !== 0,
          })),
          variantPriceSpread: 'all_same',
        },
        nextStep:
          variants.length > 5
            ? 'mention there are more sizes and ask which one they want'
            : 'ask which option they want',
        forbiddenClaims: [
          'never invent additional variants',
          'never invent prices',
        ],
        toneHints: ['proactive', 'brief', 'Ghanaian English'],
      };
    }

    // Mixed-price variants
    return {
      intent: 'ask_price',
      allowedAction: 'speak_only',
      facts: {
        productName: product.name,
        currency: 'GHS',
        totalVariants: variants.length,
        variants: pricedVariants.slice(0, 5).map((v: any) => ({
          name: String(v.name || ''),
          price: v.price as number,
          inStock: v.isOutOfStock !== true && v.stock !== 0,
        })),
        variantPriceSpread: 'mixed',
      },
      nextStep:
        pricedVariants.length > 5
          ? 'list 3-5 variants with prices, mention more available, ask which one'
          : 'list the variants with prices and ask which one',
      forbiddenClaims: [
        'never invent variant names',
        'never invent prices not in the packet',
      ],
      toneHints: ['proactive', 'brief', 'Ghanaian English'],
    };
  }

  // ── q_stock ─────────────────────────────────────────────────────────
  if (intent === 'q_stock' && product) {
    const variants = Array.isArray(product.variants) ? product.variants : [];
    return {
      intent: 'ask_stock',
      allowedAction: 'speak_only',
      facts: {
        productName: product.name,
        inStock: product.isOutOfStock !== true && product.stock !== 0,
        stockQty: typeof product.stock === 'number' ? product.stock : null,
        totalVariants: variants.length,
        variants: variants.slice(0, 5).map((v: any) => ({
          name: String(v.name || ''),
          inStock: v.isOutOfStock !== true && v.stock !== 0,
        })),
      },
      nextStep:
        variants.length > 0
          ? 'ask which option they want'
          : 'ask how many they want to add',
      forbiddenClaims: [
        'never invent stock numbers',
        'never promise restocking',
      ],
      toneHints: ['confident if in stock', 'brief'],
    };
  }

  // ── q_variants ──────────────────────────────────────────────────────
  if (intent === 'q_variants' && product) {
    const variants = Array.isArray(product.variants) ? product.variants : [];
    if (variants.length === 0) {
      return {
        intent: 'ask_variants',
        allowedAction: 'speak_only',
        facts: {
          productName: product.name,
          totalVariants: 0,
        },
        nextStep: 'tell them it has just one option, ask if they want it',
        forbiddenClaims: ['never invent variants'],
        toneHints: ['brief', 'friendly'],
      };
    }
    return {
      intent: 'ask_variants',
      allowedAction: 'speak_only',
      facts: {
        productName: product.name,
        totalVariants: variants.length,
        variants: variants.slice(0, 5).map((v: any) => ({
          name: String(v.name || ''),
          price: typeof v.price === 'number' ? v.price : undefined,
          inStock: v.isOutOfStock !== true && v.stock !== 0,
        })),
      },
      nextStep:
        variants.length > 5
          ? 'list 5 options, mention more available, ask which one'
          : 'list options and ask which one',
      forbiddenClaims: [
        'never invent variant names',
        'never invent prices',
      ],
      toneHints: ['proactive', 'brief'],
    };
  }

  // For other safe intents (refund, location, hours, about, unknown) we
  // pass through the deterministic answerText as the primary fact and
  // let composer add tone. This prevents composer from speaking facts
  // it didn't see.
  return {
    intent: 'unknown_message',
    allowedAction: 'speak_only',
    facts: {
      // Preserve the verified answer text inside facts so composer can
      // paraphrase but cannot invent.
      catalogSummary: reply.answerText,
    },
    nextStep: 'paraphrase the verified answer naturally; do not add facts',
    forbiddenClaims: [
      'never invent prices',
      'never invent stock',
      'never invent delivery fees',
      'never promise refund timelines',
    ],
    toneHints: ['brief', 'helpful', 'Ghanaian English'],
  };
}