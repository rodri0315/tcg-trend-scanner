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

    const binItems = binResponse.itemSummaries ?? [];
    const auctionItems = auctionResponse.itemSummaries ?? [];
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
      totalBinCount: binResponse.total ?? binItems.length,
      auctionCount: auctionResponse.total ?? auctionItems.length,
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
