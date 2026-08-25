import type { NextRequest } from 'next/server';

import { isAuthorizedBearerHeader } from '../../../../src/auth/basicAuth';
import { pool } from '../../../../src/db/pool';
import {
  executeStorageRetention,
  getStorageRetentionPlan,
  STORAGE_RETENTION_POLICY,
} from '../../../../src/services/storageMaintenance';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MAINTENANCE_LOCK_NAME = 'pokemon-trend-scanner-storage-maintenance';

export async function GET(request: NextRequest): Promise<Response> {
  if (!isAuthorizedBearerHeader(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = await pool.connect();
  try {
    const lockResult = await client.query<{ acquired: boolean }>(
      'select pg_try_advisory_lock(hashtext($1)) as acquired',
      [MAINTENANCE_LOCK_NAME],
    );
    if (!lockResult.rows[0]?.acquired) {
      return Response.json({ status: 'already_running' }, { status: 409 });
    }

    if (process.env.STORAGE_MAINTENANCE_ENABLED !== 'true') {
      const plan = await getStorageRetentionPlan(client);
      return Response.json({ status: 'disabled', policy: STORAGE_RETENTION_POLICY, plan });
    }

    const startedAt = Date.now();
    const result = await executeStorageRetention(client);
    console.log(JSON.stringify({ source: 'storage-maintenance-cron', result }));

    return Response.json({
      status: 'succeeded',
      durationMs: Date.now() - startedAt,
      policy: STORAGE_RETENTION_POLICY,
      result,
    });
  } catch (error) {
    console.error('Storage maintenance cron failed:', error);
    return Response.json({ error: 'Storage maintenance failed' }, { status: 500 });
  } finally {
    await client.query('select pg_advisory_unlock(hashtext($1))', [MAINTENANCE_LOCK_NAME]).catch(() => undefined);
    client.release();
  }
}
