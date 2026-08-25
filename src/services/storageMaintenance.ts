import type { PoolClient } from 'pg';

export const STORAGE_RETENTION_POLICY = {
  listingSampleDays: 90,
  rawPayloadDays: 45,
  successfulScanRunDays: 365,
  batchSize: 5_000,
} as const;

export interface StorageRetentionPlan {
  listingSamplesToDelete: number;
  rawPayloadsToClear: number;
  successfulScanRunsToDelete: number;
}

export interface StorageRetentionResult extends StorageRetentionPlan {
  batches: number;
}

export async function getStorageRetentionPlan(client: PoolClient): Promise<StorageRetentionPlan> {
  const result = await client.query<{
    listing_samples_to_delete: string;
    raw_payloads_to_clear: string;
    successful_scan_runs_to_delete: string;
  }>(
    `
      select
        (select count(*) from public.ebay_listing_samples where observed_date < current_date - $1::integer)::text as listing_samples_to_delete,
        (select count(*) from public.ebay_daily where raw_payload is not null and snapshot_date < current_date - $2::integer)::text as raw_payloads_to_clear,
        (select count(*) from public.scan_runs where status = 'succeeded' and run_date < current_date - $3::integer)::text as successful_scan_runs_to_delete
    `,
    [
      STORAGE_RETENTION_POLICY.listingSampleDays,
      STORAGE_RETENTION_POLICY.rawPayloadDays,
      STORAGE_RETENTION_POLICY.successfulScanRunDays,
    ],
  );
  const row = result.rows[0];

  return {
    listingSamplesToDelete: Number(row?.listing_samples_to_delete ?? 0),
    rawPayloadsToClear: Number(row?.raw_payloads_to_clear ?? 0),
    successfulScanRunsToDelete: Number(row?.successful_scan_runs_to_delete ?? 0),
  };
}

export async function executeStorageRetention(client: PoolClient): Promise<StorageRetentionResult> {
  let listingSamplesToDelete = 0;
  let rawPayloadsToClear = 0;
  let successfulScanRunsToDelete = 0;
  let batches = 0;

  listingSamplesToDelete = await executeBatches(client, async () => {
    const result = await client.query(
      `
        with targets as (
          select id
          from public.ebay_listing_samples
          where observed_date < current_date - $1::integer
          order by observed_date, id
          limit $2
        )
        delete from public.ebay_listing_samples samples
        using targets
        where samples.id = targets.id
      `,
      [STORAGE_RETENTION_POLICY.listingSampleDays, STORAGE_RETENTION_POLICY.batchSize],
    );
    batches += 1;
    return result.rowCount ?? 0;
  });

  rawPayloadsToClear = await executeBatches(client, async () => {
    const result = await client.query(
      `
        with targets as (
          select id
          from public.ebay_daily
          where raw_payload is not null
            and snapshot_date < current_date - $1::integer
          order by snapshot_date, id
          limit $2
        )
        update public.ebay_daily snapshots
        set raw_payload = null
        from targets
        where snapshots.id = targets.id
      `,
      [STORAGE_RETENTION_POLICY.rawPayloadDays, STORAGE_RETENTION_POLICY.batchSize],
    );
    batches += 1;
    return result.rowCount ?? 0;
  });

  successfulScanRunsToDelete = await executeBatches(client, async () => {
    const result = await client.query(
      `
        with targets as (
          select id
          from public.scan_runs
          where status = 'succeeded'
            and run_date < current_date - $1::integer
          order by run_date, id
          limit $2
        )
        delete from public.scan_runs runs
        using targets
        where runs.id = targets.id
      `,
      [STORAGE_RETENTION_POLICY.successfulScanRunDays, STORAGE_RETENTION_POLICY.batchSize],
    );
    batches += 1;
    return result.rowCount ?? 0;
  });

  return {
    listingSamplesToDelete,
    rawPayloadsToClear,
    successfulScanRunsToDelete,
    batches,
  };
}

async function executeBatches(client: PoolClient, executeBatch: () => Promise<number>): Promise<number> {
  let total = 0;

  while (true) {
    await client.query('begin');
    try {
      const affected = await executeBatch();
      await client.query('commit');
      total += affected;
      if (affected < STORAGE_RETENTION_POLICY.batchSize) {
        return total;
      }
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
  }
}
