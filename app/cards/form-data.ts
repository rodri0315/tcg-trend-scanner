import type { CardInput } from '../../src/services/cards';

export function parseCardFormData(formData: FormData): CardInput {
  return {
    game: getRequiredString(formData, 'game'),
    language: getRequiredString(formData, 'language'),
    productType: getRequiredString(formData, 'productType'),
    marketSegment: getRequiredString(formData, 'marketSegment'),
    condition: getRequiredString(formData, 'condition'),
    popularityTier: getPopularityTier(formData),
    name: getRequiredString(formData, 'name'),
    setName: getRequiredString(formData, 'setName'),
    cardNumber: getRequiredString(formData, 'cardNumber'),
    rarity: getOptionalString(formData, 'rarity'),
    variant: getOptionalString(formData, 'variant') ?? '',
    ebayQuery: getRequiredString(formData, 'ebayQuery'),
    tags: (getOptionalString(formData, 'tags') ?? '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
  };
}

function getPopularityTier(formData: FormData): 'high' | 'standard' | 'niche' {
  const value = getRequiredString(formData, 'popularityTier');
  if (value !== 'high' && value !== 'standard' && value !== 'niche') {
    throw new Error('Popularity tier must be high, standard, or niche.');
  }

  return value;
}

function getRequiredString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing required field: ${key}`);
  }

  return value.trim();
}

function getOptionalString(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}
