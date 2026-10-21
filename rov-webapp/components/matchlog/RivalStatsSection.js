"use client";
import { C } from "@/lib/theme";
import { HeroChip } from "@/components/shared/HeroChip";
import { playedMinutes } from "@/lib/duration";
import { PickBanOrderPanel } from "@/components/draft/PickBanOrderPanel";


export function RivalStatsSection({ selRival, rGames, enemyRosters }) {
  const SC = { card:{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px 18px"} };
  const enemyRoster = enemyRosters[selRival] || [];

  // ── คำนวณ stats ผู้เล่นคู่แข่ง ──
  const playerStats = {};
  rGames.forEach(g => {
    (g.enemyPicks||[]).forEach((slot, idx) => {
      const name = slot.player;
      if (!name) return;
      if (!playerStats[name]) playerStats[name] = {games:0,wins:0,k:0,d:0,a:0,dmg:0,dtk:0,gold:0,dur:0,cnt:0,heroes:{}};
      const ps = playerStats[name];
      ps.games++;
      if (g.result === "LOSE") ps.wins++;
      if (slot.hero?.name) ps.heroes[slot.hero.name] = (ps.heroes[slot.hero.name]||0)+1;
      const gs = g.gameStats?.enemy?.[idx];
      if (gs?.kills !== undefined) {
        ps.k   += Number(gs.kills||0);
        ps.d   += Number(gs.deaths||0);
        ps.a   += Number(gs.assists||0);
        ps.dmg += Number(gs.damage||0);
        ps.dtk += Number(gs.damageTaken||0);
        ps.gold+= Number(gs.gold||0);
        ps.dur += playedMinutes(g);
        ps.cnt++;
      }
    });
  });

  // ── คำนวณ KDA ต่อ Hero คู่แข่ง ──
  const heroKDA = {};
  rGames.forEach(g => {
    (g.enemyPicks||[]).forEach((slot, idx) => {
      const h = slot.hero?.name;
      if (!h) return;
      if (!heroKDA[h]) heroKDA[h] = {picks:0,wins:0,k:0,d:0,a:0,dmg:0,dtk:0,gold:0,dur:0,cnt:0};
      const hd = heroKDA[h];
      hd.picks++;
      if (g.result==="LOSE") hd.wins++;
      const gs = g.gameStats?.enemy?.[idx];
      if (gs?.kills !== undefined) {
        hd.k   += Number(gs.kills||0);
        hd.d   += Number(gs.deaths||0);
        hd.a   += Number(gs.assists||0);
        hd.dmg += Number(gs.damage||0);
        hd.dtk += Number(gs.damageTaken||0);
        hd.gold+= Number(gs.gold||0);
        hd.dur += playedMinutes(g);
        hd.cnt++;
      }
    });
  });
  const heroArr = Object.entries(heroKDA)
    .map(([h,s]) => ({
      hero:h, picks:s.picks,
      wr: Math.round(s.wins/s.picks*100),
      kda: s.cnt ? ((s.k+s.a)/Math.max(s.d,1)).toFixed(2) : "-",
      avgK:  s.cnt?(s.k/s.cnt).toFixed(1):"-",
      avgD:  s.cnt?(s.d/s.cnt).toFixed(1):"-",
      avgA:  s.cnt?(s.a/s.cnt).toFixed(1):"-",
      avgDmg:s.cnt?Math.round(s.dmg/s.cnt):null,
      avgDtk:s.cnt?Math.round(s.dtk/s.cnt):null,
      gpm:   s.cnt&&s.dur?Math.round(s.gold/s.dur):null,
    }))
    .sort((a,b)=>b.picks-a.picks);

  const playerArr = Object.entries(playerStats)
    .map(([name,ps]) => ({
      name,
      games:ps.games, wins:ps.wins,
      wr: ps.games?Math.round(ps.wins/ps.games*100):0,
      kda: ps.cnt ? ((ps.k+ps.a)/Math.max(ps.d,1)).toFixed(2):"-",
      avgK:  ps.cnt?(ps.k/ps.cnt).toFixed(1):"-",
      avgD:  ps.cnt?(ps.d/ps.cnt).toFixed(1):"-",
      avgA:  ps.cnt?(ps.a/ps.cnt).toFixed(1):"-",
      avgDmg:ps.cnt?Math.round(ps.dmg/ps.cnt):null,
      avgDtk:ps.cnt?Math.round(ps.dtk/ps.cnt):null,
      gpm:   ps.cnt&&ps.dur?Math.round(ps.gold/ps.dur):null,
      mainHero: Object.entries(ps.heroes).sort((a,b)=>b[1]-a[1])[0]?.[0]||"-",
      hasStats: ps.cnt>0,
    }))
    .sort((a,b)=>b.games-a.games);

  // ── กราฟเปรียบเทียบ ──
  // avg per game across all games that have stats
  function avgStat(side, field) {
    let total=0, cnt=0;
    rGames.forEach(g => {
      const picks = side==="our" ? (g.ourPicks||[]) : (g.enemyPicks||[]);
      picks.forEach((slot,idx)=>{
        const gs = g.gameStats?.[side]?.[idx];
        if (gs?.[field] !== undefined) { total+=Number(gs[field]||0); cnt++; }
      });
    });
    return cnt ? Math.round(total/cnt) : 0;
  }
  // ทอง "ต่อนาที" จริง = ทองรวม ÷ เวลาเล่นจริงรวม (หัก pause) — เดิมป้าย Gold/min แสดงทองเฉลี่ยต่อเกม
  function avgGpm(side) {
    let gold=0, mins=0;
    rGames.forEach(g => {
      const picks = side==="our" ? (g.ourPicks||[]) : (g.enemyPicks||[]);
      const played = playedMinutes(g);
      if (!played) return;
      picks.forEach((slot,idx)=>{
        const gs = g.gameStats?.[side]?.[idx];
        if (gs?.gold !== undefined) { gold+=Number(gs.gold||0); mins+=played; }
      });
    });
    return mins ? Math.round(gold/mins) : 0;
  }

  const compareData = [
    { label:"Avg Damage",    our: avgStat("our","damage"),      enemy: avgStat("enemy","damage"),      col:"#e17055" },
    { label:"Avg Dmg Taken", our: avgStat("our","damageTaken"), enemy: avgStat("enemy","damageTaken"), col:"#fd79a8" },
    { label:"Gold/min",      our: avgGpm("our"),               enemy: avgGpm("enemy"),        col:"#feca57" },
  ];
  const hasCompareData = compareData.some(d=>d.our>0||d.enemy>0);

  function Bar({val, maxVal, col, label}) {
    const pct = maxVal>0 ? Math.round(val/maxVal*100) : 0;
    return (
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
        <div style={{fontSize:9,color:C.textMuted,width:20,textAlign:"right"}}>{label}</div>
        <div style={{flex:1,height:14,background:C.bgBase,borderRadius:99,overflow:"hidden"}}>
          <div style={{width:`${pct}%`,height:"100%",background:col,borderRadius:99,
            display:"flex",alignItems:"center",paddingLeft:4,minWidth:pct>0?16:0,transition:"width .4s"}}>
            {pct>=10&&<span style={{fontSize:8,color:"#fff",fontWeight:700,whiteSpace:"nowrap"}}>
              {val.toLocaleString()}
            </span>}
          </div>
        </div>
        {pct<10&&<span style={{fontSize:9,color:col,fontWeight:700,minWidth:36}}>{val.toLocaleString()}</span>}
      </div>
    );
  }

  const hasPlayerStats = playerArr.some(p=>p.hasStats);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16,marginTop:4}}>

      {/* ── กราฟเปรียบเทียบ ── */}
      <div style={SC.card}>
        <div style={{fontWeight:700,fontSize:13,color:C.primaryLight,marginBottom:14}}>
          📊 เปรียบเทียบ ทีมเรา vs {selRival}
        </div>
        {!hasCompareData ? (
          <div style={{color:C.textMuted,fontSize:12,textAlign:"center",padding:"16px 0"}}>
            ยังไม่มี Stats — กรอกข้อมูลใน Match Log ก่อนนะครับ
          </div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {compareData.map(row => {
              const maxVal = Math.max(row.our, row.enemy, 1);
              return (
                <div key={row.label}>
                  <div style={{fontSize:10,color:row.col,fontWeight:700,marginBottom:6}}>{row.label}</div>
                  <Bar val={row.our}   maxVal={maxVal} col={C.win}  label="เรา"/>
                  <Bar val={row.enemy} maxVal={maxVal} col={C.lose} label="คู่แข่ง"/>
                  <div style={{display:"flex",gap:16,marginTop:4}}>
                    {row.our>0&&row.enemy>0&&(
                      <span style={{fontSize:10,color:row.our>=row.enemy?C.win:C.lose,fontWeight:700}}>
                        {row.our>=row.enemy
                          ? `🛡️ ทีมเรานำ +${(row.our-row.enemy).toLocaleString()}`
                          : `⚔️ คู่แข่งนำ +${(row.enemy-row.our).toLocaleString()}`}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div style={{display:"flex",gap:16,marginTop:12,paddingTop:10,borderTop:`1px solid ${C.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:5}}>
            <div style={{width:12,height:12,borderRadius:3,background:C.win}}/>
            <span style={{fontSize:10,color:C.win,fontWeight:700}}>🛡️ ทีมเรา</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:5}}>
            <div style={{width:12,height:12,borderRadius:3,background:C.lose}}/>
            <span style={{fontSize:10,color:C.lose,fontWeight:700}}>⚔️ {selRival}</span>
          </div>
        </div>
      </div>

      {/* ── ตาราง Stats ผู้เล่นคู่แข่ง ── */}
      <div style={SC.card}>
        <div style={{fontWeight:700,fontSize:13,color:C.lose,marginBottom:14}}>
          👤 Stats ผู้เล่น {selRival}
        </div>
        {playerArr.length===0 ? (
          <div style={{color:C.textMuted,fontSize:12,textAlign:"center",padding:"16px 0"}}>
            ยังไม่มีผู้เล่นที่ assign — เลือกชื่อผู้เล่นตอน Draft แล้วกรอก Stats ใน Match Log
          </div>
        ) : (
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:640}}>
              <thead>
                <tr style={{borderBottom:`2px solid ${C.border}`,color:C.textMuted,fontSize:10}}>
                  {["ผู้เล่น","Main Hero","G","W%","Avg K","Avg D","Avg A","KDA","Avg Dmg","Avg DmgTkn","GPM"].map(h=>(
                    <th key={h} style={{padding:"7px 8px",textAlign:h==="ผู้เล่น"||h==="Main Hero"?"left":"center",
                      fontWeight:700,whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {playerArr.map((p,i)=>(
                  <tr key={p.name} style={{borderBottom:`1px solid ${C.border}`,
                    background:i%2===0?"transparent":C.bgCard}}>
                    <td style={{padding:"7px 8px",fontWeight:800,color:C.lose,fontSize:13}}>{p.name}</td>
                    <td style={{padding:"7px 8px"}}>
                      {p.mainHero!=="-" ? <HeroChip name={p.mainHero} size={22} fontSize={11} bold={false}/>
                        : <span style={{fontSize:11,color:C.textMuted}}>-</span>}
                    </td>
                    <td style={{padding:"7px 8px",textAlign:"center",fontWeight:700,color:C.primaryLight}}>{p.games}</td>
                    <td style={{padding:"7px 8px",textAlign:"center"}}>
                      <span style={{display:"inline-block",padding:"1px 7px",borderRadius:5,fontWeight:700,fontSize:11,
                        background:p.wr>=50?C.lose+"20":C.win+"20",
                        color:p.wr>=50?C.lose:C.win}}>{p.games?`${p.wr}%`:"-"}</span>
                    </td>
                    <td style={{padding:"7px 8px",textAlign:"center",color:"#00cec9",fontWeight:700}}>{p.avgK}</td>
                    <td style={{padding:"7px 8px",textAlign:"center",color:C.lose,fontWeight:700}}>{p.avgD}</td>
                    <td style={{padding:"7px 8px",textAlign:"center",color:"#a29bfe",fontWeight:700}}>{p.avgA}</td>
                    <td style={{padding:"7px 8px",textAlign:"center",color:"#fdcb6e",fontWeight:700}}>{p.kda}</td>
                    <td style={{padding:"7px 8px",textAlign:"center",color:"#e17055",fontSize:11}}>
                      {p.avgDmg?p.avgDmg.toLocaleString():"-"}
                    </td>
                    <td style={{padding:"7px 8px",textAlign:"center",color:"#fd79a8",fontSize:11}}>
                      {p.avgDtk?p.avgDtk.toLocaleString():"-"}
                    </td>
                    <td style={{padding:"7px 8px",textAlign:"center",color:"#feca57",fontSize:11}}>
                      {p.gpm?p.gpm.toLocaleString():"-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!hasPlayerStats&&(
              <div style={{marginTop:10,padding:"8px 12px",background:C.primary+"10",borderRadius:7,
                fontSize:11,color:C.textMuted,borderLeft:`3px solid ${C.primary}`}}>
                💡 กรอก KDA/Damage/Gold ได้จากปุ่ม "📊 Stats ทั้งทีม" ใน Match Log
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Pick/Ban ตามลำดับ ── */}
      <PickBanOrderPanel
        games={rGames}
        getBans={g=>g.enemyBans}
        getPicks={g=>g.enemyPicks}
        getWon={g=>g.result==="LOSE"}
        title={`🎯 Pick / Ban ตามลำดับ ของ ${selRival}`}
      />

      {/* ── KDA ต่อ Hero คู่แข่ง ── */}
      <div style={SC.card}>
        <div style={{fontWeight:700,fontSize:13,color:C.lose,marginBottom:14}}>
          ⚔️ KDA ต่อ Hero ของ {selRival}
        </div>
        {heroArr.length===0 ? (
          <div style={{color:C.textMuted,fontSize:12,textAlign:"center",padding:"16px 0"}}>ยังไม่มีข้อมูล</div>
        ) : (
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:560}}>
              <thead>
                <tr style={{borderBottom:`2px solid ${C.border}`,color:C.textMuted,fontSize:10}}>
                  {["Hero","Picks","Win%","Avg K","Avg D","Avg A","KDA","Avg Dmg","Avg DmgTkn"].map(h=>(
                    <th key={h} style={{padding:"7px 8px",textAlign:h==="Hero"?"left":"center",fontWeight:700,whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heroArr.map((s,i)=>(
                  <tr key={s.hero} style={{borderBottom:`1px solid ${C.border}`,
                    background:i%2===0?"transparent":C.bgCard}}>
                    <td style={{padding:"7px 8px"}}><HeroChip name={s.hero} size={24} accentCol={C.lose} fontSize={12}/></td>
                    <td style={{padding:"7px 8px",textAlign:"center",color:C.primaryLight,fontWeight:700}}>{s.picks}</td>
                    <td style={{padding:"7px 8px",textAlign:"center"}}>
                      <span style={{display:"inline-block",padding:"1px 7px",borderRadius:5,fontWeight:700,fontSize:11,
                        background:s.wr>=50?C.lose+"20":C.win+"20",color:s.wr>=50?C.lose:C.win}}>{s.wr}%</span>
                    </td>
                    <td style={{padding:"7px 8px",textAlign:"center",color:"#00cec9",fontWeight:700}}>{s.avgK}</td>
                    <td style={{padding:"7px 8px",textAlign:"center",color:C.lose,fontWeight:700}}>{s.avgD}</td>
                    <td style={{padding:"7px 8px",textAlign:"center",color:"#a29bfe",fontWeight:700}}>{s.avgA}</td>
                    <td style={{padding:"7px 8px",textAlign:"center",color:"#fdcb6e",fontWeight:700}}>{s.kda}</td>
                    <td style={{padding:"7px 8px",textAlign:"center",color:"#e17055",fontSize:11}}>
                      {s.avgDmg?s.avgDmg.toLocaleString():"-"}
                    </td>
                    <td style={{padding:"7px 8px",textAlign:"center",color:"#fd79a8",fontSize:11}}>
                      {s.avgDtk?s.avgDtk.toLocaleString():"-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
