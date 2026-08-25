import type { Card } from '../types';

type TrackedCardIdentity = Pick<Card, 'cardNumber' | 'language' | 'name' | 'variant'>;

const GENERIC_NAME_TOKENS = new Set([
  'card',
  'ex',
  'gx',
  'one',
  'piece',
  'pokemon',
  'tcg',
  'v',
  'vmax',
  'vstar',
]);

const LANGUAGE_CONFLICTS: Record<string, Set<string>> = {
  english: new Set(['chinese', 'japanese', 'jpn', 'jp', 'korean', 'kor']),
  japanese: new Set(['chinese', 'english', 'eng', 'korean', 'kor']),
};

const REQUIRED_VARIANT_TERMS: Record<string, string[][]> = {
  manga: [['manga']],
  'master ball': [['master', 'ball'], ['masterball']],
  parallel: [['parallel'], ['alternate', 'art'], ['alt', 'art']],
  signature: [
    ['signature'],
    ['signed'],
    ['autograph'],
    ['autographed'],
    ['oda'],
    ['anniversary'],
  ],
};

export function getListingIdentityRejectionReason(
  card: TrackedCardIdentity,
  title: string | undefined,
): string | null {
  const titleTokens = tokenize(title);
  if (titleTokens.length === 0) {
    return 'missing_title';
  }

  const cardNumberTokens = tokenize(card.cardNumber);
  if (cardNumberTokens.length === 0 || !containsTokenSequence(titleTokens, cardNumberTokens)) {
    return 'card_number_mismatch';
  }

  const nameTokens = tokenize(card.name).filter(
    (token) => token.length >= 2 && !GENERIC_NAME_TOKENS.has(token),
  );
  if (nameTokens.length === 0 || !nameTokens.some((token) => titleTokens.includes(token))) {
    return 'card_name_mismatch';
  }

  const languageConflicts = LANGUAGE_CONFLICTS[normalizeText(card.language)];
  if (languageConflicts && titleTokens.some((token) => languageConflicts.has(token))) {
    return 'conflicting_language';
  }

  const requiredVariantTerms = REQUIRED_VARIANT_TERMS[normalizeText(card.variant)];
  if (
    requiredVariantTerms &&
    !requiredVariantTerms.some((termSequence) => containsTokenSequence(titleTokens, termSequence))
  ) {
    return 'missing_variant_identity';
  }

  return null;
}

export function normalizeText(value: string | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenize(value: string | undefined): string[] {
  const normalized = normalizeText(value);
  return normalized ? normalized.split(' ').map(normalizeNumericToken) : [];
}

function normalizeNumericToken(token: string): string {
  return token.replace(/\d+/g, (digits) => String(Number(digits)));
}

function containsTokenSequence(tokens: string[], expected: string[]): boolean {
  if (expected.length === 0 || expected.length > tokens.length) {
    return false;
  }

  return tokens.some((_, startIndex) =>
    expected.every((token, offset) => tokens[startIndex + offset] === token),
  );
}
