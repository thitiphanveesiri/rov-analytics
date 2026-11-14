import assert from "node:assert/strict";
import { snapHero, toStat, mapScoreboard, mergeStats, buildStatsFromMapping } from "@/lib/scoreboardMatch";

assert.equal(snapHero("nakroth"), "Nakroth");
assert.equal(snapHero("Lu Bu"), "Lu Bu");
assert.equal(snapHero("zzzz"), null);
assert.equal(toStat("12,345"), 12345);
assert.equal(toStat("12.5k"), 12500);
assert.equal(toStat(null), undefined);
assert.equal(toStat("abc"), undefined);

const mk = names => names.map((n, i) => ({ role: String(i), hero: { name: n }, player: "" }));
const ourPicks = mk(["Nakroth", "Murad", "Krixi", "Capheny", "Alice"]);
const enemyPicks = mk(["Airi", "Raz", "Tulen", "Valhein", "Mina"]);
const row = (hero, k, d, a) => ({ hero, kills: k, deaths: d, assists: a, damage: "10,000", damageTaken: 8000, gold: "9.5k" });
const parsed = { teams: [
  { rows: [row("Airi",3,1,2), row("Raz",1,2,3), row("Tulen",2,2,1), row("Valhein",0,3,4), row("Mina",0,1,6)] },
  { rows: [row("Alice",0,0,9), row("Nakroth",5,1,4), row("Murad",2,1,3), row("Krixi",1,0,5), row("Capheny",2,1,2)] },
] };

// ทีมแรกในภาพคือคู่แข่ง → เดาถูกจากชื่อ hero และจับคู่ตามชื่อ ไม่ใช่ตามลำดับ
const r = mapScoreboard(parsed, { ourPicks, enemyPicks });
assert.equal(r.ourIsFirst, false);
assert.equal(r.gameStats.our[0].kills, 5);      // Nakroth = slot 0
assert.equal(r.gameStats.our[4].assists, 9);    // Alice = slot 4 (แถวแรกของทีมในภาพ แต่จับตามชื่อ)
assert.equal(r.gameStats.our[0].damage, 10000);
assert.equal(r.gameStats.our[0].gold, 9500);
assert.equal(r.gameStats.enemy[0].kills, 3);    // Airi
assert.equal(r.matched.our, 5); assert.equal(r.matched.enemy, 5);
assert.equal(r.warnings.length, 0);

// ผู้ใช้เลือกฝั่งเอง ต้องชนะการเดา
assert.equal(mapScoreboard(parsed, { ourPicks, enemyPicks, ourIsFirst: false }).gameStats.our[0].kills, 5);

// hero อ่านไม่ออก → จับตามลำดับ slot ที่เหลือ พร้อมเตือน
const blur = { teams: [{ rows: [row("???",1,1,1)] }, { rows: [] }] };
const b = mapScoreboard(blur, { ourPicks, enemyPicks, ourIsFirst: true });
assert.equal(b.matched.our, 1); assert.ok(b.warnings.length >= 1);

// merge: ช่องที่อ่านไม่ได้ต้องไม่ทับค่าเดิม
const m = mergeStats({ our: { 0: { kills: 9, gold: 1 } }, enemy: {} }, { our: { 0: { gold: 2 } }, enemy: {} });
assert.deepEqual(m.our[0], { kills: 9, gold: 2 });
// ── buildStatsFromMapping: ลำดับแถวในภาพ ≠ ลำดับ slot (กรณีจริง: ภาพเรียง Nakroth,Skud,Eland'orr,Wiro,Liliana
//    แต่ slot ในเว็บเรียง Eland'orr,Liliana,Wiro,Skud,Nakroth)
const shot = { teams: [
  { rows: [{ kills: 11, deaths: 3, assists: 5, gold: 18173 }, { kills: 1, deaths: 1, assists: 6, gold: 12877 }, { kills: 2, deaths: 2, assists: 4, gold: 12801 }, { kills: 4, deaths: 4, assists: 8, gold: 9611 }, { kills: 2, deaths: 5, assists: 5, gold: 9512 }] },
  { rows: [{ kills: 1, deaths: 5, assists: 6, gold: 15381 }, { kills: 2, deaths: 2, assists: 3, gold: 11939 }, { kills: 3, deaths: 6, assists: 1, gold: 12708 }, { kills: 3, deaths: 2, assists: 10, gold: 11356 }, { kills: 6, deaths: 5, assists: 1, gold: 13608 }] },
] };
// slot (เว็บ) = [Eland'orr, Liliana, Wiro, Skud, Nakroth] ← แถวในภาพ [Nakroth=0, Skud=1, Eland'orr=2, Wiro=3, Liliana=4]
const m1 = buildStatsFromMapping(shot, true, [4, 3, 0, 2, 1], [0, 1, 2, 3, 4]);
assert.equal(m1.gameStats.our[4].kills, 11, "Nakroth → slot 5");
assert.equal(m1.gameStats.our[0].gold, 12801, "Eland'orr → slot 1");
assert.equal(m1.gameStats.our[1].assists, 5, "Liliana → slot 2");
assert.equal(m1.gameStats.enemy[4].gold, 13608);
assert.equal(m1.duplicates.length, 0);
// ทีมเราอยู่ฝั่งขวา
const m2 = buildStatsFromMapping(shot, false, [0, 1, 2, 3, 4], [0, 1, 2, 3, 4]);
assert.equal(m2.gameStats.our[0].gold, 15381); assert.equal(m2.gameStats.enemy[0].gold, 18173);
// เลือก slot ซ้ำ → เตือน ; -1 = ข้าม
const m3 = buildStatsFromMapping(shot, true, [0, 0, -1, 3, 4], [0, 1, 2, 3, 4]);
assert.equal(m3.duplicates.length, 1); assert.equal(m3.gameStats.our[2], undefined);
assert.equal(m3.gameStats.our[0].kills, 1, "แถวหลังทับแถวแรก");
console.log("scoreboardMatch tests ok");
