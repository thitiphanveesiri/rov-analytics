"use client";
import { C, iStyle } from "@/lib/theme";
import { useState } from "react";
import { BO_OPTIONS } from "@/components/common/constants";
import { ScoutGameForm } from "@/components/scoutlog/ScoutGameForm";

export function ScoutSessionCreator({ rivals, enemyRosters, onSave, onCancel }) {
  const [teamA,      setTeamA]      = useState("");
  const [teamB,      setTeamB]      = useState("");
  const [mode,       setMode]       = useState("quick"); // "quick" | "bo"
  const [boType,     setBoType]     = useState("BO3");
  const [scoutCat,   setScoutCat]   = useState("scrim"); // "scrim" | "tournament"
  const [games,      setGames]      = useState([]);
  const [gameNo,     setGameNo]     = useState(1);
  const [stage,      setStage]      = useState("setup"); // "setup" | "recording" | "done"

  const bo = BO_OPTIONS.find(b=>b.label===boType)||BO_OPTIONS[2];

  function handleGameSave(gameData) {
    const newGames = [...games, gameData];
    setGames(newGames);
    if (mode==="quick" || newGames.length >= bo.total) {
      onSave({ teamA, teamB, mode, boType:mode==="bo"?boType:"Quick",
               category:scoutCat, games:newGames });
    } else {
      setGameNo(n=>n+1);
    }
  }

  if (stage==="setup") return (
    <div style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:16,padding:28,maxWidth:520}}>
      <div style={{textAlign:"center",marginBottom:22}}>
        <div style={{fontSize:32,marginBottom:6}}>🔍</div>
        <h3 style={{margin:0,fontSize:18,fontWeight:800}}>บันทึก Scout Match</h3>
        <p style={{margin:"4px 0 0",color:C.textMuted,fontSize:12}}>จดแมตช์ที่เราไปส่องมา</p>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
        {[{label:"🔵 ทีม A",val:teamA,set:setTeamA,col:C.blue},
          {label:"🔴 ทีม B",val:teamB,set:setTeamB,col:C.red}].map(({label,val,set,col})=>(
          <div key={label}>
            <div style={{fontSize:11,color:col,fontWeight:700,marginBottom:5}}>{label}</div>
            <select value={rivals.find(r=>r.name===val)?val:"__custom__"}
              onChange={e=>{if(e.target.value!=="__custom__")set(e.target.value);else set("");}}
              style={iStyle}>
              <option value="__custom__">— พิมพ์ชื่อใหม่ —</option>
              {rivals.map(r=><option key={r.id} value={r.name}>{r.name}</option>)}
            </select>
            {(!val||!rivals.find(r=>r.name===val))&&(
              <input value={val} onChange={e=>set(e.target.value)}
                placeholder="ชื่อทีม..." style={{...iStyle,marginTop:5}}/>
            )}
          </div>
        ))}
      </div>

      <div style={{marginBottom:18}}>
        <div style={{fontSize:11,color:C.textMuted,fontWeight:700,marginBottom:8}}>รูปแบบ</div>
        <div style={{display:"flex",gap:8}}>
          {[{id:"quick",label:"⚡ Quick (1 เกม)",sub:"จดเร็ว"},
            {id:"bo",   label:"📦 BO Series",   sub:"หลายเกม"}].map(opt=>(
            <button key={opt.id} onClick={()=>setMode(opt.id)}
              style={{flex:1,background:mode===opt.id?C.primary+"25":"transparent",
                border:`2px solid ${mode===opt.id?C.primary:C.border}`,
                color:mode===opt.id?C.primaryLight:C.textMuted,
                borderRadius:10,padding:"10px 8px",cursor:"pointer",textAlign:"center"}}>
              <div style={{fontWeight:800,fontSize:13}}>{opt.label}</div>
              <div style={{fontSize:10,color:C.textMuted,marginTop:2}}>{opt.sub}</div>
            </button>
          ))}
        </div>
        {mode==="bo"&&(
          <div style={{marginTop:10}}>
            <div style={{fontSize:10,color:C.textMuted,marginBottom:6}}>BO format</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(70px,1fr))",gap:5}}>
              {BO_OPTIONS.map(b=>(
                <button key={b.label} onClick={()=>setBoType(b.label)} style={{
                  background:boType===b.label?C.primary+"30":"transparent",
                  border:`2px solid ${boType===b.label?C.primary:C.border}`,
                  color:boType===b.label?C.primaryLight:C.textMuted,
                  borderRadius:8,padding:"7px 2px",cursor:"pointer",textAlign:"center",fontSize:12,fontWeight:900}}>
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── ประเภท Scout ── */}
      <div style={{marginBottom:16}}>
        <div style={{fontSize:11,color:C.textMuted,fontWeight:700,marginBottom:8}}>ประเภทแมตช์</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {[{id:"scrim",label:"🏋️ ซ้อม",desc:"Scrim / Practice"},
            {id:"tournament",label:"🏆 แข่ง",desc:"Tournament / Official"}].map(cat=>(
            <button key={cat.id} onClick={()=>setScoutCat(cat.id)}
              style={{background:scoutCat===cat.id?C.primary+"30":"transparent",
                border:`2px solid ${scoutCat===cat.id?C.primary:C.border}`,
                color:scoutCat===cat.id?C.primaryLight:C.textMuted,
                borderRadius:10,padding:"10px 8px",cursor:"pointer",textAlign:"center"}}>
              <div style={{fontWeight:900,fontSize:14}}>{cat.label}</div>
              <div style={{fontSize:10,marginTop:2,opacity:0.7}}>{cat.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{display:"flex",gap:8}}>
        <button onClick={onCancel}
          style={{flex:1,background:"transparent",border:`1px solid ${C.border}`,
            color:C.textMuted,borderRadius:9,padding:"10px",cursor:"pointer",fontWeight:700}}>
          ยกเลิก
        </button>
        <button onClick={()=>{
          if(!teamA.trim()||!teamB.trim()){alert("กรุณากรอกชื่อทั้งสองทีม");return;}
          if(teamA.trim()===teamB.trim()){alert("ทีม A และ B ต้องไม่เหมือนกัน");return;}
          setStage("recording");
        }} style={{flex:2,background:`linear-gradient(135deg,${C.primary},${C.primaryLight})`,
          color:"#fff",border:"none",borderRadius:9,padding:"10px",
          cursor:"pointer",fontWeight:800,fontSize:14}}>
          เริ่มบันทึก →
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
        <div style={{fontWeight:800,fontSize:15,color:C.primaryLight}}>
          🔍 Scout: <span style={{color:C.blue}}>{teamA}</span>
          <span style={{color:C.textMuted,margin:"0 6px"}}>vs</span>
          <span style={{color:C.red}}>{teamB}</span>
        </div>
        {mode==="bo"&&(
          <div style={{display:"flex",gap:5}}>
            {Array.from({length:bo.total},(_,i)=>(
              <div key={i} style={{width:22,height:22,borderRadius:"50%",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,
                background:i<games.length?"#6C5CE730":i===gameNo-1?C.primary+"30":"transparent",
                border:`2px solid ${i<games.length?C.primary:i===gameNo-1?C.primary:C.border}`,
                color:i<games.length?C.primaryLight:i===gameNo-1?C.primary:C.textMuted}}>
                {i<games.length?"✓":i+1}
              </div>
            ))}
          </div>
        )}
        {mode==="bo" && games.length>0 && (
          <button onClick={()=>{
            if(window.confirm(`จบ session นี้เลย? (บันทึกไว้แล้ว ${games.length} เกม ไม่ต้องครบ ${bo.total} เกมตามที่ตั้งไว้)`)) {
              onSave({ teamA, teamB, mode, boType, category:scoutCat, games });
            }
          }}
            style={{marginLeft:"auto",background:C.win+"20",border:`1px solid ${C.win}50`,
              color:C.win,borderRadius:7,padding:"4px 12px",cursor:"pointer",fontSize:12,fontWeight:700}}>
            ✅ จบ Session ({games.length} เกม)
          </button>
        )}
        <button onClick={()=>{if(window.confirm("ยกเลิกการบันทึก?"))onCancel();}}
          style={{background:"transparent",border:`1px solid ${C.lose}40`,
            color:C.lose,borderRadius:7,padding:"4px 12px",cursor:"pointer",fontSize:12}}>
          ✕ ยกเลิก
        </button>
      </div>
      <ScoutGameForm
        key={gameNo} gameNo={gameNo}
        teamA={teamA} teamB={teamB}
        rivals={rivals} enemyRosters={enemyRosters}
        onSave={handleGameSave}
        onCancel={onCancel}
      />
    </div>
  );
}
