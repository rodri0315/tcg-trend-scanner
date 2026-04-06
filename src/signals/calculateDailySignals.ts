import { pool } from '../db/pool';
import type { Card, SignalSnapshot } from '../types';
import { clamp, percentChange, round } from '../utils/math';

interface HistoricalSnapshotRow {
  snapshot_source: string;
  floor_bin: number | null;
  floor_bin_count: number | null;
  total_bin_count: number | null;
  auction_count: number | null;
  median_auction_current_price: number | null;
  market_price_estimate: number | null;
  floor_quality_score: number | null;
  sampled_bin_count: number | null;
  sampled_auction_count: number | null;
  seller_concentration_top3_pct: number | null;
  fresh_low_count_24h: number | null;
  new_bin_count_24h: number | null;
  raw_payload: unknown;
}

interface ListingAbsorptionStats {
  previousFloorSampleCount: number;
  currentFloorSampleCount: number;
  absorbedCount: number;
  absorbedRatioPct: number | null;
}

export async function calculateDailySignals(cards: Card[], signalDate: string): Promise<SignalSnapshot[]> {
  const signals: SignalSnapshot[] = [];

  for (const card of cards) {
    const current = await getHistoricalSnapshot(card.id, signalDate);
    if (!current) {
      continue;
    }

    const currentReferencePrice = current.market_price_estimate ?? current.floor_bin;
    const sevenDayDate = shiftDate(signalDate, 7);
    const thirtyDayDate = shiftDate(signalDate, 30);
    const previous7d = await getClosestHistoricalSnapshot(card.id, sevenDayDate);
    const previous30d = await getClosestHistoricalSnapshot(card.id, thirtyDayDate);
    const trailing7d = await getTrailingReferenceSeries(card.id, signalDate, 7);
    const absorption = await getListingAbsorptionStats(card.id, signalDate);

    const previous7dReferencePrice = previous7d?.market_price_estimate ?? previous7d?.floor_bin ?? null;
    const previous30dReferencePrice = previous30d?.market_price_estimate ?? previous30d?.floor_bin ?? null;
    const ebayFloorChange7dPct = percentChange(currentReferencePrice, previous7dReferencePrice);
    const ebayFloorChange30dPct = percentChange(currentReferencePrice, previous30dReferencePrice);
    const inventoryChange7dPct = percentChange(current.total_bin_count, previous7d?.total_bin_count ?? null);
    const inventoryChange30dPct = percentChange(current.total_bin_count, previous30d?.total_bin_count ?? null);
    const referencePrice = currentReferencePrice;
    const auctionPriceVsFloorPct =
      referencePrice !== null &&
      current.median_auction_current_price !== null &&
      referencePrice !== 0
        ? round(((current.median_auction_current_price - referencePrice) / referencePrice) * 100)
        : null;
    const auctionActivityChange7dPct = percentChange(current.auction_count, previous7d?.auction_count ?? null);
    const volatility7dPct = calculateVolatility(trailing7d);

    const sustainedMoveScore = calculateSustainedMoveScore(
      ebayFloorChange7dPct,
      ebayFloorChange30dPct,
      volatility7dPct,
    );
    const distortedHistory = isHistoryDistorted(ebayFloorChange7dPct, ebayFloorChange30dPct);
    const inventorySqueezeScore = calculateInventorySqueezeScore(
      ebayFloorChange7dPct,
      inventoryChange7dPct,
      current.floor_bin_count,
      previous7d?.floor_bin_count ?? null,
    );
    const auctionLagScore = calculateAuctionLagScore(auctionPriceVsFloorPct, ebayFloorChange7dPct);
    const absorptionScore = calculateAbsorptionScore(absorption, current.fresh_low_count_24h, ebayFloorChange7dPct);
    const stabilityScore = calculateStabilityScore(
      current.floor_quality_score,
      current.sampled_bin_count,
      current.seller_concentration_top3_pct,
    );
    const queryConfidenceScore = calculateQueryConfidenceScore(current.raw_payload, current.sampled_bin_count);
    const baseConfidenceScore = calculateConfidenceScore(
      queryConfidenceScore,
      stabilityScore,
      current.sampled_bin_count,
      current.floor_quality_score,
    );
    const confidenceScore = round(clamp(baseConfidenceScore - (distortedHistory ? 25 : 0), 0, 100));

    const hasExecutableMarket = currentReferencePrice !== null && (current.sampled_bin_count ?? 0) > 0;
    const baseLocalBuyScore = round(
      clamp(
        sustainedMoveScore * 0.3 +
          inventorySqueezeScore * 0.25 +
          auctionLagScore * 0.15 +
          absorptionScore * 0.15 +
          stabilityScore * 0.1 +
          queryConfidenceScore * 0.05,
        0,
        100,
      ) * (hasExecutableMarket ? 1 : 0),
    );
    const localBuyScore = round(clamp(baseLocalBuyScore - (distortedHistory ? 20 : 0), 0, 100));
    const trendScore = round(
      clamp(sustainedMoveScore * 0.6 + inventorySqueezeScore * 0.25 + stabilityScore * 0.15, 0, 100) *
        (hasExecutableMarket ? 1 : 0),
    );
    const rankScore = round(localBuyScore * (0.6 + 0.4 * (confidenceScore / 100)));
    const spikeFlag =
      (ebayFloorChange7dPct ?? 0) >= 14 &&
      (ebayFloorChange30dPct ?? 0) <= ((ebayFloorChange7dPct ?? 0) * 1.2) &&
      (volatility7dPct ?? 0) >= 12;

    signals.push({
      cardId: card.id,
      signalDate,
      marketNow: currentReferencePrice,
      targetBuy80: currentReferencePrice === null ? null : round(currentReferencePrice * 0.8),
      targetBuy85: currentReferencePrice === null ? null : round(currentReferencePrice * 0.85),
      targetBuy90: currentReferencePrice === null ? null : round(currentReferencePrice * 0.9),
      ebayFloorChange7dPct,
      ebayFloorChange30dPct,
      inventoryChange7dPct,
      inventoryChange30dPct,
      auctionPriceVsFloorPct,
      auctionActivityChange7dPct,
      volatility7dPct,
      trendScore,
      localLagScore: localBuyScore,
      confidenceScore,
      sustainedMoveScore,
      inventorySqueezeScore,
      auctionLagScore,
      absorptionScore,
      stabilityScore,
      queryConfidenceScore,
      rankScore,
      reasonCodes: buildReasonCodes({
        ebayFloorChange7dPct,
        ebayFloorChange30dPct,
        inventoryChange7dPct,
        auctionPriceVsFloorPct,
        absorption,
        confidenceScore,
        queryConfidenceScore,
        current,
        distortedHistory,
      }),
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
        e.snapshot_source,
        e.floor_bin_count,
        e.total_bin_count,
        e.auction_count,
        e.median_auction_current_price,
        e.market_price_estimate,
        e.floor_quality_score,
        e.sampled_bin_count,
        e.sampled_auction_count,
        e.seller_concentration_top3_pct,
        e.fresh_low_count_24h,
        e.new_bin_count_24h,
        e.raw_payload
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
        e.snapshot_source,
        e.floor_bin_count,
        e.total_bin_count,
        e.auction_count,
        e.median_auction_current_price,
        e.market_price_estimate,
        e.floor_quality_score,
        e.sampled_bin_count,
        e.sampled_auction_count,
        e.seller_concentration_top3_pct,
        e.fresh_low_count_24h,
        e.new_bin_count_24h,
        e.raw_payload
      from ebay_daily e
      where e.card_id = $1
        and e.snapshot_date <= $2
        and e.snapshot_source = 'live'
      order by e.snapshot_date desc
      limit 1
    `,
    [cardId, snapshotDate],
  );

  return result.rows[0] ?? null;
}

async function getTrailingReferenceSeries(cardId: number, snapshotDate: string, days: number): Promise<number[]> {
  const lowerBound = shiftDate(snapshotDate, days - 1);
  const result = await pool.query<{ reference_price: number | null }>(
    `
      select coalesce(market_price_estimate, floor_bin) as reference_price
      from ebay_daily
      where card_id = $1
        and snapshot_date between $2 and $3
        and snapshot_source = 'live'
        and coalesce(market_price_estimate, floor_bin) is not null
      order by snapshot_date asc
    `,
    [cardId, lowerBound, snapshotDate],
  );

  return result.rows
    .map((row) => row.reference_price)
    .filter((value): value is number => value !== null);
}

async function getListingAbsorptionStats(cardId: number, snapshotDate: string): Promise<ListingAbsorptionStats> {
  const previousDateResult = await pool.query<{ observed_date: string }>(
    `
      select max(observed_date)::text as observed_date
      from ebay_listing_samples
      where card_id = $1
        and observed_date < $2
        and is_candidate_floor = true
    `,
    [cardId, snapshotDate],
  );
  const previousDate = previousDateResult.rows[0]?.observed_date ?? null;
  const currentSamples = await getCandidateFloorItemIds(cardId, snapshotDate);
  if (!previousDate) {
    return {
      previousFloorSampleCount: 0,
      currentFloorSampleCount: currentSamples.size,
      absorbedCount: 0,
      absorbedRatioPct: null,
    };
  }

  const previousSamples = await getCandidateFloorItemIds(cardId, previousDate);
  let absorbedCount = 0;
  for (const itemId of previousSamples) {
    if (!currentSamples.has(itemId)) {
      absorbedCount += 1;
    }
  }

  return {
    previousFloorSampleCount: previousSamples.size,
    currentFloorSampleCount: currentSamples.size,
    absorbedCount,
    absorbedRatioPct:
      previousSamples.size === 0 ? null : round((absorbedCount / previousSamples.size) * 100),
  };
}

async function getCandidateFloorItemIds(cardId: number, observedDate: string): Promise<Set<string>> {
  const result = await pool.query<{ ebay_item_id: string }>(
    `
      select ebay_item_id
      from ebay_listing_samples
      where card_id = $1
        and observed_date = $2
        and is_candidate_floor = true
    `,
    [cardId, observedDate],
  );

  return new Set(result.rows.map((row) => row.ebay_item_id));
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

  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
  return round((Math.sqrt(variance) / average) * 100);
}

function calculateSustainedMoveScore(
  change7d: number | null,
  change30d: number | null,
  volatility7d: number | null,
): number {
  const positive7d = Math.max(change7d ?? 0, 0);
  const positive30d = Math.max(change30d ?? 0, 0);
  let score = positive7d * 4 + positive30d * 2;

  if (positive30d < 5) {
    score *= 0.55;
  }

  if ((change7d ?? 0) > 25 && (change30d ?? 0) < (change7d ?? 0) * 0.6) {
    score -= 15;
  }

  if ((volatility7d ?? 0) > 18) {
    score -= ((volatility7d ?? 0) - 18) * 1.5;
  }

  return round(clamp(score, 0, 100));
}

function calculateInventorySqueezeScore(
  floorChange7d: number | null,
  inventoryChange7d: number | null,
  currentFloorCount: number | null,
  previousFloorCount: number | null,
): number {
  const inventoryTightening = Math.max(-(inventoryChange7d ?? 0), 0);
  const floorCountChange = percentChange(currentFloorCount, previousFloorCount);
  const floorCountTightening = Math.max(-(floorCountChange ?? 0), 0);
  const priceSupport = Math.max(floorChange7d ?? 0, 0);

  return round(clamp(inventoryTightening * 3 + floorCountTightening * 1.5 + priceSupport * 0.7, 0, 100));
}

function calculateAuctionLagScore(auctionPriceVsFloorPct: number | null, floorChange7d: number | null): number {
  const lagPct = Math.max(-(auctionPriceVsFloorPct ?? 0), 0);
  const moveSupport = Math.max(floorChange7d ?? 0, 0);
  let score = lagPct <= 15 ? lagPct * 6 : 90 - Math.min((lagPct - 15) * 3, 30);
  score += moveSupport * 0.4;

  return round(clamp(score, 0, 100));
}

function calculateAbsorptionScore(
  absorption: ListingAbsorptionStats,
  freshLowCount24h: number | null,
  floorChange7d: number | null,
): number {
  const absorbedRatio = absorption.absorbedRatioPct ?? 0;
  let score = absorbedRatio * 0.7 + (freshLowCount24h ?? 0) * 7;

  if ((floorChange7d ?? 0) <= 0) {
    score *= 0.7;
  }

  return round(clamp(score, 0, 100));
}

function calculateStabilityScore(
  floorQualityScore: number | null,
  sampledBinCount: number | null,
  sellerConcentrationTop3Pct: number | null,
): number {
  const quality = floorQualityScore ?? 0;
  const sampleDepthScore = clamp((sampledBinCount ?? 0) / 10, 0, 1) * 30;
  const concentrationPenalty = Math.max((sellerConcentrationTop3Pct ?? 0) - 65, 0) * 0.7;

  return round(clamp(quality * 0.7 + sampleDepthScore - concentrationPenalty, 0, 100));
}

function calculateQueryConfidenceScore(rawPayload: unknown, sampledBinCount: number | null): number {
  const payload = asRecord(rawPayload);
  const filters = asRecord(payload?.filters);
  const bin = asRecord(filters?.bin);
  const total = toNumberValue(bin?.total);
  const kept = toNumberValue(bin?.priceSanityKept) ?? toNumberValue(bin?.kept);
  const sampledDepthBoost = clamp((sampledBinCount ?? 0) / 8, 0, 1) * 10;

  if (total === null || total <= 0 || kept === null) {
    return round(clamp(55 + sampledDepthBoost, 0, 100));
  }

  return round(clamp((kept / total) * 90 + sampledDepthBoost, 0, 100));
}

function calculateConfidenceScore(
  queryConfidenceScore: number,
  stabilityScore: number,
  sampledBinCount: number | null,
  floorQualityScore: number | null,
): number {
  const sampleDepthScore = clamp((sampledBinCount ?? 0) / 10, 0, 1) * 100;
  const floorQuality = floorQualityScore ?? 0;

  return round(
    clamp(
      queryConfidenceScore * 0.35 +
        stabilityScore * 0.25 +
        sampleDepthScore * 0.2 +
        floorQuality * 0.2,
      0,
      100,
    ),
  );
}

function isHistoryDistorted(change7d: number | null, change30d: number | null): boolean {
  return (change7d ?? 0) > 250 || (change30d ?? 0) > 400;
}

function buildReasonCodes(input: {
  ebayFloorChange7dPct: number | null;
  ebayFloorChange30dPct: number | null;
  inventoryChange7dPct: number | null;
  auctionPriceVsFloorPct: number | null;
  absorption: ListingAbsorptionStats;
  confidenceScore: number;
  queryConfidenceScore: number;
  current: HistoricalSnapshotRow;
  distortedHistory: boolean;
}): string[] {
  const reasons: string[] = [];

  if ((input.ebayFloorChange7dPct ?? 0) > 0) {
    reasons.push(`7d market +${formatPct(input.ebayFloorChange7dPct)}`);
  }
  if ((input.ebayFloorChange30dPct ?? 0) > 0) {
    reasons.push(`30d market +${formatPct(input.ebayFloorChange30dPct)}`);
  }
  if ((input.inventoryChange7dPct ?? 0) < 0) {
    reasons.push(`inventory ${formatPct(input.inventoryChange7dPct)} in 7d`);
  }
  if ((input.auctionPriceVsFloorPct ?? 0) < 0) {
    reasons.push(`auctions ${formatPct(input.auctionPriceVsFloorPct)} vs market`);
  } else if (input.current.median_auction_current_price === null) {
    reasons.push('auction signal unavailable (no near-end auctions)');
  }
  if ((input.absorption.absorbedRatioPct ?? 0) >= 30) {
    reasons.push(`cheap copies absorbed ${formatPct(input.absorption.absorbedRatioPct)}`);
  }
  if ((input.current.fresh_low_count_24h ?? 0) > 0) {
    reasons.push(`${input.current.fresh_low_count_24h} fresh low listings in 24h`);
  }
  if ((input.current.seller_concentration_top3_pct ?? 0) >= 80) {
    reasons.push('seller concentration elevated');
  }
  if (input.distortedHistory) {
    reasons.push('history baseline needs refresh');
  }
  if (input.queryConfidenceScore < 60) {
    reasons.push('query confidence reduced');
  }
  if (input.confidenceScore < 60) {
    reasons.push('low confidence');
  }

  return reasons.slice(0, 6);
}

function formatPct(value: number | null): string {
  if (value === null) {
    return 'n/a';
  }

  const rounded = round(value);
  return `${rounded > 0 ? '+' : ''}${rounded}%`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function toNumberValue(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}
