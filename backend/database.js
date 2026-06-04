import { Pool } from "pg";

function getConnectionString() {
  return process.env.SUPABASE_DB_URL?.trim() || process.env.DATABASE_URL?.trim() || "";
}

function createPool() {
  const connectionString = getConnectionString();

  if (!connectionString) {
    throw new Error(
      "Missing database connection string. Set SUPABASE_DB_URL or DATABASE_URL in backend/.env"
    );
  }

  const useSsl =
    process.env.PGSSLMODE === "disable" || connectionString.includes("localhost")
      ? false
      : { rejectUnauthorized: false };

  return new Pool({
    connectionString,
    ssl: useSsl,
  });
}

function normalizeParams(params) {
  if (Array.isArray(params)) return params;
  if (params === undefined) return [];
  return [params];
}

function convertPlaceholders(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => {
    index += 1;
    return `$${index}`;
  });
}

function wrapDb(pool) {
  return {
    async exec(sql) {
      return pool.query(sql);
    },
    async get(sql, params = []) {
      const result = await pool.query(convertPlaceholders(sql), normalizeParams(params));
      return result.rows[0] ?? undefined;
    },
    async all(sql, params = []) {
      const result = await pool.query(convertPlaceholders(sql), normalizeParams(params));
      return result.rows;
    },
    async run(sql, params = []) {
      const result = await pool.query(convertPlaceholders(sql), normalizeParams(params));
      return {
        changes: result.rowCount ?? 0,
        rowCount: result.rowCount ?? 0,
        rows: result.rows,
      };
    },
    async close() {
      await pool.end();
    },
  };
}

export async function initDB() {
  const pool = createPool();
  const db = wrapDb(pool);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      weight DOUBLE PRECISION DEFAULT 0,
      height DOUBLE PRECISION DEFAULT 0,
      bmi DOUBLE PRECISION DEFAULT 0,
      stage TEXT DEFAULT '1',
      allergy TEXT DEFAULT 'ไม่มี',
      treatment TEXT DEFAULT 'กินยา'
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS glucose_history (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      value INTEGER,
      phase TEXT,
      date TEXT,
      time TEXT,
      recorded_at TIMESTAMPTZ DEFAULT NOW(),
      reminder_slot_key TEXT DEFAULT ''
    )
  `);

  await db.exec(`
    ALTER TABLE glucose_history
    ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMPTZ DEFAULT NOW()
  `);

  await db.exec(`
    ALTER TABLE glucose_history
    ADD COLUMN IF NOT EXISTS reminder_slot_key TEXT DEFAULT ''
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS question_stats (
      id BIGSERIAL PRIMARY KEY,
      question_text TEXT UNIQUE,
      count INTEGER DEFAULT 1
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS meal_reminders (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reminder_key TEXT NOT NULL,
      label TEXT NOT NULL,
      time TEXT NOT NULL,
      is_enabled BOOLEAN DEFAULT TRUE,
      last_sent_on TEXT,
      UNIQUE (user_id, reminder_key)
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      user_agent TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  console.log("Database Ready: Connected to Postgres and ensured tables exist.");
  return db;
}
