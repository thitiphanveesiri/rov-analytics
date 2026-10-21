"use client";
import { C, iStyle } from "@/lib/theme";
import { HeroChip } from "@/components/shared/HeroChip";
import { useState } from "react";
import { wilsonLower, compareByConfidence, isLowSample, LOW_SAMPLE } from "@/lib/stats";


// ═══════════════════════════════════════════
//  HERO SYNERGY / COUNTER MATRIX
// ═══════════════════════════════════════════
export function HeroSynergyCounter({ allGames, scoutMatches }) {
  const [mode,       setMode]       = useState("synergy"); // "synergy" | "counter"
  const [dataSource, setDataSource] = useState("all");     // "all"|"our"|"enemy"|"scout"
  const [minGames,   setMinGames]   = useState(2);
  const [searchA,    setSearchA]    = useState("");
  const [searchB,    setSearchB]    = useState("");

  // ── build game samples ──
  // each sample: { heroA, heroB, win: bool }
  const samples = [];

  if (dataSource==="all" || dataSource==="our" || dataSource==="enemy") {
    allGames.forEach(g => {
      const ourWin = g.result==="WIN";
      if (mode==="synergy") {
        // same-team pairs
        if (dataSource!=="enemy") {
          const op = (g.ourPicks||[]).filter(s=>s.hero?.name).map(s=>s.hero.name);
          for (let i=0;i<op.length;i++) for (let j=i+1;j<op.length;j++)
            samples.push({heroA:op[i], heroB:op[j], win:ourWin, src:"our"});
        }
        if (dataSource!=="our") {
          const ep = (g.enemyPicks||[]).filter(s=>s.hero?.name).map(s=>s.hero.name);
          for (let i=0;i<ep.length;i++) for (let j=i+1;j<ep.length;j++)
            samples.push({heroA:ep[i], heroB:ep[j], win:!ourWin, src:"enemy"});
        }
      } else {
        // cross-team: our hero vs enemy hero
        const op = (g.ourPicks||[]).filter(s=>s.hero?.name).map(s=>s.hero.name);
        const ep = (g.enemyPicks||[]).filter(s=>s.hero?.name).map(s=>s.hero.name);
        if (dataSource!=="enemy") {
          op.forEach(ha => ep.forEach(hb =>
            samples.push({heroA:ha, heroB:hb, win:ourWin, src:"our"})
          ));
        }
        if (dataSource!=="our") {
          ep.forEach(ha => op.forEach(hb =>
            samples.push({heroA:ha, heroB:hb, win:!ourWin, src:"enemy"})
          ));
        }
      }
    });
  }

  if (dataSource==="all" || dataSource==="scout") {
    scoutMatches.forEach(sm => {
      (sm.games||[]).forEach(g => {
        const aWin = g.teamAResult==="WIN";
        if (mode==="synergy") {
          const pa = (g.picksA||[]).filter(s=>s.hero?.name).map(s=>s.hero.name);
          const pb = (g.picksB||[]).filter(s=>s.hero?.name).map(s=>s.hero.name);
          for (let i=0;i<pa.length;i++) for (let j=i+1;j<pa.length;j++)
            samples.push({heroA:pa[i], heroB:pa[j], win:aWin, src:"scout"});
          for (let i=0;i<pb.length;i++) for (let j=i+1;j<pb.length;j++)
            samples.push({heroA:pb[i], heroB:pb[j], win:!aWin, src:"scout"});
        } else {
          const pa = (g.picksA||[]).filter(s=>s.hero?.name).map(s=>s.hero.name);
          const pb = (g.picksB||[]).filter(s=>s.hero?.name).map(s=>s.hero.name);
          pa.forEach(ha => pb.forEach(hb => samples.push({heroA:ha, heroB:hb, win:aWin,  src:"scout"})));
          pb.forEach(ha => pa.forEach(hb => samples.push({heroA:ha, heroB:hb, win:!aWin, src:"scout"})));
        }
      });
    });
  }

  // ── aggregate ──
  const pairMap = {};
  samples.forEach(({heroA, heroB, win}) => {
    const key = [heroA, heroB].sort().join("|||");
    if (!pairMap[key]) pairMap[key] = {heroA, heroB, games:0, wins:0};
    pairMap[key].games++;
    if (win) pairMap[key].wins++;
  });

  const pairs = Object.values(pairMap)
    .filter(p => p.games >= minGames)
    .map(p => ({...p, wr: Math.round(p.wins/p.games*100)}))
    // เรียงตามความมั่นใจ (Wilson lower bound) ไม่ใช่ WR ดิบ — กันคู่ 2/2 (100%) ลอยเหนือคู่ 40/50 (80%)
    .sort(compareByConfidence);

  const filtered = pairs.filter(p => {
    const sa = searchA.toLowerCase(), sb = searchB.toLowerCase();
    const n1 = p.heroA.toLowerCase(), n2 = p.heroB.toLowerCase();
    const matchA = !sa || n1.includes(sa) || n2.includes(sa);
    const matchB = !sb || n1.includes(sb) || n2.includes(sb);
    return matchA && matchB;
  });

  const WRColor = wr => wr>=65?C.win : wr>=50?"#fdcb6e" : C.lose;

  return (
    <div style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:14,padding:20,marginTop:20}}>
      {/* header */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <h3 style={{margin:0,fontSize:15,fontWeight:800,color:C.primaryLight}}>
          🧬 Hero Synergy / Counter Matrix
        </h3>
        {/* mode toggle */}
        <div style={{display:"flex",gap:3,background:C.bgBase,borderRadius:8,padding:3,border:`1px solid ${C.border}`}}>
          {[{id:"synergy",label:"🤝 Synergy"},{id:"counter",label:"⚔️ Counter"}].map(m=>(
            <button key={m.id} onClick={()=>setMode(m.id)} style={{
              background:mode===m.id?C.primary:"transparent",
              border:"none",color:mode===m.id?"#fff":C.textMuted,
              borderRadius:6,padding:"5px 14px",cursor:"pointer",fontWeight:700,fontSize:12}}>
              {m.label}
            </button>
          ))}
        </div>
        {/* data source */}
        <div style={{display:"flex",gap:3,background:C.bgBase,borderRadius:8,padding:3,border:`1px solid ${C.border}`}}>
          {[{id:"all",label:"ทั้งหมด"},{id:"our",label:"🛡️ ทีมเรา"},{id:"enemy",label:"⚔️ คู่แข่ง"},{id:"scout",label:"🔍 Scout"}].map(s=>(
            <button key={s.id} onClick={()=>setDataSource(s.id)} style={{
              background:dataSource===s.id?C.primary+"80":"transparent",
              border:"none",color:dataSource===s.id?C.primaryLight:C.textMuted,
              borderRadius:6,padding:"4px 10px",cursor:"pointer",fontWeight:700,fontSize:11}}>
              {s.label}
            </button>
          ))}
        </div>
        {/* min games */}
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:10,color:C.textMuted}}>Min เกม</span>
          <select value={minGames} onChange={e=>setMinGames(Number(e.target.value))}
            style={{...iStyle,width:60,padding:"3px 6px",fontSize:11}}>
            {[1,2,3,5].map(n=><option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      {/* mode description */}
      <div style={{fontSize:11,color:C.textMuted,marginBottom:12,padding:"6px 10px",
        background:C.bgCard,borderRadius:7,borderLeft:`3px solid ${C.primary}`}}>
        {mode==="synergy"
          ? "🤝 Synergy — Hero ที่อยู่ทีมเดียวกันแล้วชนะบ่อย (ข้อมูลจาก picks ฝั่งเดียวกัน)"
          : "⚔️ Counter — Hero A ข้ามทีม Hero B แล้วฝั่ง A ชนะบ่อย (ข้อมูลจาก picks ข้ามทีม)"}
      </div>

      {/* search filters */}
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        <input value={searchA} onChange={e=>setSearchA(e.target.value)}
          placeholder="🔍 Hero A..."
          style={{...iStyle,flex:1,padding:"6px 10px",fontSize:12}}/>
        <input value={searchB} onChange={e=>setSearchB(e.target.value)}
          placeholder="🔍 Hero B..."
          style={{...iStyle,flex:1,padding:"6px 10px",fontSize:12}}/>
        {(searchA||searchB)&&(
          <button onClick={()=>{setSearchA("");setSearchB("");}}
            style={{background:C.lose+"20",border:`1px solid ${C.lose}40`,color:C.lose,
              borderRadius:8,padding:"0 12px",cursor:"pointer",fontSize:12,fontWeight:700}}>✕</button>
        )}
      </div>

      {/* results */}
      {filtered.length===0 ? (
        <div style={{textAlign:"center",padding:"30px 20px",color:C.textMuted,fontSize:12}}>
          {samples.length===0
            ? `ยังไม่มีข้อมูลเพียงพอ — บันทึกแมตช์เพิ่มแล้วลองใหม่`
            : `ไม่พบ Hero pair ที่ตรงกับ filter (ลองลด Min เกม)`}
        </div>
      ) : (
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:480}}>
            <thead>
              <tr style={{background:"#0f0c22",borderBottom:`2px solid ${C.border}`}}>
                <th style={{padding:"8px 10px",textAlign:"center",fontSize:10,color:C.textMuted,fontWeight:700,width:60}}>WR%</th>
                <th style={{padding:"8px 10px",textAlign:"left",fontSize:10,color:C.textMuted,fontWeight:700}}>
                  {mode==="synergy"?"Hero คู่":"Hero A"}
                </th>
                <th style={{padding:"8px 10px",textAlign:"left",fontSize:10,color:C.textMuted,fontWeight:700}}>
                  {mode==="synergy"?"":"vs Hero B"}
                </th>
                <th style={{padding:"8px 10px",textAlign:"center",fontSize:10,color:C.textMuted,fontWeight:700}}>เกม</th>
                <th style={{padding:"8px 10px",textAlign:"center",fontSize:10,color:C.textMuted,fontWeight:700}}>W</th>
                <th style={{padding:"8px 10px",textAlign:"center",fontSize:10,color:C.textMuted,fontWeight:700}}>L</th>
                <th style={{padding:"8px 10px",fontSize:10,color:C.textMuted,fontWeight:700,minWidth:100}}>WR Bar</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0,50).map((p,i)=>{
                const low = isLowSample(p.games);
                // ตัวอย่างน้อยไม่ให้ขึ้นสีเขียว/แดงฟันธง — กันตัวเลขเล็กๆ ดูน่าเชื่อถือเกินจริง
                const col = low ? C.textMuted : WRColor(p.wr);
                const lower = Math.round(wilsonLower(p.wins, p.games)*100);
                return (
                  <tr key={i} title={`WR ดิบ ${p.wr}% จาก ${p.games} เกม · ค่าต่ำสุดที่เชื่อได้ (95%) ≈ ${lower}%`}
                    style={{borderBottom:`1px solid ${C.border}`,opacity:low?0.7:1,
                    background:i%2===0?"transparent":C.bgCard}}>
                    <td style={{padding:"7px 10px",textAlign:"center"}}>
                      <span style={{display:"inline-block",padding:"3px 10px",borderRadius:6,
                        fontWeight:800,fontSize:12,background:col+"22",color:col}}>
                        {p.wr}%
                      </span>
                    </td>
                    <td style={{padding:"7px 10px"}}>
                      <HeroChip name={p.heroA} size={26}/>
                    </td>
                    <td style={{padding:"7px 10px"}}>
                      {mode==="synergy" ? (
                        <HeroChip name={p.heroB} size={26}/>
                      ) : (
                        <HeroChip name={p.heroB} size={26} accentCol={C.lose} textCol={C.lose}/>
                      )}
                    </td>
                    <td style={{padding:"7px 10px",textAlign:"center",color:C.primaryLight,fontWeight:700}}>
                      {p.games}{low && <span style={{display:"block",fontSize:9,fontWeight:600,color:C.textMuted}}>ตัวอย่างน้อย</span>}
                    </td>
                    <td style={{padding:"7px 10px",textAlign:"center",color:C.win,fontWeight:700}}>{p.wins}</td>
                    <td style={{padding:"7px 10px",textAlign:"center",color:C.lose,fontWeight:700}}>{p.games-p.wins}</td>
                    <td style={{padding:"7px 10px"}}>
                      <div style={{height:8,background:C.bgBase,borderRadius:99,overflow:"hidden"}}>
                        <div style={{width:`${p.wr}%`,height:"100%",background:col,borderRadius:99,transition:"width .3s"}}/>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{marginTop:8,fontSize:11,color:C.textMuted}}>
            เรียงตามความมั่นใจทางสถิติ (Wilson 95%) ไม่ใช่ WR ดิบ — คู่ที่มีน้อยกว่า {LOW_SAMPLE} เกมแสดงเป็นสีเทา ใช้เป็นแค่ข้อสังเกต
          </div>
          {filtered.length>50&&(
            <div style={{textAlign:"center",padding:"8px 0",fontSize:11,color:C.textMuted}}>
              แสดง 50 / {filtered.length} คู่ — ใช้ช่อง Search เพื่อ filter ให้แคบลง
            </div>
          )}
        </div>
      )}
    </div>
  );
}
