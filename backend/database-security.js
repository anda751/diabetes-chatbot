// Keep TLS policy separate from the connection URL: pg otherwise lets URL options
// override the explicit ssl object, including certificate verification.
export function databaseConnectionOptions(connectionString, env = process.env) {
  const url = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('PostgreSQL connection URL required');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  const sslMode = env.PGSSLMODE || url.searchParams.get('sslmode');
  if (sslMode === 'disable' && !local) throw new Error('TLS cannot be disabled for a remote database');
  for (const key of ['sslmode', 'ssl', 'sslcert', 'sslkey', 'sslrootcert', 'sslpassword', 'uselibpqcompat']) {
    url.searchParams.delete(key);
  }
  const ca = env.PGSSL_CA?.replace(/\\n/g, '\n');
  return {
    connectionString: url.toString(),
    ssl: local ? false : { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
  };
}
