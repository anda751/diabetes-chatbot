# Known Issues & Future Plans

## Known limitations

- Automated test suite ยังไม่ครอบคลุม auth, glucose, reminders และ AI chat อย่างเป็นระบบ
- Session cookie เมื่อ frontend/backend อยู่คนละโดเมนต้องตั้ง CORS และ cookie flags ให้ถูกต้อง
- Gemini อาจ fallback เมื่อ provider หรือโมเดลขัดข้อง; UI ควรสื่อว่าไม่ใช่การวินิจฉัยโรค
- Web Push และ Android local notifications เป็นคนละ runtime path จึงต้องทดสอบทั้งสองสภาพแวดล้อม
- Admin credentials เป็น environment variables; ควรใช้รหัสผ่านแข็งแรงและเปลี่ยนเป็น role-based auth ในอนาคต
- API แบบประเมินอ้างถึง `satisfaction_surveys` แต่ schema initializer ยังไม่สร้างตารางนี้สำหรับฐานข้อมูลใหม่

## Roadmap

1. เพิ่ม automated tests และ CI สำหรับ API/critical flows
2. แยก admin roles และ audit log
3. เพิ่ม database indexes และ retention policy ตามปริมาณข้อมูลจริง
4. เพิ่ม monitoring, alerting และ structured logs ใน production
5. ทำ Android release signing และ release checklist
6. ทบทวน clinical content ร่วมกับผู้เชี่ยวชาญก่อนขยาย use cases ทางสุขภาพ
