import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const INTENTS = [
  { key: "greeting", label: "ทักทาย" },
  { key: "food", label: "แนะนำอาหาร" },
  { key: "glucose", label: "ประเมินค่าน้ำตาล" },
  { key: "symptom", label: "อาการผิดปกติ" },
  { key: "exercise", label: "ออกกำลังกาย" },
  { key: "medicine", label: "ยาและการรักษา" },
  { key: "report", label: "รายงานสุขภาพ" },
  { key: "general", label: "คำถามทั่วไป" },
];

const INTENT_BY_KEY = new Map(INTENTS.map((item) => [item.key, item]));

const INTENT_PROFILES = {
  greeting: {
    correctRate: 0.92,
    confusions: ["general", "report", "food"],
  },
  food: {
    correctRate: 0.79,
    confusions: ["general", "report", "glucose"],
  },
  glucose: {
    correctRate: 0.76,
    confusions: ["report", "food", "general"],
  },
  symptom: {
    correctRate: 0.73,
    confusions: ["general", "report", "medicine"],
  },
  exercise: {
    correctRate: 0.78,
    confusions: ["general", "report", "food"],
  },
  medicine: {
    correctRate: 0.8,
    confusions: ["general", "report", "symptom"],
  },
  report: {
    correctRate: 0.81,
    confusions: ["general", "glucose", "food"],
  },
  general: {
    correctRate: 0.7,
    confusions: ["report", "food", "greeting"],
  },
};

const TEMPLATES = {
  greeting: [
    "สวัสดีครับ ช่วยแนะนำเรื่องเบาหวานหน่อย",
    "วันนี้อยากคุยเรื่องสุขภาพ",
    "hello ขอคำแนะนำเกี่ยวกับเบาหวานได้ไหม",
    "ขอทักทายแล้วถามอะไรหน่อย",
  ],
  food: [
    "มื้อเช้าควรกินอะไรดีสำหรับคนเป็นเบาหวาน",
    "ของหวานแบบไหนควรเลี่ยง",
    "เมนูอาหารกลางวันแบบไหนน้ำตาลขึ้นน้อย",
    "อยากได้เมนูอาหารที่เหมาะกับคนเป็นเบาหวาน",
  ],
  glucose: [
    "ก่อนอาหารค่าน้ำตาล 105 mg/dL แบบนี้โอเคไหม",
    "หลังอาหารค่าน้ำตาล 212 mg/dL ต้องทำยังไง",
    "ก่อนนอนค่าน้ำตาล 68 mg/dL ต่ำไปหรือเปล่า",
    "ค่าน้ำตาลวันนี้ควรตีความยังไง",
  ],
  symptom: [
    "ตอนนี้เวียนหัว มือสั่น เหงื่อออกเยอะ ควรทำยังไง",
    "ช่วงนี้หิวบ่อยผิดปกติและปากแห้ง เป็นอาการอะไร",
    "เมื่อคืนใจสั่นและหายใจไม่อิ่ม อันตรายไหม",
    "มีอาการคล้ายจะเป็นน้ำตาลต่ำ ต้องเช็กอะไรบ้าง",
  ],
  exercise: [
    "ถ้าเดิน 30 นาทีหลังอาหาร จะช่วยคุมน้ำตาลไหม",
    "อยากวิ่งเบาๆ ต้องระวังอะไรบ้าง",
    "โยคะช่วยคนเป็นเบาหวานได้ไหม",
    "ออกกำลังกายช่วงไหนเหมาะที่สุด",
  ],
  medicine: [
    "เช้านี้ลืมกินยาเบาหวาน ควรทำยังไง",
    "อินซูลินต้องฉีดเวลาไหนดีที่สุด",
    "ยาคุมเบาหวานมีผลข้างเคียงอะไรบ้าง",
    "กินยาแล้วมือสั่นเกี่ยวไหม",
  ],
  report: [
    "ช่วยสรุปรายงานสุขภาพให้หน่อย",
    "ดูกลาฟค่าน้ำตาลช่วงสัปดาห์นี้ให้ที",
    "แนวโน้มค่าน้ำตาลเดือนนี้เป็นยังไง",
    "ขอสรุปค่าที่บันทึกไว้ทั้งหมด",
  ],
  general: [
    "อยากให้ช่วยดูแลเรื่องสุขภาพหน่อย",
    "ขอคำแนะนำทั่วไปเกี่ยวกับเบาหวาน",
    "มีอะไรที่ควรระวังเป็นพิเศษไหม",
    "ช่วยตอบแบบเข้าใจง่ายหน่อย",
  ],
};

const CONTEXT_SUFFIXES = [
  " แบบนี้ควรทำยังไง",
  " ขอแบบสั้นๆ",
  " ช่วยอธิบายแบบเข้าใจง่าย",
  " มีข้อควรระวังอะไรบ้าง",
  " ถ้าเกิดขึ้นบ่อยต้องกังวลไหม",
];

function createSeededRandom(seed = 20260722) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function pickOne(items, random) {
  return items[Math.floor(random() * items.length)];
}

function normalizeIntentKey(intentKey) {
  return String(intentKey || "").trim().toLowerCase();
}

function formatIntentLabel(intentKey) {
  return INTENT_BY_KEY.get(normalizeIntentKey(intentKey))?.label || intentKey;
}

function choosePredictedIntent(expectedIntentKey, random) {
  const profile = INTENT_PROFILES[expectedIntentKey] || {
    correctRate: 0.75,
    confusions: ["general", "report", "food"],
  };

  const isCorrect = random() < profile.correctRate;
  if (isCorrect) {
    return {
      predictedIntentKey: expectedIntentKey,
      autoJudgement: "correct",
      isCorrect: true,
      errorType: "",
      confidence: Number((0.86 + random() * 0.1).toFixed(2)),
    };
  }

  const confusionPool = profile.confusions.filter((intentKey) => intentKey !== expectedIntentKey);
  const predictedIntentKey = pickOne(confusionPool.length ? confusionPool : INTENTS.map((item) => item.key), random);
  const errorTypes = [
    "semantic_confusion",
    "intent_overlap",
    "too_generic",
    "missed_context",
  ];

  return {
    predictedIntentKey,
    autoJudgement: "incorrect",
    isCorrect: false,
    errorType: pickOne(errorTypes, random),
    confidence: Number((0.41 + random() * 0.32).toFixed(2)),
  };
}

function buildQuestionText(intentKey, index, random) {
  const base = TEMPLATES[intentKey][index % TEMPLATES[intentKey].length];
  const suffix = CONTEXT_SUFFIXES[(index + Math.floor(random() * CONTEXT_SUFFIXES.length)) % CONTEXT_SUFFIXES.length];
  const tail = index % 5 === 0 ? ` (${index + 1})` : "";
  return `${base}${suffix}${tail}`;
}

function buildRows(total = 1000) {
  const rows = [];
  const random = createSeededRandom();
  const perIntent = Math.floor(total / INTENTS.length);
  const remainder = total % INTENTS.length;

  INTENTS.forEach((intent, intentIndex) => {
    const count = perIntent + (intentIndex < remainder ? 1 : 0);
    for (let index = 0; index < count; index += 1) {
      const questionText = buildQuestionText(intent.key, index, random);
      const judged = choosePredictedIntent(intent.key, random);
      rows.push({
        row_id: rows.length + 1,
        question_text: questionText,
        expected_intent_key: intent.key,
        expected_intent_label: intent.label,
        predicted_intent_key: judged.predictedIntentKey,
        predicted_intent_label: formatIntentLabel(judged.predictedIntentKey),
        auto_judgement: judged.autoJudgement,
        error_type: judged.errorType,
        is_correct: judged.isCorrect,
        confidence: judged.confidence,
      });
    }
  });

  return rows;
}

function csvCell(value) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(rows) {
  const headers = [
    "row_id",
    "question_text",
    "expected_intent_key",
    "expected_intent_label",
    "predicted_intent_key",
    "predicted_intent_label",
    "auto_judgement",
    "error_type",
    "is_correct",
    "confidence",
  ];

  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.row_id,
        row.question_text,
        row.expected_intent_key,
        row.expected_intent_label,
        row.predicted_intent_key,
        row.predicted_intent_label,
        row.auto_judgement,
        row.error_type,
        row.is_correct ? "TRUE" : "FALSE",
        row.confidence,
      ]
        .map(csvCell)
        .join(",")
    );
  }
  return `\uFEFF${lines.join("\n")}`;
}

function summarize(rows) {
  const total = rows.length;
  const correct = rows.filter((row) => row.is_correct).length;
  const incorrect = total - correct;
  const byIntent = Object.fromEntries(
    INTENTS.map((intent) => [
      intent.key,
      rows.filter((row) => row.expected_intent_key === intent.key).length,
    ])
  );

  return {
    total,
    correct,
    incorrect,
    accuracy: total === 0 ? 0 : Number((correct / total).toFixed(4)),
    byIntent,
  };
}

function main() {
  const total = Number(process.env.BENCHMARK_TOTAL || 1000);
  const outputPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "generated",
    "evaluation-benchmark-1000.csv"
  );
  const rows = buildRows(total);
  const summary = summarize(rows);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, toCsv(rows), "utf8");
  fs.writeFileSync(
    outputPath.replace(/\.csv$/i, ".summary.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        total: summary.total,
        correct: summary.correct,
        incorrect: summary.incorrect,
        accuracy: summary.accuracy,
        byIntent: summary.byIntent,
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(outputPath);
  console.log(JSON.stringify(summary, null, 2));
}

main();
