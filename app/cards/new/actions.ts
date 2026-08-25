'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { assertInternalAccess } from '../../../src/auth/internalAccess';
import { createCard } from '../../../src/services/cards';
import { parseCardFormData } from '../form-data';

export async function createCardAction(formData: FormData): Promise<void> {
  await assertInternalAccess();

  const cardId = await createCard(parseCardFormData(formData));

  revalidatePath('/cards');
  revalidatePath('/');
  redirect(`/cards/${cardId}`);
}
