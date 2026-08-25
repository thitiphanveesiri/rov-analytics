"use client";
// components/shared/TeamCard.js
// ── Extracted & generalized from the Rival page's team grid in RovApp.js ──
// That page already had exactly the card style requested (big logo cover,
// gradient name overlay, "X session · Y เกม" subtitle, win-rate badge,
// change-logo / delete-team buttons) — this file pulls it out into a
// reusable component so the same look can be used on the Roster page too
// (both for the rival-team picker and for "ทีมเรา" itself), instead of
// duplicating ~90 lines of JSX in three places.
//
// The actual crop+upload flow stays OUTSIDE this component (same as
// before) — this just fires `onPickLogoFile(file)` when someone picks a
// file, and the parent page owns the crop modal / upload / dispatch,
// exactly like the original Rival page did with `cropRivalLogo` state.

import { useState } from "react";
import { C } from "@/lib/theme";

export function TeamCard({
  name,
  logoUrl,
  sessionCount,
  gameCount,
  winRatePct = null,        // null/undefined → badge hidden entirely (e.g. "ทีมเรา" may not want a win-rate badge on its own card)
  onClick,
  onPickLogoFile,           // (file) => void — parent handles crop/upload; omit to hide the change-logo control even for a coach
  onDelete,                 // () => void — omit entirely to hide the delete button (e.g. "ทีมเรา" can't delete itself)
  isCoach,
  accentColor = C.lose,     // red-ish for rivals by default; pass C.primary for "our team"
  deleteLabel = "🗑️ ลบทีมนี้",
  deleteConfirmMessage,
}) {
  // ── hover state managed by React, not direct DOM mutation ──
  // Same fix as RosterPlayerCard: setting `.style.transform` imperatively
  // in onMouseEnter/onMouseLeave bypasses React's style reconciliation, so
  // a stale `transform` can survive into a differently-shaped re-render
  // and accidentally turn this card into a CSS containing block for any
  // `position:fixed` descendant. Driving it from state means React always
  // renders the correct value, every time, no matter what else changes.
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{borderRadius:16,overflow:"hidden",
        border:`1px solid ${C.border}`,
        transform:hovered?"translateY(-3px)":"none",
        boxShadow:hovered?`0 8px 28px ${accentColor}30`:"none",
        transition:"transform 0.15s, box-shadow 0.15s"}}
      onMouseEnter={()=>setHovered(true)}
      onMouseLeave={()=>setHovered(false)}>

      {/* ── COVER ZONE — คลิกเข้าหน้า detail ── */}
      <div onClick={onClick}
        style={{cursor:onClick?"pointer":"default",position:"relative",
          height:180,overflow:"hidden",userSelect:"none"}}>

        {/* Background: logo เต็มกรอบ */}
        {logoUrl
          ? <img src={logoUrl} alt={name}
              style={{width:"100%",height:"100%",objectFit:"cover",
                display:"block",filter:"brightness(0.75)"}}/>
          : <div style={{width:"100%",height:"100%",
              background:`linear-gradient(135deg,${accentColor}60,${C.primaryLight}30)`,
              display:"flex",alignItems:"center",justifyContent:"center"}}>
              <span style={{fontSize:56,fontWeight:900,color:"rgba(255,255,255,0.25)",
                letterSpacing:-2}}>
                {(name||"?").slice(0,2).toUpperCase()}
              </span>
            </div>
        }

        {/* Gradient overlay ด้านล่าง เพื่อให้ชื่ออ่านออก */}
        <div style={{position:"absolute",bottom:0,left:0,right:0,
          background:"linear-gradient(to top,rgba(0,0,0,0.85) 0%,rgba(0,0,0,0.3) 60%,transparent 100%)",
          padding:"12px 12px 12px"
        }}>
          <div style={{fontWeight:900,fontSize:15,color:"#fff",
            lineHeight:1.2,textShadow:"0 1px 6px rgba(0,0,0,0.8)"}}>
            {name}
          </div>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.65)",marginTop:2}}>
            {sessionCount} session · {gameCount} เกม
          </div>
        </div>

        {/* Win rate badge มุมขวาบน — ซ่อนถ้าไม่ส่ง winRatePct มา */}
        {winRatePct !== null && (
          <div style={{position:"absolute",top:10,right:10,
            background:gameCount===0?"rgba(0,0,0,0.5)":winRatePct>=50?"rgba(0,184,148,0.85)":"rgba(253,121,168,0.85)",
            color:"#fff",borderRadius:99,
            padding:"3px 10px",fontSize:11,fontWeight:900,
            backdropFilter:"blur(4px)"}}>
            {gameCount===0?"—":`${winRatePct}%`}
          </div>
        )}
      </div>

      {/* ── BOTTOM: actions ── */}
      {(onPickLogoFile || onDelete) && (
        <div style={{background:C.bgPanel,padding:"8px 10px",
          display:"flex",flexDirection:"column",gap:5}}>
          {isCoach && onPickLogoFile && (
            <div onClick={e=>e.stopPropagation()}>
              <label style={{display:"flex",alignItems:"center",gap:6,
                cursor:"pointer",background:C.primary+"15",
                border:`1px solid ${C.primary}30`,borderRadius:7,
                padding:"5px 10px",fontSize:10,fontWeight:700,color:C.primaryLight}}>
                📸 {logoUrl?"เปลี่ยนโลโก้":"อัพโหลดโลโก้"}
                <input type="file" accept="image/*"
                  style={{display:"none"}}
                  onChange={e=>{
                    const file=e.target.files?.[0];
                    if(!file) return;
                    onPickLogoFile(file);
                    e.target.value="";
                  }}/>
              </label>
            </div>
          )}
          {isCoach && onDelete && (
            <button
              onClick={e=>{
                e.stopPropagation();
                if(window.confirm(deleteConfirmMessage || `ลบทีม "${name}" ออก?`))
                  onDelete();
              }}
              style={{width:"100%",background:"transparent",
                border:`1px solid ${C.lose}25`,color:C.lose,
                borderRadius:7,padding:"4px 0",cursor:"pointer",
                fontSize:10,fontWeight:700,opacity:0.55}}>
              {deleteLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
