export interface OpportunityQualityInput {
  confidenceScore: number;
  sampledBinCount: number;
  activeAskLow: number | null;
  activeAskHigh: number | null;
  activeAskReference: number | null;
  activeAskChangeVsPreviousPct: number | null;
  maxBuyPrice: number | null;
}

export interface OpportunityQuality {
  isActionable: boolean;
  reviewReasons: string[];
}

export const MIN_ACTIONABLE_CONFIDENCE = 65;
export const MIN_ACTIONABLE_BIN_SAMPLE = 3;
export const MAX_ACTIONABLE_ASK_SPREAD_PCT = 25;
export const MAX_ACTIONABLE_REFERENCE_MOVE_PCT = 50;

export function assessOpportunityQuality(input: OpportunityQualityInput): OpportunityQuality {
  const reviewReasons: string[] = [];

  if (input.activeAskReference === null || input.maxBuyPrice === null) {
    reviewReasons.push('No executable ask or exit scenario');
  }
  if (input.confidenceScore < MIN_ACTIONABLE_CONFIDENCE) {
    reviewReasons.push(`Confidence below ${MIN_ACTIONABLE_CONFIDENCE}`);
  }
  if (input.sampledBinCount < MIN_ACTIONABLE_BIN_SAMPLE) {
    reviewReasons.push(`Fewer than ${MIN_ACTIONABLE_BIN_SAMPLE} credible BIN listings`);
  }

  const spreadPct = calculateAskSpreadPct(input.activeAskLow, input.activeAskHigh);
  if (spreadPct !== null && spreadPct > MAX_ACTIONABLE_ASK_SPREAD_PCT) {
    reviewReasons.push(`Ask range wider than ${MAX_ACTIONABLE_ASK_SPREAD_PCT}%`);
  }
  if (
    input.activeAskChangeVsPreviousPct !== null &&
    Math.abs(input.activeAskChangeVsPreviousPct) > MAX_ACTIONABLE_REFERENCE_MOVE_PCT
  ) {
    reviewReasons.push(`Ask reference moved more than ${MAX_ACTIONABLE_REFERENCE_MOVE_PCT}% since the previous scan`);
  }

  return { isActionable: reviewReasons.length === 0, reviewReasons };
}

function calculateAskSpreadPct(low: number | null, high: number | null): number | null {
  if (low === null || high === null || low <= 0 || high < low) {
    return null;
  }

  return ((high - low) / low) * 100;
}
