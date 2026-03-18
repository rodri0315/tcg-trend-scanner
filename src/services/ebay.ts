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
  itemHref?: string;
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
    const filteredBin = await filterEbayItems(card, rawBinItems, accessToken, 'FIXED_PRICE');
    const filteredAuction = await filterEbayItems(card, rawAuctionItems, accessToken, 'AUCTION');
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
