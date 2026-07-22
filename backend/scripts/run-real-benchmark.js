import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { initDB } from "../database.js";
import { upsertChatEvaluation } from "../adminAnalytics.js";

const INTENT_DISPLAY_LABELS = {
  greeting: "ทักทาย",
  food: "แนะนำอาหาร",
  glucose: "ประเมินค่าน้ำตาล",
  symptom: "อาการผิดปกติ",
  exercise: "ออกกำลังกาย",
  medicine: "ยาและการรักษา",
  report: "รายงานสุขภาพ",
  general: "คำถามทั่วไป",
};

const DEFAULT_INPUT_FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "generated",
  "evaluation-benchmark-1000.csv"
);

const DEFAULT_OUTPUT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "generated"
);

dotenv.config({
  path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".env"),
});

function getBaseUrl() {
  const envBaseUrl = String(process.env.BENCHMARK_BASE_URL || "").trim();
  if (envBaseUrl) return envBaseUrl.replace(/\/+$/, "");
  const port = String(process.env.PORT || "5000").trim();
  const host = String(process.env.HOST || "127.0.0.1").trim();
  return `http://${host}:${port}`;
}

function csvCell(value) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function parseCsv(text) {
  const cleanText = String(text || "").replace(/^\uFEFF/, "");
  const rows = [];
  let current = [];
  let cell = "";
  let insideQuotes = false;

  for (let index = 0; index < cleanText.length; index += 1) {
    const character = cleanText[index];
    const nextCharacter = cleanText[index + 1];

    if (insideQuotes) {
      if (character === '"') {
        if (nextCharacter === '"') {
          cell += '"';
          index += 1;
        } else {
          insideQuotes = false;
        }
      } else {
        cell += character;
      }
      continue;
    }

    if (character === '"') {
      insideQuotes = true;
      continue;
    }

    if (character === ",") {
      current.push(cell);
      cell = "";
      continue;
    }

    if (character === "\n") {
      current.push(cell);
      rows.push(current);
      current = [];
      cell = "";
      continue;
    }

    if (character === "\r") {
      continue;
    }

    cell += character;
  }

  if (cell.length > 0 || current.length > 0) {
    current.push(cell);
    rows.push(current);
  }

  return rows;
}

function readBenchmarkQuestions(inputFile) {
  if (!fs.existsSync(inputFile)) {
    throw new Error(`Benchmark file not found: ${inputFile}`);
  }

  const rows = parseCsv(fs.readFileSync(inputFile, "utf8"));
  if (rows.length < 2) {
    throw new Error("Benchmark file does not contain any questions");
  }

  const [header, ...dataRows] = rows;
  const headerIndex = new Map(header.map((name, index) => [String(name || "").trim(), index]));
  const questionIndex = headerIndex.get("question_text");
  const expectedIndex = headerIndex.get("expected_intent_key");

  if (questionIndex == null || expectedIndex == null) {
    throw new Error("Benchmark CSV must include question_text and expected_intent_key columns");
  }

  return dataRows
    .filter((row) => row.some((cell) => String(cell || "").trim() !== ""))
    .map((row, index) => {
      const questionText = String(row[questionIndex] || "").trim();
      const expectedIntentKey = String(row[expectedIndex] || "").trim();
      if (!questionText || !expectedIntentKey) {
        throw new Error(`Invalid benchmark row at line ${index + 2}`);
      }
      return {
        rowNumber: index + 1,
        questionText,
        expectedIntentKey,
      };
    });
}

function createTempCredentials() {
  const stamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 8);
  const username = `b${stamp.slice(-6)}${randomPart}`.slice(0, 20);
  return {
    username,
    password: `Bench#${stamp.slice(-6)}${randomPart.slice(0, 4)}`,
    name: "Benchmark Runner",
  };
}

async function ensureHealthy(baseUrl) {
  const response = await fetch(`${baseUrl}/api/health`);
  if (!response.ok) {
    throw new Error(`Backend health check failed with HTTP ${response.status}`);
  }
  return response.json();
}

async function registerAndLogin(baseUrl, credentials) {
  const registerResponse = await fetch(`${baseUrl}/api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });

  if (!registerResponse.ok) {
    const payload = await registerResponse.json().catch(() => ({}));
    const message = payload?.message || payload?.error || `HTTP ${registerResponse.status}`;
    if (registerResponse.status !== 400) {
      throw new Error(`Register failed: ${message}`);
    }
  }

  const loginResponse = await fetch(`${baseUrl}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: credentials.username,
      password: credentials.password,
    }),
  });

  if (!loginResponse.ok) {
    const payload = await loginResponse.json().catch(() => ({}));
    const message = payload?.message || payload?.error || `HTTP ${loginResponse.status}`;
    throw new Error(`Login failed: ${message}`);
  }

  const cookieHeader = loginResponse.headers.get("set-cookie");
  if (!cookieHeader) {
    throw new Error("Login succeeded but no session cookie was returned");
  }

  return cookieHeader.split(";")[0];
}

async function sendChat(baseUrl, cookie, questionText) {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({ message: questionText }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.text || payload?.message || payload?.error || `HTTP ${response.status}`;
    throw new Error(message);
  }

  return payload || {};
}

function normalizeIntentKey(intentKey) {
  return String(intentKey || "").trim().toLowerCase();
}

function buildMetrics(records) {
  const labels = Array.from(
    new Set(
      records.flatMap((item) => [
        normalizeIntentKey(item.expected_intent_key),
        normalizeIntentKey(item.predicted_intent_key),
      ])
    )
  ).filter(Boolean);

  const indexByLabel = new Map(labels.map((label, index) => [label, index]));
  const matrix = labels.map(() => labels.map(() => 0));

  let total = 0;
  let correct = 0;

  for (const record of records) {
    const actual = normalizeIntentKey(record.expected_intent_key);
    const predicted = normalizeIntentKey(record.predicted_intent_key);
    if (!actual || !predicted) continue;

    total += 1;
    if (actual === predicted) {
      correct += 1;
    }

    const rowIndex = indexByLabel.get(actual);
    const columnIndex = indexByLabel.get(predicted);
    if (rowIndex != null && columnIndex != null) {
      matrix[rowIndex][columnIndex] += 1;
    }
  }

  const perClass = labels.map((label, index) => {
    const truePositive = matrix[index][index];
    let falsePositive = 0;
    let falseNegative = 0;

    for (let rowIndex = 0; rowIndex < labels.length; rowIndex += 1) {
      for (let columnIndex = 0; columnIndex < labels.length; columnIndex += 1) {
        if (rowIndex === index && columnIndex === index) continue;
        if (columnIndex === index) falsePositive += matrix[rowIndex][columnIndex];
        if (rowIndex === index) falseNegative += matrix[rowIndex][columnIndex];
      }
    }

    const precision = truePositive + falsePositive === 0 ? 0 : truePositive / (truePositive + falsePositive);
    const recall = truePositive + falseNegative === 0 ? 0 : truePositive / (truePositive + falseNegative);
    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
    return {
      intentKey: label,
      label: INTENT_DISPLAY_LABELS[label] || label,
      precision,
      recall,
      f1,
      support: matrix[index].reduce((sum, count) => sum + count, 0),
    };
  });

  const macroPrecision = perClass.length
    ? perClass.reduce((sum, item) => sum + item.precision, 0) / perClass.length
    : 0;
  const macroRecall = perClass.length
    ? perClass.reduce((sum, item) => sum + item.recall, 0) / perClass.length
    : 0;
  const macroF1 = perClass.length
    ? perClass.reduce((sum, item) => sum + item.f1, 0) / perClass.length
    : 0;

  return {
    labels,
    matrix,
    summary: {
      total,
      correct,
      incorrect: total - correct,
      accuracy: total === 0 ? 0 : correct / total,
      macroPrecision,
      macroRecall,
      macroF1,
    },
    perClass,
  };
}

function toCsv(rows) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => csvCell(row[header])).join(","));
  }
  return `\uFEFF${lines.join("\n")}`;
}

async function main() {
  const baseUrl = getBaseUrl();
  const inputFile = path.resolve(String(process.env.BENCHMARK_INPUT || DEFAULT_INPUT_FILE));
  const outputDir = path.resolve(String(process.env.BENCHMARK_OUTPUT_DIR || DEFAULT_OUTPUT_DIR));
  const outputCsv = path.join(outputDir, "evaluation-benchmark-real-results.csv");
  const outputJson = path.join(outputDir, "evaluation-benchmark-real-summary.json");
  const questions = readBenchmarkQuestions(inputFile);

  await ensureHealthy(baseUrl);

  const credentials = createTempCredentials();
  const cookie = await registerAndLogin(baseUrl, credentials);
  const db = await initDB();
  const results = [];

  try {
    for (let index = 0; index < questions.length; index += 1) {
      const item = questions[index];
      const expectedIntentKey = normalizeIntentKey(item.expectedIntentKey);
      const startedAt = Date.now();
      let predictedIntentKey = "error";
      let predictedModel = "";
      let usedFallback = false;
      let chatLogId = null;
      let responsePreview = "";
      let errorMessage = "";

      try {
        const response = await sendChat(baseUrl, cookie, item.questionText);
        predictedIntentKey = normalizeIntentKey(response.intentKey) || "unknown";
        predictedModel = String(response.model || "");
        usedFallback = response.usedFallback === true;
        chatLogId = Number(response.chatLogId) || null;
        responsePreview = String(response.text || "").trim().slice(0, 160);

        if (chatLogId) {
          await upsertChatEvaluation({
            db,
            chatLogId,
            actualIntentKey: expectedIntentKey,
            notes: "benchmark-real",
          });
        }
      } catch (error) {
        errorMessage = String(error?.message || error || "Unknown error");
      }

      const durationMs = Date.now() - startedAt;
      const isCorrect = predictedIntentKey === expectedIntentKey;

      results.push({
        row_id: index + 1,
        question_text: item.questionText,
        expected_intent_key: expectedIntentKey,
        expected_intent_label: INTENT_DISPLAY_LABELS[expectedIntentKey] || expectedIntentKey,
        predicted_intent_key: predictedIntentKey,
        predicted_intent_label: INTENT_DISPLAY_LABELS[predictedIntentKey] || predictedIntentKey,
        predicted_model: predictedModel,
        used_fallback: usedFallback ? "TRUE" : "FALSE",
        chat_log_id: chatLogId || "",
        is_correct: isCorrect ? "TRUE" : "FALSE",
        response_time_ms: durationMs,
        response_preview: responsePreview,
        error_message: errorMessage,
      });

      const progressEvery = Math.max(1, Math.floor(questions.length / 10));
      if ((index + 1) % progressEvery === 0 || index === questions.length - 1) {
        const status = errorMessage ? "ERR" : isCorrect ? "OK" : "MISS";
        console.log(`[${index + 1}/${questions.length}] ${status} ${item.expectedIntentKey} -> ${predictedIntentKey}`);
      }
    }

    const metrics = buildMetrics(results);
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(outputCsv, toCsv(results), "utf8");
    fs.writeFileSync(
      outputJson,
      JSON.stringify(
        {
          baseUrl,
          inputFile,
          outputCsv,
          credentials: { username: credentials.username },
          summary: {
            total: metrics.summary.total,
            correct: metrics.summary.correct,
            incorrect: metrics.summary.incorrect,
            accuracy: Number(metrics.summary.accuracy.toFixed(4)),
            macroPrecision: Number(metrics.summary.macroPrecision.toFixed(4)),
            macroRecall: Number(metrics.summary.macroRecall.toFixed(4)),
            macroF1: Number(metrics.summary.macroF1.toFixed(4)),
          },
          perClass: metrics.perClass.map((item) => ({
            intentKey: item.intentKey,
            label: item.label,
            precision: Number(item.precision.toFixed(4)),
            recall: Number(item.recall.toFixed(4)),
            f1: Number(item.f1.toFixed(4)),
            support: item.support,
          })),
          generatedAt: new Date().toISOString(),
        },
        null,
        2
      ),
      "utf8"
    );

    console.log(
      JSON.stringify(
        {
          baseUrl,
          total: metrics.summary.total,
          correct: metrics.summary.correct,
          incorrect: metrics.summary.incorrect,
          accuracy: Number(metrics.summary.accuracy.toFixed(4)),
          macroPrecision: Number(metrics.summary.macroPrecision.toFixed(4)),
          macroRecall: Number(metrics.summary.macroRecall.toFixed(4)),
          macroF1: Number(metrics.summary.macroF1.toFixed(4)),
          outputCsv,
          outputJson,
        },
        null,
        2
      )
    );
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
});
