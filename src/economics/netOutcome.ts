import { round } from '../utils/math';

export interface SellingCostProfile {
  code: string;
  label: string;
  marketplaceFeePct: number;
  exitDiscountPct: number;
  riskReservePct: number;
  fixedFee: number;
  outboundShipping: number;
  materials: number;
  acquisitionCosts: number;
  targetNetRoiPct: number;
}

export interface NetOutcome {
  expectedSalePrice: number;
  estimatedNetExit: number;
  maxBuyPrice: number;
}

export interface ExitScenario extends NetOutcome {
  code: string;
  label: string;
  targetNetRoiPct: number;
  assumptions: SellingCostProfile;
  negotiationRange?: {
    optimistic: NetOutcome;
    expected: NetOutcome;
    conservative: NetOutcome;
    discountPcts: {
      optimistic: number;
      expected: number;
      conservative: number;
    };
  };
}

export function calculateNetOutcome(
  activeAskReference: number | null,
  profile: SellingCostProfile | null,
): NetOutcome | null {
  if (activeAskReference === null || activeAskReference <= 0 || profile === null) {
    return null;
  }

  const expectedSalePrice = activeAskReference * (1 - profile.exitDiscountPct / 100);
  const percentageCosts = expectedSalePrice * ((profile.marketplaceFeePct + profile.riskReservePct) / 100);
  const estimatedNetExit = Math.max(
    expectedSalePrice - percentageCosts - profile.fixedFee - profile.outboundShipping - profile.materials,
    0,
  );
  const maxBuyPrice = Math.max(
    estimatedNetExit / (1 + profile.targetNetRoiPct / 100) - profile.acquisitionCosts,
    0,
  );

  return {
    expectedSalePrice: round(expectedSalePrice),
    estimatedNetExit: round(estimatedNetExit),
    maxBuyPrice: round(maxBuyPrice),
  };
}

export function calculateExitScenarios(
  activeAskReference: number | null,
  profiles: SellingCostProfile[],
): Record<string, ExitScenario> {
  return Object.fromEntries(
    profiles.flatMap((profile) => {
      const outcome = calculateNetOutcome(activeAskReference, profile);
      if (outcome === null) {
        return [];
      }

      return [[profile.code, {
        ...outcome,
        code: profile.code,
        label: profile.label,
        targetNetRoiPct: profile.targetNetRoiPct,
        assumptions: profile,
      }]];
    }),
  );
}
