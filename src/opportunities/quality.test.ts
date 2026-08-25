import assert from 'node:assert/strict';
import test from 'node:test';

import { assessOpportunityQuality } from './quality';

test('accepts an executable opportunity with sufficient evidence', () => {
  assert.deepEqual(
    assessOpportunityQuality({
      confidenceScore: 75,
      sampledBinCount: 8,
      activeAskLow: 100,
      activeAskHigh: 108,
      activeAskReference: 104,
      activeAskChangeVsPreviousPct: 2,
      maxBuyPrice: 82,
    }),
    { isActionable: true, reviewReasons: [] },
  );
});

test('quarantines thin, low-confidence, or excessively wide markets', () => {
  const result = assessOpportunityQuality({
    confidenceScore: 51,
    sampledBinCount: 2,
    activeAskLow: 100,
    activeAskHigh: 150,
    activeAskReference: 125,
    activeAskChangeVsPreviousPct: 60,
    maxBuyPrice: 90,
  });

  assert.equal(result.isActionable, false);
  assert.deepEqual(result.reviewReasons, [
    'Confidence below 65',
    'Fewer than 3 credible BIN listings',
    'Ask range wider than 25%',
    'Ask reference moved more than 50% since the previous scan',
  ]);
});

test('quarantines missing ask and exit economics', () => {
  const result = assessOpportunityQuality({
    confidenceScore: 80,
    sampledBinCount: 10,
    activeAskLow: null,
    activeAskHigh: null,
    activeAskReference: null,
    activeAskChangeVsPreviousPct: null,
    maxBuyPrice: null,
  });

  assert.equal(result.isActionable, false);
  assert.deepEqual(result.reviewReasons, ['No executable ask or exit scenario']);
});
