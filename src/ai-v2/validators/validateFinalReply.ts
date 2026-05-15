import type { AiTurnResult, TurnContext } from '../types';
import { ghostActionValidator } from './ghostActionValidator';
import { checkoutReplyValidator } from './checkoutReplyValidator';
import { priceValidator } from './priceValidator';

export type FinalValidationResult = {
  result: AiTurnResult;
  validation: {
    ok: boolean;
    failedValidator?: string;
    reason?: string;
  };
};

export function validateFinalReply(
  ctx: TurnContext,
  result: AiTurnResult
): FinalValidationResult {
  const validators = [
    {
      name: 'ghostActionValidator',
      run: () => ghostActionValidator(ctx, result),
    },
    {
      name: 'checkoutReplyValidator',
      run: () => checkoutReplyValidator(ctx, result),
    },
    {
      name: 'priceValidator',
      run: () => priceValidator(ctx, result),
    },
  ];

  for (const validator of validators) {
    const outcome = validator.run();

    if (!outcome.ok) {
      return {
        result: {
          ...result,
          reply: outcome.safeReply,
          debug: {
            ...(result.debug || {}),
            reason: outcome.reason,
          },
        },
        validation: {
          ok: false,
          failedValidator: validator.name,
          reason: outcome.reason,
        },
      };
    }
  }

  return {
    result,
    validation: {
      ok: true,
    },
  };
}