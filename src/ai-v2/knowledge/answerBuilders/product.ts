import type {
  InformationReply,
  KnowledgeTurnContext,
  Referent,
  StoreKnowledge,
} from '../types';
import { buildResumePrompt, decideResume } from '../../presentation/buildResumePrompt';

// ─────────────────────────────────────────────────────────────────────────────
// q_price
// ─────────────────────────────────────────────────────────────────────────────

export function buildPriceAnswer(
  ctx: KnowledgeTurnContext,
  _knowledge: StoreKnowledge,
  referent: Referent
): InformationReply {
  if (referent.kind !== 'product') {
    return askWhichProduct(ctx, referent, 'q_price');
  }

  const p = referent.product;

  /**
   * Important:
   * Do not quote the parent product price when the product has variants.
   * For many stores, parent price can be a placeholder or "from" price,
   * while variants have the real customer-facing prices.
   */
  const variants = p.variants ?? [];

  if (variants.length > 0) {
    const pricedVariants = variants.filter((v) => typeof v.price === 'number');

    if (pricedVariants.length > 0) {
      const prices = pricedVariants
        .map((v) => v.price as number)
        .filter((n) => Number.isFinite(n));

      const allSame =
        prices.length > 0 && prices.every((price) => price === prices[0]);

      if (allSame) {
        const text = `${p.name} is ${formatMoney(prices[0], p.currency)} please.`;

        return withResume(
          'q_price',
          referent,
          ctx,
          text,
          `product.${p.id}.variants.price`
        );
      }

      const breakdown = pricedVariants
        .slice(0, 8)
        .map((v) => `${v.name} — ${formatMoney(v.price as number, p.currency)}`)
        .join(', ');

      return {
        answerText: `${p.name} price depends on the option please. ${breakdown}.`,
        answerSource: `product.${p.id}.variants`,
        resume: {
          kind: 'pivot',
          prompt: 'Which option would you like please?',
        },
        diagnostics: { referentKind: 'product' },
      };
    }

    return {
      answerText: `${p.name} price depends on the option please.`,
      answerSource: `product.${p.id}.variants`,
      resume: {
        kind: 'pivot',
        prompt: 'Which option would you like please?',
      },
      diagnostics: { referentKind: 'product' },
    };
  }

  const text = `${p.name} is ${formatMoney(p.price, p.currency)} please.`;
  return withResume('q_price', referent, ctx, text, `product.${p.id}.price`);
}

// ─────────────────────────────────────────────────────────────────────────────
// q_stock
// ─────────────────────────────────────────────────────────────────────────────

export function buildStockAnswer(
  ctx: KnowledgeTurnContext,
  _knowledge: StoreKnowledge,
  referent: Referent
): InformationReply {
  if (referent.kind !== 'product') {
    return askWhichProduct(ctx, referent, 'q_stock');
  }

  const p = referent.product;
  const variants = p.variants ?? [];

  /**
   * Variant-aware stock:
   * If a product has variants, avoid saying the whole product is out of stock
   * just because the parent product looks unavailable. Some stores keep stock
   * on variants only.
   */
  if (variants.length > 0) {
    const availableVariants = variants.filter((v) => v.inStock !== false);

    if (availableVariants.length === 0) {
      return {
        answerText: `Sorry please, ${p.name} is currently out of stock.`,
        answerSource: `product.${p.id}.variants.inStock`,
        resume: {
          kind: 'pivot',
          prompt: 'Would you like me to suggest something similar?',
        },
        diagnostics: { referentKind: 'product' },
      };
    }

    const list = availableVariants
      .slice(0, 8)
      .map((v) => formatVariantNameAndPrice(v, p.currency))
      .join(', ');

    return {
      answerText: `Yes please, ${p.name} is available. We have ${list}.`,
      answerSource: `product.${p.id}.variants.inStock`,
      resume: {
        kind: 'pivot',
        prompt: 'Which option would you like please?',
      },
      diagnostics: { referentKind: 'product' },
    };
  }

  if (!p.inStock) {
    return {
      answerText: `Sorry please, ${p.name} is currently out of stock.`,
      answerSource: `product.${p.id}.inStock`,
      resume: {
        kind: 'pivot',
        prompt: 'Would you like me to suggest something similar?',
      },
      diagnostics: { referentKind: 'product' },
    };
  }

  const qtyHint =
    p.stockQty != null && p.stockQty > 0 ? ` (${p.stockQty} available)` : '';

  const text = `Yes please, ${p.name} is in stock${qtyHint}.`;
  return withResume('q_stock', referent, ctx, text, `product.${p.id}.inStock`);
}

// ─────────────────────────────────────────────────────────────────────────────
// q_variants
// ─────────────────────────────────────────────────────────────────────────────

export function buildVariantsAnswer(
  ctx: KnowledgeTurnContext,
  _knowledge: StoreKnowledge,
  referent: Referent
): InformationReply {
  if (referent.kind !== 'product') {
    return askWhichProduct(ctx, referent, 'q_variants');
  }

  const p = referent.product;

  if (!p.variants || p.variants.length === 0) {
    return {
      answerText: `${p.name} doesn't have other options please — it's just the one.`,
      answerSource: `product.${p.id}.variants`,
      resume: resumeOrNone('q_variants', referent, ctx),
      diagnostics: { referentKind: 'product' },
    };
  }

  const list = p.variants
    .slice(0, 8)
    .map((v) => {
      const flag = v.inStock === false ? ' (out of stock)' : '';
      return `${formatVariantNameAndPrice(v, p.currency)}${flag}`;
    })
    .join(', ');

  const text = `${p.name} comes in: ${list}.`;
  return withResume('q_variants', referent, ctx, text, `product.${p.id}.variants`);
}

// ─────────────────────────────────────────────────────────────────────────────
// shared helpers
// ─────────────────────────────────────────────────────────────────────────────

function askWhichProduct(
  _ctx: KnowledgeTurnContext,
  referent: Referent,
  intent: 'q_price' | 'q_stock' | 'q_variants'
): InformationReply {
  const prompt =
    intent === 'q_price'
      ? 'Which product would you like the price for please?'
      : intent === 'q_stock'
        ? 'Which product would you like me to check please?'
        : 'Which product would you like the options for please?';

  return {
    answerText: prompt,
    answerSource: 'referent.unresolved',
    resume: { kind: 'none' },
    diagnostics: {
      referentKind: referent.kind,
      knowledgeMissing: ['referent.product'],
    },
  };
}

function withResume(
  intent: 'q_price' | 'q_stock' | 'q_variants',
  referent: Referent,
  ctx: KnowledgeTurnContext,
  answerText: string,
  answerSource: string
): InformationReply {
  return {
    answerText,
    answerSource,
    resume: resumeOrNone(intent, referent, ctx),
    diagnostics: { referentKind: referent.kind },
  };
}

function resumeOrNone(
  intent: 'q_price' | 'q_stock' | 'q_variants',
  referent: Referent,
  ctx: KnowledgeTurnContext
): InformationReply['resume'] {
  const decision = decideResume(intent, referent, ctx.commerceState);

  if (decision === 'resume') {
    const prompt = buildResumePrompt(ctx.commerceState);
    if (prompt) {
      return {
        kind: 'state_prompt',
        state: ctx.commerceState,
        prompt,
      };
    }
  }

  return { kind: 'none' };
}

function formatVariantNameAndPrice(
  variant: { name: string; price?: number | null },
  currency: string
): string {
  if (typeof variant.price === 'number' && Number.isFinite(variant.price)) {
    return `${variant.name} — ${formatMoney(variant.price, currency)}`;
  }

  return variant.name;
}

export function formatMoney(amount: number, currency: string): string {
  return `${currency} ${amount.toFixed(2)}`;
}