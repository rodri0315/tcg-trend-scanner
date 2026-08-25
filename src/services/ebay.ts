import axios from 'axios';

import { config } from '../config';
import { pool } from '../db/pool';
import { deriveMarketPriceMetrics, type PreparedListingSample } from './marketPricing';
import { getListingIdentityRejectionReason, normalizeText } from './listingIdentity';
import { isThinMarketHistoricalOutlier } from './priceSanity';
import type { Card, EbaySnapshot } from '../types';
import { median, round, toNumber } from '../utils/math';

interface EbayAuthResponse {
  access_token: string;
}

interface EbayPrice {
  value?: string;
}

interface EbayShippingOption {
  shippingCost?: EbayPrice;
}

interface EbayItemSummary {
  itemId?: string;
  title?: string;
  buyingOptions?: string[];
  price?: EbayPrice;
  shippingOptions?: EbayShippingOption[];
  currentBidPrice?: EbayPrice;
  bidCount?: number;
  itemEndDate?: string;
  itemCreationDate?: string;
  condition?: string;
  conditionId?: string;
  itemHref?: string;
  itemWebUrl?: string;
  seller?: {
    username?: string;
  };
}

interface EbaySearchResponse {
  total?: number;
  itemSummaries?: EbayItemSummary[];
}

interface EbayNameValue {
  name?: string;
  value?: string;
  values?: Array<{ content?: string }>;
}

interface EbayItemDetail {
  condition?: string;
  conditionId?: string;
  localizedAspects?: EbayNameValue[];
  conditionDescriptors?: EbayNameValue[];
}

interface AuctionUsageDecision {
  usableItems: EbayItemSummary[];
  rejected: Array<{ title: string; reason: string; price: number | null }>;
}

const AUCTION_END_WINDOW_HOURS = 12;

export async function fetchEbaySnapshots(cards: Card[], snapshotDate: string): Promise<EbaySnapshot[]> {
  if (!config.ebayClientId || !config.ebayClientSecret) {
    throw new Error('eBay credentials are required to fetch daily snapshots.');
  }

  const accessToken = await getEbayAccessToken();
  const snapshots: EbaySnapshot[] = [];
  const observedAt = new Date(`${snapshotDate}T12:00:00.000Z`).toISOString();
  const historicalReferences = await getHistoricalMarketReferences(cards, snapshotDate);

  for (const card of cards) {
    const [binResponse, auctionResponse] = await Promise.all([
      searchEbay(card.ebayQuery, accessToken, 'FIXED_PRICE'),
      searchEbay(card.ebayQuery, accessToken, 'AUCTION'),
    ]);

    const rawBinItems = binResponse.itemSummaries ?? [];
    const rawAuctionItems = auctionResponse.itemSummaries ?? [];
    const filteredBin = await filterEbayItems(card, rawBinItems, accessToken, 'FIXED_PRICE');
    const filteredAuction = await filterEbayItems(card, rawAuctionItems, accessToken, 'AUCTION');
    const preliminaryAuctionMedian = median(
      filteredAuction.items
        .map((item) => totalListingPrice(item.currentBidPrice?.value, item.shippingOptions))
        .filter((value): value is number => value !== null),
    );
    const historicalReference = historicalReferences.get(card.id) ?? null;
    const saneBin = filterBinPriceOutliers(
      card,
      filteredBin.items,
      preliminaryAuctionMedian,
      historicalReference,
    );
    const binItems = saneBin.items;
    const sampledBinListings = binItems.slice(0, 30).map((item, index) => buildPreparedListingSample(item, 'BIN', index));
    const marketMetrics = deriveMarketPriceMetrics(sampledBinListings, snapshotDate);
    const auctionUsage = selectUsableAuctions(card, filteredAuction.items, marketMetrics.activeAskReference ?? marketMetrics.floorBin);
    const auctionItems = auctionUsage.usableItems;
    const medianAuctionCurrentPrice = median(
      auctionItems
        .map((item) => totalListingPrice(item.currentBidPrice?.value, item.shippingOptions))
        .filter((value): value is number => value !== null),
    );
    const sampledAuctionListings = auctionItems
      .slice()
      .sort(
        (left, right) =>
          (totalListingPrice(left.currentBidPrice?.value, left.shippingOptions) ?? Number.MAX_SAFE_INTEGER) -
          (totalListingPrice(right.currentBidPrice?.value, right.shippingOptions) ?? Number.MAX_SAFE_INTEGER),
      )
      .slice(0, 20)
      .map((item, index) => buildPreparedListingSample(item, 'AUCTION', index));
    const listingSamples = [
      ...toListingSamples(card, observedAt, snapshotDate, sampledBinListings, marketMetrics.candidateFloorItemIds),
      ...toListingSamples(card, observedAt, snapshotDate, sampledAuctionListings, new Set<string>()),
    ];

    snapshots.push({
      cardId: card.id,
      snapshotDate,
      snapshotSource: 'live',
      floorBin: marketMetrics.floorBin,
      floorBinCount: marketMetrics.floorBinCount,
      totalBinCount: binItems.length,
      auctionCount: auctionItems.length,
      medianAuctionBidCount: median(
        auctionItems
          .map((item) => toNumber(item.bidCount))
          .filter((value): value is number => value !== null),
      ),
      medianAuctionCurrentPrice,
      activeAskLow: marketMetrics.activeAskLow,
      activeAskHigh: marketMetrics.activeAskHigh,
      activeAskReference: marketMetrics.activeAskReference,
      activeAskSellerCount: marketMetrics.activeAskSellerCount,
      marketPriceEstimate: marketMetrics.marketPriceEstimate,
      marketPriceMethod: marketMetrics.marketPriceMethod,
      floorQualityScore: marketMetrics.floorQualityScore,
      sampledBinCount: sampledBinListings.length,
      sampledAuctionCount: sampledAuctionListings.length,
      sellerConcentrationTop3Pct: marketMetrics.sellerConcentrationTop3Pct,
      freshLowCount24h: marketMetrics.freshLowCount24h,
      newBinCount24h: marketMetrics.newBinCount24h,
      queryUsed: card.ebayQuery,
      rawPayload: {
        marketPricing: {
          semantics: 'active_asking_prices_not_confirmed_sales',
          activeAskLow: marketMetrics.activeAskLow,
          activeAskHigh: marketMetrics.activeAskHigh,
          activeAskReference: marketMetrics.activeAskReference,
          activeAskSellerCount: marketMetrics.activeAskSellerCount,
          estimate: marketMetrics.marketPriceEstimate,
          method: marketMetrics.marketPriceMethod,
          floorQualityScore: marketMetrics.floorQualityScore,
          sampledBinCount: sampledBinListings.length,
          sampledAuctionCount: sampledAuctionListings.length,
          sellerConcentrationTop3Pct: marketMetrics.sellerConcentrationTop3Pct,
          historicalReference,
        },
        filters: {
          bin: {
            total: rawBinItems.length,
            kept: filteredBin.items.length,
            rejected: filteredBin.rejections,
            priceSanityKept: saneBin.items.length,
            priceSanityRejected: saneBin.rejections,
          },
          auctions: {
            total: rawAuctionItems.length,
            kept: auctionItems.length,
            preUsageKept: filteredAuction.items.length,
            rejected: [
              ...filteredAuction.rejections.map((entry) => ({
                title: entry.title,
                reason: entry.reason,
                price: null,
              })),
              ...auctionUsage.rejected,
            ],
          },
        },
        fixedPrice: binResponse,
        auctions: auctionResponse,
      },
      listingSamples,
    });
  }

  return snapshots;
}

function selectUsableAuctions(
  card: Card,
  items: EbayItemSummary[],
  marketReference: number | null,
): AuctionUsageDecision {
  const usableItems: EbayItemSummary[] = [];
  const rejected: Array<{ title: string; reason: string; price: number | null }> = [];
  const minimumRatio = getAuctionMinimumBidRatio(card.marketSegment);

  for (const item of items) {
    const totalPrice = totalListingPrice(item.currentBidPrice?.value, item.shippingOptions);
    if (!isAuctionEndingSoon(item.itemEndDate)) {
      rejected.push({
        title: item.title ?? '(untitled listing)',
        reason: 'auction_not_near_end',
        price: totalPrice,
      });
      continue;
    }

    if (
      marketReference !== null &&
      marketReference > 0 &&
      totalPrice !== null &&
      totalPrice < round(marketReference * minimumRatio)
    ) {
      rejected.push({
        title: item.title ?? '(untitled listing)',
        reason: 'auction_bid_below_market_floor',
        price: totalPrice,
      });
      continue;
    }

    usableItems.push(item);
  }

  return { usableItems, rejected };
}

function isAuctionEndingSoon(itemEndDate: string | undefined): boolean {
  if (!itemEndDate) {
    return false;
  }

  const endTime = Date.parse(itemEndDate);
  if (!Number.isFinite(endTime)) {
    return false;
  }

  const hoursRemaining = (endTime - Date.now()) / (1000 * 60 * 60);
  return hoursRemaining >= 0 && hoursRemaining <= AUCTION_END_WINDOW_HOURS;
}

function getAuctionMinimumBidRatio(marketSegment: string): number {
  return marketSegment === 'psa_10' ? 0.35 : 0.2;
}

function buildPreparedListingSample(
  item: EbayItemSummary,
  listingType: 'BIN' | 'AUCTION',
  index: number,
): PreparedListingSample {
  const listingPrice =
    listingType === 'AUCTION'
      ? totalListingPrice(item.currentBidPrice?.value, item.shippingOptions)
      : totalListingPrice(item.price?.value, item.shippingOptions);
  const price =
    listingType === 'AUCTION'
      ? toNumber(item.currentBidPrice?.value) ?? listingPrice ?? 0
      : toNumber(item.price?.value) ?? listingPrice ?? 0;
  const shipping = listingPrice === null ? 0 : round(listingPrice - price);
  const itemWebUrl = item.itemWebUrl ?? item.itemHref ?? null;

  return {
    ebayItemId: item.itemId ?? itemWebUrl ?? `${listingType}-${index}-${item.title ?? 'listing'}`,
    title: item.title ?? '(untitled listing)',
    listingType,
    condition: item.condition ?? null,
    price,
    shipping,
    totalPrice: listingPrice ?? price,
    sellerKey: item.seller?.username?.trim().toLowerCase() ?? null,
    itemWebUrl,
    itemCreationDate: item.itemCreationDate ?? null,
    itemEndDate: item.itemEndDate ?? null,
  };
}

function toListingSamples(
  card: Card,
  observedAt: string,
  snapshotDate: string,
  listings: PreparedListingSample[],
  candidateFloorItemIds: Set<string>,
) {
  return listings.map((listing) => ({
    cardId: card.id,
    observedAt,
    observedDate: snapshotDate,
    ebayItemId: listing.ebayItemId,
    title: listing.title,
    listingType: listing.listingType,
    condition: listing.condition,
    price: listing.price,
    shipping: listing.shipping,
    totalPrice: listing.totalPrice,
    sellerKey: listing.sellerKey,
    itemWebUrl: listing.itemWebUrl,
    itemCreationDate: listing.itemCreationDate,
    itemEndDate: listing.itemEndDate,
    queryUsed: card.ebayQuery,
    isCandidateFloor: candidateFloorItemIds.has(listing.ebayItemId),
  }));
}

async function getEbayAccessToken(): Promise<string> {
  const credentials = Buffer.from(`${config.ebayClientId}:${config.ebayClientSecret}`).toString('base64');
  const payload = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: 'https://api.ebay.com/oauth/api_scope',
  });

  const response = await axios.post<EbayAuthResponse>(config.ebayAuthUrl, payload.toString(), {
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  if (!response.data.access_token) {
    throw new Error('eBay auth response did not include an access token.');
  }

  return response.data.access_token;
}

async function searchEbay(
  query: string,
  accessToken: string,
  buyingOption: 'FIXED_PRICE' | 'AUCTION',
): Promise<EbaySearchResponse> {
  const response = await axios.get<EbaySearchResponse>(`${config.ebayApiBaseUrl}/buy/browse/v1/item_summary/search`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-EBAY-C-MARKETPLACE-ID': config.ebayMarketplaceId,
    },
    params: {
      q: query,
      limit: 200,
      filter: `buyingOptions:{${buyingOption}},itemLocationCountry:US`,
    },
  });

  return response.data;
}

function totalListingPrice(priceValue: string | undefined, shippingOptions: EbayShippingOption[] | undefined): number | null {
  const price = toNumber(priceValue);
  if (price === null) {
    return null;
  }

  const shipping = toNumber(shippingOptions?.[0]?.shippingCost?.value) ?? 0;
  return round(price + shipping);
}

function filterBinPriceOutliers(
  card: Card,
  items: EbayItemSummary[],
  medianAuctionCurrentPrice: number | null,
  historicalReference: number | null,
): { items: EbayItemSummary[]; prices: number[]; rejections: Array<{ title: string; price: number; reason: string }> } {
  const pricedItems = items
    .map((item) => ({
      item,
      price: totalListingPrice(item.price?.value, item.shippingOptions),
    }))
    .filter((entry): entry is { item: EbayItemSummary; price: number } => entry.price !== null)
    .sort((left, right) => left.price - right.price);

  const rejections: Array<{ title: string; price: number; reason: string }> = [];

  if (pricedItems.length > 0 && pricedItems.length < 3 && historicalReference !== null) {
    for (let index = pricedItems.length - 1; index >= 0; index -= 1) {
      const candidate = pricedItems[index];
      if (
        isThinMarketHistoricalOutlier({
          currentPrice: candidate.price,
          currentSampleCount: pricedItems.length,
          historicalReference,
          marketSegment: card.marketSegment,
        })
      ) {
        rejections.push({
          title: candidate.item.title ?? '(untitled listing)',
          price: candidate.price,
          reason: `thin_market_historical_outlier:${candidate.price.toFixed(2)} vs historical=${historicalReference.toFixed(2)}`,
        });
        pricedItems.splice(index, 1);
      }
    }
  }

  while (pricedItems.length >= 2) {
    const clusterBoundary = findLowPriceClusterBoundary(pricedItems, card.marketSegment);
    if (clusterBoundary > 0) {
      const rejectedCluster = pricedItems.splice(0, clusterBoundary);
      const referencePrice = median(pricedItems.slice(0, Math.min(3, pricedItems.length)).map((entry) => entry.price)) ?? pricedItems[0]?.price ?? null;

      for (const rejected of rejectedCluster) {
        rejections.push({
          title: rejected.item.title ?? '(untitled listing)',
          price: rejected.price,
          reason: buildClusterOutlierReason(rejected.price, referencePrice, medianAuctionCurrentPrice),
        });
      }

      continue;
    }

    const candidate = pricedItems[0];
    const referencePrices = pricedItems.slice(1).map((entry) => entry.price);
    const next = referencePrices[0] ?? null;
    const referenceMedian = median(referencePrices);
    const priceSanityConfig = getPriceSanityConfig(card.marketSegment);
    const referenceAnchor =
      median(referencePrices.slice(0, Math.min(3, referencePrices.length))) ??
      referenceMedian ??
      next;
    const suspiciousVsNext =
      next !== null && candidate.price < round(next * priceSanityConfig.nextListingFloorRatio);
    const suspiciousVsReference =
      referenceAnchor !== null &&
      candidate.price < round(referenceAnchor * priceSanityConfig.referenceFloorRatio) &&
      referenceAnchor - candidate.price >= priceSanityConfig.minimumAbsoluteGap;
    const suspiciousVsAuctionMedian =
      medianAuctionCurrentPrice !== null &&
      candidate.price < round(medianAuctionCurrentPrice * priceSanityConfig.auctionMedianFloorRatio) &&
      medianAuctionCurrentPrice - candidate.price >= priceSanityConfig.minimumAbsoluteGap;

    if (!suspiciousVsNext || (!suspiciousVsReference && !suspiciousVsAuctionMedian)) {
      break;
    }

    rejections.push({
      title: candidate.item.title ?? '(untitled listing)',
      price: candidate.price,
      reason: buildPriceSanityReason(
        candidate.price,
        next,
        referenceAnchor,
        medianAuctionCurrentPrice,
      ),
    });
    pricedItems.shift();
  }

  return {
    items: pricedItems.map((entry) => entry.item),
    prices: pricedItems.map((entry) => entry.price),
    rejections,
  };
}

async function getHistoricalMarketReferences(cards: Card[], snapshotDate: string): Promise<Map<number, number>> {
  if (cards.length === 0) {
    return new Map<number, number>();
  }

  const result = await pool.query<{ active_ask_reference: string; card_id: number }>(
    `
      select distinct on (e.card_id)
        e.card_id,
        e.active_ask_reference
      from ebay_daily e
      where e.card_id = any($1::bigint[])
        and e.snapshot_date < $2
        and e.snapshot_source = 'live'
        and e.active_ask_reference is not null
        and e.sampled_bin_count >= 3
        and e.floor_quality_score >= 50
      order by e.card_id, e.snapshot_date desc
    `,
    [cards.map((card) => card.id), snapshotDate],
  );

  return new Map(
    result.rows.map((row) => [row.card_id, Number(row.active_ask_reference)]),
  );
}

function findLowPriceClusterBoundary(
  pricedItems: Array<{ item: EbayItemSummary; price: number }>,
  marketSegment: string,
): number {
  if (pricedItems.length < 2) {
    return 0;
  }

  const config = getPriceSanityConfig(marketSegment);
  const maxComparisons = Math.min(pricedItems.length - 1, DETAIL_VALIDATION_LIMIT);
  let bestBoundary = 0;
  let bestRatio = 0;

  for (let index = 0; index < maxComparisons; index += 1) {
    const lower = pricedItems[index]?.price;
    const upper = pricedItems[index + 1]?.price;
    if (lower === undefined || upper === undefined || lower <= 0) {
      continue;
    }

    const ratio = upper / lower;
    const absoluteGap = upper - lower;
    const referenceAnchor =
      median(pricedItems.slice(index + 1, index + 4).map((entry) => entry.price)) ??
      upper;

    const lowerClusterMax = pricedItems[index].price;
    const clearlyBelowReference =
      referenceAnchor > 0 &&
      lowerClusterMax < round(referenceAnchor * config.referenceFloorRatio) &&
      referenceAnchor - lowerClusterMax >= config.minimumAbsoluteGap;

    if (
      ratio >= config.clusterGapRatio &&
      absoluteGap >= config.clusterMinimumAbsoluteGap &&
      clearlyBelowReference &&
      ratio > bestRatio
    ) {
      bestBoundary = index + 1;
      bestRatio = ratio;
    }
  }

  return bestBoundary;
}

async function filterEbayItems(
  card: Card,
  items: EbayItemSummary[],
  accessToken: string,
  buyingOption: 'FIXED_PRICE' | 'AUCTION',
): Promise<{ items: EbayItemSummary[]; rejections: Array<{ title: string; reason: string }> }> {
  const kept: EbayItemSummary[] = [];
  const rejections: Array<{ title: string; reason: string }> = [];

  for (const item of items) {
    const reason = getListingRejectionReason(card, item);
    if (reason) {
      rejections.push({
        title: item.title ?? '(untitled listing)',
        reason,
      });
      continue;
    }

    kept.push(item);
  }

  if (kept.length === 0) {
    return { items: kept, rejections };
  }

  const detailValidated = await filterEbayItemsByDetail(card, kept, accessToken, buyingOption);
  rejections.push(...detailValidated.rejections);

  return { items: detailValidated.items, rejections };
}

async function filterEbayItemsByDetail(
  card: Card,
  items: EbayItemSummary[],
  accessToken: string,
  buyingOption: 'FIXED_PRICE' | 'AUCTION',
): Promise<{ items: EbayItemSummary[]; rejections: Array<{ title: string; reason: string }> }> {
  const candidateIndexes = selectDetailValidationIndexes(items, buyingOption);
  if (candidateIndexes.length === 0) {
    return { items, rejections: [] };
  }

  const details = await Promise.all(
    candidateIndexes.map(async (index) => {
      const item = items[index];
      if (!item.itemHref) {
        return { index, reason: null };
      }

      try {
        const detail = await getEbayItemDetail(item.itemHref, accessToken);
        return {
          index,
          reason: getDetailGradeRejectionReason(card, detail),
        };
      } catch {
        return { index, reason: null };
      }
    }),
  );

  const rejectedIndexes = new Set<number>();
  const rejections: Array<{ title: string; reason: string }> = [];

  for (const detail of details) {
    if (!detail.reason) {
      continue;
    }

    rejectedIndexes.add(detail.index);
    rejections.push({
      title: items[detail.index]?.title ?? '(untitled listing)',
      reason: detail.reason,
    });
  }

  return {
    items: items.filter((_, index) => !rejectedIndexes.has(index)),
    rejections,
  };
}

function selectDetailValidationIndexes(
  items: EbayItemSummary[],
  buyingOption: 'FIXED_PRICE' | 'AUCTION',
): number[] {
  const scored = items
    .map((item, index) => ({
      index,
      price:
        buyingOption === 'AUCTION'
          ? totalListingPrice(item.currentBidPrice?.value, item.shippingOptions)
          : totalListingPrice(item.price?.value, item.shippingOptions),
    }))
    .filter((entry): entry is { index: number; price: number } => entry.price !== null)
    .sort((left, right) => left.price - right.price)
    .slice(0, DETAIL_VALIDATION_LIMIT);

  return scored.map((entry) => entry.index);
}

async function getEbayItemDetail(itemHref: string, accessToken: string): Promise<EbayItemDetail> {
  const url = new URL(itemHref);
  url.search = '';

  const response = await axios.get<EbayItemDetail>(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-EBAY-C-MARKETPLACE-ID': config.ebayMarketplaceId,
    },
  });

  return response.data;
}

function getDetailGradeRejectionReason(card: Card, detail: EbayItemDetail): string | null {
  const normalizedCondition = normalizeText(detail.condition);
  const aspects = collectAspectValues(detail);
  const hasCertNumber = hasAspectValue(aspects, ['certification number', 'cert number', 'certification #']);
  const gradeValue = getAspectValue(aspects, ['grade']);
  const gradedValue = getAspectValue(aspects, ['graded']);
  const gradingCompany = getAspectValue(aspects, ['professional grader', 'grader', 'grading company']);

  const explicitlyUngraded =
    normalizedCondition.includes('ungraded') ||
    isTruthyNoValue(gradedValue) ||
    gradeValue === 'ungraded';
  const explicitlyGraded =
    (normalizedCondition.includes('graded') && !normalizedCondition.includes('ungraded')) ||
    isTruthyYesValue(gradedValue) ||
    hasCertNumber ||
    Boolean(gradeValue && gradeValue !== 'ungraded');

  if (card.marketSegment === 'raw' && explicitlyGraded) {
    return 'detail_indicates_graded';
  }

  if (card.marketSegment === 'psa_10') {
    if (explicitlyUngraded) {
      return 'detail_indicates_ungraded';
    }

    if (gradingCompany && !gradingCompany.includes('psa')) {
      return 'detail_wrong_grader';
    }

    if (gradeValue && !gradeLooksLikeTen(gradeValue)) {
      return 'detail_wrong_grade';
    }
  }

  return null;
}

function getListingRejectionReason(card: Card, item: EbayItemSummary): string | null {
  const normalizedTitle = normalizeText(item.title);

  const structuredGradeReason = getStructuredGradeRejectionReason(card, item);
  if (structuredGradeReason) {
    return structuredGradeReason;
  }

  if (containsBlockedAccessoryTerm(normalizedTitle)) {
    return 'accessory_or_non_card_match';
  }

  const identityReason = getListingIdentityRejectionReason(card, item.title);
  if (identityReason) {
    return identityReason;
  }

  const conditionReason = getConditionRejectionReason(card, item, normalizedTitle);
  if (conditionReason) {
    return conditionReason;
  }

  if (card.marketSegment === 'raw' && containsGradedTerm(normalizedTitle)) {
    return 'graded_listing_in_raw_segment';
  }

  if (card.marketSegment === 'psa_10' && !containsPsa10Term(normalizedTitle)) {
    return 'missing_psa10_grade';
  }

  return null;
}

function containsBlockedAccessoryTerm(title: string): boolean {
  return BLOCKED_ACCESSORY_PATTERNS.some((pattern) => pattern.test(title));
}

function containsGradedTerm(title: string): boolean {
  return GRADED_PATTERNS.some((pattern) => pattern.test(title));
}

function containsPsa10Term(title: string): boolean {
  return /(?:^|\s)psa\s*10(?:\s|$)/.test(title);
}

function getConditionRejectionReason(card: Card, item: EbayItemSummary, normalizedTitle: string): string | null {
  if (card.marketSegment !== 'raw') {
    return null;
  }

  const minimumConditionRank = getMinimumConditionRank(card.condition);
  if (minimumConditionRank === null) {
    return null;
  }

  const detectedConditionRank = getDetectedConditionRank(item, normalizedTitle);
  if (detectedConditionRank === null) {
    return null;
  }

  return detectedConditionRank < minimumConditionRank ? 'listing_condition_below_target' : null;
}

function getMinimumConditionRank(condition: string): number | null {
  switch (condition) {
    case 'near_mint_or_better':
      return 5;
    case 'light_played_or_better':
      return 4;
    case 'moderately_played_or_better':
      return 3;
    case 'heavily_played_or_better':
      return 2;
    case 'damaged_or_better':
      return 1;
    default:
      return null;
  }
}

function getDetectedConditionRank(item: EbayItemSummary, normalizedTitle: string): number | null {
  const structuredCondition = normalizeText(item.condition);
  const conditionText = `${structuredCondition} ${normalizedTitle}`.trim();

  if (!conditionText) {
    return null;
  }

  if (matchesAnyPattern(conditionText, NEAR_MINT_PATTERNS)) {
    return 5;
  }
  if (matchesAnyPattern(conditionText, LIGHT_PLAYED_PATTERNS)) {
    return 4;
  }
  if (matchesAnyPattern(conditionText, MODERATELY_PLAYED_PATTERNS)) {
    return 3;
  }
  if (matchesAnyPattern(conditionText, HEAVILY_PLAYED_PATTERNS)) {
    return 2;
  }
  if (matchesAnyPattern(conditionText, DAMAGED_PATTERNS)) {
    return 1;
  }

  return null;
}

function matchesAnyPattern(value: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

function collectAspectValues(detail: EbayItemDetail): Map<string, string> {
  const aspects = new Map<string, string>();

  for (const aspect of [...(detail.localizedAspects ?? []), ...(detail.conditionDescriptors ?? [])]) {
    const name = normalizeText(aspect.name);
    if (!name) {
      continue;
    }

    const value =
      normalizeText(aspect.value) ||
      normalizeText(aspect.values?.map((entry) => entry.content ?? '').join(' '));

    if (value) {
      aspects.set(name, value);
    }
  }

  return aspects;
}

function hasAspectValue(aspects: Map<string, string>, names: string[]): boolean {
  return names.some((name) => aspects.has(normalizeText(name)));
}

function getAspectValue(aspects: Map<string, string>, names: string[]): string | null {
  for (const name of names) {
    const value = aspects.get(normalizeText(name));
    if (value) {
      return value;
    }
  }

  return null;
}

function isTruthyYesValue(value: string | null): boolean {
  return value === 'yes' || value === 'true';
}

function isTruthyNoValue(value: string | null): boolean {
  return value === 'no' || value === 'false';
}

function gradeLooksLikeTen(value: string): boolean {
  return /\b10\b/.test(value) || /\bgem mint 10\b/.test(value);
}

function getStructuredGradeRejectionReason(card: Card, item: EbayItemSummary): string | null {
  const normalizedCondition = normalizeText(item.condition);
  if (!normalizedCondition) {
    return null;
  }

  const explicitlyUngraded = normalizedCondition.includes('ungraded');
  const explicitlyGraded =
    normalizedCondition.includes('graded') &&
    !explicitlyUngraded;

  if (card.marketSegment === 'raw' && explicitlyGraded) {
    return 'structured_condition_graded';
  }

  if (card.marketSegment === 'psa_10' && explicitlyUngraded) {
    return 'structured_condition_ungraded';
  }

  return null;
}

function getPriceSanityConfig(marketSegment: string): {
  nextListingFloorRatio: number;
  referenceFloorRatio: number;
  auctionMedianFloorRatio: number;
  minimumAbsoluteGap: number;
  clusterGapRatio: number;
  clusterMinimumAbsoluteGap: number;
} {
  if (marketSegment === 'psa_10') {
    return {
      nextListingFloorRatio: 0.55,
      referenceFloorRatio: 0.45,
      auctionMedianFloorRatio: 0.45,
      minimumAbsoluteGap: 100,
      clusterGapRatio: 1.8,
      clusterMinimumAbsoluteGap: 120,
    };
  }

  return {
    nextListingFloorRatio: 0.4,
    referenceFloorRatio: 0.35,
    auctionMedianFloorRatio: 0.3,
    minimumAbsoluteGap: 30,
    clusterGapRatio: 2.5,
    clusterMinimumAbsoluteGap: 50,
  };
}

function buildClusterOutlierReason(
  price: number,
  referencePrice: number | null,
  auctionMedian: number | null,
): string {
  const comparisons = [
    referencePrice === null ? null : `clusterReference=${referencePrice.toFixed(2)}`,
    auctionMedian === null ? null : `auctionMedian=${auctionMedian.toFixed(2)}`,
  ].filter((value): value is string => value !== null);

  return `price_cluster_outlier:${price.toFixed(2)} vs ${comparisons.join(', ')}`;
}

function buildPriceSanityReason(
  price: number,
  nextPrice: number | null,
  referencePrice: number | null,
  auctionMedian: number | null,
): string {
  const comparisons = [
    nextPrice === null ? null : `next=${nextPrice.toFixed(2)}`,
    referencePrice === null ? null : `reference=${referencePrice.toFixed(2)}`,
    auctionMedian === null ? null : `auctionMedian=${auctionMedian.toFixed(2)}`,
  ].filter((value): value is string => value !== null);

  return `price_outlier:${price.toFixed(2)} vs ${comparisons.join(', ')}`;
}

const BLOCKED_ACCESSORY_PATTERNS = [
  /\bkeychain\b/,
  /\bkey ring\b/,
  /\bmini slab\b/,
  /\bslab guard\b/,
  /\bslab case\b/,
  /\bslab protector\b/,
  /\bprotective case\b/,
  /\bcard saver\b/,
  /\bdisplay case\b/,
  /\bdisplay stand\b/,
  /\bfor display\b/,
  /\bdisplay only\b/,
  /\bextended art\b/,
  /\bextended artwork\b/,
  /\bstand only\b/,
  /\bcase only\b/,
  /\bempty\b/,
  /\bmagnetic holder\b/,
  /\bone touch\b/,
  /\btoploader\b/,
  /\btop loader\b/,
  /\bbinder\b/,
  /\bsleeve\b/,
  /\bsticker\b/,
  /\bmagnet\b/,
  /\bframe\b/,
  /\bwall art\b/,
  /\bartwork\b/,
  /\bposter\b/,
  /\brug\b/,
  /\bcarpet\b/,
  /\bblanket\b/,
  /\bplaymat\b/,
  /\bmetal card\b/,
  /\bmetal\b/,
  /\bwooden\b/,
  /\bwood\b/,
  /\bglitch\b/,
  /\boripa\b/,
  /\bmystery\b/,
  /\bchance\b/,
  /\bchase pack\b/,
  /\bgrab\b/,
  /\bread description\b/,
  /\bfan made\b/,
  /\bdiy\b/,
  /\bfake\b/,
  /\bgold foil\b/,
  /\bgift\b/,
  /\bcollectible\b/,
  /\bnot authentic\b/,
  /\breprint\b/,
  /\breplica\b/,
  /\bproxy\b/,
  /\bcustom\b/,
  /\bcust0m\b/,
  /\blot of\b/,
  /\bcard lot\b/,
  /\bbundle\b/,
  /\bplayset\b/,
  /\bset of \d+\b/,
  /\b\d+\s*x\b/,
  /\bx\s*\d+\b/,
];

const GRADED_PATTERNS = [/\bpsa\b/, /\bbgs\b/, /\bcgc\b/, /\bsgc\b/, /\bbeckett\b/, /\bgraded\b/, /\bslab\b/];

const NEAR_MINT_PATTERNS = [
  /\bnear mint\b/,
  /\bnm\b/,
  /\bnm mt\b/,
  /\bnm m\b/,
  /\bnm mint\b/,
  /\bnmmt\b/,
  /\bnm\-mt\b/,
  /\bmint\b/,
];

const LIGHT_PLAYED_PATTERNS = [
  /\blight played\b/,
  /\blightly played\b/,
  /\blp\b/,
  /\bvlp\b/,
  /\bvery lightly played\b/,
  /\bslight wear\b/,
];

const MODERATELY_PLAYED_PATTERNS = [
  /\bmoderately played\b/,
  /\bmp\b/,
  /\bplayed\b/,
  /\bpl\b/,
  /\bgood\b/,
  /\bgd\b/,
];

const HEAVILY_PLAYED_PATTERNS = [
  /\bheavily played\b/,
  /\bhp\b/,
  /\bpoor\b/,
];

const DAMAGED_PATTERNS = [
  /\bdamaged\b/,
  /\bdmg\b/,
  /\bcrease\b/,
  /\bcreased\b/,
  /\bbent\b/,
  /\btear\b/,
  /\btorn\b/,
];

const DETAIL_VALIDATION_LIMIT = 5;
