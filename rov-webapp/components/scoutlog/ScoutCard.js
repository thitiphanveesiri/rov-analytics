"use client";
import { C } from "@/lib/theme";
import { HeroChip } from "@/components/shared/HeroChip";
import { ROLE_COLOR } from "@/lib/heroes";
import { formatDurationDisplay } from "@/lib/duration";
import { useState } from "react";
import { EditScoutGameModal } from "@/components/scoutlog/EditScoutGameModal";
import { MatchDraftSummaryModal, scoutGameToBlueRed } from "@/components/matchlog/MatchCard";


export function ScoutCard({ sm, onDelete, onUpdateGame }) {
  const [open, setOpen] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [editingGameIdx, setEditingGameIdx] = useState(null);
  const gamesArr = sm.games||[];
  const aWins = gamesArr.filter(g=>g.teamAResult==="WIN").length;
  const bWins = gamesArr.length - aWins;

  // รวม kills ทั้ง session
  const totKillsA = gamesArr.reduce((s,g)=>s+Number(g.killsA||0),0);
  const totKillsB = gamesArr.reduce((s,g)=>s+Number(g.killsB||0),0);

  return (
    <div style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:14,
      marginBottom:10,overflow:"hidden",borderLeft:`4px solid ${C.primary}`}}>
      <div onClick={()=>setOpen(v=>!v)}
        style={{padding:"12px 18px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <span style={{fontSize:18}}>🔍</span>
        <div>
          <span style={{fontWeight:800,color:C.blue,fontSize:14}}>{sm.teamA}</span>
          <span style={{color:C.textMuted,margin:"0 8px",fontWeight:700}}>vs</span>
          <span style={{fontWeight:800,color:C.red,fontSize:14}}>{sm.teamB}</span>
        </div>
        <span style={{fontSize:11,color:C.textMuted}}>{sm.date}</span>
        <span style={{fontSize:11,padding:"2px 9px",borderRadius:99,fontWeight:700,
          background:C.primary+"20",color:C.primaryLight}}>{sm.boType}</span>
        {sm.category==="tournament"
          ? <span style={{background:"#f9ca24"+"30",border:"1px solid #f9ca24"+"60",color:"#f9ca24",
              borderRadius:99,padding:"2px 9px",fontSize:10,fontWeight:800}}>🏆 แข่ง</span>
          : <span style={{background:C.border+"40",color:C.textMuted,
              borderRadius:99,padding:"2px 9px",fontSize:10,fontWeight:700}}>🏋️ ซ้อม</span>
        }
        <div style={{marginLeft:"auto",display:"flex",gap:12,alignItems:"center"}}>
          {/* win score */}
          <div style={{display:"flex",gap:4,alignItems:"center"}}>
            <span style={{fontSize:13,color:C.blue,fontWeight:800}}>{aWins}W</span>
            <span style={{fontSize:11,color:C.textMuted}}>—</span>
            <span style={{fontSize:13,color:C.red,fontWeight:800}}>{bWins}W</span>
          </div>
          {/* kill score */}
          {(totKillsA>0||totKillsB>0)&&(
            <div style={{display:"flex",gap:4,alignItems:"center",
              background:C.bgCard,borderRadius:7,padding:"2px 8px",fontSize:11}}>
              <span style={{color:C.blue,fontWeight:700}}>{totKillsA}</span>
              <span style={{color:C.textMuted}}>:</span>
              <span style={{color:C.red,fontWeight:700}}>{totKillsB}</span>
              <span style={{color:C.textMuted,fontSize:9}}>kills</span>
            </div>
          )}
          <span style={{color:C.textMuted,fontSize:13}}>{open?"▲":"▼"}</span>
        </div>
      </div>

      {open&&(
        <div style={{padding:"0 16px 16px"}}>
          {gamesArr.map((g,gi)=>{
            const winner = g.teamAResult==="WIN" ? sm.teamA : sm.teamB;
            const hasStatsA = g.statsA && Object.values(g.statsA).some(s=>s?.kills!==undefined);
            const hasStatsB = g.statsB && Object.values(g.statsB).some(s=>s?.kills!==undefined);
            const hasAnyStats = hasStatsA || hasStatsB;

            return (
              <div key={gi} style={{background:C.bgCard,borderRadius:10,padding:"12px 14px",
                marginBottom:8,border:`1px solid ${C.border}`}}>
                {/* game header */}
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,flexWrap:"wrap"}}>
                  <span style={{fontWeight:800,fontSize:12,color:C.primaryLight}}>Game {gi+1}</span>
                  <span style={{padding:"2px 10px",borderRadius:99,fontSize:11,fontWeight:800,
                    background:C.win+"20",color:C.win}}>🏆 {winner}</span>
                  <button onClick={()=>setEditingGameIdx(gi)}
                    style={{marginLeft:"auto",background:"transparent",border:`1px solid ${C.border}`,
                      color:C.textMuted,borderRadius:6,padding:"2px 9px",cursor:"pointer",fontSize:10,fontWeight:700}}>
                    ✏️ แก้ไข
                  </button>
                  {g.sideA&&(
                    <span style={{fontSize:10,color:C.textMuted}}>
                      <span style={{color:g.sideA==="blue"?C.blue:C.red,fontWeight:700}}>
                        {g.sideA==="blue"?"🔵":"🔴"} {sm.teamA}
                      </span>
                      {" vs "}
                      <span style={{color:g.sideA==="blue"?C.red:C.blue,fontWeight:700}}>
                        {g.sideA==="blue"?"🔴":"🔵"} {sm.teamB}
                      </span>
                    </span>
                  )}
                  {(g.killsA||g.killsB)&&(
                    <span style={{fontSize:11,color:C.textMuted}}>
                      <span style={{color:C.blue,fontWeight:700}}>{g.killsA||0}</span>
                      <span style={{margin:"0 4px"}}>:</span>
                      <span style={{color:C.red,fontWeight:700}}>{g.killsB||0}</span>
                      <span style={{fontSize:9}}> kills</span>
                    </span>
                  )}
                  {g.duration&&<span style={{fontSize:11,color:C.textMuted}}>⏱ {formatDurationDisplay(g.duration)}</span>}
                  {g.tags&&g.tags.length>0&&(
                    <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                      {g.tags.map(t=>(
                        <span key={t} style={{background:C.primary+"20",color:C.primaryLight,
                          fontSize:9,padding:"1px 7px",borderRadius:99,fontWeight:700}}>{t}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── Ban Order Display ── */}
                {(g.bansA?.some(Boolean)||g.bansB?.some(Boolean))&&(
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                    {[{label:sm.teamA,bans:g.bansA||[],col:C.blue,sideLabel:g.sideA==="blue"?"🔵":"🔴"},
                      {label:sm.teamB,bans:g.bansB||[],col:C.red, sideLabel:g.sideA==="blue"?"🔴":"🔵"}].map(({label,bans,col,sideLabel})=>(
                      <div key={label}>
                        <div style={{fontSize:10,color:col,fontWeight:700,marginBottom:5}}>
                          {sideLabel} {label} แบน:
                        </div>
                        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                          {bans.map((h,i)=>h&&(
                            <div key={i} style={{position:"relative"}}>
                              <HeroChip name={h.name} size={32} accentCol={col} fontSize={9}/>
                              <div style={{position:"absolute",top:-3,left:-3,
                                background:col,color:"#fff",fontSize:8,fontWeight:900,
                                width:14,height:14,borderRadius:"50%",
                                display:"flex",alignItems:"center",justifyContent:"center",
                                lineHeight:1}}>
                                {i+1}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* picks + inline stats */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:g.note?8:0}}>
                  {[
                    {label:`🔵 ${sm.teamA}`,picks:g.picksA,stats:g.statsA||{},col:C.blue},
                    {label:`🔴 ${sm.teamB}`,picks:g.picksB,stats:g.statsB||{},col:C.red},
                  ].map(({label,picks,stats,col})=>(
                    <div key={label} style={{background:"#0e0b1e",borderRadius:8,padding:"8px 10px"}}>
                      <div style={{fontSize:10,color:col,fontWeight:700,marginBottom:6}}>{label}</div>
                      {(picks||[]).filter(s=>s.hero).map((s,i)=>{
                        const ps = stats[i]||{};
                        const hasPs = ps.kills!==undefined;
                        const kda = hasPs
                          ? ((Number(ps.kills||0)+Number(ps.assists||0))/Math.max(Number(ps.deaths||1),1)).toFixed(1)
                          : null;
                        return (
                          <div key={i} style={{marginBottom:5}}>
                            <div style={{display:"flex",gap:6,alignItems:"center"}}>
                              <span style={{fontSize:9,color:ROLE_COLOR[s.role]||col,width:44}}>{s.role}</span>
                              <span style={{fontSize:11,fontWeight:700,flex:1}}>{s.hero?.name||"—"}</span>
                              {s.player&&<span style={{fontSize:9,color:C.textMuted}}>{s.player}</span>}
                              {kda&&<span style={{fontSize:9,color:"#fdcb6e",fontWeight:700}}>KDA {kda}</span>}
                            </div>
                            {hasPs&&(
                              <div style={{display:"flex",gap:6,marginLeft:50,marginTop:1}}>
                                <span style={{fontSize:9,color:"#00cec9"}}>{ps.kills??"-"}K</span>
                                <span style={{fontSize:9,color:C.lose}}>{ps.deaths??"-"}D</span>
                                <span style={{fontSize:9,color:"#a29bfe"}}>{ps.assists??"-"}A</span>
                                {ps.damage&&<span style={{fontSize:9,color:"#e17055"}}>{Number(ps.damage).toLocaleString()} dmg</span>}
                                {ps.damageTaken&&<span style={{fontSize:9,color:"#fd79a8"}}>{Number(ps.damageTaken).toLocaleString()} tkn</span>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>

                {g.note&&(
                  <div style={{background:C.primary+"12",borderRadius:7,padding:"6px 10px",
                    fontSize:11,color:C.primaryLight,marginTop:6}}>
                    📝 {g.note}
                  </div>
                )}
                {editingGameIdx===gi && (
                  <EditScoutGameModal
                    game={g} teamA={sm.teamA} teamB={sm.teamB}
                    onSave={updates => { onUpdateGame && onUpdateGame(gi, updates); setEditingGameIdx(null); }}
                    onClose={()=>setEditingGameIdx(null)}
                  />
                )}
              </div>
            );
          })}
          <div style={{display:"flex",gap:8,marginTop:4}}>
            <button onClick={()=>setShowSummary(true)}
              style={{background:"transparent",border:`1px solid ${C.border}`,color:"#feca57",
                borderRadius:7,padding:"5px 14px",cursor:"pointer",fontSize:11,fontWeight:700}}>
              📸 สรุปภาพรวม Draft
            </button>
            <button onClick={()=>{if(window.confirm("ลบ Scout record นี้?"))onDelete(sm.id);}}
              style={{background:C.lose+"15",border:`1px solid ${C.lose}30`,color:C.lose,
                borderRadius:7,padding:"5px 14px",cursor:"pointer",fontSize:11,fontWeight:700}}>
              🗑️ ลบ
            </button>
          </div>
          {showSummary && (
            <MatchDraftSummaryModal
              games={gamesArr}
              toBlueRed={g => scoutGameToBlueRed(g, sm.teamA, null, sm.teamB, null)}
              teamAName={sm.teamA}
              teamBName={sm.teamB}
              onClose={()=>setShowSummary(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}
