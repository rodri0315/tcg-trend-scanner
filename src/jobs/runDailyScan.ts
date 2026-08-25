import { generateDailyReport } from '../reports/dailyReport';
import { fetchEbaySnapshots } from '../services/ebay';
import { loadEbaySnapshotsFromFixture } from '../services/ebayFixture';
import { getCards } from '../services/cards';
import { completeScanRun, failScanRun, startScanRun, type ScanTrigger } from '../services/scanRuns';
import { upsertEbaySnapshots, upsertSignals } from '../services/snapshots';
import { calculateDailySignals } from '../signals/calculateDailySignals';
import type { SnapshotSource } from '../types';
import { todayInNewYork } from '../utils/date';

export interface RunDailyScanOptions {
  snapshotDate: string;
  trigger: ScanTrigger;
  offline?: boolean;
  fixturePath?: string;
  writeReport?: boolean;
  log?: (message: string) => void;
}

export interface DailyScanResult {
  trackedCards: number;
  snapshotsStored: number;
  signalsStored: number;
}

export async function runDailyScan(options: RunDailyScanOptions): Promise<DailyScanResult> {
  const {
    snapshotDate,
    trigger,
    offline = false,
    fixturePath = 'seed/mock_ebay_daily.json',
    writeReport = true,
    log = console.log,
  } = options;
  const cards = await getCards();

  if (cards.length === 0) {
    throw new Error('No cards found. Run the seed import before the daily job.');
  }

  const runId = await startScanRun(snapshotDate, trigger);
  try {
    log(`Running daily scan for ${cards.length} cards on ${snapshotDate}${offline ? ' [offline]' : ''}`);

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
    log(`Stored ${ebaySnapshots.length} eBay snapshots`);
    if (offline) {
      log(`Loaded fixture data from ${fixturePath}`);
    }

    const signals = await calculateDailySignals(cards, snapshotDate);
    await upsertSignals(signals);
    log(`Stored ${signals.length} daily signals`);

    if (writeReport) {
      const report = await generateDailyReport(snapshotDate);
      log(`Report written to ${report.csvPath}`);
      log(`Report written to ${report.markdownPath}`);
    }

    const result = {
      trackedCards: cards.length,
      snapshotsStored: ebaySnapshots.length,
      signalsStored: signals.length,
    };
    await completeScanRun(runId, result);
    return result;
  } catch (error) {
    await failScanRun(runId, error).catch((runError) => {
      console.error('Failed to record scan failure:', runError);
    });
    throw error;
  }
}
