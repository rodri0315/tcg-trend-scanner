import assert from 'node:assert/strict';
import test from 'node:test';

import { assessLiquidity, calculateCollectorDiscountRange } from './liquidity';

test('classifies broad, active markets as high liquidity', () => {
  const result = assessLiquidity({
    absorbedRatioPct: 60,
    auctionCount: 8,
    medianAuctionBidCount: 5,
    activeAskSellerCount: 5,
    sampledBinCount: 10,
    floorQualityScore: 90,
    sellerConcentrationTop3Pct: 55,
  });

  assert.equal(result.tier, 'high');
  assert.equal(result.score, 98.5);
  assert.equal(result.confidenceScore, 100);
});

test('normalizes around missing absorption instead of treating it as zero demand', () => {
  const input = {
    absorbedRatioPct: null,
    auctionCount: 4,
    medianAuctionBidCount: 3,
    activeAskSellerCount: 3,
    sampledBinCount: 6,
    floorQualityScore: 70,
    sellerConcentrationTop3Pct: 50,
  };
  const result = assessLiquidity(input);
  const zeroAbsorption = assessLiquidity({ ...input, absorbedRatioPct: 0 });

  assert.equal(result.tier, 'medium');
  assert.equal(result.confidenceScore, 70);
  assert.ok(result.score > zeroAbsorption.score);
});

test('seller concentration lowers the liquidity score', () => {
  const shared = {
    absorbedRatioPct: 30,
    auctionCount: 4,
    medianAuctionBidCount: 2,
    activeAskSellerCount: 3,
    sampledBinCount: 6,
    floorQualityScore: 65,
  };
  const broad = assessLiquidity({ ...shared, sellerConcentrationTop3Pct: 60 });
  const concentrated = assessLiquidity({ ...shared, sellerConcentrationTop3Pct: 95 });

  assert.equal(roundForTest(broad.score - concentrated.score), 12.5);
});

test('collector discounts combine liquidity and expert popularity with guardrails', () => {
  assert.deepEqual(calculateCollectorDiscountRange(5, 'medium', 'standard'), {
    optimisticPct: 3,
    expectedPct: 5,
    conservativePct: 8,
  });
  assert.equal(calculateCollectorDiscountRange(5, 'high', 'high').expectedPct, 3);
  assert.equal(calculateCollectorDiscountRange(5, 'low', 'niche').expectedPct, 11);
  assert.equal(calculateCollectorDiscountRange(14, 'low', 'niche').expectedPct, 15);
});

function roundForTest(value: number): number {
  return Math.round(value * 100) / 100;
}
