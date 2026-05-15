import type {
    InformationReply,
    KnowledgeTurnContext,
    Referent,
    StoreKnowledge,
  } from '../types';
  import { buildResumePrompt, decideResume } from '../../presentation/buildResumePrompt';
  import { formatMoney } from './product';
  
  // ─────────────────────────────────────────────────────────────────────────────
  // q_delivery_fee
  // ─────────────────────────────────────────────────────────────────────────────
  
  export function buildDeliveryFeeAnswer(
    ctx: KnowledgeTurnContext,
    knowledge: StoreKnowledge,
    referent: Referent,
  ): InformationReply {
    // 1. Customer named a specific zone different from / without a current selection.
    if (referent.kind === 'delivery_named') {
      const z = referent.zone;
      const text = `Delivery to ${z.name} is ${formatMoney(z.fee, z.currency)} please.`;
  
      // If a different zone is currently selected, pivot — never silently mutate.
      const currentId = ctx.orderSession.selectedDeliveryZoneId ?? null;
      if (currentId && currentId !== z.id) {
        const current = knowledge.delivery.zones.find((dz) => dz.id === currentId);
        const currentName = current ? current.name : 'your current zone';
        return {
          answerText: `${text} (Your current selection is ${currentName}.)`,
          answerSource: `delivery.zones[${z.id}].fee`,
          resume: {
            kind: 'pivot',
            prompt: `Would you like me to change the delivery to ${z.name}?`,
          },
          diagnostics: { referentKind: 'delivery_named' },
        };
      }
  
      // No current selection or same zone: just answer + resume the active flow.
      return withDeliveryResume(ctx, text, `delivery.zones[${z.id}].fee`, referent);
    }
  
    // 2. Current selection.
    if (referent.kind === 'delivery_current' && referent.zone) {
      const z = referent.zone;
      const text = `Delivery to ${z.name} is ${formatMoney(z.fee, z.currency)} please.`;
      return withDeliveryResume(ctx, text, `delivery.zones[${z.id}].fee`, referent);
    }
  
    // 3. No selection, no named zone — list available zones if we have any.
    const zones = knowledge.delivery.zones;
    if (zones.length === 0) {
      return {
        answerText: missingDeliveryNotice(knowledge),
        answerSource: 'delivery.zones',
        resume: { kind: 'none' },
        diagnostics: {
          referentKind: referent.kind,
          knowledgeMissing: ['delivery.zones'],
        },
      };
    }
  
    const list = zones
      .map((z) => `${z.name} (${formatMoney(z.fee, z.currency)})`)
      .join(', ');
  
    return {
      answerText: `Delivery fees please: ${list}.`,
      answerSource: 'delivery.zones',
      resume: { kind: 'pivot', prompt: 'Which zone are you in?' },
      diagnostics: { referentKind: referent.kind },
    };
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // q_delivery_time
  // ─────────────────────────────────────────────────────────────────────────────
  
  export function buildDeliveryTimeAnswer(
    ctx: KnowledgeTurnContext,
    knowledge: StoreKnowledge,
    referent: Referent,
  ): InformationReply {
    // Per-zone ETA if available
    if (referent.kind === 'delivery_named' && referent.zone.etaText) {
      const z = referent.zone;
      return withDeliveryResume(
        ctx,
        `Delivery to ${z.name} usually takes ${z.etaText} please.`,
        `delivery.zones[${z.id}].etaText`,
        referent,
      );
    }
    if (
      referent.kind === 'delivery_current' &&
      referent.zone &&
      referent.zone.etaText
    ) {
      const z = referent.zone;
      return withDeliveryResume(
        ctx,
        `Delivery to ${z.name} usually takes ${z.etaText} please.`,
        `delivery.zones[${z.id}].etaText`,
        referent,
      );
    }
  
    // Store-level timeline as fallback
    const timeline = knowledge.delivery.timeline;
    if (timeline) {
      return withDeliveryResume(
        ctx,
        `${timeline}`,
        'delivery.timeline',
        referent,
      );
    }
  
    // Nothing configured — be honest.
    return {
      answerText: missingDeliveryNotice(knowledge),
      answerSource: 'delivery.timeline',
      resume: { kind: 'none' },
      diagnostics: {
        referentKind: referent.kind,
        knowledgeMissing: ['delivery.timeline'],
      },
    };
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // shared
  // ─────────────────────────────────────────────────────────────────────────────
  
  function withDeliveryResume(
    ctx: KnowledgeTurnContext,
    answerText: string,
    answerSource: string,
    referent: Referent,
  ): InformationReply {
    const decision = decideResume('q_delivery_fee', referent, ctx.commerceState);
    if (decision === 'resume') {
      const prompt = buildResumePrompt(ctx.commerceState);
      if (prompt) {
        return {
          answerText,
          answerSource,
          resume: { kind: 'state_prompt', state: ctx.commerceState, prompt },
          diagnostics: { referentKind: referent.kind },
        };
      }
    }
    return {
      answerText,
      answerSource,
      resume: { kind: 'none' },
      diagnostics: { referentKind: referent.kind },
    };
  }
  
  function missingDeliveryNotice(knowledge: StoreKnowledge): string {
    // If we have the store-level notice, surface it; otherwise be honest.
    if (knowledge.delivery.notice) return knowledge.delivery.notice;
    return "I don't have delivery details on file please. I can ask the seller to follow up.";
  }