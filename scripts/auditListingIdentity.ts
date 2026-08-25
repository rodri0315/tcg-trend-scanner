import { pool } from '../src/db/pool';
import { getListingIdentityRejectionReason } from '../src/services/listingIdentity';

interface ListingAuditRow {
  card_id: number;
  card_number: string;
  language: string;
  name: string;
  observed_date: string;
  title: string;
  variant: string;
}

async function main(): Promise<void> {
  const result = await pool.query<ListingAuditRow>(`
    with latest_per_card as (
      select card_id, max(observed_date) as observed_date
      from ebay_listing_samples
      group by card_id
    )
    select
      c.id as card_id,
      c.card_number,
      c.language,
      c.name,
      latest.observed_date::text,
      sample.title,
      c.variant
    from latest_per_card latest
    inner join ebay_listing_samples sample
      on sample.card_id = latest.card_id
     and sample.observed_date = latest.observed_date
    inner join cards c on c.id = latest.card_id
    order by c.game, c.language, c.name, c.card_number, sample.total_price
  `);

  const summaries = new Map<
    string,
    { examples: Map<string, string[]>; kept: number; rejected: Map<string, number>; total: number }
  >();

  for (const row of result.rows) {
    const key = `${row.name} ${row.card_number} [${row.language}]`;
    const summary = summaries.get(key) ?? {
      examples: new Map<string, string[]>(),
      kept: 0,
      rejected: new Map<string, number>(),
      total: 0,
    };
    const reason = getListingIdentityRejectionReason(
      {
        cardNumber: row.card_number,
        language: row.language,
        name: row.name,
        variant: row.variant,
      },
      row.title,
    );

    summary.total += 1;
    if (reason) {
      summary.rejected.set(reason, (summary.rejected.get(reason) ?? 0) + 1);
      const examples = summary.examples.get(reason) ?? [];
      if (examples.length < 2 && !examples.includes(row.title)) {
        examples.push(row.title);
        summary.examples.set(reason, examples);
      }
    } else {
      summary.kept += 1;
    }
    summaries.set(key, summary);
  }

  console.log('Latest stored listing identity audit');
  for (const [card, summary] of summaries) {
    const reasons = [...summary.rejected.entries()]
      .map(([reason, count]) => {
        const examples = summary.examples.get(reason)?.map((title) => `"${title}"`).join(' | ');
        return `${reason}=${count}${examples ? ` (${examples})` : ''}`;
      })
      .join(', ');
    console.log(`${card}: kept=${summary.kept}/${summary.total}${reasons ? `; rejected: ${reasons}` : ''}`);
  }
}

main()
  .catch((error) => {
    console.error('Listing identity audit failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
