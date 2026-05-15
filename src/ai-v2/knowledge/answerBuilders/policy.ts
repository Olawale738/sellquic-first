import type {
    InformationReply,
    KnowledgeTurnContext,
    StoreKnowledge,
  } from '../types';
  import { buildResumePrompt, decideResume } from '../../presentation/buildResumePrompt';
  
  export function buildRefundPolicyAnswer(
    ctx: KnowledgeTurnContext,
    knowledge: StoreKnowledge,
  ): InformationReply {
    if (!knowledge.policy.returns) {
      return {
        answerText:
          "I don't have a return policy on file here please. I can ask the seller to confirm.",
        answerSource: 'policy.returns',
        resume: { kind: 'none' },
        diagnostics: {
          referentKind: 'none',
          knowledgeMissing: ['policy.returns'],
        },
      };
    }
  
    const text = knowledge.policy.returns;
  
    const decision = decideResume('q_refund_policy', { kind: 'none' }, ctx.commerceState);
    if (decision === 'resume') {
      const prompt = buildResumePrompt(ctx.commerceState);
      if (prompt) {
        return {
          answerText: text,
          answerSource: 'policy.returns',
          resume: { kind: 'state_prompt', state: ctx.commerceState, prompt },
          diagnostics: { referentKind: 'none' },
        };
      }
    }
  
    return {
      answerText: text,
      answerSource: 'policy.returns',
      resume: { kind: 'none' },
      diagnostics: { referentKind: 'none' },
    };
  }