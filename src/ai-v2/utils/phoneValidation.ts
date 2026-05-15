import type { TurnContext } from '../types';

/**
 * Phone validation — minimal Ghana-only stub.
 * TODO(multi-vendor): Replace with libphonenumber-js for region-aware
 * validation in the next commit. Callers don't change.
 */

const GHANA_PHONE_REGEX = /^0[2-5][0-9]{8}$/;

export function validatePhoneForStore(
  rawPhone: string | null | undefined,
  _ctx: TurnContext,
): string | null {
  if (!rawPhone || typeof rawPhone !== 'string') return null;
  const cleaned = rawPhone.trim().replace(/[\s\-()+]/g, '');
  const normalized =
    cleaned.startsWith('233') && cleaned.length === 12
      ? '0' + cleaned.slice(3)
      : cleaned;
  if (GHANA_PHONE_REGEX.test(normalized)) return normalized;
  return null;
}