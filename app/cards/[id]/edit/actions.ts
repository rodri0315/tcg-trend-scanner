'use server';

import { revalidatePath } from 'next/cache';
import { notFound, redirect } from 'next/navigation';

import { assertInternalAccess } from '../../../../src/auth/internalAccess';
import { getCardById, updateCard } from '../../../../src/services/cards';
import { parseCardFormData } from '../../form-data';

export async function updateCardAction(cardId: number, formData: FormData): Promise<void> {
  await assertInternalAccess();

  if (!Number.isInteger(cardId) || cardId <= 0) {
    notFound();
  }

  const existingCard = await getCardById(cardId);
  if (!existingCard) {
    notFound();
  }

  const input = parseCardFormData(formData);
  const updated = await updateCard(cardId, {
    ...input,
    game: existingCard.game,
    language: existingCard.language,
    productType: existingCard.productType,
    marketSegment: existingCard.marketSegment,
  });
  if (!updated) {
    notFound();
  }

  revalidatePath('/');
  revalidatePath('/cards');
  revalidatePath(`/cards/${cardId}`);
  revalidatePath(`/cards/${cardId}/edit`);
  redirect(`/cards/${cardId}`);
}
