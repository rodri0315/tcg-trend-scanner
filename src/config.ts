import 'dotenv/config';

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    return undefined;
  }

  return value.trim();
}

export function requireEnv(name: string): string {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
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
};
