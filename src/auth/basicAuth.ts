import { createHash, timingSafeEqual } from 'crypto';

export interface InternalCredentials {
  username: string;
  password: string;
}

export function readInternalCredentials(env: NodeJS.ProcessEnv = process.env): InternalCredentials | null {
  const password = env.APP_ACCESS_PASSWORD?.trim();
  if (!password) {
    return null;
  }

  return {
    username: env.APP_ACCESS_USERNAME?.trim() || 'admin',
    password,
  };
}

export function isAuthorizedBasicHeader(
  authorizationHeader: string | null,
  expected: InternalCredentials,
): boolean {
  if (!authorizationHeader?.startsWith('Basic ')) {
    return false;
  }

  let decoded: string;
  try {
    decoded = Buffer.from(authorizationHeader.slice('Basic '.length), 'base64').toString('utf8');
  } catch {
    return false;
  }

  const separatorIndex = decoded.indexOf(':');
  if (separatorIndex < 0) {
    return false;
  }

  const username = decoded.slice(0, separatorIndex);
  const password = decoded.slice(separatorIndex + 1);
  return secureEqual(username, expected.username) && secureEqual(password, expected.password);
}

function secureEqual(left: string, right: string): boolean {
  const leftHash = createHash('sha256').update(left).digest();
  const rightHash = createHash('sha256').update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}
