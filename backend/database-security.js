import { readFileSync } from 'node:fs';

// Public provider CA, not a client certificate or private key.
const supabaseCa = readFileSync(new URL('./certs/supabase-ca.crt', import.meta.url), 'utf8');

// Keep TLS policy separate from the connection URL: pg otherwise lets URL options
// override the explicit ssl object, including certificate verification.
export function databaseConnectionOptions(connectionString, env = process.env) {
  let url;
  try { url = new URL(connectionString); }
  catch { throw new Error('Invalid PostgreSQL connection URL'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('PostgreSQL connection URL required');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  const sslMode = env.PGSSLMODE || url.searchParams.get('sslmode');
  if (sslMode === 'disable' && !local) throw new Error('TLS cannot be disabled for a remote database');
  for (const key of ['sslmode', 'ssl', 'sslcert', 'sslkey', 'sslrootcert', 'sslpassword', 'uselibpqcompat']) {
    url.searchParams.delete(key);
  }
  const isSupabase = /\.(supabase\.co|supabase\.com)$/.test(url.hostname);
  const ca = env.PGSSL_CA?.replace(/\\n/g, '\n') || (isSupabase ? supabaseCa : undefined);
  return {
    connectionString: url.toString(),
    ssl: local ? false : { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
  };
}
