import assert from 'node:assert/strict';
import test from 'node:test';

import { isAuthorizedBasicHeader, readInternalCredentials } from './basicAuth';

test('reads a configured single-user credential pair', () => {
  assert.deepEqual(
    readInternalCredentials({ APP_ACCESS_USERNAME: 'jorge', APP_ACCESS_PASSWORD: 'secret' }),
    { username: 'jorge', password: 'secret' },
  );
});

test('defaults the username and requires a password', () => {
  assert.deepEqual(readInternalCredentials({ APP_ACCESS_PASSWORD: 'secret' }), {
    username: 'admin',
    password: 'secret',
  });
  assert.equal(readInternalCredentials({}), null);
});

test('authorizes only an exact basic credential match', () => {
  const expected = { username: 'jorge', password: 'correct horse battery staple' };
  const valid = `Basic ${Buffer.from(`${expected.username}:${expected.password}`).toString('base64')}`;
  const invalid = `Basic ${Buffer.from(`${expected.username}:wrong`).toString('base64')}`;

  assert.equal(isAuthorizedBasicHeader(valid, expected), true);
  assert.equal(isAuthorizedBasicHeader(invalid, expected), false);
  assert.equal(isAuthorizedBasicHeader(null, expected), false);
});
