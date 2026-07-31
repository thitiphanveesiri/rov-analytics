"use client";
// components/shared/HeroChip.js
// ── Extracted from components/RovApp.js ──
// Small shared hero-display components, moved verbatim (no logic changes).
// Both were already grouped under a "SMALL SHARED COMPONENTS" comment in
// the original file, so splitting them out together keeps that grouping.

import { useState } from "react";
import { HERO_DATA, ROLE_COLOR, useHeroImage } from "@/lib/heroes";
import { C } from "@/lib/theme";

// ── HeroCard: big square card with name banner (Hero Pool grid, draft grid) ──
export function HeroCard({hero, size=72, banned=false, showName=true}) {
  const [err,setErr] = useState(false);
  const col = ROLE_COLOR[hero?.role]||"#a29bfe";
  const imgUrl = useHeroImage(hero);
  return (
    <div style={{position:"relative",width:size,height:size,borderRadius:8,overflow:"hidden",
      background:col+"22",border:`1.5px solid ${col}44`,flexShrink:0}}>
      {imgUrl && !err
        ? <img src={imgUrl}
            onError={()=>setErr(true)} alt={hero.name}
            style={{width:"100%",height:"100%",objectFit:"cover"}}/>
        : <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <span style={{fontSize:size*0.38,fontWeight:900,color:col}}>{hero.name.charAt(0)}</span>
          </div>
      }
      <div style={{position:"absolute",top:3,right:3,width:7,height:7,borderRadius:"50%",background:col}}/>
      {showName && <div style={{position:"absolute",bottom:0,left:0,right:0,
        background:"linear-gradient(transparent,rgba(0,0,0,0.88))",padding:"10px 3px 3px",textAlign:"center"}}>
        <div style={{fontSize:Math.max(8,size*0.135),color:"#fff",fontWeight:700,lineHeight:1.1,
          overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{hero.name}</div>
      </div>}
      {banned && <div style={{position:"absolute",inset:0,background:"rgba(255,71,87,0.65)",
        display:"flex",alignItems:"center",justifyContent:"center"}}>
        <span style={{fontSize:size*0.45,fontWeight:900,color:"#fff"}}>✕</span>
      </div>}
    </div>
  );
}

// ── HeroChip: lookup hero by name string, show small image + name inline ──
// Used anywhere a hero name list/badge is rendered (Hero Pool, Synergy/Counter, etc.)
export function HeroChip({ name, size=24, accentCol, textCol, bold=true, fontSize=13 }) {
  const [err, setErr] = useState(false);
  const hero  = HERO_DATA.find(h=>h.name===name);
  const col   = accentCol || ROLE_COLOR[hero?.role] || C.primaryLight;
  const imgUrl = useHeroImage(hero);
  return (
    <div style={{display:"inline-flex",alignItems:"center",gap:6,minWidth:0}}>
      <div style={{position:"relative",width:size,height:size,borderRadius:6,overflow:"hidden",
        background:col+"22",border:`1.5px solid ${col}44`,flexShrink:0}}>
        {hero && imgUrl && !err ? (
          <img src={imgUrl}
            onError={()=>setErr(true)} alt={name}
            style={{width:"100%",height:"100%",objectFit:"cover"}}/>
        ) : (
          <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <span style={{fontSize:size*0.42,fontWeight:900,color:col}}>{(name||"?").charAt(0)}</span>
          </div>
        )}
      </div>
      <span style={{fontWeight:bold?700:400,fontSize,color:textCol||"inherit",
        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</span>
    </div>
  );
}
