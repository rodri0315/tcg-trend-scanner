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
    const binItems = filteredBin.items;
    const auctionItems = filteredAuction.items;
    const binTotals = binItems
      .map((item) => totalListingPrice(item.price?.value, item.shippingOptions))
      .filter((value): value is number => value !== null);
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
      medianAuctionCurrentPrice: median(
        auctionItems
          .map((item) => totalListingPrice(item.currentBidPrice?.value, item.shippingOptions))
          .filter((value): value is number => value !== null),
      ),
      queryUsed: card.ebayQuery,
      rawPayload: {
        filters: {
          bin: {
            total: rawBinItems.length,
            kept: filteredBin.items.length,
            rejected: filteredBin.rejections,
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

const BLOCKED_ACCESSORY_PATTERNS = [
  /\bkeychain\b/,
  /\bkey ring\b/,
  /\bmini slab\b/,
  /\bslab guard\b/,
  /\bslab case\b/,
  /\bslab protector\b/,
  /\bprotective case\b/,
  /\bcard saver\b/,
  /\bdisplay stand\b/,
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
  /\bproxy\b/,
  /\bcustom\b/,
];

const GRADED_PATTERNS = [/\bpsa\b/, /\bbgs\b/, /\bcgc\b/, /\bsgc\b/, /\bbeckett\b/, /\bgraded\b/, /\bslab\b/];

const GENERIC_NAME_TOKENS = new Set(['pokemon', 'one', 'piece', 'tcg', 'card']);
