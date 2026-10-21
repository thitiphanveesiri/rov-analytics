"use client";
import { toDatetimeLocal, fromDatetimeLocal } from "@/lib/matchTime";
import { compareByConfidence, isLowSample } from "@/lib/stats";
import { C, iStyle } from "@/lib/theme";
import { HERO_DATA, ROLES_FILTER, ROLE_COLOR } from "@/lib/heroes";
import { HeroCard, HeroChip } from "@/components/shared/HeroChip";
import { normalizeDuration } from "@/lib/duration";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { BO_OPTIONS } from "@/components/common/constants";
import { DRAFT_ORDER, draftKeyFor } from "@/components/draft/constants";
import { MockDraftTrainer } from "@/components/draft/MockDraftTrainer";
import { PhaseTracker } from "@/components/draft/PhaseTracker";


// ── ถามก่อนปิดแมตช์ตอนจบเกมสุดท้ายของ Bo ──
// เผื่อกรณีตั้ง Bo ผิดตอนแรก (เช่น ตั้งใจซ้อม Bo4 แต่กด Bo3 ตอน setup) จะได้แก้ทัน
// ไม่ต้องลบแมตช์ทิ้งแล้วเริ่ม Live Draft ใหม่ทั้งหมด
function FinishMatchChoiceModal({ boType, nextBoLabel, canAddExtra, onConfirmFinish, onAddExtraGame, onCancel }) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:600,
      display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
      onClick={onCancel}>
      <div onClick={e=>e.stopPropagation()}
        style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:16,
          padding:26,width:440,maxWidth:"100%",boxShadow:"0 20px 60px rgba(0,0,0,0.4)"}}>
        <div style={{fontSize:32,textAlign:"center",marginBottom:10}}>🏁</div>
        <div style={{fontWeight:800,fontSize:16,textAlign:"center",marginBottom:6,color:C.primaryLight}}>
          จบเกมสุดท้ายของ {boType} แล้ว
        </div>
        <p style={{margin:"0 0 20px",color:C.textMuted,fontSize:13,textAlign:"center",lineHeight:1.6}}>
          ยืนยันจบแมตช์นี้เลย หรือถ้าตั้ง Bo ผิดตอนแรก (เช่น ตั้งใจ {nextBoLabel} แต่กด {boType})
          สามารถเพิ่มอีก 1 เกมต่อได้ทันที โดยไม่ต้องเริ่ม Draft ใหม่
        </p>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <button onClick={onConfirmFinish}
            style={{background:`linear-gradient(135deg,${C.primary},${C.primaryLight})`,
              color:"#fff",border:"none",borderRadius:9,padding:"11px 0",
              cursor:"pointer",fontWeight:800,fontSize:14}}>
            ✅ ยืนยันจบแมตช์ ({boType})
          </button>
          {canAddExtra ? (
            <button onClick={onAddExtraGame}
              style={{background:"transparent",border:`1px solid ${C.primary}60`,color:C.primaryLight,
                borderRadius:9,padding:"10px 0",cursor:"pointer",fontWeight:700,fontSize:13}}>
              ➕ เพิ่มอีก 1 เกม (เปลี่ยนเป็น {nextBoLabel})
            </button>
          ) : (
            <div style={{fontSize:11,color:C.textMuted,textAlign:"center",padding:"4px 0"}}>
              ({boType} คือ Bo สูงสุดที่รองรับ — เพิ่มเกมต่อไม่ได้แล้ว)
            </div>
          )}
          <button onClick={onCancel}
            style={{background:"transparent",border:"none",color:C.textMuted,
              cursor:"pointer",fontSize:12,padding:"6px 0",textDecoration:"underline"}}>
            ยกเลิก กลับไปแก้เกมนี้
          </button>
        </div>
      </div>
    </div>
  );
}

export function DraftPageR({ draft, dispatch, roster, rivals, enemyRosters, onFinishSession, allGames, scoutMatches, heroTiers }) {
  const { data: draftSession } = useSession();
  const draftKey = draftKeyFor(draftSession?.user?.id);
  const [mockMode, setMockMode] = useState(false);

  // เช็คครั้งเดียวตอนเปิดหน้านี้ว่ามี draft ที่ทำค้างไว้ (จากแท็บก่อนหน้าที่ crash/ปิดพลาด) ไหม
  const [recoverable] = useState(() => {
    if (draft.stage !== "setup") return null; // อยู่กลาง session อยู่แล้ว ไม่ต้องเสนอกู้คืน
    try {
      const raw = draftKey ? localStorage.getItem(draftKey) : null;
      if (!raw) return null;
      const saved = JSON.parse(raw);
      if (saved && saved.stage && saved.stage !== "setup") return saved;
      return null;
    } catch { return null; }
  });
  const [dismissedRecovery, setDismissedRecovery] = useState(false);
  // เก็บเกมที่เพิ่งกรอกจบ (แต่ยังไม่ dispatch) ไว้ระหว่างถามว่าจะปิดแมตช์เลยหรือเพิ่มอีกเกม —
  // ถามเฉพาะตอนเป็นเกมสุดท้ายของ Bo เท่านั้น (ดู handleGameDone) ไม่กระทบเกมกลางๆ ของ series
  const [pendingFinishGame, setPendingFinishGame] = useState(null);

  if (mockMode) return (
    <MockDraftTrainer rivals={rivals} allGames={allGames} scoutMatches={scoutMatches} heroTiers={heroTiers}
      onExit={()=>setMockMode(false)}/>
  );

  const { stage, boType, rivalName, ourSide, currentGame, completedGames,
          step, blueBans, redBans, bluePicks, redPicks,
          roleFilter, heroViewMode, search, meta } = draft;

  const bo = BO_OPTIONS.find(b=>b.label===boType) || BO_OPTIONS[2];
  const currentEnemyRoster = enemyRosters[rivalName] || [];

  // ── Fearless draft: ฮีโร่ที่แต่ละฝั่ง Pick ไปแล้วใน series นี้ Pick ซ้ำไม่ได้อีก ──
  // (Ban ไม่ติดกฎนี้ — แบนซ้ำได้ปกติ ดู isGlobalLocked ด้านล่างที่เช็คเฉพาะ action !== "ban")
  //
  // ยกเว้น "เกมที่ 7 ของ Bo7" — กติกาทัวร์นาเมนต์ทั่วไปให้เกมตัดสิน (decider) ของ Bo7 รีเซ็ต
  // hero pool ใหม่ทั้งหมด ฮีโร่ที่เกมก่อนหน้าใช้ไปแล้วกลับมา pick ได้ทั้ง 2 ฝั่ง เหมือนเริ่ม series ใหม่
  // (Bo อื่นที่ไม่ใช่ 7 ไม่มีข้อยกเว้นนี้ ใช้ fearless ตลอดทั้ง series ตามเดิม)
  const isBo7DeciderGame = bo.total === 7 && currentGame === 7;
  const globalLockedOur = isBo7DeciderGame ? new Set() : new Set(
    completedGames.flatMap(g=>(g.ourPicks||[]).filter(s=>s.hero).map(s=>s.hero.name))
  );
  const globalLockedEnemy = isBo7DeciderGame ? new Set() : new Set(
    completedGames.flatMap(g=>(g.enemyPicks||[]).filter(s=>s.hero).map(s=>s.hero.name))
  );

  const cur        = step < DRAFT_ORDER.length ? DRAFT_ORDER[step] : null;
  const phase      = !cur ? "DONE" : cur.action==="ban" ? "BAN" : "PICK";
  const phaseColor = phase==="BAN" ? C.ban : C.win;

  const usedThisGame = new Set([
    ...blueBans.filter(Boolean).map(h=>h.name),
    ...redBans.filter(Boolean).map(h=>h.name),
    ...bluePicks.filter(h=>h.hero).map(h=>h.hero.name),
    ...redPicks.filter(h=>h.hero).map(h=>h.hero.name),
  ]);

  function isGlobalLocked(heroName) {
    if (!cur || cur.action==="ban") return false;
    return cur.team===ourSide ? globalLockedOur.has(heroName) : globalLockedEnemy.has(heroName);
  }

  function teamLabel(t) {
    return t===ourSide ? `${t==="blue"?"🔵":"🔴"} ทีมเรา` : `${t==="blue"?"🔵":"🔴"} คู่แข่ง`;
  }

  function selectHero(hero) {
    if (!cur || usedThisGame.has(hero.name) || isGlobalLocked(hero.name)) return;
    dispatch({ type:"SELECT_HERO", payload:{ hero, team:cur.team, action:cur.action, slot:cur.slot } });
  }

  function handleGameDone() {
    const ourPicksData   = ourSide==="blue" ? bluePicks : redPicks;
    const enemyPicksData = ourSide==="blue" ? redPicks  : bluePicks;
    const ourBansData    = ourSide==="blue" ? blueBans  : redBans;
    const enemyBansData  = ourSide==="blue" ? redBans   : blueBans;
    const finishedGame = {
      ourSide, result:meta.result,
      ourScore:meta.ourScore, enemyScore:meta.enemyScore,
      duration:meta.duration,
      pauseDuration: meta.hasPause && meta.pauseDuration ? normalizeDuration(meta.pauseDuration) : null,
      note:meta.note,
      ourBans:ourBansData, enemyBans:enemyBansData,
      ourPicks:ourPicksData, enemyPicks:enemyPicksData,
      gameStats:{ our:{}, enemy:{} },
      gameNo: currentGame,
    };

    // ถ้าเป็นเกมสุดท้ายของ Bo — ไม่ปิดแมตช์ทันที ถามก่อนว่าจะยืนยันจบ หรือตั้ง Bo ผิดแล้วอยากเพิ่ม
    // อีกเกม (เช่น ซ้อม Bo4 แต่กด Bo3 ตอน setup) กดจริงๆ ค่อยไปที่ confirmFinishMatch/
    // confirmAddExtraGame ด้านล่าง — ยังไม่ dispatch อะไรตรงนี้ ข้อมูลเกมนี้เลยยังแก้ต่อได้ถ้ากด "ยกเลิก"
    if (currentGame >= bo.total) {
      setPendingFinishGame(finishedGame);
      return;
    }

    dispatch({ type:"GAME_DONE", payload: finishedGame });
  }

  function confirmFinishMatch() {
    if (!pendingFinishGame) return;
    onFinishSession([...completedGames, pendingFinishGame]);
    setPendingFinishGame(null);
  }

  function confirmAddExtraGame() {
    if (!pendingFinishGame) return;
    dispatch({ type:"ADD_EXTRA_GAME", payload: pendingFinishGame });
    setPendingFinishGame(null);
  }

  const filtered = HERO_DATA.filter(h =>
    (roleFilter==="All" || (h.roles||[h.role]).includes(roleFilter)) &&
    h.name.toLowerCase().includes(search.toLowerCase())
  );

  const phaseLabel = !cur ? "✅ Draft เสร็จ"
    : cur.action==="ban" ? `🚫 BAN — ${teamLabel(cur.team)}`
    : `⚔️ PICK — ${teamLabel(cur.team)}`;

  // ── SETUP ──
  if (stage==="setup") return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",
      minHeight:"calc(100vh - 60px)",background:C.bgBase}}>
      <div style={{width:500,background:C.bgPanel,borderRadius:20,padding:36,
        border:`1px solid ${C.border}`,boxShadow:"0 20px 60px rgba(0,0,0,0.4)"}}>
        {recoverable && !dismissedRecovery && (
          <div style={{background:"#feca5715",border:"1px solid #feca5750",borderRadius:12,
            padding:14,marginBottom:20}}>
            <div style={{fontWeight:800,fontSize:13,color:"#feca57",marginBottom:6}}>
              ⚠️ พบ Draft ที่ทำค้างไว้
            </div>
            <div style={{fontSize:12,color:C.textMuted,marginBottom:10}}>
              {recoverable.boType} vs {recoverable.rivalName || "?"} — ทำไปแล้ว {recoverable.step||0}/{DRAFT_ORDER.length} ขั้นตอน
              (น่าจะเกิดจากรีเฟรช/ปิดแท็บกลางคันครั้งก่อน)
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{ dispatch({type:"LOAD_DRAFT", payload:recoverable}); }}
                style={{background:"#feca57",color:"#1a1a2e",border:"none",borderRadius:8,
                  padding:"7px 16px",cursor:"pointer",fontWeight:800,fontSize:12}}>
                🔄 กู้คืนต่อ
              </button>
              <button onClick={()=>{
                  try{ if(draftKey) localStorage.removeItem(draftKey); }catch{}
                  setDismissedRecovery(true);
                }}
                style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textMuted,
                  borderRadius:8,padding:"7px 16px",cursor:"pointer",fontWeight:700,fontSize:12}}>
                🗑️ ลบทิ้ง เริ่มใหม่
              </button>
            </div>
          </div>
        )}
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:36,marginBottom:6}}>⚔️</div>
          <h2 style={{margin:0,fontSize:20,fontWeight:800}}>เริ่ม Draft Session</h2>
          <button onClick={()=>setMockMode(true)}
            style={{marginTop:10,background:"transparent",border:`1px solid ${C.border}`,
              color:C.textMuted,borderRadius:99,padding:"5px 14px",cursor:"pointer",fontSize:11,fontWeight:700}}>
            🧠 หรือฝึกซ้อม Draft กับ AI แทน →
          </button>
        </div>
        <div style={{marginBottom:18}}>
          <div style={{fontSize:12,color:C.textMuted,marginBottom:6,fontWeight:700}}>ทีมคู่แข่ง</div>
          {rivals.length>0 ? (
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              <select
                value={rivals.find(r=>r.name===rivalName) ? rivalName : "__custom__"}
                onChange={e=>{
                  if (e.target.value==="__custom__") dispatch({type:"SETUP_SET_RIVAL",payload:""});
                  else dispatch({type:"SETUP_SET_RIVAL",payload:e.target.value});
                }}
                style={iStyle}>
                <option value="__custom__">— พิมพ์ชื่อทีมใหม่ —</option>
                {rivals.map(r=><option key={r.id} value={r.name}>{r.name}</option>)}
              </select>
              {(!rivalName || !rivals.find(r=>r.name===rivalName)) && (
                <input value={rivalName}
                  onChange={e=>dispatch({type:"SETUP_SET_RIVAL",payload:e.target.value})}
                  placeholder="พิมพ์ชื่อทีมใหม่..." style={iStyle}/>
              )}
            </div>
          ) : (
            <input value={rivalName}
              onChange={e=>dispatch({type:"SETUP_SET_RIVAL",payload:e.target.value})}
              placeholder="เช่น Alpha Wolves" style={iStyle}/>
          )}
          {rivalName && currentEnemyRoster.length>0 && (
            <div style={{marginTop:8,padding:"8px 12px",background:C.lose+"10",
              border:`1px solid ${C.lose}30`,borderRadius:8}}>
              <div style={{fontSize:10,color:C.lose,fontWeight:700,marginBottom:4}}>
                ⚔️ Roster: {currentEnemyRoster.length} คน
              </div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                {currentEnemyRoster.map(p=>(
                  <span key={p} style={{background:C.lose+"20",color:C.lose,fontSize:10,
                    padding:"2px 8px",borderRadius:99,fontWeight:700}}>{p}</span>
                ))}
              </div>
            </div>
          )}
        </div>
        <div style={{marginBottom:28}}>
          <div style={{fontSize:12,color:C.textMuted,marginBottom:10,fontWeight:700}}>รูปแบบ BO</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(70px,1fr))",gap:6}}>
            {BO_OPTIONS.map(b=>(
              <button key={b.label}
                onClick={()=>dispatch({type:"SETUP_SET_BO",payload:b.label})}
                style={{background:boType===b.label?C.primary+"30":"transparent",
                  border:`2px solid ${boType===b.label?C.primary:C.border}`,
                  color:boType===b.label?C.primaryLight:C.textMuted,
                  borderRadius:10,padding:"10px 4px",cursor:"pointer",textAlign:"center"}}>
                <div style={{fontWeight:900,fontSize:15}}>{b.label}</div>
              </button>
            ))}
          </div>
        </div>
        {/* ── Patch Version ── */}
        <div style={{marginBottom:16}}>
          <div style={{fontSize:12,color:C.textMuted,marginBottom:8,fontWeight:700}}>
            🗂️ Patch Version <span style={{fontWeight:400,fontSize:11}}>(ไม่บังคับ)</span>
          </div>
          <input
            value={draft.patch||""}
            onChange={e=>dispatch({type:"SETUP_SET_PATCH",payload:e.target.value})}
            placeholder="เช่น 4.21, 4.22 ..."
            style={{width:"100%",boxSizing:"border-box",background:"#1a1535",
              border:`1px solid ${C.border}`,color:C.textMain,borderRadius:9,
              padding:"9px 14px",fontSize:13,outline:"none"}}/>
        </div>

        {/* ── วัน-เวลาที่แข่งจริง (กรอกเมื่อบันทึกย้อนหลัง) ── */}
        <div style={{marginBottom:16}}>
          <div style={{fontSize:12,color:C.textMuted,marginBottom:8,fontWeight:700}}>
            🕒 วัน-เวลาที่แข่ง <span style={{fontWeight:400,fontSize:11}}>(ไม่กรอก = ตอนนี้ — กรอกเมื่อบันทึกย้อนหลัง เพื่อให้จัดเข้า patch/สัปดาห์ถูก)</span>
          </div>
          <input type="datetime-local"
            value={draft.playedAt ? toDatetimeLocal(draft.playedAt) : ""}
            max={toDatetimeLocal(Date.now())}
            onChange={e=>dispatch({type:"SETUP_SET_PLAYED_AT",payload:fromDatetimeLocal(e.target.value)})}
            style={{width:"100%",boxSizing:"border-box",background:"#1a1535",
              border:`1px solid ${C.border}`,color:C.textMain,borderRadius:9,
              padding:"9px 14px",fontSize:16,outline:"none"}}/>
        </div>

        {/* ── Category: ซ้อม / แข่ง ── */}
        <div style={{marginBottom:28}}>
          <div style={{fontSize:12,color:C.textMuted,marginBottom:10,fontWeight:700}}>ประเภทแมตช์</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {[{id:"scrim",label:"🏋️ ซ้อม",desc:"Scrim / Practice"},{id:"tournament",label:"🏆 แข่ง",desc:"Tournament / Official"}].map(cat=>(
              <button key={cat.id}
                onClick={()=>dispatch({type:"SETUP_SET_CATEGORY",payload:cat.id})}
                style={{background:draft.category===cat.id?C.primary+"30":"transparent",
                  border:`2px solid ${draft.category===cat.id?C.primary:C.border}`,
                  color:draft.category===cat.id?C.primaryLight:C.textMuted,
                  borderRadius:10,padding:"12px 8px",cursor:"pointer",textAlign:"center"}}>
                <div style={{fontWeight:900,fontSize:15}}>{cat.label}</div>
                <div style={{fontSize:10,marginTop:3,opacity:0.7}}>{cat.desc}</div>
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={()=>{
            if(!rivalName.trim()){alert("กรุณากรอกชื่อทีมคู่แข่ง");return;}
            dispatch({type:"SETUP_NEXT"});
          }}
          style={{width:"100%",background:`linear-gradient(135deg,${C.primary},${C.primaryLight})`,
            color:"#fff",border:"none",borderRadius:10,padding:"13px",fontWeight:800,fontSize:15,cursor:"pointer"}}>
          ถัดไป: เลือกฝั่ง Game 1 →
        </button>
      </div>
    </div>
  );

  // ── CHOOSE SIDE ──
  if (stage==="chooseSide") return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      minHeight:"calc(100vh - 60px)",background:C.bgBase,position:"relative"}}>
      {completedGames.length>0&&(
        <button onClick={()=>onFinishSession(completedGames)} style={{
          position:"absolute",top:20,right:24,
          background:"transparent",border:`1px solid ${C.win}60`,color:C.win,
          borderRadius:8,padding:"6px 16px",cursor:"pointer",fontWeight:700,fontSize:13}}>
          ✅ Finish ({completedGames.length} เกม)
        </button>
      )}
      <button onClick={()=>dispatch({type:"BACK_TO_SETUP"})} style={{
        position:"absolute",top:20,left:24,
        background:"transparent",border:"none",color:C.textMuted,cursor:"pointer",fontSize:13}}>
        ← กลับ Setup
      </button>
      <div style={{textAlign:"center",marginBottom:8}}>
        <div style={{fontSize:11,color:C.primaryLight,fontWeight:700,letterSpacing:1,marginBottom:4}}>
          {boType} · vs {rivalName}
        </div>
        <div style={{display:"flex",gap:6,justifyContent:"center",marginBottom:16}}>
          {Array.from({length:bo.total},(_,i)=>(
            <div key={i} style={{width:24,height:24,borderRadius:"50%",display:"flex",
              alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,
              background:i<completedGames.length
                ?completedGames[i].result==="WIN"?C.win+"30":C.lose+"30"
                :i===currentGame-1?C.primary+"30":"transparent",
              border:`2px solid ${i<completedGames.length
                ?completedGames[i].result==="WIN"?C.win:C.lose
                :i===currentGame-1?C.primary:C.border}`,
              color:i<completedGames.length
                ?completedGames[i].result==="WIN"?C.win:C.lose
                :i===currentGame-1?C.primary:C.textMuted}}>
              {i<completedGames.length?(completedGames[i].result==="WIN"?"W":"L"):i+1}
            </div>
          ))}
        </div>
        <h2 style={{margin:0,fontSize:20,fontWeight:800}}>เลือกฝั่ง — Game {currentGame}</h2>
        <p style={{margin:"6px 0 0",color:C.textMuted,fontSize:12}}>ทีมเราเล่นฝั่งไหนในเกมนี้?</p>
        {(globalLockedOur.size>0||globalLockedEnemy.size>0)&&(
          <div style={{marginTop:16,background:C.bgPanel,border:`1px solid ${C.border}`,
            borderRadius:12,padding:"12px 20px",maxWidth:440,textAlign:"left"}}>
            <div style={{fontSize:11,color:C.textMuted,fontWeight:700,marginBottom:4}}>
              🔒 Global Lock สำหรับ Game {currentGame}
            </div>
            {globalLockedOur.size>0&&<div style={{fontSize:11,color:C.win}}>
              🛡️ <b>ทีมเรา</b> ห้าม Pick: {[...globalLockedOur].join(", ")}
            </div>}
            {globalLockedEnemy.size>0&&<div style={{fontSize:11,color:C.lose}}>
              ⚔️ <b>คู่แข่ง</b> ห้าม Pick: {[...globalLockedEnemy].join(", ")}
            </div>}
          </div>
        )}
      </div>
      <div style={{display:"flex",gap:20,marginTop:20}}>
        {[
          {side:"blue",color:C.blue,emoji:"🔵",label:"Blue Side",hint:"Ban ก่อน"},
          {side:"red", color:C.red, emoji:"🔴",label:"Red Side", hint:"Ban ทีหลัง"},
        ].map(opt=>(
          <button key={opt.side}
            onClick={()=>dispatch({type:"CHOOSE_SIDE",payload:opt.side})}
            style={{background:"transparent",border:`2px solid ${opt.color}`,
              borderRadius:16,padding:"24px 40px",cursor:"pointer",
              display:"flex",flexDirection:"column",alignItems:"center",gap:8}}
            onMouseEnter={e=>e.currentTarget.style.background=opt.color+"18"}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <span style={{fontSize:40}}>{opt.emoji}</span>
            <span style={{fontWeight:900,fontSize:16,color:opt.color}}>{opt.label}</span>
            <span style={{fontSize:10,color:C.textMuted}}>{opt.hint}</span>
          </button>
        ))}
      </div>
    </div>
  );

  // ── PLAYING ──
  if (stage==="playing") return (
    <>
    <div style={{padding:"10px 16px",display:"flex",flexDirection:"column",minHeight:"calc(100vh - 56px)",boxSizing:"border-box"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,flexWrap:"wrap"}}>
        <span style={{fontWeight:800,fontSize:14,color:C.primaryLight}}>{boType} vs {rivalName}</span>
        <div style={{display:"flex",gap:5}}>
          {Array.from({length:bo.total},(_,i)=>(
            <div key={i} style={{width:24,height:24,borderRadius:"50%",display:"flex",
              alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,
              background:i<completedGames.length
                ?completedGames[i].result==="WIN"?C.win+"30":C.lose+"30"
                :i===currentGame-1?C.primary+"30":"transparent",
              border:`2px solid ${i<completedGames.length
                ?completedGames[i].result==="WIN"?C.win:C.lose
                :i===currentGame-1?C.primary:C.border}`,
              color:i<completedGames.length
                ?completedGames[i].result==="WIN"?C.win:C.lose
                :i===currentGame-1?C.primary:C.textMuted}}>
              {i<completedGames.length?(completedGames[i].result==="WIN"?"W":"L"):i+1}
            </div>
          ))}
        </div>
        <span style={{fontSize:11,padding:"2px 10px",borderRadius:99,fontWeight:700,
          background:ourSide==="blue"?C.blue+"20":C.red+"20",
          color:ourSide==="blue"?C.blue:C.red}}>
          {ourSide==="blue"?"🔵 Blue":"🔴 Red"} Side
        </span>
        <div style={{marginLeft:"auto",display:"flex",gap:8}}>
          <button onClick={()=>{if(window.confirm("จบ session นี้เลยไหม?"))onFinishSession(completedGames);}}
            style={{background:"transparent",border:`1px solid ${C.win}60`,color:C.win,
              borderRadius:8,padding:"4px 12px",cursor:"pointer",fontSize:12,fontWeight:700}}>
            ✅ Finish
          </button>
          <button onClick={()=>{if(window.confirm("ยกเลิก session นี้?"))dispatch({type:"RESET"});}}
            style={{background:"transparent",border:`1px solid ${C.lose}40`,color:C.lose,
              borderRadius:8,padding:"4px 12px",cursor:"pointer",fontSize:12}}>
            ✕ ยกเลิก
          </button>
        </div>
      </div>

      {/* board */}
      <div style={{border:`2px solid ${C.border}`,borderRadius:14,overflow:"hidden",marginBottom:8,
        flex:1,display:"flex",flexDirection:"column",minHeight:0}}>
        <div style={{background:"#0d0b1e",padding:"8px 16px",display:"flex",alignItems:"center",
          gap:10,borderBottom:`1px solid ${C.border}`,flexWrap:"wrap"}}>
          <span style={{fontWeight:900,color:C.primaryLight,fontSize:14}}>{boType} — Game {currentGame}</span>
          <div style={{padding:"3px 12px",borderRadius:99,fontWeight:700,fontSize:11,
            background:phaseColor+"22",color:phaseColor,border:`1px solid ${phaseColor}50`}}>
            {phaseLabel}
          </div>
          <span style={{fontSize:10,padding:"2px 10px",borderRadius:99,fontWeight:700,
            background:ourSide==="blue"?C.blue+"20":C.red+"20",
            color:ourSide==="blue"?C.blue:C.red}}>
            {ourSide==="blue"?"🔵 Blue":"🔴 Red"}
          </span>
          {globalLockedOur.size>0&&(
            <div style={{fontSize:10,color:C.win,background:C.win+"15",padding:"2px 10px",
              borderRadius:99,border:`1px solid ${C.win}30`}}>
              🛡️ {[...globalLockedOur].join(", ")}
            </div>
          )}
          {globalLockedEnemy.size>0&&(
            <div style={{fontSize:10,color:C.lose,background:C.lose+"15",padding:"2px 10px",
              borderRadius:99,border:`1px solid ${C.lose}30`}}>
              ⚔️ {[...globalLockedEnemy].join(", ")}
            </div>
          )}
          <div style={{flex:1}}/>
          <button onClick={()=>dispatch({type:"UNDO"})} disabled={step===0}
            style={{background:C.bgCard,border:`1px solid ${C.border}`,
              color:step===0?"#3a3a5c":C.textMuted,borderRadius:7,padding:"4px 12px",
              cursor:step===0?"not-allowed":"pointer",fontSize:11,fontWeight:700}}>
            ↩ Undo
          </button>
        </div>

        <div style={{display:"flex",flex:1,minHeight:420}}>
          <TeamPanelR side="blue" isOurTeam={ourSide==="blue"}
            bans={blueBans} picks={bluePicks} cur={cur}
            roster={roster} enemyRoster={currentEnemyRoster}
            usedHeroNames={[...(ourSide==="blue" ? globalLockedOur : globalLockedEnemy)]}
            onPlayerChange={(i,v)=>dispatch({type:"SET_PLAYER",payload:{team:"blue",idx:i,playerName:v}})}
          />
          {/* center hero grid */}
          <div style={{flex:1,display:"flex",flexDirection:"column",padding:"10px 12px",overflowY:"auto",background:C.bgBase}}>
            <PhaseTracker step={step}/>

            {/* ── Draft Suggestion from history ── */}
            {cur && cur.action==="pick" && cur.team===ourSide && (() => {
              // collect enemy picks so far this game
              const enemyPicksSoFar = (ourSide==="blue" ? redPicks : bluePicks)
                .filter(s=>s.hero).map(s=>s.hero.name);
              if (!enemyPicksSoFar.length) return null;

              // find games where enemy picked similar heroes and we won
              const heroWinRate = {}; // { heroName: {wins, total} }
              allGames.forEach(g => {
                const ep = (g.enemyPicks||[]).filter(s=>s.hero?.name).map(s=>s.hero.name);
                const op = (g.ourPicks||[]).filter(s=>s.hero?.name).map(s=>s.hero.name);
                const overlap = enemyPicksSoFar.filter(h=>ep.includes(h));
                if (overlap.length === 0) return;
                const win = g.result==="WIN";
                op.forEach(h=>{
                  if (!heroWinRate[h]) heroWinRate[h] = {wins:0,total:0};
                  heroWinRate[h].total++;
                  if (win) heroWinRate[h].wins++;
                });
              });

              // เรียงตามความมั่นใจ (Wilson lower bound) ไม่ใช่ WR ดิบ: ฮีโร่ที่ชนะ 1/1 (100%) ต้องไม่ลอยเหนือ 8/10
              // และต้องมีอย่างน้อย 2 เกมถึงจะเสนอ — ข้อมูลนี้เป็นแค่ "ในเกมที่ศัตรูมีฮีโร่ซ้อน เราชนะเมื่อเลือกตัวนี้"
              // (ยังไม่ใช่ matchup จริง ฮีโร่ที่แข็งอยู่แล้วจะได้เปรียบโดยธรรมชาติ)
              const suggestions = Object.entries(heroWinRate)
                .filter(([,s])=>s.total>=2)
                .map(([name,s])=>({name,wins:s.wins,wr:Math.round(s.wins/s.total*100),total:s.total}))
                .sort(compareByConfidence)
                .slice(0,5);

              if (!suggestions.length) return null;

              return (
                <div style={{marginBottom:8,background:"#0d0b1e",borderRadius:10,
                  padding:"8px 12px",border:`1px solid ${C.primary}40`}}>
                  <div style={{fontSize:10,fontWeight:800,color:C.primaryLight,marginBottom:6}}>
                    💡 แนะนำ Pick — vs {enemyPicksSoFar.join(", ")}
                  </div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {suggestions.map(s=>(
                      <div key={s.name}
                        onClick={()=>{
                          const h=HERO_DATA.find(h=>h.name===s.name);
                          if(h&&!usedThisGame.has(s.name))selectHero(h);
                        }}
                        style={{display:"flex",alignItems:"center",gap:5,
                          background:!isLowSample(s.total)&&s.wr>=60?C.win+"20":s.wr>=50?C.primary+"20":C.border+"40",
                          border:`1px solid ${!isLowSample(s.total)&&s.wr>=60?C.win:s.wr>=50?C.primary:C.border}`,
                          borderRadius:8,padding:"4px 8px",cursor:"pointer"}}>
                        <HeroChip name={s.name} size={20} fontSize={11} bold={true}/>
                        <span style={{fontSize:10,fontWeight:800,
                          color:s.wr>=60?C.win:s.wr>=50?C.primaryLight:C.textMuted}}>
                          {s.wr}%
                        </span>
                        <span style={{fontSize:9,color:C.textMuted}}>({s.total}{isLowSample(s.total)?" · น้อย":""})</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div style={{display:"flex",gap:5,marginBottom:8,flexWrap:"wrap",alignItems:"center"}}>
              <input value={search}
                onChange={e=>dispatch({type:"SET_SEARCH",payload:e.target.value})}
                placeholder="🔍 Hero..."
                style={{...iStyle,width:140,padding:"5px 10px",fontSize:12}}/>
              {/* ── flat vs grouped-by-role view mode ── */}
              <div style={{display:"flex",gap:2,background:"#14112a",borderRadius:99,padding:2,border:`1px solid ${C.border}`}}>
                {[{id:"flat",label:"📋 ปกติ"},{id:"grouped",label:"🗂️ แยกตำแหน่ง"}].map(m=>(
                  <button key={m.id} onClick={()=>dispatch({type:"SET_HERO_VIEW_MODE",payload:m.id})}
                    style={{background:heroViewMode===m.id?C.primary:"transparent",
                      border:"none",color:heroViewMode===m.id?"#fff":C.textMuted,
                      borderRadius:99,padding:"3px 9px",fontSize:10,cursor:"pointer",fontWeight:700}}>
                    {m.label}
                  </button>
                ))}
              </div>
              {heroViewMode==="flat" && ROLES_FILTER.map(r=>(
                <button key={r} onClick={()=>dispatch({type:"SET_ROLE_FILTER",payload:r})} style={{
                  background:roleFilter===r?(ROLE_COLOR[r]||C.primary):"#14112a",
                  border:`1px solid ${roleFilter===r?(ROLE_COLOR[r]||C.primary):C.border}`,
                  color:roleFilter===r?"#fff":C.textMuted,
                  borderRadius:99,padding:"3px 9px",fontSize:10,cursor:"pointer",fontWeight:700}}>{r}</button>
              ))}
            </div>
            {(() => {
              // เก็บ markup การ์ดฮีโร่แต่ละใบไว้ในฟังก์ชันเดียว ใช้ร่วมกันได้
              // ทั้งโหมด "เรียงปกติ" (flat) และ "แยกตามตำแหน่ง" (grouped)
              // — เงื่อนไข used/global-lock/banned เหมือนกันทุกอย่าง ต่างแค่
              // จะเอาฮีโร่ตัวไหนมาวางตรงไหนเท่านั้น
              function renderHeroCard(hero) {
                const usedHere = usedThisGame.has(hero.name);
                const glLocked = isGlobalLocked(hero.name);
                const disabled = usedHere || glLocked;
                const isBanned = [...blueBans,...redBans].some(h=>h?.name===hero.name);
                const glBadgeColor = cur?.action==="pick"?(cur.team===ourSide?C.win:C.lose):C.primary;
                return (
                  <div key={hero.name}
                    onClick={()=>selectHero(hero)}
                    title={usedHere?"ใช้แล้ว":glLocked?"Global Lock":""}
                    style={{opacity:disabled?0.2:1,cursor:disabled?"not-allowed":"pointer",
                      transition:"transform .1s",position:"relative"}}
                    onMouseEnter={e=>{if(!disabled)e.currentTarget.style.transform="scale(1.08)";}}
                    onMouseLeave={e=>{e.currentTarget.style.transform="scale(1)";}}>
                    <HeroCard hero={hero} size={66} banned={isBanned}/>
                    {glLocked&&!usedHere&&(
                      <div style={{position:"absolute",top:2,left:2,background:glBadgeColor,
                        color:"#fff",fontSize:8,fontWeight:800,padding:"1px 4px",borderRadius:4}}>GL</div>
                    )}
                  </div>
                );
              }

              if (heroViewMode==="flat") {
                return (
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(66px,1fr))",gap:4,flex:1}}>
                    {filtered.map(renderHeroCard)}
                  </div>
                );
              }

              // ── โหมด "แยกตามตำแหน่ง" — โชว์ครบทุกตำแหน่ง เรียงเป็นหัวข้อ
              //    ตามด้วยฮีโร่ตำแหน่งนั้น (ฮีโร่ที่มีหลายตำแหน่งจะโผล่ซ้ำใน
              //    ทุกหัวข้อที่ตัวเองสังกัดอยู่ — ตรงกับตอนค้นหาจากตำแหน่งไหน
              //    ก็เจอ ไม่ใช่แค่ตำแหน่งหลัก) ยังกรองด้วยช่องค้นหาเหมือนกัน
              return (
                <div style={{flex:1,overflowY:"auto"}}>
                  {ROLES_FILTER.filter(r=>r!=="All").map(role=>{
                    const heroesInRole = HERO_DATA.filter(h=>
                      (h.roles||[h.role]).includes(role) &&
                      h.name.toLowerCase().includes(search.toLowerCase())
                    );
                    if (heroesInRole.length===0) return null;
                    return (
                      <div key={role} style={{marginBottom:10}}>
                        <div style={{fontSize:11,fontWeight:800,color:ROLE_COLOR[role]||C.primaryLight,
                          marginBottom:5,paddingBottom:3,borderBottom:`1px solid ${C.border}`}}>
                          {role} <span style={{color:C.textMuted,fontWeight:400}}>({heroesInRole.length})</span>
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(66px,1fr))",gap:4}}>
                          {heroesInRole.map(renderHeroCard)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
            <div style={{marginTop:6,display:"flex",gap:5,flexWrap:"wrap"}}>
              {DRAFT_ORDER.slice(step+1,step+4).map((s,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:4,background:C.bgPanel,
                  borderRadius:6,padding:"3px 8px",border:`1px solid ${C.border}`}}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:s.team==="blue"?C.blue:C.red}}/>
                  <span style={{fontSize:9,color:s.action==="ban"?C.ban:C.win,fontWeight:700}}>
                    {s.action==="ban"?"BAN":"PICK"}
                  </span>
                  <span style={{fontSize:9,color:s.team===ourSide?C.primaryLight:C.textMuted}}>
                    {s.team===ourSide?"เรา":"คู่แข่ง"}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <TeamPanelR side="red" isOurTeam={ourSide==="red"}
            bans={redBans} picks={redPicks} cur={cur}
            roster={roster} enemyRoster={currentEnemyRoster}
            usedHeroNames={[...(ourSide==="red" ? globalLockedOur : globalLockedEnemy)]}
            onPlayerChange={(i,v)=>dispatch({type:"SET_PLAYER",payload:{team:"red",idx:i,playerName:v}})}
          />
        </div>

        {/* meta bar */}
        <div style={{background:"#0d0b1e",borderTop:`1px solid ${C.border}`,padding:"10px 16px",
          display:"flex",gap:10,alignItems:"flex-end",flexWrap:"wrap"}}>
          {[
            {label:"ผล",key:"result",type:"select",opts:["WIN","LOSE"],w:88},
            {label:"คิลเรา",key:"ourScore",type:"number",placeholder:"0",w:75},
            {label:"คิลศัตรู",key:"enemyScore",type:"number",placeholder:"0",w:75},
            {label:"เวลา(นาที.วินาที)",key:"duration",type:"text",placeholder:"09.45",w:96},
          ].map(f=>(
            <div key={f.key}>
              <div style={{fontSize:10,color:C.textMuted,marginBottom:3}}>{f.label}</div>
              {f.type==="select"
                ?<select value={meta[f.key]}
                    onChange={e=>dispatch({type:"SET_META",payload:{[f.key]:e.target.value}})}
                    style={{...iStyle,width:f.w,padding:"5px 8px",fontSize:12,fontWeight:700,
                      color:meta[f.key]==="WIN"?C.win:C.lose}}>
                    {f.opts.map(o=><option key={o}>{o}</option>)}
                  </select>
                :<input type={f.type} inputMode={f.key==="duration"?"decimal":undefined}
                    placeholder={f.placeholder} value={meta[f.key]}
                    onChange={e=>dispatch({type:"SET_META",payload:{[f.key]:e.target.value}})}
                    onBlur={f.key==="duration" ? e=>dispatch({type:"SET_META",payload:{duration:normalizeDuration(e.target.value)}}) : undefined}
                    style={{...iStyle,width:f.w,padding:"5px 8px",fontSize:12}}/>
              }
            </div>
          ))}
          <div>
            <label style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color:C.textMuted,
              marginBottom:3,cursor:"pointer",userSelect:"none",whiteSpace:"nowrap"}}>
              <input type="checkbox" checked={meta.hasPause}
                onChange={e=>dispatch({type:"SET_META",payload:{hasPause:e.target.checked, ...(e.target.checked?{}:{pauseDuration:""})}})}/>
              ⏸️ มีหยุดเกม
            </label>
            {meta.hasPause && (
              <input type="text" inputMode="decimal" placeholder="00.00"
                title="เวลาที่หยุดเกมไปทั้งหมด (นาที.วินาที)"
                value={meta.pauseDuration}
                onChange={e=>dispatch({type:"SET_META",payload:{pauseDuration:e.target.value}})}
                onBlur={e=>dispatch({type:"SET_META",payload:{pauseDuration:normalizeDuration(e.target.value)}})}
                style={{...iStyle,width:96,padding:"5px 8px",fontSize:12}}/>
            )}
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:10,color:C.textMuted,marginBottom:3}}>Coach Notes</div>
            <input placeholder="วิเคราะห์เกมนี้..." value={meta.note}
              onChange={e=>dispatch({type:"SET_META",payload:{note:e.target.value}})}
              style={{...iStyle,padding:"5px 10px",fontSize:12}}/>
          </div>
          <button onClick={handleGameDone}
            style={{background:`linear-gradient(135deg,${C.primary},${C.primaryLight})`,
              color:"#fff",border:"none",borderRadius:8,padding:"8px 22px",
              cursor:"pointer",fontWeight:800,fontSize:13,whiteSpace:"nowrap"}}>
            ✅ บันทึก Game {currentGame}
          </button>
        </div>
      </div>
    </div>
    {pendingFinishGame && (
      <FinishMatchChoiceModal
        boType={boType}
        nextBoLabel={(BO_OPTIONS.find(b=>b.total===Math.min(7, bo.total+1))||BO_OPTIONS[BO_OPTIONS.length-1]).label}
        canAddExtra={bo.total < 7}
        onConfirmFinish={confirmFinishMatch}
        onAddExtraGame={confirmAddExtraGame}
        onCancel={()=>setPendingFinishGame(null)}
      />
    )}
    </>
  );

  // ── DONE ──
  const ourWins = completedGames.filter(g=>g.result==="WIN").length;
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      minHeight:"calc(100vh - 60px)",gap:16,background:C.bgBase}}>
      <div style={{fontSize:52}}>{ourWins>completedGames.length/2?"🏆":"😔"}</div>
      <h2 style={{margin:0,fontSize:22,fontWeight:800}}>{boType} เสร็จสิ้น: vs {rivalName}</h2>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"center"}}>
        {completedGames.map((g,i)=>(
          <span key={i} style={{padding:"5px 16px",borderRadius:99,fontWeight:800,
            background:g.result==="WIN"?C.win+"20":C.lose+"20",
            color:g.result==="WIN"?C.win:C.lose}}>
            G{i+1} {g.result}
          </span>
        ))}
      </div>
      <p style={{color:C.textMuted,fontSize:13,margin:0}}>บันทึกลง Match Log เรียบร้อย!</p>
      <button onClick={()=>dispatch({type:"RESET"})}
        style={{background:`linear-gradient(135deg,${C.primary},${C.primaryLight})`,
          color:"#fff",border:"none",borderRadius:10,padding:"12px 32px",
          fontWeight:800,fontSize:15,cursor:"pointer",marginTop:8}}>
        ⚔️ เริ่ม Session ใหม่
      </button>
    </div>
  );
}

// TeamPanel renamed to TeamPanelR (same logic, already stateless)
function TeamPanelR({ side, isOurTeam, bans, picks, cur, roster, enemyRoster=[], onPlayerChange, usedHeroNames=[] }) {
  const color       = side==="blue" ? C.blue : C.red;
  const isActive    = cur?.team===side;
  const isBanPhase  = cur?.action==="ban";
  const isPickPhase = cur?.action==="pick";
  const usedPlayers = new Set(picks.map(s=>s.player).filter(Boolean));
  // แปลงชื่อฮีโร่ (จาก globalLockedOur/Enemy — สะสมทั้ง series) เป็น hero
  // object จริงเพื่อโชว์เป็นรูปแทนที่จะเป็นแค่ข้อความ — ชื่อไหนหาไม่เจอใน
  // HERO_DATA (เช่น พิมพ์ผิดตอนกรอกในอดีต) ก็แค่ข้ามไป ไม่ error
  const usedHeroObjs = usedHeroNames.map(n=>HERO_DATA.find(h=>h.name===n)).filter(Boolean);

  return (
    <div style={{width:190,background:"#0e0b1e",
      borderRight:side==="blue"?`1px solid ${C.border}`:"none",
      borderLeft: side==="red" ?`1px solid ${C.border}`:"none",
      padding:"12px 10px",display:"flex",flexDirection:"column",gap:10,
      boxShadow:isActive?`inset 0 0 0 2px ${color}50`:"none",
      transition:"box-shadow .2s",overflowY:"auto"}}>
      <div style={{textAlign:"center"}}>
        <div style={{display:"inline-flex",alignItems:"center",gap:6}}>
          <div style={{width:10,height:10,borderRadius:"50%",background:color}}/>
          <span style={{fontWeight:900,fontSize:14,color,letterSpacing:1}}>
            {side==="blue"?"BLUE":"RED"}
          </span>
        </div>
        <div style={{marginTop:4}}>
          <span style={{fontSize:10,fontWeight:800,padding:"2px 10px",borderRadius:99,
            background:isOurTeam?C.win+"25":C.lose+"20",color:isOurTeam?C.win:C.lose,
            border:`1px solid ${isOurTeam?C.win+"60":C.lose+"50"}`}}>
            {isOurTeam?"🛡️ ทีมเรา":"⚔️ คู่แข่ง"}
          </span>
        </div>
        {isActive&&(
          <div style={{fontSize:10,color,background:color+"20",borderRadius:99,
            padding:"2px 8px",marginTop:4,fontWeight:700,display:"inline-block"}}>
            {isBanPhase?"🚫 กำลัง BAN":"⚔️ กำลัง PICK"}
          </div>
        )}
      </div>
      {usedHeroObjs.length>0 && (
        <div>
          <div style={{fontSize:9,color:C.textMuted,fontWeight:700,marginBottom:5,
            letterSpacing:0.5,textAlign:"center"}}>
            ใช้ไปแล้วทั้ง Series ({usedHeroObjs.length})
          </div>
          <div style={{display:"flex",gap:4,justifyContent:"center",flexWrap:"wrap"}}>
            {usedHeroObjs.map(h=>(
              <HeroCard key={h.name} hero={h} size={32} showName={false}/>
            ))}
          </div>
        </div>
      )}
      <div>
        <div style={{fontSize:10,color:C.ban,fontWeight:700,marginBottom:5,letterSpacing:1}}>— BAN —</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
          {bans.map((hero,i)=>{
            const isCur=isActive&&isBanPhase&&cur?.slot===i&&!hero;
            return (
              <div key={i} style={{borderRadius:8,overflow:"hidden",
                border:isCur?`2px solid ${C.ban}`:`2px solid ${C.border}`,
                background:C.bgPanel,height:60,display:"flex",alignItems:"center",justifyContent:"center",
                boxShadow:isCur?`0 0 10px ${C.ban}70`:"none"}}>
                {hero
                  ?<HeroCard hero={hero} size={56} banned showName={false}/>
                  :<span style={{fontSize:isCur?18:14,color:isCur?C.ban:"#2a1f4e"}}>{isCur?"🚫":"○"}</span>}
              </div>
            );
          })}
        </div>
      </div>
      <div style={{height:1,background:C.border}}/>
      <div style={{flex:1}}>
        <div style={{fontSize:10,color,fontWeight:700,marginBottom:5,letterSpacing:1}}>— PICKS —</div>
        <div style={{display:"flex",flexDirection:"column",gap:5}}>
          {picks.map((slot,i)=>{
            const isCur=isActive&&isPickPhase&&cur?.slot===i&&!slot.hero;
            const availableRoster = isOurTeam ? roster : enemyRoster;
            return (
              <div key={i} style={{display:"flex",alignItems:"center",gap:6,
                background:isCur?color+"12":C.bgPanel,borderRadius:10,padding:"4px 7px",
                border:isCur?`2px solid ${color}`:`2px solid ${C.border}`,
                boxShadow:isCur?`0 0 10px ${color}50`:"none",
                minHeight:55,transition:"all .2s"}}>
                {slot.hero ? (
                  <div style={{display:"flex",flexDirection:"column",gap:3,width:"100%"}}>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <HeroCard hero={slot.hero} size={40} showName={false}/>
                      <div>
                        <div style={{fontSize:12,fontWeight:800,lineHeight:1.2}}>{slot.hero.name}</div>
                        <div style={{fontSize:10,color:ROLE_COLOR[slot.hero.role],fontWeight:700}}>{slot.role}</div>
                      </div>
                    </div>
                    <select value={slot.player||""} onChange={e=>onPlayerChange(i,e.target.value)}
                      style={{...iStyle,fontSize:11,padding:"3px 6px",
                        color:slot.player?(isOurTeam?C.primaryLight:C.lose):C.textMuted}}>
                      <option value="">— เลือกผู้เล่น —</option>
                      {availableRoster.map(p=>(
                        <option key={p} value={p} disabled={usedPlayers.has(p)&&slot.player!==p}>
                          {p}{usedPlayers.has(p)&&slot.player!==p?" ✓":""}
                        </option>
                      ))}
                      {availableRoster.length===0&&(
                        <option disabled value="">ไม่มี Roster — เพิ่มใน Roster</option>
                      )}
                    </select>
                  </div>
                ) : (
                  <div style={{display:"flex",alignItems:"center",gap:8,width:"100%"}}>
                    <div style={{width:40,height:40,borderRadius:8,flexShrink:0,
                      border:`2px dashed ${isCur?color:C.border}`,
                      display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <span style={{fontSize:18,color:isCur?color:"#2a2550"}}>{isCur?"✛":"+"}</span>
                    </div>
                    <div>
                      <div style={{fontSize:11,color:isCur?color:"#3a3a5c",fontWeight:700}}>{slot.role}</div>
                      <div style={{fontSize:10,color:"#2a2550"}}>{isCur?"เลือก Hero":"รอ Pick"}</div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
