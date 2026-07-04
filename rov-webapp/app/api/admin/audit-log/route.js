import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ── GET: ดึงประวัติการกระทำของ admin ล่าสุด 50 รายการ ──
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "ไม่ได้ login" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { teamId: true, role: true },
  });
  if (!user?.teamId) return NextResponse.json({ error: "ยังไม่ได้เข้าทีม" }, { status: 403 });
  if (user.role !== "admin") return NextResponse.json({ error: "ต้องเป็น Admin เท่านั้น" }, { status: 403 });

  const logs = await prisma.adminAuditLog.findMany({
    where: { teamId: user.teamId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(logs);
}
