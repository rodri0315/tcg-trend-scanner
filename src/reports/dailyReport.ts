import { promises as fs } from 'fs';
import path from 'path';

import { config } from '../config';
import { pool } from '../db/pool';
import { toCsv } from '../utils/csv';

interface ReportRow {
  game: string;
  language: string;
  market_segment: string;
  condition: string;
  name: string;
  set_name: string;
  card_number: string;
  variant: string;
  tags: string[];
  ebay_floor: number | null;
  market_now: number | null;
  target_buy_80: number | null;
  target_buy_85: number | null;
  target_buy_90: number | null;
  total_bin_count: number;
  auction_count: number;
  ebay_floor_change_7d_pct: number | null;
  ebay_floor_change_30d_pct: number | null;
  inventory_change_7d_pct: number | null;
  inventory_change_30d_pct: number | null;
  auction_price_vs_floor_pct: number | null;
  auction_activity_change_7d_pct: number | null;
  volatility_7d_pct: number | null;
  trend_score: number;
  local_lag_score: number;
  confidence_score: number;
  rank_score: number;
  reason_codes: unknown;
  spike_flag: boolean;
}

export async function generateDailyReport(snapshotDate: string): Promise<{ csvPath: string; markdownPath: string }> {
  const result = await pool.query<ReportRow>(
    `
      select
        c.game,
        c.language,
        c.market_segment,
        c.condition,
        c.name,
        c.set_name,
        c.card_number,
        c.variant,
        c.tags,
        e.floor_bin as ebay_floor,
        s.market_now,
        s.target_buy_80,
        s.target_buy_85,
        s.target_buy_90,
        e.total_bin_count,
        e.auction_count,
        s.ebay_floor_change_7d_pct,
        s.ebay_floor_change_30d_pct,
        s.inventory_change_7d_pct,
        s.inventory_change_30d_pct,
        s.auction_price_vs_floor_pct,
        s.auction_activity_change_7d_pct,
        s.volatility_7d_pct,
        s.trend_score,
        s.local_lag_score,
        s.confidence_score,
        s.rank_score,
        s.reason_codes,
        s.spike_flag
      from signals_daily s
      inner join cards c on c.id = s.card_id
      left join ebay_daily e
        on e.card_id = s.card_id
       and e.snapshot_date = s.signal_date
      where s.signal_date = $1
        and s.market_now is not null
        and c.game = 'pokemon'
        and c.language = 'english'
        and c.market_segment = 'raw'
        and s.confidence_score >= 65
        and s.market_now >= 25
      order by s.rank_score desc, s.local_lag_score desc, c.name asc
    `,
    [snapshotDate],
  );

  const reportDir = path.resolve(config.reportsDir);
  await fs.mkdir(reportDir, { recursive: true });

  const csvRows = result.rows.map((row) => ({
    name: row.name,
    game: row.game,
    language: row.language,
    market_segment: row.market_segment,
    condition: row.condition,
    set: row.set_name,
    number: row.card_number,
    variant: row.variant,
    tags: row.tags.join('|'),
    ebay_floor: row.ebay_floor,
    market_now: row.market_now,
    target_buy_80: row.target_buy_80,
    target_buy_85: row.target_buy_85,
    target_buy_90: row.target_buy_90,
    ebay_floor_change_7d_pct: row.ebay_floor_change_7d_pct,
    ebay_floor_change_30d_pct: row.ebay_floor_change_30d_pct,
    inventory_change_7d_pct: row.inventory_change_7d_pct,
    inventory_change_30d_pct: row.inventory_change_30d_pct,
    auction_price_vs_floor_pct: row.auction_price_vs_floor_pct,
    auction_activity_change_7d_pct: row.auction_activity_change_7d_pct,
    volatility_7d_pct: row.volatility_7d_pct,
    total_bin_count: row.total_bin_count,
    auction_count: row.auction_count,
    trend_score: row.trend_score,
    local_buy_score: row.local_lag_score,
    confidence_score: row.confidence_score,
    rank_score: row.rank_score,
    reason_codes: formatReasonCodes(row.reason_codes),
    spike_flag: row.spike_flag,
  }));

  const markdownLines = [
    `# Pokemon Local Buy Report - ${snapshotDate}`,
    '',
    `Tracked cards: ${result.rowCount}`,
    `Spike flags: ${result.rows.filter((row) => row.spike_flag).length}`,
    '',
    '## Top Local Buy Targets',
    '',
    ...result.rows.slice(0, 10).map(formatRow),
    '',
    '## High Upside / Lower Confidence',
    '',
    ...[...result.rows]
      .filter((row) => row.confidence_score < 70)
      .sort((left, right) => right.local_lag_score - left.local_lag_score)
      .slice(0, 10)
      .map(formatRow),
  ];

  const csvPath = path.join(reportDir, `${snapshotDate}-opportunities.csv`);
  const markdownPath = path.join(reportDir, `${snapshotDate}-opportunities.md`);

  await fs.writeFile(csvPath, toCsv(csvRows), 'utf8');
  await fs.writeFile(markdownPath, `${markdownLines.join('\n')}\n`, 'utf8');

  return { csvPath, markdownPath };
}

function formatRow(row: ReportRow): string {
  const reasons = formatReasonCodes(row.reason_codes);
  const parts = [
    `- [${row.game}/${row.language}/${row.market_segment}/${formatCondition(row.condition)}] ${row.name} ${row.card_number} (${row.set_name})`,
    `rank=${row.rank_score}`,
    `localBuy=${row.local_lag_score}`,
    `confidence=${row.confidence_score}`,
    `market=${row.market_now ?? row.ebay_floor ?? 'n/a'}`,
    `buy85=${row.target_buy_85 ?? 'n/a'}`,
    `floor7d=${row.ebay_floor_change_7d_pct ?? 'n/a'}%`,
    `floor30d=${row.ebay_floor_change_30d_pct ?? 'n/a'}%`,
    `auctionVsMarket=${row.auction_price_vs_floor_pct ?? 'n/a'}%`,
    `inv7d=${row.inventory_change_7d_pct ?? 'n/a'}%`,
  ];

  if (reasons.length > 0) {
    parts.push(`reasons=${reasons.join('; ')}`);
  }

  if (row.spike_flag) {
    parts.push('SPIKE');
  }

  return parts.join(' | ');
}

function formatCondition(value: string): string {
  return value.replace(/_or_better$/, '+').replace(/_/g, ' ');
}

function formatReasonCodes(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
}
