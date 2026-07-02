// app/api/auth/forgot-password/route.js
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

// ป้องกัน brute force: จำกัด 3 request ต่อ email ต่อ 15 นาที
const rateLimitMap = new Map(); // email → [timestamps]

function checkRateLimit(email) {
  const now = Date.now();
  const window = 15 * 60 * 1000; // 15 นาที
  const max = 3;
  const prev = (rateLimitMap.get(email) || []).filter(t => now - t < window);
  if (prev.length >= max) return false;
  rateLimitMap.set(email, [...prev, now]);
  return true;
}

export async function POST(req) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: "กรุณากรอกอีเมล" }, { status: 400 });

    const normalizedEmail = email.toLowerCase().trim();

    // Rate limit check
    if (!checkRateLimit(normalizedEmail)) {
      return NextResponse.json(
        { error: "ส่ง request บ่อยเกินไป กรุณารอ 15 นาทีแล้วลองใหม่" },
        { status: 429 }
      );
    }

    // ไม่บอกว่า email นี้มีหรือไม่มีในระบบ (security best practice)
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      const expiry = new Date(Date.now() + 60 * 60 * 1000); // หมดอายุใน 1 ชั่วโมง

      await prisma.user.update({
        where: { email: normalizedEmail },
        data: { resetToken: token, resetTokenExpiry: expiry },
      });

      // ── ส่ง Email ──
      // ตอนนี้ใช้วิธี log URL ไปที่ console ก่อน
      // (ถ้าต้องการส่ง email จริง ให้ติดตั้ง Resend/SendGrid แล้วแทนที่ส่วนนี้)
      const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;
      console.log(`[RESET PASSWORD] Email: ${normalizedEmail} | URL: ${resetUrl}`);

      // ถ้าต้องการใช้ Resend (https://resend.com) ให้ uncomment ด้านล่าง:
      // import { Resend } from 'resend';
      // const resend = new Resend(process.env.RESEND_API_KEY);
      // await resend.emails.send({
      //   from: 'RoV Analytics <noreply@yourdomain.com>',
      //   to: normalizedEmail,
      //   subject: 'รีเซ็ตรหัสผ่าน RoV Pro Team Analytics',
      //   html: `<p>คลิกลิงก์นี้เพื่อรีเซ็ตรหัสผ่าน (หมดอายุใน 1 ชั่วโมง):</p>
      //          <a href="${resetUrl}">${resetUrl}</a>`,
      // });
    }

    // ตอบกลับเหมือนกันทุกกรณี (ไม่บอกว่า email มีในระบบหรือไม่)
    return NextResponse.json({
      ok: true,
      message: "ถ้าอีเมลนี้มีในระบบ เราจะส่งลิงก์รีเซ็ตรหัสผ่านให้",
    });
  } catch (err) {
    console.error("Forgot password error:", err);
    return NextResponse.json({ error: "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง" }, { status: 500 });
  }
}
