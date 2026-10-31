# Today Care — Diabetes Care AI

เว็บแอปและ Android app สำหรับช่วยติดตามค่าน้ำตาล ตั้งเตือนมื้ออาหาร สนทนากับ AI และจัดการข้อมูลผ่านแผงผู้ดูแลระบบ

## ความสามารถหลัก

- สมัครสมาชิก/เข้าสู่ระบบด้วย session cookie
- บันทึกและดูประวัติค่าน้ำตาล
- ผู้ช่วย Gemini AI พร้อมบริบทสุขภาพของผู้ใช้
- ตั้งการแจ้งเตือนมื้ออาหารและ Web Push / Android local notification
- รายงานและคำถามยอดนิยม
- Admin panel สำหรับสถิติ ผู้ใช้ บันทึกข้อมูล ความรู้ และประเมินคำตอบ AI

## โครงสร้าง

| โฟลเดอร์ | หน้าที่ |
| --- | --- |
| `frontend/` | React + Vite สำหรับผู้ใช้ทั่วไป |
| `admin-panel/` | React + Vite สำหรับผู้ดูแล |
| `backend/` | Express API, business logic และ Supabase Postgres |
| `android/` | Android shell ที่ Capacitor สร้าง |
| `docs/` | เอกสารระบบและการ deploy |

## เริ่มต้นใช้งานในเครื่อง

1. ติดตั้ง dependencies: `npm install`, `npm --prefix backend install`, `npm --prefix frontend install`, และ `npm --prefix admin-panel install`
2. คัดลอก `backend/.env.example` เป็น `backend/.env` แล้วใส่ค่า environment variables ที่จำเป็น
3. เปิด backend: `npm run dev:backend`
4. เปิด frontend ใน terminal อื่น: `npm run dev:frontend`
5. เปิด `http://localhost:5173`

ตรวจ API ได้ที่ `http://localhost:5000/api/health`

## เอกสาร

- [Architecture](docs/SYSTEM_ARCHITECTURE.md)
- [API reference](docs/API_DOCUMENTATION.md)
- [Database schema](docs/DATABASE_SCHEMA.md)
- [Setup and configuration](docs/SETUP_CONFIGURATION.md)
- [Code standards](docs/CODE_STANDARDS.md)
- [Known issues and roadmap](docs/KNOWN_ISSUES_AND_ROADMAP.md)
- [Source code guide](docs/SOURCE_CODE_GUIDE.md)
- [Dataset and evaluation guide](docs/DATASET_GUIDE.md)
- [Libraries and dependencies](docs/LIBRARIES_AND_DEPENDENCIES.md)
- [Development workflow](docs/DEVELOPMENT_WORKFLOW.md)
- [Deploy backend to Railway](docs/RAILWAY_BACKEND_DEPLOY.md)
- [Deploy frontend to Vercel](docs/VERCEL_DEPLOY.md)

## Production

Frontend deploy บน Vercel, backend deploy บน Railway และฐานข้อมูลอยู่บน Supabase Postgres. URL และ secrets ต้องตั้งผ่าน environment variables เท่านั้น; ห้าม commit ไฟล์ `.env` หรือ credential ขึ้น repository.
