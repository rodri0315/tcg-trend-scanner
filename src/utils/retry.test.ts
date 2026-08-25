import assert from 'node:assert/strict';
import test from 'node:test';

import { withRetry } from './retry';

test('retries transient failures with capped exponential delays', async () => {
  let attempts = 0;
  const delays: number[] = [];
  const result = await withRetry(
    async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new Error('transient');
      }
      return 'ok';
    },
    {
      maxAttempts: 3,
      baseDelayMs: 100,
      maxDelayMs: 150,
      shouldRetry: () => true,
      sleep: async (delayMs) => {
        delays.push(delayMs);
      },
    },
  );

  assert.equal(result, 'ok');
  assert.equal(attempts, 3);
  assert.deepEqual(delays, [100, 150]);
});

test('respects retry-after when it is longer than the exponential delay', async () => {
  const delays: number[] = [];
  let attempts = 0;
  const result = await withRetry(
    async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error('rate limited');
      }
      return 'ok';
    },
    {
      maxAttempts: 3,
      baseDelayMs: 100,
      maxDelayMs: 500,
      shouldRetry: () => true,
      getRetryAfterMs: () => 400,
      sleep: async (delayMs) => {
        delays.push(delayMs);
      },
    },
  );

  assert.equal(result, 'ok');
  assert.equal(attempts, 2);
  assert.deepEqual(delays, [400]);
});

test('does not retry permanent failures', async () => {
  const delays: number[] = [];
  let attempts = 0;
  await assert.rejects(
    withRetry(
      async () => {
        attempts += 1;
        throw new Error('permanent');
      },
      {
        maxAttempts: 3,
        baseDelayMs: 100,
        maxDelayMs: 500,
        shouldRetry: () => false,
        getRetryAfterMs: () => 400,
        sleep: async (delayMs) => {
          delays.push(delayMs);
        },
      },
    ),
    /permanent/,
  );

  assert.equal(attempts, 1);
  assert.deepEqual(delays, []);
});
