import assert from 'node:assert/strict';
import test from 'node:test';

import { isThinMarketHistoricalOutlier } from './priceSanity';

test('rejects a lone price dramatically below a supported historical market', () => {
  assert.equal(
    isThinMarketHistoricalOutlier({
      currentPrice: 10,
      currentSampleCount: 1,
      historicalReference: 215.36,
      marketSegment: 'raw',
    }),
    true,
  );
});

test('preserves plausible thin prices and coherent new clusters', () => {
  assert.equal(
    isThinMarketHistoricalOutlier({
      currentPrice: 190,
      currentSampleCount: 1,
      historicalReference: 215.36,
      marketSegment: 'raw',
    }),
    false,
  );
  assert.equal(
    isThinMarketHistoricalOutlier({
      currentPrice: 10,
      currentSampleCount: 3,
      historicalReference: 215.36,
      marketSegment: 'raw',
    }),
    false,
  );
});

test('does not invent a comparison when reliable history is absent', () => {
  assert.equal(
    isThinMarketHistoricalOutlier({
      currentPrice: 10,
      currentSampleCount: 1,
      historicalReference: null,
      marketSegment: 'raw',
    }),
    false,
  );
});
