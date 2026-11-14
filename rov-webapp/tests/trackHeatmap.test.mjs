import assert from "node:assert/strict";
import { parseTracks, listChoices, collectPoints, buildDensity, densityToRGBA, collectPath, PHASES } from "@/lib/trackHeatmap";

const raw = {
  version: 1,
  heroes: [{ key: "our:0", side: "our", hero: "Nakroth", player: "Tamyn" }, { key: "enemy:0", side: "enemy", hero: "Airi", player: "" }],
  tracks: {
    "our:0": [[10, 0.2, 0.2, 0.9], [100, 0.2, 0.22, 0.8], [250, 0.8, 0.8, 0.9], [260, 0.5, 0.5, 0.2], [300, 9, 9, 0.9], ["x", 1, 1, 1]],
    "enemy:0": [[10, 0.9, 0.1, 0.9]],
  },
};
const src = parseTracks(JSON.stringify(raw));
assert.equal(src.tracks["our:0"].length, 4, "ต้องกรองจุดนอกช่วง/ไม่ใช่ตัวเลขทิ้ง");
assert.throws(() => parseTracks({ version: 2, heroes: [], tracks: {} }));

assert.deepEqual(listChoices([src]).map(c => c.id).sort(), ["hero:Airi", "hero:Nakroth", "player:Tamyn"]);

const p1 = PHASES.find(p => p.id === "p1"), p2 = PHASES.find(p => p.id === "p2");
const a = collectPoints([src], "player:Tamyn", p1);
assert.equal(a.points.length, 2); assert.equal(a.seen, 2); assert.equal(a.total, 2);
const b = collectPoints([src], "hero:Nakroth", p2);
assert.equal(b.total, 2); assert.equal(b.seen, 1, "จุด conf 0.2 ไม่นับเป็น 'เห็นจริง'");
assert.equal(collectPoints([src, src], "hero:Nakroth", PHASES[0]).total, 8, "รวมหลายไฟล์");
assert.equal(collectPoints([src], "hero:Nobody", PHASES[0]).total, 0);

const g = buildDensity(a.points, 64, 0.03);
let max = 0, argmax = 0; g.forEach((v, i) => { if (v > max) { max = v; argmax = i; } });
assert.ok(Math.abs(max - 1) < 1e-6, "normalize เป็น 1");
const ax = argmax % 64 / 63, ay = Math.floor(argmax / 64) / 63;
assert.ok(Math.abs(ax - 0.2) < 0.05 && Math.abs(ay - 0.21) < 0.05, "จุดร้อนอยู่ใกล้ตำแหน่งข้อมูล");
assert.equal(buildDensity([], 16).every(v => v === 0), true);

const rgba = densityToRGBA(g);
assert.equal(rgba.length, 64 * 64 * 4);
assert.equal(rgba[0 * 4 + 3], 0, "ที่ไกลจากจุดข้อมูลต้องโปร่งใส");
assert.ok(rgba[argmax * 4 + 3] > 150, "จุดร้อนต้องทึบ");

assert.deepEqual(collectPath([src], "hero:Nakroth", PHASES[0]).length, 3);
console.log("trackHeatmap tests ok");
