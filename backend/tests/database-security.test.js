import { test } from 'node:test';
import assert from 'node:assert/strict';
import { databaseConnectionOptions } from '../database-security.js';

test('remote database validates certificates even when the URL requests weaker TLS', () => {
  const result = databaseConnectionOptions('postgresql://example.test/db?sslmode=require', {});
  assert.equal(result.ssl.rejectUnauthorized, true);
  assert.equal(new URL(result.connectionString).searchParams.has('sslmode'), false);
});

test('TLS cannot be disabled remotely and hostname parsing cannot be fooled by URL text', () => {
  assert.throws(() => databaseConnectionOptions('invalid-url-with-private-password', {}), error => !String(error).includes('private-password'));
  assert.throws(() => databaseConnectionOptions('postgresql://example.test/localhost', { PGSSLMODE: 'disable' }));
  assert.throws(() => databaseConnectionOptions('postgresql://example.test/db?sslmode=disable', {}));
  assert.equal(databaseConnectionOptions('postgresql://localhost/db', {}).ssl, false);
});

test('trusted CA is configurable and URL certificate options cannot override it', () => {
  const result = databaseConnectionOptions('postgresql://example.test/db?sslrootcert=other.pem', { PGSSL_CA: 'first\\nsecond' });
  assert.equal(result.ssl.ca, 'first\nsecond');
  assert.equal(new URL(result.connectionString).searchParams.has('sslrootcert'), false);
});

test('Supabase uses the bundled public CA without trusting it for unrelated hosts', () => {
  const supabase = databaseConnectionOptions('postgresql://db.example.supabase.co/postgres', {});
  assert.ok(supabase.ssl.ca.includes('BEGIN CERTIFICATE'));
  assert.equal(databaseConnectionOptions('postgresql://db.example.test/db', {}).ssl.ca, undefined);
  assert.equal(databaseConnectionOptions('postgresql://db.example.supabase.co/db', {PGSSL_CA:'custom'}).ssl.ca, 'custom');
});
