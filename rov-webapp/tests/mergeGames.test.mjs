import assert from "node:assert/strict";
import { mergeListThreeWay, mergeRecordWithGames, mergeWithBase } from "../lib/storage.js";
const g = (n, extra = {}) => ({ gameNo: n, result: "WIN", ...extra });
const base  = { id: 1, rivalName: "A", note: "", games: [g(1), g(2)] };
// A กรอก stats G1, B กรอก objectives G2 → ต้องได้ทั้งคู่
const local = { ...base, games: [g(1, { gameStats: { our: { 0: { kills: 5 } } } }), g(2)] };
const fresh = { ...base, games: [g(1), g(2, { objectives: { turret: 3 } })] };
let r = mergeRecordWithGames(base, local, fresh);
assert.deepEqual(r.games[0].gameStats, { our: { 0: { kills: 5 } } });
assert.deepEqual(r.games[1].objectives, { turret: 3 });
// field ระดับ match คนละ key → รวมกัน
r = mergeRecordWithGames(base, { ...base, note: "mine" }, { ...base, rivalName: "B" });
assert.equal(r.note, "mine"); assert.equal(r.rivalName, "B");
// เกมเดียวกัน แก้ทั้งคู่ → server ชนะ (เกมนั้น) แต่เกมอื่นของ local ยังอยู่
r = mergeRecordWithGames(base,
  { ...base, games: [g(1, { note: "L" }), g(2, { note: "L2" })] },
  { ...base, games: [g(1, { note: "S" }), g(2)] });
assert.equal(r.games[0].note, "S"); assert.equal(r.games[1].note, "L2");
// เกมใหม่ฝั่ง local (G3) + server แก้ G1 → ได้ทั้งคู่ เรียงตาม gameNo
r = mergeRecordWithGames(base, { ...base, games: [...base.games, g(3)] }, { ...base, games: [g(1, { note: "S" }), g(2)] });
assert.deepEqual(r.games.map(x => x.gameNo), [1, 2, 3]); assert.equal(r.games[0].note, "S");
// server ลบเกม (ไม่ฟื้นคืนชีพถ้า local ไม่ได้แก้)
r = mergeRecordWithGames(base, { ...base, note: "x" }, { ...base, games: [g(1)] });
assert.deepEqual(r.games.map(x => x.gameNo), [1]);
// ไม่ใช่ array ทั้งสองฝั่ง → server ชนะทั้งก้อน
const flatBase = { id: 2, gameStats: {}, result: "WIN" };
r = mergeRecordWithGames(flatBase, { ...flatBase, gameStats: { a: 1 } }, { ...flatBase, objectives: { x: 1 }, games: undefined });
assert.deepEqual(r.gameStats, { a: 1 }); assert.deepEqual(r.objectives, { x: 1 }); // single-game: รวมระดับ key
// ผ่าน mergeListThreeWay + mergeWithBase (ใช้จริงใน storage)
const L = mergeListThreeWay([base], [local], [fresh], x => x.id, mergeRecordWithGames);
assert.equal(L.length, 1); assert.ok(L[0].games[0].gameStats && L[0].games[1].objectives);
const M = mergeWithBase({ matches: [base] }, { matches: [local] }, { matches: [fresh] });
assert.ok(M.matches[0].games[0].gameStats && M.matches[0].games[1].objectives);
// ไม่มี mergeItem → พฤติกรรมเดิม (server ชนะ)
assert.deepEqual(mergeListThreeWay([base], [local], [fresh], x => x.id)[0], fresh);
console.log("mergeGames tests ok");
