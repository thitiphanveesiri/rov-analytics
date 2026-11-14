// lib/scoreboardOcr.js
// ── อ่านตัวเลขจากภาพสรุปผลแมตช์ RoV ด้วย Tesseract (ฟรี รันในเบราว์เซอร์) ──
// Pure functions: ไม่ import React / DOM / tesseract ที่นี่ — ส่งตัวอ่าน `recognize` เข้ามาเอง (เทสต์ใน Node ได้)
//
// รองรับ 2 หน้าจอ
//   "summary" = หน้าสรุป (K/D/A + ทอง + สกอร์ทีม)
//   "damage"  = หน้า "ข้อมูล" (ดาเมจที่ทำ / ดาเมจที่รับ / ทีมไฟต์ + % สัดส่วน)
// ชื่อผู้เล่น/ชื่อฮีโร่ในภาพเล็กและเป็นฟอนต์ตกแต่ง Tesseract อ่านไม่ได้ → จับคู่แถวตามลำดับบน→ล่างแทน
//
// ความถูกต้อง: ทุกค่ามี "ตัวตรวจ" ในตัว
//   summary → ผลรวมคิลของทีม ต้องเท่ากับสกอร์ทีมที่หัวภาพ
//   damage  → ดาเมจ ÷ ผลรวมทีม ต้องเท่ากับ % ที่เกมแสดง (ใช้แก้เลขที่อ่านผิดทีละหลักได้ด้วย)

// ───────────── bitmap helpers ─────────────
// bitmap = { width, height, data: Uint8ClampedArray(RGBA) }   (รูปแบบเดียวกับ ImageData)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function cropChannel(bm, x0, y0, x1, y1, mode) {
  x0 = clamp(Math.round(x0), 0, bm.width); x1 = clamp(Math.round(x1), 0, bm.width);
  y0 = clamp(Math.round(y0), 0, bm.height); y1 = clamp(Math.round(y1), 0, bm.height);
  const w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0);
  const g = new Uint8Array(w * h); const d = bm.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = ((y0 + y) * bm.width + (x0 + x)) * 4;
    g[y * w + x] = mode === "max" ? Math.max(d[i], d[i + 1], d[i + 2]) : Math.min(d[i], d[i + 1], d[i + 2]);
  }
  return { w, h, g };
}

// ขยายภาพด้วย Lanczos3 (แยกแกน) — คมกว่า bilinear ตอนขยาย 3–4 เท่า ซึ่ง Tesseract ชอบ
const lanczos = (x) => x === 0 ? 1 : Math.abs(x) >= 3 ? 0 : (3 * Math.sin(Math.PI * x) * Math.sin(Math.PI * x / 3)) / (Math.PI * Math.PI * x * x);
function resample1D(src, sw, sh, dw, dh, horizontal) {
  const out = new Float32Array(dw * dh);
  const n = horizontal ? dw : dh, sN = horizontal ? sw : sh, scale = n / sN;
  for (let o = 0; o < n; o++) {
    const c = (o + 0.5) / scale - 0.5; const lo = Math.floor(c) - 2, hi = Math.floor(c) + 3;
    const ws = []; let sum = 0;
    for (let k = lo; k <= hi; k++) { const wgt = lanczos(c - k); ws.push([clamp(k, 0, sN - 1), wgt]); sum += wgt; }
    if (horizontal) for (let y = 0; y < dh; y++) { let a = 0; for (const [k, wgt] of ws) a += src[y * sw + k] * wgt; out[y * dw + o] = a / sum; }
    else for (let x = 0; x < dw; x++) { let a = 0; for (const [k, wgt] of ws) a += src[k * sw + x] * wgt; out[o * dw + x] = a / sum; }
  }
  return out;
}
function upscale(img, k) {
  const dw = img.w * k, dh = img.h * k;
  const tmp = resample1D(img.g, img.w, img.h, dw, img.h, true);
  const full = resample1D(tmp, dw, img.h, dw, dh, false);
  return { w: dw, h: dh, f: full };
}

// → ภาพขาวดำพร้อมส่ง Tesseract: ตัวอักษรสีขาวในเกม = ดำบนพื้นขาว, เติมขอบขาว 24px
export function prepare(bm, box, { thr, scale, mode = "min" }) {
  const c = cropChannel(bm, box[0], box[1], box[2], box[3], mode);
  const up = upscale(c, scale);
  const pad = 24, w = up.w + pad * 2, h = up.h + pad * 2;
  const g = new Uint8Array(w * h).fill(255);
  for (let y = 0; y < up.h; y++) for (let x = 0; x < up.w; x++) g[(y + pad) * w + x + pad] = up.f[y * up.w + x] > thr ? 0 : 255;
  return { w, h, g };
}

// ───────────── reading primitives ─────────────
const DIGITS = "0123456789 ";
const VARIANTS = (scales) => [90, 100, 110, 120, 130, 150].flatMap(t => scales.map(s => ({ thr: t, scale: s })));
// หน้าสรุป: 4 แบบพอ (ทดสอบกับภาพจริง 1837x866 ได้ถูกครบ 10/10 แถว ; ชุด 12 แบบเดิมช้ากว่า 3 เท่าโดยไม่แม่นขึ้น)
const V_SUMMARY = [{ thr: 100, scale: 3 }, { thr: 120, scale: 3 }, { thr: 110, scale: 4 }, { thr: 130, scale: 4 }];
// ชุดสำรองสำหรับช่องที่ชุดมาตรฐานอ่านไม่ได้ (12 แบบ)
const V_WIDE = [90, 100, 110, 120, 130, 150].flatMap(thr => [3, 4].map(scale => ({ thr, scale })));
const V_SCORE = [110, 130, 150, 170].map(thr => ({ thr, scale: 3 }));
const V_DAMAGE = VARIANTS([2, 3, 4]);

// ความกว้างของหมึก (หน่วย = พิกเซลภาพจริง) ระหว่างหลักแรกถึงหลักสุดท้าย — เลข 2 หลักกว้างกว่า 1 หลักชัดเจน
export function inkWidth(img, scale) {
  let a = -1, b = -1;
  for (let x = 0; x < img.w; x++) {
    let dark = false;
    for (let y = 0; y < img.h; y++) if (img.g[y * img.w + x] < 128) { dark = true; break; }
    if (dark) { if (a < 0) a = x; b = x; }
  }
  return a < 0 ? 0 : (b - a + 1) / scale;
}

async function readNumbers(recognize, bm, box, count, variants, opts = {}) {
  const reads = [];
  let ink = null;
  for (const v of variants) {
    const prep = prepare(bm, box, { ...v, mode: opts.mode });
    if (ink === null) ink = inkWidth(prep, v.scale);
    const txt = await recognize(prep, { whitelist: opts.whitelist || DIGITS });
    const nums = opts.join ? [(txt.match(/\d/g) || []).join("")].filter(Boolean) : (txt.match(/\d+/g) || []);
    if (nums.length === count) reads.push(nums);
  }
  if (!reads.length) return { values: null, conf: 0, ink };
  const values = []; let conf = 1;
  for (let j = 0; j < count; j++) {
    const tally = new Map(); for (const r of reads) tally.set(r[j], (tally.get(r[j]) || 0) + 1);
    const [val, cnt] = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
    values.push(val); conf = Math.min(conf, cnt / reads.length);
  }
  return { values, conf, ink };
}

async function readPercents(recognize, bm, box) {
  for (const thr of [110, 130, 150]) {
    const txt = await recognize(prepare(bm, box, { thr, scale: 3 }), { whitelist: "0123456789.% " });
    const p = (txt.match(/\d+\.\d/g) || []).map(Number);
    if (p.length >= 2) return p;
  }
  return null;
}

// ───────────── layouts (พิกัดอ้างอิงจากภาพสูง 870 / 1206 px แล้วสเกลตามความสูงจริง) ─────────────
// พิกัดวัดจากภาพหน้าสรุปจริง (สูง 866px) แล้วสเกลตามความสูงภาพ — อ่านทีละช่อง (K / D / A / ทอง) ไม่อ่านทั้งบรรทัด
// เพราะเครื่องหมาย "/" ทำให้ Tesseract อ่านเป็นตัวเลขปนเข้ามา (ทดสอบแล้วอ่านทั้งบรรทัดผิดเกือบทุกแถว)
const SUMMARY = {
  baseH: 866, rows: [226, 337, 447, 558, 669], half: 22,
  cols: {
    blue: { K: [600, 650], D: [658, 700], A: [705, 748], G: [760, 845] },
    red: { K: [1375, 1425], D: [1430, 1475], A: [1480, 1530], G: [1540, 1620] },
  },
  score: [[655, 765], [1080, 1190]], scoreY: [8, 82],
  thumb: { blue: [152, 300], red: [920, 1070] },
};
const DAMAGE = {
  baseH: 1206, rows: [320, 474, 629, 783, 938], half: 26,
  blue: [0, 660], red: [1075, 1740],
};

// ───────────── หาตำแหน่งตารางหน้าสรุปจากภาพเอง (รองรับหลายขนาด/สัดส่วน/ขอบดำ/ครอปต่างกัน) ─────────────
// แถบหัวตารางฝั่งแดงเป็นสีแดงอิ่มตัวชัดและไม่มีสีอื่นในภาพที่คล้าย → ใช้เป็นจุดอ้างอิง
// ได้ ขนาด s (เท่าของภาพอ้างอิง) และ จุดเลื่อน ox,oy ; แล้วแปลงพิกัดอ้างอิงทุกตัว: x_จริง = ox + x*s, y_จริง = oy + y*s
// (ภาพอ้างอิง = ภาพสูง 866px ที่วัดพิกัดไว้ ; ถือว่าตารางถูกย่อ/ขยายเท่ากันทั้งสองแกน)
const REF_BAR = { left: 920, right: 1684, top: 126, bottom: 173 };   // วัดจากภาพอ้างอิงด้วยตัวตรวจเดียวกัน → ภาพอ้างอิงได้ s=1, ox=oy=0
const isRedBar = (r, g, b) => r >= 85 && r >= 2.2 * g && r >= 1.3 * b;

export function findSummaryLayout(bm) {
  if (!bm || !bm.data || !bm.width || !bm.height) return null;
  const { width: W, height: H, data } = bm;
  // 1) นับพิกเซลแดงต่อแถว → หาแถบแนวนอนที่แดงเกือบทั้งแถว (ต่อเนื่อง ยอมให้ขาดได้ 1 แถว)
  const rc = new Int32Array(H); let max = 0;
  for (let y = 0; y < H; y++) {
    let c = 0; const o = y * W * 4;
    for (let x = 0; x < W; x++) { const i = o + x * 4; if (isRedBar(data[i], data[i + 1], data[i + 2])) c++; }
    rc[y] = c; if (c > max) max = c;
  }
  if (max < W * 0.12) return null;
  const thr = max * 0.6;
  let best = null;
  for (let y = 0; y < H;) {
    if (rc[y] < thr) { y++; continue; }
    let y0 = y, y1 = y, miss = 0;
    for (let k = y + 1; k < H; k++) {
      if (rc[k] >= thr) { y1 = k; miss = 0; } else if (++miss > 1) break;
    }
    if (!best || y1 - y0 > best[1] - best[0]) best = [y0, y1];
    y = y1 + 2;
  }
  if (!best) return null;
  const [y0, y1] = best, rows = y1 - y0 + 1;
  // 2) ขอบซ้าย/ขวาของแถบ: คอลัมน์ที่แดงอย่างน้อย 20% ของแถวในแถบ (ไอคอนสีขาวบนแถบทำให้บางคอลัมน์ขาด แต่ปลายทั้งสองยังแดง)
  let left = -1, right = -1;
  for (let x = 0; x < W; x++) {
    let c = 0;
    for (let y = y0; y <= y1; y++) { const i = (y * W + x) * 4; if (isRedBar(data[i], data[i + 1], data[i + 2])) c++; }
    if (c >= rows * 0.2) { if (left < 0) left = x; right = x; }
  }
  if (left < 0) return null;
  const width = right - left + 1, refW = REF_BAR.right - REF_BAR.left + 1, refH = REF_BAR.bottom - REF_BAR.top + 1;
  const s = width / refW;
  // 3) ตรวจสัดส่วนความหนาแถบ/ความกว้างให้ใกล้ภาพอ้างอิง (±35%) — กันจับสีแดงอื่นที่ไม่ใช่แถบหัวตาราง
  if (width < W * 0.2 || rows / s < refH * 0.65 || rows / s > refH * 1.35) return null;
  return { s, ox: left - REF_BAR.left * s, oy: y0 - REF_BAR.top * s, anchored: true };
}

function summaryMap(bm) {
  return findSummaryLayout(bm) || { s: bm.height / SUMMARY.baseH, ox: 0, oy: 0, anchored: false };
}

export function detectKind(bm) {
  if (findSummaryLayout(bm)) return "summary";
  // ตัวสำรอง (ไม่มีข้อมูลพิกเซล หรือหาแถบไม่เจอ): หน้าสรุปกว้างมาก (~2.16:1); หน้า "ข้อมูล" ~1.45–1.7:1
  return bm.width / bm.height >= 1.9 ? "summary" : "damage";
}

// ───────────── summary ─────────────
// เลข 2 หลักที่ซ้ำกัน (เช่น 11) บางครั้งถูกอ่านเป็นหลักเดียว → ตัวเลือกแก้ = ซ้ำหลักใดหลักหนึ่ง (1→11, 2→22, 12→112/122)
function dupDigits(n) {
  const t = String(n), out = new Set();
  for (let i = 0; i < t.length; i++) out.add(+(t.slice(0, i + 1) + t[i] + t.slice(i + 1)));
  return [...out].filter(v => v !== n && v <= 99);
}

/**
 * ตรวจ/แก้ด้วยกฎของเกม: คิลรวมทีม = สกอร์ทีม = เดธรวมของทีมตรงข้าม
 *  - ใช้ค่าที่ตรงกันอย่างน้อย 2 ใน 3 เป็นเป้า ; ถ้าผลรวมของ K (หรือ D ฝั่งตรงข้าม) ไม่ตรงเป้า
 *    จะแก้เฉพาะเมื่อมี "ช่องเดียว" ที่ซ้ำหลักแล้วผลรวมลงตัว (ถ้ามีหลายช่อง ใช้ความกว้างหมึกของช่องนั้นตัดสิน ต้องกว้างกว่าอย่างชัดเจน)
 *  - ช่องที่แก้จะติด _flag และมีข้อความบอก ; ถ้าแก้ไม่ได้ จะเตือนให้ตรวจเอง
 * teams: [{rows},{rows}] (rows[i].kills/deaths, _inkK/_inkD ถ้ามี) ; score: [s0,s1] (null ได้)
 */
export function fixByConstraints(teams, score) {
  const warnings = [];
  const sum = (rows, k) => rows.reduce((a, r) => a + (r[k] ?? 0), 0);
  const nm = t => (t === 0 ? "ซ้าย" : "ขวา");
  for (let t = 0; t < 2; t++) {
    const o = 1 - t;
    const cand = [score?.[t], sum(teams[o].rows, "deaths"), sum(teams[t].rows, "kills")].filter(v => v != null);
    const tally = new Map(); cand.forEach(v => tally.set(v, (tally.get(v) || 0) + 1));
    const top = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
    if (!top) continue;
    if (top[1] < 2) {
      if (tally.size > 1) warnings.push(`ทีม${nm(t)}: สกอร์/คิลรวม/เดธรวมฝั่งตรงข้ามไม่ตรงกัน (${cand.join(" / ")}) — ตรวจเลขของแถวที่ ⚠️`);
      continue;
    }
    const target = top[0];
    for (const [rows, key, label, inkKey, who] of [[teams[t].rows, "kills", "K", "_inkK", t], [teams[o].rows, "deaths", "D", "_inkD", o]]) {
      const cur = sum(rows, key);
      if (cur === target) continue;
      const fixes = [];
      rows.forEach((r, i) => { if (r[key] != null) for (const v of dupDigits(r[key])) if (cur - r[key] + v === target) fixes.push({ i, v }); });
      let pick = fixes.length === 1 ? fixes[0] : null;
      if (!pick && fixes.length > 1) {
        const w = f => rows[f.i][inkKey];
        const sorted = [...fixes].sort((a, b) => (w(b) ?? 0) - (w(a) ?? 0));
        const widest = w(sorted[0]), next = w(sorted[1]);
        if (widest && next && widest >= next * 1.4) pick = sorted[0];
      }
      if (pick) {
        const r = rows[pick.i];
        warnings.push(`แก้อัตโนมัติ: ทีม${nm(who)} แถว ${pick.i + 1} ${label} ${r[key]} → ${pick.v} (ให้ผลรวมตรงกับ ${target}) — เทียบกับภาพอีกครั้ง`);
        r[key] = pick.v; r._flag = true;
      } else {
        warnings.push(`ทีม${nm(who)}: ผลรวม ${label} ที่อ่านได้ ${cur} ไม่ตรงกับ ${target} และระบบแก้เองไม่ได้ — ตรวจ ${label} ของทีมนี้กับภาพ`);
        rows.forEach(r => { r._flag = true; });
      }
    }
  }
  return warnings;
}

export async function readSummary(bm, recognize, onStep = () => {}) {
  const m = summaryMap(bm); const L = SUMMARY;
  const X = x => m.ox + x * m.s, Y = y => m.oy + y * m.s;
  const teams = [[], []]; const warnings = [];
  if (!m.anchored) warnings.push("หาแถบหัวตารางในภาพไม่เจอ — ใช้ค่าประมาณจากขนาดภาพ ผลอาจเพี้ยน (ลองภาพที่เห็นตารางครบทั้งสองฝั่ง)");
  const KEYS = [["K", "kills"], ["D", "deaths"], ["A", "assists"], ["G", "gold"]];
  for (let t = 0; t < 2; t++) {
    const cols = t === 0 ? L.cols.blue : L.cols.red;
    for (let i = 0; i < L.rows.length; i++) {
      const y0 = Y(L.rows[i] - L.half), y1 = Y(L.rows[i] + L.half);
      const row = { conf: 1 };
      for (const [c, key] of KEYS) {
        const box = [X(cols[c][0]), y0, X(cols[c][1]), y1], o = { whitelist: "0123456789", join: true };
        let r = await readNumbers(recognize, bm, box, 1, V_SUMMARY, o);
        // อ่านไม่ได้เลยในชุดมาตรฐาน (ภาพมืด/เบลอ) → ลองชุดกว้างขึ้นเฉพาะช่องนี้ (ช้าลงแค่ตอนจำเป็น)
        if (!r.values) { const r2 = await readNumbers(recognize, bm, box, 1, V_WIDE, o); if (r2.values) r = { ...r2, ink: r.ink ?? r2.ink }; }
        if (c === "K") row._inkK = r.ink;
        if (c === "D") row._inkD = r.ink;
        if (r.values) { row[key] = +r.values[0]; row.conf = Math.min(row.conf, r.conf); } else row.conf = 0;
      }
      teams[t].push(row); onStep();
    }
  }
  const score = [];
  for (const [x0, x1] of L.score) {
    const r = await readNumbers(recognize, bm, [X(x0), Y(L.scoreY[0]), X(x1), Y(L.scoreY[1])], 1, V_SCORE, { mode: "max", whitelist: "0123456789", join: true });
    score.push(r.values ? +r.values[0] : null);
  }
  warnings.push(...fixByConstraints(teams.map(rows => ({ rows })), score));
  teams.forEach(rows => rows.forEach(r => {
    if (r.kills === undefined || r.deaths === undefined || r.assists === undefined || r.gold === undefined) r.unread = true;
    delete r._inkK; delete r._inkD;
  }));
  return { kind: "summary", teams, score, warnings };
}

// กรอบรูปโปรไฟล์ฮีโร่ของแต่ละแถว (พิกเซลของภาพจริง) — ใช้ตัดภาพย่อให้ผู้ใช้เห็นว่าแถวไหนคือฮีโร่ตัวไหน ตอนเลือก slot
export function summaryThumbBoxes(bm) {
  const m = summaryMap(bm);
  return [SUMMARY.thumb.blue, SUMMARY.thumb.red].map(([x0, x1]) =>
    SUMMARY.rows.map(y => [m.ox + x0 * m.s, m.oy + (y - 40) * m.s, m.ox + x1 * m.s, m.oy + (y + 40) * m.s]));
}

// ───────────── damage ─────────────
function median(a) { const b = [...a].sort((x, y) => x - y); const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; }

// ใช้ % ที่เกมแสดงตรวจ/แก้ดาเมจ: หา "ผลรวมทีม" จาก median(ค่า ÷ %) แล้วลองแก้ทีละหลักที่ทำให้ตรง
export function fixByPercent(rows, idx, key, tol = 0.35) {
  for (let pass = 0; pass < 2; pass++) {
    const ests = rows.filter(r => r[key] != null && r.pct && r.pct[idx] > 0).map(r => r[key] / (r.pct[idx] / 100));
    if (ests.length < 3) return;
    const T = median(ests);
    for (const r of rows) {
      if (r[key] == null || !r.pct || r.pct[idx] == null) continue;
      const err = Math.abs(r[key] / T * 100 - r.pct[idx]);
      if (err <= tol) continue;
      const s = String(r[key]); let best = [err, s];
      for (let i = 0; i < s.length; i++) for (const d of "0123456789") {
        if (d === s[i] || (i === 0 && d === "0")) continue;
        const cand = s.slice(0, i) + d + s.slice(i + 1);
        const e = Math.abs(+cand / T * 100 - r.pct[idx]);
        if (e < best[0]) best = [e, cand];
      }
      if (best[1] !== s && best[0] <= tol) { r[key] = +best[1]; r.fixed = (r.fixed || []).concat(key); }
      else if (best[1] === s) r.suspect = (r.suspect || []).concat(key);
    }
  }
}

export async function readDamage(bm, recognize, onStep = () => {}) {
  const s = bm.height / DAMAGE.baseH; const L = DAMAGE;
  const teams = [[], []]; const warnings = [];
  for (let t = 0; t < 2; t++) {
    const [x0, x1] = t === 0 ? L.blue : L.red;
    for (let i = 0; i < L.rows.length; i++) {
      const y = L.rows[i];
      const nums = await readNumbers(recognize, bm, [x0 * s, (y - L.half) * s, Math.min(x1 * s, bm.width), (y + L.half) * s], 3, V_DAMAGE);
      const pct = await readPercents(recognize, bm, [x0 * s, (y + 25) * s, Math.min(x1 * s, bm.width), (y + 72) * s]);
      const row = { conf: nums.conf, pct };
      if (nums.values) { row.damage = +nums.values[0]; row.damageTaken = +nums.values[1]; row.fights = +nums.values[2]; }
      teams[t].push(row); onStep();
    }
    fixByPercent(teams[t], 0, "damage"); fixByPercent(teams[t], 1, "damageTaken");
    teams[t].forEach(r => { if (r.damage === undefined) r.unread = true; });
    const fixed = teams[t].filter(r => r.fixed).length;
    if (fixed) warnings.push(`ทีม${t === 0 ? "ซ้าย" : "ขวา"}: แก้ดาเมจอัตโนมัติ ${fixed} แถวโดยเทียบกับ % ในภาพ — ตรวจอีกครั้ง`);
  }
  const score = [];
  return { kind: "damage", teams, score, warnings };
}

// ───────────── orchestrator ─────────────
/**
 * @param {Array<{bitmap, kind?:"summary"|"damage"}>} images  ภาพ 1–2 รูป (สรุป + ข้อมูล)
 * @param {(img:{w,h,g:Uint8Array}, o:{whitelist:string})=>Promise<string>} recognize
 * @returns {{teams:[{rows:Array},{rows:Array}], warnings:string[], kinds:string[], flags:Object}}
 *   teams[*].rows[i] = { kills, deaths, assists, gold, damage, damageTaken, _flag? } — shape เดียวกับที่ mapScoreboard() รับอยู่
 */
export async function readScoreboards(images, recognize, onStep = () => {}) {
  const merged = [[{}, {}, {}, {}, {}], [{}, {}, {}, {}, {}]];
  const warnings = []; const kinds = [];
  for (const img of images) {
    const kind = img.kind && img.kind !== "auto" ? img.kind : detectKind(img.bitmap);
    kinds.push(kind);
    const r = kind === "summary" ? await readSummary(img.bitmap, recognize, onStep) : await readDamage(img.bitmap, recognize, onStep);
    warnings.push(...r.warnings);
    r.teams.forEach((rows, t) => rows.forEach((row, i) => {
      const { conf, pct, fights, fixed, suspect, unread, ...vals } = row;
      Object.assign(merged[t][i], vals);
      const low = (conf ?? 1) < 0.6 || unread || (suspect && suspect.length);
      if (low || fixed) merged[t][i]._flag = true;
    }));
  }
  return { teams: merged.map(rows => ({ rows })), warnings, kinds };
}
