// lib/matchSync.js
//
// Keeps the normalized Match/Game/Pick tables (added for analytics) in sync
// with TeamData.matches (the JSON blob that remains the app's source of
// truth). Strategy: on every successful save, wipe and rebuild this team's
// rows from the JSON that was just saved.
//
// ── v2 — fixed a real production bug ──
// The first version looped `await tx.match.create({ data: { ..., games: {
// create: [...] } } })` once per match, inside a single interactive
// transaction. Each iteration was its own round-trip to the DB (Match
// insert + nested Game insert + nested Pick insert, all separate queries
// under the hood). For a team with a large match history this blew past
// the transaction's 20s timeout and Prisma killed it mid-way:
// `P2028 Transaction already closed`.
//
// Fix: build the full set of Match/Game/Pick rows in memory first (with
// IDs generated up front, since createMany doesn't return created rows),
// then write them with THREE createMany calls total instead of one
// create() per match. That's a fixed, small number of round-trips
// regardless of how many matches a team has — a few hundred matches and a
// few thousand matches cost roughly the same wall-clock time now.

import crypto from "node:crypto";
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

function applyStats(pickRows, gameStats, side) {
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

  // ── Build all rows in memory first, with IDs generated up front ──
  // (createMany doesn't return the created rows, so we can't get a
  // generated Game id back to attach Picks to it the usual Prisma way —
  // generating the id ourselves sidesteps that entirely.)
  const matchRows = [];
  const gameRows = [];
  const pickRows = [];

  for (const m of matches) {
    const matchId = crypto.randomUUID();
    matchRows.push({
      id: matchId,
      teamId,
      sourceId: String(m.id),
      rivalName: m.rivalName ?? null,
      category: m.category || "scrim",
      date: parseMatchDate(m.date),
      note: m.note ?? null,
    });

    const games = Array.isArray(m.games) && m.games.length > 0 ? m.games : [m];

    games.forEach((g, i) => {
      const gameId = crypto.randomUUID();
      gameRows.push({
        id: gameId,
        matchId,
        gameNo: g.gameNo ?? i + 1,
        result: g.result === "WIN" || g.result === "LOSE" ? g.result : "LOSE",
        durationMin: g.duration ? durationToMinutes(g.duration) : null,
        objectives: g.objectives ?? undefined,
      });

      let picks = [
        ...buildPickRows(g.ourBans, "our", true, customHeroes, roleOverrides),
        ...buildPickRows(g.enemyBans, "enemy", true, customHeroes, roleOverrides),
        ...buildPickRows(g.ourPicks, "our", false, customHeroes, roleOverrides),
        ...buildPickRows(g.enemyPicks, "enemy", false, customHeroes, roleOverrides),
      ];
      picks = applyStats(picks, g.gameStats, "our");
      picks = applyStats(picks, g.gameStats, "enemy");

      for (const p of picks) {
        pickRows.push({ id: crypto.randomUUID(), gameId, ...p });
      }
    });
  }

  // ── Write: delete + 3 bulk inserts, instead of N sequential creates ──
  // Kept as a single transaction for atomicity, but now it's a FIXED
  // number of queries (4) no matter how many matches there are, so it
  // can't time out the way the per-record loop did.
  await prisma.$transaction(
    [
      prisma.match.deleteMany({ where: { teamId } }), // cascades to Game/Pick
      ...(matchRows.length ? [prisma.match.createMany({ data: matchRows })] : []),
      ...(gameRows.length ? [prisma.game.createMany({ data: gameRows })] : []),
      ...(pickRows.length ? [prisma.pick.createMany({ data: pickRows })] : []),
    ],
    { timeout: 30000 }
  );
}
