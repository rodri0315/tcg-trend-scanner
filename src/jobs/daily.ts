import { pool } from '../db/pool';
import { parseDailyCliArgs } from '../utils/cli';
import { runDailyScan } from './runDailyScan';

async function main() {
  const { snapshotDate, offline, fixturePath } = parseDailyCliArgs(process.argv.slice(2));
  await runDailyScan({ snapshotDate, offline, fixturePath, trigger: 'cli' });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
