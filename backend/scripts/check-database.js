import dotenv from 'dotenv';
import { Client } from 'pg';
import { databaseConnectionOptions } from '../database-security.js';

dotenv.config({ path: '.env.local', override: true, quiet: true });
dotenv.config({ quiet: true });
let client;
try {
  client = new Client({
    ...databaseConnectionOptions(process.env.SUPABASE_DB_URL || process.env.DATABASE_URL),
    connectionTimeoutMillis: 12000,
    query_timeout: 12000,
  });
  await client.connect();
  await client.query('SELECT 1 AS connection_check');
  const stream = client.connection.stream;
  console.log(JSON.stringify({ status: 'connected', encrypted: Boolean(stream.encrypted), certificateVerified: stream.authorized === true }));
} catch (error) {
  console.error(JSON.stringify({ status: 'failed', code: /^[A-Z0-9_]+$/.test(error.code || '') ? error.code : 'CONNECTION_ERROR' }));
  process.exitCode = 1;
} finally { if (client) await client.end().catch(() => {}); }
