import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function parseCsvRow(line) {
  const cells = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (character === "," && !inQuotes) {
      cells.push(cell);
      cell = "";
    } else {
      cell += character;
    }
  }

  cells.push(cell);
  return cells;
}

function escapeCsv(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverSource = fs.readFileSync(path.join(root, "server.js"), "utf8");
const classifierStart = serverSource.indexOf("const INTENT_RULES =");
const classifierEnd = serverSource.indexOf("function normalizeIntentLabel", classifierStart);

if (classifierStart < 0 || classifierEnd < 0) {
  throw new Error("Could not locate the intent classifier in server.js");
}

// Evaluate only the classifier section so this test neither starts the API nor touches the database.
const findIntentRule = new Function(
  "normalizeText",
  `${serverSource.slice(classifierStart, classifierEnd)}; return findIntentRule;`
)((value) => (typeof value === "string" ? value.trim() : ""));
const inputPath = path.resolve(
  process.env.BENCHMARK_INPUT_PATH || path.join(root, "generated", "evaluation-benchmark-diverse-100.csv")
);
const outputPath = path.resolve(
  process.env.BENCHMARK_INTENT_OUTPUT_PATH || path.join(root, "generated", "evaluation-benchmark-diverse-100-intent-results.csv")
);
const lines = fs
  .readFileSync(inputPath, "utf8")
  .replace(/^\uFEFF/, "")
  .split(/\r?\n/)
  .filter(Boolean);
const [header, ...dataRows] = lines.map(parseCsvRow);
const questionIndex = header.indexOf("question_text");
const expectedIndex = header.indexOf("expected_intent_key");

if (questionIndex < 0 || expectedIndex < 0) {
  throw new Error("Benchmark CSV must include question_text and expected_intent_key columns");
}

const records = dataRows.map((row, index) => {
  const expected = String(row[expectedIndex] || "").trim();
  const predicted = findIntentRule("", row[questionIndex]).key;
  return {
    rowId: index + 1,
    question: String(row[questionIndex] || "").trim(),
    expected,
    predicted,
    isCorrect: expected === predicted,
  };
});
const correct = records.filter((record) => record.expected === record.predicted).length;
const labels = [...new Set(records.map((record) => record.expected))].sort();
const perClass = Object.fromEntries(
  labels.map((label) => {
    const classRecords = records.filter((record) => record.expected === label);
    const classCorrect = classRecords.filter((record) => record.predicted === label).length;
    return [label, {
      correct: classCorrect,
      total: classRecords.length,
      recall: Number((classCorrect / classRecords.length).toFixed(4)),
    }];
  })
);

const outputHeaders = ["row_id", "question_text", "expected_intent_key", "predicted_intent_key", "is_correct"];
const outputCsv = [
  outputHeaders,
  ...records.map((record) => [
    record.rowId,
    record.question,
    record.expected,
    record.predicted,
    record.isCorrect ? "TRUE" : "FALSE",
  ]),
]
  .map((row) => row.map(escapeCsv).join(","))
  .join("\n");

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `\uFEFF${outputCsv}\n`, "utf8");

console.log(JSON.stringify({
  source: path.relative(process.cwd(), inputPath),
  output: path.relative(process.cwd(), outputPath),
  total: records.length,
  correct,
  accuracy: Number((correct / records.length).toFixed(4)),
  perClass,
  ...(process.env.SHOW_INTENT_ERRORS === "1"
    ? {
        errors: records
          .map((record, index) => ({ ...record, question: dataRows[index][questionIndex] }))
          .filter((record) => record.expected !== record.predicted),
      }
    : {}),
}, null, 2));
