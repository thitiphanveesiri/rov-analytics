"use client";
import { matchTime, toDatetimeLocal, fromDatetimeLocal } from "@/lib/matchTime";
import { C } from "@/lib/theme";
import { HeroAvatar } from "@/components/shared/HeroImageManager";
import { LogoImg } from "@/components/shared/TeamLogo";
import { PlayerAvatar } from "@/components/shared/PlayerMedia";
import { ROLES_PICK } from "@/lib/heroes";
import { formatDurationDisplay } from "@/lib/duration";
import { useRef, useState } from "react";
import { useToast } from "@/lib/toast";
import { EditGameModal, UnifiedStatsEditor } from "@/components/matchlog/EditGameModal";
import { OBJ_DEFAULT, ObjectiveEditor } from "@/components/matchlog/objectives";
import { SingleGameDetail } from "@/components/matchlog/SingleGameDetail";


// ═══════════════════════════════════════════
//  MATCH CARD (Match Log page)
// ═══════════════════════════════════════════
// ═══════════════════════════════════════════
//  MATCH DRAFT SUMMARY — สรุปภาพรวม ban/pick ทุกเกมในแมตช์เดียว
//  แบบกราฟิกถ่ายทอดสด ดาวน์โหลดเป็นรูปแชร์ได้
// ═══════════════════════════════════════════
// แปลงข้อมูลเกมจาก Match Log (รูปแบบ our/enemy) ให้เป็น blue/red มาตรฐาน
function matchGameToBlueRed(game, ourTeamName, ourTeamLogo, rivalName, rivalLogo) {
  const isBlueOur = game.ourSide ? game.ourSide === "blue" : true;
  const ourWin = game.result === "WIN";
  return {
    blueTeamName:  isBlueOur ? ourTeamName : rivalName,
    blueTeamLogo:  isBlueOur ? ourTeamLogo : rivalLogo,
    blueTeamTag:   isBlueOur ? "our" : "enemy",
    blueBans:      isBlueOur ? (game.ourBans||[])  : (game.enemyBans||[]),
    bluePicks:     isBlueOur ? (game.ourPicks||[]) : (game.enemyPicks||[]),
    blueScore:     isBlueOur ? (game.ourScore??0)  : (game.enemyScore??0),
    blueWin:       isBlueOur ? ourWin : !ourWin,
    redTeamName:   isBlueOur ? rivalName : ourTeamName,
    redTeamLogo:   isBlueOur ? rivalLogo : ourTeamLogo,
    redTeamTag:    isBlueOur ? "enemy" : "our",
    redBans:       isBlueOur ? (game.enemyBans||[])  : (game.ourBans||[]),
    redPicks:      isBlueOur ? (game.enemyPicks||[]) : (game.ourPicks||[]),
    redScore:      isBlueOur ? (game.enemyScore??0)  : (game.ourScore??0),
    duration: game.duration,
  };
}

// แปลงข้อมูลเกมจาก Scout Log (รูปแบบ teamA/teamB) ให้เป็น blue/red มาตรฐาน
export function scoutGameToBlueRed(game, teamAName, teamALogo, teamBName, teamBLogo) {
  const aIsBlue = (game.sideA || "blue") === "blue";
  return {
    blueTeamName:  aIsBlue ? teamAName : teamBName,
    blueTeamLogo:  aIsBlue ? teamALogo : teamBLogo,
    blueTeamTag:   "our", // scout log ไม่มีแนวคิด "เรา" — ใช้สีกลางจาก HeroAvatar team prop
    blueBans:      aIsBlue ? (game.bansA||[])  : (game.bansB||[]),
    bluePicks:     aIsBlue ? (game.picksA||[]) : (game.picksB||[]),
    blueScore:     Number(aIsBlue ? game.killsA : game.killsB) || 0,
    redTeamName:   aIsBlue ? teamBName : teamAName,
    redTeamLogo:   aIsBlue ? teamBLogo : teamALogo,
    redTeamTag:    "enemy",
    redBans:       aIsBlue ? (game.bansB||[])  : (game.bansA||[]),
    redPicks:      aIsBlue ? (game.picksB||[]) : (game.picksA||[]),
    redScore:      Number(aIsBlue ? game.killsB : game.killsA) || 0,
    duration: game.duration,
  };
}

function GameSummaryRow({ bg, gameNo }) {
  const {
    blueTeamName, blueTeamLogo, blueTeamTag, blueBans, bluePicks, blueScore, blueWin,
    redTeamName, redTeamLogo, redTeamTag, redBans, redPicks, redScore,
    duration,
  } = bg;
  const redWin = blueWin===undefined ? undefined : !blueWin;
  // ฝั่งแดงเรียงจากขวาสุดไปซ้าย (สลับทิศจากฝั่งน้ำเงินที่เรียงซ้ายไปขวาปกติ)
  const redBansRTL  = [...redBans].reverse();
  const redPicksRTL = [...redPicks].reverse();

  return (
    <div style={{marginBottom:16,border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden",background:"#0a0a16"}}>
      {/* ── แถว Ban + ชื่อทีม + สกอร์ (Blue ซ้าย / Red ขวา เสมอ) ── */}
      <div style={{display:"flex",alignItems:"center",background:"#14112a"}}>
        <div style={{display:"flex",gap:3,padding:"6px 8px",flexShrink:0}}>
          {blueBans.map((b,i)=>(
            <div key={i} style={{width:30,height:30,borderRadius:5,overflow:"hidden",
              filter:b?.name?"grayscale(65%)":"none",opacity:b?.name?0.85:0.3,
              background:"#000",border:`1px solid ${C.border}`,flexShrink:0}}>
              {b?.name ? <HeroAvatar name={b.name} team={blueTeamTag} size={30}/> : (
                <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:14,color:C.textMuted}}>🚫</div>
              )}
            </div>
          ))}
        </div>
        <div style={{flex:1,textAlign:"center",fontWeight:900,fontSize:13,color:C.blue,
          letterSpacing:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",padding:"0 6px"}}>
          {blueTeamName}
        </div>
        <div style={{padding:"5px 12px",background:C.bgPanel,display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
          <LogoImg url={blueTeamLogo} name={blueTeamName} size={24}/>
          <span style={{fontWeight:900,fontSize:17,color:blueWin?C.win:"#fff"}}>{blueScore}</span>
          <span style={{color:C.textMuted,fontSize:11}}>vs</span>
          <span style={{fontWeight:900,fontSize:17,color:redWin?C.lose:"#fff"}}>{redScore}</span>
          <LogoImg url={redTeamLogo} name={redTeamName} size={24}/>
        </div>
        <div style={{flex:1,textAlign:"center",fontWeight:900,fontSize:13,color:C.red,
          letterSpacing:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",padding:"0 6px"}}>
          {redTeamName}
        </div>
        <div style={{display:"flex",gap:3,padding:"6px 8px",flexShrink:0}}>
          {redBansRTL.map((b,i)=>(
            <div key={i} style={{width:30,height:30,borderRadius:5,overflow:"hidden",
              filter:b?.name?"grayscale(65%)":"none",opacity:b?.name?0.85:0.3,
              background:"#000",border:`1px solid ${C.border}`,flexShrink:0}}>
              {b?.name ? <HeroAvatar name={b.name} team={redTeamTag} size={30}/> : (
                <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:14,color:C.textMuted}}>🚫</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── แถบ Game No. / เวลา ── */}
      <div style={{textAlign:"center",fontSize:10,color:C.textMuted,padding:"3px 0",
        background:"#0d0a1e",borderTop:`1px solid ${C.border}`,borderBottom:`1px solid ${C.border}`,
        letterSpacing:1,fontWeight:700}}>
        GAME {gameNo}{duration ? ` · ⏱ ${formatDurationDisplay(duration)}` : ""}
      </div>

      {/* ── แถว Pick (เรียงตามฝั่ง Blue ซ้าย / Red ขวา เสมอ) ── */}
      <div style={{display:"flex",fontSize:9,fontWeight:800,letterSpacing:1,textAlign:"center",background:"#0d0a1e"}}>
        <div style={{flex:1,padding:"2px 0",color:C.blue}}>🔵 BLUE ({blueTeamName})</div>
        <div style={{flex:1,padding:"2px 0",color:C.red}}>🔴 RED ({redTeamName})</div>
      </div>
      <div style={{display:"flex"}}>
        <div style={{flex:1,display:"flex"}}>
          {bluePicks.map((p,i)=>(
            <div key={i} style={{flex:1,aspectRatio:"1",position:"relative",borderRight:`1px solid ${C.border}`}}>
              {p?.hero?.name ? (
                <HeroAvatar name={p.hero.name} team={blueTeamTag} size={64} style={{width:"100%",height:"100%",borderRadius:0,border:"none"}}/>
              ) : <div style={{width:"100%",height:"100%",background:"#14112a"}}/>}
            </div>
          ))}
        </div>
        <div style={{flex:1,display:"flex"}}>
          {redPicksRTL.map((p,i)=>(
            <div key={i} style={{flex:1,aspectRatio:"1",position:"relative",borderLeft:i===0?`2px solid ${C.border}`:`1px solid ${C.border}`}}>
              {p?.hero?.name ? (
                <HeroAvatar name={p.hero.name} team={redTeamTag} size={64} style={{width:"100%",height:"100%",borderRadius:0,border:"none"}}/>
              ) : <div style={{width:"100%",height:"100%",background:"#14112a"}}/>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MatchDraftSummaryModal({ games, toBlueRed, teamAName, teamBName, onClose }) {
  const captureRef = useRef(null);
  const [downloading, setDownloading] = useState(false);
  const toast = useToast();

  async function downloadImage() {
    setDownloading(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(captureRef.current, {
        backgroundColor: "#0a0a16", scale: 2, useCORS: true,
      });
      const link = document.createElement("a");
      const safeName = (teamBName||"match").replace(/[^a-zA-Z0-9ก-๙]/g, "_");
      link.download = `draft-summary-vs-${safeName}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error("Export image failed:", err);
      toast("สร้างรูปไม่สำเร็จ ลองใหม่อีกครั้ง", "error");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:700,
      display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
      onClick={onClose}>
      <div onClick={e=>e.stopPropagation()}
        style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:16,padding:20,
          maxWidth:820,width:"100%",maxHeight:"90vh",display:"flex",flexDirection:"column"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
          <div style={{fontWeight:800,fontSize:15,color:C.primaryLight}}>
            📸 สรุปภาพรวม Draft — {teamAName} vs {teamBName}
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={downloadImage} disabled={downloading}
              style={{background:C.primary,color:"#fff",border:"none",borderRadius:8,
                padding:"8px 16px",cursor:downloading?"default":"pointer",fontWeight:700,fontSize:12,
                opacity:downloading?0.6:1}}>
              {downloading?"⏳ กำลังสร้างรูป...":"⬇️ ดาวน์โหลดรูป"}
            </button>
            <button onClick={onClose}
              style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textMuted,
                borderRadius:8,padding:"8px 16px",cursor:"pointer",fontWeight:700,fontSize:12}}>
              ✕ ปิด
            </button>
          </div>
        </div>
        <div style={{overflowY:"auto",paddingRight:4}}>
          <div ref={captureRef} style={{background:"#0a0a16",padding:12}}>
            {games.map((g,i)=>(
              <GameSummaryRow key={i} bg={toBlueRed(g)} gameNo={i+1}/>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function MatchCardWithStats({ m, onUpdateStats, onUpdateObjectives, onUpdateGameFull, onJumpToVideo, playerPhotos={}, onDelete, onEditMeta, roster=[], enemyRoster=[], videos=[], ourTeamName, ourTeamLogo, rivalLogo }) {
  const [open, setOpen] = useState(false);
  const isBO  = Array.isArray(m.games) && m.games.length > 0;
  const wins  = isBO ? m.games.filter(g=>g.result==="WIN").length : (m.result==="WIN"?1:0);
  const total = isBO ? m.games.length : 1;
  const bc    = wins > total/2 ? C.win : wins === total/2 ? "#fdcb6e" : C.lose;

  // single-game stats
  const [showStats, setShowStats] = useState(false);
  const [gameStats, setGameStats] = useState(m.gameStats || { our:{}, enemy:{} });
  const [saved,     setSaved]     = useState(false);
  const [showObj,   setShowObj]   = useState(false);
  const [objectives,setObjectives]= useState(m.objectives || OBJ_DEFAULT);
  const [objSaved,  setObjSaved]  = useState(false);
  const [editingGame,setEditingGame] = useState(false);
  const [showSummary,setShowSummary] = useState(false);

  function handleSaveObjectives() {
    onUpdateObjectives && onUpdateObjectives(m.id, null, objectives);
    setObjSaved(true);
    setTimeout(() => setObjSaved(false), 2000);
  }

  // ── Edit meta ──
  const [editing,   setEditing]   = useState(false);
  const [editRival, setEditRival] = useState(m.rivalName||"");
  const [editCat,   setEditCat]   = useState(m.category||"scrim");
  const [editNote,  setEditNote]  = useState(m.note||"");
  const initialPlayedLocal = toDatetimeLocal(matchTime(m));
  const [editPlayedAt, setEditPlayedAt] = useState(initialPlayedLocal);

  function handleSingleSave() {
    onUpdateStats && onUpdateStats(m.id, null, gameStats);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleSaveMeta() {
    onEditMeta && onEditMeta({ id:m.id, rivalName:editRival.trim()||m.rivalName, category:editCat, note:editNote,
      // ส่งเฉพาะเมื่อผู้ใช้แก้จริง — ไม่งั้นแมตช์เก่าจะถูกตีตราเวลาจากการปัดนาทีโดยไม่ตั้งใจ
      playedAt: editPlayedAt !== initialPlayedLocal ? fromDatetimeLocal(editPlayedAt) : undefined });
    setEditing(false);
  }

  return (
    <div style={{background:C.bgPanel,border:`1px solid ${bc}40`,borderRadius:14,
      marginBottom:12,overflow:"hidden",borderLeft:`4px solid ${bc}`}}>
      {/* Header row */}
      <div onClick={()=>setOpen(v=>!v)} style={{padding:"14px 20px",cursor:"pointer",
        display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        {isBO
          ? <span style={{padding:"3px 12px",borderRadius:99,fontSize:12,fontWeight:800,
              background:C.primary+"20",color:C.primaryLight}}>{m.boType||"BO?"}</span>
          : <span style={{padding:"3px 12px",borderRadius:99,fontSize:12,fontWeight:800,
              background:bc+"20",color:bc}}>{m.result}</span>
        }
        <span style={{fontWeight:800,fontSize:16,color:C.primaryLight}}>vs {m.rivalName}</span>
        {m.category==="tournament" && (
          <span style={{background:"#f9ca24"+"30",border:"1px solid #f9ca24"+"60",
            color:"#f9ca24",borderRadius:99,padding:"2px 10px",fontSize:10,fontWeight:800}}>
            🏆 แข่ง
          </span>
        )}
        {(!m.category||m.category==="scrim") && (
          <span style={{background:C.primary+"20",border:`1px solid ${C.primary}40`,
            color:C.textMuted,borderRadius:99,padding:"2px 10px",fontSize:10,fontWeight:700}}>
            🏋️ ซ้อม
          </span>
        )}
        {m.patch && (
          <span style={{background:"#0984e3"+"20",border:"1px solid #0984e3"+"50",
            color:"#74b9ff",borderRadius:99,padding:"2px 10px",fontSize:10,fontWeight:700}}>
            🗂️ {m.patch}
          </span>
        )}
        <span style={{fontSize:13,color:C.textMuted}}>{m.date}</span>
        {isBO && (
          <div style={{display:"flex",gap:5}}>
            {m.games.map((g,i)=>(
              <div key={i} style={{width:22,height:22,borderRadius:"50%",display:"flex",alignItems:"center",
                justifyContent:"center",fontSize:10,fontWeight:800,
                background:g.result==="WIN"?C.win+"30":C.lose+"30",
                color:g.result==="WIN"?C.win:C.lose}}>
                {g.result==="WIN"?"W":"L"}
              </div>
            ))}
          </div>
        )}
        {!isBO && m.ourSide && (
          <span style={{fontSize:11,fontWeight:700,padding:"2px 9px",borderRadius:99,
            background:m.ourSide==="blue"?C.blue+"20":C.red+"20",
            color:m.ourSide==="blue"?C.blue:C.red}}>
            {m.ourSide==="blue"?"🔵 Blue":"🔴 Red"} Side
          </span>
        )}
        <div style={{marginLeft:"auto",display:"flex",gap:12,alignItems:"center"}}>
          {!isBO && (
            <span style={{fontSize:13}}>
              <span style={{color:C.win,fontWeight:700}}>{m.ourScore}</span>
              <span style={{color:C.textMuted}}> : </span>
              <span style={{color:C.lose,fontWeight:700}}>{m.enemyScore}</span>
              <span style={{color:C.textMuted,fontSize:11}}> kills</span>
            </span>
          )}
          {isBO && <span style={{fontSize:12,color:bc,fontWeight:700}}>{wins}W – {total-wins}L</span>}
          {!isBO && m.videoId && videos.some(v=>String(v.id)===String(m.videoId)) && (
            <button onClick={e=>{ e.stopPropagation(); onJumpToVideo && onJumpToVideo(m.videoId); }}
              title="ดูวิดีโอที่ผูกไว้กับแมตช์นี้"
              style={{background:"transparent",border:`1px solid ${C.border}`,color:C.primaryLight,
                borderRadius:7,padding:"3px 10px",cursor:"pointer",fontSize:12,flexShrink:0}}>
              🎬
            </button>
          )}
          {isBO && m.games.some(g=>g.videoId) && (
            <button onClick={e=>{ e.stopPropagation(); setOpen(true); }}
              title="มีวิดีโอผูกไว้ในบางเกม — กดเพื่อดูรายละเอียด"
              style={{background:"transparent",border:`1px solid ${C.border}`,color:C.primaryLight,
                borderRadius:7,padding:"3px 10px",cursor:"pointer",fontSize:12,flexShrink:0}}>
              🎬
            </button>
          )}
          <button onClick={e=>{ e.stopPropagation(); setShowSummary(true); }}
            title="สรุปภาพรวม Draft ทุกเกม — ดาวน์โหลดเป็นรูปได้"
            style={{background:"transparent",border:`1px solid ${C.border}`,color:"#feca57",
              borderRadius:7,padding:"3px 10px",cursor:"pointer",fontSize:12,flexShrink:0}}>
            📸
          </button>
          {showSummary && (
            <MatchDraftSummaryModal
              games={Array.isArray(m.games) && m.games.length ? m.games : [m]}
              toBlueRed={g => matchGameToBlueRed(g, ourTeamName || "ทีมเรา", ourTeamLogo, m.rivalName, rivalLogo)}
              teamAName={ourTeamName || "ทีมเรา"}
              teamBName={m.rivalName}
              onClose={()=>setShowSummary(false)}
            />
          )}
          {onEditMeta && (
            <button onClick={e=>{ e.stopPropagation(); setEditing(v=>!v); }}
              style={{background:C.primary+"20",border:`1px solid ${C.primary}40`,color:C.primaryLight,
                borderRadius:7,padding:"3px 10px",cursor:"pointer",fontSize:11,fontWeight:700,flexShrink:0}}>
              ✏️ แก้ไข
            </button>
          )}
          {onDelete && (
            <button onClick={e=>{
              e.stopPropagation();
              if(window.confirm(`ลบแมตช์ vs ${m.rivalName} (${m.date}) ออกไหม?\nไม่สามารถย้อนคืนได้`))
                onDelete(m.id);
            }}
              style={{background:C.lose+"20",border:`1px solid ${C.lose}40`,color:C.lose,
                borderRadius:7,padding:"3px 10px",cursor:"pointer",fontSize:11,
                fontWeight:700,flexShrink:0}}>
              🗑️ ลบ
            </button>
          )}
          <span style={{color:C.textMuted,fontSize:14}}>{open?"▲":"▼"}</span>
        </div>
        {/* ── Edit Meta Panel ── */}
        {editing && (
          <div onClick={e=>e.stopPropagation()}
            style={{padding:"14px 20px",borderTop:`1px solid ${C.border}`,
              background:C.bgBase,display:"flex",flexWrap:"wrap",gap:12,alignItems:"flex-end"}}>
            <div>
              <div style={{fontSize:11,color:C.textMuted,marginBottom:4}}>ชื่อทีมคู่แข่ง</div>
              <input value={editRival} onChange={e=>setEditRival(e.target.value)}
                style={{background:C.bgPanel,border:`1px solid ${C.border}`,color:C.textMain,
                  borderRadius:7,padding:"6px 10px",fontSize:13,outline:"none",width:160}}/>
            </div>
            <div>
              <div style={{fontSize:11,color:C.textMuted,marginBottom:4}}>ประเภท</div>
              <div style={{display:"flex",gap:6}}>
                {[{id:"scrim",label:"🏋️ ซ้อม"},{id:"tournament",label:"🏆 แข่ง"}].map(c=>(
                  <button key={c.id} onClick={()=>setEditCat(c.id)}
                    style={{background:editCat===c.id?C.primary+"30":"transparent",
                      border:`2px solid ${editCat===c.id?C.primary:C.border}`,
                      color:editCat===c.id?C.primaryLight:C.textMuted,
                      borderRadius:7,padding:"5px 10px",cursor:"pointer",fontWeight:700,fontSize:11}}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div style={{fontSize:11,color:C.textMuted,marginBottom:4}}>วัน-เวลาที่แข่ง</div>
              <input type="datetime-local" value={editPlayedAt} max={toDatetimeLocal(Date.now())}
                onChange={e=>setEditPlayedAt(e.target.value)}
                style={{background:C.bgPanel,border:`1px solid ${C.border}`,color:C.textMain,
                  borderRadius:7,padding:"6px 10px",fontSize:16,outline:"none"}}/>
            </div>
            <div style={{flex:1,minWidth:160}}>
              <div style={{fontSize:11,color:C.textMuted,marginBottom:4}}>โน้ต</div>
              <input value={editNote} onChange={e=>setEditNote(e.target.value)}
                style={{background:C.bgPanel,border:`1px solid ${C.border}`,color:C.textMain,
                  borderRadius:7,padding:"6px 10px",fontSize:13,outline:"none",width:"100%",boxSizing:"border-box"}}/>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={handleSaveMeta}
                style={{background:`linear-gradient(135deg,${C.primary},${C.primaryLight})`,
                  color:"#fff",border:"none",borderRadius:8,padding:"7px 16px",
                  cursor:"pointer",fontWeight:800,fontSize:12}}>
                💾 บันทึก
              </button>
              <button onClick={()=>setEditing(false)}
                style={{background:"transparent",border:`1px solid ${C.border}`,
                  color:C.textMuted,borderRadius:8,padding:"7px 12px",cursor:"pointer",fontSize:12}}>
                ยกเลิก
              </button>
            </div>
          </div>
        )}
      </div>

      {open && (
        <div style={{padding:"0 16px 16px"}}>
          {isBO ? (
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {m.games.map((g,i)=>(
                <SingleGameDetail
                  key={i} g={g} gameNo={i+1}
                  onUpdateStats={(gameIdx, gs) => onUpdateStats(m.id, gameIdx, gs)}
                  onUpdateObjectives={(gameIdx, obj) => onUpdateObjectives(m.id, gameIdx, obj)}
                  onUpdateGameFull={(gameIdx, updates) => onUpdateGameFull && onUpdateGameFull(m.id, gameIdx, updates)}
                  onJumpToVideo={onJumpToVideo}
                  playerPhotos={playerPhotos} rivalName={m.rivalName}
                  roster={roster} enemyRoster={enemyRoster} videos={videos}
                />
              ))}
            </div>
          ) : (
            <div>
              {/* Bans */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
                {[
                  {label:"🚫 เราแบน",     bans:m.ourBans},
                  {label:"🚫 คู่แข่งแบน", bans:m.enemyBans},
                ].map(({label,bans})=>(
                  <div key={label} style={{background:C.bgCard,borderRadius:10,padding:"10px 14px"}}>
                    <div style={{fontSize:11,color:C.ban,fontWeight:700,marginBottom:8}}>{label}</div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      {(bans||[]).filter(Boolean).map((h,i)=>(
                        <span key={i} style={{background:C.ban+"12",color:`color-mix(in srgb, ${C.ban} 60%, white)`,fontSize:12,padding:"3px 10px",borderRadius:99}}>
                          {h.name||h}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {/* Picks */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
                {[
                  {label:"🛡️ ทีมเรา",  picks:m.ourPicks,   col:C.win},
                  {label:"⚔️ คู่แข่ง", picks:m.enemyPicks, col:C.lose},
                ].map(({label,picks,col})=>(
                  <div key={label} style={{background:C.bgCard,borderRadius:10,padding:"10px 14px"}}>
                    <div style={{fontSize:12,color:col,fontWeight:700,marginBottom:10}}>{label}</div>
                    {(picks||[]).map((slot,i)=>{
                      const isEnemySide = label.includes("คู่แข่ง");
                      const photoKey = slot.player
                        ? (isEnemySide ? `enemy:${m.rivalName}:${slot.player}` : `our:${slot.player}`)
                        : null;
                      return (
                        <div key={i} style={{display:"flex",gap:8,alignItems:"center",marginBottom:6}}>
                          {slot.player && (
                            <PlayerAvatar name={slot.player} photoUrl={playerPhotos[photoKey]} size={22}
                              team={isEnemySide?"enemy":"our"}/>
                          )}
                          <span style={{fontSize:11,color:C.primaryLight,width:55}}>{slot.role||ROLES_PICK[i]}</span>
                          <span style={{fontSize:13,fontWeight:700,flex:1}}>{slot.hero?.name||slot.hero||"-"}</span>
                          {slot.player && <span style={{fontSize:11,color:C.textMuted}}>{slot.player}</span>}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
              {m.note && (
                <div style={{background:C.primary+"15",border:`1px solid ${C.primary}40`,
                  borderRadius:8,padding:"10px 14px",fontSize:13,color:C.primaryLight,marginBottom:12}}>
                  📝 {m.note}
                </div>
              )}

              {/* Stats รวม */}
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,flexWrap:"wrap"}}>
                <button onClick={()=>setShowStats(v=>!v)} style={{
                  background:showStats?C.primary+"30":"transparent",
                  border:`1px solid ${showStats?C.primary:C.border}`,
                  color:showStats?C.primaryLight:C.textMuted,
                  borderRadius:7,padding:"4px 12px",cursor:"pointer",fontSize:11,fontWeight:700}}>
                  {showStats?"▲ ซ่อน Stats":"📊 Stats ทั้งทีม"}
                </button>
                {showStats && (
                  <button onClick={handleSingleSave} style={{
                    background:saved?C.win+"30":C.primary,color:"#fff",border:"none",
                    borderRadius:7,padding:"4px 14px",cursor:"pointer",fontSize:11,fontWeight:700}}>
                    {saved?"✅ บันทึกแล้ว!":"💾 บันทึก Stats"}
                  </button>
                )}
                <button onClick={()=>setShowObj(v=>!v)} style={{
                  background:showObj?C.primary+"30":"transparent",
                  border:`1px solid ${showObj?C.primary:C.border}`,
                  color:showObj?C.primaryLight:C.textMuted,
                  borderRadius:7,padding:"4px 12px",cursor:"pointer",fontSize:11,fontWeight:700}}>
                  {showObj?"▲ ซ่อน Objective":"🐉 Objective Control"}
                </button>
                {showObj && (
                  <button onClick={handleSaveObjectives} style={{
                    background:objSaved?C.win+"30":C.primary,color:"#fff",border:"none",
                    borderRadius:7,padding:"4px 14px",cursor:"pointer",fontSize:11,fontWeight:700}}>
                    {objSaved?"✅ บันทึกแล้ว!":"💾 บันทึก Objective"}
                  </button>
                )}
                {m.videoId && videos.some(v=>String(v.id)===String(m.videoId)) && (
                  <button onClick={()=>onJumpToVideo && onJumpToVideo(m.videoId)}
                    style={{background:"transparent",border:`1px solid ${C.border}`,color:C.primaryLight,
                      borderRadius:7,padding:"4px 12px",cursor:"pointer",fontSize:11,fontWeight:700}}>
                    🎬 ดูวิดีโอ
                  </button>
                )}
                <button onClick={()=>setEditingGame(true)}
                  style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textMuted,
                    borderRadius:7,padding:"4px 12px",cursor:"pointer",fontSize:11,fontWeight:700}}>
                  ✏️ แก้ไขข้อมูลเกม
                </button>
              </div>
              {editingGame && (
                <EditGameModal
                  game={m}
                  roster={roster}
                  enemyRoster={enemyRoster}
                  videos={videos}
                  onSave={updates => onUpdateGameFull && onUpdateGameFull(m.id, null, updates)}
                  onClose={()=>setEditingGame(false)}
                />
              )}
              {showObj && <ObjectiveEditor objectives={objectives} onChange={setObjectives}/>}
              {showStats && (
                <UnifiedStatsEditor
                  ourPicks={m.ourPicks}
                  enemyPicks={m.enemyPicks}
                  gameStats={gameStats}
                  onChangeStats={setGameStats}
                  ourScore={m.ourScore}
                  enemyScore={m.enemyScore}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
