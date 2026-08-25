import type { NextRequest } from 'next/server';

import { isAuthorizedBearerHeader } from '../../../../src/auth/basicAuth';
import { pool } from '../../../../src/db/pool';
import { runDailyScan } from '../../../../src/jobs/runDailyScan';
import { todayInNewYork } from '../../../../src/utils/date';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const SCAN_LOCK_NAME = 'pokemon-trend-scanner-daily-scan';

export async function GET(request: NextRequest): Promise<Response> {
  if (!isAuthorizedBearerHeader(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const snapshotDate = todayInNewYork();
  const lockClient = await pool.connect();

  try {
    const lockResult = await lockClient.query<{ acquired: boolean }>(
      'select pg_try_advisory_lock(hashtext($1)) as acquired',
      [SCAN_LOCK_NAME],
    );
    if (!lockResult.rows[0]?.acquired) {
      return Response.json({ status: 'already_running', snapshotDate }, { status: 409 });
    }

    if (await hasCompleteLiveScan(snapshotDate)) {
      return Response.json({ status: 'already_complete', snapshotDate });
    }

    const startedAt = Date.now();
    const result = await runDailyScan({
      snapshotDate,
      trigger: 'cron',
      writeReport: false,
      log: (message) => console.log(JSON.stringify({ source: 'daily-scan-cron', message })),
    });

    return Response.json({
      status: 'succeeded',
      snapshotDate,
      durationMs: Date.now() - startedAt,
      ...result,
    });
  } catch (error) {
    console.error('Daily scan cron failed:', error);
    return Response.json({ error: 'Daily scan failed', snapshotDate }, { status: 500 });
  } finally {
    await lockClient.query('select pg_advisory_unlock(hashtext($1))', [SCAN_LOCK_NAME]).catch(() => undefined);
    lockClient.release();
  }
}

async function hasCompleteLiveScan(snapshotDate: string): Promise<boolean> {
  const result = await pool.query<{ scanned_cards: string; tracked_cards: string }>(
    `
      select
        count(distinct c.id)::text as tracked_cards,
        count(distinct e.card_id)::text as scanned_cards
      from cards c
      left join ebay_daily e
        on e.card_id = c.id
       and e.snapshot_date = $1
       and e.snapshot_source = 'live'
    `,
    [snapshotDate],
  );
  const row = result.rows[0];
  const trackedCards = Number(row?.tracked_cards ?? 0);
  return trackedCards > 0 && Number(row?.scanned_cards ?? 0) === trackedCards;
}
