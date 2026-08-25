export interface ThinMarketHistoricalCheck {
  currentPrice: number;
  currentSampleCount: number;
  historicalReference: number | null;
  marketSegment: string;
}

export function isThinMarketHistoricalOutlier(input: ThinMarketHistoricalCheck): boolean {
  if (
    input.currentSampleCount >= 3 ||
    input.currentPrice <= 0 ||
    input.historicalReference === null ||
    input.historicalReference <= 0
  ) {
    return false;
  }

  const minimumRatio = input.marketSegment === 'psa_10' ? 0.4 : 0.35;
  const minimumGap = input.marketSegment === 'psa_10' ? 100 : 30;

  return (
    input.currentPrice < input.historicalReference * minimumRatio &&
    input.historicalReference - input.currentPrice >= minimumGap
  );
}
