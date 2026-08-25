import { summarizeBacktests, type BacktestHorizonDays, type BacktestObservation, type HorizonBacktestSummary } from '../backtesting/calibration';
import { pool } from '../db/pool';

export interface BacktestFilters {
  game?: string;
  language?: string;
  marketSegment?: string;
}

export interface BacktestReport {
  latestLiveDate: string | null;
  observations: number;
  summaries: HorizonBacktestSummary[];
  filters: {
    games: string[];
    languages: string[];
    marketSegments: string[];
  };
}

interface BacktestRow {
  card_id: number;
  card_label: string;
  signal_date: string;
  rank_score: string;
  confidence_score: string;
  start_price: string;
  latest_live_date: string | null;
  future_7_date: string | null;
  future_7_price: string | null;
  future_30_date: string | null;
  future_30_price: string | null;
  future_90_date: string | null;
  future_90_price: string | null;
}

export async function getBacktestReport(filters: BacktestFilters = {}): Promise<BacktestReport> {
  const where = buildFilters(filters);
  const [result, filterOptions] = await Promise.all([
    pool.query<BacktestRow>(
      `
        with latest_live as (
          select max(snapshot_date) as latest_date
          from public.ebay_daily
          where snapshot_source = 'live'
        )
        select
          c.id as card_id,
          concat(c.name, ' ', c.card_number, ' · ', c.language, ' · ', c.market_segment) as card_label,
          s.signal_date::text as signal_date,
          s.rank_score,
          s.confidence_score,
          start_market.active_ask_reference as start_price,
          latest_live.latest_date::text as latest_live_date,
          future_7.snapshot_date::text as future_7_date,
          future_7.active_ask_reference as future_7_price,
          future_30.snapshot_date::text as future_30_date,
          future_30.active_ask_reference as future_30_price,
          future_90.snapshot_date::text as future_90_date,
          future_90.active_ask_reference as future_90_price
        from public.signals_daily s
        inner join public.cards c on c.id = s.card_id
        inner join public.ebay_daily start_market
          on start_market.card_id = s.card_id
         and start_market.snapshot_date = s.signal_date
         and start_market.snapshot_source = 'live'
         and start_market.active_ask_reference is not null
         and start_market.sampled_bin_count >= 3
        cross join latest_live
        left join lateral (
          select future.snapshot_date, future.active_ask_reference
          from public.ebay_daily future
          where future.card_id = s.card_id
            and future.snapshot_source = 'live'
            and future.active_ask_reference is not null
            and future.sampled_bin_count >= 3
            and future.snapshot_date between s.signal_date + 5 and s.signal_date + 10
          order by abs(future.snapshot_date - (s.signal_date + 7)), future.snapshot_date
          limit 1
        ) future_7 on true
        left join lateral (
          select future.snapshot_date, future.active_ask_reference
          from public.ebay_daily future
          where future.card_id = s.card_id
            and future.snapshot_source = 'live'
            and future.active_ask_reference is not null
            and future.sampled_bin_count >= 3
            and future.snapshot_date between s.signal_date + 23 and s.signal_date + 37
          order by abs(future.snapshot_date - (s.signal_date + 30)), future.snapshot_date
          limit 1
        ) future_30 on true
        left join lateral (
          select future.snapshot_date, future.active_ask_reference
          from public.ebay_daily future
          where future.card_id = s.card_id
            and future.snapshot_source = 'live'
            and future.active_ask_reference is not null
            and future.sampled_bin_count >= 3
            and future.snapshot_date between s.signal_date + 76 and s.signal_date + 104
          order by abs(future.snapshot_date - (s.signal_date + 90)), future.snapshot_date
          limit 1
        ) future_90 on true
        ${where.clause}
        order by s.signal_date asc, c.id asc
      `,
      where.params,
    ),
    getBacktestFilterOptions(),
  ]);

  const observations = result.rows.flatMap(toObservation);
  const latestLiveDate = result.rows[0]?.latest_live_date ?? null;

  return {
    latestLiveDate,
    observations: observations.length,
    summaries: summarizeBacktests(observations, latestLiveDate),
    filters: filterOptions,
  };
}

function toObservation(row: BacktestRow): BacktestObservation[] {
  const rankScore = Number(row.rank_score);
  const confidenceScore = Number(row.confidence_score);
  const startPrice = Number(row.start_price);
  if (![rankScore, confidenceScore, startPrice].every(Number.isFinite) || startPrice <= 0) {
    return [];
  }

  const outcomes: Partial<Record<BacktestHorizonDays, { snapshotDate: string; price: number }>> = {};
  addOutcome(outcomes, 7, row.future_7_date, row.future_7_price);
  addOutcome(outcomes, 30, row.future_30_date, row.future_30_price);
  addOutcome(outcomes, 90, row.future_90_date, row.future_90_price);

  return [{
    cardId: Number(row.card_id),
    cardLabel: row.card_label,
    signalDate: row.signal_date,
    rankScore,
    confidenceScore,
    startPrice,
    outcomes,
  }];
}

function addOutcome(
  outcomes: Partial<Record<BacktestHorizonDays, { snapshotDate: string; price: number }>>,
  horizonDays: BacktestHorizonDays,
  snapshotDate: string | null,
  rawPrice: string | null,
): void {
  const price = Number(rawPrice);
  if (snapshotDate && Number.isFinite(price) && price > 0) {
    outcomes[horizonDays] = { snapshotDate, price };
  }
}

function buildFilters(filters: BacktestFilters): { clause: string; params: string[] } {
  const clauses: string[] = [];
  const params: string[] = [];

  for (const [column, value] of [
    ['c.game', filters.game],
    ['c.language', filters.language],
    ['c.market_segment', filters.marketSegment],
  ] as const) {
    if (value && value !== 'all') {
      params.push(value);
      clauses.push(`${column} = $${params.length}`);
    }
  }

  return {
    clause: clauses.length > 0 ? `where ${clauses.join(' and ')}` : '',
    params,
  };
}

async function getBacktestFilterOptions(): Promise<BacktestReport['filters']> {
  const result = await pool.query<{ game: string; language: string; market_segment: string }>(
    `
      select distinct game, language, market_segment
      from public.cards
      order by game, language, market_segment
    `,
  );

  return {
    games: [...new Set(result.rows.map((row) => row.game))],
    languages: [...new Set(result.rows.map((row) => row.language))],
    marketSegments: [...new Set(result.rows.map((row) => row.market_segment))],
  };
}
