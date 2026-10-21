// รัน: esbuild tests/playedAt.test.mjs --bundle --platform=node --format=esm --alias:@=. --outfile=/tmp/playedAt.test.mjs && node /tmp/playedAt.test.mjs
import assert from "node:assert/strict";
import { matchTime, toDatetimeLocal, fromDatetimeLocal, formatMatchDate } from "../lib/matchTime.js";
import { appReducer, initAppState } from "../components/common/appState.js";
import { filterMatchesByPatch } from "../components/common/patchUtils.js";

// matchTime: playedAt ก่อน, ไม่มี → id
assert.equal(matchTime({ id: 5, playedAt: 9 }), 9);
assert.equal(matchTime({ id: 5 }), 5);
assert.equal(matchTime({ id: 5, playedAt: "x" }), 5);
assert.equal(matchTime(null), 0);
// datetime-local round trip (นาที)
const ms = new Date(2026, 6, 7, 20, 30).getTime();
assert.equal(fromDatetimeLocal(toDatetimeLocal(ms)), ms);
assert.equal(fromDatetimeLocal(""), null);

// SAVE_MATCH: กรอกย้อนหลัง → playedAt/date ตามที่กรอก ส่วน id ยังเป็นเวลาบันทึก
const past = new Date(2026, 5, 1, 12, 0).getTime();
let st = appReducer(initAppState(), { type: "SAVE_MATCH", payload: { rivalName: "A", games: [], playedAt: past } });
let m = st.matches[0];
assert.equal(m.playedAt, past); assert.equal(m.date, formatMatchDate(past)); assert.ok(m.id > past);
// ไม่กรอก → playedAt = id
st = appReducer(initAppState(), { type: "SAVE_MATCH", payload: { rivalName: "A", games: [] } });
assert.equal(st.matches[0].playedAt, st.matches[0].id);
// playedAt ผิดรูปแบบ (null/NaN) ไม่ทำให้พัง
st = appReducer(initAppState(), { type: "SAVE_MATCH", payload: { rivalName: "A", games: [], playedAt: null } });
assert.equal(st.matches[0].playedAt, st.matches[0].id);

// UPDATE_MATCH_META: แก้เวลาแล้ว date เปลี่ยนตาม; ไม่ส่ง playedAt = ไม่แตะ
const base = { ...initAppState(), matches: [{ id: 1000, date: "x", rivalName: "A" }] };
st = appReducer(base, { type: "UPDATE_MATCH_META", payload: { id: 1000, rivalName: "A", playedAt: past } });
assert.equal(st.matches[0].playedAt, past); assert.equal(st.matches[0].date, formatMatchDate(past));
st = appReducer(base, { type: "UPDATE_MATCH_META", payload: { id: 1000, rivalName: "B", playedAt: undefined } });
assert.equal("playedAt" in st.matches[0], false); assert.equal(st.matches[0].rivalName, "B");

// patch filter ใช้ playedAt: แมตช์ที่บันทึกวันนี้แต่แข่งก่อน patch ใหม่ ต้องอยู่ patch เก่า
const patches = [
  { version: "1.0", effectiveFrom: "2026-01-01" },
  { version: "2.0", effectiveFrom: "2026-06-15" },
];
const matches = [
  { id: Date.now(), playedAt: past, rivalName: "late-entry" },   // แข่ง 1 มิ.ย. บันทึกวันนี้
  { id: Date.now() + 1, rivalName: "legacy-no-playedAt" },       // เก่า: ใช้ id (= วันนี้ ⇒ patch 2.0)
];
const inOld = filterMatchesByPatch(matches, patches, "1.0").map(x => x.rivalName);
const inNew = filterMatchesByPatch(matches, patches, "2.0").map(x => x.rivalName);
assert.deepEqual(inOld, ["late-entry"]);
assert.deepEqual(inNew, ["legacy-no-playedAt"]);
console.log("playedAt tests ok");
