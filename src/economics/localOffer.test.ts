import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluateLocalOffer } from './localOffer';
import type { ExitScenario } from './netOutcome';

const collectorScenario: ExitScenario = {
  code: 'direct_collector',
  label: 'Direct collector',
  expectedSalePrice: 95,
  estimatedNetExit: 95,
  maxBuyPrice: 77.17,
  targetNetRoiPct: 20,
  assumptions: {
    code: 'direct_collector',
    label: 'Direct collector',
    marketplaceFeePct: 0,
    exitDiscountPct: 5,
    riskReservePct: 0,
    fixedFee: 0,
    outboundShipping: 0,
    materials: 0,
    acquisitionCosts: 2,
    targetNetRoiPct: 20,
  },
};

test('evaluates an offer against the selected exit economics', () => {
  const result = evaluateLocalOffer(70, collectorScenario);

  assert.equal(result.status, 'within_target');
  assert.equal(result.marginToMaxBuy, 7.17);
  assert.equal(result.projectedNetProfit, 23);
  assert.equal(result.projectedNetRoiPct, 31.94);
});

test('flags an offer above the configured target without making a buy decision', () => {
  const result = evaluateLocalOffer(85, collectorScenario);

  assert.equal(result.status, 'above_target');
  assert.equal(result.marginToMaxBuy, -7.83);
});

test('returns unavailable economics when the selected exit has no scenario', () => {
  const result = evaluateLocalOffer(50, null);

  assert.equal(result.status, 'unavailable');
  assert.equal(result.maxBuyPrice, null);
});
