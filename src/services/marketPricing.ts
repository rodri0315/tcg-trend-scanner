import type { ListingType } from '../types';
import { clamp, median, round } from '../utils/math';

export interface PreparedListingSample {
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
}

export interface MarketPriceMetrics {
  marketPriceEstimate: number | null;
  marketPriceMethod: string | null;
  floorBin: number | null;
  floorBinCount: number;
  floorQualityScore: number;
  sellerConcentrationTop3Pct: number | null;
  freshLowCount24h: number;
  newBinCount24h: number;
  candidateFloorItemIds: Set<string>;
}

const FLOOR_CLUSTER_WINDOW_PCT = 0.06;
const FALLBACK_CLUSTER_WINDOW_PCT = 0.08;
const MAX_CANDIDATE_FLOOR_SAMPLES = 8;
const FRESH_LISTING_WINDOW_MS = 24 * 60 * 60 * 1000;

export function deriveMarketPriceMetrics(
  listings: PreparedListingSample[],
  snapshotDate: string,
): MarketPriceMetrics {
  const binListings = listings
    .filter((listing) => listing.listingType === 'BIN')
    .sort((left, right) => left.totalPrice - right.totalPrice);

  if (binListings.length === 0) {
    return {
      marketPriceEstimate: null,
      marketPriceMethod: null,
      floorBin: null,
      floorBinCount: 0,
      floorQualityScore: 0,
      sellerConcentrationTop3Pct: null,
      freshLowCount24h: 0,
      newBinCount24h: 0,
      candidateFloorItemIds: new Set<string>(),
    };
  }

  const floorBin = binListings[0]?.totalPrice ?? null;
  const floorBinCount = floorBin === null ? 0 : binListings.filter((listing) => listing.totalPrice === floorBin).length;
  const cluster = findCluster(binListings, FLOOR_CLUSTER_WINDOW_PCT) ?? findCluster(binListings, FALLBACK_CLUSTER_WINDOW_PCT);
  const candidateFloorListings = (cluster ?? binListings.slice(0, Math.min(5, binListings.length))).slice(
    0,
    MAX_CANDIDATE_FLOOR_SAMPLES,
  );
  const marketPriceEstimate = median(candidateFloorListings.map((listing) => listing.totalPrice));
  const marketPriceMethod = cluster
    ? `cluster_median_${candidateFloorListings.length}`
    : `fallback_lowest_${candidateFloorListings.length}`;
  const floorQualityScore = calculateFloorQualityScore(binListings, candidateFloorListings, cluster !== null);
  const sellerConcentrationTop3Pct = calculateSellerConcentration(candidateFloorListings);
  const freshLowCount24h = countFreshListings(candidateFloorListings, snapshotDate);
  const newBinCount24h = countFreshListings(binListings, snapshotDate);

  return {
    marketPriceEstimate,
    marketPriceMethod,
    floorBin,
    floorBinCount,
    floorQualityScore,
    sellerConcentrationTop3Pct,
    freshLowCount24h,
    newBinCount24h,
    candidateFloorItemIds: new Set(candidateFloorListings.map((listing) => listing.ebayItemId)),
  };
}

function findCluster(
  listings: PreparedListingSample[],
  windowPct: number,
): PreparedListingSample[] | null {
  for (let startIndex = 0; startIndex < listings.length; startIndex += 1) {
    const anchor = listings[startIndex]?.totalPrice;
    if (!anchor || anchor <= 0) {
      continue;
    }

    const upperBound = anchor * (1 + windowPct);
    const cluster = listings.filter((listing) => listing.totalPrice >= anchor && listing.totalPrice <= upperBound);
    if (cluster.length >= 3) {
      return cluster;
    }
  }

  return null;
}

function calculateFloorQualityScore(
  allBinListings: PreparedListingSample[],
  candidateFloorListings: PreparedListingSample[],
  usedCluster: boolean,
): number {
  if (allBinListings.length === 0 || candidateFloorListings.length === 0) {
    return 0;
  }

  const depthScore = clamp(candidateFloorListings.length / 5, 0, 1) * 45;
  const clusterScore = usedCluster ? 35 : 18;
  const spread = calculateSpread(candidateFloorListings.map((listing) => listing.totalPrice));
  const spreadScore = clamp(1 - spread / 0.12, 0, 1) * 20;

  return round(clamp(depthScore + clusterScore + spreadScore, 0, 100));
}

function calculateSpread(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min <= 0) {
    return 1;
  }

  return (max - min) / min;
}

function calculateSellerConcentration(listings: PreparedListingSample[]): number | null {
  if (listings.length === 0) {
    return null;
  }

  const counts = new Map<string, number>();
  for (const listing of listings) {
    const seller = listing.sellerKey ?? 'unknown';
    counts.set(seller, (counts.get(seller) ?? 0) + 1);
  }

  const top3Count = [...counts.values()]
    .sort((left, right) => right - left)
    .slice(0, 3)
    .reduce((sum, count) => sum + count, 0);

  return round((top3Count / listings.length) * 100);
}

function countFreshListings(listings: PreparedListingSample[], snapshotDate: string): number {
  const snapshotTime = Date.parse(`${snapshotDate}T23:59:59.999Z`);
  if (Number.isNaN(snapshotTime)) {
    return 0;
  }

  return listings.filter((listing) => {
    if (!listing.itemCreationDate) {
      return false;
    }

    const createdAt = Date.parse(listing.itemCreationDate);
    if (Number.isNaN(createdAt)) {
      return false;
    }

    return snapshotTime - createdAt <= FRESH_LISTING_WINDOW_MS;
  }).length;
}
