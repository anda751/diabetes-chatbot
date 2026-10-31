# Setup & Configuration Guide

## Dependencies

- Node.js 20+ (production ปัจจุบันใช้ Node 22)
- npm
- Supabase Postgres
- Gemini API key

ติดตั้ง dependencies จาก root และแต่ละ package:

```powershell
npm install
npm --prefix backend install
npm --prefix frontend install
npm --prefix admin-panel install
```

## Backend environment variables

สร้าง `backend/.env` จาก `backend/.env.example` โดยไม่ commit ไฟล์นี้

| ตัวแปร | จำเป็น | หน้าที่ |
| --- | --- | --- |
| `SUPABASE_DB_URL` หรือ `DATABASE_URL` | ใช่ | Postgres connection string |
| `GEMINI_API_KEY` | ใช่สำหรับ AI | เรียก Gemini |
| `SESSION_SECRET` | ใช่ใน production | เซ็น session cookie |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | ใช่สำหรับ admin | บัญชีแอดมิน |
| `SESSION_TTL_MS` | ไม่บังคับ | อายุ session (ค่าแนะนำ 7 วัน) |
| `GEMINI_MODEL` | ไม่บังคับ | โมเดลหลัก เช่น `gemini-2.5-flash` |
| `ALLOWED_ORIGINS` | production ข้ามโดเมน | comma-separated frontend origins |
| `SESSION_COOKIE_SAME_SITE`, `SESSION_COOKIE_SECURE` | production ข้ามโดเมน | ตั้ง `None` และ `true` |
| `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | สำหรับ Web Push | กำหนด web push |
| `PORT` | ไม่บังคับ | port local, default 5000 |

## Frontend variables

| ตัวแปร | หน้าที่ |
| --- | --- |
| `VITE_API_URL` | API base URL; production ปัจจุบันใช้ `https://diabetes-chatbot-production.up.railway.app/api` |

Vite variables เป็นค่า public ที่ถูก bundle ลง browser; ห้ามใส่ secret ใน `VITE_*`.

## Commands

```powershell
npm run dev:backend
npm run dev:frontend
npm run build
npm run build:app
```

## Deployment

- Railway: ใช้ root directory `backend`, start command `npm start`, และตั้ง backend variables ข้างต้น
- Vercel: build command `npm run build`, output `frontend/dist`, ตั้ง `VITE_API_URL` เป็น Config ของ Production แล้ว redeploy
- Android: run `npm run build:app` และเปิด Android Studio ตาม [Android build guide](ANDROID_APP_BUILD.md)

ตรวจหลัง deploy: `GET /api/health` ต้องตอบ `{ "status": "ok" }`.
