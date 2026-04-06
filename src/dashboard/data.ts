import { pool } from '../db/pool';
import type { LatestListingDebug, ListingDebugEntry, ListingDebugGroup } from '../types';

export interface DashboardFilters {
  game?: string;
  language?: string;
  marketSegment?: string;
}

export interface DashboardSummary {
  latestSignalDate: string | null;
  trackedCards: number;
  cardsWithSignals: number;
  spikeFlags: number;
  averageTrendScore: number | null;
  averageLocalLagScore: number | null;
  filters: {
    games: string[];
    languages: string[];
    marketSegments: string[];
  };
}

export interface OpportunityRow {
  id: number;
  game: string;
  language: string;
  marketSegment: string;
  condition: string;
  name: string;
  setName: string;
  cardNumber: string;
  variant: string;
  tags: string[];
  ebayFloor: number | null;
  totalBinCount: number;
  auctionCount: number;
  ebayFloorChange7dPct: number | null;
  ebayFloorChange30dPct: number | null;
  trendScore: number;
  localLagScore: number;
  spikeFlag: boolean;
}

export interface WatchlistCard {
  id: number;
  game: string;
  language: string;
  marketSegment: string;
  condition: string;
  name: string;
  setName: string;
  cardNumber: string;
  variant: string;
  tags: string[];
  lastSignalDate: string | null;
  trendScore: number | null;
  localLagScore: number | null;
  floorBin: number | null;
  totalBinCount: number | null;
}

export interface CardHistoryPoint {
  snapshotDate: string;
  floorBin: number | null;
  totalBinCount: number;
  auctionCount: number;
  medianAuctionCurrentPrice: number | null;
  trendScore: number | null;
  localLagScore: number | null;
  spikeFlag: boolean | null;
}

export interface CardDetail {
  id: number;
  game: string;
  language: string;
  marketSegment: string;
  condition: string;
  productType: string;
  name: string;
  setName: string;
  cardNumber: string;
  rarity: string | null;
  variant: string;
  ebayQuery: string;
  tags: string[];
  history: CardHistoryPoint[];
  latestListingDebug: LatestListingDebug | null;
}

export async function getDashboardSummary(filters: DashboardFilters): Promise<DashboardSummary> {
  const latestSignalDate = await getLatestSignalDate(filters);
  const filterOptions = await getFilterOptions();
  const whereCards = buildCardFilterClause(filters, 1);
  const trackedCardsResult = await pool.query<{ count: string }>(
    `select count(*)::text as count from cards c ${whereCards.clause}`,
    whereCards.params,
  );

  if (!latestSignalDate) {
    return {
      latestSignalDate: null,
      trackedCards: Number(trackedCardsResult.rows[0]?.count ?? 0),
      cardsWithSignals: 0,
      spikeFlags: 0,
      averageTrendScore: null,
      averageLocalLagScore: null,
      filters: filterOptions,
    };
  }

  const whereSignals = buildCardFilterClause(filters, 2);
  const statsResult = await pool.query<{
    cards_with_signals: string;
    spike_flags: string;
    average_trend_score: string | null;
    average_local_lag_score: string | null;
  }>(
    `
      select
        count(*)::text as cards_with_signals,
        count(*) filter (where s.spike_flag)::text as spike_flags,
        round(avg(s.trend_score)::numeric, 2) as average_trend_score,
        round(avg(s.local_lag_score)::numeric, 2) as average_local_lag_score
      from signals_daily s
      inner join cards c on c.id = s.card_id
      where s.signal_date = $1
      ${whereSignals.clause ? `and ${whereSignals.clause.slice(6)}` : ''}
    `,
    [latestSignalDate, ...whereSignals.params],
  );

  return {
    latestSignalDate,
    trackedCards: Number(trackedCardsResult.rows[0]?.count ?? 0),
    cardsWithSignals: Number(statsResult.rows[0]?.cards_with_signals ?? 0),
    spikeFlags: Number(statsResult.rows[0]?.spike_flags ?? 0),
    averageTrendScore: toNullableNumber(statsResult.rows[0]?.average_trend_score),
    averageLocalLagScore: toNullableNumber(statsResult.rows[0]?.average_local_lag_score),
    filters: filterOptions,
  };
}

export async function getLatestOpportunities(
  filters: DashboardFilters,
  limit = 18,
): Promise<OpportunityRow[]> {
  const latestSignalDate = await getLatestSignalDate(filters);
  if (!latestSignalDate) {
    return [];
  }

  const where = buildCardFilterClause(filters, 2);
  const result = await pool.query<{
    id: number;
    game: string;
    language: string;
    market_segment: string;
    condition: string;
    name: string;
    set_name: string;
    card_number: string;
    variant: string;
    tags: string[];
    ebay_floor: string | null;
    total_bin_count: number;
    auction_count: number;
    ebay_floor_change_7d_pct: string | null;
    ebay_floor_change_30d_pct: string | null;
    trend_score: string;
    local_lag_score: string;
    spike_flag: boolean;
  }>(
    `
      select
        c.id,
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
        coalesce(e.total_bin_count, 0) as total_bin_count,
        coalesce(e.auction_count, 0) as auction_count,
        s.ebay_floor_change_7d_pct,
        s.ebay_floor_change_30d_pct,
        s.trend_score,
        s.local_lag_score,
        s.spike_flag
      from signals_daily s
      inner join cards c on c.id = s.card_id
      left join ebay_daily e
        on e.card_id = s.card_id
       and e.snapshot_date = s.signal_date
      where s.signal_date = $1
      ${where.clause ? `and ${where.clause.slice(6)}` : ''}
      order by s.trend_score desc, s.local_lag_score desc, c.name asc
      limit $${where.params.length + 2}
    `,
    [latestSignalDate, ...where.params, limit],
  );

  return result.rows.map((row) => ({
    id: row.id,
    game: row.game,
    language: row.language,
    marketSegment: row.market_segment,
    condition: row.condition,
    name: row.name,
    setName: row.set_name,
    cardNumber: row.card_number,
    variant: row.variant,
    tags: row.tags ?? [],
    ebayFloor: toNullableNumber(row.ebay_floor),
    totalBinCount: row.total_bin_count,
    auctionCount: row.auction_count,
    ebayFloorChange7dPct: toNullableNumber(row.ebay_floor_change_7d_pct),
    ebayFloorChange30dPct: toNullableNumber(row.ebay_floor_change_30d_pct),
    trendScore: toNumberOrZero(row.trend_score),
    localLagScore: toNumberOrZero(row.local_lag_score),
    spikeFlag: row.spike_flag,
  }));
}

export async function getWatchlistCards(filters: DashboardFilters): Promise<WatchlistCard[]> {
  const where = buildCardFilterClause(filters, 1);
  const result = await pool.query<{
    id: number;
    game: string;
    language: string;
    market_segment: string;
    condition: string;
    name: string;
    set_name: string;
    card_number: string;
    variant: string;
    tags: string[];
    last_signal_date: string | null;
    trend_score: string | null;
    local_lag_score: string | null;
    floor_bin: string | null;
    total_bin_count: number | null;
  }>(
    `
      select
        c.id,
        c.game,
        c.language,
        c.market_segment,
        c.condition,
        c.name,
        c.set_name,
        c.card_number,
        c.variant,
        c.tags,
        latest_signal.signal_date::text as last_signal_date,
        latest_signal.trend_score,
        latest_signal.local_lag_score,
        latest_market.floor_bin,
        latest_market.total_bin_count
      from cards c
      left join lateral (
        select s.signal_date, s.trend_score, s.local_lag_score
        from signals_daily s
        where s.card_id = c.id
        order by s.signal_date desc
        limit 1
      ) latest_signal on true
      left join lateral (
        select e.floor_bin, e.total_bin_count
        from ebay_daily e
        where e.card_id = c.id
        order by e.snapshot_date desc
        limit 1
      ) latest_market on true
      ${where.clause}
      order by c.game asc, c.language asc, latest_signal.trend_score desc nulls last, c.name asc
    `,
    where.params,
  );

  return result.rows.map((row) => ({
    id: row.id,
    game: row.game,
    language: row.language,
    marketSegment: row.market_segment,
    condition: row.condition,
    name: row.name,
    setName: row.set_name,
    cardNumber: row.card_number,
    variant: row.variant,
    tags: row.tags ?? [],
    lastSignalDate: row.last_signal_date,
    trendScore: toNullableNumber(row.trend_score),
    localLagScore: toNullableNumber(row.local_lag_score),
    floorBin: toNullableNumber(row.floor_bin),
    totalBinCount: row.total_bin_count,
  }));
}

export async function getCardDetail(cardId: number): Promise<CardDetail | null> {
  const cardResult = await pool.query<{
    id: number;
    game: string;
    language: string;
    product_type: string;
    market_segment: string;
    condition: string;
    name: string;
    set_name: string;
    card_number: string;
    rarity: string | null;
    variant: string;
    ebay_query: string;
    tags: string[];
  }>(
    `
      select
        id,
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
        tags
      from cards
      where id = $1
      limit 1
    `,
    [cardId],
  );

  const row = cardResult.rows[0];
  if (!row) {
    return null;
  }

  const historyResult = await pool.query<{
    snapshot_date: string;
    floor_bin: string | null;
    total_bin_count: number;
    auction_count: number;
    median_auction_current_price: string | null;
    trend_score: string | null;
    local_lag_score: string | null;
    spike_flag: boolean | null;
  }>(
    `
      select
        e.snapshot_date::text as snapshot_date,
        e.floor_bin,
        e.total_bin_count,
        e.auction_count,
        e.median_auction_current_price,
        s.trend_score,
        s.local_lag_score,
        s.spike_flag
      from ebay_daily e
      left join signals_daily s
        on s.card_id = e.card_id
       and s.signal_date = e.snapshot_date
      where e.card_id = $1
      order by e.snapshot_date desc
      limit 30
    `,
    [cardId],
  );

  const latestDebugResult = await pool.query<{
    snapshot_date: string;
    query_used: string;
    raw_payload: unknown;
  }>(
    `
      select
        snapshot_date::text as snapshot_date,
        query_used,
        raw_payload
      from ebay_daily
      where card_id = $1
      order by snapshot_date desc
      limit 1
    `,
    [cardId],
  );

  const latestDebugRow = latestDebugResult.rows[0];

  return {
    id: row.id,
    game: row.game,
    language: row.language,
    marketSegment: row.market_segment,
    condition: row.condition,
    productType: row.product_type,
    name: row.name,
    setName: row.set_name,
    cardNumber: row.card_number,
    rarity: row.rarity,
    variant: row.variant,
    ebayQuery: row.ebay_query,
    tags: row.tags ?? [],
    history: historyResult.rows
      .map((historyRow) => ({
        snapshotDate: historyRow.snapshot_date,
        floorBin: toNullableNumber(historyRow.floor_bin),
        totalBinCount: historyRow.total_bin_count,
        auctionCount: historyRow.auction_count,
        medianAuctionCurrentPrice: toNullableNumber(historyRow.median_auction_current_price),
        trendScore: toNullableNumber(historyRow.trend_score),
        localLagScore: toNullableNumber(historyRow.local_lag_score),
        spikeFlag: historyRow.spike_flag,
      }))
      .reverse(),
    latestListingDebug: latestDebugRow
      ? parseLatestListingDebug(latestDebugRow.snapshot_date, latestDebugRow.query_used, latestDebugRow.raw_payload)
      : null,
  };
}

async function getFilterOptions(): Promise<{ games: string[]; languages: string[]; marketSegments: string[] }> {
  const result = await pool.query<{ game: string; language: string; market_segment: string }>(
    `
      select distinct game, language, market_segment
      from cards
      order by game asc, language asc, market_segment asc
    `,
  );

  return {
    games: [...new Set(result.rows.map((row) => row.game))],
    languages: [...new Set(result.rows.map((row) => row.language))],
    marketSegments: [...new Set(result.rows.map((row) => row.market_segment))],
  };
}

async function getLatestSignalDate(filters: DashboardFilters): Promise<string | null> {
  const where = buildCardFilterClause(filters, 1);
  const result = await pool.query<{ latest_signal_date: string | null }>(
    `
      select max(s.signal_date)::text as latest_signal_date
      from signals_daily s
      inner join cards c on c.id = s.card_id
      ${where.clause}
    `,
    where.params,
  );

  return result.rows[0]?.latest_signal_date ?? null;
}

function buildCardFilterClause(
  filters: DashboardFilters,
  startingIndex: number,
): { clause: string; params: string[] } {
  const clauses: string[] = [];
  const params: string[] = [];

  if (filters.game && filters.game !== 'all') {
    params.push(filters.game);
    clauses.push(`c.game = $${startingIndex + params.length - 1}`);
  }

  if (filters.language && filters.language !== 'all') {
    params.push(filters.language);
    clauses.push(`c.language = $${startingIndex + params.length - 1}`);
  }

  if (filters.marketSegment && filters.marketSegment !== 'all') {
    params.push(filters.marketSegment);
    clauses.push(`c.market_segment = $${startingIndex + params.length - 1}`);
  }

  return {
    clause: clauses.length > 0 ? `where ${clauses.join(' and ')}` : '',
    params,
  };
}

function toNullableNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseLatestListingDebug(
  snapshotDate: string,
  queryUsed: string,
  rawPayload: unknown,
): LatestListingDebug | null {
  const payload = asRecord(rawPayload);
  const filters = asRecord(payload?.filters);
  const fixedPrice = asRecord(payload?.fixedPrice);
  const auctions = asRecord(payload?.auctions);

  if (!filters || !fixedPrice || !auctions) {
    return null;
  }

  const binFilter = asRecord(filters.bin);
  const auctionFilter = asRecord(filters.auctions);

  if (!binFilter || !auctionFilter) {
    return null;
  }

  const fixedPriceItems = asArray(fixedPrice.itemSummaries);
  const auctionItems = asArray(auctions.itemSummaries);

  return {
    snapshotDate,
    queryUsed,
    fixedPriceKept: buildKeptGroup(
      'BIN kept',
      toNumberValue(binFilter.priceSanityKept) ?? toNumberValue(binFilter.kept) ?? 0,
      fixedPriceItems,
      buildBinRejectedTitleSet(binFilter),
      false,
    ),
    fixedPriceRejected: buildRejectedGroup(
      'BIN rejected',
      toNumberValue(binFilter.total) ?? fixedPriceItems.length,
      binFilter,
      fixedPriceItems,
    ),
    auctionKept: buildKeptGroup(
      'Auctions kept',
      toNumberValue(auctionFilter.kept) ?? 0,
      auctionItems,
      buildRejectedTitleSet(auctionFilter.rejected),
      true,
    ),
    auctionRejected: buildRejectedGroup(
      'Auctions rejected',
      toNumberValue(auctionFilter.total) ?? auctionItems.length,
      auctionFilter,
      auctionItems,
    ),
  };
}

function buildKeptGroup(
  label: string,
  keptCount: number,
  items: unknown[],
  rejectedTitles: Set<string>,
  useCurrentBidPrice: boolean,
): ListingDebugGroup {
  const entries = items
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => item !== null)
    .filter((item) => !rejectedTitles.has(String(item.title ?? '(untitled listing)')))
    .map((item) => ({
      title: String(item.title ?? '(untitled listing)'),
      price: extractListingPrice(item, useCurrentBidPrice),
      reason: null,
      daysLeft: useCurrentBidPrice ? extractDaysLeft(item.itemEndDate) : null,
      imageUrl: extractImageUrl(item.image),
      itemWebUrl: extractStringValue(item.itemWebUrl),
    }));

  if (useCurrentBidPrice) {
    entries.sort((left, right) => compareDaysLeft(left.daysLeft, right.daysLeft));
  } else {
    entries.sort((left, right) => compareNullablePrice(left.price, right.price));
  }

  return {
    label,
    total: keptCount,
    kept: keptCount,
    entries: entries.slice(0, 12),
  };
}

function buildRejectedGroup(
  label: string,
  total: number,
  filterRecord: Record<string, unknown>,
  sourceItems: unknown[] = [],
): ListingDebugGroup {
  const sourceLookup = buildSourceItemLookup(sourceItems, label.toLowerCase().includes('auction'));

  const titleRejections = asArray(filterRecord.rejected).map((entry) => {
    const record = asRecord(entry);
    const title = String(record?.title ?? '(untitled listing)');
    const source = sourceLookup.get(title);
    return {
      title,
      price: source?.price ?? null,
      reason: String(record?.reason ?? 'rejected'),
      daysLeft: null,
      imageUrl: source?.imageUrl ?? null,
      itemWebUrl: source?.itemWebUrl ?? null,
    };
  });

  const priceRejections = asArray(filterRecord.priceSanityRejected).map((entry) => {
    const record = asRecord(entry);
    const title = String(record?.title ?? '(untitled listing)');
    const source = sourceLookup.get(title);
    return {
      title,
      price: toNumberValue(record?.price) ?? source?.price ?? null,
      reason: String(record?.reason ?? 'price_outlier'),
      daysLeft: null,
      imageUrl: source?.imageUrl ?? null,
      itemWebUrl: source?.itemWebUrl ?? null,
    };
  });

  const entries = [...titleRejections, ...priceRejections].slice(0, 16);

  return {
    label,
    total: entries.length,
    kept: 0,
    entries,
  };
}

function buildSourceItemLookup(
  sourceItems: unknown[],
  useCurrentBidPrice: boolean,
): Map<string, { price: number | null; imageUrl: string | null; itemWebUrl: string | null }> {
  const lookup = new Map<string, { price: number | null; imageUrl: string | null; itemWebUrl: string | null }>();

  for (const item of sourceItems) {
    const record = asRecord(item);
    if (!record) {
      continue;
    }

    const title = String(record.title ?? '(untitled listing)');
    if (lookup.has(title)) {
      continue;
    }

    lookup.set(title, {
      price: extractListingPrice(record, useCurrentBidPrice),
      imageUrl: extractImageUrl(record.image),
      itemWebUrl: extractStringValue(record.itemWebUrl),
    });
  }

  return lookup;
}

function buildBinRejectedTitleSet(filterRecord: Record<string, unknown>): Set<string> {
  return new Set([
    ...Array.from(buildRejectedTitleSet(filterRecord.rejected)),
    ...asArray(filterRecord.priceSanityRejected).map((entry) => String(asRecord(entry)?.title ?? '(untitled listing)')),
  ]);
}

function buildRejectedTitleSet(rejections: unknown): Set<string> {
  return new Set(asArray(rejections).map((entry) => String(asRecord(entry)?.title ?? '(untitled listing)')));
}

function extractListingPrice(item: Record<string, unknown>, useCurrentBidPrice: boolean): number | null {
  const priceRecord = asRecord(useCurrentBidPrice ? item.currentBidPrice : item.price);
  const shippingOptions = asArray(item.shippingOptions);
  const firstShipping = asRecord(shippingOptions[0]);
  const shippingCost = asRecord(firstShipping?.shippingCost);
  const price = toNumberValue(priceRecord?.value);
  const shipping = toNumberValue(shippingCost?.value) ?? 0;

  if (price === null) {
    return null;
  }

  return Math.round((price + shipping) * 100) / 100;
}

function extractDaysLeft(value: unknown): number | null {
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }

  const endAt = new Date(value);
  const endTimestamp = endAt.getTime();
  if (!Number.isFinite(endTimestamp)) {
    return null;
  }

  const diffMs = endTimestamp - Date.now();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.ceil(diffDays));
}

function compareDaysLeft(left: number | null, right: number | null): number {
  if (left === null && right === null) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return left - right;
}

function compareNullablePrice(left: number | null, right: number | null): number {
  if (left === null && right === null) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return left - right;
}

function extractImageUrl(value: unknown): string | null {
  const image = asRecord(value);
  return extractStringValue(image?.imageUrl);
}

function extractStringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toNumberValue(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNumberOrZero(value: string | number | null | undefined): number {
  return toNullableNumber(value) ?? 0;
}
