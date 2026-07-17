// lib/duration.js
// ── Extracted verbatim from components/RovApp.js ──
// Pure functions, zero dependency on React or app state — the safest
// possible first cut when splitting a large client component apart.
// Behavior is copied exactly (not rewritten) to avoid introducing subtle
// differences in a function used to compute match durations across the app.

// เก็บเวลาเกมแบบ "นาที.วินาที" (เช่น 9:45 → "09.45") ไม่ใช่เลขทศนิยมนาทีตรงๆ
// เพราะ 45 วินาทีไม่ใช่ 0.45 นาที
export function normalizeDuration(input) {
  if (input === null || input === undefined || input === "") return "";
  const str = String(input).trim();
  const sep = str.includes(":") ? ":" : str.includes(".") ? "." : null;

  if (!sep) {
    // แค่ตัวเลขนาทีเฉยๆ ไม่มีวินาที
    const n = Number(str);
    if (!Number.isFinite(n) || n < 0) return ""; // ปฏิเสธค่าติดลบ/ไม่ใช่ตัวเลข แทนที่จะปล่อยผ่านเงียบๆ
    const m = String(Math.trunc(n)).padStart(2, "0");
    return `${m}.00`;
  }

  const parts = str.split(sep);
  if (parts.length > 2) return ""; // รูปแบบผิด เช่น "9.45.30" — ปฏิเสธแทนตัดทิ้งเงียบๆ

  const [mRaw, sRaw = "0"] = parts;
  const mNum = Number(mRaw || "0");
  const sNum = Number(sRaw || "0");
  if (!Number.isFinite(mNum) || !Number.isFinite(sNum) || mNum < 0 || sNum < 0 || sNum > 59) return "";

  const mm = String(Math.trunc(mNum)).padStart(2, "0");
  const ss = String(Math.trunc(sNum)).padStart(2, "0");
  return `${mm}.${ss}`;
}

// "09.45" → 9.75 (นาทีแบบทศนิยมจริง ไว้ใช้คำนวณค่าเฉลี่ย)
export function durationToMinutes(input) {
  if (!input && input !== 0) return 0;
  const norm = normalizeDuration(input);
  if (!norm) return 0;
  const [m, s] = norm.split(".").map(Number);
  return (m || 0) + (s || 0) / 60;
}

// 9.75 (นาทีทศนิยม) → "09.45" ไว้โชว์ผล
export function minutesToDurationStr(totalMinutes) {
  if (totalMinutes === null || totalMinutes === undefined || isNaN(totalMinutes)) return "-";
  const m = Math.floor(totalMinutes);
  const s = Math.round((totalMinutes - m) * 60);
  return `${String(m).padStart(2, "0")}.${String(s).padStart(2, "0")}`;
}

// "09.45" → "09:45" — ใช้แสดงผลให้อ่านง่าย (นาที:วินาที แทนจุด กันสับสนกับทศนิยม)
export function formatDurationDisplay(input) {
  if (!input) return null;
  return normalizeDuration(input).replace(".", ":");
}
