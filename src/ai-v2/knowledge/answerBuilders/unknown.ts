import type {
    InformationReply,
    KnowledgeTurnContext,
    StoreKnowledge,
  } from '../types';
  
  /**
   * Last-resort answer builder. Strategy:
   *
   *   1. Try a lightweight fuzzy match against vendor FAQs (token overlap).
   *   2. If a confident match exists, return that FAQ answer.
   *   3. Otherwise, give the safe honest fallback decided in the PR design:
   *        "I don't have that information here please. I can ask the seller
   *         to follow up."
   *
   * Never invents. Never guesses a handover channel — that wiring is deferred
   * until we add the REQUEST_HANDOVER executor action.
   *
   * The matcher is deliberately conservative. We'd rather say "I don't know"
   * than confidently quote an irrelevant FAQ.
   */
  export function buildUnknownAnswer(
    _ctx: KnowledgeTurnContext,
    knowledge: StoreKnowledge,
    customerMessage: string,
  ): InformationReply {
    const match = matchFaq(customerMessage, knowledge.faqs);
  
    if (match) {
      return {
        answerText: match.faq.a,
        answerSource: `faqs[${match.index}]`,
        resume: { kind: 'none' },
        diagnostics: { referentKind: 'none' },
      };
    }
  
    return {
      answerText:
        "I don't have that information here please. I can ask the seller to follow up.",
      answerSource: 'faqs',
      resume: { kind: 'none' },
      diagnostics: {
        referentKind: 'none',
        knowledgeMissing: ['faqs.match'],
      },
    };
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // FAQ matcher
  // ─────────────────────────────────────────────────────────────────────────────
  
  const STOP_WORDS = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'do', 'does',
    'for', 'from', 'have', 'how', 'i', 'in', 'is', 'it', 'me',
    'much', 'of', 'on', 'or', 'please', 'so', 'that', 'the', 'to',
    'too', 'we', 'what', 'when', 'where', 'which', 'who', 'why',
    'will', 'with', 'you', 'your',
  ]);
  
  interface MatchResult {
    faq: StoreKnowledge['faqs'][number];
    index: number;
    score: number;
  }
  
  function matchFaq(
    message: string,
    faqs: StoreKnowledge['faqs'],
  ): MatchResult | null {
    if (faqs.length === 0) return null;
  
    const queryTokens = tokenize(message);
    if (queryTokens.size === 0) return null;
  
    let best: MatchResult | null = null;
  
    for (let i = 0; i < faqs.length; i++) {
      const faq = faqs[i];
      const faqTokens = tokenize(faq.q);
      if (faqTokens.size === 0) continue;
  
      // Jaccard-style overlap, biased toward the FAQ side so short FAQ
      // questions don't unfairly dominate.
      let overlap = 0;

      faqTokens.forEach((t) => {
        if (queryTokens.has(t)) overlap++;
      });
      
      const score = overlap / Math.max(faqTokens.size, 1);
  
      if (score > (best?.score ?? 0)) {
        best = { faq, index: i, score };
      }
    }
  
    // Confidence threshold: require a meaningful overlap. 0.5 ≈ at least
    // half the FAQ-question content words appear in the customer's message.
    if (!best || best.score < 0.5) return null;
    return best;
  }
  
  function tokenize(s: string): Set<string> {
    const out = new Set<string>();
    for (const raw of s.toLowerCase().split(/[^a-z0-9]+/g)) {
      if (!raw) continue;
      if (raw.length < 2) continue;
      if (STOP_WORDS.has(raw)) continue;
      out.add(raw);
    }
    return out;
  }