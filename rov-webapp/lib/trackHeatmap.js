// lib/trackHeatmap.js
// ── Pure functions (ไม่มี React/DOM) สำหรับหน้า Heatmap ──
// ข้อมูลเข้า = ไฟล์ tracks.json จากเครื่องมือ rov-tracker/track.py
//   { version:1, minimap:"data:image/jpeg;base64,...", heroes:[{key,side,hero,player}],
//     tracks:{ "our:0":[[t,x,y,conf],...], ... }, coverage:{key:0..1}, source:{...} }
//   t = วินาทีในเกม, x,y = 0..1 ภายในมินิแมพ, conf = ความมั่นใจ 0..1 (0.2 = ช่วงที่เติมช่องว่างด้วยการประมาณ)

export const PHASES = [
  { id: "all", label: "ทั้งเกม", from: 0, to: Infinity },
  { id: "p1", label: "0–4 นาที", from: 0, to: 240 },
  { id: "p2", label: "4–8 นาที", from: 240, to: 480 },
  { id: "p3", label: "8–12 นาที", from: 480, to: 720 },
  { id: "p4", label: "12 นาที+", from: 720, to: Infinity },
];

export function parseTracks(raw) {
  const j = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!j || j.version !== 1 || !Array.isArray(j.heroes) || typeof j.tracks !== "object") {
    throw new Error("ไฟล์นี้ไม่ใช่ tracks.json จาก rov-tracker (version 1)");
  }
  const tracks = {};
  for (const h of j.heroes) {
    const pts = Array.isArray(j.tracks[h.key]) ? j.tracks[h.key] : [];
    // กรองค่าผิดปกติ (นอกช่วง 0..1 หรือไม่ใช่ตัวเลข) กันไฟล์เสียทำให้วาดพัง
    tracks[h.key] = pts.filter(p => Array.isArray(p) && p.length >= 4 &&
      p.slice(0, 4).every(Number.isFinite) && p[1] >= 0 && p[1] <= 1 && p[2] >= 0 && p[2] <= 1);
  }
  return { ...j, tracks };
}

// รายการตัวเลือก: ฮีโร่ (👤 ผู้เล่น ถ้ามี) จากทุกไฟล์ ไม่ซ้ำ
export function listChoices(sources) {
  const seen = new Map();
  for (const s of sources) {
    for (const h of s.heroes) {
      if (h.hero) seen.set("hero:" + h.hero, { id: "hero:" + h.hero, label: h.hero });
      if (h.player) seen.set("player:" + h.player, { id: "player:" + h.player, label: "👤 " + h.player });
    }
  }
  return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label, "th"));
}

function matches(h, choiceId) {
  if (!choiceId) return false;
  const [kind, ...rest] = choiceId.split(":");
  const val = rest.join(":");
  return kind === "hero" ? h.hero === val : h.player === val;
}

// รวมจุดของตัวเลือกหนึ่งจากทุกไฟล์ ในช่วงเวลาที่เลือก → { points:[[x,y,w]], seen, total }
export function collectPoints(sources, choiceId, phase, minConf = 0) {
  const pts = [];
  let seen = 0, total = 0;
  for (const s of sources) {
    for (const h of s.heroes) {
      if (!matches(h, choiceId)) continue;
      for (const p of s.tracks[h.key] || []) {
        if (p[0] < phase.from || p[0] >= phase.to) continue;
        total++;
        if (p[3] >= 0.25) seen++;            // นับเฉพาะจุดที่ "เห็นจริง" ไม่รวมที่ประมาณ
        if (p[3] >= minConf) pts.push([p[1], p[2], p[3] >= 0.25 ? 1 : 0.4]);
      }
    }
  }
  return { points: pts, seen, total };
}

// วางแต้มแบบเกาส์เซียนลงกริด size×size แล้ว normalize เป็น 0..1 (ตามค่าสูงสุดของกริดนั้น)
export function buildDensity(points, size = 96, sigma = 0.03) {
  const grid = new Float32Array(size * size);
  if (!points.length) return grid;
  const rad = Math.max(1, Math.ceil(sigma * size * 3));
  const inv = 1 / (2 * (sigma * size) ** 2);
  for (const [px, py, w] of points) {
    const cx = px * (size - 1), cy = py * (size - 1);
    const x0 = Math.max(0, Math.floor(cx - rad)), x1 = Math.min(size - 1, Math.ceil(cx + rad));
    const y0 = Math.max(0, Math.floor(cy - rad)), y1 = Math.min(size - 1, Math.ceil(cy + rad));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d2 = (x - cx) ** 2 + (y - cy) ** 2;
        grid[y * size + x] += w * Math.exp(-d2 * inv);
      }
    }
  }
  let max = 0;
  for (let i = 0; i < grid.length; i++) if (grid[i] > max) max = grid[i];
  if (max > 0) for (let i = 0; i < grid.length; i++) grid[i] /= max;
  return grid;
}

// 0..1 → สี (น้ำเงิน → ฟ้า → เขียว → เหลือง → แดง) คืน [r,g,b]
export function heatColor(v) {
  const stops = [[0, [20, 40, 200]], [0.25, [0, 170, 255]], [0.5, [40, 220, 90]], [0.75, [255, 220, 0]], [1, [255, 40, 0]]];
  const x = Math.min(1, Math.max(0, v));
  for (let i = 1; i < stops.length; i++) {
    if (x <= stops[i][0]) {
      const [a, ca] = stops[i - 1], [b, cb] = stops[i];
      const t = (x - a) / (b - a);
      return ca.map((c, k) => Math.round(c + (cb[k] - c) * t));
    }
  }
  return stops[stops.length - 1][1];
}

// กริดความหนาแน่น → ImageData-พร้อมใช้ (Uint8ClampedArray RGBA) ; ค่าต่ำกว่า cutoff โปร่งใส
export function densityToRGBA(grid, cutoff = 0.06, maxAlpha = 210) {
  const out = new Uint8ClampedArray(grid.length * 4);
  for (let i = 0; i < grid.length; i++) {
    const v = grid[i];
    if (v < cutoff) continue;
    const [r, g, b] = heatColor(v);
    out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = b;
    out[i * 4 + 3] = Math.round(maxAlpha * Math.min(1, (v - cutoff) / 0.25));
  }
  return out;
}

// เส้นทางเดินของตัวเลือกจากไฟล์แรกที่มี (เรียงตามเวลา) ใช้วาด trail
export function collectPath(sources, choiceId, phase) {
  for (const s of sources) {
    for (const h of s.heroes) {
      if (!matches(h, choiceId)) continue;
      const path = (s.tracks[h.key] || []).filter(p => p[0] >= phase.from && p[0] < phase.to && p[3] >= 0.25);
      if (path.length) return path.map(p => [p[1], p[2]]);
    }
  }
  return [];
}
