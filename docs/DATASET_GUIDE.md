# Dataset & Evaluation Guide

## ข้อมูลที่ระบบจัดเก็บจริง

ข้อมูลผู้ใช้และข้อมูลสุขภาพอยู่ใน Supabase Postgres ตาม [Database Schema](DATABASE_SCHEMA.md). ข้อมูลเหล่านี้เป็นข้อมูลสุขภาพส่วนบุคคล: ห้าม export, commit, หรือใช้เป็น benchmark โดยไม่มีการปกปิดข้อมูลและการอนุมัติที่เหมาะสม.

## Evaluation dataset ใน repository

| ไฟล์ | ประเภท | ใช้ทำอะไร |
| --- | --- | --- |
| `backend/generated/evaluation-benchmark-1000-unique.csv.csv` | CSV, 1,000 records | ชุดคำถามสังเคราะห์สำหรับประเมิน intent classification |
| `backend/generated/evaluation-benchmark-1000-unique.summary.json` | JSON | สรุปจำนวนรายการและ accuracy ของข้อมูลที่ generate |
| `backend/generated/evaluation-benchmark-diverse-100.csv` | CSV, 100 records | ชุดคำถามสังเคราะห์ที่หลากหลายสำหรับการทดสอบ intent รุ่นใหม่ |

ชุดข้อมูลเป็น **synthetic benchmark** ไม่ใช่ข้อมูลผู้ป่วยจริง ครอบคลุม 8 intent: `greeting`, `food`, `glucose`, `symptom`, `exercise`, `medicine`, `report`, `general`.

## Schema ของ benchmark CSV

| คอลัมน์ | คำอธิบาย |
| --- | --- |
| `row_id` | รหัสลำดับข้อมูล |
| `question_text` | คำถามทดสอบ |
| `expected_intent_key`, `expected_intent_label` | label เป้าหมาย |
| `predicted_intent_key`, `predicted_intent_label` | label ที่ใช้จำลอง/ผลทำนาย |
| `auto_judgement`, `error_type`, `is_correct`, `confidence` | metadata สำหรับวิเคราะห์ผล |

## สร้าง benchmark ใหม่

```powershell
npm --prefix backend run generate:benchmark
```

ตัวแปรเสริม:

- `BENCHMARK_TOTAL` จำนวนแถว (default 1000)
- `BENCHMARK_OUTPUT_PATH` ตำแหน่งไฟล์ CSV

Generator ใช้ seed คงที่ ทำให้สร้างซ้ำเพื่อตรวจสอบผลได้.

## ชุดคำถามหลากหลายรุ่นใหม่

สร้างด้วยคำถามสถานการณ์ที่เขียนขึ้นเอง ครอบคลุมภาษาเป็นทางการ/ไม่เป็นทางการ, บริบทเวลา, ความกังวล, คำถามสั้น และคำถามแบบขอขั้นตอนปฏิบัติ โดย default 100 ข้อ (4 intent มี 13 ข้อ และอีก 4 intent มี 12 ข้อ):

```powershell
npm --prefix backend run generate:benchmark:diverse
```

ไฟล์นี้มีเพียง `question_text` และ expected intent จึงเป็น input เริ่มต้นของ `benchmark:real`; ไม่มีข้อมูลผู้ป่วยจริงหรือคำตอบทางการแพทย์.

## ตรวจ intent แบบออฟไลน์

ใช้คำสั่งนี้เพื่อตรวจเฉพาะกฎจำแนก intent โดยไม่เปิด API, ไม่เรียก Gemini และไม่เขียนข้อมูลลง Supabase:

```powershell
npm --prefix backend run benchmark:intents
```

หากต้องการดูข้อที่จำแนกผิด ให้ตั้ง `SHOW_INTENT_ERRORS=1` ก่อนรัน. ผลนี้เหมาะเป็น regression check ระหว่างพัฒนาเท่านั้น เพราะชุด 100 ข้อถูกใช้ในการปรับกฎแล้ว; ก่อนอ้างผลใช้งานจริง ควรมีชุด holdout ที่ผู้ทบทวนอิสระตรวจ label.

ทุกครั้งที่รัน จะสร้างไฟล์ `backend/generated/evaluation-benchmark-diverse-100-intent-results.csv` ซึ่งมีผลรายคำถาม ได้แก่ `question_text`, intent เป้าหมาย, intent ที่ทำนาย และ `is_correct`. เปลี่ยนตำแหน่งไฟล์ได้ด้วย `BENCHMARK_INTENT_OUTPUT_PATH`.

## รัน benchmark กับระบบจริง

1. รัน backend และตรวจ `/api/health`
2. ตั้ง `BENCHMARK_BASE_URL` หาก API ไม่อยู่ที่ `http://127.0.0.1:5000`
3. รัน:

```powershell
npm --prefix backend run benchmark:real
```

ผลลัพธ์จะอยู่ใน `backend/generated/` ได้แก่ CSV รายละเอียด และ JSON ที่มี accuracy, macro precision, recall และ F1. คำสั่งนี้สร้างผู้ใช้ทดสอบชั่วคราวและสร้าง chat logs จึงไม่ควรรันกับ production database โดยไม่วางแผน cleanup/retention ก่อน.

## แนวทางเพิ่ม dataset

- ใช้ข้อมูลสังเคราะห์หรือข้อมูลที่ de-identify แล้วเท่านั้น
- เก็บ expected intent, source, reviewer และ version ของชุดข้อมูล
- แยก train/dev/test เพื่อหลีกเลี่ยงการประเมินบนข้อมูลเดียวกับที่ใช้ปรับ prompt
- ให้ผู้เชี่ยวชาญด้านสุขภาพทบทวนคำถามที่เกี่ยวกับอาการฉุกเฉิน, ยา และคำแนะนำทางคลินิก
