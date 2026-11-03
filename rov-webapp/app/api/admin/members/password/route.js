// app/api/admin/members/password/route.js
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";
import { isActiveUser } from "@/lib/permissions";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return { error: "ไม่ได้ login", status: 401 };

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, email: true, teamId: true, role: true, status: true },
  });
  if (!user?.teamId) return { error: "ยังไม่ได้เข้าทีม", status: 403 };
  if (!isActiveUser(user)) return { error: "บัญชีนี้ถูกระงับการใช้งาน", status: 403 };
  if (user.role !== "admin") return { error: "ต้องเป็น Admin เท่านั้น", status: 403 };
  return { user };
}

export async function POST(req) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!(await checkRateLimit(`admin-password-reset:${auth.user.id}`, 10, 60))) {
    return NextResponse.json({ error: "ทำรายการถี่เกินไป กรุณารอสักครู่" }, { status: 429 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const { userId, password } = body || {};
  if (typeof userId !== "string" || !userId) {
    return NextResponse.json({ error: "ไม่ระบุสมาชิก" }, { status: 400 });
  }
  if (userId === auth.user.id) {
    return NextResponse.json({ error: "ใช้เมนูนี้เปลี่ยนรหัสผ่านของตัวเองไม่ได้" }, { status: 400 });
  }
  if (typeof password !== "string" || password.length < 6 || password.length > 128) {
    return NextResponse.json({ error: "รหัสผ่านต้องมีความยาว 6–128 ตัวอักษร" }, { status: 400 });
  }

  const target = await prisma.user.findFirst({
    where: { id: userId, teamId: auth.user.teamId },
    select: { id: true, email: true },
  });
  if (!target) {
    return NextResponse.json({ error: "ไม่พบสมาชิกคนนี้ในทีม" }, { status: 404 });
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  await prisma.user.update({
    where: { id: target.id },
    data: { password: hashedPassword },
  });

  await prisma.adminAuditLog.create({
    data: {
      teamId: auth.user.teamId,
      actorEmail: auth.user.email,
      action: "password_reset",
      targetEmail: target.email,
      detail: "Admin ตั้งรหัสผ่านใหม่",
    },
  }).catch(err => console.error("Password reset audit log write failed:", err));

  return NextResponse.json({ ok: true });
}
