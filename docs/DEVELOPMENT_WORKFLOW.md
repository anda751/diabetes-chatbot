# Development Workflow & Handover Checklist

## Local development

```powershell
# terminal 1
npm run dev:backend

# terminal 2
npm run dev:frontend

# terminal 3 (เมื่อพัฒนา admin panel)
npm --prefix admin-panel run dev
```

ตรวจ service:

```powershell
curl http://localhost:5000/api/health
npm --prefix frontend run lint
npm --prefix frontend run build
npm --prefix admin-panel run lint
npm --prefix admin-panel run build
```

## การทำงานเป็น feature

1. สร้าง branch ชื่อ `codex/<feature-name>`
2. ระบุ affected API, database, UI และ environment variables
3. ลงมือแก้ source พร้อมปรับเอกสารที่เกี่ยวข้อง
4. ทดสอบ happy path และ validation/error path
5. Review diff โดยไม่รวม `.env`, generated build, local DB หรือ credentials
6. Commit แบบเล็กและมีความหมาย แล้วเปิด PR/merge ตาม workflow ทีม

## Release checklist

- [ ] `npm run build` สำเร็จ
- [ ] health endpoint ตอบ `200` และ `status: ok`
- [ ] ทดสอบ register/login/logout และ session restore
- [ ] ทดสอบ glucose, reminder และ AI chat
- [ ] ทดสอบ admin login และหน้าสำคัญของ admin panel
- [ ] ตรวจ `VITE_API_URL`, Railway variables และ CORS ก่อน production deploy
- [ ] ตรวจว่าไม่มี secrets หรือข้อมูลผู้ป่วยใน Git diff
- [ ] บันทึก deployment URL, commit SHA และผลทดสอบ

## Incident checklist

1. ตรวจ `/api/health` และ Railway logs
2. ยืนยัน `SUPABASE_DB_URL` และ database connectivity โดยไม่เผย credential
3. ตรวจ `VITE_API_URL` บน Vercel และ redeploy หากเปลี่ยนค่า build-time
4. ตรวจ CORS/session cookie เมื่อ frontend/backend อยู่คนละ domain
5. บันทึกสาเหตุ, การแก้ไข และผลตรวจหลังแก้ใน issue/PR
