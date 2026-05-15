import type {
    InformationReply,
    KnowledgeTurnContext,
    QuestionIntent,
    StoreKnowledge,
  } from '../types';
  import { buildResumePrompt, decideResume } from '../../presentation/buildResumePrompt';
  
  export function buildLocationAnswer(
    ctx: KnowledgeTurnContext,
    knowledge: StoreKnowledge,
  ): InformationReply {
    return simple(ctx, 'q_location', knowledge.location, 'location');
  }
  
  export function buildHoursAnswer(
    ctx: KnowledgeTurnContext,
    knowledge: StoreKnowledge,
  ): InformationReply {
    return simple(ctx, 'q_hours', knowledge.hours, 'hours');
  }
  
  export function buildAboutStoreAnswer(
    ctx: KnowledgeTurnContext,
    knowledge: StoreKnowledge,
  ): InformationReply {
    return simple(ctx, 'q_about_store', knowledge.about, 'about');
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  
  function simple(
    ctx: KnowledgeTurnContext,
    intent: QuestionIntent,
    value: string | null,
    sourcePath: 'location' | 'hours' | 'about',
  ): InformationReply {
    if (!value) {
      return {
        answerText:
          "I don't have that information here please. I can ask the seller to follow up.",
        answerSource: sourcePath,
        resume: { kind: 'none' },
        diagnostics: {
          referentKind: 'none',
          knowledgeMissing: [sourcePath],
        },
      };
    }
  
    const decision = decideResume(intent, { kind: 'none' }, ctx.commerceState);
    if (decision === 'resume') {
      const prompt = buildResumePrompt(ctx.commerceState);
      if (prompt) {
        return {
          answerText: value,
          answerSource: sourcePath,
          resume: { kind: 'state_prompt', state: ctx.commerceState, prompt },
          diagnostics: { referentKind: 'none' },
        };
      }
    }
  
    return {
      answerText: value,
      answerSource: sourcePath,
      resume: { kind: 'none' },
      diagnostics: { referentKind: 'none' },
    };
  }