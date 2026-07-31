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

  // ── ชื่อไฟล์ ──
  // HTTP header values ต้องเป็น ASCII/Latin1 เท่านั้น — ชื่อทีมภาษาไทยใส่
  // ตรงๆ ใน `filename=` แล้ว throw (หรือได้ไฟล์ชื่อเพี้ยน) เพราะเป็น UTF-8
  // multi-byte เกิน 0xFF ตัว NextResponse header จะแปลงเป็น ByteString ไม่ได้
  //
  // แก้ตาม RFC 5987: ส่งทั้ง `filename=` (ASCII fallback สำหรับ client เก่า)
  // และ `filename*=UTF-8''...` (encoded ชื่อจริงภาษาไทย — เบราว์เซอร์สมัยใหม่
  // ทุกตัวอ่านอันนี้และโชว์ชื่อไฟล์ภาษาไทยถูกต้อง)
  const dateStr = new Date().toISOString().slice(0, 10);
  const asciiSafeName = team.name.replace(/[^\x20-\x7E]/g, "_") || "team";
  const encodedName = encodeURIComponent(team.name);

  return new NextResponse(JSON.stringify(exportPayload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition":
        `attachment; filename="${asciiSafeName}-backup-${dateStr}.json"; ` +
        `filename*=UTF-8''${encodedName}-backup-${dateStr}.json`,
    },
  });
}
