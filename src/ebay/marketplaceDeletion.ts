import crypto from 'crypto';

export const EBAY_DELETION_NOTIFICATION_PATH = '/api/ebay/marketplace-account-deletion';

export function buildChallengeResponse(
  challengeCode: string,
  verificationToken: string,
  endpoint: string,
): string {
  return crypto
    .createHash('sha256')
    .update(`${challengeCode}${verificationToken}${endpoint}`)
    .digest('hex');
}

export function resolveNotificationEndpoint(requestUrl: string, configuredBaseUrl?: string): string {
  const request = new URL(requestUrl);

  if (configuredBaseUrl && configuredBaseUrl.trim() !== '') {
    const base = configuredBaseUrl.endsWith('/') ? configuredBaseUrl.slice(0, -1) : configuredBaseUrl;
    return `${base}${EBAY_DELETION_NOTIFICATION_PATH}`;
  }

  return `${request.origin}${EBAY_DELETION_NOTIFICATION_PATH}`;
}
