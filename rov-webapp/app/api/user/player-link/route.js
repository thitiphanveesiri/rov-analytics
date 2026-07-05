import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ── GET: ดึง playerName ปัจจุบันของ user ที่ login อยู่ ──
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "ไม่ได้ login" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { playerName: true },
  });
  return NextResponse.json({ playerName: user?.playerName || null });
}

// ── PATCH: ตั้งค่า/เปลี่ยน playerName ของตัวเอง (self-service) ──
export async function PATCH(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "ไม่ได้ login" }, { status: 401 });

  const { playerName } = await req.json().catch(() => ({}));
  // อนุญาตให้เป็น string หรือ null (เพื่อยกเลิกการผูก)
  const value = typeof playerName === "string" ? playerName.trim().slice(0, 60) : null;

  await prisma.user.update({
    where: { email: session.user.email },
    data: { playerName: value || null },
  });

  return NextResponse.json({ ok: true, playerName: value || null });
}
