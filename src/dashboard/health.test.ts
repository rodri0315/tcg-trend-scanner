import assert from 'node:assert/strict';
import test from 'node:test';

import { assessPipelineHealth, daysBetweenDates } from './health';

test('reports a fully covered current pipeline as healthy', () => {
  assert.deepEqual(
    assessPipelineHealth({
      daysSinceLatestLiveSnapshot: 1,
      trackedCards: 15,
      liveCardsScanned: 15,
      cardsWithTrustedAsk: 15,
      missingLiveScanDays30: 0,
    }),
    { status: 'healthy', reasons: [] },
  );
});

test('surfaces incomplete and missing market data as attention', () => {
  const result = assessPipelineHealth({
    daysSinceLatestLiveSnapshot: 0,
    trackedCards: 15,
    liveCardsScanned: 14,
    cardsWithTrustedAsk: 10,
    missingLiveScanDays30: 3,
  });

  assert.equal(result.status, 'attention');
  assert.equal(result.reasons.length, 3);
});

test('marks old or absent live data explicitly', () => {
  assert.equal(
    assessPipelineHealth({
      daysSinceLatestLiveSnapshot: 4,
      trackedCards: 15,
      liveCardsScanned: 15,
      cardsWithTrustedAsk: 15,
      missingLiveScanDays30: 0,
    }).status,
    'stale',
  );
  assert.equal(
    assessPipelineHealth({
      daysSinceLatestLiveSnapshot: null,
      trackedCards: 15,
      liveCardsScanned: 0,
      cardsWithTrustedAsk: 0,
      missingLiveScanDays30: 30,
    }).status,
    'no_data',
  );
});

test('calculates calendar-day staleness without local timezone drift', () => {
  assert.equal(daysBetweenDates('2026-08-25', '2026-08-24'), 1);
  assert.equal(daysBetweenDates('2026-08-25', null), null);
});
