// lib/scoreboardMatch.js
// ── Pure functions (no React / no server imports) ──
// แปลงผลที่ AI อ่านจากภาพสรุปผลแมตช์ → รูปแบบ gameStats ที่ UnifiedStatsEditor ใช้อยู่แล้ว
//   gameStats = { our: { [slotIdx]: {kills,deaths,assists,damage,damageTaken,gold} }, enemy: {...} }
// ใช้ index ของ slot เป็น key (เหมือนเดิม) จึงบันทึกได้แม้ไม่ได้กรอกชื่อผู้เล่น

import { HERO_DATA } from "./heroes.js";

export const STAT_FIELDS = ["kills", "deaths", "assists", "damage", "damageTaken", "gold"];

export function normHero(s) {
  return String(s ?? "").toLowerCase().replace(/[^a-z0-9ก-๙]/g, "");
}

const HERO_BY_NORM = new Map(HERO_DATA.map(h => [normHero(h.name), h.name]));

// ชื่อ hero ที่ AI อ่านมา → ชื่อมาตรฐานในระบบ (ไม่เจอ = null)
export function snapHero(name) {
  const n = normHero(name);
  if (!n) return null;
  if (HERO_BY_NORM.has(n)) return HERO_BY_NORM.get(n);
  // กันอ่านผิดเล็กน้อย: ยอมรับเมื่อเป็น prefix/ซับสตริงของชื่อเดียวเท่านั้น (ไม่กำกวม)
  const hits = [...HERO_BY_NORM.entries()].filter(([k]) => k.startsWith(n) || n.startsWith(k));
  return hits.length === 1 ? hits[0][1] : null;
}

// "12,345" → 12345 ; "12.5k" → 12500 ; ว่าง/อ่านไม่ได้ → undefined (ไม่เขียนทับช่องเดิม)
export function toStat(v) {
  if (v == null || v === "") return undefined;
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? Math.round(v) : undefined;
  const s = String(v).trim().toLowerCase().replace(/,/g, "");
  const m = s.match(/^(\d+(?:\.\d+)?)\s*(k)?$/);
  if (!m) return undefined;
  const n = Number(m[1]) * (m[2] ? 1000 : 1);
  return Number.isFinite(n) ? Math.round(n) : undefined;
}

function cleanRow(r) {
  const out = {};
  for (const f of STAT_FIELDS) {
    const v = toStat(r?.[f]);
    if (v !== undefined) out[f] = v;
  }
  return out;
}

// จับคู่แถวของทีมหนึ่ง (rows จากภาพ) เข้ากับ slot (picks) ของฝั่งนั้น
// 1) จับตามชื่อ hero ก่อน  2) แถวที่เหลือ → slot ที่เหลือตามลำดับ
function assignTeam(rows, picks) {
  const slots = (picks || []).map((p, i) => ({ i, hero: p?.hero?.name ? normHero(p.hero.name) : "", used: false, has: !!(p?.hero || p?.player) }));
  const result = {}; const warnings = []; const leftovers = [];
  (rows || []).forEach(row => {
    const hero = snapHero(row?.hero);
    const slot = hero && slots.find(s => !s.used && s.hero === normHero(hero));
    if (slot) { slot.used = true; result[slot.i] = cleanRow(row); }
    else leftovers.push({ row, hero });
  });
  leftovers.forEach(({ row, hero }) => {
    const slot = slots.find(s => !s.used && s.has);
    if (!slot) { warnings.push(`ไม่มี slot ว่างให้ ${hero || row?.hero || "แถวที่ไม่รู้จัก"}`); return; }
    slot.used = true; result[slot.i] = cleanRow(row);
    warnings.push(`${hero || row?.hero || "?"} จับคู่ตามลำดับ (ไม่ตรงกับ hero ที่เลือกไว้) — โปรดตรวจ`);
  });
  return { stats: result, warnings, matched: Object.keys(result).length };
}

function heroOverlap(rows, picks) {
  const set = new Set((picks || []).map(p => normHero(p?.hero?.name)).filter(Boolean));
  return (rows || []).reduce((n, r) => n + (set.has(normHero(snapHero(r?.hero))) ? 1 : 0), 0);
}

/**
 * @param {{teams:[{rows:Array},{rows:Array}]}} parsed  ผลจาก /api/scoreboard-ocr
 * @param {{ourPicks:Array, enemyPicks:Array, ourIsFirst?:boolean|null}} ctx
 *   ourIsFirst: true = ทีมแรกในภาพ (บน/ซ้าย) คือทีมเรา, false = ทีมที่สอง, null = เดาจากชื่อ hero
 */
export function mapScoreboard(parsed, { ourPicks, enemyPicks, ourIsFirst = null }) {
  const [t1, t2] = [parsed?.teams?.[0]?.rows || [], parsed?.teams?.[1]?.rows || []];
  let first = ourIsFirst;
  let autoNote = null;
  if (first == null) {
    const a = heroOverlap(t1, ourPicks) + heroOverlap(t2, enemyPicks);
    const b = heroOverlap(t2, ourPicks) + heroOverlap(t1, enemyPicks);
    if (a === b) { first = true; autoNote = "เดาฝั่งทีมไม่ได้จากชื่อ hero — สมมติว่าทีมแรกในภาพคือทีมเรา"; }
    else first = a > b;
  }
  const ours = assignTeam(first ? t1 : t2, ourPicks);
  const enemy = assignTeam(first ? t2 : t1, enemyPicks);
  return {
    gameStats: { our: ours.stats, enemy: enemy.stats },
    ourIsFirst: first,
    matched: { our: ours.matched, enemy: enemy.matched },
    warnings: [...(autoNote ? [autoNote] : []), ...ours.warnings, ...enemy.warnings],
  };
}

// รวมผลที่อ่านได้เข้ากับค่าที่กรอกไว้แล้ว (ช่องที่อ่านไม่ได้ = คงค่าเดิม)
export function mergeStats(current, incoming) {
  const out = { our: { ...(current?.our || {}) }, enemy: { ...(current?.enemy || {}) } };
  for (const side of ["our", "enemy"]) {
    for (const [idx, vals] of Object.entries(incoming?.[side] || {})) {
      out[side][idx] = { ...(out[side][idx] || {}), ...vals };
    }
  }
  return out;
}

/**
 * จับคู่แบบ "ผู้ใช้เลือกเอง": แต่ละแถวในภาพ → slot ที่เลือก (ลำดับแถวในภาพไม่เท่ากับลำดับ slot ในเว็บ
 * และอ่านชื่อฮีโร่จากภาพไม่ได้ จึงให้ผู้ใช้ยืนยันการจับคู่ในหน้าตัวอย่าง)
 * @param parsed        { teams:[{rows},{rows}] }  ทีมแรก = ซ้าย/น้ำเงิน, ทีมที่สอง = ขวา/แดง
 * @param ourIsFirst    true = ทีมแรกในภาพคือทีมเรา
 * @param mapFirst      [slotIdx|-1 ต่อแถว] ของทีมแรกในภาพ (-1 = ข้ามแถวนี้)
 * @param mapSecond     เช่นเดียวกัน สำหรับทีมที่สอง
 * @returns { gameStats:{our,enemy}, duplicates:[ข้อความเตือน] }
 */
export function buildStatsFromMapping(parsed, ourIsFirst, mapFirst, mapSecond) {
  const out = { our: {}, enemy: {} };
  const duplicates = [];
  const teams = [
    { rows: parsed?.teams?.[0]?.rows || [], map: mapFirst || [], side: ourIsFirst ? "our" : "enemy" },
    { rows: parsed?.teams?.[1]?.rows || [], map: mapSecond || [], side: ourIsFirst ? "enemy" : "our" },
  ];
  for (const t of teams) {
    const used = new Map();
    t.rows.forEach((row, i) => {
      const slot = t.map[i];
      if (slot == null || slot < 0) return;
      if (used.has(slot)) duplicates.push(`${t.side === "our" ? "ทีมเรา" : "คู่แข่ง"}: slot ${slot + 1} ถูกเลือกซ้ำ (แถว ${used.get(slot) + 1} และ ${i + 1}) — แถวหลังจะทับแถวแรก`);
      used.set(slot, i);
      out[t.side][slot] = cleanRow(row);
    });
  }
  return { gameStats: out, duplicates };
}
