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
//
// ── URL fields: validated + BACKWARD COMPATIBLE (see httpUrlOrNull) ──
// Every field that gets rendered as an image/logo/video source (teamLogo,
// rivalLogos, playerPhotos, heroPhotos, hero .img, video .url) previously
// accepted ANY string up to a length cap — no scheme check at all. That
// meant a saved value like "javascript:...", "data:...", or (concretely,
// a real bug we found) a client-side-only "blob:..." URL from the local
// video-attach flow could get persisted, even though none of those are
// safe/useful to store server-side (blob: URLs in particular are only
// valid in the ONE browser tab that created them — saving one to the DB
// produces a link that 404s for every other viewer, and even for the same
// viewer after a reload; this was a pre-existing product bug in the
// "attach a local video file" feature in VideoLibrary.js, worth knowing
// about separately from this validation fix).
//
// The tricky part: the client always re-sends the FULL app state on every
// save (see lib/storage.js), including fields it isn't touching right now.
// If a team already has a bad value sitting in the DB from before this
// validation existed, a naive `.refine()` would reject the ENTIRE save the
// very next time ANYTHING autosaves — even a completely unrelated edit —
// until someone manually finds and fixes that one bad field. That is a
// worse outcome than the hole we're closing. `httpUrlOrNull()` uses Zod's
// `.catch(null)` instead: a value that fails the check is silently
// replaced with `null` rather than failing the whole parse. The user loses
// that one bad image/logo/video link (which was already broken/unsafe to
// begin with) but every other field in the same save still goes through.

import { z } from "zod";

const MAX_TEXT = 2000;
const MAX_SHORT_TEXT = 200;
const MAX_URL = 2000;

// A URL field that's either null/absent, or a genuine http(s) URL. Anything
// else (javascript:, data:, blob:, vbscript:, a bare non-URL string, or
// just too long) is silently coerced to null instead of rejecting the
// whole save — see the file-level comment above for why.
function httpUrlOrNull(max = MAX_URL) {
  return z
    .string()
    .max(max)
    .refine((v) => /^https?:\/\//i.test(v), {
      message: "ต้องเป็น URL ที่ขึ้นต้นด้วย http:// หรือ https://",
    })
    .nullable()
    .catch(null);
}

const heroRefSchema = z.object({
  name: z.string().max(MAX_SHORT_TEXT),
  role: z.string().max(MAX_SHORT_TEXT).optional(),
  img: httpUrlOrNull().optional(),
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

// ── objectives: bounded instead of z.any() ──
// Previously z.record(z.string(), z.any()) — a single objectives value
// could be an arbitrarily large/deeply-nested blob with no size check at
// all (still bounded by the overall request-body byte cap in
// app/api/data/route.js, but nothing stopped one game's objectives field
// from using most of that budget on its own). Bounded to the shapes this
// field actually needs (counts, booleans, short labels) plus a shallow
// array-of-primitives case for things like "which turrets fell, in order".
const objectiveValueSchema = z.union([
  z.string().max(200),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.union([z.string().max(200), z.number(), z.boolean()])).max(50),
]);
const objectivesSchema = z.record(z.string().max(100), objectiveValueSchema).optional();

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
  objectives: objectivesSchema,
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
  // เดิมเป็น z.string().max(1000) เฉยๆ ไม่เช็ค scheme เลย — ดู httpUrlOrNull
  // ด้านบนว่าทำไมต้องเช็ค และทำไมใช้ .catch(null) แทนการ reject ทั้ง save
  url: httpUrlOrNull(1000).optional(),
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

// ── Whiteboard fields ──
// Previously this section only bounded array length + left every element as
// unstructured passthrough, because TacticalWhiteboard.js hadn't been shared
// yet. It has now — the board only ever creates 4 element shapes (confirmed
// by reading the exact drawing code, not guessed): "path" (a pen stroke:
// an array of {x,y} points), "arrow" (x1,y1 -> x2,y2), "text" (x,y + string),
// and "hero" (x,y + hero name placed on the board). Formations are named,
// saved snapshots: { id, name, elements: [...same 4 shapes], mapUrl, time }.
//
// Same backward/forward-compat philosophy as the URL fields: an element
// whose `type` IS one of these 4 known values gets REAL validation (bounded
// point counts, sizes, etc.) — if it doesn't match its own shape, that's
// either a bug or an attack, not legitimate data, so it's replaced with an
// inert stub via `.catch()` rather than rejecting the whole save. An element
// with some OTHER `type` (a future tool this board doesn't have yet) is
// still accepted loosely (passthrough) so this validation doesn't have to
// be updated every time a drawing tool is added — it just doesn't get the
// same strict bounds a known type does.
const MAX_WHITEBOARD_TEXT = 5000; // a text label on the board can run longer than MAX_SHORT_TEXT
const XY = z.number().finite();
const WB_COLOR = z.string().max(30);
const WB_SIZE = z.number().min(0).max(200);

const pathElementSchema = z.object({
  type: z.literal("path"),
  // เส้นปากกาเดียวสะสมจุดจาก pointer-move ได้เยอะ — 5000 จุดกว้างพอสำหรับเส้นยาวๆ ในการวาดจริง
  points: z.array(z.object({ x: XY, y: XY }).passthrough()).max(5000),
  color: WB_COLOR,
  size: WB_SIZE,
}).passthrough();

const arrowElementSchema = z.object({
  type: z.literal("arrow"),
  x1: XY, y1: XY, x2: XY, y2: XY,
  color: WB_COLOR,
  size: WB_SIZE,
}).passthrough();

const textElementSchema = z.object({
  type: z.literal("text"),
  x: XY, y: XY,
  text: z.string().max(MAX_WHITEBOARD_TEXT),
  color: WB_COLOR,
  size: WB_SIZE,
}).passthrough();

const heroElementSchema = z.object({
  type: z.literal("hero"),
  x: XY, y: XY,
  name: z.string().max(MAX_SHORT_TEXT),
  team: z.string().max(20).optional(),
  r: z.number().min(0).max(500).optional(),
}).passthrough();

const knownWhiteboardElementSchema = z.union([
  pathElementSchema, arrowElementSchema, textElementSchema, heroElementSchema,
]);
// องค์ประกอบที่ `type` ไม่ใช่ 4 ชนิดที่รู้จัก (เครื่องมือใหม่ในอนาคต) — ปล่อยผ่านหลวมๆ (forward-compat)
// แต่ต้องไม่ใช่ทางหนีของ "path/arrow/text/hero" ที่ shape ผิด (นั่นต้องพัง แล้วโดน .catch() ด้านล่างแทน
// ไม่ใช่หลุดมาไม่ถูกจำกัดอะไรเลยทางนี้)
const futureWhiteboardElementSchema = z
  .object({ type: z.string().max(50).optional() })
  .passthrough()
  .refine((el) => !["path", "arrow", "text", "hero"].includes(el.type), {
    message: "known element type failed its own shape validation",
  });

const whiteboardElementSchema = z
  .union([knownWhiteboardElementSchema, futureWhiteboardElementSchema])
  .catch({ type: "unknown" }); // malformed known-type element -> inert stub, not a rejected save

const whiteboardFormationSchema = z.object({
  id: z.union([z.number(), z.string()]).optional(),
  name: z.string().max(MAX_SHORT_TEXT).optional(),
  elements: z.array(whiteboardElementSchema).max(3000).optional(),
  mapUrl: httpUrlOrNull().nullable().optional(),
  time: z.string().max(MAX_SHORT_TEXT).optional(),
  createdAt: z.string().optional(),
}).passthrough();

// Top-level payload for PUT /api/data — every field optional because the
// client always sends the *full* app state object, but we still don't want
// to assume it always includes every key.
export const teamDataSchema = z.object({
  matches: z.array(matchSchema).max(5000).optional(),
  rivals: z.array(rivalSchema).max(1000).optional(),
  roster: z.array(z.string().max(MAX_SHORT_TEXT)).max(50).optional(),
  enemyRosters: z.record(z.string(), z.array(z.string().max(MAX_SHORT_TEXT)).max(50))
    // จำกัดจำนวน "ทีมคู่แข่ง" ที่มี roster เก็บไว้ด้วย — z.record() เองไม่มีวิธีจำกัดจำนวน key
    // ในตัว (แค่ตรวจ value ของแต่ละ key) ต้องเช็คแยกด้วย .refine()
    .refine((obj) => Object.keys(obj).length <= 1000, {
      message: "enemyRosters มีจำนวนทีมมากเกินไป",
    })
    .optional(),
  scoutMatches: z.array(scoutMatchSchema).max(5000).optional(),
  playerPhotos: z.record(z.string(), httpUrlOrNull()).optional(),
  heroPhotos: z.record(z.string(), httpUrlOrNull()).optional(),
  customHeroes: z.array(z.object({
    name: z.string().max(MAX_SHORT_TEXT),
    role: z.string().max(MAX_SHORT_TEXT).optional(),
    img: httpUrlOrNull().optional(),
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
  teamLogo: httpUrlOrNull().nullable().optional(),
  rivalLogos: z.record(z.string(), httpUrlOrNull()).optional(),
  schedules: z.array(scheduleSchema).max(2000).optional(),
  patchInfo: z.object({
    version: z.string().max(50).optional(),
    notes: z.string().max(MAX_TEXT).optional(),
    updatedAt: z.string().nullable().optional(),
  }).passthrough().optional(),
  heroTiers: z.record(z.string(), z.string().max(10)).optional(),
  practiceAssignments: z.array(practiceAssignmentSchema).max(2000).optional(),
  whiteboardElements: z.array(whiteboardElementSchema).max(3000).optional(),
  whiteboardFormations: z.array(whiteboardFormationSchema).max(500).optional(),
  whiteboardMapUrl: httpUrlOrNull().nullable().optional(),
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
