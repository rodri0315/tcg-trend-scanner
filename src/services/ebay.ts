import axios from 'axios';

import { config } from '../config';
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
  title?: string;
  buyingOptions?: string[];
  price?: EbayPrice;
  shippingOptions?: EbayShippingOption[];
  currentBidPrice?: EbayPrice;
  bidCount?: number;
  itemEndDate?: string;
  condition?: string;
  conditionId?: string;
}

interface EbaySearchResponse {
  total?: number;
  itemSummaries?: EbayItemSummary[];
}

export async function fetchEbaySnapshots(cards: Card[], snapshotDate: string): Promise<EbaySnapshot[]> {
  if (!config.ebayClientId || !config.ebayClientSecret) {
    throw new Error('eBay credentials are required to fetch daily snapshots.');
  }

  const accessToken = await getEbayAccessToken();
  const snapshots: EbaySnapshot[] = [];

  for (const card of cards) {
    const [binResponse, auctionResponse] = await Promise.all([
      searchEbay(card.ebayQuery, accessToken, 'FIXED_PRICE'),
      searchEbay(card.ebayQuery, accessToken, 'AUCTION'),
    ]);

    const rawBinItems = binResponse.itemSummaries ?? [];
    const rawAuctionItems = auctionResponse.itemSummaries ?? [];
    const filteredBin = filterEbayItems(card, rawBinItems);
    const filteredAuction = filterEbayItems(card, rawAuctionItems);
    const auctionItems = filteredAuction.items;
    const medianAuctionCurrentPrice = median(
      auctionItems
        .map((item) => totalListingPrice(item.currentBidPrice?.value, item.shippingOptions))
        .filter((value): value is number => value !== null),
    );
    const saneBin = filterBinPriceOutliers(card, filteredBin.items, medianAuctionCurrentPrice);
    const binItems = saneBin.items;
    const binTotals = saneBin.prices;
    const floorBin = binTotals.length > 0 ? Math.min(...binTotals) : null;
    const floorBinCount = floorBin === null ? 0 : binTotals.filter((price) => price === floorBin).length;

    snapshots.push({
      cardId: card.id,
      snapshotDate,
      floorBin,
      floorBinCount,
      totalBinCount: binItems.length,
      auctionCount: auctionItems.length,
      medianAuctionBidCount: median(
        auctionItems
          .map((item) => toNumber(item.bidCount))
          .filter((value): value is number => value !== null),
      ),
      medianAuctionCurrentPrice,
      queryUsed: card.ebayQuery,
      rawPayload: {
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
            kept: filteredAuction.items.length,
            rejected: filteredAuction.rejections,
          },
        },
        fixedPrice: binResponse,
        auctions: auctionResponse,
      },
    });
  }

  return snapshots;
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
): { items: EbayItemSummary[]; prices: number[]; rejections: Array<{ title: string; price: number; reason: string }> } {
  const pricedItems = items
    .map((item) => ({
      item,
      price: totalListingPrice(item.price?.value, item.shippingOptions),
    }))
    .filter((entry): entry is { item: EbayItemSummary; price: number } => entry.price !== null)
    .sort((left, right) => left.price - right.price);

  const rejections: Array<{ title: string; price: number; reason: string }> = [];

  while (pricedItems.length >= 3) {
    const candidate = pricedItems[0];
    const next = pricedItems[1];
    const prices = pricedItems.map((entry) => entry.price);
    const binMedian = median(prices);
    const ratioConfig = getPriceSanityRatios(card.marketSegment);
    const suspiciousVsNext = next !== undefined && candidate.price < round(next.price * ratioConfig.nextListingFloorRatio);
    const suspiciousVsBinMedian =
      binMedian !== null && candidate.price < round(binMedian * ratioConfig.binMedianFloorRatio);
    const suspiciousVsAuctionMedian =
      medianAuctionCurrentPrice !== null &&
      candidate.price < round(medianAuctionCurrentPrice * ratioConfig.auctionMedianFloorRatio);

    if (!suspiciousVsNext || (!suspiciousVsBinMedian && !suspiciousVsAuctionMedian)) {
      break;
    }

    rejections.push({
      title: candidate.item.title ?? '(untitled listing)',
      price: candidate.price,
      reason: buildPriceSanityReason(candidate.price, next?.price ?? null, binMedian, medianAuctionCurrentPrice),
    });
    pricedItems.shift();
  }

  return {
    items: pricedItems.map((entry) => entry.item),
    prices: pricedItems.map((entry) => entry.price),
    rejections,
  };
}

function filterEbayItems(
  card: Card,
  items: EbayItemSummary[],
): { items: EbayItemSummary[]; rejections: Array<{ title: string; reason: string }> } {
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

  return { items: kept, rejections };
}

function getListingRejectionReason(card: Card, item: EbayItemSummary): string | null {
  const normalizedTitle = normalizeText(item.title);
  if (!normalizedTitle) {
    return 'missing_title';
  }

  const structuredGradeReason = getStructuredGradeRejectionReason(card, item);
  if (structuredGradeReason) {
    return structuredGradeReason;
  }

  if (containsBlockedAccessoryTerm(normalizedTitle)) {
    return 'accessory_or_non_card_match';
  }

  if (!matchesTrackedCardIdentity(card, normalizedTitle)) {
    return 'missing_card_identity_terms';
  }

  if (card.marketSegment === 'raw' && containsGradedTerm(normalizedTitle)) {
    return 'graded_listing_in_raw_segment';
  }

  if (card.marketSegment === 'psa_10' && !containsPsa10Term(normalizedTitle)) {
    return 'missing_psa10_grade';
  }

  return null;
}

function normalizeText(value: string | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function containsBlockedAccessoryTerm(title: string): boolean {
  return BLOCKED_ACCESSORY_PATTERNS.some((pattern) => pattern.test(title));
}

function matchesTrackedCardIdentity(card: Card, title: string): boolean {
  const numberToken = normalizeText(card.cardNumber);
  if (numberToken && title.includes(numberToken)) {
    return true;
  }

  const nameTokens = extractNameTokens(card.name);
  return nameTokens.some((token) => title.includes(token));
}

function extractNameTokens(name: string): string[] {
  return normalizeText(name)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !GENERIC_NAME_TOKENS.has(token));
}

function containsGradedTerm(title: string): boolean {
  return GRADED_PATTERNS.some((pattern) => pattern.test(title));
}

function containsPsa10Term(title: string): boolean {
  return /(?:^|\s)psa\s*10(?:\s|$)/.test(title);
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

function getPriceSanityRatios(marketSegment: string): {
  nextListingFloorRatio: number;
  binMedianFloorRatio: number;
  auctionMedianFloorRatio: number;
} {
  if (marketSegment === 'psa_10') {
    return {
      nextListingFloorRatio: 0.55,
      binMedianFloorRatio: 0.45,
      auctionMedianFloorRatio: 0.45,
    };
  }

  return {
    nextListingFloorRatio: 0.45,
    binMedianFloorRatio: 0.3,
    auctionMedianFloorRatio: 0.3,
  };
}

function buildPriceSanityReason(
  price: number,
  nextPrice: number | null,
  binMedian: number | null,
  auctionMedian: number | null,
): string {
  const comparisons = [
    nextPrice === null ? null : `next=${nextPrice.toFixed(2)}`,
    binMedian === null ? null : `binMedian=${binMedian.toFixed(2)}`,
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
  /\bproxy\b/,
  /\bcustom\b/,
  /\bcust0m\b/,
];

const GRADED_PATTERNS = [/\bpsa\b/, /\bbgs\b/, /\bcgc\b/, /\bsgc\b/, /\bbeckett\b/, /\bgraded\b/, /\bslab\b/];

const GENERIC_NAME_TOKENS = new Set(['pokemon', 'one', 'piece', 'tcg', 'card']);
