import { extractConfirmationFromVocab } from './confirmationVocab';

export type ConfirmationIntent = 'confirm' | 'deny' | 'unclear';

const CONFIRM_PHRASES = new Set([
  'yes',
  'yes please',
  'yes pls',
  'yeah',
  'yeah please',
  'yep',
  'yep please',
  'yup',
  'yh',
  'yh please',
  'yhh',
  'ya',
  'yaa',
  'yea',
  'yea please',
  'yess',
  'yess please',
  'yesss',
  'ok',
  'okay',
  'ok please',
  'okay please',
  'k',
  'kk',
  'alright',
  'alright please',
  'sure',
  'sure please',
  'sure thing',
  'fine',
  'go on',
  'go on please',
  'go ahead',
  'go ahead please',
  'please go ahead',
  'do it',
  'do it please',
  'create it',
  'create it please',
  'send it',
  'send it please',
  'send link',
  'send the link',
  'send the link please',
  'checkout',
  'checkout please',
  'checkout link',
  'proceed',
  'proceed please',
  'that is all',
  "that's all",
  'thats all',
  'that’s all',
]);

const DENY_PHRASES = new Set([
  'no',
  'no please',
  'nope',
  'nah',
  'naa',
  'not yet',
  'not now',
  'wait',
  'wait please',
  'hold on',
  'hold on please',
  'cancel',
  'cancel please',
  'stop',
  'never mind',
  'nevermind',
  "don't",
  'dont',
]);

function normalizeConfirmationText(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9’'\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractConfirmation(text: string): ConfirmationIntent {
  const value = normalizeConfirmationText(text);

  if (!value) return 'unclear';

  const fromVocab = extractConfirmationFromVocab(value);

  if (fromVocab === 'affirm') return 'confirm';
  if (fromVocab === 'deny') return 'deny';

  if (CONFIRM_PHRASES.has(value)) {
    return 'confirm';
  }

  if (DENY_PHRASES.has(value)) {
    return 'deny';
  }

  if (
    /\b(yes|yeah|yep|yup|yh|yhh|yea|yaa|ya|yess|yesss|okay|ok|sure|alright)\b.*\b(please|pls)\b/i.test(
      value
    )
  ) {
    return 'confirm';
  }

  if (
    /\b(go ahead|go on|send.*link|create.*checkout|create.*link|proceed|checkout)\b/i.test(
      value
    )
  ) {
    return 'confirm';
  }

  if (/\b(wait|not yet|not now|hold on|cancel|stop|never mind|nevermind)\b/i.test(value)) {
    return 'deny';
  }

  return 'unclear';
}