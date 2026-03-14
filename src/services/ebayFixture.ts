import { readFileSync } from 'fs';
import path from 'path';

import type { Card, EbaySnapshot } from '../types';
import { toNumber } from '../utils/math';

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

  return cards.map((card) => {
    const matched =
      byQuery.get(card.ebayQuery.trim().toLowerCase()) ??
      byIdentity.get(buildIdentityKey(card.name, card.game, card.language));

    return {
      cardId: card.id,
      snapshotDate,
      floorBin: toNumber(matched?.floor_bin),
      floorBinCount: toInteger(matched?.floor_bin_count),
      totalBinCount: toInteger(matched?.total_bin_count),
      auctionCount: toInteger(matched?.auction_count),
      medianAuctionBidCount: toNumber(matched?.median_auction_bid_count),
      medianAuctionCurrentPrice: toNumber(matched?.median_auction_current_price),
      queryUsed: card.ebayQuery,
      rawPayload: {
        source: 'fixture',
        matchedBy: matched?.ebay_query ? 'ebay_query' : matched?.card_name ? 'card_name' : 'default-empty',
        fixturePath: absolutePath,
        fixture: matched ?? null,
      },
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
