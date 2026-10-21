"use client";
import { escHtml } from "@/components/matchlog/dataIO";
import { BANS_PER_TEAM } from "@/components/draft/constants";
import { ROLES_PICK } from "@/lib/heroes";
import { wilsonLower } from "@/lib/stats";
import { matchTime, formatMatchDate } from "@/lib/matchTime";

// ═══════════════════════════════════════════════════════════════
//  ใบสรุปคู่แข่ง 1 หน้า (พิมพ์/เซฟเป็น PDF) — สำรองกรณีอุปกรณ์พัง/ไม่มีเน็ตในห้องแข่ง
//  ใช้ข้อมูลที่โหลดอยู่ในหน้าจอแล้ว (ไม่เรียก server) จึงใช้ได้ตอน offline
//  ดัดแปลงแนวทางจาก export PDF รายแมตช์ (เปิดหน้าต่างใหม่ + window.print)
// ═══════════════════════════════════════════════════════════════

const heroNameOf = h => (typeof h === "string" ? h : h?.name) || null;
const top = (map, n) => Object.entries(map).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n);

// รวมเกมของคู่แข่งจาก 2 แหล่ง ให้อยู่รูปเดียวกัน: { bans:[hero|null..], picks:[{hero,player}..], weWon:bool|null }
//   แมตช์จริง: เรา vs เขา → ฝั่งเขา = enemy* (weWon = result==="WIN")
//   scout: เขาเป็น teamA หรือ teamB → ฝั่งเขา = A/B (weWon=null เพราะไม่ใช่เกมของเรา)
export function collectRivalSamples(rivalName, rGames, scoutMatches) {
  const samples = [];
  (rGames || []).forEach(g => samples.push({
    src: "match",
    bans: (g.enemyBans || []).map(heroNameOf),
    picks: (g.enemyPicks || []).map(s => ({ hero: heroNameOf(s?.hero), player: s?.player || "" })),
    weWon: g.result === "WIN",
  }));
  (scoutMatches || []).forEach(sm => {
    const isA = sm.teamA === rivalName, isB = sm.teamB === rivalName;
    if (!isA && !isB) return;
    (sm.games || []).forEach(g => {
      const bans = ((isA ? g.bansA : g.bansB) || []).map(heroNameOf);
      const picks = ((isA ? g.picksA : g.picksB) || []).map(s => ({ hero: heroNameOf(s?.hero), player: s?.player || "" }));
      // เกมที่ฝั่งของทีมนี้ไม่มีข้อมูลเลย (กรอกไม่ครบ) ไม่นับเป็นตัวอย่าง — กันตัวเลข "จำนวนเกม" เกินจริง
      if (!bans.some(Boolean) && !picks.some(p => p.hero)) return;
      samples.push({ src: "scout", bans, picks, weWon: null });
    });
  });
  return samples;
}

export function summarizeRival(rivalName, rGames, scoutMatches) {
  const samples = collectRivalSamples(rivalName, rGames, scoutMatches);
  const banAll = {}, banBySlot = Array.from({ length: BANS_PER_TEAM }, () => ({}));
  const pickBySlot = Array.from({ length: ROLES_PICK.length }, () => ({}));
  const players = {}; // player -> { hero -> count }
  samples.forEach(s => {
    s.bans.forEach((h, i) => { if (!h) return; banAll[h] = (banAll[h] || 0) + 1; if (banBySlot[i]) banBySlot[i][h] = (banBySlot[i][h] || 0) + 1; });
    s.picks.forEach((p, i) => {
      if (!p.hero) return;
      if (pickBySlot[i]) pickBySlot[i][p.hero] = (pickBySlot[i][p.hero] || 0) + 1;
      if (p.player) { (players[p.player] = players[p.player] || {})[p.hero] = (players[p.player][p.hero] || 0) + 1; }
    });
  });
  const real = (rGames || []);
  const wins = real.filter(g => g.result === "WIN").length;
  return {
    n: samples.length, nMatch: real.length, nScout: samples.length - real.length,
    wins, losses: real.length - wins,
    wr: real.length ? Math.round(wins / real.length * 100) : null,
    wrLower: real.length ? Math.round(wilsonLower(wins, real.length) * 100) : null,
    topBans: top(banAll, 8), banBySlot: banBySlot.map(m => top(m, 3)),
    pickBySlot: pickBySlot.map(m => top(m, 3)),
    players: Object.entries(players).map(([name, heroes]) => ({ name, total: Object.values(heroes).reduce((a, b) => a + b, 0), heroes: top(heroes, 3) }))
      .sort((a, b) => b.total - a.total),
  };
}

export function buildRivalBriefHtml({ ourTeamName, rivalName, rGames, scoutMatches, enemyRoster = [], heroTiers = {}, patchLabel = "" }) {
  const s = summarizeRival(rivalName, rGames, scoutMatches);
  const list = pairs => pairs.length ? pairs.map(([h, c]) => `${escHtml(h)} <span class="c">×${c}</span>`).join(", ") : '<span class="muted">—</span>';
  const tier = h => heroTiers[h] ? ` <span class="tier">${escHtml(heroTiers[h])}</span>` : "";
  const recent = [...(rGames || [])].sort((a, b) => (b._playedAt ?? matchTime(b)) - (a._playedAt ?? matchTime(a))).slice(0, 5);
  const thin = s.n < 10;
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>Scouting brief — ${escHtml(rivalName)}</title>
<style>
  @page { size: A4; margin: 12mm; }
  body { font-family: "Sarabun","Noto Sans Thai",system-ui,sans-serif; color:#111; font-size:12px; }
  h1 { font-size:20px; margin:0 0 2px; } h2 { font-size:13px; margin:14px 0 6px; border-bottom:1px solid #999; padding-bottom:2px; }
  .muted { color:#777; } .c { color:#555; font-size:11px; } .tier { background:#eee; border-radius:3px; padding:0 3px; font-size:10px; }
  table { border-collapse:collapse; width:100%; } td, th { border:1px solid #bbb; padding:4px 6px; text-align:left; vertical-align:top; }
  th { background:#f1f1f1; font-weight:700; } .warn { border:1px solid #c80; background:#fff6e0; padding:5px 8px; margin:8px 0; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:0 16px; }
</style></head><body>
  <h1>${escHtml(rivalName)}</h1>
  <div class="muted">${escHtml(ourTeamName || "ทีมเรา")} · scouting brief · ${patchLabel ? `Patch ${escHtml(patchLabel)} · ` : ""}พิมพ์เมื่อ ${escHtml(formatMatchDate(Date.now()))}</div>
  ${thin ? `<div class="warn">⚠️ ข้อมูลน้อย (${s.n} เกม) — แนวโน้มด้านล่างอาจไม่ตรงกับพฤติกรรมจริง ใช้เป็นแนวทางเท่านั้น</div>` : ""}
  <h2>ภาพรวม</h2>
  <div>ข้อมูล ${s.n} เกม (แมตช์จริง ${s.nMatch} · scout ${s.nScout})
  ${s.wr === null ? "" : ` · เราชนะ ${s.wins}–${s.losses} (${s.wr}%${s.nMatch < 10 ? `, ค่าต่ำสุดที่เชื่อได้ ≈ ${s.wrLower}%` : ""})`}</div>
  <h2>แบนบ่อย (ทุกลำดับ)</h2>
  <div>${list(s.topBans)}</div>
  <div class="grid">
    <div><h2>แบนตามลำดับ</h2><table>${s.banBySlot.map((m, i) => `<tr><th>Ban ${i + 1}</th><td>${list(m)}</td></tr>`).join("")}</table></div>
    <div><h2>Pick ตามตำแหน่ง</h2><table>${s.pickBySlot.map((m, i) => `<tr><th>${escHtml(ROLES_PICK[i] || `Slot ${i + 1}`)}</th><td>${m.length ? m.map(([h, c]) => `${escHtml(h)}${tier(h)} <span class="c">×${c}</span>`).join(", ") : '<span class="muted">—</span>'}</td></tr>`).join("")}</table></div>
  </div>
  <h2>ผู้เล่น</h2>
  ${s.players.length ? `<table><tr><th>ผู้เล่น</th><th>เกม</th><th>ฮีโร่ที่เล่นบ่อย</th></tr>${s.players.map(p => `<tr><td>${escHtml(p.name)}</td><td>${p.total}</td><td>${list(p.heroes)}</td></tr>`).join("")}</table>`
    : `<div class="muted">ยังไม่มีข้อมูลผู้เล่น${enemyRoster.length ? ` · roster: ${escHtml(enemyRoster.join(", "))}` : ""}</div>`}
  <h2>ผลล่าสุดของเรา</h2>
  ${recent.length ? `<table><tr><th>วันที่</th><th>ผล</th><th>ฝั่งเรา</th><th>Ban ของเขา</th></tr>${recent.map(g => `<tr><td>${escHtml(g.date || "")}</td><td>${g.result === "WIN" ? "ชนะ" : "แพ้"}</td><td>${escHtml(g.ourSide || "-")}</td><td>${escHtml((g.enemyBans || []).map(heroNameOf).filter(Boolean).join(", ") || "-")}</td></tr>`).join("")}</table>` : '<div class="muted">ยังไม่เคยเจอในแมตช์จริง</div>'}
</body></html>`;
}

// เปิดหน้าต่างพิมพ์ (ให้เลือก "บันทึกเป็น PDF") — คืน false ถ้า popup ถูกบล็อก
export function printRivalBrief(args) {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(buildRivalBriefHtml(args));
  w.document.close();
  setTimeout(() => w.print(), 500);
  return true;
}
