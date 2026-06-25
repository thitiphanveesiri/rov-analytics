# RoV Pro Team Analytics — Web App

แอป coaching tool สำหรับทีม RoV esports พร้อม login + database จริง deploy ขึ้น Vercel ได้

Stack: **Next.js 14 (App Router) + Vercel Postgres + Prisma + NextAuth (Email/Password)**

ข้อมูลเป็นแบบ **shared ทั้งทีม** — ทุกคน login แล้วเห็น/แก้ไขข้อมูลเดียวกันหมด (matches, rivals, roster, scout records, รูปนักกีฬา/Hero ทั้งหมด)

---

## โครงสร้างโปรเจกต์

```
rov-webapp/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/route.js   # NextAuth handler
│   │   ├── register/route.js             # สมัครสมาชิกใหม่
│   │   └── data/route.js                 # GET/PUT ข้อมูลทีม (แทน window.storage)
│   ├── login/page.js                     # หน้า login
│   ├── register/page.js                  # หน้าสมัครสมาชิก
│   ├── layout.js                         # root layout + SessionProvider
│   └── page.js                           # หน้าแรก (โหลด RovApp)
├── components/
│   └── RovApp.js                         # แอปทั้งหมด (พอร์ตมาจาก artifact เดิม)
├── lib/
│   ├── auth.js                           # NextAuth config
│   ├── prisma.js                         # Prisma client singleton
│   └── storage.js                        # loadFromStorage/saveToStorage ผ่าน API จริง
├── prisma/
│   └── schema.prisma                     # Database schema
├── middleware.js                         # บังคับ login ก่อนเข้าทุกหน้า (ยกเว้น login/register)
├── package.json
├── next.config.js
└── .env.example
```

---

## ขั้นตอน Deploy ขึ้น Vercel (ทำตามลำดับ)

### 1. เตรียมโค้ดให้พร้อมขึ้น GitHub

```bash
cd rov-webapp
git init
git add .
git commit -m "Initial commit: RoV Pro Team Analytics"
```

สร้าง repo ใหม่บน GitHub แล้ว push ขึ้นไป:
```bash
git remote add origin https://github.com/<your-username>/rov-analytics.git
git branch -M main
git push -u origin main
```

### 2. สร้างโปรเจกต์บน Vercel

1. ไปที่ [vercel.com](https://vercel.com) → Login (ใช้ GitHub account ได้เลย)
2. กด **Add New → Project**
3. เลือก repo `rov-analytics` ที่เพิ่ง push ขึ้นไป
4. Framework Preset จะ detect เป็น **Next.js** อัตโนมัติ — ไม่ต้องแก้อะไร
5. **ยังไม่ต้องกด Deploy ตอนนี้** ให้ตั้งค่า Database ก่อน (ข้อ 3)

### 3. สร้าง Vercel Postgres Database

1. ในหน้าโปรเจกต์ที่เพิ่งสร้าง ไปที่ tab **Storage**
2. กด **Create Database → Postgres**
3. ตั้งชื่อ database (เช่น `rov-analytics-db`) แล้วกด **Create**
4. Vercel จะถาม "Connect to Project" — กด **Connect** เลือกโปรเจกต์ของเรา
5. ระบบจะใส่ environment variables ที่จำเป็น (`POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING` ฯลฯ) ให้อัตโนมัติ — **ไม่ต้องกรอกเอง**

### 4. ตั้งค่า NEXTAUTH_SECRET

1. สร้าง secret แบบสุ่ม รันคำสั่งนี้ในเครื่องตัวเอง (มี OpenSSL ติดเครื่อง Mac/Linux อยู่แล้ว, Windows ใช้ Git Bash):
   ```bash
   openssl rand -base64 32
   ```
2. ใน Vercel ไปที่ **Settings → Environment Variables** เพิ่ม:
   - `NEXTAUTH_SECRET` = ค่าที่ได้จากคำสั่งข้างบน
   - `NEXTAUTH_URL` = `https://<ชื่อโปรเจกต์>.vercel.app` (ใส่หลัง deploy ครั้งแรกแล้วรู้ URL จริง ก็ย้อนมาแก้ได้)

### 5. Deploy

1. กลับไปที่ tab **Deployments** กด **Deploy** (หรือ push commit ใหม่ก็ trigger auto-deploy)
2. รอ build เสร็จ (~2-3 นาที)
3. เมื่อ deploy สำเร็จ จะได้ URL เช่น `https://rov-analytics.vercel.app`

### 6. สร้างตาราง Database (รันครั้งแรกครั้งเดียว)

หลัง deploy สำเร็จ ต้องสั่งให้ Prisma สร้างตารางจริงใน Postgres:

**วิธีที่ง่ายที่สุด — รันจากเครื่องตัวเอง:**
1. ดึง environment variables จาก Vercel มาไว้ในเครื่อง:
   ```bash
   npm install -g vercel
   vercel link        # เชื่อมโฟลเดอร์นี้กับโปรเจกต์บน Vercel
   vercel env pull .env.local
   ```
2. รัน migration:
   ```bash
   npm install
   npx prisma db push
   ```
   คำสั่งนี้จะสร้างตาราง `User` และ `TeamData` ใน Postgres จริงให้ครบ

### 7. ทดสอบ

1. เปิด URL ของแอป (เช่น `https://rov-analytics.vercel.app`)
2. จะถูก redirect ไปหน้า `/login` อัตโนมัติ (เพราะยังไม่ login)
3. กด **สมัครสมาชิก** สร้างบัญชีแรก (เป็น Coach คนแรกของทีม)
4. Login เข้าใช้งานได้เลย — ข้อมูลจะถูกบันทึกลง Postgres จริง ไม่ใช่ localStorage/window.storage อีกต่อไป
5. ให้สมาชิกในทีมคนอื่นไปที่ URL เดียวกัน กด "สมัครสมาชิก" สร้างบัญชีของตัวเอง — ทุกคนจะเห็นข้อมูลทีมเดียวกันหมด (shared)

---

## รันทดสอบในเครื่องตัวเอง (ก่อน deploy จริง)

```bash
npm install
cp .env.example .env.local
# แก้ .env.local ใส่ POSTGRES_PRISMA_URL ฯลฯ (ดึงจาก Vercel ด้วย `vercel env pull` ก็ได้)
npx prisma db push
npm run dev
```
เปิด `http://localhost:3000`

---

## หมายเหตุสำคัญ

- **รูปภาพ (นักกีฬา/Hero)** ตอนนี้ยังเก็บเป็น base64 string ใน Postgres เหมือนระบบเดิม ใช้งานได้ปกติแต่ถ้าทีมอัพโหลดรูปเยอะมากในระยะยาว แนะนำให้ย้ายไปใช้ [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) แทน (เก็บแค่ URL ใน database แทนตัวรูปเอง) — บอกได้ถ้าอยากให้ช่วยทำเพิ่ม
- **AI Draft Assistant** ของเดิมที่เรียก Claude API ผ่าน Artifact proxy ถูกถอดออกแล้ว เพราะใช้นอก Claude.ai ไม่ได้ ถ้าต้องการฟีเจอร์แบบนี้ในเว็บจริง ต้องเพิ่ม Anthropic API key ของตัวเองในฝั่ง server (`app/api/...`) แล้วเรียกผ่าน backend แทน — เป็นงานแยกที่ทำเพิ่มได้
- **Liquipedia / external pro-meta data** ยังไม่ได้ทำ เหมือนเดิม
- ทุกคนใน Database ตอนนี้เห็นข้อมูล**เดียวกันหมด** (shared, ไม่มี role/สิทธิ์แยก) ถ้าอยากเพิ่ม role (เช่น Coach แก้ได้ แต่ผู้เล่นดูได้อย่างเดียว) แจ้งได้ จะเพิ่ม role field ใน User model ให้
