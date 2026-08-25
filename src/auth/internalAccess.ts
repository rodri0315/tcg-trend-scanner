import { headers } from 'next/headers';

import { isAuthorizedBasicHeader, readInternalCredentials } from './basicAuth';

export async function assertInternalAccess(): Promise<void> {
  const credentials = readInternalCredentials();
  if (!credentials) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Internal access is not configured.');
    }
    return;
  }

  const requestHeaders = await headers();
  if (!isAuthorizedBasicHeader(requestHeaders.get('authorization'), credentials)) {
    throw new Error('Unauthorized internal action.');
  }
}
