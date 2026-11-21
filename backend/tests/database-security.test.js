import { test } from 'node:test';
import assert from 'node:assert/strict';
import { databaseConnectionOptions } from '../database-security.js';

test('remote database validates certificates even when the URL requests weaker TLS', () => {
  const result = databaseConnectionOptions('postgresql://example.test/db?sslmode=require', {});
  assert.equal(result.ssl.rejectUnauthorized, true);
  assert.equal(new URL(result.connectionString).searchParams.has('sslmode'), false);
});

test('TLS cannot be disabled remotely and hostname parsing cannot be fooled by URL text', () => {
  assert.throws(() => databaseConnectionOptions('postgresql://example.test/localhost', { PGSSLMODE: 'disable' }));
  assert.throws(() => databaseConnectionOptions('postgresql://example.test/db?sslmode=disable', {}));
  assert.equal(databaseConnectionOptions('postgresql://localhost/db', {}).ssl, false);
});

test('trusted CA is configurable and URL certificate options cannot override it', () => {
  const result = databaseConnectionOptions('postgresql://example.test/db?sslrootcert=other.pem', { PGSSL_CA: 'first\\nsecond' });
  assert.equal(result.ssl.ca, 'first\nsecond');
  assert.equal(new URL(result.connectionString).searchParams.has('sslrootcert'), false);
});
