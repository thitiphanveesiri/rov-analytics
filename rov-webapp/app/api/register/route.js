import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req) {
  try {
    const { email, password, name, action, teamName, inviteCode } = await req.json();

    if (!email || !password)
      return NextResponse.json({ error: "กรุณากรอกอีเมลและรหัสผ่าน" }, { status: 400 });
    if (password.length < 6)
      return NextResponse.json({ error: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" }, { status: 400 });

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing)
      return NextResponse.json({ error: "อีเมลนี้มีบัญชีอยู่แล้ว" }, { status: 409 });

    const hash = await bcrypt.hash(password, 10);

    if (action === "create") {
      // สร้างทีมใหม่
      if (!teamName?.trim())
        return NextResponse.json({ error: "กรุณากรอกชื่อทีม" }, { status: 400 });

      const team = await prisma.team.create({
        data: {
          name: teamName.trim(),
          data: { create: {} }, // สร้าง TeamData เปล่าให้ทีม
          members: {
            create: {
              email: normalizedEmail,
              password: hash,
              name: name?.trim() || null,
              role: "coach",
            }
          }
        },
        include: { members: true }
      });

      const user = team.members[0];
      return NextResponse.json({ id: user.id, email: user.email, teamId: team.id, teamName: team.name });

    } else if (action === "join") {
      // เข้าร่วมทีมด้วย invite code
      if (!inviteCode?.trim())
        return NextResponse.json({ error: "กรุณากรอก Invite Code" }, { status: 400 });

      const team = await prisma.team.findUnique({ where: { inviteCode: inviteCode.trim() } });
      if (!team)
        return NextResponse.json({ error: "Invite Code ไม่ถูกต้อง" }, { status: 404 });

      const user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          password: hash,
          name: name?.trim() || null,
          role: "member",
          teamId: team.id,
        }
      });

      return NextResponse.json({ id: user.id, email: user.email, teamId: team.id, teamName: team.name });

    } else {
      return NextResponse.json({ error: "action ไม่ถูกต้อง" }, { status: 400 });
    }

  } catch (err) {
    console.error("Register error:", err);
    return NextResponse.json({ error: "เกิดข้อผิดพลาด กรุณาลองใหม่" }, { status: 500 });
  }
}
