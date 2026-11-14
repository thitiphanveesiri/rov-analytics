import assert from "node:assert/strict";
import { fixByPercent, detectKind, prepare, readScoreboards, summaryThumbBoxes, fixByConstraints, findSummaryLayout } from "@/lib/scoreboardOcr";

// ── detectKind: หน้าสรุปกว้าง (~2.16:1) / หน้า "ข้อมูล" แคบกว่า (~1.45–1.7:1)
assert.equal(detectKind({ width: 1837, height: 866 }), "summary");
assert.equal(detectKind({ width: 1751, height: 1206 }), "damage");
assert.equal(detectKind({ width: 2011, height: 1206 }), "damage");

// ── fixByPercent: แก้เลขที่อ่านผิดหลักเดียวด้วย % ที่เกมแสดง (ทีมรวม = 200,000)
const T = 200000;
const mk = (dmg, p) => ({ damage: dmg, pct: [p, 10] });
const rows = [mk(50000, 25), mk(40000, 20), mk(30000, 15), mk(90000, 30), mk(30000, 15)];
// แถว 4: เกมแสดง 30% (=60000) แต่ OCR อ่านได้ 90000 → ต้องแก้เป็น 60000
fixByPercent(rows, 0, "damage");
assert.equal(rows[3].damage, 60000);
assert.deepEqual(rows[3].fixed, ["damage"]);
assert.equal(rows[0].fixed, undefined);               // แถวที่ถูกอยู่แล้วต้องไม่ถูกแตะ
// ข้อมูลน้อยเกินไป (<3 แถวที่มี %) → ไม่แก้อะไรเลย
const few = [mk(90000, 30), { damage: 1, pct: null }, { damage: 2, pct: null }];
fixByPercent(few, 0, "damage");
assert.equal(few[0].damage, 90000);

// ── prepare: ขยาย + ใส่ขอบขาว, ตัวอักษรสว่าง → ดำ
const W = 40, H = 20, data = new Uint8ClampedArray(W * H * 4).fill(20);
for (let y = 5; y < 15; y++) for (let x = 10; x < 14; x++) { const i = (y * W + x) * 4; data[i] = data[i + 1] = data[i + 2] = 250; }
const img = prepare({ width: W, height: H, data }, [0, 0, W, H], { thr: 130, scale: 3 });
assert.equal(img.w, W * 3 + 48); assert.equal(img.h, H * 3 + 48);
assert.equal(img.g[0], 255);                                          // ขอบขาว
assert.equal(img.g[(24 + 10 * 3) * img.w + 24 + 11 * 3], 0);          // เส้นสว่างกลายเป็นดำ

// ── readScoreboards: เดินครบทุกแถว และรวมผลหน้าสรุป+หน้าข้อมูลเข้าแถวเดียวกัน (recognize ปลอม)
const calls = [];
const fake = async (im, { whitelist }) => { calls.push(whitelist); return whitelist.includes("%") ? "10.0 % 10.0 %" : whitelist.startsWith("0123456789") ? "7" : ""; };
const blank = (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
let steps = 0;
const r = await readScoreboards([{ bitmap: blank(1882, 870) }], fake, () => steps++);
assert.deepEqual(r.kinds, ["summary"]);
assert.equal(steps, 10);
assert.equal(r.teams.length, 2); assert.equal(r.teams[0].rows.length, 5);
assert.equal(r.teams[0].rows[0].kills, 7);
assert.equal(r.teams[0].rows[0].gold, 7, "อ่านทีละช่อง: K/D/A/ทอง แยกกัน");
assert.equal(r.teams[1].rows[4].assists, 7);
// หน้าสรุป: อ่าน 4 ช่อง × 4 แบบ ต่อแถว + สกอร์ทีม 2 ช่อง × 4 แบบ
assert.equal(calls.length, 10 * 4 * 4 + 2 * 4);

// ── กรอบรูปโปรไฟล์ (ใช้ตัดภาพย่อ) ต้องอยู่ในภาพและเรียงแถวบน→ล่าง
const tb = summaryThumbBoxes({ width: 1837, height: 866 });
assert.equal(tb.length, 2); assert.equal(tb[0].length, 5);
assert.ok(tb[0][0][1] < tb[0][4][1] && tb[0][4][3] <= 866 + 1);

// ── fixByConstraints: กรณีจริงจากเว็บ — Nakroth K=11 ถูกอ่านเป็น 1 (Skud K=1 จริง) ──
const mkT = (ks, ds, inks) => ({ rows: ks.map((k, i) => ({ kills: k, deaths: ds[i], assists: 0, gold: 0, _inkK: inks?.[i] })) });
{
  const teams = [mkT([1, 1, 2, 4, 2], [3, 1, 2, 4, 5], [40, 20, 20, 20, 20]), mkT([1, 2, 3, 3, 6], [5, 2, 6, 2, 5])];
  const w = fixByConstraints(teams, [20, 15]);
  assert.equal(teams[0].rows[0].kills, 11, "แก้ 1→11 ด้วยกฎ + ความกว้างหมึกตัดสินระหว่าง 2 ช่องที่เป็น 1");
  assert.equal(teams[0].rows[1].kills, 1, "Skud ต้องไม่ถูกแตะ");
  assert.ok(teams[0].rows[0]._flag && w.some(m => m.includes("แก้อัตโนมัติ")));
}
{ // ไม่มีข้อมูลความกว้างหมึก + มี 2 ตัวเลือก → ห้ามเดา ต้องเตือน
  const teams = [mkT([1, 1, 2, 4, 2], [3, 1, 2, 4, 5]), mkT([1, 2, 3, 3, 6], [5, 2, 6, 2, 5])];
  const w = fixByConstraints(teams, [20, 15]);
  assert.equal(teams[0].rows[0].kills, 1); assert.equal(teams[0].rows[1].kills, 1);
  assert.ok(w.some(m => m.includes("แก้เองไม่ได้")));
}
{ // ค่าถูกต้องอยู่แล้ว → ไม่แตะ ไม่มีคำเตือน
  const teams = [mkT([11, 1, 2, 4, 2], [3, 1, 2, 4, 5]), mkT([1, 2, 3, 3, 6], [5, 2, 6, 2, 5])];
  assert.deepEqual(fixByConstraints(teams, [20, 15]), []);
}
{ // สกอร์อ่านไม่ได้ (null) แต่เดธฝั่งตรงข้ามกับคิลรวมต่างกัน → ไม่มีเสียงข้างมาก ห้ามแก้ แค่เตือน
  const teams = [mkT([1, 1, 2, 4, 2], [3, 1, 2, 4, 5]), mkT([1, 2, 3, 3, 6], [5, 2, 6, 2, 5])];
  const w = fixByConstraints(teams, [null, null]);
  assert.equal(teams[0].rows[0].kills, 1); assert.ok(w.length >= 1);
}

// ── findSummaryLayout: หาตำแหน่งตารางจากแถบหัวตารางสีแดง รองรับหลายขนาด/ตำแหน่ง ──
function synth(W, H, s, ox, oy, withBar = true) {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) { data[i * 4] = 44; data[i * 4 + 1] = 44; data[i * 4 + 2] = 85; data[i * 4 + 3] = 255; }
  if (withBar) {
    const L = Math.round(ox + 920 * s), R = Math.round(ox + 1684 * s), T = Math.round(oy + 126 * s), B = Math.round(oy + 173 * s);
    for (let y = T; y <= B; y++) for (let x = L; x <= R; x++) {
      const glyph = (x - L) % Math.round(120 * s) < Math.round(25 * s) && y > T + 8 * s && y < B - 8 * s; // ไอคอนสีขาวบนแถบ
      const i = (y * W + x) * 4; const c = glyph ? [230, 230, 235] : [150, 55, 84];
      data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2];
    }
  }
  return { width: W, height: H, data };
}
for (const [s, ox, oy, W, H] of [[1, 0, 0, 1837, 866], [0.6, 20, 15, 1100, 540], [1.5, -100, 30, 2600, 1300], [0.87, 5, 225, 1600, 1200]]) {
  const L = findSummaryLayout(synth(W, H, s, ox, oy));
  assert.ok(L, `ต้องหาแถบเจอ (s=${s})`);
  assert.ok(Math.abs(L.s - s) / s < 0.012, `สเกล ${L.s} ควรใกล้ ${s}`);
  assert.ok(Math.abs(L.ox - ox) <= 4 && Math.abs(L.oy - oy) <= 4, `ตำแหน่ง ${L.ox},${L.oy} ควรใกล้ ${ox},${oy}`);
}
assert.equal(findSummaryLayout(synth(1837, 866, 1, 0, 0, false)), null, "ไม่มีแถบแดง → null");
assert.equal(findSummaryLayout({ width: 100, height: 50 }), null, "ไม่มีข้อมูลพิกเซล → null");
{ // แถบสีแดงทั้งภาพ/แถบบางผิดสัดส่วน ต้องไม่ถูกมองเป็นหัวตาราง
  const bm = synth(1000, 600, 1, 0, 0, false);
  for (let y = 100; y < 104; y++) for (let x = 100; x < 900; x++) { const i = (y * 1000 + x) * 4; bm.data[i] = 150; bm.data[i + 1] = 50; bm.data[i + 2] = 80; }
  assert.equal(findSummaryLayout(bm), null, "แถบบางเกินไป → null");
}
// detectKind: ภาพสรุปที่สัดส่วนต่ำกว่า 1.9 (เช่น 4:3 / 16:9) ต้องยังเป็น summary เมื่อเจอแถบ ; ไม่มีข้อมูลพิกเซลใช้สัดส่วนภาพเป็นตัวสำรอง
assert.equal(detectKind(synth(1600, 1200, 0.87, 5, 225)), "summary");
assert.equal(detectKind(synth(1920, 1080, 1.1, 40, 10)), "summary");
// summaryThumbBoxes ตามตำแหน่ง/สเกลที่หาเจอ
const tb2 = summaryThumbBoxes(synth(1600, 1200, 0.87, 5, 225));
assert.ok(tb2[0][0][1] > 225 && tb2[1][4][3] < 1200, "กรอบภาพย่ออยู่ในภาพและเลื่อนตามตำแหน่งตาราง");
console.log("scoreboardOcr tests OK");
