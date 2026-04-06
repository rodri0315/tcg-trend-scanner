import { readFileSync } from 'fs';
import path from 'path';

import { deriveMarketPriceMetrics, type PreparedListingSample } from './marketPricing';
import type { Card, EbaySnapshot } from '../types';
import { round, toNumber } from '../utils/math';

interface EbayFixtureRow {
  game?: string;
  language?: string;
  ebay_query?: string;
  card_name?: string;
  floor_bin?: number;
  floor_bin_count?: number;
  total_bin_count?: number;
  auction_count?: number;
  median_auction_bid_count?: number;
  median_auction_current_price?: number;
}

export function loadEbaySnapshotsFromFixture(
  cards: Card[],
  snapshotDate: string,
  fixturePath: string,
): EbaySnapshot[] {
  const absolutePath = path.resolve(fixturePath);
  const raw = readFileSync(absolutePath, 'utf8');
  const rows = JSON.parse(raw) as EbayFixtureRow[];

  const byQuery = new Map<string, EbayFixtureRow>();
  const byIdentity = new Map<string, EbayFixtureRow>();
  for (const row of rows) {
    if (row.ebay_query) {
      byQuery.set(row.ebay_query.trim().toLowerCase(), row);
    }
    if (row.card_name) {
      byIdentity.set(buildIdentityKey(row.card_name, row.game, row.language), row);
    }
  }

  const observedAt = new Date(`${snapshotDate}T12:00:00.000Z`).toISOString();

  return cards.map((card) => {
    const matched =
      byQuery.get(card.ebayQuery.trim().toLowerCase()) ??
      byIdentity.get(buildIdentityKey(card.name, card.game, card.language));
    const syntheticBinListings = buildSyntheticBinListings(card, matched, snapshotDate);
    const syntheticAuctionListings = buildSyntheticAuctionListings(card, matched, snapshotDate);
    const marketMetrics = deriveMarketPriceMetrics(syntheticBinListings, snapshotDate);

    return {
      cardId: card.id,
      snapshotDate,
      snapshotSource: 'fixture',
      floorBin: marketMetrics.floorBin ?? toNumber(matched?.floor_bin),
      floorBinCount: marketMetrics.floorBinCount || toInteger(matched?.floor_bin_count),
      totalBinCount: toInteger(matched?.total_bin_count),
      auctionCount: toInteger(matched?.auction_count),
      medianAuctionBidCount: toNumber(matched?.median_auction_bid_count),
      medianAuctionCurrentPrice: toNumber(matched?.median_auction_current_price),
      marketPriceEstimate: marketMetrics.marketPriceEstimate,
      marketPriceMethod: marketMetrics.marketPriceMethod,
      floorQualityScore: marketMetrics.floorQualityScore,
      sampledBinCount: syntheticBinListings.length,
      sampledAuctionCount: syntheticAuctionListings.length,
      sellerConcentrationTop3Pct: marketMetrics.sellerConcentrationTop3Pct,
      freshLowCount24h: marketMetrics.freshLowCount24h,
      newBinCount24h: marketMetrics.newBinCount24h,
      queryUsed: card.ebayQuery,
      rawPayload: {
        source: 'fixture',
        matchedBy: matched?.ebay_query ? 'ebay_query' : matched?.card_name ? 'card_name' : 'default-empty',
        fixturePath: absolutePath,
        fixture: matched ?? null,
        marketPricing: {
          estimate: marketMetrics.marketPriceEstimate,
          method: marketMetrics.marketPriceMethod,
          floorQualityScore: marketMetrics.floorQualityScore,
        },
      },
      listingSamples: [
        ...syntheticBinListings.map((listing) => ({
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
          isCandidateFloor: marketMetrics.candidateFloorItemIds.has(listing.ebayItemId),
        })),
        ...syntheticAuctionListings.map((listing) => ({
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
          isCandidateFloor: false,
        })),
      ],
    };
  });
}

function toInteger(value: unknown): number {
  const numberValue = toNumber(value);
  if (numberValue === null || numberValue < 0) {
    return 0;
  }

  return Math.floor(numberValue);
}

function buildIdentityKey(cardName: string, game?: string, language?: string): string {
  return [game ?? '', language ?? '', cardName.trim().toLowerCase()].join('::');
}

function buildSyntheticBinListings(
  card: Card,
  row: EbayFixtureRow | undefined,
  snapshotDate: string,
): PreparedListingSample[] {
  const floorBin = toNumber(row?.floor_bin);
  const totalBinCount = Math.max(toInteger(row?.total_bin_count), 1);
  const floorBinCount = Math.max(toInteger(row?.floor_bin_count), floorBin === null ? 0 : 1);

  if (floorBin === null) {
    return [];
  }

  return Array.from({ length: Math.min(totalBinCount, 8) }, (_, index) => {
    const totalPrice = round(
      index < floorBinCount ? floorBin : floorBin * (1 + Math.min(index - floorBinCount + 1, 4) * 0.03),
    );

    return {
      ebayItemId: `fixture-bin-${card.id}-${index + 1}`,
      title: `${card.name} ${card.cardNumber} fixture BIN ${index + 1}`,
      listingType: 'BIN',
      condition: 'Ungraded',
      price: totalPrice,
      shipping: 0,
      totalPrice,
      sellerKey: `fixture-seller-${(index % 4) + 1}`,
      itemWebUrl: null,
      itemCreationDate: index < 2 ? `${snapshotDate}T08:00:00.000Z` : `${snapshotDate}T00:00:00.000Z`,
      itemEndDate: null,
    };
  });
}

function buildSyntheticAuctionListings(
  card: Card,
  row: EbayFixtureRow | undefined,
  snapshotDate: string,
): PreparedListingSample[] {
  const auctionPrice = toNumber(row?.median_auction_current_price);
  const auctionCount = Math.min(Math.max(toInteger(row?.auction_count), 0), 5);

  if (auctionPrice === null || auctionCount === 0) {
    return [];
  }

  return Array.from({ length: auctionCount }, (_, index) => {
    const totalPrice = round(auctionPrice * (1 + (index - 2) * 0.015));

    return {
      ebayItemId: `fixture-auction-${card.id}-${index + 1}`,
      title: `${card.name} ${card.cardNumber} fixture auction ${index + 1}`,
      listingType: 'AUCTION',
      condition: 'Ungraded',
      price: totalPrice,
      shipping: 0,
      totalPrice,
      sellerKey: `fixture-auction-seller-${(index % 3) + 1}`,
      itemWebUrl: null,
      itemCreationDate: `${snapshotDate}T06:00:00.000Z`,
      itemEndDate: `${snapshotDate}T22:00:00.000Z`,
    };
  });
}
