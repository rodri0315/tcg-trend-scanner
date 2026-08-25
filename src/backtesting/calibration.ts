import { percentChange } from '../utils/math';

export type BacktestHorizonDays = 7 | 30 | 90;
export type CalibrationMaturity = 'insufficient' | 'early' | 'usable';

export interface BacktestFuturePrice {
  snapshotDate: string;
  price: number;
}

export interface BacktestObservation {
  cardId: number;
  cardLabel: string;
  signalDate: string;
  rankScore: number;
  confidenceScore: number;
  startPrice: number;
  outcomes: Partial<Record<BacktestHorizonDays, BacktestFuturePrice>>;
}

export interface CalibrationBucket {
  label: string;
  minimumRankScore: number;
  maximumRankScore: number;
  evaluatedSignals: number;
  averageReturnPct: number | null;
  positiveRatePct: number | null;
  tenPctGainRatePct: number | null;
}

export interface HorizonBacktestSummary {
  horizonDays: BacktestHorizonDays;
  totalSignals: number;
  eligibleSignals: number;
  evaluatedSignals: number;
  missingOutcomes: number;
  pendingSignals: number;
  coveragePct: number;
  averageReturnPct: number | null;
  medianReturnPct: number | null;
  positiveRatePct: number | null;
  tenPctGainRatePct: number | null;
  maturity: CalibrationMaturity;
  buckets: CalibrationBucket[];
}

const HORIZON_WINDOW_END_DAYS: Record<BacktestHorizonDays, number> = {
  7: 10,
  30: 37,
  90: 104,
};

const RANK_BUCKETS = [
  { label: '0–19', minimum: 0, maximum: 20 },
  { label: '20–39', minimum: 20, maximum: 40 },
  { label: '40–59', minimum: 40, maximum: 60 },
  { label: '60–79', minimum: 60, maximum: 80 },
  { label: '80–100', minimum: 80, maximum: 101 },
];

export function summarizeBacktests(
  observations: BacktestObservation[],
  latestLiveDate: string | null,
): HorizonBacktestSummary[] {
  return ([7, 30, 90] as BacktestHorizonDays[]).map((horizonDays) =>
    summarizeHorizon(observations, latestLiveDate, horizonDays),
  );
}

function summarizeHorizon(
  observations: BacktestObservation[],
  latestLiveDate: string | null,
  horizonDays: BacktestHorizonDays,
): HorizonBacktestSummary {
  const evaluated = observations.flatMap((observation) => {
    const outcome = observation.outcomes[horizonDays];
    if (!outcome) {
      return [];
    }

    const returnPct = percentChange(outcome.price, observation.startPrice);
    return returnPct === null || !Number.isFinite(returnPct) ? [] : [{ observation, returnPct }];
  });
  const eligibleSignals = observations.filter((observation) =>
    observation.outcomes[horizonDays] !== undefined ||
    hasWindowClosed(observation.signalDate, latestLiveDate, HORIZON_WINDOW_END_DAYS[horizonDays]),
  ).length;
  const returns = evaluated.map((entry) => entry.returnPct);
  const averageReturnPct = average(returns);
  const medianReturnPct = median(returns);
  const positiveRatePct = rate(returns, (value) => value > 0);
  const tenPctGainRatePct = rate(returns, (value) => value >= 10);
  const coveragePct = eligibleSignals === 0 ? 0 : roundPct((evaluated.length / eligibleSignals) * 100);

  return {
    horizonDays,
    totalSignals: observations.length,
    eligibleSignals,
    evaluatedSignals: evaluated.length,
    missingOutcomes: Math.max(0, eligibleSignals - evaluated.length),
    pendingSignals: Math.max(0, observations.length - eligibleSignals),
    coveragePct,
    averageReturnPct,
    medianReturnPct,
    positiveRatePct,
    tenPctGainRatePct,
    maturity: getCalibrationMaturity(evaluated.length, coveragePct),
    buckets: RANK_BUCKETS.map((bucket) => {
      const bucketReturns = evaluated
        .filter(({ observation }) => observation.rankScore >= bucket.minimum && observation.rankScore < bucket.maximum)
        .map((entry) => entry.returnPct);
      return {
        label: bucket.label,
        minimumRankScore: bucket.minimum,
        maximumRankScore: bucket.maximum === 101 ? 100 : bucket.maximum - 1,
        evaluatedSignals: bucketReturns.length,
        averageReturnPct: average(bucketReturns),
        positiveRatePct: rate(bucketReturns, (value) => value > 0),
        tenPctGainRatePct: rate(bucketReturns, (value) => value >= 10),
      };
    }),
  };
}

function hasWindowClosed(signalDate: string, latestLiveDate: string | null, windowEndDays: number): boolean {
  if (!latestLiveDate) {
    return false;
  }

  const signalTime = Date.parse(`${signalDate}T00:00:00.000Z`);
  const latestTime = Date.parse(`${latestLiveDate}T00:00:00.000Z`);
  if (!Number.isFinite(signalTime) || !Number.isFinite(latestTime)) {
    return false;
  }

  return latestTime >= signalTime + windowEndDays * 24 * 60 * 60 * 1000;
}

function getCalibrationMaturity(evaluatedSignals: number, coveragePct: number): CalibrationMaturity {
  if (evaluatedSignals < 30 || coveragePct < 50) {
    return 'insufficient';
  }

  return evaluatedSignals < 100 || coveragePct < 70 ? 'early' : 'usable';
}

function average(values: number[]): number | null {
  return values.length === 0 ? null : roundPct(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? roundPct(((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2)
    : roundPct(sorted[middle] ?? 0);
}

function rate(values: number[], predicate: (value: number) => boolean): number | null {
  return values.length === 0 ? null : roundPct((values.filter(predicate).length / values.length) * 100);
}

function roundPct(value: number): number {
  return Math.round(value * 100) / 100;
}
