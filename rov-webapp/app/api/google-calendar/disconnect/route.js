import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { disconnectUser } from "@/lib/googleCalendar";

// ── GET /api/google-calendar/status ──
// Returns whether the current user has connected Google Calendar, and
// which account — used by the UI to show "Connect" vs "Connected as x@..."
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "ไม่ได้ login" }, { status: 401 });

  const conn = await prisma.googleCalendarConnection.findUnique({
    where: { userId: session.user.id },
    select: { googleEmail: true, createdAt: true },
  });

  return NextResponse.json({
    connected: !!conn,
    googleEmail: conn?.googleEmail || null,
  });
}

// ── POST /api/google-calendar/disconnect ──
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "ไม่ได้ login" }, { status: 401 });

  await disconnectUser(session.user.id);
  return NextResponse.json({ ok: true });
}
