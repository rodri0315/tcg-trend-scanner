export interface Card {
  id: number;
  game: string;
  language: string;
  productType: string;
  marketSegment: string;
  condition: string;
  name: string;
  setName: string;
  cardNumber: string;
  rarity: string | null;
  variant: string;
  ebayQuery: string;
  tags: string[];
}

export type ListingType = 'BIN' | 'AUCTION';
export type SnapshotSource = 'live' | 'backfill' | 'fixture';

export interface EbayListingSample {
  cardId: number;
  observedAt: string;
  observedDate: string;
  ebayItemId: string;
  title: string;
  listingType: ListingType;
  condition: string | null;
  price: number;
  shipping: number;
  totalPrice: number;
  sellerKey: string | null;
  itemWebUrl: string | null;
  itemCreationDate: string | null;
  itemEndDate: string | null;
  queryUsed: string;
  isCandidateFloor: boolean;
}

export interface EbaySnapshot {
  cardId: number;
  snapshotDate: string;
  snapshotSource: SnapshotSource;
  floorBin: number | null;
  floorBinCount: number;
  totalBinCount: number;
  auctionCount: number;
  medianAuctionBidCount: number | null;
  medianAuctionCurrentPrice: number | null;
  marketPriceEstimate: number | null;
  marketPriceMethod: string | null;
  floorQualityScore: number;
  sampledBinCount: number;
  sampledAuctionCount: number;
  sellerConcentrationTop3Pct: number | null;
  freshLowCount24h: number;
  newBinCount24h: number;
  queryUsed: string;
  rawPayload: unknown;
  listingSamples: EbayListingSample[];
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
  marketNow: number | null;
  targetBuy80: number | null;
  targetBuy85: number | null;
  targetBuy90: number | null;
  ebayFloorChange7dPct: number | null;
  ebayFloorChange30dPct: number | null;
  inventoryChange7dPct: number | null;
  inventoryChange30dPct: number | null;
  auctionPriceVsFloorPct: number | null;
  auctionActivityChange7dPct: number | null;
  volatility7dPct: number | null;
  trendScore: number;
  localLagScore: number;
  confidenceScore: number;
  sustainedMoveScore: number;
  inventorySqueezeScore: number;
  auctionLagScore: number;
  absorptionScore: number;
  stabilityScore: number;
  queryConfidenceScore: number;
  rankScore: number;
  reasonCodes: string[];
  spikeFlag: boolean;
}
