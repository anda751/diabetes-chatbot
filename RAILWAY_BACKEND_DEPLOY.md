# Railway Backend Deploy

โปรเจ็กต์นี้สามารถใช้ `Vercel` สำหรับ frontend และ `Railway` สำหรับ backend ได้

แนวทางนี้เหมาะกับโค้ดปัจจุบัน เพราะ backend เป็น Express ปกติและไม่ต้องฝืนเป็น serverless

## 1. Deploy backend ไป Railway

1. ไปที่ Railway
2. กด `New Project`
3. เลือก `Deploy from GitHub repo`
4. เลือก repo นี้
5. ตอนสร้าง service ให้ชี้ไปที่โฟลเดอร์ `backend`

ถ้า Railway ถามค่า start command ใช้:

```txt
npm start
```

## 2. ตั้งค่า Variables ใน Railway

ที่ service `backend` ให้ตั้งค่า:

- `SUPABASE_DB_URL`
- `GEMINI_API_KEY`
- `SESSION_SECRET`
- `ALLOWED_ORIGINS`
- `SESSION_COOKIE_SAME_SITE`
- `SESSION_COOKIE_SECURE`

ค่าที่แนะนำเมื่อ frontend อยู่บน Vercel:

```txt
SESSION_COOKIE_SAME_SITE=None
SESSION_COOKIE_SECURE=true
```

ตัวอย่าง `ALLOWED_ORIGINS`:

```txt
https://your-frontend.vercel.app
```

ถ้ามีหลายโดเมนให้คั่นด้วย comma:

```txt
https://your-frontend.vercel.app,https://www.your-domain.com
```

## 3. เอา URL ของ Railway ไปใส่ frontend

หลัง deploy สำเร็จ Railway จะให้ public domain เช่น:

```txt
https://your-backend.up.railway.app
```

ให้นำไปตั้งใน Vercel ฝั่ง frontend เป็น:

```txt
VITE_API_URL=https://your-backend.up.railway.app/api
```

## 4. ตั้งค่า frontend บน Vercel

ใน Vercel ให้ตั้ง Environment Variable:

```txt
VITE_API_URL=https://your-backend.up.railway.app/api
```

แล้ว redeploy frontend 1 รอบ

## 5. เช็กหลัง deploy

ลองเปิด:

```txt
https://your-backend.up.railway.app/api/health
```

ถ้าขึ้น `status: "ok"` แปลว่า backend ใช้งานได้

จากนั้นลองเข้า frontend บน Vercel แล้วทดสอบ:

1. สมัครสมาชิก
2. เข้าสู่ระบบ
3. ส่งคำถามหา AI

## 6. หมายเหตุเรื่อง login ข้ามโดเมน

กรณี `frontend` อยู่บน Vercel และ `backend` อยู่บน Railway:

- ต้องตั้ง `ALLOWED_ORIGINS` ให้ตรงกับโดเมน frontend
- ต้องตั้ง `SESSION_COOKIE_SAME_SITE=None`
- ต้องตั้ง `SESSION_COOKIE_SECURE=true`

ถ้าขาดข้อใดข้อหนึ่ง มักจะเจออาการ:

- เปิดเว็บได้
- เรียก API ได้บางตัว
- แต่ login แล้ว session ไม่ค้าง
