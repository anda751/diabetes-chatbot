import dotenv from "dotenv";
import path from "node:path";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { fileURLToPath } from "node:url";
import { initDB } from "../database.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, "..");

const sqliteDbPath =
  process.env.SQLITE_DB_PATH?.trim() || path.join(backendDir, "database.db");
const shouldReplace = process.argv.includes("--replace");

function logStep(message) {
  console.log(`[migrate] ${message}`);
}

async function readSource(sqliteDb) {
  const users = await sqliteDb.all("SELECT * FROM users ORDER BY id ASC");
  const glucoseHistory = await sqliteDb.all(
    "SELECT * FROM glucose_history ORDER BY id ASC"
  );
  const questionStats = await sqliteDb.all(
    "SELECT * FROM question_stats ORDER BY id ASC"
  );

  return { users, glucoseHistory, questionStats };
}

async function ensureTargetReady(targetDb) {
  const [usersCountRow, glucoseCountRow, statsCountRow] = await Promise.all([
    targetDb.get("SELECT COUNT(*)::int AS count FROM users"),
    targetDb.get("SELECT COUNT(*)::int AS count FROM glucose_history"),
    targetDb.get("SELECT COUNT(*)::int AS count FROM question_stats"),
  ]);

  const totalExistingRows =
    (usersCountRow?.count || 0) +
    (glucoseCountRow?.count || 0) +
    (statsCountRow?.count || 0);

  if (!shouldReplace && totalExistingRows > 0) {
    throw new Error(
      "Target Postgres already has data. Re-run with --replace if you want to wipe target tables before importing."
    );
  }

  if (shouldReplace) {
    logStep("Replacing existing target data");
    await targetDb.exec(
      "TRUNCATE TABLE glucose_history, question_stats, users RESTART IDENTITY CASCADE"
    );
  }
}

async function migrateUsers(targetDb, users) {
  for (const user of users) {
    await targetDb.run(
      `
        INSERT INTO users (
          id, username, password, name, weight, height, bmi, stage, allergy, treatment
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (id) DO UPDATE SET
          username = EXCLUDED.username,
          password = EXCLUDED.password,
          name = EXCLUDED.name,
          weight = EXCLUDED.weight,
          height = EXCLUDED.height,
          bmi = EXCLUDED.bmi,
          stage = EXCLUDED.stage,
          allergy = EXCLUDED.allergy,
          treatment = EXCLUDED.treatment
      `,
      [
        user.id,
        user.username,
        user.password,
        user.name,
        user.weight ?? 0,
        user.height ?? 0,
        user.bmi ?? 0,
        user.stage ?? "1",
        user.allergy ?? "ไม่มี",
        user.treatment ?? "กินยา",
      ]
    );
  }
}

async function migrateGlucoseHistory(targetDb, glucoseHistory) {
  for (const item of glucoseHistory) {
    await targetDb.run(
      `
        INSERT INTO glucose_history (id, user_id, value, phase, date, time)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT (id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          value = EXCLUDED.value,
          phase = EXCLUDED.phase,
          date = EXCLUDED.date,
          time = EXCLUDED.time
      `,
      [item.id, item.user_id, item.value, item.phase, item.date, item.time]
    );
  }
}

async function migrateQuestionStats(targetDb, questionStats) {
  for (const stat of questionStats) {
    await targetDb.run(
      `
        INSERT INTO question_stats (id, question_text, count)
        VALUES (?, ?, ?)
        ON CONFLICT (id) DO UPDATE SET
          question_text = EXCLUDED.question_text,
          count = EXCLUDED.count
      `,
      [stat.id, stat.question_text, stat.count ?? 1]
    );
  }
}

async function syncSequences(targetDb) {
  await targetDb.exec(`
    SELECT setval(
      pg_get_serial_sequence('users', 'id'),
      COALESCE((SELECT MAX(id) FROM users), 1),
      (SELECT COUNT(*) > 0 FROM users)
    );

    SELECT setval(
      pg_get_serial_sequence('glucose_history', 'id'),
      COALESCE((SELECT MAX(id) FROM glucose_history), 1),
      (SELECT COUNT(*) > 0 FROM glucose_history)
    );

    SELECT setval(
      pg_get_serial_sequence('question_stats', 'id'),
      COALESCE((SELECT MAX(id) FROM question_stats), 1),
      (SELECT COUNT(*) > 0 FROM question_stats)
    );
  `);
}

async function main() {
  logStep(`Reading source SQLite database from ${sqliteDbPath}`);
  const sqliteDb = await open({
    filename: sqliteDbPath,
    driver: sqlite3.Database,
  });

  const source = await readSource(sqliteDb);
  logStep(
    `Loaded ${source.users.length} users, ${source.glucoseHistory.length} glucose rows, ${source.questionStats.length} stats rows`
  );

  const targetDb = await initDB();

  try {
    await ensureTargetReady(targetDb);
    await targetDb.exec("BEGIN");

    await migrateUsers(targetDb, source.users);
    await migrateGlucoseHistory(targetDb, source.glucoseHistory);
    await migrateQuestionStats(targetDb, source.questionStats);
    await syncSequences(targetDb);

    await targetDb.exec("COMMIT");
    logStep("Migration completed successfully");
  } catch (error) {
    await targetDb.exec("ROLLBACK");
    throw error;
  } finally {
    await sqliteDb.close();
    await targetDb.close();
  }
}

main().catch((error) => {
  console.error("[migrate] Migration failed:", error.message);
  process.exitCode = 1;
});
