export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  shouldRetry: (error: unknown) => boolean;
  getRetryAfterMs?: (error: unknown) => number | null;
  onRetry?: (context: { attempt: number; delayMs: number; error: unknown }) => void;
  sleep?: (delayMs: number) => Promise<void>;
}

export async function withRetry<T>(operation: () => Promise<T>, options: RetryOptions): Promise<T> {
  const sleep = options.sleep ?? defaultSleep;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= options.maxAttempts || !options.shouldRetry(error)) {
        throw error;
      }

      const exponentialDelay = Math.min(
        options.baseDelayMs * 2 ** (attempt - 1),
        options.maxDelayMs,
      );
      const retryAfterMs = options.getRetryAfterMs?.(error) ?? null;
      const delayMs = Math.min(
        Math.max(exponentialDelay, retryAfterMs ?? 0),
        options.maxDelayMs,
      );
      options.onRetry?.({ attempt, delayMs, error });
      await sleep(delayMs);
    }
  }

  throw new Error('Retry loop ended unexpectedly.');
}

function defaultSleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}
