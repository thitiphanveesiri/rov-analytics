// lib/matchSync.js
//
// Keeps the normalized Match/Game/Pick tables (added for analytics) in sync
// with TeamData.matches (the JSON blob that remains the app's source of
// truth). Strategy: on every successful save, wipe and rebuild this team's
// rows from the JSON that was just saved.
//
// Why "wipe and rebuild" instead of diffing old vs new:
// - Match/game IDs on the client are `Date.now()`-based and can shift when
//   users edit/delete/reorder — diffing that reliably is genuinely harder
//   than it looks and easy to get subtly wrong (ghost rows, orphaned picks).
// - A team's match history is a few hundred to a few thousand rows at most
//   (this is a scrim/tournament tracker, not a firehose) — a full rebuild
//   inside one transaction is milliseconds, not a performance concern.
// - It's trivially correct: the relational tables are *always* an exact
//   mirror of the JSON that was last saved, by construction. No drift.
//
// This runs in a Prisma transaction so a crash mid-rebuild can't leave a
// team with half-written match history.

import { prisma } from "./prisma.js";
import { resolveHeroRole } from "./heroes.js";
import { durationToMinutes } from "./duration.js";

function heroName(heroRefOrString) {
  if (!heroRefOrString) return null;
  if (typeof heroRefOrString === "string") return heroRefOrString;
  return heroRefOrString.name || null;
}

function buildPickRows(picks, side, isBan, customHeroes, roleOverrides) {
  if (!Array.isArray(picks)) return [];
  return picks
    .map((slot, idx) => {
      const hero = isBan ? slot : slot?.hero;
      const name = heroName(hero);
      if (!name) return null;
      return {
        side,
        isBan,
        slotIdx: idx,
        hero: name,
        role: resolveHeroRole(name, customHeroes, roleOverrides),
        player: isBan ? null : (slot?.player || null),
      };
    })
    .filter(Boolean);
}

function buildStatRows(pickRows, gameStats, side) {
  if (!gameStats?.[side]) return pickRows;
  return pickRows.map((row) => {
    if (row.side !== side || row.isBan) return row;
    const stat = gameStats[side][row.slotIdx];
    if (!stat) return row;
    return {
      ...row,
      kills: stat.kills ?? null,
      deaths: stat.deaths ?? null,
      assists: stat.assists ?? null,
      damage: stat.damage ?? null,
      gold: stat.gold ?? null,
    };
  });
}

function toGameRow(g, gameNo, customHeroes, roleOverrides) {
  let picks = [
    ...buildPickRows(g.ourBans, "our", true, customHeroes, roleOverrides),
    ...buildPickRows(g.enemyBans, "enemy", true, customHeroes, roleOverrides),
    ...buildPickRows(g.ourPicks, "our", false, customHeroes, roleOverrides),
    ...buildPickRows(g.enemyPicks, "enemy", false, customHeroes, roleOverrides),
  ];
  picks = buildStatRows(picks, g.gameStats, "our");
  picks = buildStatRows(picks, g.gameStats, "enemy");

  return {
    gameNo: g.gameNo ?? gameNo,
    result: g.result === "WIN" || g.result === "LOSE" ? g.result : "LOSE",
    durationMin: g.duration ? durationToMinutes(g.duration) : null,
    objectives: g.objectives ?? undefined,
    picks: { create: picks },
  };
}

function parseMatchDate(dateStr) {
  // Match.date in TeamData is a localized Thai date string (e.g. "7 ก.ค. 2569")
  // produced by toLocaleDateString("th-TH", ...) — not directly parseable by
  // `new Date()`. We fall back to "now" rather than throwing, since this
  // table is a derived analytics mirror, not the record of truth; a slightly
  // wrong bucket date is fine, a failed save is not.
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Rebuilds Match/Game/Pick rows for one team from the matches array that
 * was just saved to TeamData. Call this AFTER the TeamData upsert succeeds.
 *
 * @param {string} teamId
 * @param {Array} matches - TeamData.matches (post-validation)
 * @param {Array} customHeroes - TeamData.customHeroes
 * @param {Record<string,string>} roleOverrides - TeamData.roleOverrides
 */
export async function syncMatchesToRelational(teamId, matches = [], customHeroes = [], roleOverrides = {}) {
  if (!Array.isArray(matches)) return;

  await prisma.$transaction(async (tx) => {
    // Wipe this team's mirror, then rebuild. Cascade deletes handle Game/Pick.
    await tx.match.deleteMany({ where: { teamId } });

    for (const m of matches) {
      const games = Array.isArray(m.games) && m.games.length > 0
        ? m.games
        : [m]; // flat single-game match: treat the match itself as game #1

      await tx.match.create({
        data: {
          teamId,
          sourceId: String(m.id),
          rivalName: m.rivalName ?? null,
          category: m.category || "scrim",
          date: parseMatchDate(m.date),
          note: m.note ?? null,
          games: {
            create: games.map((g, i) => toGameRow(g, i + 1, customHeroes, roleOverrides)),
          },
        },
      });
    }
  }, { timeout: 20000 });
}
