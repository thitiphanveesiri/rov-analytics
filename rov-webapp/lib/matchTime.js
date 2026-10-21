// lib/matchTime.js
// เวลาที่แข่งจริงของแมตช์ — pure functions (ไม่มี React/DOM) ใช้ได้ทั้ง client และ server (matchSync.js)
//
// ปัญหาเดิม: ระบบใช้ m.id (= Date.now() ตอนกดบันทึก) เป็นเวลาแข่ง พอกรอกย้อนหลัง
// แมตช์จะถูกจัดเข้า patch/สัปดาห์/เดือนผิด และ recency weight ของ Mock trainer เพี้ยน
// ทางแก้: เก็บ m.playedAt (epoch ms) แยกจาก id — แมตช์เก่าที่ไม่มี playedAt ยัง fallback ไปใช้ id ตามเดิม
// (scout matches ก็ใช้ helper เดียวกันได้ ไม่มี playedAt = ใช้ id)
export function matchTime(m) {
  const p = Number(m?.playedAt);
  if (Number.isFinite(p) && p > 0) return p;
  const id = Number(m?.id);
  return Number.isFinite(id) ? id : 0;
}

export function formatMatchDate(ms) {
  return new Date(ms).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

// <input type="datetime-local"> ใช้เวลาท้องถิ่นของเครื่อง ไม่ใช่ UTC
export function toDatetimeLocal(ms) {
  const d = new Date(ms);
  if (isNaN(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fromDatetimeLocal(str) {
  if (!str) return null;
  const t = new Date(str).getTime();
  return Number.isFinite(t) ? t : null;
}
