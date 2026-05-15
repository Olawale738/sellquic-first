import type { Intent } from './types';

/**
 * Example phrasings for the semantic classifier (Layer 2). Each entry is a
 * (intent, examples[]) pair. The semantic layer scores incoming messages
 * by token overlap against these examples.
 *
 * EMPTY IN STEP 1 — Layer 2 lands in Step 4 of the migration plan.
 *
 * Curation policy:
 *   - Add real customer phrasings, not invented ones.
 *   - Keep examples short and lowercase.
 *   - Do not duplicate phrasings already covered by deterministic regex.
 *   - One concept per example; avoid combining slots in examples.
 */
export const INTENT_EXAMPLES: ReadonlyArray<{
  intent: Intent;
  examples: ReadonlyArray<string>;
}> = [
  // populated in Step 4
];