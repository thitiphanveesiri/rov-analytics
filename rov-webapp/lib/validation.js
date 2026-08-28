// lib/validation.js
// Zod schemas for validating client-submitted data before it touches the
// database. This does NOT change the data model — TeamData's fields stay
// as loosely-typed JSON — it just makes sure "loosely typed" doesn't mean
// "anything goes". Without this, a bug in the frontend (or a malicious
// request straight to the API, once this app is opened to other teams)
// can write arbitrary shapes into TeamData that silently break every page
// that reads app.matches / app.roster / etc.
//
// Design choices:
// - Permissive on deeply-nested optional gameplay fields (hero objects,
//   per-game stats) since that shape is UI-driven and evolves; the goal is
//   to catch structurally wrong data (strings where arrays are expected,
//   giant blobs, wrong types), not to police every field.
// - Strict on sizes for anything that lands in the DB as free text, to
//   avoid abuse (e.g. someone pasting 5MB into a "note" field).

import { z } from "zod";

const MAX_TEXT = 2000;
const MAX_SHORT_TEXT = 200;

const heroRefSchema = z.object({
  name: z.string().max(MAX_SHORT_TEXT),
  role: z.string().max(MAX_SHORT_TEXT).optional(),
  img: z.string().max(MAX_SHORT_TEXT).optional(),
  _custom: z.boolean().optional(),
}).nullable();

const pickSlotSchema = z.object({
  role: z.string().max(MAX_SHORT_TEXT).optional(),
  hero: heroRefSchema.optional(),
  player: z.string().max(MAX_SHORT_TEXT).optional().default(""),
}).passthrough();

const statLineSchema = z.object({
  kills: z.number().optional(),
  deaths: z.number().optional(),
  assists: z.number().optional(),
  damage: z.number().optional(),
  damageTaken: z.number().optional(),
  gold: z.number().optional(),
}).passthrough();

const gameStatsSchema = z.object({
  our: z.record(z.string(), statLineSchema).optional().default({}),
  enemy: z.record(z.string(), statLineSchema).optional().default({}),
}).optional();

const singleGameSchema = z.object({
  gameNo: z.number().optional(),
  ourSide: z.enum(["blue", "red"]).optional(),
  result: z.enum(["WIN", "LOSE"]),
  ourScore: z.union([z.number(), z.string()]).optional(),
  enemyScore: z.union([z.number(), z.string()]).optional(),
  duration: z.union([z.string(), z.number()]).optional().nullable(),
  note: z.string().max(MAX_TEXT).optional().nullable(),
  ourBans: z.array(heroRefSchema).max(10).optional().default([]),
  enemyBans: z.array(heroRefSchema).max(10).optional().default([]),
  ourPicks: z.array(pickSlotSchema).max(10).optional().default([]),
  enemyPicks: z.array(pickSlotSchema).max(10).optional().default([]),
  gameStats: gameStatsSchema,
  objectives: z.record(z.string(), z.any()).optional(),
}).passthrough();

const matchSchema = z.object({
  id: z.union([z.number(), z.string()]),
  date: z.string().max(MAX_SHORT_TEXT),
  category: z.string().max(MAX_SHORT_TEXT).optional().default("scrim"),
  rivalName: z.string().max(MAX_SHORT_TEXT).optional().nullable(),
  boType: z.string().max(20).optional(),
  patch: z.string().max(50).optional(),
  note: z.string().max(MAX_TEXT).optional().nullable(),
  // BO-series matches carry `games`; single-game matches carry the fields
  // of singleGameSchema flattened onto the match itself. Both are accepted.
  games: z.array(singleGameSchema).max(20).optional(),
}).merge(singleGameSchema.partial()).passthrough();

const rivalSchema = z.object({
  id: z.union([z.number(), z.string()]),
  name: z.string().max(MAX_SHORT_TEXT),
}).passthrough();

const scheduleSchema = z.object({
  id: z.union([z.number(), z.string()]),
  date: z.string().max(MAX_SHORT_TEXT).optional(),
  time: z.string().max(20).optional(),
  rival: z.string().max(MAX_SHORT_TEXT).optional(),
  tournament: z.string().max(MAX_SHORT_TEXT).optional(),
  note: z.string().max(MAX_TEXT).optional(),
}).passthrough();

const videoSchema = z.object({
  id: z.union([z.number(), z.string()]),
  title: z.string().max(MAX_SHORT_TEXT).optional(),
  url: z.string().max(1000).optional(),
  rival: z.string().max(MAX_SHORT_TEXT).optional(),
  date: z.string().max(MAX_SHORT_TEXT).optional(),
  tags: z.array(z.string().max(50)).optional(),
  note: z.string().max(MAX_TEXT).optional(),
  type: z.string().max(50).optional(),
}).passthrough();

const practiceAssignmentSchema = z.object({
  id: z.union([z.number(), z.string()]),
  player: z.string().max(MAX_SHORT_TEXT).optional(),
  title: z.string().max(MAX_SHORT_TEXT).optional(),
  note: z.string().max(MAX_TEXT).optional(),
  dueDate: z.string().max(MAX_SHORT_TEXT).optional().nullable(),
  done: z.boolean().optional(),
  createdAt: z.string().optional(),
  createdBy: z.string().max(MAX_SHORT_TEXT).optional(),
}).passthrough();

const scoutMatchSchema = z.object({
  id: z.union([z.number(), z.string()]),
  date: z.string().max(MAX_SHORT_TEXT).optional(),
  teamA: z.string().max(MAX_SHORT_TEXT).optional(),
  teamB: z.string().max(MAX_SHORT_TEXT).optional(),
}).passthrough();

// Top-level payload for PUT /api/data — every field optional because the
// client always sends the *full* app state object, but we still don't want
// to assume it always includes every key.
export const teamDataSchema = z.object({
  matches: z.array(matchSchema).max(5000).optional(),
  rivals: z.array(rivalSchema).max(1000).optional(),
  roster: z.array(z.string().max(MAX_SHORT_TEXT)).max(50).optional(),
  enemyRosters: z.record(z.string(), z.array(z.string().max(MAX_SHORT_TEXT))).optional(),
  scoutMatches: z.array(scoutMatchSchema).max(5000).optional(),
  playerPhotos: z.record(z.string(), z.string().max(2000).nullable()).optional(),
  heroPhotos: z.record(z.string(), z.string().max(2000).nullable()).optional(),
  customHeroes: z.array(z.object({
    name: z.string().max(MAX_SHORT_TEXT),
    role: z.string().max(MAX_SHORT_TEXT).optional(),
    img: z.string().max(MAX_SHORT_TEXT).optional(),
  }).passthrough()).max(200).optional(),
  // roleOverrides[heroName] used to be a single role string only.
  // RovApp.js now supports assigning a hero multiple roles at once (e.g.
  // Rouie as both "เมจ" and "ซัพ", so it shows up under either filter in
  // Live Draft / Rival scouting), sending an array instead. Accept both
  // shapes here so old single-string overrides already saved for a team
  // keep validating fine, while new multi-role saves aren't rejected.
  roleOverrides: z.record(
    z.string(),
    z.union([
      z.string().max(MAX_SHORT_TEXT),
      z.array(z.string().max(MAX_SHORT_TEXT)).max(10),
    ])
  ).optional(),
  videos: z.array(videoSchema).max(5000).optional(),
  teamLogo: z.string().max(2000).nullable().optional(),
  rivalLogos: z.record(z.string(), z.string().max(2000)).optional(),
  schedules: z.array(scheduleSchema).max(2000).optional(),
  patchInfo: z.object({
    version: z.string().max(50).optional(),
    notes: z.string().max(MAX_TEXT).optional(),
    updatedAt: z.string().nullable().optional(),
  }).passthrough().optional(),
  heroTiers: z.record(z.string(), z.string().max(10)).optional(),
  practiceAssignments: z.array(practiceAssignmentSchema).max(2000).optional(),
}).passthrough(); // don't reject the whole save if the frontend adds a field we haven't modeled yet

/**
 * Validates a PUT /api/data body.
 * Returns { success: true, data } or { success: false, error } where error
 * is a compact, log-friendly string (Zod's flatten output is verbose).
 */
export function validateTeamData(body) {
  const result = teamDataSchema.safeParse(body);
  if (result.success) return { success: true, data: result.data };
  const flat = result.error.flatten();
  return { success: false, error: flat };
}
