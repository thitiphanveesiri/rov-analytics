"use client";
// components/shared/PerformanceTrend.js
// ── Extracted from components/RovApp.js ──
// Two analytics widgets shown together on the Overview page: PerformanceTrend
// (win-rate over time, week/month toggle) and CoachNotesHub (auto-generated
// coaching notes from recent games/rivals). Grouped in one file because they
// sit right next to each other in the original source and share the same
// shape — both take only `allGames`/`rivals` as plain props, no dispatch/
// reducer access, no dependency on any other extracted component.

import { useState } from "react";
import { C, iStyle } from "@/lib/theme";

export function PerformanceTrend({ allGames }) {
  const [period, setPeriod] = useState("week"); // week | month

  if (allGames.length === 0) return null;

  // group games by period
  function getPeriodKey(dateStr) {
    // dateStr = Thai locale like "15 ม.ค. 2568"
    // fallback: use index bucketing if parse fails
    return dateStr || "unknown";
  }

  // sort games by id (proxy for date order)
  const sorted = [...allGames].sort((a,b)=>(a._matchId||0)-(b._matchId||0));

  // bucket into weeks or months (use sequential index since dates are Thai strings)
  const buckets = [];
  const size = period==="week" ? 5 : 10; // games per bucket
  for (let i=0; i<sorted.length; i+=size) {
    const chunk = sorted.slice(i, i+size);
    const wins  = chunk.filter(g=>g.result==="WIN").length;
    const wr    = Math.round(wins/chunk.length*100);
    let totK=0,totD=0,totA=0,cnt=0;
    chunk.forEach(g=>{
      const picks=g.ourPicks||[];
      picks.forEach((slot,idx)=>{
        const gs=g.gameStats?.our?.[idx];
        if(gs?.kills!==undefined){
          totK+=Number(gs.kills||0);totD+=Number(gs.deaths||0);totA+=Number(gs.assists||0);cnt++;
        }
      });
    });
    const kda = cnt ? ((totK+totA)/Math.max(totD,1)).toFixed(2) : null;
    buckets.push({ label:`G${i+1}–${Math.min(i+size,sorted.length)}`, wins, total:chunk.length, wr, kda });
  }

  const maxWR = 100;
  const barH  = 120;

  return (
    <div style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:14,padding:20,marginTop:20}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <h3 style={{margin:0,fontSize:15,fontWeight:800,color:C.primaryLight}}>
          📈 Performance Trend
        </h3>
        <div style={{display:"flex",gap:3,background:C.bgBase,borderRadius:8,padding:3,border:`1px solid ${C.border}`}}>
          {[{id:"week",label:"ทุก 5 เกม"},{id:"month",label:"ทุก 10 เกม"}].map(p=>(
            <button key={p.id} onClick={()=>setPeriod(p.id)} style={{
              background:period===p.id?C.primary:"transparent",
              border:"none",color:period===p.id?"#fff":C.textMuted,
              borderRadius:6,padding:"4px 12px",cursor:"pointer",fontWeight:700,fontSize:11}}>
              {p.label}
            </button>
          ))}
        </div>
        <span style={{fontSize:11,color:C.textMuted,marginLeft:"auto"}}>
          {allGames.length} เกม รวม
        </span>
      </div>

      {buckets.length < 2 ? (
        <div style={{textAlign:"center",padding:"20px 0",color:C.textMuted,fontSize:12}}>
          ต้องการข้อมูลอย่างน้อย {size*2} เกมเพื่อแสดง trend
        </div>
      ) : (
        <div>
          {/* WR bars */}
          <div style={{fontSize:10,color:C.textMuted,fontWeight:700,marginBottom:8}}>Win Rate %</div>
          <div style={{display:"flex",gap:4,alignItems:"flex-end",height:barH+30,marginBottom:20}}>
            {buckets.map((b,i)=>{
              const h = Math.round((b.wr/maxWR)*barH);
              const col = b.wr>=60?C.win:b.wr>=40?"#fdcb6e":C.lose;
              const prev = buckets[i-1];
              const trend = prev ? (b.wr>prev.wr?"▲":b.wr<prev.wr?"▼":"—") : "";
              const trendCol = prev ? (b.wr>prev.wr?C.win:b.wr<prev.wr?C.lose:C.textMuted) : C.textMuted;
              return (
                <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                  <span style={{fontSize:9,color:trendCol,fontWeight:700}}>{trend}</span>
                  <div style={{width:"100%",display:"flex",flexDirection:"column",justifyContent:"flex-end",height:barH}}>
                    <div title={`${b.wr}% (${b.wins}W/${b.total}G)`}
                      style={{width:"100%",height:Math.max(h,4),
                        background:`linear-gradient(180deg,${col},${col}99)`,
                        borderRadius:"4px 4px 0 0",position:"relative",cursor:"default"}}>
                      <div style={{position:"absolute",top:-18,width:"100%",textAlign:"center",
                        fontSize:9,color:col,fontWeight:800}}>{b.wr}%</div>
                    </div>
                  </div>
                  <div style={{fontSize:8,color:C.textMuted,textAlign:"center",lineHeight:1.3}}>
                    {b.label}
                  </div>
                  <div style={{fontSize:8,color:col,fontWeight:700}}>{b.wins}/{b.total}</div>
                </div>
              );
            })}
          </div>

          {/* KDA trend line (only if stats exist) */}
          {buckets.some(b=>b.kda) && (
            <>
              <div style={{height:1,background:C.border,marginBottom:16}}/>
              <div style={{fontSize:10,color:C.textMuted,fontWeight:700,marginBottom:8}}>KDA เฉลี่ย (จากเกมที่กรอก Stats)</div>
              <div style={{display:"flex",gap:4,alignItems:"flex-end",height:60}}>
                {buckets.map((b,i)=>{
                  const maxKDA = Math.max(...buckets.filter(x=>x.kda).map(x=>Number(x.kda)),1);
                  const h = b.kda ? Math.round((Number(b.kda)/maxKDA)*50)+4 : 4;
                  return (
                    <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                      {b.kda && <div style={{fontSize:8,color:"#fdcb6e",fontWeight:700}}>{b.kda}</div>}
                      <div style={{width:"100%",display:"flex",flexDirection:"column",justifyContent:"flex-end",height:54}}>
                        <div style={{width:"100%",height:h,background:b.kda?"#fdcb6e33":"transparent",
                          borderRadius:"3px 3px 0 0",border:b.kda?`1px solid #fdcb6e44`:"none"}}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* summary */}
          {buckets.length >= 2 && (()=>{
            const first = buckets[0].wr;
            const last  = buckets[buckets.length-1].wr;
            const diff  = last - first;
            return (
              <div style={{marginTop:14,padding:"8px 14px",borderRadius:8,
                background:diff>0?C.win+"10":diff<0?C.lose+"10":C.bgCard,
                border:`1px solid ${diff>0?C.win+"30":diff<0?C.lose+"30":C.border}`,
                fontSize:12,color:diff>0?C.win:diff<0?C.lose:C.textMuted}}>
                {diff>0?`🚀 WR เพิ่มขึ้น +${diff}% ตั้งแต่ช่วงแรก`
                 :diff<0?`📉 WR ลดลง ${diff}% ตั้งแต่ช่วงแรก`
                 :"➡️ WR ทรงตัว"}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
//  COACH NOTES HUB
// ═══════════════════════════════════════════
export function CoachNotesHub({ allGames, rivals }) {
  const [search,      setSearch]      = useState("");
  const [filterRival, setFilterRival] = useState("all");

  // รวม notes ทุกเกม
  const notes = allGames
    .filter(g=>g.note && g.note.trim())
    .map(g=>({
      note:      g.note,
      date:      g.date||"",
      rival:     g.rivalName||"",
      result:    g.result||"",
      ourSide:   g.ourSide||"",
      heroNames: (g.ourPicks||[]).filter(s=>s.hero).map(s=>s.hero.name).join(", "),
      _id:       g._matchId,
    }))
    .reverse(); // newest first

  const filtered = notes.filter(n=>{
    const matchRival  = filterRival==="all" || n.rival===filterRival;
    const matchSearch = !search || n.note.toLowerCase().includes(search.toLowerCase())
      || n.rival.toLowerCase().includes(search.toLowerCase());
    return matchRival && matchSearch;
  });

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <h2 style={{margin:0,fontSize:24,fontWeight:800}}>📝 Coach Notes Hub</h2>
        <span style={{fontSize:12,color:C.textMuted}}>{notes.length} notes รวม</span>
      </div>

      {/* filters */}
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="🔍 ค้นหา note..."
          style={{...iStyle,flex:1,minWidth:200,padding:"8px 12px",fontSize:13}}/>
        <select value={filterRival} onChange={e=>setFilterRival(e.target.value)}
          style={{...iStyle,width:180,padding:"8px 12px",fontSize:13}}>
          <option value="all">— ทุกทีม —</option>
          {rivals.map(r=><option key={r.id} value={r.name}>{r.name}</option>)}
        </select>
      </div>

      {notes.length===0 ? (
        <div style={{textAlign:"center",padding:60,background:C.bgPanel,borderRadius:14,color:C.textMuted}}>
          <div style={{fontSize:32,marginBottom:8}}>📝</div>
          ยังไม่มี Coach Note — กรอกใน Match Log ตอนบันทึกเกม
        </div>
      ) : filtered.length===0 ? (
        <div style={{textAlign:"center",padding:40,background:C.bgPanel,borderRadius:12,color:C.textMuted,fontSize:13}}>
          ไม่พบ note ที่ตรงกับ filter
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {filtered.map((n,i)=>(
            <div key={i} style={{background:C.bgPanel,border:`1px solid ${C.border}`,
              borderRadius:12,padding:"14px 18px",
              borderLeft:`4px solid ${n.result==="WIN"?C.win:n.result==="LOSE"?C.lose:C.primary}`}}>
              {/* meta row */}
              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10,flexWrap:"wrap"}}>
                {n.result && (
                  <span style={{padding:"2px 10px",borderRadius:99,fontSize:11,fontWeight:800,
                    background:n.result==="WIN"?C.win+"20":C.lose+"20",
                    color:n.result==="WIN"?C.win:C.lose}}>
                    {n.result}
                  </span>
                )}
                {n.rival && (
                  <span style={{fontWeight:700,fontSize:13,color:C.primaryLight}}>vs {n.rival}</span>
                )}
                {n.ourSide && (
                  <span style={{fontSize:11,padding:"1px 8px",borderRadius:99,fontWeight:700,
                    background:n.ourSide==="blue"?C.blue+"20":C.red+"20",
                    color:n.ourSide==="blue"?C.blue:C.red}}>
                    {n.ourSide==="blue"?"🔵 Blue":"🔴 Red"}
                  </span>
                )}
                <span style={{fontSize:11,color:C.textMuted,marginLeft:"auto"}}>{n.date}</span>
              </div>
              {/* note text */}
              <div style={{fontSize:13,color:C.textMain,lineHeight:1.6,marginBottom:n.heroNames?8:0}}>
                {n.note}
              </div>
              {/* heroes */}
              {n.heroNames && (
                <div style={{fontSize:10,color:C.textMuted,marginTop:4}}>
                  🛡️ {n.heroNames}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
