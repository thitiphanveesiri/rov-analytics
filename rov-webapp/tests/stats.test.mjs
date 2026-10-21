import assert from "node:assert/strict";
import { wilsonLower, compareByConfidence, isLowSample } from "../lib/stats.js";
// 2/2 (100%) ต้องแพ้ 40/50 (80%)
const small = { games: 2, wins: 2 }, big = { games: 50, wins: 40 };
assert.ok(wilsonLower(2, 2) < wilsonLower(40, 50));
assert.deepEqual([small, big].sort(compareByConfidence), [big, small]);
// 1/1 ไม่เกิน ~0.21 ; n=0 = 0 ; ค่าอยู่ใน [0,1] และไม่เกิน WR ดิบ
assert.ok(wilsonLower(1, 1) < 0.25); assert.equal(wilsonLower(0, 0), 0);
for (const [w, n] of [[0,5],[5,5],[3,10],[50,100]]) { const v = wilsonLower(w, n); assert.ok(v >= 0 && v <= w / n + 1e-9); }
// n เท่าๆ กัน → WR สูงกว่าชนะ ; ใช้ได้กับฟิลด์ total (suggestion)
assert.deepEqual([{ total: 10, wins: 5 }, { total: 10, wins: 8 }].sort(compareByConfidence).map(x => x.wins), [8, 5]);
assert.ok(isLowSample(4) && !isLowSample(5));
console.log("stats tests ok");
