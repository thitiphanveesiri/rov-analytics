"use client";
import { C } from "@/lib/theme";


// ═══════════════════════════════════════════
//  OBJECTIVE CONTROL EDITOR (Dragon/Turret/First Blood)
// ═══════════════════════════════════════════
export const OBJ_DEFAULT = {
  firstBlood:null, firstTower:null,
  ourAbyssal:0, enemyAbyssal:0,       // มังกร
  ourDark:0, enemyDark:0,             // Dark (Dark Slayer)
  ourGodslayer:0, enemyGodslayer:0,   // Godslayer
  ourTurrets:0, enemyTurrets:0,
};

// ── Objective control aggregate — reusable across Overview, Rival Overview,
//    and Scout ── takes an array of games (each with an optional
//    `.objectives` field in the {firstBlood, firstTower, ourAbyssal,
//    enemyAbyssal, ...} shape produced by ObjectiveEditor) and returns the
//    same aggregate shape every caller renders via ObjectiveSummaryDisplay.
export function computeObjectiveSummary(games) {
  const gamesWithObj = games.filter(g=>g.objectives);
  let fbOur=0, fbEnemy=0, ftOur=0, ftEnemy=0, turOur=0, turEnemy=0;
  let abyOur=0, abyEnemy=0, darkOur=0, darkEnemy=0, gsOur=0, gsEnemy=0;
  let winsWithFT=0, gamesWithFT=0;
  let winsWithGSEdge=0, gamesWithGSEdge=0;
  gamesWithObj.forEach(g=>{
    const o=g.objectives;
    if(o.firstBlood==="our") fbOur++; else if(o.firstBlood==="enemy") fbEnemy++;
    if(o.firstTower==="our") { ftOur++; gamesWithFT++; if(g.result==="WIN") winsWithFT++; }
    else if(o.firstTower==="enemy") { ftEnemy++; gamesWithFT++; }
    abyOur   += Number(o.ourAbyssal||0);   abyEnemy   += Number(o.enemyAbyssal||0);
    darkOur  += Number(o.ourDark||0);      darkEnemy  += Number(o.enemyDark||0);
    gsOur    += Number(o.ourGodslayer||0); gsEnemy    += Number(o.enemyGodslayer||0);
    turOur   += Number(o.ourTurrets||0);   turEnemy   += Number(o.enemyTurrets||0);
    // Godslayer มักเป็นตัวชี้ผลเกมช่วงท้าย เลยใช้เป็น "objective edge" หลักแทน dragon รวมแบบเดิม
    if(Number(o.ourGodslayer||0) > Number(o.enemyGodslayer||0)) {
      gamesWithGSEdge++; if(g.result==="WIN") winsWithGSEdge++;
    }
  });
  return {
    total: gamesWithObj.length,
    fbOur, fbEnemy,
    ftOur, ftEnemy,
    ftWinRate: gamesWithFT ? Math.round(winsWithFT/gamesWithFT*100) : null,
    abyOur, abyEnemy, darkOur, darkEnemy, gsOur, gsEnemy,
    turOur, turEnemy,
    gsEdgeWinRate: gamesWithGSEdge ? Math.round(winsWithGSEdge/gamesWithGSEdge*100) : null,
  };
}

// For scouted games specifically: each scout match record has its own
// "teamA"/"teamB" (objectives.our means teamA, .enemy means teamB — same
// convention calcMatchupStats already uses for win/loss), which does NOT
// always line up with which side `teamFocus` (the rival currently being
// viewed) was on in any given record. This normalizes every game's
// objectives + result onto teamFocus's own perspective, flipping our/
// enemy when teamFocus was actually teamB in that particular record —
// same idea as the `isA` check in calcMatchupStats, just applied to the
// objectives sub-object instead of picks/bans/stats.
export function flattenScoutObjectivesForFocus(records, teamFocus) {
  const out = [];
  records.forEach(sm=>{
    const isA = sm.teamA===teamFocus;
    (sm.games||[]).forEach(g=>{
      if (!g.objectives) return;
      const o = g.objectives;
      const objectives = isA ? o : {
        firstBlood: o.firstBlood==="our" ? "enemy" : o.firstBlood==="enemy" ? "our" : null,
        firstTower: o.firstTower==="our" ? "enemy" : o.firstTower==="enemy" ? "our" : null,
        ourAbyssal: o.enemyAbyssal||0,     enemyAbyssal: o.ourAbyssal||0,
        ourDark: o.enemyDark||0,           enemyDark: o.ourDark||0,
        ourGodslayer: o.enemyGodslayer||0, enemyGodslayer: o.ourGodslayer||0,
        ourTurrets: o.enemyTurrets||0,     enemyTurrets: o.ourTurrets||0,
      };
      const result = isA ? g.teamAResult : (g.teamAResult==="WIN"?"LOSE":"WIN");
      out.push({ objectives, result });
    });
  });
  return out;
}

// Same idea as flattenScoutObjectivesForFocus, but pulls out teamFocus's
// own picks (not objectives) + result from each scouted game — used to
// compute a rival player's stats from games they played against teams
// OTHER than us (i.e. every scout record, since scout records are always
// "some rival vs some other rival", never involving our own team).
export function flattenScoutGamesForFocus(records, teamFocus) {
  const out = [];
  records.forEach(sm=>{
    const isA = sm.teamA===teamFocus;
    (sm.games||[]).forEach(g=>{
      const picks = isA ? (g.picksA||[]) : (g.picksB||[]);
      const result = isA ? g.teamAResult : (g.teamAResult==="WIN"?"LOSE":"WIN");
      out.push({ picks, result });
    });
  });
  return out;
}

// Adapts scouted games into the exact same shape PlayerProfile already
// expects for an enemy player (g.enemyPicks / g.gameStats.enemy / g.result
// in the {WIN,LOSE} convention meaning "did WE win", even though there's
// no "us" in scout data at all) — this is what lets a rival player's
// scouted performance (against teams OTHER than us) feed the same
// detailed stat view (KDA, Dmg, Gold/min, hero table, last-10-games) that
// otherwise only had data when we'd actually played them ourselves.
// statsA/statsB use the identical index-keyed shape as gameStats.our/
// .enemy already (see UnifiedStatsEditor's gameStats={{our,enemy}} usage
// in EditScoutGameModal), so no reshaping is needed beyond picking the
// right side.
export function adaptScoutGamesForPlayerProfile(records, teamFocus) {
  const out = [];
  records.forEach(sm=>{
    const isA = sm.teamA===teamFocus;
    (sm.games||[]).forEach(g=>{
      const teamWon = isA ? g.teamAResult==="WIN" : g.teamAResult==="LOSE";
      out.push({
        ourPicks: [],
        enemyPicks: isA ? (g.picksA||[]) : (g.picksB||[]),
        gameStats: { our:{}, enemy: isA ? (g.statsA||{}) : (g.statsB||{}) },
        result: teamWon ? "LOSE" : "WIN", // convention: "LOSE" = the scouted team won
        duration: g.duration,
      });
    });
  });
  return out;
}

export function ObjectiveSummaryDisplay({ objSummary, ourLabel="เรา", enemyLabel="คู่แข่ง", title="🐉 Objective Control" }) {
  if (objSummary.total === 0) return null;
  return (
    <div style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:14,padding:18,marginBottom:16}}>
      <div style={{fontWeight:800,fontSize:14,color:C.primaryLight,marginBottom:4}}>
        {title}
      </div>
      <div style={{fontSize:11,color:C.textMuted,marginBottom:14}}>
        จาก {objSummary.total} เกมที่กรอกข้อมูล Objective ไว้ ({ourLabel} : {enemyLabel})
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))",gap:12}}>
        {[
          {icon:"🩸",label:"First Blood",our:objSummary.fbOur,enemy:objSummary.fbEnemy},
          {icon:"🏯",label:"First Tower",our:objSummary.ftOur,enemy:objSummary.ftEnemy},
          {icon:"🐉",label:"Abyssal",our:objSummary.abyOur,enemy:objSummary.abyEnemy},
          {icon:"⚫",label:"Dark",our:objSummary.darkOur,enemy:objSummary.darkEnemy},
          {icon:"👑",label:"Godslayer",our:objSummary.gsOur,enemy:objSummary.gsEnemy},
          {icon:"🏰",label:"Turret พัง",our:objSummary.turOur,enemy:objSummary.turEnemy},
        ].map(c=>(
          <div key={c.label} style={{background:C.bgCard,borderRadius:10,padding:"12px 10px",textAlign:"center"}}>
            <div style={{fontSize:10,color:C.textMuted,marginBottom:6}}>{c.icon} {c.label}</div>
            <div style={{fontSize:18,fontWeight:800}}>
              <span style={{color:C.win}}>{c.our}</span>
              <span style={{color:C.textMuted,fontSize:13}}> : </span>
              <span style={{color:C.lose}}>{c.enemy}</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:12,marginTop:14,flexWrap:"wrap"}}>
        {objSummary.ftWinRate!==null && (
          <div style={{background:C.primary+"12",borderRadius:8,padding:"8px 14px",fontSize:12,
            color:C.primaryLight,borderLeft:`3px solid ${C.primary}`}}>
            💡 เกมที่ {ourLabel} ได้ First Tower ก่อน → ชนะ <b>{objSummary.ftWinRate}%</b>
          </div>
        )}
        {objSummary.gsEdgeWinRate!==null && (
          <div style={{background:C.primary+"12",borderRadius:8,padding:"8px 14px",fontSize:12,
            color:C.primaryLight,borderLeft:`3px solid ${C.primary}`}}>
            💡 เกมที่ {ourLabel} คุม Godslayer ได้มากกว่า → ชนะ <b>{objSummary.gsEdgeWinRate}%</b>
          </div>
        )}
      </div>
    </div>
  );
}

export function ObjectiveEditor({ objectives, onChange, teamALabel="🛡️ เรา", teamBLabel="⚔️ คู่แข่ง" }) {
  const obj = { ...OBJ_DEFAULT, ...(objectives||{}) };
  function set(k,v){ onChange({ ...obj, [k]:v }); }

  const FirstPicker = ({ field, label, icon }) => (
    <div>
      <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>{icon} {label}</div>
      <div style={{display:"flex",gap:5}}>
        {[{v:"our",l:teamALabel,c:C.win},{v:"enemy",l:teamBLabel,c:C.lose},{v:null,l:"—",c:C.textMuted}].map(o=>(
          <button key={String(o.v)} onClick={()=>set(field,o.v)}
            style={{background:obj[field]===o.v?o.c+"30":"transparent",
              border:`1px solid ${obj[field]===o.v?o.c:C.border}`,color:obj[field]===o.v?o.c:C.textMuted,
              borderRadius:7,padding:"4px 10px",cursor:"pointer",fontSize:11,fontWeight:700}}>
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );

  const CountField = ({ field, label, col }) => (
    <div>
      <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>{label}</div>
      <input type="number" min="0" value={obj[field]}
        onChange={e=>set(field, Math.max(0, Number(e.target.value)||0))}
        style={{width:60,background:"#0a0816",border:`1px solid ${C.border}`,color:col,
          borderRadius:6,padding:"5px 8px",fontSize:13,fontWeight:700,textAlign:"center",outline:"none"}}/>
    </div>
  );

  return (
    <div style={{background:"#080614",borderRadius:10,padding:"12px 14px",marginTop:8}}>
      <div style={{fontSize:11,fontWeight:800,color:C.primaryLight,marginBottom:12}}>
        🐉 Objective Control
      </div>
      <div style={{display:"flex",gap:20,flexWrap:"wrap",marginBottom:12}}>
        <FirstPicker field="firstBlood" label="First Blood" icon="🩸"/>
        <FirstPicker field="firstTower" label="First Tower"  icon="🏯"/>
      </div>
      <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
        <CountField field="ourAbyssal"    label={`🐉 Abyssal (${teamALabel})`}     col={C.win}/>
        <CountField field="enemyAbyssal"  label={`🐉 Abyssal (${teamBLabel})`} col={C.lose}/>
        <CountField field="ourDark"       label={`⚫ Dark (${teamALabel})`}        col={C.win}/>
        <CountField field="enemyDark"     label={`⚫ Dark (${teamBLabel})`}    col={C.lose}/>
        <CountField field="ourGodslayer"   label={`👑 Godslayer (${teamALabel})`}     col={C.win}/>
        <CountField field="enemyGodslayer" label={`👑 Godslayer (${teamBLabel})`} col={C.lose}/>
        <CountField field="ourTurrets"   label={`🏯 Turret พัง (${teamALabel})`}     col={C.win}/>
        <CountField field="enemyTurrets" label={`🏯 Turret พัง (${teamBLabel})`} col={C.lose}/>
      </div>
    </div>
  );
}
