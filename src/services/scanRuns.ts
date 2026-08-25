import { pool } from '../db/pool';

export type ScanTrigger = 'cli' | 'cron';

export async function startScanRun(runDate: string, trigger: ScanTrigger): Promise<number> {
  const result = await pool.query<{ id: number }>(
    `
      insert into scan_runs (run_date, trigger_source, status)
      values ($1, $2, 'running')
      returning id
    `,
    [runDate, trigger],
  );

  const id = result.rows[0]?.id;
  if (!id) {
    throw new Error('Failed to create scan run record.');
  }

  return id;
}

export async function completeScanRun(
  runId: number,
  counts: { trackedCards: number; snapshotsStored: number; signalsStored: number },
): Promise<void> {
  await pool.query(
    `
      update scan_runs
      set status = 'succeeded',
          completed_at = now(),
          tracked_cards = $2,
          snapshots_stored = $3,
          signals_stored = $4,
          error_message = null
      where id = $1
    `,
    [runId, counts.trackedCards, counts.snapshotsStored, counts.signalsStored],
  );
}

export async function failScanRun(runId: number, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : 'Unknown scan failure';
  await pool.query(
    `
      update scan_runs
      set status = 'failed',
          completed_at = now(),
          error_message = $2
      where id = $1
    `,
    [runId, message.slice(0, 1000)],
  );
}
