import 'dotenv/config';

import { URL } from 'url';

import { pool } from '../src/db/pool';

function summarizeConnectionString(connectionString: string): string {
  const parsed = new URL(connectionString);
  const sslMode = parsed.searchParams.get('sslmode') ?? 'not-set';
  const host = parsed.hostname || 'missing';
  const port = parsed.port || '(default)';
  const database = parsed.pathname?.replace(/^\//, '') || 'missing';
  const hasPassword = parsed.password.length > 0;

  return `host=${host} port=${port} database=${database} sslmode=${sslMode} password=${hasPassword ? 'set' : 'missing'}`;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('Missing DATABASE_URL');
  }

  console.log('DB connection summary:', summarizeConnectionString(databaseUrl));
  console.log(`DATABASE_SSL=${process.env.DATABASE_SSL ?? '(not-set)'}`);

  const startedAt = Date.now();
  const result = await pool.query<{ ok: number; now: string }>('select 1 as ok, now()::text as now');
  const elapsedMs = Date.now() - startedAt;
  const row = result.rows[0];

  console.log(`DB check passed in ${elapsedMs}ms (ok=${row.ok}, server_time=${row.now})`);
}

main()
  .catch((error) => {
    console.error('DB check failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
