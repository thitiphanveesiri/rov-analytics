"use client";
import { C } from "@/lib/theme";
import { HERO_DATA, ROLES_PICK } from "@/lib/heroes";
import { normalizeDuration } from "@/lib/duration";
import { useState } from "react";
import { BANS_PER_TEAM } from "@/components/draft/constants";
import { ObjectiveEditor } from "@/components/matchlog/objectives";
import { UnifiedStatsEditor } from "@/components/matchlog/EditGameModal";


// ═══════════════════════════════════════════
//  SCOUT CARD — แสดงผลใน Scout Log
// ═══════════════════════════════════════════
// ═══════════════════════════════════════════
//  EDIT SCOUT GAME MODAL — แก้ไข hero/ban/ผู้เล่น/สกอร์/เวลา/K-D-A
//  ของเกมที่ scout ไว้แล้ว (คล้าย EditGameModal ของ Match Log แต่ปรับ
//  ให้เข้ากับรูปแบบข้อมูล teamA/teamB ของ Scout Log)
// ═══════════════════════════════════════════
export function EditScoutGameModal({ game, teamA, teamB, onSave, onClose }) {
  const [picksA, setPicksA] = useState(() =>
    (game.picksA?.length ? game.picksA : ROLES_PICK.map(r=>({role:r,hero:null,player:""}))).map(p=>({...p})));
  const [picksB, setPicksB] = useState(() =>
    (game.picksB?.length ? game.picksB : ROLES_PICK.map(r=>({role:r,hero:null,player:""}))).map(p=>({...p})));
  const [bansA, setBansA] = useState(() =>
    (game.bansA?.length ? game.bansA : Array(BANS_PER_TEAM).fill(null)).slice());
  const [bansB, setBansB] = useState(() =>
    (game.bansB?.length ? game.bansB : Array(BANS_PER_TEAM).fill(null)).slice());
  const [statsA, setStatsA] = useState(game.statsA || {});
  const [statsB, setStatsB] = useState(game.statsB || {});
  const [teamAResult, setTeamAResult] = useState(game.teamAResult || "WIN");
  const [killsA, setKillsA] = useState(game.killsA ?? "");
  const [killsB, setKillsB] = useState(game.killsB ?? "");
  const [duration, setDuration] = useState(game.duration || "");
  const [sideA, setSideA] = useState(game.sideA || "blue");
  const [objectives, setObjectives] = useState(game.objectives || null);

  const setPickHero   = (side,i,name) => (side==="A"?setPicksA:setPicksB)(prev=>prev.map((p,idx)=>idx===i?{...p,hero:name?{name}:null}:p));
  const setPickPlayer = (side,i,val)  => (side==="A"?setPicksA:setPicksB)(prev=>prev.map((p,idx)=>idx===i?{...p,player:val}:p));
  const setBanHero    = (side,i,name) => (side==="A"?setBansA:setBansB)(prev=>prev.map((b,idx)=>idx===i?(name?{name}:null):b));

  function save() {
    onSave({
      picksA, picksB, bansA, bansB, statsA, statsB,
      teamAResult,
      killsA: Math.max(0, Number(killsA)||0),
      killsB: Math.max(0, Number(killsB)||0),
      duration: normalizeDuration(duration),
      sideA, sideB: sideA==="blue"?"red":"blue",
      objectives,
    });
  }

  const selectStyle = {background:C.bgCard,border:`1px solid ${C.border}`,color:C.textMain,
    borderRadius:6,padding:"5px 6px",fontSize:11,outline:"none"};

  const PickBanSide = ({ side, teamName, color, bans, picks }) => (
    <div>
      <div style={{fontWeight:700,fontSize:12,color,marginBottom:8}}>
        {side==="A"?"🔵":"🔴"} {teamName} — Ban
      </div>
      <div style={{display:"flex",gap:4,marginBottom:10,flexWrap:"wrap"}}>
        {bans.map((b,i)=>(
          <select key={i} value={b?.name||""} onChange={e=>setBanHero(side,i,e.target.value)} style={{...selectStyle,width:88}}>
            <option value="">— ban —</option>
            {HERO_DATA.map(h=><option key={h.name} value={h.name}>{h.name}</option>)}
          </select>
        ))}
      </div>
      <div style={{fontWeight:700,fontSize:12,color,marginBottom:8}}>Pick + ผู้เล่น</div>
      {picks.map((p,i)=>(
        <div key={i} style={{display:"flex",gap:6,marginBottom:6,alignItems:"center"}}>
          <span style={{fontSize:10,color:C.textMuted,width:48,flexShrink:0}}>{p.role}</span>
          <select value={p.hero?.name||""} onChange={e=>setPickHero(side,i,e.target.value)} style={{...selectStyle,flex:1}}>
            <option value="">— hero —</option>
            {HERO_DATA.map(h=><option key={h.name} value={h.name}>{h.name}</option>)}
          </select>
          <input value={p.player||""} onChange={e=>setPickPlayer(side,i,e.target.value)} placeholder="ผู้เล่น"
            style={{...selectStyle,width:86}}/>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:550,
      display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
      onClick={onClose}>
      <div onClick={e=>e.stopPropagation()}
        style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:16,padding:24,
          width:760,maxWidth:"100%",maxHeight:"85vh",overflowY:"auto"}}>
        <div style={{fontWeight:800,fontSize:16,marginBottom:16,color:C.primaryLight}}>
          ✏️ แก้ไขข้อมูล Scout — {teamA} vs {teamB}
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:16,marginBottom:16}}>
          <PickBanSide side="A" teamName={teamA} color={C.blue} bans={bansA} picks={picksA}/>
          <PickBanSide side="B" teamName={teamB} color={C.red}  bans={bansB} picks={picksB}/>
        </div>

        <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:16,alignItems:"flex-end"}}>
          <div>
            <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>ทีมไหนชนะ</div>
            <select value={teamAResult} onChange={e=>setTeamAResult(e.target.value)}
              style={{...selectStyle,fontWeight:700,padding:"7px 10px",fontSize:12,
                color:teamAResult==="WIN"?C.blue:C.red}}>
              <option value="WIN">{teamA} ชนะ</option>
              <option value="LOSE">{teamB} ชนะ</option>
            </select>
          </div>
          <div>
            <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>ฝั่งของ {teamA}</div>
            <select value={sideA} onChange={e=>setSideA(e.target.value)} style={{...selectStyle,padding:"7px 10px",fontSize:12}}>
              <option value="blue">🔵 Blue</option>
              <option value="red">🔴 Red</option>
            </select>
          </div>
          <div>
            <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>คิล {teamA}</div>
            <input type="number" min="0" value={killsA} onChange={e=>setKillsA(e.target.value)}
              style={{...selectStyle,width:70,padding:"7px 10px",fontSize:12}}/>
          </div>
          <div>
            <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>คิล {teamB}</div>
            <input type="number" min="0" value={killsB} onChange={e=>setKillsB(e.target.value)}
              style={{...selectStyle,width:70,padding:"7px 10px",fontSize:12}}/>
          </div>
          <div>
            <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>เวลา (นาที.วินาที)</div>
            <input type="text" inputMode="decimal" value={duration}
              onChange={e=>setDuration(e.target.value)}
              onBlur={e=>setDuration(normalizeDuration(e.target.value))}
              placeholder="09.45" style={{...selectStyle,width:90,padding:"7px 10px",fontSize:12}}/>
          </div>
        </div>

        <div style={{marginBottom:20}}>
          <div style={{fontWeight:700,fontSize:12,color:C.primaryLight,marginBottom:8}}>
            🐉 Objective Control
          </div>
          <ObjectiveEditor objectives={objectives} onChange={setObjectives}
            teamALabel={teamA||"ทีม A"} teamBLabel={teamB||"ทีม B"}/>
        </div>

        <div style={{marginBottom:20}}>
          <div style={{fontWeight:700,fontSize:12,color:C.primaryLight,marginBottom:8}}>
            📊 Stats รายผู้เล่น (K/D/A/Dmg/Gold)
          </div>
          <UnifiedStatsEditor
            ourPicks={picksA} enemyPicks={picksB}
            gameStats={{ our: statsA, enemy: statsB }}
            onChangeStats={(next)=>{ setStatsA(next.our||{}); setStatsB(next.enemy||{}); }}
            ourScore={Number(killsA)||0} enemyScore={Number(killsB)||0}
          />
        </div>

        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={{background:"transparent",border:`1px solid ${C.border}`,
            color:C.textMuted,borderRadius:8,padding:"9px 18px",cursor:"pointer",fontWeight:700,fontSize:13}}>
            ยกเลิก
          </button>
          <button onClick={save} style={{background:C.primary,color:"#fff",border:"none",borderRadius:8,
            padding:"9px 22px",cursor:"pointer",fontWeight:700,fontSize:13}}>
            💾 บันทึก
          </button>
        </div>
      </div>
    </div>
  );
}
