import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ── GET: export ข้อมูลทีมทั้งหมดเป็น JSON (สำหรับ backup) ──
// Admin เท่านั้น — ข้อมูลนี้รวม photo URLs, matches, roster ฯลฯ ทั้งหมด
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "ไม่ได้ login" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { teamId: true, role: true },
  });
  if (!user?.teamId) return NextResponse.json({ error: "ยังไม่ได้เข้าทีม" }, { status: 403 });
  if (user.role !== "admin") return NextResponse.json({ error: "ต้องเป็น Admin เท่านั้น" }, { status: 403 });

  const team = await prisma.team.findUnique({
    where: { id: user.teamId },
    include: { data: true },
  });
  if (!team) return NextResponse.json({ error: "ไม่พบทีม" }, { status: 404 });

  const { id: _dataId, teamId: _teamId, ...teamData } = team.data || {};

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    teamName: team.name,
    ...teamData,
  };

  return new NextResponse(JSON.stringify(exportPayload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${team.name.replace(/[^a-z0-9ก-๙]/gi, "_")}-backup-${new Date().toISOString().slice(0,10)}.json"`,
    },
  });
}
