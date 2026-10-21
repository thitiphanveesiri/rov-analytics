"use client";
import { C } from "@/lib/theme";
import { useState } from "react";
import { MatchupDetail, calcMatchupStats } from "@/components/scoutlog/MatchupDetail";
import { ObjectiveSummaryDisplay, computeObjectiveSummary, flattenScoutObjectivesForFocus } from "@/components/matchlog/objectives";
import { ScoutSessionCreator } from "@/components/scoutlog/ScoutSessionCreator";


// ── Scout Log Page: matchup list ──
export function ScoutLogPage({ rivalName, scoutMatches, rivals, enemyRosters, isCoach, onSaveScout, onDeleteScout, onUpdateScoutGame }) {
  const [creating,       setCreating]       = useState(false);
  const [selOpponent,    setSelOpponent]    = useState(null);
  const [scoutCatFilter, setScoutCatFilter] = useState("all"); // "all" | "scrim" | "tournament"

  // records ที่ rivalName เกี่ยวข้อง
  const related = scoutMatches.filter(sm=>sm.teamA===rivalName||sm.teamB===rivalName);

  // สร้าง matchup map: { opponentName → records[] }
  const matchupMap = {};
  related.forEach(sm=>{
    const opp = sm.teamA===rivalName ? sm.teamB : sm.teamA;
    if (!matchupMap[opp]) matchupMap[opp]=[];
    matchupMap[opp].push(sm);
  });
  const matchups = Object.entries(matchupMap)
    .map(([opp,recs])=>({ opp, recs, ...calcMatchupStats(recs,rivalName) }))
    .sort((a,b)=>b.games-a.games);

  if (creating) return (
    <ScoutSessionCreator rivals={rivals} enemyRosters={enemyRosters}
      onSave={data=>{onSaveScout(data);setCreating(false);}}
      onCancel={()=>setCreating(false)}/>
  );

  // ── Drill-down: A vs B ──
  if (selOpponent) return (
    <MatchupDetail
      rivalName={rivalName}
      opponent={selOpponent}
      records={matchupMap[selOpponent]||[]}
      rivals={rivals}
      enemyRosters={enemyRosters}
      onSaveScout={data=>{onSaveScout(data);}}
      onDeleteScout={onDeleteScout}
      onUpdateScoutGame={onUpdateScoutGame}
      onBack={()=>setSelOpponent(null)}
    />
  );

  // ── Level 1: matchup list ──
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <h3 style={{margin:0,fontSize:15,fontWeight:800,color:C.primaryLight}}>
          🔍 Scout Log — {rivalName}
        </h3>
        {isCoach && (
          <button onClick={()=>setCreating(true)}
            style={{marginLeft:"auto",background:`linear-gradient(135deg,${C.primary},${C.primaryLight})`,
              color:"#fff",border:"none",borderRadius:9,padding:"7px 16px",
              cursor:"pointer",fontWeight:800,fontSize:12}}>
            + บันทึก Scout ใหม่
          </button>
        )}
      </div>

      {!isCoach && (
        <div style={{background:C.primary+"12",border:`1px solid ${C.primary}30`,borderRadius:10,
          padding:"9px 14px",marginBottom:14,fontSize:12,color:C.textMuted,
          display:"flex",alignItems:"center",gap:8}}>
          <span>🔒</span>
          <span>Scout log เป็นข้อมูลที่โค้ช/แอดมินจัดการ — ข้อมูลจากการซ้อมของทีมคู่แข่งดูได้เฉพาะโค้ช/แอดมินเท่านั้น ข้อมูลจากแมตช์แข่งจริงดูได้ตามปกติ</span>
        </div>
      )}

      {related.length>0 && (
        <ObjectiveSummaryDisplay
          objSummary={computeObjectiveSummary(flattenScoutObjectivesForFocus(related, rivalName))}
          ourLabel={rivalName} enemyLabel="คู่แข่งที่เจอ"
          title={`🐉 Objective Control — จากที่ scout มา (${rivalName})`}
        />
      )}

      {related.length===0 ? (
        <div style={{textAlign:"center",padding:"40px 20px",background:C.bgPanel,
          borderRadius:14,color:C.textMuted}}>
          <div style={{fontSize:32,marginBottom:8}}>🔍</div>
          ยังไม่มี Scout record ของ {rivalName}<br/>
          <span style={{fontSize:12}}>กด "+ บันทึก Scout ใหม่" เพื่อเริ่มจด</span>
        </div>
      ) : (
        <>
          {/* ── Category filter tabs ── */}
          {(()=>{
            const scrimCount = related.filter(sm=>!sm.category||sm.category==="scrim").length;
            const tourneyCount = related.filter(sm=>sm.category==="tournament").length;
            const filteredMatchups = matchups.filter(mu=>{
              if(scoutCatFilter==="all") return true;
              return mu.recs.some(sm=>scoutCatFilter==="tournament"
                ? sm.category==="tournament"
                : (!sm.category||sm.category==="scrim"));
            });
            return (
              <>
                <div style={{display:"flex",gap:6,marginBottom:14}}>
                  {[{id:"all",label:"ทั้งหมด",count:related.length},
                    {id:"scrim",label:"🏋️ ซ้อม",count:scrimCount},
                    {id:"tournament",label:"🏆 แข่ง",count:tourneyCount}].map(t=>(
                    <button key={t.id} onClick={()=>setScoutCatFilter(t.id)}
                      style={{background:scoutCatFilter===t.id?C.primary+"30":"transparent",
                        border:`2px solid ${scoutCatFilter===t.id?C.primary:C.border}`,
                        color:scoutCatFilter===t.id?C.primaryLight:C.textMuted,
                        borderRadius:99,padding:"5px 14px",cursor:"pointer",fontWeight:700,fontSize:11}}>
                      {t.label} <span style={{opacity:0.6,fontWeight:400}}>({t.count})</span>
                    </button>
                  ))}
                </div>
                <p style={{margin:"0 0 12px",color:C.textMuted,fontSize:12}}>
                  เลือก matchup เพื่อดูรายละเอียด
                </p>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {filteredMatchups.map(mu=>(
              <div key={mu.opp}
                onClick={()=>setSelOpponent(mu.opp)}
                style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:14,
                  padding:"14px 18px",cursor:"pointer",
                  borderLeft:`4px solid ${mu.wr>=50?C.win:mu.games===0?"#555":C.lose}`,
                  display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}
                onMouseEnter={e=>e.currentTarget.style.borderColor=C.primary}
                onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>

                {/* team names */}
                <div style={{minWidth:180}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                    <span style={{fontWeight:900,fontSize:15,color:C.blue}}>{rivalName}</span>
                    <span style={{color:C.textMuted,fontWeight:700,fontSize:12}}>vs</span>
                    <span style={{fontWeight:900,fontSize:15,color:C.red}}>{mu.opp}</span>
                  </div>
                  <div style={{fontSize:11,color:C.textMuted}}>
                    {mu.recs.length} session · {mu.games} เกม
                  </div>
                </div>

                {/* W/L record */}
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <div style={{background:C.win+"20",borderRadius:8,padding:"4px 12px",textAlign:"center"}}>
                    <div style={{fontSize:16,fontWeight:800,color:C.win}}>{mu.wins}</div>
                    <div style={{fontSize:9,color:C.textMuted}}>W</div>
                  </div>
                  <span style={{color:C.textMuted,fontWeight:700}}>—</span>
                  <div style={{background:C.lose+"20",borderRadius:8,padding:"4px 12px",textAlign:"center"}}>
                    <div style={{fontSize:16,fontWeight:800,color:C.lose}}>{mu.losses}</div>
                    <div style={{fontSize:9,color:C.textMuted}}>L</div>
                  </div>
                </div>

                {/* WR badge */}
                <div style={{textAlign:"center",minWidth:52}}>
                  <div style={{fontSize:20,fontWeight:800,color:mu.wr>=50?C.win:C.lose}}>
                    {mu.games?`${mu.wr}%`:"-"}
                  </div>
                  <div style={{fontSize:9,color:C.textMuted}}>Win Rate</div>
                </div>

                {/* kill ratio */}
                {(mu.kFor>0||mu.kAgainst>0)&&(
                  <div style={{textAlign:"center",minWidth:80}}>
                    <div style={{fontSize:13,fontWeight:700}}>
                      <span style={{color:C.win}}>{mu.kFor}</span>
                      <span style={{color:C.textMuted,margin:"0 4px"}}>:</span>
                      <span style={{color:C.lose}}>{mu.kAgainst}</span>
                    </div>
                    <div style={{fontSize:9,color:C.textMuted}}>kills</div>
                  </div>
                )}

                {/* last game tags */}
                {(()=>{
                  const lastGame = mu.recs[mu.recs.length-1];
                  const lastG = (lastGame?.games||[]).slice(-1)[0];
                  const tags = lastG?.tags||[];
                  return tags.length>0&&(
                    <div style={{display:"flex",gap:4,flexWrap:"wrap",flex:1}}>
                      {tags.slice(0,3).map(t=>(
                        <span key={t} style={{background:C.primary+"20",color:C.primaryLight,
                          fontSize:9,padding:"2px 8px",borderRadius:99,fontWeight:700}}>{t}</span>
                      ))}
                    </div>
                  );
                })()}

                <span style={{marginLeft:"auto",color:C.textMuted,fontSize:13}}>→</span>
              </div>
            ))}
                </div>
              </>
            );
          })()}
        </>
      )}
    </div>
  );
}
