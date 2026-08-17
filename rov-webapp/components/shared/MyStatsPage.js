"use client";
// components/shared/MyStatsPage.js
// ── Extracted from components/RovApp.js ──
// Personal stats dashboard ("Dashboard ส่วนตัวของผู้เล่นแต่ละคน") — plain
// props + one callback (onLinkPlayer), no dispatch/reducer access. Only
// external dependencies are HeroChip and PlayerAvatar, already exported
// from HeroChip.js and PlayerMedia.js. CompareRow and the local avg()
// helper stay defined inside the component itself (verbatim, unchanged)
// since they're only ever used here.

import { useState } from "react";
import { C } from "@/lib/theme";
import { HeroChip } from "@/components/shared/HeroChip";
import { PlayerAvatar } from "@/components/shared/PlayerMedia";

export function MyStatsPage({ session, roster, allGames, playerPhotos, onLinkPlayer }) {
  const playerName = session?.user?.playerName || "";
  const [selecting, setSelecting] = useState(!playerName);
  const [choice, setChoice] = useState(playerName);
  const [saving, setSaving] = useState(false);

  async function confirmLink(name) {
    if (!name) return;
    setSaving(true);
    try { await onLinkPlayer(name); setSelecting(false); }
    finally { setSaving(false); }
  }

  if (selecting) {
    return (
      <div style={{padding:"0 24px 40px",maxWidth:520,margin:"40px auto",textAlign:"center"}}>
        <div style={{fontSize:40,marginBottom:10}}>👤</div>
        <h2 style={{margin:"0 0 8px",fontSize:22,fontWeight:800}}>คุณคือผู้เล่นคนไหน?</h2>
        <p style={{margin:"0 0 20px",color:C.textMuted,fontSize:13}}>
          เลือกชื่อของคุณจาก roster เพื่อดูสถิติส่วนตัว (K/D/A, hero pool, เทียบกับค่าเฉลี่ยทีม)
        </p>
        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
          {roster.map(name=>(
            <button key={name} onClick={()=>setChoice(name)}
              style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",
                background:choice===name?C.primary+"25":C.bgPanel,
                border:`1px solid ${choice===name?C.primary:C.border}`,
                borderRadius:10,cursor:"pointer",textAlign:"left"}}>
              <PlayerAvatar name={name} photoUrl={playerPhotos?.[name]} size={32}/>
              <span style={{fontWeight:700,fontSize:13,color:choice===name?C.primaryLight:C.textMain}}>{name}</span>
            </button>
          ))}
          {roster.length===0 && (
            <div style={{color:C.textMuted,fontSize:12}}>ยังไม่มีรายชื่อผู้เล่นใน roster</div>
          )}
        </div>
        <button onClick={()=>confirmLink(choice)} disabled={!choice||saving}
          style={{background:choice?C.primary:C.border,color:"#fff",border:"none",borderRadius:9,
            padding:"10px 28px",cursor:choice?"pointer":"default",fontWeight:700,fontSize:13,
            opacity:saving?0.6:1}}>
          {saving?"กำลังบันทึก...":"✅ ยืนยัน"}
        </button>
      </div>
    );
  }

  // ── หาเกมที่ผู้เล่นนี้ลงเล่น ──
  const myRows = [];
  allGames.forEach(g=>{
    const idx = (g.ourPicks||[]).findIndex(p=>p?.player===playerName);
    if (idx===-1) return;
    const stat = g.gameStats?.our?.[idx] || {};
    myRows.push({
      hero: g.ourPicks[idx]?.hero?.name || null,
      role: g.ourPicks[idx]?.role,
      result: g.result,
      date: g.date,
      rivalName: g.rivalName,
      kills:   Number(stat.kills)   || 0,
      deaths:  Number(stat.deaths)  || 0,
      assists: Number(stat.assists) || 0,
      hasStats: stat.kills!=null || stat.deaths!=null || stat.assists!=null,
    });
  });

  const total = myRows.length;
  const wins  = myRows.filter(r=>r.result==="WIN").length;
  const withStats = myRows.filter(r=>r.hasStats);
  const avg = (field) => withStats.length ? (withStats.reduce((s,r)=>s+r[field],0)/withStats.length) : 0;
  const avgK = avg("kills"), avgD = avg("deaths"), avgA = avg("assists");
  const kdaRatio = avgD>0 ? ((avgK+avgA)/avgD).toFixed(2) : (avgK+avgA>0?"∞":"0.00");

  // ── ค่าเฉลี่ยทีม (ทุกคนรวมกัน) เพื่อเทียบ ──
  const teamRows = [];
  allGames.forEach(g=>{
    (g.ourPicks||[]).forEach((p,idx)=>{
      const stat = g.gameStats?.our?.[idx];
      if (stat && (stat.kills!=null||stat.deaths!=null||stat.assists!=null)) {
        teamRows.push({ kills:Number(stat.kills)||0, deaths:Number(stat.deaths)||0, assists:Number(stat.assists)||0 });
      }
    });
  });
  const teamAvg = (field) => teamRows.length ? (teamRows.reduce((s,r)=>s+r[field],0)/teamRows.length) : 0;
  const teamAvgK = teamAvg("kills"), teamAvgD = teamAvg("deaths"), teamAvgA = teamAvg("assists");

  // ── Hero pool ──
  const heroPool = {};
  myRows.forEach(r=>{
    if (!r.hero) return;
    if (!heroPool[r.hero]) heroPool[r.hero] = { picks:0, wins:0 };
    heroPool[r.hero].picks++;
    if (r.result==="WIN") heroPool[r.hero].wins++;
  });
  const heroArr = Object.entries(heroPool)
    .map(([hero,s])=>({hero,picks:s.picks,wr:Math.round(s.wins/s.picks*100)}))
    .sort((a,b)=>b.picks-a.picks);

  const CompareRow = ({ label, mine, team }) => {
    const diff = mine - team;
    const better = diff > 0.05;
    const worse  = diff < -0.05;
    return (
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",
        borderBottom:`1px solid ${C.border}30`}}>
        <span style={{fontSize:12,color:C.textMuted}}>{label}</span>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:13,fontWeight:800}}>{mine.toFixed(1)}</span>
          <span style={{fontSize:10,color:C.textMuted}}>ทีมเฉลี่ย {team.toFixed(1)}</span>
          {(better||worse) && (
            <span style={{fontSize:10,fontWeight:700,color:better?C.win:C.lose}}>
              {better?"▲":"▼"} {Math.abs(diff).toFixed(1)}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{padding:"0 24px 40px",maxWidth:900,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:20,flexWrap:"wrap"}}>
        <PlayerAvatar name={playerName} photoUrl={playerPhotos?.[playerName]} size={56}/>
        <div style={{flex:1}}>
          <h2 style={{margin:0,fontSize:22,fontWeight:800}}>{playerName}</h2>
          <p style={{margin:"2px 0 0",color:C.textMuted,fontSize:12}}>สถิติส่วนตัวจากทุกแมตช์ที่บันทึกไว้</p>
        </div>
        <button onClick={()=>{setChoice(playerName);setSelecting(true);}}
          style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textMuted,
            borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:11,fontWeight:700}}>
          🔄 เปลี่ยนชื่อที่ผูกไว้
        </button>
      </div>

      {total===0 ? (
        <div style={{textAlign:"center",padding:"40px 0",color:C.textMuted,fontSize:13}}>
          ยังไม่พบข้อมูลเกมของ "{playerName}" — ต้องมีชื่อตรงกับที่กรอกไว้ตอน Draft/Pick เป๊ะๆ
        </div>
      ) : (
        <>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))",gap:12,marginBottom:16}}>
            {[
              {label:"เกมทั้งหมด", val:total, col:C.primaryLight},
              {label:"ชนะ",        val:wins,  col:C.win},
              {label:"Win Rate",   val:`${Math.round(wins/total*100)}%`, col:C.primaryLight},
              {label:"KDA Ratio",  val:kdaRatio, col:"#feca57"},
            ].map(c=>(
              <div key={c.label} style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:12,
                padding:"14px 10px",textAlign:"center"}}>
                <div style={{fontSize:10,color:C.textMuted,marginBottom:6}}>{c.label}</div>
                <div style={{fontSize:20,fontWeight:800,color:c.col}}>{c.val}</div>
              </div>
            ))}
          </div>

          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))",gap:16}}>
            <div style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:14,padding:18}}>
              <div style={{fontWeight:800,fontSize:13,color:C.primaryLight,marginBottom:10}}>
                📈 K/D/A เทียบกับค่าเฉลี่ยทีม
              </div>
              {withStats.length===0 ? (
                <div style={{color:C.textMuted,fontSize:12,textAlign:"center",padding:"12px 0"}}>
                  ยังไม่มีข้อมูล K/D/A (โค้ชยังไม่ได้กรอก Stats ในเกมที่คุณเล่น)
                </div>
              ) : (
                <>
                  <CompareRow label="⚔️ Kills เฉลี่ย"   mine={avgK} team={teamAvgK}/>
                  <CompareRow label="💀 Deaths เฉลี่ย"  mine={avgD} team={teamAvgD}/>
                  <CompareRow label="🤝 Assists เฉลี่ย" mine={avgA} team={teamAvgA}/>
                </>
              )}
            </div>

            <div style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:14,padding:18}}>
              <div style={{fontWeight:800,fontSize:13,color:C.primaryLight,marginBottom:10}}>
                🦸 Hero Pool ของฉัน
              </div>
              {heroArr.length===0 ? (
                <div style={{color:C.textMuted,fontSize:12,textAlign:"center",padding:"12px 0"}}>ยังไม่มีข้อมูล</div>
              ) : (
                <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:220,overflowY:"auto"}}>
                  {heroArr.map((h,i)=>(
                    <div key={h.hero} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                      padding:"6px 8px",background:i%2===0?"transparent":C.bgCard,borderRadius:7}}>
                      <HeroChip name={h.hero} size={26} fontSize={12}/>
                      <div style={{display:"flex",gap:8,alignItems:"center"}}>
                        <span style={{fontSize:10,color:C.textMuted}}>{h.picks} เกม</span>
                        <span style={{fontSize:11,fontWeight:700,padding:"1px 8px",borderRadius:5,
                          background:h.wr>=50?C.win+"20":C.lose+"20",color:h.wr>=50?C.win:C.lose}}>
                          ชนะ {h.wr}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Recent games ── */}
          <div style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:14,padding:18,marginTop:16}}>
            <div style={{fontWeight:800,fontSize:13,color:C.primaryLight,marginBottom:10}}>🕒 เกมล่าสุด</div>
            <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:280,overflowY:"auto"}}>
              {/* myRows เรียงใหม่ไปเก่าอยู่แล้ว (ตาม allGames) — เอา 15 ตัวแรกคือ 15 เกมล่าสุดพอดี ไม่ต้อง reverse ก่อน */}
              {myRows.slice(0,15).map((r,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 8px",
                  background:i%2===0?"transparent":C.bgCard,borderRadius:7}}>
                  <span style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:5,
                    background:r.result==="WIN"?C.win+"20":C.lose+"20",color:r.result==="WIN"?C.win:C.lose,minWidth:36,textAlign:"center"}}>
                    {r.result==="WIN"?"WIN":"LOSE"}
                  </span>
                  {r.hero && <HeroChip name={r.hero} size={24} fontSize={11}/>}
                  {r.hasStats && (
                    <span style={{fontSize:11,color:C.textMuted}}>{r.kills}/{r.deaths}/{r.assists}</span>
                  )}
                  <div style={{flex:1}}/>
                  <span style={{fontSize:10,color:C.textMuted,whiteSpace:"nowrap"}}>
                    vs {r.rivalName||"-"} · {r.date}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
