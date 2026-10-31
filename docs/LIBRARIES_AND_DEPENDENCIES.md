# Libraries & Dependencies

เวอร์ชันที่แน่นอนอยู่ใน `package-lock.json` ของแต่ละ workspace; ตารางนี้อธิบายเหตุผลการใช้งาน

## Root / mobile shell

| Library | หน้าที่ |
| --- | --- |
| `@capacitor/core`, `@capacitor/android`, `@capacitor/cli` | แปลงเว็บแอปเป็น Android shell |
| `@capacitor/app` | native app lifecycle |
| `@capacitor/local-notifications` | local notifications บน Android |
| `@capacitor-community/speech-recognition` | speech recognition สำหรับ native runtime |

## Backend

| Library | หน้าที่ |
| --- | --- |
| `express` | HTTP API server |
| `pg` | PostgreSQL/Supabase connection pool |
| `dotenv` | โหลด variables สำหรับ local development |
| `@google/genai` | Gemini AI SDK |
| `cors` | CORS policy |
| `web-push` | ส่ง Web Push notification |
| `sqlite`, `sqlite3` | รองรับ migration จาก database รุ่นเดิม |
| `nodemon` (dev) | restart backend ขณะพัฒนา |

## Frontend และ admin panel

| Library | หน้าที่ |
| --- | --- |
| `react`, `react-dom` | UI framework |
| `vite`, `@vitejs/plugin-react` | development server และ production build |
| `tailwindcss`, `postcss`, `autoprefixer` | styling pipeline |
| `recharts` | admin charts/report visualizations |
| `lucide-react` | icons |
| `eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh` | linting |

## การอัปเดต dependency

1. อัปเดตทีละ workspace และอ่าน changelog สำหรับ major version
2. รัน `npm install` เพื่อ update lockfile
3. รัน lint/build ของ frontend และ admin panel
4. ทดสอบ login, cookie, chat, notification และ Android sync เมื่อเกี่ยวข้อง
5. อย่า commit secrets ที่ npm แสดงใน error logs
