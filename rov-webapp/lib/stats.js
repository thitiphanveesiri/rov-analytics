// lib/stats.js — pure stats helpers (ไม่มี React) ใช้ได้ทั้ง client/server
//
// ทำไมต้องมี: Synergy/Counter/Suggestion เดิมเรียงตาม WR ดิบ ข้อมูลทั้งแอปมีไม่กี่ร้อยเกม
// คู่ฮีโร่ส่วนใหญ่มี 1-3 เกม → คู่ 2/2 (100%) ลอยขึ้นบนสุดเหนือคู่ 40/50 (80%) ซึ่งหลอกโค้ช
// Wilson lower bound = "WR ต่ำสุดที่เชื่อได้ที่ความมั่นใจ ~95%" — ตัวอย่างน้อยจะถูกดึงลงเอง

export const LOW_SAMPLE = 5; // น้อยกว่านี้ให้โชว์ว่า "ตัวอย่างน้อย"

// z=1.96 → 95% (ค่ามาตรฐาน)
export function wilsonLower(wins, n, z = 1.96) {
  if (!n) return 0;
  const p = wins / n;
  const z2 = z * z;
  const centre = p + z2 / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n);
  return Math.max(0, (centre - margin) / (1 + z2 / n));
}

// สำหรับเรียงลำดับ: Wilson lower (เป็น 0-1) ก่อน, เสมอกันดูจำนวนเกม, แล้ว WR ดิบ
export function compareByConfidence(a, b) {
  const d = wilsonLower(b.wins, b.games ?? b.total) - wilsonLower(a.wins, a.games ?? a.total);
  if (Math.abs(d) > 1e-12) return d;
  const nb = b.games ?? b.total, na = a.games ?? a.total;
  if (nb !== na) return nb - na;
  return b.wins / nb - a.wins / na;
}

export const isLowSample = (n) => n < LOW_SAMPLE;
