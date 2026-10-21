// รัน: esbuild tests/rivalBrief.test.mjs --bundle --platform=node --format=esm --alias:@=. --outfile=/tmp/rb.test.mjs && node /tmp/rb.test.mjs
import assert from "node:assert/strict";
import { summarizeRival, buildRivalBriefHtml } from "../components/matchlog/rivalBrief.js";
const H = n => ({ name: n });
const games = [
  { result: "WIN", ourSide: "blue", date: "1 ก.ค.", _playedAt: 2, enemyBans: [H("Zata"), H("Yorn"), null, H("Max")], enemyPicks: [{ hero: H("Arthur"), player: "P1" }, { hero: H("Nakroth"), player: "P2" }] },
  { result: "LOSE", ourSide: "red", date: "2 ก.ค.", _playedAt: 3, enemyBans: [H("Zata"), H("Max")], enemyPicks: [{ hero: H("Arthur"), player: "P1" }] },
];
const scout = [{ teamA: "X<b>", teamB: "R", games: [{ bansB: [H("Zata")], picksB: [{ hero: H("Arthur"), player: "P1" }] }, { bansA: [H("Qi")] }] }];
const s = summarizeRival("R", games, scout);
assert.equal(s.n, 3); assert.equal(s.nMatch, 2); assert.equal(s.nScout, 1); assert.equal(s.wins, 1);
assert.deepEqual(s.topBans[0], ["Zata", 3]);            // รวมแมตช์จริง + scout
assert.deepEqual(s.pickBySlot[0][0], ["Arthur", 3]);
assert.equal(s.players[0].name, "P1");
assert.equal(s.banBySlot.length, 4);
// เกม scout ของทีมอื่นไม่ถูกนับ
assert.equal(summarizeRival("nobody", [], scout).n, 0);
const html = buildRivalBriefHtml({ ourTeamName: "Us", rivalName: "<script>x</script>", rGames: games, scoutMatches: scout, heroTiers: { Arthur: "S" } });
assert.ok(!html.includes("<script>x</script>")); assert.ok(html.includes("&lt;script&gt;"));
assert.ok(html.includes("ข้อมูลน้อย"));                 // n<10 → คำเตือน
assert.ok(html.includes(">S<"));                          // tier
console.log("rivalBrief tests ok");
