import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ── GET /api/analytics/patch-timeline ──
//
// Win rate over time, bucketed by patch version — answers "did we adapt to
// the meta after patch X, or did our win rate drop and stay dropped?"
//
// Requires at least one row in PatchVersion (see /api/admin/patch-versions)
// to have something to bucket by. If none exist yet, returns everything
// under a single "unknown" bucket so the endpoint is still useful (e.g. to
// show total win rate over time) rather than erroring out.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "ไม่ได้ login" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { teamId: true },
  });
  if (!user?.teamId) return NextResponse.json({ error: "ยังไม่ได้เข้าทีม" }, { status: 403 });

  const [versions, matches] = await Promise.all([
    prisma.patchVersion.findMany({
      where: { teamId: user.teamId },
      orderBy: { effectiveFrom: "asc" },
    }),
    prisma.match.findMany({
      where: { teamId: user.teamId },
      select: { date: true, games: { select: { result: true } } },
      orderBy: { date: "asc" },
    }),
  ]);

  // Flatten to one row per game, since a BO series match spans multiple
  // games that could in theory straddle a patch boundary (rare, but the
  // per-game date granularity keeps the bucket assignment correct).
  const games = matches.flatMap((m) => m.games.map((g) => ({ date: m.date, result: g.result })));

  function bucketFor(date) {
    if (versions.length === 0) return "unknown";
    // Find the last patch version whose effectiveFrom <= this game's date
    let match = null;
    for (const v of versions) {
      if (v.effectiveFrom <= date) match = v;
      else break;
    }
    return match ? match.version : "pre-" + versions[0].version;
  }

  const buckets = {};
  for (const g of games) {
    const key = bucketFor(g.date);
    if (!buckets[key]) buckets[key] = { games: 0, wins: 0 };
    buckets[key].games++;
    if (g.result === "WIN") buckets[key].wins++;
  }

  // Order buckets chronologically using each version's effectiveFrom,
  // falling back to insertion order for "unknown"/"pre-*" buckets.
  const orderIndex = new Map(versions.map((v, i) => [v.version, i]));
  const timeline = Object.entries(buckets)
    .map(([version, v]) => ({
      version,
      games: v.games,
      winRate: v.games ? Math.round((v.wins / v.games) * 100) : 0,
    }))
    .sort((a, b) => (orderIndex.get(a.version) ?? -1) - (orderIndex.get(b.version) ?? -1));

  return NextResponse.json({
    hasPatchHistory: versions.length > 0,
    versions,
    timeline,
  });
}
