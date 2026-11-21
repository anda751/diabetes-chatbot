import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { isTrustedOrigin, verifySignature } from '../request-security.js';

test('production rejects implicit private-network origins', () => {
  const allowed = ['https://care.example.test'];
  for (const origin of ['http://localhost:5173', 'http://192.168.1.5:5173', 'http://10.0.0.1', 'null', 'https://attacker.test']) {
    assert.equal(isTrustedOrigin(origin, allowed, true), false, origin);
  }
  assert.equal(isTrustedOrigin(allowed[0], allowed, true), true);
  assert.equal(isTrustedOrigin('http://localhost:5173', allowed, false), true);
});

test('explicit native origins and no-origin API clients remain supported', () => {
  assert.equal(isTrustedOrigin('capacitor://localhost', ['capacitor://localhost'], true), true);
  assert.equal(isTrustedOrigin(undefined, [], true), true);
  assert.equal(isTrustedOrigin('http://192.168.1.5', ['http://192.168.1.5'], true), true);
});

test('configured preview patterns are anchored', () => {
  const allowed = ['https://*.example.test'];
  assert.equal(isTrustedOrigin('https://preview.example.test', allowed, true), true);
  assert.equal(isTrustedOrigin('https://preview.example.test.attacker.test', allowed, true), false);
  assert.equal(isTrustedOrigin('https://previewXexample.test', ['https://preview.example.test'], true), false);
});

test('valid sessions verify while tampering and malformed signatures fail closed', () => {
  const secret = 'unit-test-only-secret';
  const payload = Buffer.from(JSON.stringify({ userId: 1, expiresAt: 123 })).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('hex');
  assert.equal(verifySignature(payload, signature, secret), true);
  assert.equal(verifySignature(payload + 'x', signature, secret), false);
  assert.equal(verifySignature(payload, signature, 'different-secret'), false);
  for (const malformed of ['', 'x', '0'.repeat(63), 'z'.repeat(64), undefined, []]) {
    assert.equal(verifySignature(payload, malformed, secret), false);
  }
});
