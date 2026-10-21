"use client";
import { matchTime } from "@/lib/matchTime";



// ── parse a patch's effectiveFrom date safely, avoiding a timezone bug ──
// effectiveFrom is entered as a bare date like "2026-08-24" (whatever an
// <input type="date"> gives you). `new Date("2026-08-24")` parses that as
// UTC MIDNIGHT — not midnight in the team's own timezone. For a team in
// Thailand (UTC+7), that's a 7-hour gap: a match saved anywhere between
// 00:00–07:00 Thai time on the patch's actual start date has a UTC
// timestamp that's still on the PREVIOUS calendar day, so it silently
// gets sorted into the previous patch's bucket instead of the new one —
// even though by the team's own clock, it's clearly a "new patch" match.
// Building the Date from (year, month, day) components instead always
// uses the LOCAL timezone of whoever's browser runs this, matching what
// a coach actually means by "this patch went live on this calendar day."
// Only applies this special-case to bare YYYY-MM-DD strings — anything
// that already carries time/timezone info (e.g. a full ISO timestamp) is
// left alone and parsed normally, since it's already unambiguous.
function parsePatchEffectiveFrom(dateStr) {
  if (typeof dateStr !== "string") return new Date(dateStr);
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const [, y, mo, d] = m;
    return new Date(Number(y), Number(mo) - 1, Number(d));
  }
  return new Date(dateStr);
}

export function filterMatchesByPatch(matches, patchVersions, selectedPatch) {
  if (selectedPatch === "all" || !patchVersions.length) return matches;
  const { from, to } = resolvePatchWindow(patchVersions, selectedPatch);
  if (from === null) return matches; // เผื่อ patch ที่เลือกไว้โดนลบไปแล้ว
  return matches.filter(m => { const t = matchTime(m); return t >= from && t < to; });
}

// ── ดึงช่วงเวลา [from, to) ของ patch ที่เลือกไว้ ──
// แยกออกมาจาก filterMatchesByPatch เดิม เพื่อให้ roster membership filtering
// (isMembershipActiveForPatch ด้านล่าง) ใช้สูตรคำนวณเดียวกันเป๊ะ ไม่ต้องเขียนซ้ำ
// คืน { from:null, to:null } ถ้า resolve ไม่ได้ (patch ที่เลือกไว้ถูกลบไปแล้ว)
function resolvePatchWindow(patchVersions, selectedPatch) {
  if (!patchVersions.length) return { from: null, to: null };
  const sorted = [...patchVersions].sort((a,b) => parsePatchEffectiveFrom(a.effectiveFrom) - parsePatchEffectiveFrom(b.effectiveFrom));

  let from, to = Infinity;
  if (selectedPatch === "current") {
    from = parsePatchEffectiveFrom(sorted[sorted.length-1].effectiveFrom).getTime();
  } else {
    const idx = sorted.findIndex(v => v.version === selectedPatch);
    if (idx === -1) return { from: null, to: null };
    from = parsePatchEffectiveFrom(sorted[idx].effectiveFrom).getTime();
    if (idx+1 < sorted.length) to = parsePatchEffectiveFrom(sorted[idx+1].effectiveFrom).getTime();
  }
  return { from, to };
}

// ── Roster membership: ผู้เล่นคนนี้อยู่ทีม `team` ("our" หรือชื่อ rival) ในช่วง patch ที่เลือกไว้ไหม ──
// history = rosterMembership[playerName] — array ของ { team, from, to } เรียงตามลำดับเวลาไม่จำเป็น
// (from/to เป็น epoch ms แบบเดียวกับ match.id — to:null แปลว่ายังอยู่ทีมนั้นจนถึงตอนนี้)
//
// ไม่มีประวัติเลย (history undefined/[]) = ผู้เล่นที่ไม่เคยผ่านการ "ย้ายทีม" มาก่อน → โชว์เสมอทุก patch
// (backward-compat: ทีมที่ไม่เคยใช้ฟีเจอร์นี้เลยจะเห็นพฤติกรรมเดิมทุกประการ ไม่ต้อง migrate อะไร)
//
// selectedPatch==="all" → นับว่า "อยู่ทีมนี้" ถ้าเคยมีช่วงไหนที่สังกัดทีมนี้เลยก็พอ (ไม่สนเวลา)
// เลือก patch เจาะจง → ต้องมีช่วงที่สังกัดทีมนี้ "ทับซ้อน" กับช่วงเวลาของ patch นั้นจริงๆ (interval overlap)
export function isMembershipActiveForPatch(history, team, patchVersions, selectedPatch) {
  if (!Array.isArray(history) || history.length === 0) return true;
  if (selectedPatch === "all") return history.some(h => h.team === team);

  const { from: patchFrom, to: patchTo } = resolvePatchWindow(patchVersions, selectedPatch);
  if (patchFrom === null) return true; // resolve ไม่ได้ (patch ถูกลบ) — fallback แสดงเหมือน "all"
  return history.some(h =>
    h.team === team &&
    h.from < patchTo &&
    (h.to === null || h.to === undefined || h.to > patchFrom)
  );
}

// ── ผู้เล่นคนนี้ "ตอนนี้" สังกัดทีมไหน (record ที่ยังเปิดอยู่ to:null) ──
// คืน null ถ้าไม่มีประวัติเลย (ไม่เดาให้) — ผู้เรียกต้องกำหนดเองว่า "ไม่มีประวัติ" แปลว่าทีมไหนตามบริบทที่เจอ
// ผู้เล่นคนนั้น (เช่น เจอใน state.roster → เดิมทีควรเป็น "our", เจอใน enemyRosters[X] → เดิมทีควรเป็น X)
// ใช้ผ่าน `getCurrentTeamOf(history) ?? fallbackTeam` เสมอที่จุดเรียก ไม่ใช่ default ตายตัวในฟังก์ชันนี้
// (เดิม default เป็น "our" เสมอ ซึ่งผิดสำหรับผู้เล่นที่ถูกเพิ่มเข้า roster คู่แข่งตรงๆ โดยไม่เคยย้ายทีมมาก่อน)
export function getCurrentTeamOf(history) {
  if (!Array.isArray(history) || history.length === 0) return null;
  const open = history.find(h => h.to === null || h.to === undefined);
  return open ? open.team : null; // ปิดทุกช่วงไปแล้ว (ไม่ควรเกิดในทางปฏิบัติ แต่กันไว้)
}

// ── ย้ายชื่อ key ใน rosterMembership ตอนเปลี่ยนชื่อผู้เล่น (ประวัติต้องตามคนไป ไม่ใช่ค้างที่ชื่อเก่า) ──
export function renameMembershipKey(membership, oldName, newName) {
  const src = membership?.[oldName];
  if (!src) return membership || {};
  const { [oldName]: _omit, ...rest } = membership;
  const existing = rest[newName] || [];
  return { ...rest, [newName]: [...existing, ...src].sort((a, b) => a.from - b.from) };
}

// ── เปิดช่วงสังกัดทีมใหม่ให้ผู้เล่น (ใช้ตอนเพิ่มเข้าทีม/ย้ายทีม) ──
// ไม่มีประวัติมาก่อนเลย = คนใหม่ล้วนๆ สร้าง array ใหม่ได้เลย ไม่ต้อง assume อะไร (ต่างจาก transfer ที่ต้อง
// ปิดช่วงเก่าก่อน เพราะคนที่ถูกย้ายมีประวัติอยู่แล้วอย่างน้อย 1 ช่วงเสมอ)
export function openNewPeriod(history, team, at) {
  const existing = Array.isArray(history) ? history : [];
  return [...existing, { team, from: at, to: null }];
}

// ── ปิดช่วงสังกัดทีมที่ "กำลังเปิดอยู่" ของทีมหนึ่ง (ใช้ตอนผู้เล่นออกจากทีมนั้น ไม่ว่าจะย้ายไปไหนต่อหรือไม่) ──
// ไม่มีประวัติเลย = ถือว่าอยู่ทีมนี้มาตลอดตั้งแต่ก่อนมีระบบนี้ (from:0) ต้องสร้างช่วงนั้นไว้ก่อนแล้วค่อยปิด
// ไม่ "เปิดช่วงก่อนหน้ากลับ" อัตโนมัติอีกต่อไป (ต่างจากเดิม) — เพราะตอนนี้ย้ายกลับทีมเดิมทำได้ตรงๆ ผ่าน
// TRANSFER_PLAYER อยู่แล้ว (รองรับย้ายไปทีมไหนก็ได้ รวมถึงย้ายกลับ "ทีมเรา" ด้วย) ไม่ต้องมี magic พิเศษซ้อนกัน
export function closeOpenPeriod(history, team, at) {
  const base = (Array.isArray(history) && history.length > 0) ? history : [{ team, from: 0, to: null }];
  return base.map(h => (h.team === team && (h.to === null || h.to === undefined)) ? { ...h, to: at } : h);
}

// ── สถิติของผู้เล่นแยกตามทีมที่สังกัดในแต่ละช่วง (ใช้ในหน้า Player Profile ตอนมีประวัติย้ายทีม) ──
// history = rosterMembership[player]; matches = แมตช์ทั้งหมดที่ยังไม่กรอง patch (ต้องดูข้ามทุก patch เสมอ)
// ช่วงของทีมเรา ("our"): นับเกมที่ชื่อนี้อยู่ใน ourPicks — ผลชนะ = result==="WIN"
// ช่วงของทีมคู่แข่ง: นับเกมที่เราเจอทีมนั้น (m.rivalName===team) และชื่อนี้อยู่ใน enemyPicks — ผลชนะของเขา = result==="LOSE"
//   (result ในแมตช์เป็นมุมมองของ "เรา" เสมอ)
// ⚠ ใช้เฉพาะแมตช์จริงที่เราบันทึก — ไม่รวมข้อมูล Scout ที่เห็นเขาเล่นกับทีมอื่น เพราะ adaptScoutGamesForPlayerProfile
//   ไม่ส่งเวลา/id ของแมตช์ Scout ต่อมา จึงเทียบกับช่วงเวลาสังกัดไม่ได้ (ถ้าจะรวมต้องแก้ตัว adapter ที่ใช้ร่วมกับหน้าอื่น)
export function computePlayerTeamBreakdown(history, matches, playerName) {
  if (!Array.isArray(history) || history.length === 0) return [];
  const periods = [...history].sort((a, b) => a.from - b.from);
  return periods.map(period => {
    const to = (period.to === null || period.to === undefined) ? Infinity : period.to;
    let games = 0, wins = 0;
    const heroes = {};
    (matches || []).forEach(m => {
      const t = matchTime(m);
      if (!(t >= period.from && t < to)) return;
      const gs = Array.isArray(m.games) && m.games.length > 0 ? m.games : [m];
      gs.forEach(g => {
        if (period.team === "our") {
          const slot = (g.ourPicks || []).find(d => d.player === playerName);
          if (!slot) return;
          games++; if (g.result === "WIN") wins++;
          if (slot.hero?.name) heroes[slot.hero.name] = (heroes[slot.hero.name] || 0) + 1;
        } else {
          if (m.rivalName !== period.team) return;
          const slot = (g.enemyPicks || []).find(d => d.player === playerName);
          if (!slot) return;
          games++; if (g.result === "LOSE") wins++;
          if (slot.hero?.name) heroes[slot.hero.name] = (heroes[slot.hero.name] || 0) + 1;
        }
      });
    });
    const topHeroes = Object.entries(heroes).sort((a, b) => b[1] - a[1]).slice(0, 3);
    return {
      team: period.team, from: period.from, to: period.to ?? null,
      games, wins, losses: games - wins,
      winRate: games ? Math.round(wins / games * 100) : null,
      topHeroes,
    };
  });
}
