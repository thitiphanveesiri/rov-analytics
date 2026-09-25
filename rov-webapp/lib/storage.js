// Storage layer: load/save team data via the /api/data API route.
// Replaces the original window.storage calls from the Claude.ai artifact.

import { stableStringify } from "./permissions.js";

const FIELDS = [
  "matches","rivals","roster","enemyRosters","scoutMatches",
  "playerPhotos","heroPhotos","customHeroes","roleOverrides","videos",
  "teamLogo","rivalLogos","schedules","patchInfo","heroTiers","practiceAssignments",
  "whiteboardElements","whiteboardFormations","whiteboardMapUrl",
];

const FALLBACK = {
  matches:[], rivals:[], roster:["Player 1","Player 2"],
  enemyRosters:{}, scoutMatches:[], playerPhotos:{}, heroPhotos:{},
  customHeroes:[], roleOverrides:{}, videos:[],
  teamLogo:null, rivalLogos:{}, schedules:[],
  patchInfo:{version:"",notes:"",updatedAt:null}, heroTiers:{}, practiceAssignments:[],
  whiteboardElements:[], whiteboardFormations:[], whiteboardMapUrl:null, _loaded:true,
};

// Tracks the last-known `updatedAt` timestamp of TeamData as this client
// has seen it. Sent back on every save so the server can detect if someone
// else (another team member, or another tab of the same user) saved in
// between — see the optimistic-locking check in app/api/data/route.js.
let lastKnownUpdatedAt = null;

// ── "Base snapshot" สำหรับ 3-way merge ──
// เก็บ JSON ของแต่ละ field ตามที่ server มีล่าสุดเท่าที่ client รู้ (ตอนโหลด หรือหลัง save สำเร็จ)
// เป็นสตริงเพราะถูกและกันการแก้ค่าในหน่วยความจำโดยไม่ตั้งใจ — parse เฉพาะตอนชน conflict (นานๆ ที)
// ใช้ตอบคำถามที่ merge แบบเดิม (เอา server เป็นฐาน แล้วเติมของใหม่ฝั่ง local) ตอบไม่ได้:
//   • local ลบของ → เดิมถูกเติมกลับ (ลบไม่เป็นผล)      • คนอื่นลบของ → เดิม local เติมกลับ (ของที่ถูกลบฟื้นคืนชีพ)
//   • แก้ field ที่ merge ไม่ได้ (patchInfo/whiteboard/โลโก้) ขณะคนอื่นแก้ field อื่น → เดิมแพ้ server เงียบๆ
let baseJson = null; // { [field]: string } | null

function serializeFields(obj) {
  const fieldJson = {};
  const parts = [];
  for (const f of FIELDS) {
    const j = JSON.stringify(obj[f] === undefined ? null : obj[f]);
    fieldJson[f] = j;
    parts.push(`${JSON.stringify(f)}:${j}`);
  }
  return { fieldJson, partsJoined: parts.join(",") };
}

function setBase(fieldJson, skip = []) {
  const next = { ...(baseJson || {}) };
  for (const f of FIELDS) {
    if (skip.includes(f)) continue;
    if (fieldJson[f] !== undefined) next[f] = fieldJson[f];
  }
  baseJson = next;
}

export async function loadFromStorage() {
  try {
    const res = await fetch("/api/data");

    // ── Not in a team (removed, or never joined) ──
    // /api/data GET returns 403 specifically when the account has no
    // teamId — distinct from a real network/server error, and needs its
    // own UI (a blocking "enter an invite code" modal) instead of quietly
    // falling back to an empty-looking team, which is what used to happen
    // here (silently caught below, autosave then kept failing every
    // 600ms with no explanation to the user).
    if (res.status === 403) {
      return { ...FALLBACK, roster: [], _loaded: true, noTeam: true };
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    lastKnownUpdatedAt = data.updatedAt || null;

    // ── Pending-approval account ──
    // Server intentionally sends back only { pending: true, teamName }
    // (no real team data) while an admin hasn't approved this member yet
    // — see the status check in app/api/data GET. Build state from
    // FALLBACK (keeps the exact shape other code expects, e.g.
    // patchInfo.version) but override `roster` specifically — FALLBACK's
    // roster is ["Player 1","Player 2"], meant as starter placeholders
    // for a brand-new team, which would confusingly look like real team
    // data here. Everything else in FALLBACK is already empty/neutral.
    if (data.pending) {
      return { ...FALLBACK, roster: [], _loaded: true, pending: true };
    }

    // Build state from DB data, falling back to safe defaults per field
    const state = { _loaded: true, pending: false, noTeam: false };
    FIELDS.forEach(f => { state[f] = data[f] ?? FALLBACK[f]; });
    setBase(serializeFields(state).fieldJson);
    return state;
  } catch (err) {
    console.error("loadFromStorage failed:", err);
    // ── NEVER pretend this was a successful (if empty) load ──
    // Returning `{...FALLBACK}` here used to set `_loaded: true` on a
    // state that is NOT the team's real data — just empty placeholders.
    // Any caller that dispatches this into `app` would make the app
    // THINK the team has no matches/roster/schedules/etc, and because
    // `_loaded` gates the autosave effect, that same emptiness would then
    // get auto-saved back to the server 600ms later — a transient
    // network hiccup or cold-start 500 could silently erase a team's
    // real data. `_loaded: false` here means callers can — and must —
    // check this before dispatching, and the autosave effect (which only
    // arms once `app._loaded` is true) stays off if a caller dispatches
    // this by mistake.
    return { _loaded: false, loadError: true, loadErrorMessage: err.message || String(err) };
  }
}

// ── Merge classification ──
// list (id)   : array ของ object ที่มี `id` คงที่
// list (name) : customHeroes — ใช้ `name` เป็นตัวระบุ (ดู ADD_CUSTOM_HERO ใน RovApp.js)
// map         : key→value (ชื่อฮีโร่→รูป, ทีม→roster ฯลฯ)
// strings     : roster = array ของชื่อ (ตัวสตริงเองคือตัวระบุ)
// อื่นๆ (patchInfo, teamLogo, whiteboardElements, whiteboardMapUrl) = atomic ทั้งก้อน
const MERGEABLE_LIST_FIELDS = ["matches", "rivals", "scoutMatches", "videos", "schedules", "practiceAssignments", "whiteboardFormations"];
const MERGEABLE_MAP_FIELDS = ["enemyRosters", "playerPhotos", "heroPhotos", "roleOverrides", "rivalLogos", "heroTiers"];
const MERGEABLE_BY_NAME_FIELDS = ["customHeroes"];
const MERGEABLE_STRING_LIST_FIELDS = ["roster"];

const norm = stableStringify;
const isObj = v => typeof v === "object" && v !== null && !Array.isArray(v);

// 3-way merge ของ array ที่มีตัวระบุ — base = ตอนที่ client ซิงก์ล่าสุด, local = สิ่งที่ผู้ใช้เห็น, fresh = server ตอนนี้
//   ทั้งสองฝั่งไม่ชนกัน → เก็บทั้งสองฝั่ง | ชนกัน (แก้ item เดียวกันทั้งคู่) → server ชนะ
//   local ลบ + server ไม่ได้แก้ → ลบจริง | server ลบ → ไม่ฟื้นคืนชีพ | local ลบ + server แก้ → เก็บฉบับ server
export function mergeListThreeWay(baseArr, localArr, freshArr, keyOf) {
  if (!Array.isArray(freshArr) || !Array.isArray(localArr)) return freshArr ?? localArr ?? [];
  const index = arr => {
    const m = new Map();
    (Array.isArray(arr) ? arr : []).forEach(it => { const k = keyOf(it); if (k !== undefined) m.set(k, it); });
    return m;
  };
  const base = index(baseArr), local = index(localArr);
  const out = [];
  const seen = new Set();

  for (const item of freshArr) {
    const k = keyOf(item);
    if (k === undefined) { out.push(item); continue; }
    seen.add(k);
    if (!base.has(k)) { out.push(item); continue; }                         // server เพิ่มเอง (หรือ base ไม่รู้จัก)
    const serverChanged = norm(item) !== norm(base.get(k));
    if (!local.has(k)) { if (serverChanged) out.push(item); continue; }     // local ลบ: ลบจริงถ้า server ไม่ได้แก้
    const localChanged = norm(local.get(k)) !== norm(base.get(k));
    out.push(localChanged && !serverChanged ? local.get(k) : item);          // ชนกัน → server ชนะ
  }
  for (const item of localArr) {
    const k = keyOf(item);
    if (k === undefined || seen.has(k)) continue;
    if (!base.has(k)) out.push(item);                                        // เพิ่มใหม่ฝั่ง local
    // อยู่ใน base แต่ server ไม่มีแล้ว = คนอื่นลบไปแล้ว → ไม่เติมกลับ
  }
  return out;
}

export function mergeMapThreeWay(baseMap, localMap, freshMap) {
  if (!isObj(freshMap)) return localMap ?? {};
  if (!isObj(localMap)) return freshMap ?? {};
  const base = isObj(baseMap) ? baseMap : {};
  const out = {};
  for (const k of Object.keys(freshMap)) {
    if (!(k in base)) { out[k] = freshMap[k]; continue; }
    const serverChanged = norm(freshMap[k]) !== norm(base[k]);
    if (!(k in localMap)) { if (serverChanged) out[k] = freshMap[k]; continue; }
    const localChanged = norm(localMap[k]) !== norm(base[k]);
    out[k] = localChanged && !serverChanged ? localMap[k] : freshMap[k];
  }
  for (const k of Object.keys(localMap)) {
    if (k in out) continue;
    if (k in freshMap) continue;                 // (ถูกจัดการในลูปบนแล้ว — กรณีที่ถูกตัดทิ้งโดยตั้งใจ)
    if (!(k in base)) out[k] = localMap[k];      // key ใหม่ฝั่ง local
  }
  return out;
}

export function mergeStringListThreeWay(baseArr, localArr, freshArr) {
  if (!Array.isArray(freshArr)) return localArr ?? [];
  if (!Array.isArray(localArr)) return freshArr;
  const base = new Set(Array.isArray(baseArr) ? baseArr : []);
  const local = new Set(localArr), fresh = new Set(freshArr);
  const out = freshArr.filter(x => !(base.has(x) && !local.has(x)));         // local ลบ (และ server ยังมีเท่าเดิม) → ลบ
  localArr.forEach(x => { if (!fresh.has(x) && !base.has(x)) out.push(x); }); // เพิ่มใหม่ฝั่ง local
  return out;
}

// รวมทุก field: ถ้า local ไม่เคยแตะ field นั้น → เอา server | ถ้า server ไม่เคยแตะ → เอา local (ของเดิมตรงนี้แพ้ server เสมอ)
// | ถ้าแก้ทั้งคู่ → ใช้ merge ตามชนิด (atomic = server ชนะ)
export function mergeWithBase(baseObj, localObj, freshObj) {
  const merged = {};
  for (const f of FIELDS) {
    const b = baseObj?.[f], l = localObj?.[f], s = freshObj?.[f] ?? FALLBACK[f];
    if (baseObj && b !== undefined) {
      if (norm(l) === norm(b)) { merged[f] = s; continue; }   // เราไม่ได้แก้ field นี้
      if (norm(s) === norm(b)) { merged[f] = l; continue; }   // คนอื่นไม่ได้แก้ field นี้
    }
    if (MERGEABLE_LIST_FIELDS.includes(f))           merged[f] = mergeListThreeWay(b, l, s, it => it?.id);
    else if (MERGEABLE_BY_NAME_FIELDS.includes(f))   merged[f] = mergeListThreeWay(b, l, s, it => it?.name);
    else if (MERGEABLE_MAP_FIELDS.includes(f))       merged[f] = mergeMapThreeWay(b, l, s);
    else if (MERGEABLE_STRING_LIST_FIELDS.includes(f)) merged[f] = mergeStringListThreeWay(b, l, s);
    else                                              merged[f] = s;   // atomic ที่ทั้งสองฝั่งแก้: server ชนะ
  }
  return merged;
}

async function fetchFreshData() {
  const res = await fetch("/api/data");
  if (!res.ok) return null;
  const data = await res.json();
  if (data.pending || !data.updatedAt) return null; // don't try to merge against a non-normal response
  return data;
}

// ── Internal: the actual save implementation (was previously the whole
//    exported saveToStorage body) — now only ever called one-at-a-time
//    via the queue below, never concurrently. ──
async function putData(fieldJson, partsJoined, expectedUpdatedAt) {
  const body = `{${partsJoined}${expectedUpdatedAt ? `,"expectedUpdatedAt":${JSON.stringify(expectedUpdatedAt)}` : ""}}`;
  return fetch("/api/data", { method: "PUT", headers: { "Content-Type": "application/json" }, body });
}

function makeError(message, extra = {}) {
  const e = new Error(message);
  Object.assign(e, extra);
  return e;
}

async function _doSaveToStorage(appState) {
  // Pending-approval / no-team accounts can't save anything — server
  // blocks this with a 403 anyway (see app/api/data PUT), but skip the
  // network round-trip entirely rather than let it fail every 600ms via
  // autosave (this is exactly the repeated "บันทึกไม่สำเร็จ" toast spam a
  // removed team member used to see).
  if (appState.pending || appState.noTeam) return true;

  // Only send the fields that belong in the DB — strip all React/internal state
  const payload = {};
  FIELDS.forEach(f => { payload[f] = appState[f] ?? FALLBACK[f]; });
  const { fieldJson, partsJoined } = serializeFields(payload);

  const res = await putData(fieldJson, partsJoined, lastKnownUpdatedAt);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));

    // ── 428: server ไม่ได้รับเลขเวอร์ชัน (client ยังไม่เคยโหลดสำเร็จ/state หลุด) ──
    // ดึงเวอร์ชันล่าสุดมาตั้งฐาน แล้วให้ autosave รอบถัดไป (retry อัตโนมัติของ RovApp) ลองใหม่
    if (res.status === 428) {
      const fresh = await fetchFreshData();
      if (fresh?.updatedAt) lastKnownUpdatedAt = fresh.updatedAt;
      throw makeError("ต้องซิงก์เวอร์ชันข้อมูลก่อนบันทึก กำลังลองใหม่", { isConflict: true });
    }

    if (res.status === 409) {
      // ── Someone else saved in between ──
      // Try a one-time automatic recovery first: pull the fresh server state,
      // 3-way merge it with what this client has (base = last synced version),
      // and retry the save once with the merged payload. Only fall back to the
      // hard "please refresh" error if that merge+retry ALSO conflicts.
      const fresh = await fetchFreshData();
      if (fresh) {
        const baseObj = {};
        if (baseJson) FIELDS.forEach(f => { try { baseObj[f] = baseJson[f] !== undefined ? JSON.parse(baseJson[f]) : undefined; } catch {} });
        const merged = mergeWithBase(baseJson ? baseObj : null, payload, fresh);
        const m = serializeFields(merged);

        const retryRes = await putData(m.fieldJson, m.partsJoined, fresh.updatedAt);

        if (retryRes.ok) {
          const retryBody = await retryRes.json().catch(() => ({}));
          if (retryBody.updatedAt) lastKnownUpdatedAt = retryBody.updatedAt;
          setBase(m.fieldJson, retryBody.ignoredFields || []);
          // Let the caller know a merge happened, so the UI can say so
          // instead of pretending it was a completely normal save.
          throw makeError("merged", { wasMerged: true });
        }
        // retry also failed — fall through to the hard conflict error below,
        // using whatever updatedAt that second attempt reports
        const retryBody = await retryRes.json().catch(() => ({}));
        lastKnownUpdatedAt = retryBody.currentUpdatedAt || fresh.updatedAt || lastKnownUpdatedAt;
      } else {
        lastKnownUpdatedAt = body.currentUpdatedAt || lastKnownUpdatedAt;
      }

      throw makeError(
        body.message || "ข้อมูลถูกแก้ไขจากที่อื่นระหว่างนี้ กรุณารีเฟรชหน้าก่อนบันทึกต่อ",
        { isConflict: true }
      );
    }

    // Surface the real reason (e.g. Zod validation details) instead of a
    // generic message — this is what shows up in the toast/console when a
    // save silently fails, so don't swallow it here.
    const detail = body.error || body.message || JSON.stringify(body.issues || body) || `HTTP ${res.status}`;
    console.error("saveToStorage: server rejected save:", detail);
    // code/userMessage ให้ UI แยกเคส "ต้องรีเฟรช" (ข้อมูลลดผิดปกติ/ใหญ่เกิน) ออกจาก error ทั่วไปได้
    throw makeError(detail, {
      code: body.error === "SHRINK_GUARD" ? "SHRINK_GUARD" : body.code,
      userMessage: body.message,
    });
  }

  const body = await res.json().catch(() => ({}));
  if (body.updatedAt) lastKnownUpdatedAt = body.updatedAt;

  // ── field ที่ server ไม่ยอมให้เขียน (สิทธิ์ member) ──
  // server ตอบ ok แต่ทิ้ง field เหล่านั้นไป — อย่าถือว่าซิงก์แล้ว (ไม่อัปเดต base ของ field นั้น)
  // และบอก UI ให้แจ้งผู้ใช้ ไม่งั้นจะเห็นเป็น "บันทึกแล้ว ✅" ทั้งที่การแก้ไขไม่ถูกเก็บ
  const ignored = Array.isArray(body.ignoredFields) ? body.ignoredFields : [];
  setBase(fieldJson, ignored);
  if (ignored.length) throw makeError("ignored fields", { wasIgnored: true, ignoredFields: ignored });

  // IMPORTANT: never catch-and-return-false here — the caller relies on
  // this throwing so it can show an accurate save-failed state to the
  // user. Swallowing errors here previously caused the UI to always show
  // "✅ บันทึกแล้ว" even when the save had actually failed, silently
  // losing data on reload.
  return true;
}

// ── Serialized save queue ──
// Root-cause fix for the "save succeeds, then a moment later says
// conflict and the result disappears" bug: _doSaveToStorage does a
// fetch-fresh + merge + retry dance on 409, and that whole dance reads
// `lastKnownUpdatedAt` (a single shared variable) and does its own GET+PUT
// round trip. If two saves (e.g. a regular autosave + another autosave
// fired moments later because app state changed again before the first
// one finished) run concurrently, their conflict-recovery attempts can
// race each other: one recovery's "fresh" GET can happen before the
// other recovery's PUT has landed, so it merges from stale data and then
// writes that stale-but-now-"fresh" version back — silently discarding
// whatever the other save had just added (e.g. a just-finished match).
//
// The fix is not to make the merge logic smarter — it's to guarantee
// only one save (including its conflict-retry) is ever in flight at a
// time, so `lastKnownUpdatedAt` and the fetch-fresh snapshot inside a
// retry are never read/written by two calls simultaneously. Every call
// now waits for the previous one to fully settle before it starts.
let saveChain = Promise.resolve();

export function saveToStorage(appState) {
  const run = saveChain.then(
    () => _doSaveToStorage(appState),
    () => _doSaveToStorage(appState), // previous save failed — still run this one
  );
  // Swallow so a failed save doesn't permanently "poison" the chain for
  // every future save (each call still gets its own real result/rejection
  // via `run`, which is what's actually returned to the caller below).
  saveChain = run.catch(() => {});
  return run;
}
