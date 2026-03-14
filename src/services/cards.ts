import { pool } from '../db/pool';
import type { Card } from '../types';

export async function getCards(): Promise<Card[]> {
  const result = await pool.query<{
    id: number;
    game: string;
    language: string;
    product_type: string;
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
    name: row.name,
    setName: row.set_name,
    cardNumber: row.card_number,
    rarity: row.rarity,
    variant: row.variant,
    ebayQuery: row.ebay_query,
    tags: row.tags ?? [],
  }));
}
