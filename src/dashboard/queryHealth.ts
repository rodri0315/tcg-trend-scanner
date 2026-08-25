export type QueryHealthStatus = 'healthy' | 'attention' | 'unscanned';

export interface QueryHealthInput {
  currentQuery: string;
  latestSnapshotDate: string | null;
  queryUsed: string | null;
  fetchedBinCount: number;
  keptBinCount: number;
  detailValidationFailureCount: number;
}

export interface QueryHealthAssessment {
  status: QueryHealthStatus;
  reasons: string[];
  latestSnapshotDate: string | null;
  fetchedBinCount: number;
  keptBinCount: number;
  acceptancePct: number | null;
}

export function assessQueryHealth(input: QueryHealthInput): QueryHealthAssessment {
  const acceptancePct = input.fetchedBinCount > 0
    ? Math.round((input.keptBinCount / input.fetchedBinCount) * 100)
    : null;

  if (!input.latestSnapshotDate || input.queryUsed === null) {
    return buildAssessment('unscanned', ['This card has not completed a live query review yet.'], input, acceptancePct);
  }

  if (normalizeQuery(input.currentQuery) !== normalizeQuery(input.queryUsed)) {
    return buildAssessment(
      'unscanned',
      ['The current query changed after the latest snapshot and has not been validated by a scan yet.'],
      input,
      acceptancePct,
    );
  }

  const reasons: string[] = [];
  if (input.keptBinCount === 0) {
    reasons.push('No fixed-price listings passed the identity and price checks.');
  } else if (input.keptBinCount < 3) {
    reasons.push(`Only ${input.keptBinCount} fixed-price listing${input.keptBinCount === 1 ? '' : 's'} passed; at least 3 are needed for a trusted ask.`);
  }

  if (input.detailValidationFailureCount > 0) {
    reasons.push(`${input.detailValidationFailureCount} low-price candidate${input.detailValidationFailureCount === 1 ? '' : 's'} could not be validated against eBay item details.`);
  }

  if (input.fetchedBinCount >= 20 && acceptancePct !== null && acceptancePct < 10) {
    reasons.push(`Only ${acceptancePct}% of fetched fixed-price listings matched; the query may be too broad.`);
  }

  return buildAssessment(reasons.length === 0 ? 'healthy' : 'attention', reasons, input, acceptancePct);
}

function buildAssessment(
  status: QueryHealthStatus,
  reasons: string[],
  input: QueryHealthInput,
  acceptancePct: number | null,
): QueryHealthAssessment {
  return {
    status,
    reasons,
    latestSnapshotDate: input.latestSnapshotDate,
    fetchedBinCount: input.fetchedBinCount,
    keptBinCount: input.keptBinCount,
    acceptancePct,
  };
}

function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ').toLowerCase();
}
