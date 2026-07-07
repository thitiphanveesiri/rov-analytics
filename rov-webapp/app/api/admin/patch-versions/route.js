import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// ── Patch version history ──
// TeamData.patchInfo only ever tracks the CURRENT patch (it gets
// overwritten on every "SET_PATCH_INFO"), so there was no way to answer
// "how did our win rate change across patches" — that needs to know which
// patch was live on the date of each match. This table + endpoint is the
// minimum needed for that: a dated log of patch versions, maintained by
// whoever currently updates the "current patch" info in Admin.
//
// This is a NEW admin action (separate from the existing SET_PATCH_INFO
// flow) rather than piggy-backing on it, so nothing about the current
// patch-info UI needs to change — coaches can start logging versions here
// whenever it's convenient, and the timeline endpoint just works with
// however much history exists.

const patchVersionSchema = z.object({
  version: z.string().min(1).max(50),
  notes: z.string().max(2000).optional(),
  effectiveFrom: z.string().min(1), // ISO date string, e.g. "2026-06-15"
});

async function requireAdmin(session) {
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { teamId: true, role: true },
  });
  if (!user?.teamId) return { error: NextResponse.json({ error: "ยังไม่ได้เข้าทีม" }, { status: 403 }) };
  if (user.role !== "admin") return { error: NextResponse.json({ error: "ต้องเป็น Admin เท่านั้น" }, { status: 403 }) };
  return { teamId: user.teamId };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "ไม่ได้ login" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { teamId: true },
  });
  if (!user?.teamId) return NextResponse.json({ error: "ยังไม่ได้เข้าทีม" }, { status: 403 });

  const versions = await prisma.patchVersion.findMany({
    where: { teamId: user.teamId },
    orderBy: { effectiveFrom: "asc" },
  });
  return NextResponse.json(versions);
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "ไม่ได้ login" }, { status: 401 });

  const { teamId, error } = await requireAdmin(session);
  if (error) return error;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const parsed = patchVersionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "ข้อมูลไม่ผ่านการตรวจสอบ", details: parsed.error.flatten() }, { status: 400 });
  }

  const created = await prisma.patchVersion.create({
    data: {
      teamId,
      version: parsed.data.version,
      notes: parsed.data.notes,
      effectiveFrom: new Date(parsed.data.effectiveFrom),
    },
  });

  return NextResponse.json(created);
}

export async function DELETE(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "ไม่ได้ login" }, { status: 401 });

  const { teamId, error } = await requireAdmin(session);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ต้องระบุ id" }, { status: 400 });

  await prisma.patchVersion.deleteMany({ where: { id, teamId } }); // scoped to teamId so a team can't delete another team's row
  return NextResponse.json({ ok: true });
}
