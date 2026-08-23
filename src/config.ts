import 'dotenv/config';

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    return undefined;
  }

  return value.trim();
}

function readNonNegativeNumber(name: string, fallback = 0): number {
  const value = readEnv(name);
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative number.`);
  }

  return parsed;
}

function readPercentage(name: string, fallback = 0): number {
  const value = readNonNegativeNumber(name, fallback);
  if (value > 100) {
    throw new Error(`${name} must be between 0 and 100.`);
  }

  return value;
}

export function requireEnv(name: string): string {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

const targetNetRoiPct = readPercentage('EXIT_TARGET_NET_ROI_PCT', 20);
const acquisitionCosts = readNonNegativeNumber('EXIT_ACQUISITION_COSTS');
const ebayFeePct = readEnv('EXIT_EBAY_FEE_PCT');

const exitProfiles = [
  {
    code: 'direct_collector',
    label: 'Direct collector',
    marketplaceFeePct: 0,
    exitDiscountPct: readPercentage('EXIT_COLLECTOR_DISCOUNT_PCT', 5),
    riskReservePct: readPercentage('EXIT_COLLECTOR_RISK_RESERVE_PCT'),
    fixedFee: readNonNegativeNumber('EXIT_COLLECTOR_FIXED_COST'),
    outboundShipping: readNonNegativeNumber('EXIT_COLLECTOR_SHIPPING'),
    materials: readNonNegativeNumber('EXIT_COLLECTOR_MATERIALS'),
    acquisitionCosts,
    targetNetRoiPct,
  },
  {
    code: 'vendor',
    label: 'Vendor',
    marketplaceFeePct: 0,
    exitDiscountPct: 100 - readPercentage('EXIT_VENDOR_PAYOUT_PCT', 80),
    riskReservePct: 0,
    fixedFee: readNonNegativeNumber('EXIT_VENDOR_FIXED_COST'),
    outboundShipping: 0,
    materials: 0,
    acquisitionCosts,
    targetNetRoiPct,
  },
];

if (ebayFeePct !== undefined) {
  exitProfiles.push({
    code: 'ebay',
    label: 'eBay',
    marketplaceFeePct: readPercentage('EXIT_EBAY_FEE_PCT'),
    exitDiscountPct: readPercentage('EXIT_EBAY_DISCOUNT_PCT'),
    riskReservePct: readPercentage('EXIT_EBAY_RISK_RESERVE_PCT'),
    fixedFee: readNonNegativeNumber('EXIT_EBAY_FIXED_FEE'),
    outboundShipping: readNonNegativeNumber('EXIT_EBAY_SHIPPING'),
    materials: readNonNegativeNumber('EXIT_EBAY_MATERIALS'),
    acquisitionCosts,
    targetNetRoiPct,
  });
}

export const config = {
  databaseUrl: requireEnv('DATABASE_URL'),
  databaseSsl: readEnv('DATABASE_SSL') !== 'false',
  ebayClientId: readEnv('EBAY_CLIENT_ID'),
  ebayClientSecret: readEnv('EBAY_CLIENT_SECRET'),
  ebayMarketplaceId: readEnv('EBAY_MARKETPLACE_ID') ?? 'EBAY_US',
  ebayAuthUrl: readEnv('EBAY_AUTH_URL') ?? 'https://api.ebay.com/identity/v1/oauth2/token',
  ebayApiBaseUrl: readEnv('EBAY_API_BASE_URL') ?? 'https://api.ebay.com',
  reportsDir: readEnv('REPORTS_DIR') ?? 'reports',
  primaryExitChannel: 'direct_collector',
  exitProfiles,
};
