import { prisma } from "@/lib/prisma";
import { syncMatchesToRelational } from "@/lib/matchSync";

// รัน syncMatchesToRelational แล้วจดผล (success/fail + เวลา) ลง MatchSyncStatus
// ไม่ throw — การจดสถานะพังต้องไม่ทำให้ save หลักพัง (เรียกจาก after() อยู่แล้ว)
export async function syncMatchesWithStatus(teamId, matches, customHeroes, roleOverrides) {
  const now = new Date();
  let error = null;
  try {
    await syncMatchesToRelational(teamId, matches, customHeroes, roleOverrides);
  } catch (err) {
    error = String(err?.message || err).slice(0, 500);
    console.error("matchSync error (non-fatal) for team", teamId, err);
  }
  try {
    const ok = error === null;
    await prisma.matchSyncStatus.upsert({
      where: { teamId },
      create: {
        teamId, lastAttemptAt: now, ok, error,
        lastSuccessAt: ok ? now : null,
        failCount: ok ? 0 : 1,
        matchCount: ok && Array.isArray(matches) ? matches.length : null,
      },
      update: {
        lastAttemptAt: now, ok, error,
        ...(ok
          ? { lastSuccessAt: now, failCount: 0, matchCount: Array.isArray(matches) ? matches.length : null }
          : { failCount: { increment: 1 } }),
      },
    });
  } catch (err) {
    console.error("matchSync status write error (non-fatal) for team", teamId, err);
  }
}
