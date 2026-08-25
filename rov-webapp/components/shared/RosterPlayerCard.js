"use client";
// components/shared/RosterPlayerCard.js
// ── Extracted from components/RovApp.js ──
// Two small, self-contained widgets grouped together: PatchSelector (the
// version dropdown used to filter analytics/matches by game patch) and
// RosterPlayerCard (the player card shown in the Roster page — photo,
// win/loss record, rename/remove). Neither depends on anything beyond
// what's already exported from HeroChip.js / PlayerMedia.js.

import { useState } from "react";
import { C, iStyle } from "@/lib/theme";
import { HeroChip } from "@/components/shared/HeroChip";
import { PhotoPicker } from "@/components/shared/PlayerMedia";

// ── same timezone-safe parser as filterMatchesByPatch in RovApp.js ──
// effectiveFrom is a bare "YYYY-MM-DD" string; new Date() on that parses
// as UTC midnight, not the team's local midnight — keeping this in sync
// so the dropdown's idea of "current" patch never disagrees with what
// the actual match filter treats as current.
function parsePatchEffectiveFrom(dateStr) {
  if (typeof dateStr !== "string") return new Date(dateStr);
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const [, y, mo, d] = m;
    return new Date(Number(y), Number(mo) - 1, Number(d));
  }
  return new Date(dateStr);
}

export function PatchSelector({ versions, value, onChange }) {
  if (!versions.length) return null; // ยังไม่มีใคร log patch ไว้เลย — ไม่ต้องโชว์ dropdown ให้งง
  const sorted = [...versions].sort((a,b) => parsePatchEffectiveFrom(b.effectiveFrom) - parsePatchEffectiveFrom(a.effectiveFrom)); // ใหม่→เก่า
  const current = sorted[0];
  return (
    <select value={value} onChange={e=>onChange(e.target.value)}
      style={{background:C.bgPanel,border:`1px solid ${C.border}`,color:C.textMain,
        borderRadius:8,padding:"6px 10px",fontSize:12,fontWeight:700,cursor:"pointer",flexShrink:0}}>
      <option value="current">🕐 ปัจจุบัน (v{current.version})</option>
      {sorted.slice(1).map(v=>(
        <option key={v.id} value={v.version}>v{v.version}</option>
      ))}
      <option value="all">📚 ทั้งหมด (all-time)</option>
    </select>
  );
}

// ═══════════════════════════════════════════
//  PLAYER PHOTO EDITING (RosterPlayerCard) — PlayerAvatar/PhotoPicker/
//  ImageCropModal it depends on now live in components/shared/PlayerMedia
// ═══════════════════════════════════════════

// ── Roster player card — คลิกเพื่อดู Profile ปกติ, กด ✏️ เพื่อแก้ชื่อ/รูป ──
export function RosterPlayerCard({ player, photoUrl, pg, pw, pwr, top, onSelect, onRemove, onRename, onSetPhoto, team="our" }) {
  const [editing, setEditing] = useState(false);
  const [nameVal, setNameVal] = useState(player);
  const [error,   setError]   = useState("");
  // ── hover state, managed by React (not direct DOM mutation) ──
  // Previously the hover effect set `.style.transform` imperatively via
  // onMouseEnter/onMouseLeave, bypassing React's own style reconciliation.
  // That leftover `transform` would silently survive a re-render into
  // "editing" mode (a totally different JSX branch that never mentions
  // transform at all) because React only clears style properties it
  // itself is tracking — it has no way to know about a value some other
  // code poked directly onto the DOM node. A stuck `transform` on this
  // card turns it into a CSS "containing block" for any `position:fixed`
  // descendant — including the crop modal opened by <PhotoPicker> right
  // below in the editing view — which is exactly what broke it (the
  // modal rendered squished/mispositioned instead of full-screen).
  // Driving the transform from state instead means React always knows
  // the correct value for every render, including "editing" mode (which
  // simply omits `transform` from its own style object, letting React
  // correctly clear it).
  const [hovered, setHovered] = useState(false);

  const isEnemy      = team === "enemy";
  const accentCol    = isEnemy ? C.lose : C.primaryLight;
  const borderHover  = isEnemy ? C.lose : C.primary;
  // pwr สำหรับ enemy นับเฉพาะตอน "ทีมเราแพ้" (ดู pw ที่ส่งเข้ามา) — pwr สูง
  // แปลว่าคู่แข่งเก่ง เลยกลับสีให้ตรงอารมณ์ (สูง=แดง/อันตราย, ต่ำ=เขียว/ok)
  const winStatCol   = isEnemy ? (pwr>=50?C.lose:C.win) : (pwr>=50?C.win:C.lose);

  function startEdit(e) {
    e.stopPropagation();
    setNameVal(player);
    setError("");
    setEditing(true);
  }

  function save(e) {
    e.stopPropagation();
    const trimmed = nameVal.trim();
    if (!trimmed) { setError("กรุณากรอกชื่อ"); return; }
    if (trimmed !== player) onRename(trimmed); // เปลี่ยนแค่ตอนชื่อจริงๆ เปลี่ยน — เลี่ยง dispatch เปล่าๆ
    setEditing(false);
  }

  if (editing) {
    return (
      <div onClick={e=>e.stopPropagation()}
        style={{background:C.bgPanel,border:`1px solid ${borderHover}`,borderRadius:16,
          padding:16,display:"flex",flexDirection:"column",alignItems:"center",gap:10}}>
        <PhotoPicker value={photoUrl} onChange={onSetPhoto} size={56} team={team}/>
        <div style={{width:"100%"}}>
          <input autoFocus value={nameVal} onChange={e=>{setNameVal(e.target.value);setError("");}}
            onKeyDown={e=>{ if(e.key==="Enter") save(e); if(e.key==="Escape") setEditing(false); }}
            style={{...iStyle,width:"100%",textAlign:"center"}}/>
          {error && <div style={{fontSize:11,color:C.lose,marginTop:4,textAlign:"center"}}>{error}</div>}
        </div>
        <div style={{display:"flex",gap:8,width:"100%"}}>
          <button onClick={save}
            style={{flex:1,background:C.win,color:"#fff",border:"none",borderRadius:8,
              padding:"8px 0",fontWeight:700,cursor:"pointer",fontSize:12}}>✓ บันทึก</button>
          <button onClick={e=>{e.stopPropagation();setEditing(false);}}
            style={{flex:1,background:"transparent",border:`1px solid ${C.border}`,color:C.textMuted,
              borderRadius:8,padding:"8px 0",fontWeight:700,cursor:"pointer",fontSize:12}}>ยกเลิก</button>
        </div>
      </div>
    );
  }

  return (
    <div onClick={onSelect}
      style={{background:C.bgPanel,border:`1px solid ${hovered?borderHover:C.border}`,borderRadius:16,
        overflow:"hidden",cursor:"pointer",display:"flex",flexDirection:"column",
        transform:hovered?"translateY(-3px)":"none",
        boxShadow:hovered?`0 8px 24px ${borderHover}25`:"none",
        transition:"transform 0.15s, box-shadow 0.15s, border-color 0.15s"}}
      onMouseEnter={()=>setHovered(true)}
      onMouseLeave={()=>setHovered(false)}>

      {/* ── Cover zone — full-bleed player photo, same treatment as
           TeamCard's logo cover (object-fit:cover, gradient placeholder
           with initials when no photo, name/info overlaid at the bottom
           via a dark gradient) instead of a small floating circular
           avatar. ── */}
      <div style={{position:"relative",height:150,overflow:"hidden",userSelect:"none"}}>
        {photoUrl
          ? <img src={photoUrl} alt={player}
              style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
          : <div style={{width:"100%",height:"100%",
              background:`linear-gradient(135deg,${accentCol}60,${C.primaryLight}30)`,
              display:"flex",alignItems:"center",justifyContent:"center"}}>
              <span style={{fontSize:48,fontWeight:900,color:"rgba(255,255,255,0.25)",
                letterSpacing:-2}}>
                {(player||"?").slice(0,2).toUpperCase()}
              </span>
            </div>
        }

        {/* Gradient overlay ด้านล่าง เพื่อให้ชื่อ/ฮีโร่อ่านออก */}
        <div style={{position:"absolute",bottom:0,left:0,right:0,
          background:"linear-gradient(to top,rgba(0,0,0,0.85) 0%,rgba(0,0,0,0.3) 60%,transparent 100%)",
          padding:"10px 12px 10px"}}>
          <div style={{fontWeight:900,fontSize:15,color:"#fff",
            lineHeight:1.2,textShadow:"0 1px 6px rgba(0,0,0,0.8)"}}>
            {player}
          </div>
          {top ? (
            <div style={{display:"flex",alignItems:"center",gap:5,marginTop:4}}>
              <HeroChip name={top[0]} size={16} fontSize={10} textCol="rgba(255,255,255,0.85)" accentCol={isEnemy?C.lose:undefined}/>
              <span style={{fontSize:9,color:"rgba(255,255,255,0.6)"}}>({top[1]} เกม)</span>
            </div>
          ) : (
            <div style={{fontSize:10,color:"rgba(255,255,255,0.5)",marginTop:4}}>ยังไม่มีข้อมูล</div>
          )}
        </div>

        {/* Win rate badge มุมขวาบน — ตำแหน่ง/สไตล์เดียวกับ TeamCard */}
        <div style={{position:"absolute",top:10,right:10,
          background:pg===0?"rgba(0,0,0,0.5)":winStatCol,
          color:"#fff",borderRadius:99,
          padding:"3px 10px",fontSize:11,fontWeight:900,
          backdropFilter:"blur(4px)"}}>
          {pg?`${pwr}%`:"—"}
        </div>
      </div>

      {/* ── Stats row ── */}
      <div style={{display:"flex",justifyContent:"center",gap:24,padding:"10px 10px 14px",
        borderTop:`1px solid ${C.border}`,borderBottom:`1px solid ${C.border}`}}>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:16,fontWeight:800}}>{pg}</div>
          <div style={{fontSize:9,color:C.textMuted}}>GAMES</div>
        </div>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:16,fontWeight:800,color:winStatCol}}>{pw}-{pg-pw}</div>
          <div style={{fontSize:9,color:C.textMuted}}>W-L</div>
        </div>
      </div>

      {/* ── Actions ── */}
      <div style={{display:"flex",gap:6,padding:"8px 10px"}}>
        <button onClick={startEdit} title="แก้ไขชื่อ/รูป"
          style={{flex:1,background:"transparent",color:accentCol,
            border:`1px solid ${accentCol}30`,borderRadius:7,
            padding:"6px 0",cursor:"pointer",fontSize:11,fontWeight:700}}>
          ✏️ แก้ไข
        </button>
        <button
          onClick={e=>{e.stopPropagation();onRemove();}}
          title="ลบผู้เล่นนี้"
          style={{flex:1,background:"transparent",color:C.lose,
            border:`1px solid ${C.lose}30`,borderRadius:7,
            padding:"6px 0",cursor:"pointer",fontSize:11,fontWeight:700}}>
          🗑️ ลบ
        </button>
      </div>
    </div>
  );
}
