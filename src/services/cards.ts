import { pool } from '../db/pool';
import type { Card, PopularityTier } from '../types';

export interface CreateCardInput {
  game: string;
  language: string;
  productType: string;
  marketSegment: string;
  condition: string;
  popularityTier: PopularityTier;
  name: string;
  setName: string;
  cardNumber: string;
  rarity: string | null;
  variant: string;
  ebayQuery: string;
  tags: string[];
}

export async function getCards(): Promise<Card[]> {
  const result = await pool.query<{
    id: number;
    game: string;
    language: string;
    product_type: string;
    market_segment: string;
    condition: string;
    popularity_tier: PopularityTier;
    name: string;
    set_name: string;
    card_number: string;
    rarity: string | null;
    variant: string;
    ebay_query: string;
    tags: string[];
  }>(`
    select
      id,
      game,
      language,
      product_type,
      market_segment,
      condition,
      popularity_tier,
      name,
      set_name,
      card_number,
      rarity,
      variant,
      ebay_query,
      tags
    from cards
    order by game asc, language asc, name asc, set_name asc, card_number asc
  `);

  return result.rows.map((row) => ({
    id: row.id,
    game: row.game,
    language: row.language,
    productType: row.product_type,
    marketSegment: row.market_segment,
    condition: row.condition,
    popularityTier: row.popularity_tier,
    name: row.name,
    setName: row.set_name,
    cardNumber: row.card_number,
    rarity: row.rarity,
    variant: row.variant,
    ebayQuery: row.ebay_query,
    tags: row.tags ?? [],
  }));
}

export async function createCard(input: CreateCardInput): Promise<number> {
  const result = await pool.query<{ id: number }>(
    `
      insert into cards (
        game,
        language,
        product_type,
        market_segment,
        condition,
        popularity_tier,
        name,
        set_name,
        card_number,
        rarity,
        variant,
        ebay_query,
        tags,
        updated_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now())
      returning id
    `,
    [
      input.game,
      input.language,
      input.productType,
      input.marketSegment,
      input.condition,
      input.popularityTier,
      input.name,
      input.setName,
      input.cardNumber,
      input.rarity,
      input.variant,
      input.ebayQuery,
      input.tags,
    ],
  );

  const id = result.rows[0]?.id;
  if (!id) {
    throw new Error('Card insert did not return an id.');
  }

  return id;
}
