import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncMatchesToRelational } from "@/lib/matchSync";

// ── POST /api/admin/backfill-matches ──
// One-off migration helper: rebuilds this team's normalized Match/Game/Pick
// rows from its existing TeamData.matches JSON. Needed once, right after
// deploying the new schema, to catch up on match history that was saved
// before the analytics tables existed. Safe to call more than once —
// syncMatchesToRelational wipes-and-rebuilds, so repeat calls just redo the
// same work rather than duplicating rows.
//
// This is intentionally a normal authenticated admin route (not a raw
// script) so it runs inside Next's own module resolution/transpilation —
// no risk of the ESM/CommonJS mismatches a standalone `node script.js` run
// would hit against files like lib/matchSync.js.
//
// After you've run this once for your team(s), there's no need to keep
// calling it — going forward /api/data PUT keeps the mirror in sync
// automatically on every save.
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "ไม่ได้ login" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { teamId: true, role: true },
  });
  if (!user?.teamId) return NextResponse.json({ error: "ยังไม่ได้เข้าทีม" }, { status: 403 });
  if (user.role !== "admin") return NextResponse.json({ error: "ต้องเป็น Admin เท่านั้น" }, { status: 403 });

  const teamData = await prisma.teamData.findUnique({
    where: { teamId: user.teamId },
    select: { matches: true, customHeroes: true, roleOverrides: true },
  });

  const matches = Array.isArray(teamData?.matches) ? teamData.matches : [];

  try {
    await syncMatchesToRelational(
      user.teamId,
      matches,
      teamData?.customHeroes || [],
      teamData?.roleOverrides || {}
    );
    return NextResponse.json({ ok: true, matchesSynced: matches.length });
  } catch (err) {
    console.error("Backfill error for team", user.teamId, err);
    return NextResponse.json({ error: "Backfill ไม่สำเร็จ", detail: String(err.message || err) }, { status: 500 });
  }
}
