export interface Card {
  id: number;
  game: string;
  language: string;
  productType: string;
  marketSegment: string;
  name: string;
  setName: string;
  cardNumber: string;
  rarity: string | null;
  variant: string;
  ebayQuery: string;
  tags: string[];
}

export interface EbaySnapshot {
  cardId: number;
  snapshotDate: string;
  floorBin: number | null;
  floorBinCount: number;
  totalBinCount: number;
  auctionCount: number;
  medianAuctionBidCount: number | null;
  medianAuctionCurrentPrice: number | null;
  queryUsed: string;
  rawPayload: unknown;
}

export interface ListingDebugEntry {
  title: string;
  price: number | null;
  reason: string | null;
  daysLeft: number | null;
  imageUrl: string | null;
  itemWebUrl: string | null;
}

export interface ListingDebugGroup {
  label: string;
  total: number;
  kept: number;
  entries: ListingDebugEntry[];
}

export interface LatestListingDebug {
  snapshotDate: string;
  queryUsed: string;
  fixedPriceKept: ListingDebugGroup;
  fixedPriceRejected: ListingDebugGroup;
  auctionKept: ListingDebugGroup;
  auctionRejected: ListingDebugGroup;
}

export interface SignalSnapshot {
  cardId: number;
  signalDate: string;
  ebayFloorChange7dPct: number | null;
  ebayFloorChange30dPct: number | null;
  inventoryChange7dPct: number | null;
  inventoryChange30dPct: number | null;
  auctionPriceVsFloorPct: number | null;
  auctionActivityChange7dPct: number | null;
  volatility7dPct: number | null;
  trendScore: number;
  localLagScore: number;
  spikeFlag: boolean;
}
