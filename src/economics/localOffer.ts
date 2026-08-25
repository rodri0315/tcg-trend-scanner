import type { ExitScenario } from './netOutcome';
import { round } from '../utils/math';

export type OfferEvaluationStatus = 'within_target' | 'above_target' | 'unavailable';

export interface LocalOfferEvaluation {
  status: OfferEvaluationStatus;
  offerPrice: number;
  maxBuyPrice: number | null;
  marginToMaxBuy: number | null;
  expectedSalePrice: number | null;
  estimatedNetExit: number | null;
  projectedNetProfit: number | null;
  projectedNetRoiPct: number | null;
  targetNetRoiPct: number | null;
}

export function evaluateLocalOffer(
  offerPrice: number,
  scenario: ExitScenario | null | undefined,
): LocalOfferEvaluation {
  if (!Number.isFinite(offerPrice) || offerPrice <= 0) {
    throw new Error('Offer price must be greater than zero.');
  }

  if (!scenario) {
    return {
      status: 'unavailable',
      offerPrice: round(offerPrice),
      maxBuyPrice: null,
      marginToMaxBuy: null,
      expectedSalePrice: null,
      estimatedNetExit: null,
      projectedNetProfit: null,
      projectedNetRoiPct: null,
      targetNetRoiPct: null,
    };
  }

  const totalAcquisitionCost = offerPrice + scenario.assumptions.acquisitionCosts;
  const projectedNetProfit = scenario.estimatedNetExit - totalAcquisitionCost;
  const projectedNetRoiPct = totalAcquisitionCost > 0
    ? (projectedNetProfit / totalAcquisitionCost) * 100
    : null;

  return {
    status: offerPrice <= scenario.maxBuyPrice ? 'within_target' : 'above_target',
    offerPrice: round(offerPrice),
    maxBuyPrice: scenario.maxBuyPrice,
    marginToMaxBuy: round(scenario.maxBuyPrice - offerPrice),
    expectedSalePrice: scenario.expectedSalePrice,
    estimatedNetExit: scenario.estimatedNetExit,
    projectedNetProfit: round(projectedNetProfit),
    projectedNetRoiPct: projectedNetRoiPct === null ? null : round(projectedNetRoiPct),
    targetNetRoiPct: scenario.targetNetRoiPct,
  };
}
