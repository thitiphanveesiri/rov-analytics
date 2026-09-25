// lib/permissions.js
// ── ศูนย์กลางกติกา "ใครเขียน/อ่านข้อมูลทีมส่วนไหนได้" (บังคับที่ server เท่านั้น) ──
// UI ซ่อนปุ่มได้ แต่ไม่ใช่การป้องกัน — ใครก็ยิง PUT /api/data ตรงๆ ได้ ทุก field ที่ไม่อยู่ใน
// COACH_ONLY_FIELDS ด้านล่างจึงถือว่า "member เขียนได้" แก้กติกาที่ตรงนี้ที่เดียว ไม่ต้องไล่แก้ route

export const COACH_ROLES = ["admin", "coach"];

export function isCoachOrAdmin(role) {
  return COACH_ROLES.includes(role);
}

// status ที่ยังไม่อนุมัติ/ถูกระงับ ต้องไม่ผ่าน — ใช้ allowlist ("active") แต่ยอม null/undefined
// เผื่อ user รุ่นเก่าที่ยังไม่มีค่า status (route เดิมปฏิบัติกับค่าว่างเหมือน active มาตลอด)
export function isActiveUser(user) {
  return !!user && (user.status == null || user.status === "active");
}

// ── field ที่เขียนได้เฉพาะ coach/admin ──
// (ตรงกับที่ Help page บอกผู้ใช้: ตารางแข่ง/patch/tier/scout เดิม + ข้อมูลแกนของทีม
//  ซึ่งสร้างผ่าน Live Draft/หน้า Roster/Rivals ที่ออกแบบให้ coach ดูแล)
// member ยังเขียนได้: videos, heroPhotos, customHeroes, roleOverrides, whiteboard*,
// และ practiceAssignments (เฉพาะติ๊ก "เสร็จ" ของการบ้านตัวเอง — ดู sanitizeMemberAssignments)
export const COACH_ONLY_FIELDS = [
  "matches", "rivals", "roster", "enemyRosters", "scoutMatches",
  "playerPhotos", "teamLogo", "rivalLogos",
  "schedules", "patchInfo", "heroTiers",
];

// ── stable stringify: เรียง key ก่อนเทียบ ไม่ให้ลำดับ key ต่างกันถูกนับว่า "ข้อมูลเปลี่ยน" ──
export function stableStringify(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return "[" + v.map(stableStringify).join(",") + "]";
  return "{" + Object.keys(v).sort()
    .filter(k => v[k] !== undefined)
    .map(k => JSON.stringify(k) + ":" + stableStringify(v[k])).join(",") + "}";
}
export function sameJson(a, b) {
  return stableStringify(a) === stableStringify(b);
}

// ── Scout log: member เห็นเฉพาะ "tournament" ──
// ฝั่ง client ถือว่า scout ที่ไม่มี category (ข้อมูลเก่า) = scrim (ดู `!sm.category||sm.category==="scrim"`
// ใน RovApp.js) เดิม server กรองแค่ `category !== "scrim"` ทำให้ scout เก่าที่ไม่มี category หลุดถึง member
// → เปลี่ยนเป็น allowlist: ไม่ใช่ "tournament" ชัดเจน = ซ่อน
export function visibleScoutMatches(scoutMatches, role) {
  if (!Array.isArray(scoutMatches)) return scoutMatches;
  if (isCoachOrAdmin(role)) return scoutMatches;
  return scoutMatches.filter(sm => sm?.category === "tournament");
}

// ── Practice assignments: member ติ๊ก done ได้เฉพาะงานของตัวเอง ──
// เพิ่ม/ลบ/แก้หัวข้อ/แก้งานคนอื่น = ไม่ได้ (คืนค่าจาก DB เดิมของรายการนั้น)
export function sanitizeMemberAssignments(current, incoming, playerName) {
  const cur = Array.isArray(current) ? current : [];
  if (!Array.isArray(incoming) || !playerName) return cur;
  const inc = new Map(incoming.map(a => [a?.id, a]));
  return cur.map(item => {
    if (item?.player !== playerName) return item;
    const next = inc.get(item.id);
    if (!next || typeof next.done !== "boolean") return item;
    return { ...item, done: next.done };
  });
}

// ── ใช้กติกากับ payload ที่ผ่าน validation แล้ว ──
// คืน writeData ใหม่ (field ที่ไม่มีสิทธิ์ = undefined → Prisma ข้ามไม่เขียน) + รายชื่อ field ที่
// "มีการเปลี่ยนจริงแต่ถูกทิ้ง" ให้ client แจ้งผู้ใช้ (ไม่นับกรณีค่าเท่าเดิม)
export function applyWritePolicy({ role, playerName, writeData, current }) {
  if (isCoachOrAdmin(role)) return { writeData, ignored: [] };

  const out = { ...writeData };
  const ignored = [];

  for (const f of COACH_ONLY_FIELDS) {
    if (out[f] === undefined) continue;
    // member รับ scoutMatches แบบกรองแล้ว จึงต้องเทียบกับมุมมองที่เขามองเห็น ไม่งั้นจะรายงานเท็จทุกครั้ง
    const baseline = f === "scoutMatches" ? visibleScoutMatches(current?.[f], role) : current?.[f];
    if (!sameJson(out[f], baseline)) ignored.push(f);
    out[f] = undefined;
  }

  if (out.practiceAssignments !== undefined) {
    const safe = sanitizeMemberAssignments(current?.practiceAssignments, out.practiceAssignments, playerName);
    if (!sameJson(safe, out.practiceAssignments)) ignored.push("practiceAssignments");
    out.practiceAssignments = safe;
  }

  return { writeData: out, ignored };
}

// ── Shrink guard: กันข้อมูลหายก้อนใหญ่จาก bug/client เก่าค้าง ──
// การลบปกติในแอปลบทีละรายการ (ลดครั้งละ ~1) จึงไม่เคยชน 30% ยกเว้นส่งอาร์เรย์ว่าง/เกือบว่างมาทับ
const SHRINK_FIELDS = ["matches", "scoutMatches"];
export function detectShrink(current, writeData, { minBefore = 10, maxDropRatio = 0.3 } = {}) {
  for (const f of SHRINK_FIELDS) {
    const before = current?.[f], after = writeData?.[f];
    if (!Array.isArray(before) || !Array.isArray(after)) continue;
    if (before.length > minBefore && after.length < before.length * (1 - maxDropRatio)) {
      return { field: f, before: before.length, after: after.length };
    }
  }
  return null;
}
