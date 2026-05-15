import type {
    InformationReply,
    KnowledgeTurnContext,
    StoreKnowledge,
  } from '../types';
  import { buildResumePrompt, decideResume } from '../../presentation/buildResumePrompt';
  
  // ─────────────────────────────────────────────────────────────────────────────
  // q_payment_methods
  // ─────────────────────────────────────────────────────────────────────────────
  
  export function buildPaymentMethodsAnswer(
    ctx: KnowledgeTurnContext,
    knowledge: StoreKnowledge,
  ): InformationReply {
    const methods: string[] = [];
    if (knowledge.payment.momo.enabled) methods.push('Mobile Money');
    if (knowledge.payment.paystack) methods.push('Card (Paystack)');
    if (knowledge.payment.bank) methods.push('Bank transfer');
    if (knowledge.payment.cod) methods.push('Cash on delivery');
  
    if (methods.length === 0) {
      // Nothing configured. Don't pretend.
      if (knowledge.payment.info) {
        return {
          answerText: knowledge.payment.info,
          answerSource: 'payment.info',
          resume: resumeIfActive(ctx, 'q_payment_methods'),
          diagnostics: { referentKind: 'none' },
        };
      }
      return {
        answerText:
          "I don't have payment options listed here please. I can ask the seller to confirm.",
        answerSource: 'payment',
        resume: { kind: 'none' },
        diagnostics: {
          referentKind: 'none',
          knowledgeMissing: ['payment.cod', 'payment.momo', 'payment.paystack', 'payment.bank'],
        },
      };
    }
  
    const text = `We accept ${formatList(methods)} please.`;
    return {
      answerText: text,
      answerSource: 'payment',
      resume: resumeIfActive(ctx, 'q_payment_methods'),
      diagnostics: { referentKind: 'none' },
    };
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // q_cod
  // ─────────────────────────────────────────────────────────────────────────────
  
  export function buildCodAnswer(
    ctx: KnowledgeTurnContext,
    knowledge: StoreKnowledge,
  ): InformationReply {
    const text = knowledge.payment.cod
      ? 'Yes please, cash on delivery is available.'
      : 'Sorry please, cash on delivery is not available for this store.';
  
    return {
      answerText: text,
      answerSource: 'payment.cod',
      resume: resumeIfActive(ctx, 'q_cod'),
      diagnostics: { referentKind: 'none' },
    };
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // helpers
  // ─────────────────────────────────────────────────────────────────────────────
  
  function resumeIfActive(
    ctx: KnowledgeTurnContext,
    intent: 'q_payment_methods' | 'q_cod',
  ): InformationReply['resume'] {
    const decision = decideResume(intent, { kind: 'none' }, ctx.commerceState);
    if (decision === 'resume') {
      const prompt = buildResumePrompt(ctx.commerceState);
      if (prompt) return { kind: 'state_prompt', state: ctx.commerceState, prompt };
    }
    return { kind: 'none' };
  }
  
  function formatList(items: string[]): string {
    if (items.length === 0) return '';
    if (items.length === 1) return items[0];
    if (items.length === 2) return `${items[0]} and ${items[1]}`;
    return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
  }