import assert from 'node:assert/strict';
import test from 'node:test';

import { hashPassword, verifyPassword } from '../src/lib/password.js';

test('password hashes are salted and verifiable', async () => {
  const first = await hashPassword('HabitoSeguro123!');
  const second = await hashPassword('HabitoSeguro123!');

  assert.notEqual(first, second);
  assert.equal(await verifyPassword('HabitoSeguro123!', first), true);
  assert.equal(await verifyPassword('otra-clave', first), false);
});

test('invalid stored password format is rejected', async () => {
  assert.equal(await verifyPassword('anything', 'invalid'), false);
});
