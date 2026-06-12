# Diabetes Chatbot

โครงสร้างโปรเจกต์หลัก

- `frontend/` แอปหลักฝั่งผู้ใช้งานบนเว็บ/มือถือ
- `admin-panel/` แผงควบคุมสำหรับผู้ดูแลระบบ
- `backend/` API, ฐานข้อมูล, และ business logic หลัก
- `android/` โปรเจกต์ Android ที่สร้างจาก Capacitor
- `api/` endpoint สำหรับ deployment บางสภาพแวดล้อม
- `docs/` เอกสารการ build, deploy, และสถาปัตยกรรมระบบ

ไฟล์สำคัญ

- `package.json` คำสั่งหลักของ workspace
- `capacitor.config.ts` การเชื่อมเว็บกับ Android
- `vercel.json` การ deploy ฝั่ง frontend
- `.gitignore` รายการไฟล์ local/build/secret ที่ไม่ควรขึ้น Git

แนวทางจัด repo

- เก็บเฉพาะ source code, config, และเอกสารที่จำเป็น
- ไม่ commit ไฟล์ build, APK, keystore, cookies, logs, หรือไฟล์ export ชั่วคราว
- เอกสารควรรวมไว้ใน `docs/` เพื่อลดความรกที่ root

หมายเหตุ

- โฟลเดอร์ฝั่งผู้ใช้งานใช้ชื่อ `frontend/` และถูกอ้างอิงตรงกันใน config หลักของโปรเจกต์
