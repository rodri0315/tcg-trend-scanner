import assert from 'node:assert/strict';
import test from 'node:test';

import { summarizeBacktests, type BacktestObservation } from './calibration';

const observations: BacktestObservation[] = [
  {
    cardId: 1,
    cardLabel: 'Card A',
    signalDate: '2026-01-01',
    rankScore: 65,
    confidenceScore: 80,
    startPrice: 100,
    outcomes: {
      7: { snapshotDate: '2026-01-08', price: 110 },
      30: { snapshotDate: '2026-01-31', price: 90 },
    },
  },
  {
    cardId: 2,
    cardLabel: 'Card B',
    signalDate: '2026-01-01',
    rankScore: 15,
    confidenceScore: 60,
    startPrice: 50,
    outcomes: {
      7: { snapshotDate: '2026-01-10', price: 50 },
    },
  },
  {
    cardId: 3,
    cardLabel: 'Card C',
    signalDate: '2026-04-25',
    rankScore: 45,
    confidenceScore: 70,
    startPrice: 75,
    outcomes: {},
  },
];

test('summarizes evaluated, missing, and pending outcomes separately', () => {
  const summaries = summarizeBacktests(observations, '2026-05-01');
  const sevenDay = summaries.find((summary) => summary.horizonDays === 7);

  assert.equal(sevenDay?.evaluatedSignals, 2);
  assert.equal(sevenDay?.eligibleSignals, 2);
  assert.equal(sevenDay?.pendingSignals, 1);
  assert.equal(sevenDay?.averageReturnPct, 5);
  assert.equal(sevenDay?.positiveRatePct, 50);
});

test('closes a tolerance window before counting an observation as missing', () => {
  const summaries = summarizeBacktests(observations, '2026-05-01');
  const thirtyDay = summaries.find((summary) => summary.horizonDays === 30);

  assert.equal(thirtyDay?.evaluatedSignals, 1);
  assert.equal(thirtyDay?.eligibleSignals, 2);
  assert.equal(thirtyDay?.missingOutcomes, 1);
  assert.equal(thirtyDay?.pendingSignals, 1);
});

test('calibrates returns into fixed rank-score buckets', () => {
  const summaries = summarizeBacktests(observations, '2026-05-01');
  const sevenDay = summaries.find((summary) => summary.horizonDays === 7);
  const highBucket = sevenDay?.buckets.find((bucket) => bucket.label === '60–79');

  assert.equal(highBucket?.evaluatedSignals, 1);
  assert.equal(highBucket?.averageReturnPct, 10);
  assert.equal(highBucket?.tenPctGainRatePct, 100);
  assert.equal(sevenDay?.maturity, 'insufficient');
});

test('requires adequate outcome coverage before calibration becomes usable', () => {
  const evaluated = Array.from({ length: 100 }, (_, index): BacktestObservation => ({
    cardId: index + 10,
    cardLabel: `Evaluated ${index}`,
    signalDate: '2026-01-01',
    rankScore: 50,
    confidenceScore: 80,
    startPrice: 100,
    outcomes: { 7: { snapshotDate: '2026-01-08', price: 105 } },
  }));
  const missing = Array.from({ length: 100 }, (_, index): BacktestObservation => ({
    cardId: index + 200,
    cardLabel: `Missing ${index}`,
    signalDate: '2026-01-01',
    rankScore: 50,
    confidenceScore: 80,
    startPrice: 100,
    outcomes: {},
  }));
  const sevenDay = summarizeBacktests([...evaluated, ...missing], '2026-05-01')
    .find((summary) => summary.horizonDays === 7);

  assert.equal(sevenDay?.coveragePct, 50);
  assert.equal(sevenDay?.maturity, 'early');
});
