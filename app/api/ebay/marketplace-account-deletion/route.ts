import { NextRequest, NextResponse } from 'next/server';

import {
  buildChallengeResponse,
  EBAY_DELETION_NOTIFICATION_PATH,
  resolveNotificationEndpoint,
} from '../../../../src/ebay/marketplaceDeletion';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const challengeCode = request.nextUrl.searchParams.get('challenge_code');
  const verificationToken = process.env.EBAY_VERIFICATION_TOKEN;
  const baseUrl = process.env.APP_BASE_URL;

  if (!challengeCode) {
    return NextResponse.json(
      { error: 'Missing challenge_code query parameter.' },
      { status: 400 },
    );
  }

  if (!verificationToken) {
    return NextResponse.json(
      { error: 'Missing EBAY_VERIFICATION_TOKEN environment variable.' },
      { status: 500 },
    );
  }

  const endpoint = resolveNotificationEndpoint(request.url, baseUrl);
  const challengeResponse = buildChallengeResponse(challengeCode, verificationToken, endpoint);

  return NextResponse.json({ challengeResponse });
}

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);

  console.log(
    JSON.stringify({
      source: 'ebay-marketplace-account-deletion',
      path: EBAY_DELETION_NOTIFICATION_PATH,
      receivedAt: new Date().toISOString(),
      payload,
    }),
  );

  return new NextResponse(null, { status: 204 });
}
