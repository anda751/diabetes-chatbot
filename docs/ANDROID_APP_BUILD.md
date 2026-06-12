# Android App Build

โปรเจ็กต์นี้ถูกเตรียมเป็น Android app ด้วย Capacitor แล้ว

ไฟล์สำคัญ:
- `capacitor.config.ts`
- `android/`

คำสั่งที่ใช้:
- `npm run build:app`
- `npm run android:open`

ขั้นตอน build เป็นแอป:

1. ตั้งค่า `VITE_API_URL` ให้ชี้ไป backend production ก่อน build
2. รัน:
   - `npm run build:app`
3. เปิด Android Studio:
   - `npm run android:open`
4. ใน Android Studio เลือก:
   - `Build > Build Bundle(s) / APK(s) > Build APK(s)`
5. ไฟล์ APK จะอยู่ประมาณ:
   - `android/app/build/outputs/apk/debug/`

ถ้าจะปล่อยขึ้น Play Store:
- ใช้ `Build Bundle(s) / APK(s) > Build Bundle(s)`
- จะได้ไฟล์ `.aab`

หมายเหตุ:
- ถ้าจะให้แอปคุยกับ backend ได้จริง ต้องใช้ `https` สำหรับ API production
- หลังแก้ frontend ใหม่ทุกครั้ง ให้รัน `npm run build:app` ก่อนกลับไป build ใน Android Studio
