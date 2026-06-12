# Vercel Deploy

โปรเจ็กต์นี้ถูกเตรียมไว้ให้ deploy บน Vercel จากโฟลเดอร์ root ได้เลย

## 1. Import Project

1. ไปที่ Vercel
2. กด `Add New Project`
3. เลือก repo นี้
4. ให้ `Root Directory` เป็น root ของโปรเจ็กต์นี้ตามเดิม ไม่ต้องเปลี่ยนไปที่ `frontend/`

## 2. Project Settings

ใช้ค่าแบบนี้

- Framework Preset: `Other`
- Build Command: `npm run build`
- Output Directory: `frontend/dist`
- Install Command: เว้นค่า default ได้

หมายเหตุ:
- ไฟล์ [vercel.json](C:/my-chat-bot/vercel.json) ถูกตั้ง rewrite และ function runtime ไว้แล้ว
- frontend จะถูก build จาก `frontend/`
- API จะวิ่งผ่าน `api/[...path].js`

## 3. Environment Variables

ตั้งค่าใน `Project Settings > Environment Variables`

- `SUPABASE_DB_URL`
  ใส่ Postgres connection string ของ Supabase

- `GEMINI_API_KEY`
  ใส่ Google Gemini API key

- `SESSION_SECRET`
  ใส่ secret แบบสุ่มยาว ๆ อย่างน้อย 32 ตัวอักษร

แนะนำเพิ่มได้อีก:

- `GEMINI_MODEL`
  ตัวอย่าง `gemini-2.5-flash`

- `SESSION_TTL_MS`
  ตัวอย่าง `604800000` สำหรับ 7 วัน

ไม่จำเป็นต้องตั้ง:

- `VITE_API_URL`
  ไม่ต้องตั้ง เพราะ production ใช้ `/api` โดเมนเดียวกันอยู่แล้ว

- `ALLOWED_ORIGINS`
  ปกติไม่ต้องตั้ง ถ้าใช้ผ่านโดเมนเดียวกันของ Vercel

## 4. Deploy

1. กด `Deploy`
2. รอ build ให้เสร็จ
3. เปิด URL ที่ Vercel สร้างให้

## 5. Check หลัง Deploy

ถ้าต้องการเช็กเร็ว ๆ ให้ลองเปิด:

- `/api/health`

ตัวอย่าง:

```txt
https://your-project.vercel.app/api/health
```

ถ้าขึ้น `status: "ok"` แปลว่า API ทำงานแล้ว

## 6. ถ้า Login ไม่ติด

เช็ก 3 จุดนี้ก่อน:

1. `SUPABASE_DB_URL` ถูกต้อง
2. `SESSION_SECRET` ถูกตั้งจริง
3. `GEMINI_API_KEY` ถูกต้อง

## 7. ถ้า Deploy แล้ว Error

จุดที่ควรเปิดดูเป็นอย่างแรก:

1. `Vercel Project > Deployments > Functions Logs`
2. `/api/health`
3. ตัวแปร env ในหน้า Settings
