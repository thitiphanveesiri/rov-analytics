"use client";
import { durationToMinutes } from "@/lib/duration";


// ═══════════════════════════════════════════
//  CSV EXPORT UTIL
// ═══════════════════════════════════════════
// ── Security helpers ──
// escHtml: ใช้กับทุกค่าที่ผู้ใช้กรอก ก่อนใส่ลง HTML string (หน้า Print ใช้ document.write
// ใน window ที่สืบทอด origin ของแอป จึงต้อง escape เสมอ ไม่งั้นเป็น stored XSS)
export function escHtml(v) {
  return String(v ?? "").replace(/[&<>"']/g,
    c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}
// csvCell: ครอบเครื่องหมายคำพูดตามมาตรฐาน CSV + กัน formula injection ใน Excel/Sheets
// (ค่าที่ขึ้นต้นด้วย = + - @ tab CR จะถูกใส่ ' นำหน้าให้กลายเป็นข้อความธรรมดา)
function csvCell(v) {
  let t = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;
  return `"${t.replace(/"/g, '""')}"`;
}

export function exportCSV(matches, allGames) {
  const rows = [];
  // header
  rows.push([
    "Date","Session","RivalName","BoType","GameNo",
    "Result","OurSide","OurScore","EnemyScore","Duration(min)",
    "Team","SlotIdx","Role","Hero","Player",
    "Kills","Deaths","Assists","Damage","DamageTaken","Gold","KDA"
  ].join(","));

  matches.forEach((m, si) => {
    const games = Array.isArray(m.games)&&m.games.length ? m.games : [m];
    games.forEach((g, gi) => {
      const gameNo = gi+1;
      // our picks
      (g.ourPicks||[]).forEach((slot, idx) => {
        const gs = g.gameStats?.our?.[idx] || {};
        const k=Number(gs.kills||0), d=Number(gs.deaths||0), a=Number(gs.assists||0);
        const kda = (k+a)/Math.max(d,1);
        rows.push([
          m.date, si+1, csvCell(m.rivalName), m.boType||"BO1", gameNo,
          g.result||"", g.ourSide||"", g.ourScore||0, g.enemyScore||0, durationToMinutes(g.duration).toFixed(2),
          "เรา", idx, slot.role||"", csvCell(slot.hero?.name), csvCell(slot.player),
          gs.kills??"-", gs.deaths??"-", gs.assists??"-",
          gs.damage??"-", gs.damageTaken??"-", gs.gold??"-",
          gs.kills!==undefined ? kda.toFixed(2) : "-"
        ].join(","));
      });
      // enemy picks
      (g.enemyPicks||[]).forEach((slot, idx) => {
        const gs = g.gameStats?.enemy?.[idx] || {};
        const k=Number(gs.kills||0), d=Number(gs.deaths||0), a=Number(gs.assists||0);
        const kda = (k+a)/Math.max(d,1);
        rows.push([
          m.date, si+1, csvCell(m.rivalName), m.boType||"BO1", gameNo,
          g.result||"", g.ourSide||"", g.ourScore||0, g.enemyScore||0, durationToMinutes(g.duration).toFixed(2),
          "คู่แข่ง", idx, slot.role||"", csvCell(slot.hero?.name), csvCell(slot.player),
          gs.kills??"-", gs.deaths??"-", gs.assists??"-",
          gs.damage??"-", gs.damageTaken??"-", gs.gold??"-",
          gs.kills!==undefined ? kda.toFixed(2) : "-"
        ].join(","));
      });
    });
  });

  const csv = "\uFEFF" + rows.join("\n"); // BOM for Excel Thai
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = `rov_stats_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Export JSON backup ──
export function exportJSON(appState) {
  const payload = {
    version: 7,
    exportedAt: new Date().toISOString(),
    matches:       appState.matches,
    rivals:        appState.rivals,
    roster:        appState.roster,
    enemyRosters:  appState.enemyRosters,
    scoutMatches:  appState.scoutMatches,
    playerPhotos:  appState.playerPhotos,
    heroPhotos:    appState.heroPhotos,
    customHeroes:  appState.customHeroes,
    roleOverrides: appState.roleOverrides,
    videos:        appState.videos,
    rosterMembership: appState.rosterMembership,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:"application/json"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = `rov_backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Import JSON + merge (no overwrite by id) ──
export function importJSON(file, currentState, onMerge) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      // dedup by id
      const mergeById = (existing, incoming) => {
        const ids = new Set(existing.map(x=>x.id));
        return [...existing, ...(incoming||[]).filter(x=>!ids.has(x.id))];
      };
      // roster: merge unique strings
      const mergeArr = (a, b) => [...new Set([...a, ...(b||[])])];
      // enemyRosters: merge per team
      const mergeRosters = (a, b) => {
        const result = {...a};
        Object.entries(b||{}).forEach(([team, players]) => {
          result[team] = mergeArr(result[team]||[], players);
        });
        return result;
      };
      // customHeroes: dedup by name (case-insensitive)
      const mergeCustomHeroes = (existing, incoming) => {
        const names = new Set(existing.map(h=>h.name.toLowerCase()));
        return [...existing, ...(incoming||[]).filter(h=>!names.has(h.name.toLowerCase()))];
      };
      // rosterMembership: รวมประวัติต่อผู้เล่น (union ตาม team+from, เรียงตามเวลา) — เหมือน mergeRosters
      // แต่ต้อง dedupe ที่ระดับ "ช่วง" ไม่ใช่ "รายชื่อ" เฉยๆ กันไฟล์ backup เก่าที่ import ซ้ำเพิ่มประวัติซ้ำ
      const mergeMembership = (a, b) => {
        const result = { ...a };
        Object.entries(b||{}).forEach(([name, periods]) => {
          const existing = result[name] || [];
          const seen = new Set(existing.map(p=>`${p.team}|${p.from}`));
          const toAdd = (periods||[]).filter(p=>!seen.has(`${p.team}|${p.from}`));
          result[name] = [...existing, ...toAdd].sort((x,y)=>x.from-y.from);
        });
        return result;
      };

      const merged = {
        matches:       mergeById(currentState.matches,      data.matches),
        rivals:        mergeById(currentState.rivals,       data.rivals),
        roster:        mergeArr(currentState.roster,        data.roster),
        enemyRosters:  mergeRosters(currentState.enemyRosters, data.enemyRosters),
        scoutMatches:  mergeById(currentState.scoutMatches, data.scoutMatches),
        playerPhotos:  { ...currentState.playerPhotos,  ...(data.playerPhotos||{}) },
        heroPhotos:    { ...currentState.heroPhotos,    ...(data.heroPhotos||{}) },
        customHeroes:  mergeCustomHeroes(currentState.customHeroes, data.customHeroes),
        roleOverrides: { ...currentState.roleOverrides, ...(data.roleOverrides||{}) },
        videos:        mergeById(currentState.videos||[], data.videos),
        rosterMembership: mergeMembership(currentState.rosterMembership||{}, data.rosterMembership),
      };

      const added = {
        matches:      merged.matches.length      - currentState.matches.length,
        rivals:       merged.rivals.length       - currentState.rivals.length,
        scoutMatches: merged.scoutMatches.length - currentState.scoutMatches.length,
      };
      onMerge(merged, added);
    } catch {
      alert("❌ ไฟล์ไม่ถูกต้อง — กรุณาใช้ไฟล์ backup JSON ของแอปนี้เท่านั้น");
    }
  };
  reader.readAsText(file);
}
