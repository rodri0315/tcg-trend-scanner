'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createCard } from '../../../src/services/cards';

export async function createCardAction(formData: FormData): Promise<void> {
  const game = getRequiredString(formData, 'game');
  const language = getRequiredString(formData, 'language');
  const productType = getRequiredString(formData, 'productType');
  const marketSegment = getRequiredString(formData, 'marketSegment');
  const name = getRequiredString(formData, 'name');
  const setName = getRequiredString(formData, 'setName');
  const cardNumber = getRequiredString(formData, 'cardNumber');
  const variant = getOptionalString(formData, 'variant') ?? '';
  const rarity = getOptionalString(formData, 'rarity');
  const ebayQuery = getRequiredString(formData, 'ebayQuery');
  const tags = (getOptionalString(formData, 'tags') ?? '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

  const cardId = await createCard({
    game,
    language,
    productType,
    marketSegment,
    name,
    setName,
    cardNumber,
    rarity,
    variant,
    ebayQuery,
    tags,
  });

  revalidatePath('/cards');
  revalidatePath('/');
  redirect(`/cards/${cardId}`);
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
