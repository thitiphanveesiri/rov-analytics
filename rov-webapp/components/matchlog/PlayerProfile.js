"use client";
import { matchTime } from "@/lib/matchTime";
import { C } from "@/lib/theme";
import { HeroChip } from "@/components/shared/HeroChip";
import { LogoImg } from "@/components/shared/TeamLogo";
import { PlayerAvatar } from "@/components/shared/PlayerMedia";
import { playedMinutes } from "@/lib/duration";
import { useMemo, useState } from "react";


// ═══════════════════════════════════════════
//  PLAYER PROFILE — ✅ อ่าน stats จาก gameStats ใหม่
// ═══════════════════════════════════════════
export function PlayerProfile({ player, isEnemy, allGames, onBack, photoUrl, teamBreakdown, ourTeamName, rivalLogos, ourTeamLogo,
  rawMatches, membershipHistory }) {
  const SC = { card:{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 18px"} };

  // ── เลือกดูข้อมูลเฉพาะช่วงที่สังกัดทีมใดทีมหนึ่ง (โผล่เฉพาะผู้เล่นที่มีประวัติย้ายทีมจริง) ──
  // ค่าเริ่มต้น "all" = พฤติกรรมเดิมทุกประการ (ใช้ allGames ตามที่หน้าเรียกส่งมา ซึ่งรวมข้อมูล Scout ด้วยถ้าเป็น
  // ผู้เล่นฝั่งศัตรู) เลือกช่วงใดช่วงหนึ่ง = คำนวณใหม่จาก rawMatches (แมตช์จริงทั้งหมด ไม่ผูกกับ patch ที่เลือกไว้
  // บนสุดของแอป) กรองเฉพาะเกมในกรอบเวลาของช่วงนั้น — ไม่รวมข้อมูล Scout (เหตุผลเดียวกับ computePlayerTeamBreakdown)
  const [selectedPeriodIdx, setSelectedPeriodIdx] = useState("all");
  const periods = Array.isArray(membershipHistory) ? [...membershipHistory].sort((a,b)=>a.from-b.from) : [];
  const selectedPeriod = selectedPeriodIdx === "all" ? null : periods[selectedPeriodIdx];

  const scopedGames = useMemo(() => {
    if (!selectedPeriod) return allGames;
    const to = (selectedPeriod.to === null || selectedPeriod.to === undefined) ? Infinity : selectedPeriod.to;
    const out = [];
    (rawMatches || []).forEach(m => {
      if (selectedPeriod.team !== "our" && m.rivalName !== selectedPeriod.team) return;
      const gs = Array.isArray(m.games) && m.games.length > 0
        ? m.games.map((g,gi)=>({ ...g, rivalName:m.rivalName, date:m.date, _matchId:m.id, _playedAt:matchTime(m), _gameIdx:gi }))
        : [{ ...m, _matchId:m.id, _playedAt:matchTime(m), _gameIdx:null }];
      gs.forEach(g => { if (g._playedAt >= selectedPeriod.from && g._playedAt < to) out.push(g); });
    });
    return out;
  }, [selectedPeriod, rawMatches, allGames]);

  // ฝั่งที่ต้องอ่าน (ourPicks/enemyPicks) ตามทีมของ "ช่วงที่เลือกดู" ไม่ใช่ตาม isEnemy เดิมที่ผูกกับแท็บที่
  // เปิดโปรไฟล์มา — จำเป็นเพราะถ้าเปิดจากแท็บคู่แข่งแต่เลือกดูช่วง "ทีมเรา" ต้องอ่าน ourPicks ไม่ใช่ enemyPicks
  const effectiveIsEnemy = selectedPeriod ? selectedPeriod.team !== "our" : isEnemy;
  const accentCol = effectiveIsEnemy ? C.lose : C.win;

  const picksKey  = effectiveIsEnemy ? "enemyPicks"      : "ourPicks";
  const sideKey   = effectiveIsEnemy ? "enemy"            : "our";
  const resultWin = effectiveIsEnemy ? "LOSE"             : "WIN";

  // หา index ของผู้เล่นในแต่ละเกม เพื่อ map กับ gameStats[sideKey][idx]
  const pGames = scopedGames.filter(g => (g[picksKey]||[]).some(s=>s.player===player));
  const pWins  = pGames.filter(g=>g.result===resultWin).length;
  const pWR    = pGames.length ? Math.round(pWins/pGames.length*100) : 0;

  // รวม stats ต่อ hero
  const heroSt = {};
  let totK=0,totD=0,totA=0,totDmg=0,totDtk=0,totGold=0,totDur=0,statG=0;

  pGames.forEach(g=>{
    const picks = g[picksKey] || [];
    const slotIdx = picks.findIndex(s=>s.player===player);
    if (slotIdx < 0) return;
    const slot = picks[slotIdx];
    if (!slot?.hero) return;
    const hName = slot.hero.name;
    if (!heroSt[hName]) heroSt[hName] = {picks:0,wins:0,k:0,d:0,a:0,dmg:0,dtk:0,gold:0,dur:0,cnt:0};
    heroSt[hName].picks++;
    if (g.result===resultWin) heroSt[hName].wins++;

    const gs = g.gameStats?.[sideKey]?.[slotIdx];
    if (gs && gs.kills !== undefined) {
      heroSt[hName].k   += Number(gs.kills||0);
      heroSt[hName].d   += Number(gs.deaths||0);
      heroSt[hName].a   += Number(gs.assists||0);
      heroSt[hName].dmg += Number(gs.damage||0);
      heroSt[hName].dtk += Number(gs.damageTaken||0);
      heroSt[hName].gold+= Number(gs.gold||0);
      heroSt[hName].dur += playedMinutes(g);
      heroSt[hName].cnt++;
      totK+=Number(gs.kills||0);totD+=Number(gs.deaths||0);totA+=Number(gs.assists||0);
      totDmg+=Number(gs.damage||0);totDtk+=Number(gs.damageTaken||0);
      totGold+=Number(gs.gold||0);
      totDur+=playedMinutes(g);statG++;
    }
  });

  const heroArr = Object.entries(heroSt).map(([h,s])=>({
    hero:h, picks:s.picks,
    wr:Math.round(s.wins/s.picks*100),
    kda: s.cnt ? ((s.k+s.a)/Math.max(s.d,1)).toFixed(2) : "-",
    avgK:  s.cnt ? (s.k/s.cnt).toFixed(1) : "-",
    avgD:  s.cnt ? (s.d/s.cnt).toFixed(1) : "-",
    avgA:  s.cnt ? (s.a/s.cnt).toFixed(1) : "-",
    avgDmg:s.cnt ? Math.round(s.dmg/s.cnt) : null,
    avgDtk:s.cnt ? Math.round(s.dtk/s.cnt) : null,
    goldPerMin: s.cnt&&s.dur ? Math.round(s.gold/s.dur) : null,
  })).sort((a,b)=>b.picks-a.picks);

  const avgKDAval  = statG ? ((totK+totA)/Math.max(totD,1)).toFixed(2) : "-";
  const avgDmg     = statG ? Math.round(totDmg/statG) : null;
  const avgDtk     = statG ? Math.round(totDtk/statG) : null;
  const goldPerMin = statG&&totDur ? Math.round(totGold/totDur) : null;
  const avgK = statG ? (totK/statG).toFixed(1) : "-";
  const avgD = statG ? (totD/statG).toFixed(1) : "-";
  const avgA = statG ? (totA/statG).toFixed(1) : "-";

  // allGames/pGames เรียงจากใหม่ไปเก่า (แมตช์ใหม่ถูก prepend เข้า array) —
  // ต้องเอา 10 ตัวแรก (ใหม่สุด) แล้ว reverse ให้กราฟไล่จากซ้าย(เก่า)ไปขวา(ใหม่)
  const chartGames = pGames.slice(0, 10).reverse();
  const chartData  = chartGames.map((g,i)=>{
    const picks = g[picksKey] || [];
    const slotIdx = picks.findIndex(s=>s.player===player);
    const slot = picks[slotIdx];
    const gs = g.gameStats?.[sideKey]?.[slotIdx];
    return {
      idx:i+1, win:g.result===resultWin,
      hero:slot?.hero?.name||"?",
      kda: gs?.kills!==undefined
        ? ((Number(gs.kills)+Number(gs.assists||0))/Math.max(Number(gs.deaths)||1,1)).toFixed(1)
        : null,
    };
  });

  return (
    <div>
      <button onClick={onBack} style={{background:"transparent",border:"none",
        color:C.textMuted,cursor:"pointer",fontSize:14,marginBottom:18,padding:0}}>
        ← กลับ Roster
      </button>
      <div style={{display:"flex",alignItems:"center",gap:18,marginBottom:20}}>
        <PlayerAvatar name={player} photoUrl={photoUrl} size={64} team={effectiveIsEnemy?"enemy":"our"}
          style={{borderRadius:16,fontSize:26}}/>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <h2 style={{margin:0,fontSize:26,fontWeight:900}}>{player}</h2>
            <span style={{fontSize:11,padding:"2px 10px",borderRadius:99,fontWeight:700,
              background:effectiveIsEnemy?C.lose+"20":C.win+"20",color:effectiveIsEnemy?C.lose:C.win,
              border:`1px solid ${effectiveIsEnemy?C.lose+"50":C.win+"50"}`}}>
              {effectiveIsEnemy?"⚔️ คู่แข่ง":"🛡️ ทีมเรา"}
            </span>
          </div>
          <div style={{fontSize:12,color:C.textMuted,marginTop:3}}>
            {pGames.length} เกมที่บันทึก
            {selectedPeriod && <span> · กำลังดูเฉพาะช่วงนี้</span>}
          </div>
        </div>
      </div>

      {/* ── ประวัติการย้ายทีม: เลือกดูข้อมูลเฉพาะช่วงที่สังกัดทีมใดทีมหนึ่งได้ (โผล่เฉพาะผู้เล่นที่เคยย้ายทีมจริง) ──
          กดการ์ดช่วงไหนก็ได้ = ตัวเลขทั้งหน้า (การ์ดสรุปด้านล่าง, Hero Pool, เกมล่าสุด, กราฟ) จะคำนวณใหม่ตาม
          เฉพาะช่วงนั้นทันที — ไม่ผูกกับตัวเลือก patch บนสุดของแอป เพราะเป็นภาพรวมข้ามทุก patch โดยนิยามของมันเอง
          ("ทั้งหมด" เท่านั้นที่ยังอิง patch ที่เลือกไว้ตามเดิม เพราะมาจาก allGames ที่ patch-filtered มาจากหน้าหลัก) */}
      {Array.isArray(teamBreakdown) && teamBreakdown.length>1 && (
        <div style={{...SC.card,marginBottom:16}}>
          <div style={{fontWeight:800,fontSize:13,color:C.primaryLight,marginBottom:4}}>🔀 ประวัติการย้ายทีม — กดเพื่อดูเฉพาะช่วง</div>
          <div style={{fontSize:10,color:C.textMuted,marginBottom:10}}>
            เลือกช่วงที่สังกัดทีมใดทีมหนึ่งเพื่อดูสถิติเฉพาะช่วงนั้น (นับจากแมตช์จริงที่บันทึก ไม่รวมข้อมูล Scout) — หรือเลือก "ทั้งหมด" เพื่อดูภาพรวมทุกช่วงรวมกัน
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <button onClick={()=>setSelectedPeriodIdx("all")}
              style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",borderRadius:10,
                background: selectedPeriodIdx==="all" ? C.primary+"20" : C.bgBase,
                // ใช้ border แยกทีละด้านแทน shorthand "border" + "borderLeft" ผสมกัน — React เตือนว่าผสม
                // shorthand/longhand แบบนี้แล้ว re-render ตอนค่าเปลี่ยน (ตอนกดเลือก/ไม่เลือก) อาจ sync กับ DOM
                // ไม่ตรงกัน เขียนแยกทุกด้านชัดเจนตัดปัญหานี้ทิ้งไปเลย
                borderTop:`1px solid ${selectedPeriodIdx==="all" ? C.primary : C.border}`,
                borderRight:`1px solid ${selectedPeriodIdx==="all" ? C.primary : C.border}`,
                borderBottom:`1px solid ${selectedPeriodIdx==="all" ? C.primary : C.border}`,
                borderLeft:`4px solid ${C.primary}`,cursor:"pointer",textAlign:"left",
                font:"inherit",color:"inherit",width:"100%"}}>
              <div style={{fontWeight:800,fontSize:13,color:C.primaryLight}}>📊 ทั้งหมด (ทุกช่วงรวมกัน)</div>
            </button>
            {teamBreakdown.map((b,i)=>{
              const isOur = b.team==="our";
              const label = isOur ? (ourTeamName||"ทีมเรา") : b.team;
              const col = isOur ? C.win : C.lose;
              const selected = selectedPeriodIdx===i;
              const fmt = ts => new Date(ts).toLocaleDateString("th-TH",{day:"numeric",month:"short",year:"numeric"});
              const range = `${b.from===0 ? "ตั้งแต่เริ่มต้น" : fmt(b.from)} → ${b.to===null ? "ปัจจุบัน" : fmt(b.to)}`;
              return (
                <button key={`${b.team}-${b.from}-${i}`} onClick={()=>setSelectedPeriodIdx(i)}
                  style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",
                    padding:"10px 12px",borderRadius:10,background:selected?col+"18":C.bgBase,
                    borderTop:`1px solid ${selected?col:(b.to===null?col+"60":C.border)}`,
                    borderRight:`1px solid ${selected?col:(b.to===null?col+"60":C.border)}`,
                    borderBottom:`1px solid ${selected?col:(b.to===null?col+"60":C.border)}`,
                    borderLeft:`4px solid ${col}`,
                    cursor:"pointer",textAlign:"left",font:"inherit",color:"inherit",width:"100%"}}>
                  <LogoImg url={isOur?ourTeamLogo:rivalLogos?.[b.team]} name={label} size={30}/>
                  <div style={{flex:1,minWidth:140}}>
                    <div style={{fontWeight:800,fontSize:13,color:col}}>
                      {isOur?"🛡️":"⚔️"} {label}
                      {b.to===null && <span style={{marginLeft:8,fontSize:9,fontWeight:800,padding:"1px 8px",borderRadius:99,background:col+"25"}}>ปัจจุบัน</span>}
                    </div>
                    <div style={{fontSize:10,color:C.textMuted,marginTop:2}}>{range}</div>
                  </div>
                  {b.games===0 ? (
                    <div style={{fontSize:11,color:C.textMuted}}>ยังไม่มีเกมที่บันทึกในช่วงนี้</div>
                  ) : (
                    <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
                      <div style={{textAlign:"center"}}>
                        <div style={{fontSize:15,fontWeight:800}}>{b.games}</div>
                        <div style={{fontSize:9,color:C.textMuted}}>GAMES</div>
                      </div>
                      <div style={{textAlign:"center"}}>
                        <div style={{fontSize:15,fontWeight:800,color:b.winRate>=50?C.win:C.lose}}>{b.wins}-{b.losses}</div>
                        <div style={{fontSize:9,color:C.textMuted}}>W-L</div>
                      </div>
                      <div style={{textAlign:"center"}}>
                        <div style={{fontSize:15,fontWeight:800,color:b.winRate>=50?C.win:C.lose}}>{b.winRate}%</div>
                        <div style={{fontSize:9,color:C.textMuted}}>WIN RATE</div>
                      </div>
                      {b.topHeroes.length>0 && (
                        <div style={{display:"flex",gap:6}}>
                          {b.topHeroes.map(([h,n])=>(
                            <div key={h} title={`${h} · ${n} เกม`}><HeroChip name={h} size={22} fontSize={10}/></div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))",gap:12,marginBottom:16}}>
        {[
          {icon:"🎮",label:"Games",    val:pGames.length,       col:C.primaryLight},
          {icon:"🏆",label:"Win Rate", val:`${pWR}%`,           col:pWR>=50?accentCol:C.lose},
          {icon:"✅",label:"Wins",     val:pWins,               col:accentCol},
          {icon:"❌",label:"Losses",   val:pGames.length-pWins, col:C.lose},
        ].map(c=>(
          <div key={c.label} style={{...SC.card,textAlign:"center"}}>
            <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>{c.icon} {c.label}</div>
            <div style={{fontSize:22,fontWeight:800,color:c.col}}>{c.val}</div>
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(70px,1fr))",gap:10,marginBottom:16}}>
        {[
          {label:"Avg K",      val:avgK,                                col:"#00cec9"},
          {label:"Avg D",      val:avgD,                                col:C.lose},
          {label:"Avg A",      val:avgA,                                col:"#a29bfe"},
          {label:"KDA",        val:avgKDAval,                           col:"#fdcb6e"},
          {label:"Avg Dmg",    val:avgDmg?avgDmg.toLocaleString():"-",  col:"#e17055"},
          {label:"Avg DmgTkn", val:avgDtk?avgDtk.toLocaleString():"-",  col:"#fd79a8"},
          {label:"Gold/Min",   val:goldPerMin?goldPerMin.toLocaleString():"-", col:"#feca57"},
        ].map(c=>(
          <div key={c.label} style={{...SC.card,textAlign:"center",padding:"10px 8px"}}>
            <div style={{fontSize:9,color:C.textMuted,marginBottom:3}}>{c.label}</div>
            <div style={{fontSize:16,fontWeight:800,color:statG>0?c.col:C.textMuted+"60"}}>{c.val}</div>
          </div>
        ))}
      </div>

      {statG===0 && pGames.length>0 && (
        <div style={{padding:"10px 14px",background:C.bgCard,borderRadius:8,marginBottom:16,
          fontSize:12,color:C.textMuted,borderLeft:`3px solid ${C.primary}`}}>
          💡 กรอก KDA/Damage/Gold ได้จากปุ่ม "📊 Stats ทั้งทีม" ใน Match Log
        </div>
      )}

      {pGames.length>0&&(
        <div style={{...SC.card,marginBottom:16}}>
          <div style={{fontSize:11,color:C.textMuted,fontWeight:700,marginBottom:8}}>
            Win/Loss ({pWins}W — {pGames.length-pWins}L)
          </div>
          <div style={{display:"flex",height:14,borderRadius:99,overflow:"hidden",gap:1}}>
            {pWins>0&&<div style={{flex:pWins,background:`linear-gradient(90deg,${accentCol},#00b894)`,
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#fff",fontWeight:700}}>
              {pWR}%
            </div>}
            {pGames.length-pWins>0&&<div style={{flex:pGames.length-pWins,background:C.lose,
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#fff",fontWeight:700}}>
              {100-pWR}%
            </div>}
          </div>
        </div>
      )}

      <div style={{...SC.card,marginBottom:16}}>
        <div style={{fontWeight:700,fontSize:13,marginBottom:12}}>📈 ผล 10 เกมล่าสุด</div>
        {chartData.length===0
          ?<div style={{color:C.textMuted,textAlign:"center",padding:"20px 0",fontSize:12}}>ยังไม่มีข้อมูล</div>
          :<div style={{display:"flex",gap:4,alignItems:"flex-end",height:100}}>
            {chartData.map((d,i)=>(
              <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                {d.kda&&<div style={{fontSize:8,color:"#fdcb6e",fontWeight:700,marginBottom:1}}>{d.kda}</div>}
                <div style={{width:"100%",flex:1,borderRadius:"6px 6px 0 0",minHeight:40,
                  background:d.win
                    ?`linear-gradient(180deg,${accentCol},#00b894)`
                    :`linear-gradient(180deg,${C.lose},#e84393)`,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:11,fontWeight:900,color:"#fff"}}>
                  {d.win?"W":"L"}
                </div>
                <div style={{fontSize:8,color:C.textMuted,textAlign:"center",
                  overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",width:"100%"}}>
                  {d.hero}
                </div>
              </div>
            ))}
          </div>
        }
      </div>

      <div style={{...SC.card}}>
        <div style={{fontWeight:700,fontSize:13,color:C.primaryLight,marginBottom:14}}>🦸 Hero Stats</div>
        {heroArr.length===0
          ?<div style={{color:C.textMuted,textAlign:"center",padding:"20px 0",fontSize:12}}>ยังไม่มีข้อมูล</div>
          :<div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:600}}>
              <thead>
                <tr style={{borderBottom:`2px solid ${C.border}`,color:C.textMuted,fontSize:10}}>
                  {["Hero","Picks","Win%","K","D","A","KDA","Avg Dmg","Avg DmgTkn","Gold/Min"].map(h=>(
                    <th key={h} style={{padding:"8px 8px",textAlign:h==="Hero"?"left":"center",fontWeight:700,whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heroArr.map((s,i)=>(
                  <tr key={s.hero} style={{borderBottom:`1px solid ${C.border}`,background:i%2===0?"transparent":C.bgCard}}>
                    <td style={{padding:"8px 8px",whiteSpace:"nowrap"}}><HeroChip name={s.hero} size={26}/></td>
                    <td style={{padding:"8px 8px",textAlign:"center",color:C.primaryLight,fontWeight:700}}>{s.picks}</td>
                    <td style={{padding:"8px 8px",textAlign:"center"}}>
                      <span style={{display:"inline-block",padding:"2px 8px",borderRadius:6,fontWeight:700,fontSize:11,
                        background:s.wr>=50?accentCol+"20":C.lose+"20",color:s.wr>=50?accentCol:C.lose}}>{s.wr}%</span>
                    </td>
                    <td style={{padding:"8px 8px",textAlign:"center",color:"#00cec9",fontWeight:700}}>{s.avgK}</td>
                    <td style={{padding:"8px 8px",textAlign:"center",color:C.lose,fontWeight:700}}>{s.avgD}</td>
                    <td style={{padding:"8px 8px",textAlign:"center",color:"#a29bfe",fontWeight:700}}>{s.avgA}</td>
                    <td style={{padding:"8px 8px",textAlign:"center",color:"#fdcb6e",fontWeight:700}}>{s.kda}</td>
                    <td style={{padding:"8px 8px",textAlign:"center",color:C.textMuted,fontSize:12}}>
                      {s.avgDmg?s.avgDmg.toLocaleString():"-"}
                    </td>
                    <td style={{padding:"8px 8px",textAlign:"center",color:"#fd79a8",fontSize:12}}>
                      {s.avgDtk?s.avgDtk.toLocaleString():"-"}
                    </td>
                    <td style={{padding:"8px 8px",textAlign:"center",color:"#feca57",fontSize:12}}>
                      {s.goldPerMin?s.goldPerMin.toLocaleString():"-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>
  );
}
