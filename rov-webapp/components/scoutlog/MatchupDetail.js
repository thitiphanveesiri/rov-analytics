"use client";
import { C } from "@/lib/theme";
import { HeroChip } from "@/components/shared/HeroChip";
import { playedMinutes, minutesToDurationStr } from "@/lib/duration";
import { useState } from "react";
import { PickBanOrderPanel } from "@/components/draft/PickBanOrderPanel";
import { ScoutCard } from "@/components/scoutlog/ScoutCard";
import { ScoutSessionCreator } from "@/components/scoutlog/ScoutSessionCreator";


// ═══════════════════════════════════════════
//  SCOUT LOG PAGE — แสดงใน Rivals detail
// ═══════════════════════════════════════════
// ── helper: คำนวณ stats ต่อ matchup ──
export function calcMatchupStats(records, teamFocus) {
  let wins=0, games=0, kFor=0, kAgainst=0;
  let totK=0,totD=0,totA=0,totDmg=0,totDtk=0,totGold=0,statCnt=0;
  let totDur=0, durCnt=0;
  // แยกตาม side (blue/red)
  const sideStats = { blue:{dmg:0,dtk:0,gold:0,cnt:0,wins:0,games:0}, red:{dmg:0,dtk:0,gold:0,cnt:0,wins:0,games:0} };
  const heroFreq={}, patternCount={}, banFreq={};
  const heroStats={};   // heroName -> {picks,wins,losses,k,d,a,statCnt}
  const playerStats={}; // playerName -> {games,wins,losses,k,d,a,statCnt,heroes:{}}

  records.forEach(sm=>{
    const isA = sm.teamA===teamFocus;
    (sm.games||[]).forEach(g=>{
      games++;
      const won = isA ? g.teamAResult==="WIN" : g.teamAResult==="LOSE";
      if (won) wins++;
      kFor     += Number(isA?g.killsA:g.killsB||0);
      kAgainst += Number(isA?g.killsB:g.killsA||0);
      if (g.duration) { totDur += playedMinutes(g); durCnt++; }

      // side ของ teamFocus
      const mySide = isA ? (g.sideA||"blue") : (g.sideA==="blue"?"red":"blue");
      sideStats[mySide].games++;
      if(won) sideStats[mySide].wins++;

      // stats per player (raw, index-based — เก็บไว้ใช้จับคู่กับ picks ด้านล่าง)
      const statsObj = isA?(g.statsA||{}):(g.statsB||{});
      Object.values(statsObj).forEach(ps=>{ if(ps?.kills!==undefined){
        const k=Number(ps.kills||0),d=Number(ps.deaths||0),a=Number(ps.assists||0);
        const dmg=Number(ps.damage||0),dtk=Number(ps.damageTaken||0),gold=Number(ps.gold||0);
        totK+=k;totD+=d;totA+=a;totDmg+=dmg;totDtk+=dtk;totGold+=gold;statCnt++;
        sideStats[mySide].dmg+=dmg;sideStats[mySide].dtk+=dtk;
        sideStats[mySide].gold+=gold;sideStats[mySide].cnt++;
      }});

      // hero freq + ban freq + hero-level & player-level breakdown
      const picks = isA?g.picksA:g.picksB;
      const bans  = isA?(g.bansA||[]):(g.bansB||[]);
      (picks||[]).forEach((slot,idx)=>{
        if (!slot?.hero?.name) return;
        const heroName = slot.hero.name;
        const playerName = (slot.player||"").trim();
        heroFreq[heroName] = (heroFreq[heroName]||0)+1;

        if (!heroStats[heroName]) heroStats[heroName] = {picks:0,wins:0,losses:0,k:0,d:0,a:0,statCnt:0};
        const hs = heroStats[heroName];
        hs.picks++; if (won) hs.wins++; else hs.losses++;

        const ps = statsObj[idx];
        if (ps?.kills!==undefined) {
          hs.k += Number(ps.kills||0); hs.d += Number(ps.deaths||0); hs.a += Number(ps.assists||0); hs.statCnt++;
        }

        if (playerName) {
          if (!playerStats[playerName]) playerStats[playerName] = {games:0,wins:0,losses:0,k:0,d:0,a:0,statCnt:0,heroes:{}};
          const pst = playerStats[playerName];
          pst.games++; if (won) pst.wins++; else pst.losses++;
          pst.heroes[heroName] = (pst.heroes[heroName]||0)+1;
          if (ps?.kills!==undefined) {
            pst.k += Number(ps.kills||0); pst.d += Number(ps.deaths||0); pst.a += Number(ps.assists||0); pst.statCnt++;
          }
        }
      });
      bans.forEach(h=>{ if(h?.name) banFreq[h.name]=(banFreq[h.name]||0)+1; });
      (g.tags||[]).forEach(t=>{ patternCount[t]=(patternCount[t]||0)+1; });
    });
  });

  // side win rate
  const blueGames=sideStats.blue.games, blueWins=sideStats.blue.wins;
  const redGames=sideStats.red.games,   redWins=sideStats.red.wins;

  return {
    wins, games, losses:games-wins,
    wr: games?Math.round(wins/games*100):0,
    kFor, kAgainst,
    avgKDA:  statCnt?((totK+totA)/Math.max(totD,1)).toFixed(2):"-",
    avgK:    statCnt?(totK/statCnt).toFixed(1):"-",
    avgD:    statCnt?(totD/statCnt).toFixed(1):"-",
    avgA:    statCnt?(totA/statCnt).toFixed(1):"-",
    avgDmg:  statCnt?Math.round(totDmg/statCnt):null,
    avgDtk:  statCnt?Math.round(totDtk/statCnt):null,
    avgGold: statCnt?Math.round(totGold/statCnt):null,
    statCnt,
    avgDuration: durCnt ? minutesToDurationStr(totDur/durCnt) : null,
    durCnt,
    // side breakdown
    blue: { games:blueGames, wins:blueWins, wr:blueGames?Math.round(blueWins/blueGames*100):null,
      avgDmg:sideStats.blue.cnt?Math.round(sideStats.blue.dmg/sideStats.blue.cnt):null,
      avgDtk:sideStats.blue.cnt?Math.round(sideStats.blue.dtk/sideStats.blue.cnt):null,
      avgGold:sideStats.blue.cnt?Math.round(sideStats.blue.gold/sideStats.blue.cnt):null },
    red:  { games:redGames,  wins:redWins,  wr:redGames ?Math.round(redWins/redGames*100):null,
      avgDmg:sideStats.red.cnt?Math.round(sideStats.red.dmg/sideStats.red.cnt):null,
      avgDtk:sideStats.red.cnt?Math.round(sideStats.red.dtk/sideStats.red.cnt):null,
      avgGold:sideStats.red.cnt?Math.round(sideStats.red.gold/sideStats.red.cnt):null },
    topHeroes:   Object.entries(heroFreq).sort((a,b)=>b[1]-a[1]).slice(0,8),
    topBans:     Object.entries(banFreq).sort((a,b)=>b[1]-a[1]).slice(0,8),
    topPatterns: Object.entries(patternCount).sort((a,b)=>b[1]-a[1]).slice(0,6),
    // ── Hero Pool แบบเต็ม พร้อม win rate / W-L / KDA ──
    heroPool: Object.entries(heroStats).map(([hero,s])=>({
      hero, picks:s.picks, wins:s.wins, losses:s.losses,
      wr: s.picks ? Math.round(s.wins/s.picks*100) : 0,
      avgK: s.statCnt ? (s.k/s.statCnt).toFixed(1) : null,
      avgD: s.statCnt ? (s.d/s.statCnt).toFixed(1) : null,
      avgA: s.statCnt ? (s.a/s.statCnt).toFixed(1) : null,
      hasStats: s.statCnt>0,
    })).sort((a,b)=>b.picks-a.picks),
    // ── สถิติส่วนตัวของแต่ละผู้เล่นที่ scout ไว้ ──
    playerPool: Object.entries(playerStats).map(([player,s])=>({
      player, games:s.games, wins:s.wins, losses:s.losses,
      wr: s.games ? Math.round(s.wins/s.games*100) : 0,
      avgK: s.statCnt ? (s.k/s.statCnt).toFixed(1) : null,
      avgD: s.statCnt ? (s.d/s.statCnt).toFixed(1) : null,
      avgA: s.statCnt ? (s.a/s.statCnt).toFixed(1) : null,
      hasStats: s.statCnt>0,
      topHeroes: Object.entries(s.heroes).sort((a,b)=>b[1]-a[1]).map(([h])=>h),
    })).sort((a,b)=>b.games-a.games),
  };
}

// ── Matchup Detail: A vs B ──
export function MatchupDetail({ rivalName, opponent, records, rivals, enemyRosters, onSaveScout, onDeleteScout, onUpdateScoutGame, onBack }) {
  const [creating, setCreating] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const st = calcMatchupStats(records, rivalName);
  const SC = { card:{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 16px"} };

  // flatten scout games into rivalName's perspective for pick/ban-order analysis
  const rivalGames = records.flatMap(sm => {
    const isA = sm.teamA === rivalName;
    return (sm.games||[]).map(g => ({
      bans:  isA ? (g.bansA||[])  : (g.bansB||[]),
      picks: isA ? (g.picksA||[]) : (g.picksB||[]),
      won:   isA ? g.teamAResult==="WIN" : g.teamAResult==="LOSE",
    }));
  });

  if (creating) return (
    <ScoutSessionCreator rivals={rivals} enemyRosters={enemyRosters}
      onSave={data=>{onSaveScout(data);setCreating(false);}}
      onCancel={()=>setCreating(false)}/>
  );

  return (
    <div>
      {/* breadcrumb header */}
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        <button onClick={onBack}
          style={{background:"transparent",border:"none",color:C.textMuted,
            cursor:"pointer",fontSize:13,padding:0,display:"flex",alignItems:"center",gap:4}}>
          ← Scout Log
        </button>
        <span style={{color:C.border}}>›</span>
        <span style={{fontWeight:800,fontSize:15,color:C.blue}}>{rivalName}</span>
        <span style={{color:C.textMuted,fontWeight:700}}>vs</span>
        <span style={{fontWeight:800,fontSize:15,color:C.red}}>{opponent}</span>
        <div style={{display:"flex",gap:3,background:C.bgBase,borderRadius:8,padding:3,
          border:`1px solid ${C.border}`,marginLeft:"auto"}}>
          {[{id:"overview",label:"📊 Overview"},{id:"log",label:"📋 Records"}].map(t=>(
            <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{
              background:activeTab===t.id?C.primary:"transparent",
              border:"none",color:activeTab===t.id?"#fff":C.textMuted,
              borderRadius:6,padding:"5px 12px",cursor:"pointer",fontWeight:700,fontSize:12}}>
              {t.label}
            </button>
          ))}
        </div>
        <button onClick={()=>setCreating(true)}
          style={{background:`linear-gradient(135deg,${C.primary},${C.primaryLight})`,
            color:"#fff",border:"none",borderRadius:9,padding:"6px 14px",
            cursor:"pointer",fontWeight:800,fontSize:12}}>
          + บันทึก Scout ใหม่
        </button>
      </div>

      {records.length===0 ? (
        <div style={{textAlign:"center",padding:"40px 20px",background:C.bgPanel,
          borderRadius:14,color:C.textMuted}}>
          <div style={{fontSize:32,marginBottom:8}}>🔍</div>
          ยังไม่มีข้อมูล {rivalName} vs {opponent}
        </div>
      ) : activeTab==="log" ? (
        records.map(sm=>(
          <ScoutCard key={sm.id} sm={sm} onDelete={id=>onDeleteScout(id)}
            onUpdateGame={(gameIdx,updates)=>onUpdateScoutGame && onUpdateScoutGame(sm.id,gameIdx,updates)}/>
        ))
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {/* summary cards */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(90px,1fr))",gap:10}}>
            {[
              {label:"🎮 เกม",        val:st.games,                              col:C.primaryLight},
              {label:"🏆 Win Rate",   val:st.games?`${st.wr}%`:"-",             col:st.wr>=50?C.win:C.lose},
              {label:"✅ W / ❌ L",   val:`${st.wins} / ${st.losses}`,          col:st.wins>=st.losses?C.win:C.lose},
              {label:"⚔️ Kill For",  val:st.kFor,                               col:C.win},
              {label:"💀 Kill Against",val:st.kAgainst,                         col:C.lose},
            ].map(c=>(
              <div key={c.label} style={{...SC.card,textAlign:"center",padding:"12px 8px"}}>
                <div style={{fontSize:9,color:C.textMuted,marginBottom:4}}>{c.label}</div>
                <div style={{fontSize:st.games>0&&c.label==="✅ W / ❌ L"?16:22,fontWeight:800,color:c.col}}>{c.val}</div>
              </div>
            ))}
          </div>

          {/* KDA */}
          {st.statCnt>0&&(
            <div style={SC.card}>
              <div style={{fontWeight:700,fontSize:12,color:C.primaryLight,marginBottom:10}}>
                📈 KDA เฉลี่ยต่อผู้เล่น ({rivalName})
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(80px,1fr))",gap:8}}>
                {[
                  {label:"Avg K",      val:st.avgK,                              col:"#00cec9"},
                  {label:"Avg D",      val:st.avgD,                              col:C.lose},
                  {label:"Avg A",      val:st.avgA,                              col:"#a29bfe"},
                  {label:"KDA",        val:st.avgKDA,                            col:"#fdcb6e"},
                  {label:"Avg Dmg",    val:st.avgDmg?st.avgDmg.toLocaleString():"-", col:"#e17055"},
                  {label:"Avg DmgTkn", val:st.avgDtk?st.avgDtk.toLocaleString():"-", col:"#fd79a8"},
                  {label:"⏱️ เวลาเฉลี่ย/เกม", val:st.avgDuration?st.avgDuration.replace(".",":"):"-", col:"#1dd1a1"},
                ].map(c=>(
                  <div key={c.label} style={{background:C.bgCard,borderRadius:8,padding:"8px 6px",textAlign:"center"}}>
                    <div style={{fontSize:9,color:C.textMuted,marginBottom:3}}>{c.label}</div>
                    <div style={{fontSize:15,fontWeight:800,color:c.col}}>{c.val}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Side Win Rate + Gold/Dmg/DmgTkn Comparison ── */}
          {(st.blue.games>0||st.red.games>0)&&(
            <div style={SC.card}>
              <div style={{fontWeight:700,fontSize:12,color:C.primaryLight,marginBottom:12}}>
                🔵🔴 สถิติแยกฝั่ง ({rivalName})
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
                {[{id:"blue",label:"🔵 Blue Side",col:C.blue},{id:"red",label:"🔴 Red Side",col:C.red}].map(s=>{
                  const sd=st[s.id];
                  return (
                    <div key={s.id} style={{background:C.bgCard,borderRadius:10,padding:"12px 14px"}}>
                      <div style={{fontWeight:800,fontSize:13,color:s.col,marginBottom:8}}>{s.label}</div>
                      {sd.games===0
                        ? <div style={{color:C.textMuted,fontSize:11}}>ไม่มีข้อมูล</div>
                        : <>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                            <span style={{fontSize:11,color:C.textMuted}}>Win Rate</span>
                            <span style={{fontWeight:800,fontSize:13,color:sd.wr>=50?C.win:C.lose}}>
                              {sd.wr}% ({sd.wins}/{sd.games})
                            </span>
                          </div>
                          {sd.avgDmg&&<div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                            <span style={{fontSize:11,color:C.textMuted}}>Avg Dmg</span>
                            <span style={{fontWeight:700,fontSize:12,color:"#e17055"}}>{sd.avgDmg?.toLocaleString()}</span>
                          </div>}
                          {sd.avgDtk&&<div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                            <span style={{fontSize:11,color:C.textMuted}}>Avg DmgTkn</span>
                            <span style={{fontWeight:700,fontSize:12,color:C.lose}}>{sd.avgDtk?.toLocaleString()}</span>
                          </div>}
                          {sd.avgGold&&<div style={{display:"flex",justifyContent:"space-between"}}>
                            <span style={{fontSize:11,color:C.textMuted}}>Avg Gold</span>
                            <span style={{fontWeight:700,fontSize:12,color:"#f9ca24"}}>{sd.avgGold?.toLocaleString()}</span>
                          </div>}
                        </>
                      }
                    </div>
                  );
                })}
              </div>
              {/* โดยรวม Gold/Dmg/DmgTkn */}
              {st.statCnt>0&&(
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:8}}>
                  {[{label:"Avg Gold",val:st.avgGold,col:"#f9ca24"},
                    {label:"Avg Dmg",val:st.avgDmg,col:"#e17055"},
                    {label:"Avg DmgTkn",val:st.avgDtk,col:C.lose}].map(c=>(
                    <div key={c.label} style={{background:C.bgCard,borderRadius:8,padding:"8px",textAlign:"center"}}>
                      <div style={{fontSize:9,color:C.textMuted,marginBottom:2}}>{c.label}</div>
                      <div style={{fontSize:14,fontWeight:800,color:c.col}}>
                        {c.val?c.val.toLocaleString():"-"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Top Bans ── */}
          {st.topBans.length>0&&(
            <div style={SC.card}>
              <div style={{fontWeight:700,fontSize:12,color:"#e17055",marginBottom:10}}>
                🚫 Hero ที่แบนบ่อย ({rivalName})
              </div>
              {st.topBans.map(([h,cnt],i)=>(
                <div key={h} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                  padding:"5px 8px",background:i%2===0?"transparent":C.bgCard,borderRadius:6,marginBottom:2}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:10,color:C.textMuted,width:16}}>#{i+1}</span>
                    <HeroChip name={h} size={26} accentCol={"#e17055"} fontSize={12}/>
                  </div>
                  <span style={{background:"#e17055"+"20",color:"#e17055",fontSize:10,
                    padding:"1px 8px",borderRadius:99,fontWeight:700}}>×{cnt}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── Pick/Ban ตามลำดับ ── */}
          <PickBanOrderPanel
            games={rivalGames}
            getBans={g=>g.bans}
            getPicks={g=>g.picks}
            getWon={g=>g.won}
            title={`🎯 Pick / Ban ตามลำดับ ของ ${rivalName}`}
          />

          {/* Hero Pool แบบเต็ม พร้อม win rate / W-L / KDA */}
          {st.heroPool.length>0 && (
            <div style={{...SC.card, marginBottom:12}}>
              <div style={{fontWeight:700,fontSize:12,color:C.lose,marginBottom:10}}>
                🦸 Hero Pool ของ {rivalName} ({st.heroPool.length} ตัว)
              </div>
              <div style={{overflowX:"auto"}} className="h-scroll">
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:420}}>
                  <thead>
                    <tr style={{color:C.textMuted,fontSize:10,textAlign:"left"}}>
                      <th style={{padding:"4px 8px",fontWeight:600}}>Hero</th>
                      <th style={{padding:"4px 8px",fontWeight:600,textAlign:"center"}}>เกม</th>
                      <th style={{padding:"4px 8px",fontWeight:600,textAlign:"center"}}>W-L</th>
                      <th style={{padding:"4px 8px",fontWeight:600,textAlign:"center"}}>Win%</th>
                      <th style={{padding:"4px 8px",fontWeight:600,textAlign:"center"}}>K/D/A</th>
                    </tr>
                  </thead>
                  <tbody>
                    {st.heroPool.map((h,i)=>(
                      <tr key={h.hero} style={{background:i%2===0?"transparent":C.bgCard}}>
                        <td style={{padding:"6px 8px"}}><HeroChip name={h.hero} size={24} accentCol={C.lose} fontSize={12}/></td>
                        <td style={{padding:"6px 8px",textAlign:"center",color:C.textMuted}}>{h.picks}</td>
                        <td style={{padding:"6px 8px",textAlign:"center"}}>
                          <span style={{color:C.win,fontWeight:700}}>{h.wins}</span>
                          <span style={{color:C.textMuted}}> - </span>
                          <span style={{color:C.lose,fontWeight:700}}>{h.losses}</span>
                        </td>
                        <td style={{padding:"6px 8px",textAlign:"center"}}>
                          <span style={{fontWeight:700,padding:"1px 8px",borderRadius:5,
                            background:h.wr>=50?C.lose+"20":C.win+"20",color:h.wr>=50?C.lose:C.win}}>
                            {h.wr}%
                          </span>
                        </td>
                        <td style={{padding:"6px 8px",textAlign:"center",color:C.textMuted}}>
                          {h.hasStats ? `${h.avgK}/${h.avgD}/${h.avgA}` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* สถิติส่วนตัวของผู้เล่นแต่ละคนที่ scout ไว้ */}
          {st.playerPool.length>0 && (
            <div style={{...SC.card, marginBottom:12}}>
              <div style={{fontWeight:700,fontSize:12,color:C.lose,marginBottom:10}}>
                👤 สถิติผู้เล่นของ {rivalName} ({st.playerPool.length} คน)
              </div>
              <div style={{overflowX:"auto"}} className="h-scroll">
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:480}}>
                  <thead>
                    <tr style={{color:C.textMuted,fontSize:10,textAlign:"left"}}>
                      <th style={{padding:"4px 8px",fontWeight:600}}>ผู้เล่น</th>
                      <th style={{padding:"4px 8px",fontWeight:600,textAlign:"center"}}>เกม</th>
                      <th style={{padding:"4px 8px",fontWeight:600,textAlign:"center"}}>W-L</th>
                      <th style={{padding:"4px 8px",fontWeight:600,textAlign:"center"}}>Win%</th>
                      <th style={{padding:"4px 8px",fontWeight:600,textAlign:"center"}}>K/D/A</th>
                      <th style={{padding:"4px 8px",fontWeight:600}}>Hero ที่เล่นบ่อย</th>
                    </tr>
                  </thead>
                  <tbody>
                    {st.playerPool.map((p,i)=>(
                      <tr key={p.player} style={{background:i%2===0?"transparent":C.bgCard}}>
                        <td style={{padding:"6px 8px",fontWeight:700}}>{p.player}</td>
                        <td style={{padding:"6px 8px",textAlign:"center",color:C.textMuted}}>{p.games}</td>
                        <td style={{padding:"6px 8px",textAlign:"center"}}>
                          <span style={{color:C.win,fontWeight:700}}>{p.wins}</span>
                          <span style={{color:C.textMuted}}> - </span>
                          <span style={{color:C.lose,fontWeight:700}}>{p.losses}</span>
                        </td>
                        <td style={{padding:"6px 8px",textAlign:"center"}}>
                          <span style={{fontWeight:700,padding:"1px 8px",borderRadius:5,
                            background:p.wr>=50?C.lose+"20":C.win+"20",color:p.wr>=50?C.lose:C.win}}>
                            {p.wr}%
                          </span>
                        </td>
                        <td style={{padding:"6px 8px",textAlign:"center",color:C.textMuted}}>
                          {p.hasStats ? `${p.avgK}/${p.avgD}/${p.avgA}` : "—"}
                        </td>
                        <td style={{padding:"6px 8px"}}>
                          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                            {p.topHeroes.slice(0,4).map(h=><HeroChip key={h} name={h} size={20} fontSize={10}/>)}
                            {p.topHeroes.length>4 && <span style={{fontSize:10,color:C.textMuted}}>+{p.topHeroes.length-4}</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pattern ที่เจอ */}
          <div style={{display:"grid",gridTemplateColumns:"1fr",gap:12}}>
            {st.topPatterns.length>0&&(
              <div style={SC.card}>
                <div style={{fontWeight:700,fontSize:12,color:C.primaryLight,marginBottom:10}}>
                  🏷️ Pattern ที่เจอ
                </div>
                {st.topPatterns.map(([t,cnt],i)=>(
                  <div key={t} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                    padding:"5px 8px",background:i%2===0?"transparent":C.bgCard,borderRadius:6,marginBottom:2}}>
                    <span style={{fontWeight:700,fontSize:12,color:C.primaryLight}}>{t}</span>
                    <span style={{background:C.primary+"25",color:C.primaryLight,fontSize:10,
                      padding:"1px 8px",borderRadius:99,fontWeight:700}}>×{cnt}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
