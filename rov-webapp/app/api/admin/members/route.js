// app/api/admin/members/route.js
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ── เช็คว่า request มาจาก admin จริง ──
async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "ไม่ได้ login", status: 401 };

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, teamId: true, role: true },
  });
  if (!user?.teamId) return { error: "ยังไม่ได้เข้าทีม", status: 403 };
  if (user.role !== "admin") return { error: "ต้องเป็น Admin เท่านั้น", status: 403 };

  return { user };
}

// ── GET: ดึงรายชื่อสมาชิกทั้งหมดในทีม ──
export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const members = await prisma.user.findMany({
    where: { teamId: auth.user.teamId },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(members);
}

// ── PATCH: เปลี่ยน role ของสมาชิก ──
export async function PATCH(req) {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { userId, role } = await req.json();
  if (!userId || !role) return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  if (!["admin","coach","member"].includes(role))
    return NextResponse.json({ error: "Role ไม่ถูกต้อง" }, { status: 400 });

  // ตรวจสอบว่า target user อยู่ในทีมเดียวกัน
  const target = await prisma.user.findFirst({
    where: { id: userId, teamId: auth.user.teamId },
  });
  if (!target) return NextResponse.json({ error: "ไม่พบสมาชิกคนนี้" }, { status: 404 });

  // ป้องกันการลด role ของตัวเอง ถ้าเป็น admin คนเดียว
  if (userId === auth.user.id && role !== "admin") {
    const adminCount = await prisma.user.count({
      where: { teamId: auth.user.teamId, role: "admin" },
    });
    if (adminCount <= 1)
      return NextResponse.json(
        { error: "ทีมต้องมี Admin อย่างน้อย 1 คน ไม่สามารถลด role ตัวเองได้" },
        { status: 400 }
      );
  }

  await prisma.user.update({ where: { id: userId }, data: { role } });
  return NextResponse.json({ ok: true });
}

// ── DELETE: ลบสมาชิกออกจากทีม (ไม่ลบ account ทิ้ง — แค่เอา teamId ออก) ──
export async function DELETE(req) {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "ไม่ระบุ userId" }, { status: 400 });

  // ป้องกันการลบตัวเอง
  if (userId === auth.user.id)
    return NextResponse.json({ error: "ไม่สามารถลบตัวเองออกจากทีมได้" }, { status: 400 });

  const target = await prisma.user.findFirst({
    where: { id: userId, teamId: auth.user.teamId },
  });
  if (!target) return NextResponse.json({ error: "ไม่พบสมาชิกคนนี้" }, { status: 404 });

  // เอา teamId ออก (user ยังมี account แต่ไม่อยู่ในทีมแล้ว)
  await prisma.user.update({ where: { id: userId }, data: { teamId: null, role: "member" } });
  return NextResponse.json({ ok: true });
}
