# API Documentation

Base URL local คือ `http://localhost:5000`; production frontend ใช้ Railway API URL ผ่าน `VITE_API_URL`. Endpoints ที่ต้องยืนยันตัวตนใช้ cookie และ client ต้องส่ง request พร้อม credentials.

## Common response

สำเร็จมักคืน `{ "status": "success", ... }`; validation/auth error คืน HTTP 400/401 และ `{ "error" | "message": "..." }`.

## Public and authentication

| Method | Path | Request body / query | ผลลัพธ์ |
| --- | --- | --- | --- |
| GET | `/api/health` | - | สถานะ backend, AI, session และ push |
| GET | `/api/push-public-key` | - | VAPID public key |
| POST | `/api/register` | `username`, `password`, `name?` | สร้างผู้ใช้ |
| POST | `/api/login` | `username`, `password` | สร้าง user session cookie และคืน user |
| POST | `/api/logout` | - | ล้าง user session |
| GET | `/api/session` | user session | user ปัจจุบัน |
| POST | `/api/admin/login` | `username`, `password` | สร้าง admin session |
| POST | `/api/admin/logout` | - | ล้าง admin session |
| GET | `/api/admin/session` | admin session | admin ปัจจุบัน |

ตัวอย่าง login:

```json
POST /api/login
{ "username": "patient1", "password": "example-password" }
```

## User endpoints (ต้องมี user session)

| Method | Path | Input หลัก |
| --- | --- | --- |
| POST | `/api/update-profile` | `name`, `weight`, `height`, `stage`, `allergy`, `treatment` |
| GET/POST | `/api/glucose` | POST: `value`, `phase`, `date`, `time`, `reminderSlotKey?` |
| POST | `/api/chat` | `message` |
| GET/PUT | `/api/reminders` | PUT: `{ reminders: [...] }` |
| POST/DELETE | `/api/push-subscriptions` | POST: `{ subscription }`; DELETE: `{ endpoint }` |
| GET/POST | `/api/satisfaction-survey/status`, `/api/satisfaction-survey` | survey demographics, scores, comment/feedback |
| GET | `/api/questions/popular` | `category?`, `limit?` |
| GET | `/api/questions/history` | `category?`, `limit?` |

ตัวอย่างบันทึกน้ำตาล:

```json
POST /api/glucose
{ "value": 120, "phase": "ก่อนอาหาร", "date": "2026-10-07", "time": "08:00" }
```

## Admin endpoints (ต้องมี admin session)

| กลุ่ม | Endpoints |
| --- | --- |
| สถานะ/ภาพรวม | `GET /api/admin/health`, `/overview`, `/quality`, `/stats` |
| การประเมิน AI | `GET /api/admin/evaluation`, `/evaluation/benchmark`; `POST /api/admin/evaluation/:chatLogId`, `/evaluation/benchmark/upload`; `DELETE /api/admin/evaluation/:chatLogId` |
| Knowledge base | `GET/POST /api/admin/knowledge`, `PATCH/DELETE /api/admin/knowledge/:id` |
| ผู้ใช้และบันทึก | `GET /api/admin/users`, `/users/:id`, `/records`; `DELETE /api/admin/records/:type/:id` |
| Analytics | `GET /api/admin/anomalies` |
| CSV export | `GET /api/admin/export/{users,records,anomalies,evaluation,questions,fallbacks,knowledge}.csv` |

รายการที่รองรับ query ช่วงเวลาใช้ date-range query ของ admin; list endpoints โดยทั่วไปมี `search`, `limit`, `offset` ตามความเหมาะสม. Source of truth สำหรับ payload/validation ทุก endpoint คือ `backend/server.js`.
