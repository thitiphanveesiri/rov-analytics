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
import { PlayerAvatar, PhotoPicker } from "@/components/shared/PlayerMedia";

export function PatchSelector({ versions, value, onChange }) {
  if (!versions.length) return null; // ยังไม่มีใคร log patch ไว้เลย — ไม่ต้องโชว์ dropdown ให้งง
  const sorted = [...versions].sort((a,b) => new Date(b.effectiveFrom) - new Date(a.effectiveFrom)); // ใหม่→เก่า
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
        style={{background:C.bgPanel,border:`1px solid ${borderHover}`,borderRadius:12,
          padding:"14px 20px",display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
        <PhotoPicker value={photoUrl} onChange={onSetPhoto} size={48} team={team}/>
        <div style={{flex:1,minWidth:160}}>
          <input autoFocus value={nameVal} onChange={e=>{setNameVal(e.target.value);setError("");}}
            onKeyDown={e=>{ if(e.key==="Enter") save(e); if(e.key==="Escape") setEditing(false); }}
            style={{...iStyle,width:"100%"}}/>
          {error && <div style={{fontSize:11,color:C.lose,marginTop:4}}>{error}</div>}
        </div>
        <button onClick={save}
          style={{background:C.win,color:"#fff",border:"none",borderRadius:8,
            padding:"8px 16px",fontWeight:700,cursor:"pointer",fontSize:12}}>✓ บันทึก</button>
        <button onClick={e=>{e.stopPropagation();setEditing(false);}}
          style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textMuted,
            borderRadius:8,padding:"8px 14px",fontWeight:700,cursor:"pointer",fontSize:12}}>ยกเลิก</button>
      </div>
    );
  }

  return (
    <div onClick={onSelect}
      style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:12,
        padding:"14px 20px",display:"flex",alignItems:"center",
        justifyContent:"space-between",cursor:"pointer"}}
      onMouseEnter={e=>e.currentTarget.style.borderColor=borderHover}
      onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
      <div style={{display:"flex",alignItems:"center",gap:14}}>
        <PlayerAvatar name={player} photoUrl={photoUrl} size={48} team={team}/>
        <div>
          <div style={{fontWeight:800,fontSize:16}}>{player}</div>
          {top ? (
            <div style={{display:"flex",alignItems:"center",gap:5,marginTop:4}}>
              <span style={{fontSize:11,color:C.textMuted}}>Main:</span>
              <HeroChip name={top[0]} size={18} fontSize={11} accentCol={isEnemy?C.lose:undefined}/>
              <span style={{fontSize:10,color:C.textMuted}}>({top[1]} เกม)</span>
            </div>
          ) : (
            <div style={{fontSize:12,color:C.textMuted,marginTop:3}}>ยังไม่มีข้อมูล</div>
          )}
        </div>
      </div>
      <div style={{display:"flex",gap:14,alignItems:"center"}}>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:18,fontWeight:800}}>{pg}</div>
          <div style={{fontSize:10,color:C.textMuted}}>GAMES</div>
        </div>
        <div style={{textAlign:"center",minWidth:52}}>
          <div style={{fontSize:18,fontWeight:800,color:winStatCol}}>
            {pg?`${pwr}%`:"-"}</div>
          <div style={{fontSize:10,color:C.textMuted}}>{pw}W-{pg-pw}L</div>
        </div>
        <span style={{fontSize:12,color:accentCol}}>ดู Profile →</span>
        <button onClick={startEdit} title="แก้ไขชื่อ/รูป"
          style={{background:accentCol+"20",color:accentCol,border:"none",
            width:34,height:34,borderRadius:8,cursor:"pointer",fontSize:14}}>✏️</button>
        <button
          onClick={e=>{e.stopPropagation();onRemove();}}
          style={{background:C.lose+"20",color:C.lose,border:"none",
            width:34,height:34,borderRadius:8,cursor:"pointer",fontSize:14}}>🗑️</button>
      </div>
    </div>
  );
}
