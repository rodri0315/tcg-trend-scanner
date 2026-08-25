import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { isAuthorizedBasicHeader, readInternalCredentials } from './src/auth/basicAuth';

export function proxy(request: NextRequest): NextResponse {
  const credentials = readInternalCredentials();

  if (!credentials) {
    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.next();
    }

    return new NextResponse('Internal access is not configured.', {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  if (isAuthorizedBasicHeader(request.headers.get('authorization'), credentials)) {
    return NextResponse.next();
  }

  return new NextResponse('Authentication required.', {
    status: 401,
    headers: {
      'Cache-Control': 'no-store',
      'WWW-Authenticate': 'Basic realm="TCG Market Pulse", charset="UTF-8"',
    },
  });
}

export const config = {
  matcher: ['/((?!api/cron/daily-scan|api/ebay/marketplace-account-deletion|_next/static|_next/image|favicon.ico).*)'],
};
