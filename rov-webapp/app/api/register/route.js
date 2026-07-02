// app/api/register/route.js
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// ── Rate limiting (in-memory, resets on redeploy) ──
// จำกัด 5 register request ต่อ IP ต่อ 15 นาที
const ipRateMap = new Map(); // ip → [timestamps]

function checkRegisterRateLimit(ip) {
  const now    = Date.now();
  const window = 15 * 60 * 1000; // 15 นาที
  const max    = 5;
  const prev   = (ipRateMap.get(ip) || []).filter(t => now - t < window);
  if (prev.length >= max) return false;
  ipRateMap.set(ip, [...prev, now]);
  return true;
}

function getIP(req) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(req) {
  try {
    const ip = getIP(req);

    // Rate limit check
    if (!checkRegisterRateLimit(ip)) {
      return NextResponse.json(
        { error: "สมัครสมาชิกบ่อยเกินไป กรุณารอ 15 นาทีแล้วลองใหม่" },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { email, password, name, teamName, inviteCode, action } = body;

    // ── Validation ──
    if (!email || !password) {
      return NextResponse.json({ error: "กรุณากรอกอีเมลและรหัสผ่าน" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "รูปแบบอีเมลไม่ถูกต้อง" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // เช็คว่า email ซ้ำไหม
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return NextResponse.json({ error: "อีเมลนี้ถูกใช้ไปแล้ว" }, { status: 409 });
    }

    const hashed = await bcrypt.hash(password, 12);

    // ── สร้างทีมใหม่ ──
    if (action === "create") {
      if (!teamName?.trim()) {
        return NextResponse.json({ error: "กรุณากรอกชื่อทีม" }, { status: 400 });
      }

      const team = await prisma.team.create({
        data: {
          name: teamName.trim(),
          data: { create: {} },
        },
      });

      await prisma.user.create({
        data: {
          email: normalizedEmail,
          password: hashed,
          name: name?.trim() || null,
          teamId: team.id,
          role: "admin", // คนสร้างทีมเป็น admin อัตโนมัติ
        },
      });

      return NextResponse.json({
        ok: true,
        message: "สร้างทีมสำเร็จ",
        inviteCode: team.inviteCode,
      });
    }

    // ── เข้าร่วมทีมด้วย Invite Code ──
    if (action === "join") {
      if (!inviteCode?.trim()) {
        return NextResponse.json({ error: "กรุณากรอก Invite Code" }, { status: 400 });
      }

      const team = await prisma.team.findUnique({
        where: { inviteCode: inviteCode.trim() },
      });

      if (!team) {
        return NextResponse.json({ error: "Invite Code ไม่ถูกต้อง" }, { status: 404 });
      }

      await prisma.user.create({
        data: {
          email: normalizedEmail,
          password: hashed,
          name: name?.trim() || null,
          teamId: team.id,
          role: "member",
        },
      });

      return NextResponse.json({ ok: true, message: "เข้าร่วมทีมสำเร็จ" });
    }

    return NextResponse.json({ error: "action ไม่ถูกต้อง" }, { status: 400 });
  } catch (err) {
    console.error("Register error:", err);
    return NextResponse.json({ error: "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง" }, { status: 500 });
  }
}
