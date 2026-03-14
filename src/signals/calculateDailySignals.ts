import { pool } from '../db/pool';
import type { Card, SignalSnapshot } from '../types';
import { clamp, percentChange, round } from '../utils/math';

interface HistoricalSnapshotRow {
  floor_bin: number | null;
  total_bin_count: number | null;
  auction_count: number | null;
  median_auction_current_price: number | null;
}

export async function calculateDailySignals(cards: Card[], signalDate: string): Promise<SignalSnapshot[]> {
  const signals: SignalSnapshot[] = [];

  for (const card of cards) {
    const current = await getHistoricalSnapshot(card.id, signalDate);
    if (!current) {
      continue;
    }

    const sevenDayDate = shiftDate(signalDate, 7);
    const thirtyDayDate = shiftDate(signalDate, 30);
    const previous7d = await getClosestHistoricalSnapshot(card.id, sevenDayDate);
    const previous30d = await getClosestHistoricalSnapshot(card.id, thirtyDayDate);
    const trailing7d = await getTrailingFloorSeries(card.id, signalDate, 7);

    const ebayFloorChange7dPct = percentChange(current.floor_bin, previous7d?.floor_bin ?? null);
    const ebayFloorChange30dPct = percentChange(current.floor_bin, previous30d?.floor_bin ?? null);
    const inventoryChange7dPct = percentChange(current.total_bin_count, previous7d?.total_bin_count ?? null);
    const inventoryChange30dPct = percentChange(current.total_bin_count, previous30d?.total_bin_count ?? null);
    const auctionPriceVsFloorPct =
      current.floor_bin !== null &&
      current.median_auction_current_price !== null &&
      current.floor_bin !== 0
        ? round(((current.median_auction_current_price - current.floor_bin) / current.floor_bin) * 100)
        : null;
    const auctionActivityChange7dPct = percentChange(current.auction_count, previous7d?.auction_count ?? null);
    const volatility7dPct = calculateVolatility(trailing7d);

    const inventoryTightening = inventoryChange7dPct === null ? 0 : clamp(-inventoryChange7dPct, -25, 25);
    const auctionHeat = clamp((auctionActivityChange7dPct ?? 0) * 0.35 + (current.auction_count ?? 0), 0, 25);
    const trendScore = round(
      clamp(
        (ebayFloorChange7dPct ?? 0) * 0.45 +
          (ebayFloorChange30dPct ?? 0) * 0.2 +
          inventoryTightening * 0.7 +
          Math.max(-(volatility7dPct ?? 0) + 18, 0) * 0.4 +
          auctionHeat,
        0,
        100,
      ),
    );
    const localLagScore = round(
      clamp(
        Math.max(-(auctionPriceVsFloorPct ?? 0), 0) * 1.1 +
          Math.max(ebayFloorChange7dPct ?? 0, 0) * 0.8 +
          inventoryTightening * 0.55 +
          Math.max(auctionActivityChange7dPct ?? 0, 0) * 0.2,
        0,
        100,
      ),
    );
    const spikeFlag =
      (ebayFloorChange7dPct ?? 0) >= 12 &&
      (auctionPriceVsFloorPct ?? 0) <= -8 &&
      (inventoryChange7dPct ?? 0) <= -10;

    signals.push({
      cardId: card.id,
      signalDate,
      ebayFloorChange7dPct,
      ebayFloorChange30dPct,
      inventoryChange7dPct,
      inventoryChange30dPct,
      auctionPriceVsFloorPct,
      auctionActivityChange7dPct,
      volatility7dPct,
      trendScore,
      localLagScore,
      spikeFlag,
    });
  }

  return signals;
}

async function getHistoricalSnapshot(cardId: number, snapshotDate: string): Promise<HistoricalSnapshotRow | null> {
  const result = await pool.query<HistoricalSnapshotRow>(
    `
      select
        e.floor_bin,
        e.total_bin_count,
        e.auction_count,
        e.median_auction_current_price
      from ebay_daily e
      where e.card_id = $1
        and e.snapshot_date = $2
      limit 1
    `,
    [cardId, snapshotDate],
  );

  return result.rows[0] ?? null;
}

async function getClosestHistoricalSnapshot(cardId: number, snapshotDate: string): Promise<HistoricalSnapshotRow | null> {
  const result = await pool.query<HistoricalSnapshotRow>(
    `
      select
        e.floor_bin,
        e.total_bin_count,
        e.auction_count,
        e.median_auction_current_price
      from ebay_daily e
      where e.card_id = $1
        and e.snapshot_date <= $2
      order by e.snapshot_date desc
      limit 1
    `,
    [cardId, snapshotDate],
  );

  return result.rows[0] ?? null;
}

async function getTrailingFloorSeries(cardId: number, snapshotDate: string, days: number): Promise<number[]> {
  const lowerBound = shiftDate(snapshotDate, days - 1);
  const result = await pool.query<{ floor_bin: number | null }>(
    `
      select floor_bin
      from ebay_daily
      where card_id = $1
        and snapshot_date between $2 and $3
        and floor_bin is not null
      order by snapshot_date asc
    `,
    [cardId, lowerBound, snapshotDate],
  );

  return result.rows
    .map((row) => row.floor_bin)
    .filter((value): value is number => value !== null);
}

function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}

function calculateVolatility(values: number[]): number | null {
  if (values.length < 2) {
    return null;
  }

  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (average === 0) {
    return null;
  }

  const variance =
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;

  return round((Math.sqrt(variance) / average) * 100);
}
