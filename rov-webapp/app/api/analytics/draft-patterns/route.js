import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ── GET /api/analytics/draft-patterns?rival=TeamName ──
//
// "Draft Pattern Alert" — the feature discussed earlier as a BA/product
// deliverable, now backed by the normalized Pick table instead of scanning
// the JSON blob client-side on every render.
//
// Returns, for the given rival (or all rivals if omitted):
//   - topBans:  hero -> ban count + ban rate, sorted desc
//   - topPicks: hero -> pick count + win rate FOR US when we picked it into
//               games against this rival, sorted by pick count
//   - firstPickTendency: which heroes this rival tends to pick/ban in the
//     early slots (slotIdx 0-1), since first picks/bans reveal strategic
//     priorities more than late-game picks do
//
// All aggregation happens in SQL via Prisma groupBy — this is exactly the
// kind of query that was painful (client-side array scanning) before the
// Pick table existed.
export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "ไม่ได้ login" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { teamId: true },
  });
  if (!user?.teamId) return NextResponse.json({ error: "ยังไม่ได้เข้าทีม" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const rival = searchParams.get("rival"); // optional filter

  const matchWhere = { teamId: user.teamId, ...(rival ? { rivalName: rival } : {}) };

  // Enemy bans — what the rival tends to take away from us
  const enemyBans = await prisma.pick.groupBy({
    by: ["hero"],
    where: { isBan: true, side: "enemy", game: { match: matchWhere } },
    _count: { hero: true },
  });

  // Enemy picks — what the rival tends to play, and how we fared against it
  const enemyPickRows = await prisma.pick.findMany({
    where: { isBan: false, side: "enemy", game: { match: matchWhere } },
    select: { hero: true, game: { select: { result: true } } },
  });

  const enemyPickAgg = {};
  for (const row of enemyPickRows) {
    const h = row.hero;
    if (!enemyPickAgg[h]) enemyPickAgg[h] = { picks: 0, ourWins: 0 };
    enemyPickAgg[h].picks++;
    // game.result is WIN/LOSE from OUR perspective, so if the enemy picked
    // this hero and we still won, that's a data point on how beatable it is.
    if (row.game.result === "WIN") enemyPickAgg[h].ourWins++;
  }

  const totalGames = await prisma.game.count({ where: { match: matchWhere } });

  // First-slot tendency: bans/picks in slotIdx 0-1 reveal priority targets
  const earlyEnemyActions = await prisma.pick.findMany({
    where: {
      side: "enemy",
      slotIdx: { lte: 1 },
      game: { match: matchWhere },
    },
    select: { hero: true, isBan: true },
  });
  const earlyTally = {};
  for (const row of earlyEnemyActions) {
    const key = row.hero;
    if (!earlyTally[key]) earlyTally[key] = { bans: 0, picks: 0 };
    if (row.isBan) earlyTally[key].bans++; else earlyTally[key].picks++;
  }

  const topBans = enemyBans
    .map((b) => ({
      hero: b.hero,
      banCount: b._count.hero,
      banRate: totalGames ? Math.round((b._count.hero / totalGames) * 100) : 0,
    }))
    .sort((a, b) => b.banCount - a.banCount)
    .slice(0, 15);

  const topPicks = Object.entries(enemyPickAgg)
    .map(([hero, v]) => ({
      hero,
      pickCount: v.picks,
      pickRate: totalGames ? Math.round((v.picks / totalGames) * 100) : 0,
      ourWinRateWhenPicked: v.picks ? Math.round((v.ourWins / v.picks) * 100) : null,
    }))
    .sort((a, b) => b.pickCount - a.pickCount)
    .slice(0, 15);

  const firstPickTendency = Object.entries(earlyTally)
    .map(([hero, v]) => ({ hero, earlyBans: v.bans, earlyPicks: v.picks }))
    .sort((a, b) => (b.earlyBans + b.earlyPicks) - (a.earlyBans + a.earlyPicks))
    .slice(0, 10);

  return NextResponse.json({
    rival: rival || "all",
    sampleSize: totalGames,
    topBans,
    topPicks,
    firstPickTendency,
  });
}
