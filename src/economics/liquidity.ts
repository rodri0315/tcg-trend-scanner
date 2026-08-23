import type { PopularityTier } from '../types';
import { clamp, round } from '../utils/math';

export type LiquidityTier = 'high' | 'medium' | 'low';

export interface LiquidityInput {
  absorbedRatioPct: number | null;
  auctionCount: number | null;
  medianAuctionBidCount: number | null;
  activeAskSellerCount: number | null;
  sampledBinCount: number | null;
  floorQualityScore: number | null;
  sellerConcentrationTop3Pct: number | null;
}

export interface LiquidityAssessment {
  score: number;
  confidenceScore: number;
  tier: LiquidityTier;
  components: {
    absorption: number | null;
    auctionParticipation: number | null;
    sellerBreadth: number | null;
    listingDepth: number | null;
    floorReliability: number | null;
    concentrationPenalty: number;
  };
}

export interface CollectorDiscountRange {
  optimisticPct: number;
  expectedPct: number;
  conservativePct: number;
}

const COMPONENT_WEIGHTS = {
  absorption: 30,
  auctionParticipation: 25,
  sellerBreadth: 15,
  listingDepth: 15,
  floorReliability: 15,
} as const;

export function assessLiquidity(input: LiquidityInput): LiquidityAssessment {
  const components = {
    absorption: scaleTo100(input.absorbedRatioPct, 60),
    auctionParticipation: calculateAuctionParticipation(input.auctionCount, input.medianAuctionBidCount),
    sellerBreadth: scaleTo100(input.activeAskSellerCount, 5),
    listingDepth: scaleTo100(input.sampledBinCount, 10),
    floorReliability: normalizeScore(input.floorQualityScore),
    concentrationPenalty: round(clamp(((input.sellerConcentrationTop3Pct ?? 70) - 70) * 0.5, 0, 15)),
  };

  let weightedScore = 0;
  let availableWeight = 0;
  for (const key of Object.keys(COMPONENT_WEIGHTS) as Array<keyof typeof COMPONENT_WEIGHTS>) {
    const component = components[key];
    if (component === null) {
      continue;
    }

    const weight = COMPONENT_WEIGHTS[key];
    weightedScore += component * weight;
    availableWeight += weight;
  }

  const normalizedScore = availableWeight === 0 ? 0 : weightedScore / availableWeight;
  const score = round(clamp(normalizedScore - components.concentrationPenalty, 0, 100));

  return {
    score,
    confidenceScore: round(availableWeight),
    tier: score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low',
    components,
  };
}

export function calculateCollectorDiscountRange(
  baseDiscountPct: number,
  liquidityTier: LiquidityTier,
  popularityTier: PopularityTier,
): CollectorDiscountRange {
  const liquidityAdjustment = liquidityTier === 'high' ? -1 : liquidityTier === 'low' ? 4 : 0;
  const popularityAdjustment = popularityTier === 'high' ? -1 : popularityTier === 'niche' ? 2 : 0;
  const expectedPct = round(clamp(baseDiscountPct + liquidityAdjustment + popularityAdjustment, 3, 15));

  return {
    optimisticPct: round(clamp(expectedPct - 2, 3, 15)),
    expectedPct,
    conservativePct: round(clamp(expectedPct + 3, 3, 15)),
  };
}

function calculateAuctionParticipation(auctionCount: number | null, medianBidCount: number | null): number | null {
  if (auctionCount === null && medianBidCount === null) {
    return null;
  }

  const countScore = scaleTo100(auctionCount, 8);
  const bidScore = scaleTo100(medianBidCount, 5);
  if (countScore === null) {
    return bidScore;
  }
  if (bidScore === null) {
    return countScore;
  }

  return round(countScore * 0.6 + bidScore * 0.4);
}

function scaleTo100(value: number | null, fullScoreAt: number): number | null {
  if (value === null) {
    return null;
  }

  return round(clamp(value / fullScoreAt, 0, 1) * 100);
}

function normalizeScore(value: number | null): number | null {
  return value === null ? null : round(clamp(value, 0, 100));
}
