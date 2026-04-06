import { readFileSync } from 'fs';
import path from 'path';

import { parse } from 'csv-parse/sync';

import { pool } from '../src/db/pool';

interface SeedRow {
  game: string;
  language: string;
  product_type?: string;
  market_segment?: string;
  condition?: string;
  name: string;
  set: string;
  number: string;
  rarity?: string;
  variant?: string;
  ebay_query: string;
  tags?: string;
}

async function main() {
  const filePath = path.resolve('seed/seed_cards.csv');
  const rawCsv = readFileSync(filePath, 'utf8');
  const rows = parse(rawCsv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as SeedRow[];

  const client = await pool.connect();
  try {
    await client.query('begin');

    for (const row of rows) {
      await client.query(
        `
          insert into cards (
            game,
            language,
            product_type,
            market_segment,
            condition,
            name,
            set_name,
            card_number,
            rarity,
            variant,
            ebay_query,
            tags,
            updated_at
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())
          on conflict (game, language, product_type, market_segment, condition, name, set_name, card_number, variant) do update set
            rarity = excluded.rarity,
            ebay_query = excluded.ebay_query,
            tags = excluded.tags,
            updated_at = now()
        `,
        [
          row.game.trim(),
          row.language.trim(),
          row.product_type?.trim() || 'single',
          row.market_segment?.trim() || 'raw',
          row.condition?.trim() || (row.market_segment?.trim() === 'psa_10' ? 'graded' : 'near_mint_or_better'),
          row.name,
          row.set,
          row.number,
          row.rarity?.trim() || null,
          row.variant?.trim() || '',
          row.ebay_query,
          row.tags?.split(',').map((tag) => tag.trim()).filter(Boolean) ?? [],
        ],
      );
    }

    await client.query('commit');
    console.log(`Seeded ${rows.length} cards from ${filePath}`);
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
