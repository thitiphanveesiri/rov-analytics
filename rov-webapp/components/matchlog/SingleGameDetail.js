"use client";
import { C } from "@/lib/theme";
import { PlayerAvatar } from "@/components/shared/PlayerMedia";
import { ROLE_COLOR } from "@/lib/heroes";
import { durationToMinutes, formatDurationDisplay } from "@/lib/duration";
import { useState } from "react";
import { EditGameModal, UnifiedStatsEditor } from "@/components/matchlog/EditGameModal";
import { OBJ_DEFAULT, ObjectiveEditor } from "@/components/matchlog/objectives";


export function SingleGameDetail({ g, gameNo, onUpdateStats, onUpdateObjectives, onUpdateGameFull, onJumpToVideo, playerPhotos={}, rivalName, roster=[], enemyRoster=[], videos=[] }) {
  const [showStats, setShowStats] = useState(false);
  const [gameStats, setGameStats] = useState(g.gameStats || { our:{}, enemy:{} });
  const [saved, setSaved] = useState(false);
  const [showObj, setShowObj] = useState(false);
  const [objectives, setObjectives] = useState(g.objectives || OBJ_DEFAULT);
  const [objSaved, setObjSaved] = useState(false);
  const [editingGame, setEditingGame] = useState(false);

  function handleSaveObjectives() {
    onUpdateObjectives && onUpdateObjectives(gameNo - 1, objectives);
    setObjSaved(true);
    setTimeout(() => setObjSaved(false), 2000);
  }

  function handleSave() {
    onUpdateStats && onUpdateStats(gameNo - 1, gameStats);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div style={{background:C.bgCard,borderRadius:10,padding:"12px 14px",
      border:`1px solid ${g.result==="WIN"?C.win+"30":C.lose+"30"}`}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,flexWrap:"wrap"}}>
        <span style={{fontWeight:800,fontSize:13,color:C.primaryLight}}>Game {gameNo}</span>
        <span style={{padding:"2px 10px",borderRadius:99,fontSize:11,fontWeight:800,
          background:g.result==="WIN"?C.win+"20":C.lose+"20",
          color:g.result==="WIN"?C.win:C.lose}}>{g.result}</span>
        {g.ourSide && (
          <span style={{fontSize:10,padding:"1px 8px",borderRadius:99,fontWeight:700,
            background:g.ourSide==="blue"?C.blue+"20":C.red+"20",
            color:g.ourSide==="blue"?C.blue:C.red}}>
            {g.ourSide==="blue"?"🔵 Blue":"🔴 Red"} Side
          </span>
        )}
        <div style={{display:"flex",gap:6,marginLeft:"auto"}}>
          {g.videoId && videos.some(v=>String(v.id)===String(g.videoId)) && (
            <button onClick={()=>onJumpToVideo && onJumpToVideo(g.videoId)}
              style={{background:"transparent",border:`1px solid ${C.border}`,color:C.primaryLight,
                borderRadius:7,padding:"3px 10px",cursor:"pointer",fontSize:11,fontWeight:700}}>
              🎬 ดูวิดีโอ
            </button>
          )}
          <button onClick={()=>setEditingGame(true)}
            style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textMuted,
              borderRadius:7,padding:"3px 10px",cursor:"pointer",fontSize:11,fontWeight:700}}>
            ✏️ แก้ไข
          </button>
        </div>
        <span style={{fontSize:12,color:C.textMuted,width:"100%"}}>
          <span style={{color:C.win,fontWeight:700}}>{g.ourScore||0}</span>
          <span style={{color:C.textMuted}}> : </span>
          <span style={{color:C.lose,fontWeight:700}}>{g.enemyScore||0}</span>
          <span style={{color:C.textMuted,fontSize:11}}> kills</span>
          {g.duration && <span style={{marginLeft:8,color:C.textMuted}}>⏱ {formatDurationDisplay(g.duration)}</span>}
        </span>
      </div>

      {editingGame && (
        <EditGameModal
          game={g}
          roster={roster}
          enemyRoster={enemyRoster}
          videos={videos}
          onSave={updates => onUpdateGameFull && onUpdateGameFull(gameNo - 1, updates)}
          onClose={()=>setEditingGame(false)}
        />
      )}

      {/* Bans */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
        {[
          {label:"🚫 เราแบน",     bans:g.ourBans},
          {label:"🚫 คู่แข่งแบน", bans:g.enemyBans},
        ].map(({label,bans})=>(
          <div key={label} style={{background:"#0e0b1e",borderRadius:8,padding:"8px 10px"}}>
            <div style={{fontSize:10,color:C.ban,fontWeight:700,marginBottom:5}}>{label}</div>
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              {(bans||[]).filter(Boolean).map((h,i)=>(
                // สีแดงจางลงเฉพาะจุดนี้ (ไม่แตะ C.ban ของทั้งแอป เพราะใช้ร่วมกับหน้าอื่นด้วย) —
                // ลด alpha ของพื้นหลังและผสมตัวอักษรกับสีขาวด้วย color-mix ให้ดูนวลตาขึ้นแต่ยังสื่อว่าเป็นฮีโร่ที่ถูกแบนอยู่
                <span key={i} style={{background:C.ban+"12",color:`color-mix(in srgb, ${C.ban} 60%, white)`,fontSize:10,padding:"2px 7px",borderRadius:99}}>
                  {h.name||h}
                </span>
              ))}
              {!(bans||[]).filter(Boolean).length && <span style={{fontSize:10,color:"#3a3a5c"}}>-</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Picks */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
        {[
          {label:"🛡️ ทีมเรา",    picks:g.ourPicks,   col:C.win},
          {label:"⚔️ คู่แข่ง",   picks:g.enemyPicks, col:C.lose},
        ].map(({label,picks,col})=>(
          <div key={label} style={{background:"#0e0b1e",borderRadius:8,padding:"8px 10px"}}>
            <div style={{fontSize:10,color:col,fontWeight:700,marginBottom:5}}>{label}</div>
            {(picks||[]).filter(s=>s.hero).map((s,i)=>{
              const isEnemySide = label.includes("คู่แข่ง");
              const photoKey = s.player
                ? (isEnemySide ? `enemy:${rivalName}:${s.player}` : `our:${s.player}`)
                : null;
              return (
                <div key={i} style={{display:"flex",gap:6,alignItems:"center",marginBottom:3}}>
                  {s.player && (
                    <PlayerAvatar name={s.player} photoUrl={playerPhotos[photoKey]} size={18}
                      team={isEnemySide?"enemy":"our"}/>
                  )}
                  <span style={{fontSize:9,color:ROLE_COLOR[s.role]||C.primaryLight,width:46}}>{s.role}</span>
                  <span style={{fontSize:11,fontWeight:700,flex:1}}>{s.hero?.name||"—"}</span>
                  {s.player && <span style={{fontSize:9,color:C.textMuted}}>{s.player}</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {g.note && (
        <div style={{background:C.primary+"15",borderRadius:7,padding:"7px 10px",
          fontSize:12,color:C.primaryLight,marginBottom:8}}>📝 {g.note}</div>
      )}

      {/* Stats toggle */}
      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
        <button onClick={()=>setShowStats(v=>!v)} style={{
          background:showStats?C.primary+"30":"transparent",
          border:`1px solid ${showStats?C.primary:C.border}`,
          color:showStats?C.primaryLight:C.textMuted,
          borderRadius:7,padding:"4px 12px",cursor:"pointer",fontSize:11,fontWeight:700}}>
          {showStats?"▲ ซ่อน Stats":"📊 Stats ทั้งทีม"}
        </button>
        {showStats && (
          <button onClick={handleSave} style={{
            background:saved?C.win+"30":C.primary,color:"#fff",border:"none",
            borderRadius:7,padding:"4px 14px",cursor:"pointer",fontSize:11,fontWeight:700}}>
            {saved?"✅ บันทึกแล้ว!":"💾 บันทึก Stats"}
          </button>
        )}
        <button onClick={()=>setShowObj(v=>!v)} style={{
          background:showObj?C.primary+"30":"transparent",
          border:`1px solid ${showObj?C.primary:C.border}`,
          color:showObj?C.primaryLight:C.textMuted,
          borderRadius:7,padding:"4px 12px",cursor:"pointer",fontSize:11,fontWeight:700}}>
          {showObj?"▲ ซ่อน Objective":"🐉 Objective Control"}
        </button>
        {showObj && (
          <button onClick={handleSaveObjectives} style={{
            background:objSaved?C.win+"30":C.primary,color:"#fff",border:"none",
            borderRadius:7,padding:"4px 14px",cursor:"pointer",fontSize:11,fontWeight:700}}>
            {objSaved?"✅ บันทึกแล้ว!":"💾 บันทึก Objective"}
          </button>
        )}
      </div>

      {showObj && <ObjectiveEditor objectives={objectives} onChange={setObjectives}/>}


      {showStats && (
        <div style={{marginTop:8}}>
          <UnifiedStatsEditor
            ourPicks={g.ourPicks}
            enemyPicks={g.enemyPicks}
            gameStats={gameStats}
            onChangeStats={setGameStats}
            ourScore={g.ourScore}
            enemyScore={g.enemyScore}
          />
          {/* ── GPM / DPM / Damage Share ── */}
          {durationToMinutes(g.duration) > 0 && (() => {
            const dur = durationToMinutes(g.duration);
            if (!dur) return null;

            // collect our team stats
            const ourStats = (g.ourPicks||[]).map((slot,i) => {
              const st = gameStats.our?.[i] || {};
              return {
                player: slot.player || `Slot ${i+1}`,
                hero:   slot.hero?.name || "—",
                role:   slot.role || "",
                dmg:    Number(st.damage||0),
                gold:   Number(st.gold||0),
                kills:  Number(st.kills||0),
                assists:Number(st.assists||0),
              };
            });

            const totalDmg   = ourStats.reduce((s,p)=>s+p.dmg, 0);
            const totalGold  = ourStats.reduce((s,p)=>s+p.gold, 0);
            const teamKills  = Number(g.ourScore) || ourStats.reduce((s,p)=>s+p.kills, 0); // ใช้สกอร์ทีมที่บันทึกไว้เป็นหลัก ถ้าไม่มีค่อย fallback ไปรวมจากที่กรอกรายคน
            const hasData    = totalDmg > 0 || totalGold > 0;
            if (!hasData) return null;

            return (
              <div style={{marginTop:12,background:"#080614",borderRadius:10,padding:"12px 14px"}}>
                <div style={{fontSize:11,fontWeight:800,color:C.primaryLight,marginBottom:10,
                  display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span>📊 GPM / DPM / Damage Share — เกม {dur} นาที</span>
                  <span style={{fontSize:10,color:C.textMuted}}>ทีมเราเท่านั้น</span>
                </div>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                    <thead>
                      <tr style={{color:C.textMuted,fontSize:10,borderBottom:`1px solid ${C.border}`}}>
                        <th style={{textAlign:"left",padding:"4px 6px"}}>ผู้เล่น / Hero</th>
                        <th style={{textAlign:"center",padding:"4px 6px"}}>DMG</th>
                        <th style={{textAlign:"center",padding:"4px 6px"}}>DPM</th>
                        <th style={{textAlign:"center",padding:"4px 6px"}}>%Dmg</th>
                        <th style={{textAlign:"center",padding:"4px 6px"}}>Gold</th>
                        <th style={{textAlign:"center",padding:"4px 6px"}}>GPM</th>
                        <th style={{textAlign:"center",padding:"4px 6px"}}>DPG</th>
                        <th style={{textAlign:"center",padding:"4px 6px"}}>KP%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ourStats.map((p,i) => {
                        const dpm      = dur ? Math.round(p.dmg/dur) : 0;
                        const gpm      = dur ? Math.round(p.gold/dur) : 0;
                        const dmgShare = totalDmg ? Math.round(p.dmg/totalDmg*100) : 0;
                        const dpg      = p.gold ? (p.dmg/p.gold).toFixed(2) : null; // Damage per Gold — ความคุ้มค่าทองที่ได้
                        const kp       = teamKills ? Math.round((p.kills+p.assists)/teamKills*100) : null; // Kill Participation
                        const roleCol  = ROLE_COLOR[p.role] || C.textMuted;
                        return (
                          <tr key={i} style={{borderBottom:`1px solid ${C.border}30`,
                            background:i%2?"transparent":"#0d0a1e"}}>
                            <td style={{padding:"5px 6px"}}>
                              <div style={{fontWeight:700,fontSize:11}}>{p.player}</div>
                              <div style={{fontSize:9,color:roleCol}}>{p.role} · {p.hero}</div>
                            </td>
                            <td style={{padding:"5px 6px",textAlign:"center",color:C.primaryLight,fontWeight:700}}>
                              {p.dmg ? p.dmg.toLocaleString() : "—"}
                            </td>
                            <td style={{padding:"5px 6px",textAlign:"center",color:"#74b9ff",fontWeight:700}}>
                              {dpm ? dpm.toLocaleString() : "—"}
                            </td>
                            <td style={{padding:"5px 6px",textAlign:"center"}}>
                              {dmgShare > 0 ? (
                                <div style={{display:"flex",alignItems:"center",gap:4}}>
                                  <div style={{flex:1,height:6,background:C.border,borderRadius:3,overflow:"hidden"}}>
                                    <div style={{width:`${dmgShare}%`,height:"100%",
                                      background:dmgShare>=30?"#e17055":dmgShare>=20?C.primary:"#6b6b8a",
                                      borderRadius:3}}/>
                                  </div>
                                  <span style={{fontSize:10,fontWeight:700,color:
                                    dmgShare>=30?"#e17055":dmgShare>=20?C.primaryLight:C.textMuted,
                                    minWidth:28,textAlign:"right"}}>{dmgShare}%</span>
                                </div>
                              ) : "—"}
                            </td>
                            <td style={{padding:"5px 6px",textAlign:"center",color:"#feca57",fontWeight:700}}>
                              {p.gold ? p.gold.toLocaleString() : "—"}
                            </td>
                            <td style={{padding:"5px 6px",textAlign:"center",color:"#00b894",fontWeight:700}}>
                              {gpm ? gpm.toLocaleString() : "—"}
                            </td>
                            <td style={{padding:"5px 6px",textAlign:"center",color:"#fd79a8",fontWeight:700}}>
                              {dpg ?? "—"}
                            </td>
                            <td style={{padding:"5px 6px",textAlign:"center",color:kp>=60?"#e17055":C.textMain,fontWeight:700}}>
                              {kp!=null ? `${kp}%` : "—"}
                            </td>
                          </tr>
                        );
                      })}
                      {/* totals row */}
                      {(totalDmg > 0 || totalGold > 0) && (
                        <tr style={{borderTop:`2px solid ${C.border}`,background:"#0a0820"}}>
                          <td style={{padding:"5px 6px",fontWeight:800,color:C.primaryLight,fontSize:10}}>
                            รวมทีม
                          </td>
                          <td style={{padding:"5px 6px",textAlign:"center",fontWeight:800,color:C.primaryLight}}>
                            {totalDmg.toLocaleString()}
                          </td>
                          <td style={{padding:"5px 6px",textAlign:"center",fontWeight:800,color:"#74b9ff"}}>
                            {dur ? Math.round(totalDmg/dur).toLocaleString() : "—"}
                          </td>
                          <td style={{padding:"5px 6px",textAlign:"center",color:C.textMuted,fontSize:10}}>
                            100%
                          </td>
                          <td style={{padding:"5px 6px",textAlign:"center",fontWeight:800,color:"#feca57"}}>
                            {totalGold.toLocaleString()}
                          </td>
                          <td style={{padding:"5px 6px",textAlign:"center",fontWeight:800,color:"#00b894"}}>
                            {dur ? Math.round(totalGold/dur).toLocaleString() : "—"}
                          </td>
                          <td style={{padding:"5px 6px",textAlign:"center",fontWeight:800,color:"#fd79a8"}}>
                            {totalGold ? (totalDmg/totalGold).toFixed(2) : "—"}
                          </td>
                          <td style={{padding:"5px 6px",textAlign:"center",color:C.textMuted,fontSize:10}}>
                            —
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div style={{fontSize:9,color:C.textMuted,marginTop:6,textAlign:"right"}}>
                  DPM = Damage/นาที · GPM = Gold/นาที · %Dmg = สัดส่วนดาเมจในทีม ·
                  DPG = Damage/ทอง 1 หน่วย (ความคุ้มค่าทอง) · KP% = (Kill+Assist ของผู้เล่น) / Kill รวมทีม
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
