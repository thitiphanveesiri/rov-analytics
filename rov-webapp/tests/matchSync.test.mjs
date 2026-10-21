// matchSync: Pick.teamId + Match.date จาก playedAt (mock prisma โดยคัดลอกไฟล์ lib ไป temp dir)
import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
const lib = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "lib");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ms-"));
for (const f of ["matchSync.js", "heroes.js", "duration.js", "matchTime.js"]) fs.copyFileSync(path.join(lib, f), path.join(tmp, f));
fs.writeFileSync(path.join(tmp, "prisma.js"), `
export const captured = {};
const op = name => ({ createMany: ({ data }) => (captured[name] = data, name), deleteMany: () => "del" });
export const prisma = { match: op("match"), game: op("game"), pick: op("pick"), $transaction: async ops => ops };
`);
const { syncMatchesToRelational } = await import(pathToFileURL(path.join(tmp, "matchSync.js")));
const { captured } = await import(pathToFileURL(path.join(tmp, "prisma.js")));
const played = new Date(2026, 5, 1, 12).getTime();
await syncMatchesToRelational("T1", [{
  id: 1790000000000, playedAt: played, date: "1 มิ.ย. 2569", rivalName: "A",
  games: [{ result: "WIN", duration: "10.00", pauseDuration: "01.00", ourBans: [{ name: "Zata" }], ourPicks: [{ hero: { name: "Arthur" }, player: "P" }] }],
}, { id: 1700000000000, date: "ไม่ใช่วันที่", games: [] }]);
assert.ok(captured.pick.length >= 2 && captured.pick.every(p => p.teamId === "T1"));
assert.equal(captured.match[0].date.getTime(), played);            // playedAt ชนะ
assert.equal(captured.match[1].date.getTime(), 1700000000000);     // ไม่มี playedAt → id (ไม่ใช่ "ตอนนี้")
assert.equal(captured.game[0].durationMin, 9);                     // หัก pause
console.log("matchSync tests ok");
