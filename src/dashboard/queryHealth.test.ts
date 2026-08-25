import assert from 'node:assert/strict';
import test from 'node:test';

import { assessQueryHealth } from './queryHealth';

test('reports a validated query with sufficient matches as healthy', () => {
  const result = assessQueryHealth({
    currentQuery: 'Gengar VMAX 271 -japanese',
    latestSnapshotDate: '2026-08-25',
    queryUsed: 'gengar  vmax 271 -JAPANESE',
    fetchedBinCount: 40,
    keptBinCount: 8,
    detailValidationFailureCount: 0,
  });

  assert.equal(result.status, 'healthy');
  assert.equal(result.acceptancePct, 20);
  assert.deepEqual(result.reasons, []);
});

test('marks an edited query as unscanned until a new snapshot uses it', () => {
  const result = assessQueryHealth({
    currentQuery: 'Gengar VMAX 271 Fusion Strike',
    latestSnapshotDate: '2026-08-25',
    queryUsed: 'Gengar VMAX 271',
    fetchedBinCount: 10,
    keptBinCount: 5,
    detailValidationFailureCount: 0,
  });

  assert.equal(result.status, 'unscanned');
  assert.match(result.reasons[0] ?? '', /changed after the latest snapshot/);
});

test('flags thin, overly broad, and failed-detail query evidence', () => {
  const result = assessQueryHealth({
    currentQuery: 'Umbreon VMAX 215',
    latestSnapshotDate: '2026-08-25',
    queryUsed: 'Umbreon VMAX 215',
    fetchedBinCount: 50,
    keptBinCount: 2,
    detailValidationFailureCount: 1,
  });

  assert.equal(result.status, 'attention');
  assert.equal(result.acceptancePct, 4);
  assert.equal(result.reasons.length, 3);
});
