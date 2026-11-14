"use client";
import { C } from "@/lib/theme";
import { HERO_DATA, ROLES_PICK } from "@/lib/heroes";
import { normalizeDuration } from "@/lib/duration";
import { useState } from "react";
import ScoreboardImport from "@/components/matchlog/ScoreboardImport";


// PatchSelector, RosterPlayerCard moved to components/shared/RosterPlayerCard.js

// ═══════════════════════════════════════════
//  UNIFIED STATS EDITOR — ทีมเรา + คู่แข่ง ในตารางเดียว
//  ✅ แก้ใหม่: ใช้ slot index เป็น key แทนชื่อผู้เล่น
//     เพื่อให้บันทึก stats ได้แม้ไม่ได้กรอกชื่อ
// ═══════════════════════════════════════════
export function UnifiedStatsEditor({ ourPicks, enemyPicks, gameStats, onChangeStats, ourScore, enemyScore }) {
  // gameStats = { our: { 0:{k,d,a,dmg,gold}, 1:... }, enemy: { 0:..., } }
  const fields = ["kills","deaths","assists","damage","damageTaken","gold"];
  const labels = ["K","D","A","Dmg","DmgTaken","Gold"];
  const fieldWidth = { kills:40, deaths:40, assists:40, damage:72, damageTaken:72, gold:64 };

  function getVal(side, idx, field) {
    return (gameStats?.[side]?.[idx]?.[field]) ?? "";
  }
  function setVal(side, idx, field, val) {
    const next = {
      our:   { ...(gameStats?.our || {}) },
      enemy: { ...(gameStats?.enemy || {}) },
    };
    next[side] = {
      ...next[side],
      [idx]: { ...(next[side][idx] || {}), [field]: val === "" ? undefined : Number(val) },
    };
    onChangeStats(next);
  }

  // ── ระบบช่วยเช็คยอดรวม K/D กันกรอกผิด ──
  // กติกา RoV: kill รวมของทีมเรา = kill ที่บันทึกไว้ของทีมเรา (ourScore)
  //           death รวมของทีมเรา = kill รวมของฝั่งตรงข้าม (enemyScore) เพราะทุก death ของเราคือ kill ของอีกฝั่ง
  //           และกลับกันสำหรับฝั่งคู่แข่ง
  function sumField(side, field) {
    const rows = gameStats?.[side] || {};
    return Object.values(rows).reduce((s,r)=> s + (Number(r?.[field]) || 0), 0);
  }
  const sumOurK = sumField("our","kills"),     sumOurD = sumField("our","deaths");
  const sumEnemyK = sumField("enemy","kills"), sumEnemyD = sumField("enemy","deaths");
  const hasAnyStat = sumOurK||sumOurD||sumEnemyK||sumEnemyD;
  const hasScore = ourScore!=null && enemyScore!=null && (ourScore!==0 || enemyScore!==0);

  const checks = hasScore ? [
    { label:"Kill รวมทีมเรา",     actual:sumOurK,   expected:Number(ourScore)||0   },
    { label:"Death รวมทีมเรา",    actual:sumOurD,   expected:Number(enemyScore)||0 },
    { label:"Kill รวมคู่แข่ง",     actual:sumEnemyK, expected:Number(enemyScore)||0 },
    { label:"Death รวมคู่แข่ง",    actual:sumEnemyD, expected:Number(ourScore)||0   },
  ] : [];

  const sections = [
    { label:"🛡️ ทีมเรา", side:"our",   picks: ourPicks,   col: C.win  },
    { label:"⚔️ คู่แข่ง", side:"enemy", picks: enemyPicks, col: C.lose },
  ];

  const anyPick = [...(ourPicks||[]), ...(enemyPicks||[])].some(s=>s?.hero||s?.player);
  if (!anyPick) return (
    <div style={{textAlign:"center",padding:"20px 0",color:C.textMuted,fontSize:12}}>
      ยังไม่มี Pick ในเกมนี้
    </div>
  );

  return (
    <div style={{background:"#080614",borderRadius:10,overflow:"hidden",border:`1px solid ${C.border}`}}>
      <ScoreboardImport ourPicks={ourPicks} enemyPicks={enemyPicks} gameStats={gameStats} onChangeStats={onChangeStats}/>
      {hasScore && hasAnyStat > 0 && (
        <div style={{padding:"10px 12px",background:"#0f0c22",borderBottom:`1px solid ${C.border}`,
          display:"flex",flexWrap:"wrap",gap:8}}>
          {checks.map(c=>{
            const ok = c.actual === c.expected;
            return (
              <div key={c.label} style={{display:"flex",alignItems:"center",gap:5,
                background: ok ? C.win+"15" : C.lose+"15",
                border:`1px solid ${ok?C.win:C.lose}40`,borderRadius:7,padding:"4px 9px"}}>
                <span style={{fontSize:11}}>{ok?"✅":"⚠️"}</span>
                <span style={{fontSize:10,color:C.textMuted}}>{c.label}:</span>
                <span style={{fontSize:11,fontWeight:800,color:ok?C.win:C.lose}}>
                  {c.actual}/{c.expected}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:560}}>
          <thead>
            <tr style={{background:"#0f0c22"}}>
              <th style={{textAlign:"left",padding:"8px 10px",fontWeight:700,fontSize:10,color:C.textMuted,whiteSpace:"nowrap"}}>
                ผู้เล่น / Hero
              </th>
              {labels.map(h=>(
                <th key={h} style={{textAlign:"center",padding:"8px 4px",fontWeight:700,fontSize:10,color:C.textMuted,whiteSpace:"nowrap"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sections.map(({ label, side, picks, col }) => {
              const validPicks = (picks||[]).filter(s => s?.hero || s?.player);
              if (!validPicks.length) return null;
              return [
                <tr key={`hdr-${side}`}>
                  <td colSpan={6} style={{padding:"6px 10px",
                    background: col + "12",
                    fontSize:10, fontWeight:800, color:col, letterSpacing:1}}>
                    {label}
                  </td>
                </tr>,
                ...(picks||[]).map((slot, idx) => {
                  if (!slot?.hero && !slot?.player) return null;
                  return (
                    <tr key={`${side}-${idx}`} style={{borderTop:`1px solid ${C.border}`}}>
                      <td style={{padding:"5px 10px",minWidth:130}}>
                        <div style={{fontSize:11,fontWeight:700,color:col,lineHeight:1.2}}>
                          {slot.player || <span style={{color:C.textMuted,fontStyle:"italic",fontWeight:400}}>ไม่ระบุชื่อ</span>}
                        </div>
                        <div style={{fontSize:9,color:C.textMuted}}>{slot.hero?.name || "—"}</div>
                      </td>
                      {fields.map(field => (
                        <td key={field} style={{padding:"4px 3px",textAlign:"center"}}>
                          <input
                            type="number" min="0"
                            value={getVal(side, idx, field)}
                            onChange={e => setVal(side, idx, field, e.target.value)}
                            placeholder="0"
                            style={{width:fieldWidth[field],background:"#0a0816",border:`1px solid ${C.border}`,
                              color:C.textMain,borderRadius:5,padding:"4px 5px",
                              fontSize:12,textAlign:"center",outline:"none"}}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                }).filter(Boolean),
              ];
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  SINGLE GAME DETAIL (Match Log)
// ═══════════════════════════════════════════
// ═══════════════════════════════════════════
//  EDIT GAME MODAL — แก้ไข hero draft / สกอร์ / เวลา / ชื่อผู้เล่น / ผูกวิดีโอ
//  ย้อนหลังจากหน้า Match Log (ต่างจาก UPDATE_STATS ที่แก้ได้แค่ K/D/A)
// ═══════════════════════════════════════════
export function EditGameModal({ game, roster, enemyRoster=[], videos=[], onSave, onClose }) {
  const [ourPicks, setOurPicks] = useState(() =>
    (game.ourPicks && game.ourPicks.length ? game.ourPicks : ROLES_PICK.map(r=>({role:r,hero:null,player:""})))
      .map(p=>({...p})));
  const [enemyPicks, setEnemyPicks] = useState(() =>
    (game.enemyPicks && game.enemyPicks.length ? game.enemyPicks : ROLES_PICK.map(r=>({role:r,hero:null,player:""})))
      .map(p=>({...p})));
  const [result,     setResult]     = useState(game.result || "WIN");
  const [ourScore,   setOurScore]   = useState(game.ourScore ?? "");
  const [enemyScore, setEnemyScore] = useState(game.enemyScore ?? "");
  const [duration,   setDuration]   = useState(game.duration || "");
  const [hasPause,   setHasPause]   = useState(!!game.pauseDuration);
  const [pauseDuration, setPauseDuration] = useState(game.pauseDuration || "");
  const [videoId,    setVideoId]    = useState(game.videoId || "");

  const setOurHero     = (i,name) => setOurPicks(prev => prev.map((p,idx)=> idx===i ? {...p, hero: name?{name}:null} : p));
  const setOurPlayer   = (i,name) => setOurPicks(prev => prev.map((p,idx)=> idx===i ? {...p, player:name} : p));
  const setEnemyHero   = (i,name) => setEnemyPicks(prev => prev.map((p,idx)=> idx===i ? {...p, hero: name?{name}:null} : p));
  const setEnemyPlayer = (i,name) => setEnemyPicks(prev => prev.map((p,idx)=> idx===i ? {...p, player:name} : p));

  function save() {
    onSave({
      ourPicks, enemyPicks, result,
      ourScore: Math.max(0, ourScore===""?0:Number(ourScore)||0),
      enemyScore: Math.max(0, enemyScore===""?0:Number(enemyScore)||0),
      duration: normalizeDuration(duration),
      pauseDuration: hasPause && pauseDuration ? normalizeDuration(pauseDuration) : null,
      videoId: videoId || null,
    });
    onClose();
  }

  const selectStyle = {background:C.bgCard,border:`1px solid ${C.border}`,color:C.textMain,
    borderRadius:6,padding:"5px 6px",fontSize:11,outline:"none"};

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:500,
      display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
      onClick={onClose}>
      <div onClick={e=>e.stopPropagation()}
        style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:16,
          padding:24,width:680,maxWidth:"100%",maxHeight:"85vh",overflowY:"auto"}}>
        <div style={{fontWeight:800,fontSize:16,marginBottom:16,color:C.primaryLight}}>✏️ แก้ไขข้อมูลเกม</div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:16,marginBottom:16}}>
          <div>
            <div style={{fontWeight:700,fontSize:12,color:C.win,marginBottom:8}}>🛡️ ทีมเรา (Hero + ผู้เล่น)</div>
            {ourPicks.map((p,i)=>(
              <div key={i} style={{display:"flex",gap:6,marginBottom:6,alignItems:"center"}}>
                <span style={{fontSize:10,color:C.textMuted,width:48,flexShrink:0}}>{p.role}</span>
                <select value={p.hero?.name||""} onChange={e=>setOurHero(i,e.target.value)} style={{...selectStyle,flex:1}}>
                  <option value="">— hero —</option>
                  {HERO_DATA.map(h=><option key={h.name} value={h.name}>{h.name}</option>)}
                </select>
                <select value={p.player||""} onChange={e=>setOurPlayer(i,e.target.value)} style={{...selectStyle,width:96}}>
                  <option value="">— ผู้เล่น —</option>
                  {roster.map(r=><option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div>
            <div style={{fontWeight:700,fontSize:12,color:C.lose,marginBottom:8}}>⚔️ คู่แข่ง (Hero + ผู้เล่น)</div>
            {enemyPicks.map((p,i)=>(
              <div key={i} style={{display:"flex",gap:6,marginBottom:6,alignItems:"center"}}>
                <span style={{fontSize:10,color:C.textMuted,width:48,flexShrink:0}}>{p.role}</span>
                <select value={p.hero?.name||""} onChange={e=>setEnemyHero(i,e.target.value)} style={{...selectStyle,flex:1}}>
                  <option value="">— hero —</option>
                  {HERO_DATA.map(h=><option key={h.name} value={h.name}>{h.name}</option>)}
                </select>
                {enemyRoster.length > 0 ? (
                  <select value={p.player||""} onChange={e=>setEnemyPlayer(i,e.target.value)} style={{...selectStyle,width:96}}>
                    <option value="">— ผู้เล่น —</option>
                    {enemyRoster.map(r=><option key={r} value={r}>{r}</option>)}
                  </select>
                ) : (
                  // ยังไม่เคยบันทึกชื่อผู้เล่นทีมนี้ไว้เลย (enemyRosters ว่าง) —
                  // ใช้ช่องพิมพ์อิสระแทน dropdown เพื่อไม่ให้ block การกรอกครั้งแรก
                  <input type="text" value={p.player||""} onChange={e=>setEnemyPlayer(i,e.target.value)}
                    placeholder="ชื่อผู้เล่น" style={{...selectStyle,width:96}}/>
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:16}}>
          <div>
            <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>ผล</div>
            <select value={result} onChange={e=>setResult(e.target.value)}
              style={{...selectStyle,color:result==="WIN"?C.win:C.lose,fontWeight:700,padding:"7px 10px",fontSize:12}}>
              <option>WIN</option><option>LOSE</option>
            </select>
          </div>
          <div>
            <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>คิลเรา</div>
            <input type="number" min="0" value={ourScore} onChange={e=>setOurScore(e.target.value)}
              style={{...selectStyle,width:70,padding:"7px 10px",fontSize:12}}/>
          </div>
          <div>
            <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>คิลศัตรู</div>
            <input type="number" min="0" value={enemyScore} onChange={e=>setEnemyScore(e.target.value)}
              style={{...selectStyle,width:70,padding:"7px 10px",fontSize:12}}/>
          </div>
          <div>
            <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>เวลา (นาที.วินาที)</div>
            <input type="text" inputMode="decimal" value={duration}
              onChange={e=>setDuration(e.target.value)}
              onBlur={e=>setDuration(normalizeDuration(e.target.value))}
              placeholder="09.45"
              style={{...selectStyle,width:90,padding:"7px 10px",fontSize:12}}/>
          </div>
          <div>
            <label style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color:C.textMuted,
              marginBottom:4,cursor:"pointer",userSelect:"none",whiteSpace:"nowrap"}}>
              <input type="checkbox" checked={hasPause}
                onChange={e=>{setHasPause(e.target.checked); if(!e.target.checked) setPauseDuration("");}}/>
              ⏸️ มีหยุดเกม
            </label>
            {hasPause && (
              <input type="text" inputMode="decimal" placeholder="00.00"
                title="เวลาที่หยุดเกมไปทั้งหมด (นาที.วินาที)"
                value={pauseDuration}
                onChange={e=>setPauseDuration(e.target.value)}
                onBlur={e=>setPauseDuration(normalizeDuration(e.target.value))}
                style={{...selectStyle,width:90,padding:"7px 10px",fontSize:12}}/>
            )}
          </div>
        </div>

        <div style={{marginBottom:20}}>
          <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>🎬 ผูกกับวิดีโอ (ไม่บังคับ)</div>
          <select value={videoId} onChange={e=>setVideoId(e.target.value)}
            style={{...selectStyle,width:"100%",boxSizing:"border-box",padding:"8px 10px",fontSize:12}}>
            <option value="">— ไม่ผูกวิดีโอ —</option>
            {videos.map(v=><option key={v.id} value={v.id}>{v.title||v.url}</option>)}
          </select>
        </div>

        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={{background:"transparent",border:`1px solid ${C.border}`,
            color:C.textMuted,borderRadius:8,padding:"9px 18px",cursor:"pointer",fontWeight:700,fontSize:13}}>
            ยกเลิก
          </button>
          <button onClick={save} style={{background:C.primary,color:"#fff",border:"none",borderRadius:8,
            padding:"9px 22px",cursor:"pointer",fontWeight:700,fontSize:13}}>
            💾 บันทึก
          </button>
        </div>
      </div>
    </div>
  );
}
