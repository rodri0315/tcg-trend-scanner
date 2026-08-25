'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { assertInternalAccess } from '../../../../src/auth/internalAccess';
import { evaluateLocalOffer } from '../../../../src/economics/localOffer';
import {
  createDecisionJournalEntry,
  getLatestDecisionContext,
  type DecisionChoice,
  type IntendedExitChannel,
  type OfferSourceChannel,
} from '../../../../src/services/decisions';

const DECISIONS = new Set<DecisionChoice>(['buy', 'pass', 'watch']);
const SOURCE_CHANNELS = new Set<OfferSourceChannel>(['local_shop', 'vendor_offer', 'collector', 'ebay', 'other']);
const EXIT_CHANNELS = new Set<IntendedExitChannel>(['direct_collector', 'vendor', 'ebay']);

export async function createDecisionAction(cardId: number, formData: FormData): Promise<void> {
  await assertInternalAccess();

  if (!Number.isInteger(cardId) || cardId <= 0) {
    throw new Error('Invalid card id.');
  }

  const offerPrice = Number(getRequiredString(formData, 'offerPrice'));
  if (!Number.isFinite(offerPrice) || offerPrice <= 0 || offerPrice > 1_000_000) {
    throw new Error('Offer price must be greater than zero and no more than $1,000,000.');
  }

  const decision = getAllowedValue(formData, 'decision', DECISIONS);
  const sourceChannel = getAllowedValue(formData, 'sourceChannel', SOURCE_CHANNELS);
  const intendedExitChannel = getAllowedValue(formData, 'intendedExitChannel', EXIT_CHANNELS);
  const notes = getOptionalString(formData, 'notes');
  if (notes !== null && notes.length > 5000) {
    throw new Error('Decision notes must be 5,000 characters or fewer.');
  }

  const context = await getLatestDecisionContext(cardId);
  const scenario = context?.exitScenarios[intendedExitChannel] ?? null;
  const evaluation = evaluateLocalOffer(offerPrice, scenario);

  await createDecisionJournalEntry({
    cardId,
    decision,
    sourceChannel,
    intendedExitChannel,
    notes,
    context,
    scenario,
    evaluation,
  });

  revalidatePath(`/cards/${cardId}`);
  redirect(`/cards/${cardId}?journal=created`);
}

function getAllowedValue<T extends string>(formData: FormData, key: string, allowed: Set<T>): T {
  const value = getRequiredString(formData, key) as T;
  if (!allowed.has(value)) {
    throw new Error(`Invalid ${key}.`);
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
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }

  return value.trim();
}
