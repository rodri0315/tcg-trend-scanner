export type PipelineHealthStatus = 'healthy' | 'attention' | 'stale' | 'no_data';

export interface PipelineHealthInput {
  daysSinceLatestLiveSnapshot: number | null;
  trackedCards: number;
  liveCardsScanned: number;
  cardsWithTrustedAsk: number;
  missingLiveScanDays30: number;
}

export interface PipelineHealthAssessment {
  status: PipelineHealthStatus;
  reasons: string[];
}

export function assessPipelineHealth(input: PipelineHealthInput): PipelineHealthAssessment {
  if (input.daysSinceLatestLiveSnapshot === null) {
    return { status: 'no_data', reasons: ['No live snapshots have been stored'] };
  }

  const reasons: string[] = [];
  if (input.daysSinceLatestLiveSnapshot > 1) {
    reasons.push(`Latest live scan is ${input.daysSinceLatestLiveSnapshot} days old`);
  }
  if (input.liveCardsScanned < input.trackedCards) {
    reasons.push(`Latest scan covered ${input.liveCardsScanned} of ${input.trackedCards} tracked cards`);
  }
  if (input.liveCardsScanned > 0 && input.cardsWithTrustedAsk < input.liveCardsScanned) {
    reasons.push(`${input.liveCardsScanned - input.cardsWithTrustedAsk} scanned cards lack a trusted ask`);
  }
  if (input.missingLiveScanDays30 > 0) {
    reasons.push(`${input.missingLiveScanDays30} missing live scan days in the last 30 completed days`);
  }

  if (input.daysSinceLatestLiveSnapshot > 1) {
    return { status: 'stale', reasons };
  }

  return { status: reasons.length === 0 ? 'healthy' : 'attention', reasons };
}

export function daysBetweenDates(currentDate: string, previousDate: string | null): number | null {
  if (!previousDate) {
    return null;
  }

  const currentTime = Date.parse(`${currentDate}T00:00:00.000Z`);
  const previousTime = Date.parse(`${previousDate}T00:00:00.000Z`);
  if (!Number.isFinite(currentTime) || !Number.isFinite(previousTime)) {
    return null;
  }

  return Math.max(0, Math.floor((currentTime - previousTime) / (24 * 60 * 60 * 1000)));
}
