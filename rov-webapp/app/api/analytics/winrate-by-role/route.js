import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ── GET /api/analytics/winrate-by-role ──
//
// Win rate broken down by role/lane (Slayer/Jungle/Mid/Abyssal/Support)
// instead of just per-hero — answers "are we winning more from our Jungle
// or our Abyssal lane?" which per-hero stats can't answer directly since
// they fragment across many different heroes played in the same role.
//
// Uses Pick.role, which was resolved and denormalized at sync time (see
// lib/matchSync.js) so this doesn't need to re-run resolveHeroRole here —
// it just reads what was already computed.
export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "ไม่ได้ login" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { teamId: true },
  });
  if (!user?.teamId) return NextResponse.json({ error: "ยังไม่ได้เข้าทีม" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const rival = searchParams.get("rival");
  const player = searchParams.get("player");

  const ourPicks = await prisma.pick.findMany({
    where: {
      isBan: false,
      side: "our",
      ...(player ? { player } : {}),
      game: {
        match: {
          teamId: user.teamId,
          ...(rival ? { rivalName: rival } : {}),
        },
      },
    },
    select: {
      role: true,
      hero: true,
      player: true,
      game: { select: { result: true } },
    },
  });

  const byRole = {};
  const byHeroWithinRole = {};

  for (const p of ourPicks) {
    const role = p.role || "Unknown";
    const win = p.game.result === "WIN";

    if (!byRole[role]) byRole[role] = { picks: 0, wins: 0 };
    byRole[role].picks++;
    if (win) byRole[role].wins++;

    const key = `${role}::${p.hero}`;
    if (!byHeroWithinRole[key]) byHeroWithinRole[key] = { role, hero: p.hero, picks: 0, wins: 0 };
    byHeroWithinRole[key].picks++;
    if (win) byHeroWithinRole[key].wins++;
  }

  const roleBreakdown = Object.entries(byRole)
    .map(([role, v]) => ({
      role,
      games: v.picks,
      winRate: v.picks ? Math.round((v.wins / v.picks) * 100) : 0,
    }))
    .sort((a, b) => b.games - a.games);

  const heroBreakdown = Object.values(byHeroWithinRole)
    .map((v) => ({
      role: v.role,
      hero: v.hero,
      games: v.picks,
      winRate: v.picks ? Math.round((v.wins / v.picks) * 100) : 0,
    }))
    .sort((a, b) => b.games - a.games);

  return NextResponse.json({
    filters: { rival: rival || null, player: player || null },
    totalGames: ourPicks.length,
    roleBreakdown,
    heroBreakdown,
  });
}
