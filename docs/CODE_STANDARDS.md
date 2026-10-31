# Code Comments & Standards

## Conventions

- ใช้ ES modules และ `async/await`
- ชื่อ JavaScript ใช้ `camelCase`; React components ใช้ `PascalCase`
- API paths ใช้ lowercase kebab-case และคืน JSON ที่สม่ำเสมอ
- validate input ฝั่ง backend ทุก endpoint ก่อนอ่านหรือเขียนฐานข้อมูล
- SQL ต้องใช้ parameterized queries ผ่าน database wrapper; ห้ามต่อ user input เป็น SQL string
- ไม่เก็บ credentials ใน source, `.env`, cookies, build artefacts หรือ logs ที่ commit ขึ้น Git

## Comments

เขียน comment เพื่ออธิบายเหตุผลหรือข้อจำกัดที่ไม่ชัดเจนจากโค้ด เช่น fallback ของ Gemini, cookie cross-site, notification runtime split และ SQL migration. หลีกเลี่ยง comment ที่เพียงบรรยายโค้ดทีละบรรทัด.

## Quality checks

- Build ก่อน deploy: `npm run build`
- ตรวจ health หลัง deploy: `/api/health`
- ทดสอบ flows สำคัญ: สมัครสมาชิก, login, บันทึกค่าน้ำตาล, AI chat, reminder และ admin login
- เมื่อแก้ schema ให้รองรับ database เดิมด้วย `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` ตาม pattern ปัจจุบัน
