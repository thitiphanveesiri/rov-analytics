// app/api/auth/forgot-password/route.js
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import crypto from "crypto";

// ป้องกัน brute force: จำกัด 3 request ต่อ email ต่อ 15 นาที
const rateLimitMap = new Map();

function checkRateLimit(email) {
  const now = Date.now();
  const window = 15 * 60 * 1000;
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

    if (!checkRateLimit(normalizedEmail)) {
      return NextResponse.json(
        { error: "ส่ง request บ่อยเกินไป กรุณารอ 15 นาทีแล้วลองใหม่" },
        { status: 429 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 ชั่วโมง

      await prisma.user.update({
        where: { email: normalizedEmail },
        data: { resetToken: token, resetTokenExpiry: expiry },
      });

      const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;

      // ── ส่ง Email ผ่าน Resend ──
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: "RoV Analytics <onboarding@resend.dev>",
        to: normalizedEmail,
        subject: "🔑 รีเซ็ตรหัสผ่าน RoV Pro Team Analytics",
        html: `
          <div style="font-family:'Segoe UI',sans-serif;max-width:480px;margin:0 auto;
            background:#0a0a16;color:#e8e8f0;padding:32px;border-radius:16px">
            <div style="text-align:center;margin-bottom:24px">
              <div style="font-size:36px">🦅</div>
              <div style="font-weight:900;font-size:18px;color:#a29bfe;letter-spacing:1px">
                PRO TEAM ANALYTICS
              </div>
            </div>
            <p style="color:#e8e8f0;font-size:15px;line-height:1.6">
              สวัสดีครับ มีคำขอรีเซ็ตรหัสผ่านสำหรับบัญชี <strong>${normalizedEmail}</strong>
            </p>
            <p style="color:#6b6b8a;font-size:13px">
              กดปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่ ลิงก์นี้จะหมดอายุใน <strong style="color:#e8e8f0">1 ชั่วโมง</strong>
            </p>
            <div style="text-align:center;margin:28px 0">
              <a href="${resetUrl}"
                style="background:linear-gradient(135deg,#6C5CE7,#a29bfe);color:#fff;
                  text-decoration:none;padding:14px 32px;border-radius:10px;
                  font-weight:800;font-size:15px;display:inline-block">
                🔐 ตั้งรหัสผ่านใหม่
              </a>
            </div>
            <p style="color:#6b6b8a;font-size:11px;text-align:center">
              ถ้าคุณไม่ได้ขอรีเซ็ตรหัสผ่าน ไม่ต้องทำอะไร อีเมลนี้จะหมดอายุเองใน 1 ชั่วโมง
            </p>
            <hr style="border:none;border-top:1px solid #1e1640;margin:20px 0"/>
            <p style="color:#6b6b8a;font-size:10px;text-align:center">
              หรือ copy ลิงก์นี้ไปเปิดในเบราว์เซอร์:<br/>
              <span style="color:#a29bfe;word-break:break-all">${resetUrl}</span>
            </p>
          </div>
        `,
      });
    }

    return NextResponse.json({
      ok: true,
      message: "ถ้าอีเมลนี้มีในระบบ เราจะส่งลิงก์รีเซ็ตรหัสผ่านให้",
    });
  } catch (err) {
    console.error("Forgot password error:", err);
    return NextResponse.json({ error: "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง" }, { status: 500 });
  }
}
