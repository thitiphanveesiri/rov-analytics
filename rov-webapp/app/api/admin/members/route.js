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
    select: { id: true, email: true, teamId: true, role: true },
  });
  if (!user?.teamId) return { error: "ยังไม่ได้เข้าทีม", status: 403 };
  if (user.role !== "admin") return { error: "ต้องเป็น Admin เท่านั้น", status: 403 };

  return { user };
}

// ── GET: ดึงรายชื่อสมาชิกทั้งหมดในทีม (รวม status ให้ admin เห็นใครรออนุมัติอยู่) ──
export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const members = await prisma.user.findMany({
    where: { teamId: auth.user.teamId },
    select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(members);
}

// ── PATCH: เปลี่ยน role และ/หรือ status ของสมาชิก ──
// ใช้ endpoint เดียวกันทั้งเปลี่ยน role ปกติ และ "อนุมัติ" สมาชิกที่ pending
// อยู่ (ส่ง status: "active" มา) — ส่ง field ไหนมาก็แก้เฉพาะ field นั้น
export async function PATCH(req) {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { userId, role, status } = await req.json();
  if (!userId) return NextResponse.json({ error: "ไม่ระบุ userId" }, { status: 400 });
  if (role === undefined && status === undefined)
    return NextResponse.json({ error: "ต้องระบุ role หรือ status อย่างน้อย 1 อย่าง" }, { status: 400 });
  if (role !== undefined && !["admin","coach","member"].includes(role))
    return NextResponse.json({ error: "Role ไม่ถูกต้อง" }, { status: 400 });
  if (status !== undefined && !["active","pending"].includes(status))
    return NextResponse.json({ error: "Status ไม่ถูกต้อง" }, { status: 400 });

  // ตรวจสอบว่า target user อยู่ในทีมเดียวกัน
  const target = await prisma.user.findFirst({
    where: { id: userId, teamId: auth.user.teamId },
  });
  if (!target) return NextResponse.json({ error: "ไม่พบสมาชิกคนนี้" }, { status: 404 });

  // ป้องกันการลด role ของตัวเอง ถ้าเป็น admin คนเดียว
  if (userId === auth.user.id && role !== undefined && role !== "admin") {
    const adminCount = await prisma.user.count({
      where: { teamId: auth.user.teamId, role: "admin" },
    });
    if (adminCount <= 1)
      return NextResponse.json(
        { error: "ทีมต้องมี Admin อย่างน้อย 1 คน ไม่สามารถลด role ตัวเองได้" },
        { status: 400 }
      );
  }

  const data = {};
  if (role !== undefined) data.role = role;
  if (status !== undefined) data.status = status;

  await prisma.user.update({ where: { id: userId }, data });

  const auditDetail = [
    role !== undefined ? `role: ${target.role} → ${role}` : null,
    status !== undefined ? `status: ${target.status} → ${status}` : null,
  ].filter(Boolean).join(", ");

  await prisma.adminAuditLog.create({
    data: {
      teamId: auth.user.teamId,
      actorEmail: auth.user.email,
      action: status === "active" && target.status === "pending" ? "member_approved" : "role_change",
      targetEmail: target.email,
      detail: auditDetail,
    },
  }).catch(err => console.error("Audit log write failed (non-fatal):", err));

  return NextResponse.json({ ok: true });
}

// ── DELETE: ลบสมาชิกออกจากทีม (ไม่ลบ account ทิ้ง — แค่เอา teamId ออก) ──
// ใช้ได้ทั้งลบสมาชิกที่ active อยู่แล้ว และ "ปฏิเสธ" คนที่ยัง pending
// (เอาออกจากทีมเหมือนกัน — คนนั้นจะกลับไปสถานะ "ยังไม่ได้เข้าทีม" เหมือน
// สมัครใหม่ ต้องขอ invite code แล้วเข้าร่วมใหม่เองถ้าจะลองอีกครั้ง)
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

  // เอา teamId ออก (user ยังมี account แต่ไม่อยู่ในทีมแล้ว) — reset สถานะ
  // กลับเป็น active/member เผื่อวันหลังเข้าทีมอื่นด้วย invite code ใหม่
  // จะได้ไม่ค้างสถานะ pending จากทีมเก่าไปทีมใหม่
  await prisma.user.update({
    where: { id: userId },
    data: { teamId: null, role: "member", status: "active" },
  });

  await prisma.adminAuditLog.create({
    data: {
      teamId: auth.user.teamId,
      actorEmail: auth.user.email,
      action: target.status === "pending" ? "member_rejected" : "member_removed",
      targetEmail: target.email,
    },
  }).catch(err => console.error("Audit log write failed (non-fatal):", err));

  return NextResponse.json({ ok: true });
}
