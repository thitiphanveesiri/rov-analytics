"use client";
import { C, iStyle } from "@/lib/theme";
import { HERO_DATA, ROLES_FILTER, ROLES_PICK, ROLE_COLOR } from "@/lib/heroes";
import { HeroCard, HeroChip } from "@/components/shared/HeroChip";
import { normalizeDuration } from "@/lib/duration";
import { useState } from "react";
import { BANS_PER_TEAM } from "@/components/draft/constants";
import { ObjectiveEditor } from "@/components/matchlog/objectives";
import { PATTERN_TAGS } from "@/components/common/constants";


// ═══════════════════════════════════════════
//  MAIN APP
// ═══════════════════════════════════════════

// ═══════════════════════════════════════════
//  SCOUT GAME FORM — บันทึก 1 เกม
// ═══════════════════════════════════════════
export function ScoutGameForm({ gameNo, teamA, teamB, rivals, enemyRosters, onSave, onCancel }) {
  const initPicks = () => ROLES_PICK.map(r=>({role:r,hero:null,player:""}));
  const [picksA,    setPicksA]    = useState(initPicks);
  const [picksB,    setPicksB]    = useState(initPicks);
  const [bansA,     setBansA]     = useState(Array(BANS_PER_TEAM).fill(null)); // ลำดับแบน ทีม A
  const [bansB,     setBansB]     = useState(Array(BANS_PER_TEAM).fill(null)); // ลำดับแบน ทีม B
  // statsA/B: { [slotIdx]: { kills, deaths, assists, damage, damageTaken, gold } }
  const [statsA,    setStatsA]    = useState({});
  const [statsB,    setStatsB]    = useState({});
  const [result,    setResult]    = useState("A");
  const [sideA,     setSideA]     = useState("blue"); // "blue" | "red" — side ของ teamA
  const [killsA,    setKillsA]    = useState("");
  const [killsB,    setKillsB]    = useState("");
  const [duration,  setDuration]  = useState("");
  const [note,      setNote]      = useState("");
  const [tags,      setTags]      = useState([]);
  const [search,    setSearch]    = useState("");
  const [roleFilter,setRoleFilter]= useState("All");
  const [activeSlot,setActiveSlot]= useState({team:"A",idx:0});
  const [showStats, setShowStats] = useState(false);
  const [showObj,   setShowObj]   = useState(false);
  const [objectives,setObjectives]= useState(null);

  const usedHeroes = new Set([
    ...picksA.filter(p=>p.hero).map(p=>p.hero.name),
    ...picksB.filter(p=>p.hero).map(p=>p.hero.name),
  ]);

  const filtered = HERO_DATA.filter(h=>
    (roleFilter==="All"||(h.roles||[h.role]).includes(roleFilter)) &&
    h.name.toLowerCase().includes(search.toLowerCase())
  );

  function pickHero(hero) {
    // ถ้ากำลัง ban อยู่ให้ ban ก่อน
    if (banMode) { banHero(hero); return; }
    if (usedHeroes.has(hero.name)) return;
    const { team, idx } = activeSlot;
    if (team==="A") { const p=[...picksA]; p[idx]={...p[idx],hero}; setPicksA(p); }
    else            { const p=[...picksB]; p[idx]={...p[idx],hero}; setPicksB(p); }
    if (team==="A") {
      const na=picksA.findIndex((s,i)=>i>idx&&!s.hero);
      if (na>=0) setActiveSlot({team:"A",idx:na});
      else { const nb=picksB.findIndex(s=>!s.hero); if(nb>=0) setActiveSlot({team:"B",idx:nb}); }
    } else {
      const nb2=picksB.findIndex((s,i)=>i>idx&&!s.hero);
      if (nb2>=0) setActiveSlot({team:"B",idx:nb2});
      else { const na2=picksA.findIndex(s=>!s.hero); if(na2>=0) setActiveSlot({team:"A",idx:na2}); }
    }
  }

  function clearPick(team, idx) {
    if (team==="A") { const p=[...picksA]; p[idx]={...p[idx],hero:null,player:""}; setPicksA(p); }
    else            { const p=[...picksB]; p[idx]={...p[idx],hero:null,player:""}; setPicksB(p); }
    setActiveSlot({team,idx});
  }

  function toggleTag(t) { setTags(prev=>prev.includes(t)?prev.filter(x=>x!==t):[...prev,t]); }

  // ── Ban hero (เลือก slot ว่างอัตโนมัติ) ──
  const [banMode, setBanMode] = useState(null); // null | "A" | "B"
  const [banSlot, setBanSlot] = useState(0);

  function banHero(hero) {
    if (!banMode) return;
    if (banMode==="A") {
      const b=[...bansA]; b[banSlot]=hero; setBansA(b);
      const next=bansA.findIndex((x,i)=>i>banSlot&&!x);
      if(next>=0) setBanSlot(next); else setBanMode(null);
    } else {
      const b=[...bansB]; b[banSlot]=hero; setBansB(b);
      const next=bansB.findIndex((x,i)=>i>banSlot&&!x);
      if(next>=0) setBanSlot(next); else setBanMode(null);
    }
  }

  function clearBan(team, idx) {
    if(team==="A"){ const b=[...bansA]; b[idx]=null; setBansA(b); }
    else          { const b=[...bansB]; b[idx]=null; setBansB(b); }
  }

  function setStatVal(side, idx, field, val) {
    const setter = side==="A" ? setStatsA : setStatsB;
    setter(prev=>({...prev,[idx]:{...(prev[idx]||{}),[field]:val===""?undefined:Number(val)}}));
  }

  function handleSave() {
    onSave({ gameNo, teamAResult:result==="A"?"WIN":"LOSE",
      sideA, sideB: sideA==="blue"?"red":"blue",
      picksA, picksB, bansA, bansB, statsA, statsB,
      killsA, killsB, duration, note, tags, objectives });
  }

  const rosterA = enemyRosters[teamA]||[];
  const rosterB = enemyRosters[teamB]||[];

  const renderPickColumn = (label, teamKey, picks, setpicks, roster, accentCol) => (
    <div style={{flex:1,background:"#0e0b1e",borderRadius:12,padding:"12px 10px"}}>
      <div style={{textAlign:"center",marginBottom:10}}>
        <span style={{fontWeight:900,fontSize:14,color:accentCol}}>{label}</span>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {picks.map((slot,idx)=>{
          const isActive = activeSlot.team===teamKey && activeSlot.idx===idx;
          return (
            <div key={idx} onClick={()=>setActiveSlot({team:teamKey,idx})}
              style={{display:"flex",alignItems:"center",gap:6,padding:"6px 8px",borderRadius:10,
                background:isActive?accentCol+"15":C.bgPanel,cursor:"pointer",
                border:`2px solid ${isActive?accentCol:C.border}`,
                boxShadow:isActive?`0 0 10px ${accentCol}40`:"none",
                transition:"all .15s",minHeight:52}}>
              {slot.hero ? (
                <>
                  <HeroCard hero={slot.hero} size={38} showName={false}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:800,lineHeight:1.2,overflow:"hidden",
                      textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{slot.hero.name}</div>
                    <div style={{fontSize:9,color:ROLE_COLOR[slot.hero.role]}}>{slot.role}</div>
                    {roster.length>0&&(
                      <select value={slot.player||""} onClick={e=>e.stopPropagation()}
                        onChange={e=>{const p=[...picks];p[idx]={...p[idx],player:e.target.value};setpicks(p);}}
                        style={{width:"100%",background:"#0a0816",border:`1px solid ${C.border}`,
                          color:slot.player?accentCol:C.textMuted,borderRadius:4,
                          padding:"1px 4px",fontSize:10,outline:"none",marginTop:2}}>
                        <option value="">— เลือกผู้เล่น —</option>
                        {roster.map(p=><option key={p} value={p}>{p}</option>)}
                      </select>
                    )}
                  </div>
                  <button onClick={e=>{e.stopPropagation();clearPick(teamKey,idx);}}
                    style={{background:"none",border:"none",color:"#ff4757",cursor:"pointer",fontSize:14,padding:"0 2px",lineHeight:1}}>✕</button>
                </>
              ) : (
                <div style={{display:"flex",alignItems:"center",gap:8,width:"100%"}}>
                  <div style={{width:38,height:38,borderRadius:8,flexShrink:0,
                    border:`2px dashed ${isActive?accentCol:C.border}`,
                    display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <span style={{fontSize:16,color:isActive?accentCol:"#2a2550"}}>{isActive?"✛":"+"}</span>
                  </div>
                  <div>
                    <div style={{fontSize:11,color:isActive?accentCol:"#3a3a5c",fontWeight:700}}>{slot.role}</div>
                    <div style={{fontSize:9,color:"#2a2550"}}>{isActive?"คลิก Hero":"รอเลือก"}</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderStatsTable = (teamKey, picks, stats, accentCol, teamName) => {
    const fields = ["kills","deaths","assists","damage","damageTaken","gold"];
    const headers = ["K","D","A","Dmg","DmgTkn","Gold"];
    const fieldWidth = { kills:36, deaths:36, assists:36, damage:70, damageTaken:70, gold:62 };
    if (!picks.some(s=>s.hero)) return null;
    return (
      <div style={{marginBottom:8}}>
        <div style={{fontSize:10,color:accentCol,fontWeight:800,marginBottom:5}}>
          {teamKey==="A"?`🔵 ${teamName}`:`🔴 ${teamName}`}
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:440}}>
            <thead>
              <tr style={{background:"#0f0c22"}}>
                <th style={{padding:"5px 8px",textAlign:"left",fontSize:9,color:C.textMuted,fontWeight:700}}>ผู้เล่น / Hero</th>
                {headers.map(h=>(
                  <th key={h} style={{padding:"5px 4px",textAlign:"center",fontSize:9,color:C.textMuted,fontWeight:700}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {picks.map((slot,idx)=>{
                if (!slot.hero) return null;
                return (
                  <tr key={idx} style={{borderTop:`1px solid ${C.border}`}}>
                    <td style={{padding:"4px 8px",minWidth:100}}>
                      <div style={{fontSize:10,fontWeight:700,color:accentCol}}>
                        {slot.player||<span style={{color:C.textMuted,fontWeight:400,fontStyle:"italic"}}>ไม่ระบุ</span>}
                      </div>
                      <div style={{fontSize:8,color:C.textMuted}}>{slot.hero.name}</div>
                    </td>
                    {fields.map(field=>{
                      const cur = stats[idx]?.[field];
                      return (
                        <td key={field} style={{padding:"3px 2px",textAlign:"center"}}>
                          <input type="number" min="0"
                            value={cur??""} placeholder="0"
                            onChange={e=>setStatVal(teamKey,idx,field,e.target.value)}
                            style={{width:fieldWidth[field],background:"#0a0816",border:`1px solid ${C.border}`,
                              color:C.textMain,borderRadius:4,padding:"3px 4px",
                              fontSize:11,textAlign:"center",outline:"none"}}/>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:14,padding:"16px 18px",marginBottom:12}}>
      <div style={{fontWeight:800,fontSize:14,color:C.primaryLight,marginBottom:12}}>
        🎮 Game {gameNo}
      </div>

      {/* ── Ban Order Section ── */}
      <div style={{marginBottom:14,background:C.bgCard,borderRadius:12,padding:"12px 14px"}}>
        <div style={{fontWeight:700,fontSize:12,color:C.textMuted,marginBottom:10}}>
          🚫 ลำดับแบน
          <span style={{fontSize:10,fontWeight:400,marginLeft:8,opacity:0.6}}>
            {banMode ? `กำลังแบนให้${banMode==="A"?teamA||"ทีม A":teamB||"ทีม B"} — คลิก Hero ด้านล่าง` : "กดปุ่มเพื่อเพิ่มแบน"}
          </span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {[{label:teamA||"ทีม A",col:C.blue,bans:bansA,setBans:setBansA,team:"A"},
            {label:teamB||"ทีม B",col:C.red, bans:bansB,setBans:setBansB,team:"B"}].map(({label,col,bans,team})=>(
            <div key={team}>
              <div style={{fontSize:11,color:col,fontWeight:700,marginBottom:6}}>{label}</div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                {bans.map((h,i)=>(
                  <div key={i}
                    onClick={()=>{ if(h){ clearBan(team,i); } else { setBanMode(team); setBanSlot(i); }}}
                    style={{width:40,height:40,borderRadius:8,border:`2px solid ${h?col:C.border}`,
                      background:h?col+"20":C.bgBase,cursor:"pointer",
                      display:"flex",alignItems:"center",justifyContent:"center",
                      position:"relative",overflow:"hidden",
                      outline:banMode===team&&banSlot===i?`3px solid ${col}`:"none"}}>
                    {h
                      ? <><HeroChip name={h.name} size={36} accentCol={col} fontSize={9}/>
                          <div style={{position:"absolute",top:0,left:0,background:"rgba(0,0,0,0.5)",
                            fontSize:9,fontWeight:900,color:"#fff",padding:"1px 3px",borderRadius:"0 0 4px 0"}}>
                            {i+1}
                          </div>
                        </>
                      : <span style={{fontSize:16,color:C.border}}>+</span>
                    }
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        {banMode&&(
          <div style={{marginTop:8,fontSize:11,color:C.textMuted,
            background:C.bgBase,borderRadius:7,padding:"5px 10px"}}>
            💡 คลิก Hero ในกริดด้านล่างเพื่อแบน · กด + อีกครั้งเพื่อยกเลิก
            <button onClick={()=>setBanMode(null)}
              style={{marginLeft:10,background:"transparent",border:"none",
                color:C.lose,cursor:"pointer",fontWeight:700,fontSize:11}}>
              ✕ ยกเลิก
            </button>
          </div>
        )}
      </div>

      {/* 3-col: teamA | hero grid | teamB */}
      <div style={{display:"flex",gap:10,marginBottom:14}}>
        {renderPickColumn(teamA||"ทีม A","A",picksA,setPicksA,rosterA,C.blue)}
        <div style={{flex:2,display:"flex",flexDirection:"column",gap:6}}>
          <div style={{display:"flex",gap:4,flexWrap:"wrap",alignItems:"center"}}>
            <input value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="🔍 Hero..."
              style={{...iStyle,width:120,padding:"4px 8px",fontSize:11}}/>
            {ROLES_FILTER.map(r=>(
              <button key={r} onClick={()=>setRoleFilter(r)} style={{
                background:roleFilter===r?(ROLE_COLOR[r]||C.primary):"#14112a",
                border:`1px solid ${roleFilter===r?(ROLE_COLOR[r]||C.primary):C.border}`,
                color:roleFilter===r?"#fff":C.textMuted,
                borderRadius:99,padding:"3px 9px",fontSize:10,cursor:"pointer",fontWeight:700}}>{r}</button>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(62px,1fr))",
            gap:4,maxHeight:420,overflowY:"auto"}}>
            {filtered.map(hero=>{
              const used=usedHeroes.has(hero.name);
              return (
                <div key={hero.name} onClick={()=>!used&&pickHero(hero)}
                  style={{opacity:used?0.2:1,cursor:used?"not-allowed":"pointer",transition:"transform .1s"}}
                  onMouseEnter={e=>{if(!used)e.currentTarget.style.transform="scale(1.1)";}}
                  onMouseLeave={e=>{e.currentTarget.style.transform="scale(1)";}}>
                  <HeroCard hero={hero} size={54}/>
                </div>
              );
            })}
          </div>
        </div>
        {renderPickColumn(teamB||"ทีม B","B",picksB,setPicksB,rosterB,C.red)}
      </div>

      {/* Result + side + kills + duration */}
      <div style={{display:"flex",gap:10,alignItems:"flex-end",marginBottom:10,flexWrap:"wrap"}}>
        <div>
          <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>ทีมที่ชนะ</div>
          <div style={{display:"flex",gap:6}}>
            {[{k:"A",label:teamA||"ทีม A",col:C.blue},{k:"B",label:teamB||"ทีม B",col:C.red}].map(opt=>(
              <button key={opt.k} onClick={()=>setResult(opt.k)}
                style={{background:result===opt.k?opt.col+"30":"transparent",
                  border:`2px solid ${result===opt.k?opt.col:C.border}`,
                  color:result===opt.k?opt.col:C.textMuted,
                  borderRadius:8,padding:"5px 12px",cursor:"pointer",fontWeight:700,fontSize:12}}>
                🏆 {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>ฝั่ง {teamA||"ทีม A"}</div>
          <div style={{display:"flex",gap:6}}>
            {[{k:"blue",label:"🔵 Blue",col:C.blue},{k:"red",label:"🔴 Red",col:C.red}].map(s=>(
              <button key={s.k} onClick={()=>setSideA(s.k)}
                style={{background:sideA===s.k?s.col+"30":"transparent",
                  border:`2px solid ${sideA===s.k?s.col:C.border}`,
                  color:sideA===s.k?s.col:C.textMuted,
                  borderRadius:8,padding:"5px 10px",cursor:"pointer",fontWeight:700,fontSize:11}}>
                {s.label}
              </button>
            ))}
          </div>
          <div style={{fontSize:9,color:C.textMuted,marginTop:3}}>
            {teamB||"ทีม B"} = {sideA==="blue"?"🔴 Red":"🔵 Blue"}
          </div>
        </div>
        <div>
          <div style={{fontSize:10,color:C.blue,marginBottom:4}}>Kill {teamA||"A"}</div>
          <input type="number" min="0" value={killsA} onChange={e=>setKillsA(e.target.value)}
            placeholder="0" style={{...iStyle,width:70,padding:"5px 8px",fontSize:12}}/>
        </div>
        <div>
          <div style={{fontSize:10,color:C.red,marginBottom:4}}>Kill {teamB||"B"}</div>
          <input type="number" min="0" value={killsB} onChange={e=>setKillsB(e.target.value)}
            placeholder="0" style={{...iStyle,width:70,padding:"5px 8px",fontSize:12}}/>
        </div>
        <div>
          <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>เวลา (นาที.วินาที)</div>
          <input type="text" inputMode="decimal" value={duration}
            onChange={e=>setDuration(e.target.value)}
            onBlur={e=>setDuration(normalizeDuration(e.target.value))}
            placeholder="09.45" style={{...iStyle,width:80,padding:"5px 8px",fontSize:12}}/>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>Coach Notes</div>
          <input value={note} onChange={e=>setNote(e.target.value)}
            placeholder="วิเคราะห์ draft / pattern..."
            style={{...iStyle,padding:"5px 10px",fontSize:12}}/>
        </div>
      </div>

      {/* Pattern Tags */}
      <div style={{marginBottom:10}}>
        <div style={{fontSize:10,color:C.textMuted,marginBottom:5,fontWeight:700}}>🏷️ Pattern Tags</div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
          {PATTERN_TAGS.map(t=>(
            <button key={t} onClick={()=>toggleTag(t)} style={{
              background:tags.includes(t)?C.primary+"40":"transparent",
              border:`1px solid ${tags.includes(t)?C.primary:C.border}`,
              color:tags.includes(t)?C.primaryLight:C.textMuted,
              borderRadius:99,padding:"3px 10px",fontSize:10,cursor:"pointer",fontWeight:700}}>{t}</button>
          ))}
        </div>
      </div>

      {/* Objective Control accordion */}
      <div style={{marginBottom:12}}>
        <button onClick={()=>setShowObj(v=>!v)} style={{
          background:showObj?C.primary+"20":"transparent",
          border:`1px solid ${showObj?C.primary:C.border}`,
          color:showObj?C.primaryLight:C.textMuted,
          borderRadius:7,padding:"4px 12px",cursor:"pointer",fontSize:11,fontWeight:700}}>
          {showObj?"▲ ซ่อน Objective":"🐉 Objective Control (First Blood/Tower, Abyssal, Dark, Godslayer, Turret)"}
        </button>
        {showObj && (
          <ObjectiveEditor objectives={objectives} onChange={setObjectives}
            teamALabel={teamA||"ทีม A"} teamBLabel={teamB||"ทีม B"}/>
        )}
      </div>

      {/* Stats accordion */}
      <div style={{marginBottom:12}}>
        <button onClick={()=>setShowStats(v=>!v)} style={{
          background:showStats?C.primary+"20":"transparent",
          border:`1px solid ${showStats?C.primary:C.border}`,
          color:showStats?C.primaryLight:C.textMuted,
          borderRadius:7,padding:"4px 12px",cursor:"pointer",fontSize:11,fontWeight:700,marginBottom:showStats?10:0}}>
          {showStats?"▲ ซ่อน Stats":"📊 กรอก Stats ผู้เล่น (K/D/A/Dmg ฯลฯ)"}
        </button>
        {showStats&&(
          <div style={{background:"#080614",borderRadius:10,padding:"12px 14px",border:`1px solid ${C.border}`}}>
            {renderStatsTable("A",picksA,statsA,C.blue,teamA||"ทีม A")}
            {renderStatsTable("B",picksB,statsB,C.red, teamB||"ทีม B")}
          </div>
        )}
      </div>

      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <button onClick={onCancel}
          style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textMuted,
            borderRadius:8,padding:"6px 16px",cursor:"pointer",fontSize:12}}>ยกเลิก</button>
        <button onClick={handleSave}
          style={{background:`linear-gradient(135deg,${C.primary},${C.primaryLight})`,
            color:"#fff",border:"none",borderRadius:8,padding:"6px 20px",
            cursor:"pointer",fontWeight:800,fontSize:12}}>
          ✅ บันทึก Game {gameNo}
        </button>
      </div>
    </div>
  );
}
