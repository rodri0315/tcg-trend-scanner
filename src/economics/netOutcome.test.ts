import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateExitScenarios, calculateNetOutcome } from './netOutcome';

test('calculates a maximum buy after all configured selling costs', () => {
  const result = calculateNetOutcome(100, {
    code: 'test',
    label: 'Test',
    marketplaceFeePct: 10,
    exitDiscountPct: 5,
    riskReservePct: 2,
    fixedFee: 1,
    outboundShipping: 5,
    materials: 1,
    acquisitionCosts: 2,
    targetNetRoiPct: 20,
  });

  assert.deepEqual(result, {
    expectedSalePrice: 95,
    estimatedNetExit: 76.6,
    maxBuyPrice: 61.83,
  });
});

test('does not produce economic guidance without a reviewed cost profile', () => {
  assert.equal(calculateNetOutcome(100, null), null);
});

test('calculates collector and vendor exits independently', () => {
  const scenarios = calculateExitScenarios(100, [
    {
      code: 'direct_collector',
      label: 'Direct collector',
      marketplaceFeePct: 0,
      exitDiscountPct: 5,
      riskReservePct: 0,
      fixedFee: 0,
      outboundShipping: 0,
      materials: 0,
      acquisitionCosts: 0,
      targetNetRoiPct: 20,
    },
    {
      code: 'vendor',
      label: 'Vendor',
      marketplaceFeePct: 0,
      exitDiscountPct: 20,
      riskReservePct: 0,
      fixedFee: 0,
      outboundShipping: 0,
      materials: 0,
      acquisitionCosts: 0,
      targetNetRoiPct: 20,
    },
  ]);

  assert.equal(scenarios.direct_collector?.estimatedNetExit, 95);
  assert.equal(scenarios.direct_collector?.maxBuyPrice, 79.17);
  assert.equal(scenarios.vendor?.estimatedNetExit, 80);
  assert.equal(scenarios.vendor?.maxBuyPrice, 66.67);
});
