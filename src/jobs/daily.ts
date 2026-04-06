import { pool } from '../db/pool';
import { generateDailyReport } from '../reports/dailyReport';
import { fetchEbaySnapshots } from '../services/ebay';
import { loadEbaySnapshotsFromFixture } from '../services/ebayFixture';
import { getCards } from '../services/cards';
import { upsertEbaySnapshots, upsertSignals } from '../services/snapshots';
import { calculateDailySignals } from '../signals/calculateDailySignals';
import type { SnapshotSource } from '../types';
import { parseDailyCliArgs } from '../utils/cli';
import { todayInNewYork } from '../utils/date';

async function main() {
  const { snapshotDate, offline, fixturePath } = parseDailyCliArgs(process.argv.slice(2));
  const cards = await getCards();

  if (cards.length === 0) {
    throw new Error('No cards found. Run the seed import before the daily job.');
  }

  console.log(`Running daily scan for ${cards.length} cards on ${snapshotDate}${offline ? ' [offline]' : ''}`);

  const collectedSnapshots = offline
    ? loadEbaySnapshotsFromFixture(cards, snapshotDate, fixturePath)
    : await fetchEbaySnapshots(cards, snapshotDate);
  const snapshotSource: SnapshotSource = offline
    ? 'fixture'
    : snapshotDate === todayInNewYork()
      ? 'live'
      : 'backfill';
  const ebaySnapshots = collectedSnapshots.map((snapshot) => ({
    ...snapshot,
    snapshotSource,
  }));
  await upsertEbaySnapshots(ebaySnapshots);
  console.log(`Stored ${ebaySnapshots.length} eBay snapshots`);
  if (offline) {
    console.log(`Loaded fixture data from ${fixturePath}`);
  }

  const signals = await calculateDailySignals(cards, snapshotDate);
  await upsertSignals(signals);
  console.log(`Stored ${signals.length} daily signals`);

  const report = await generateDailyReport(snapshotDate);
  console.log(`Report written to ${report.csvPath}`);
  console.log(`Report written to ${report.markdownPath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
