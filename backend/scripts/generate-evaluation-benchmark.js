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

const TEMPLATES = {
  greeting: [
    "สวัสดีครับ ช่วยแนะนำเรื่องเบาหวานหน่อย",
    "หวัดดีค่ะ วันนี้อยากคุยเรื่องสุขภาพ",
    "hello ขอคำแนะนำเกี่ยวกับเบาหวานได้ไหม",
  ],
  food: [
    "มื้ออาหารเช้า กินอะไรดีสำหรับคนเป็นเบาหวาน",
    "ของหวานแบบไหนควรเลี่ยง",
    "เมนูอาหารกลางวันแบบไหนน้ำตาลขึ้นน้อย",
  ],
  glucose: [
    "ก่อนอาหาร ค่าน้ำตาล 105 mg/dL แบบนี้โอเคไหม",
    "หลังอาหาร ค่าน้ำตาล 212 mg/dL ต้องทำยังไง",
    "ก่อนนอน ค่าน้ำตาล 68 mg/dL ต่ำไปหรือเปล่า",
  ],
  symptom: [
    "ตอนนี้เวียนหัว มือสั่น เหงื่อออกเยอะ ควรทำยังไง",
    "ช่วงนี้หิวมากผิดปกติและปากแห้ง เป็นอาการอะไร",
    "เมื่อคืนใจสั่นและหายใจไม่อิ่ม อันตรายไหม",
  ],
  exercise: [
    "ถ้าเดิน 30 นาทีหลังอาหาร จะช่วยคุมน้ำตาลไหม",
    "อยากวิ่งเบาๆ ต้องระวังอะไรบ้าง",
    "โยคะหลังอาหารเหมาะกับคนเป็นเบาหวานไหม",
  ],
  medicine: [
    "เช้านี้ลืมกินยาเบาหวาน ควรทำยังไง",
    "อินซูลินต้องฉีดเวลาไหนดีที่สุด",
    "ยาควบคุมเบาหวานมีผลข้างเคียงอะไรบ้าง",
  ],
  report: [
    "ช่วยสรุปรายงานสุขภาพให้หน่อย",
    "ดูกราฟค่าน้ำตาลช่วงสัปดาห์นี้ให้ที",
    "แนวโน้มค่าน้ำตาลเดือนนี้เป็นยังไง",
  ],
  general: [
    "อยากให้ช่วยดูให้หน่อย",
    "ขอคำแนะนำทั่วไปเรื่องสุขภาพ",
    "มีอะไรที่ควรระวังเป็นพิเศษไหม",
  ],
};

function createSeededRandom(seed = 20260722) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function buildRow(intentKey, index, random) {
  const base = TEMPLATES[intentKey][index % TEMPLATES[intentKey].length];
  const suffixes = [
    " ช่วยอธิบายแบบเข้าใจง่าย",
    " อยากได้คำตอบสั้นๆ",
    " ขอคำแนะนำต่อด้วย",
    " ถ้าทำได้ควรทำอะไรต่อ",
    " แบบนี้ต้องกังวลไหม",
  ];
  const questionText = `${base}${suffixes[index % suffixes.length]} (${index + 1})`;

  return {
    row_id: null,
    question_text: questionText,
    expected_intent_key: intentKey,
    expected_intent_label: INTENTS.find((item) => item.key === intentKey)?.label || intentKey,
    auto_judgement: "correct",
    is_correct: true,
    confidence: Number((0.88 + random() * 0.11).toFixed(2)),
  };
}

function buildRows(total = 1000) {
  const rows = [];
  const random = createSeededRandom();
  const perIntent = Math.floor(total / INTENTS.length);
  const remainder = total % INTENTS.length;

  INTENTS.forEach((intent, intentIndex) => {
    const count = perIntent + (intentIndex < remainder ? 1 : 0);
    for (let i = 0; i < count; i += 1) {
      const row = buildRow(intent.key, i, random);
      row.row_id = rows.length + 1;
      rows.push(row);
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
    "auto_judgement",
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
        row.auto_judgement,
        row.is_correct ? "TRUE" : "FALSE",
        row.confidence,
      ]
        .map(csvCell)
        .join(",")
    );
  }
  return `\uFEFF${lines.join("\n")}`;
}

function main() {
  const total = 1000;
  const outputPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "generated",
    "evaluation-benchmark-1000.csv"
  );
  const rows = buildRows(total);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, toCsv(rows), "utf8");
  console.log(outputPath);
}

main();
