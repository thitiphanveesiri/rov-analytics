"use client";
import { C } from "@/lib/theme";
import { HeroChip } from "@/components/shared/HeroChip";
import { ROLES_PICK } from "@/lib/heroes";
import { useState } from "react";
import { BANS_PER_TEAM } from "@/components/draft/constants";


// ═══════════════════════════════════════════
//  RIVAL STATS SECTION (Rivals > Overview)
// ═══════════════════════════════════════════
// ═══════════════════════════════════════════
//  PICK / BAN ORDER FILTER
//  (ban slot index 0-3 = 1st-4th ban, pick slot index 0-4 = 1st-5th pick
//   ต่อทีม — ลำดับนี้ถูกบันทึกไว้แล้วตอน Draft เพราะแต่ละทีมจะ ban/pick
//   เรียงตาม slot 0→1→2... เสมอ)
// ═══════════════════════════════════════════
const PICK_BAN_FILTERS = [
  ...Array.from({length: BANS_PER_TEAM}, (_, i) => ({
    id:`ban${i}`, label:`🚫 Ban ที่ ${i+1}`, type:"ban", idx:i,
  })),
  ...Array.from({length: ROLES_PICK.length}, (_, i) => ({
    id:`pick${i}`, label:`🦸 Pick ที่ ${i+1}`, type:"pick", idx:i,
  })),
];

export function PickBanOrderPanel({ games, getBans, getPicks, getWon, title }) {
  const [filter, setFilter] = useState(null);
  const active = PICK_BAN_FILTERS.find(f=>f.id===filter);

  const rows = {};
  if (active) {
    games.forEach(g=>{
      let heroName = null;
      if (active.type==="ban") {
        const b = (getBans(g)||[])[active.idx];
        heroName = b?.name || (typeof b==="string" ? b : null);
      } else {
        const slot = (getPicks(g)||[])[active.idx];
        heroName = slot?.hero?.name || null;
      }
      if (!heroName) return;
      if (!rows[heroName]) rows[heroName] = { count:0, wins:0 };
      rows[heroName].count++;
      if (getWon(g)) rows[heroName].wins++;
    });
  }
  const arr = Object.entries(rows)
    .map(([hero,s]) => ({ hero, count:s.count, wr:Math.round(s.wins/s.count*100) }))
    .sort((a,b)=>b.count-a.count);

  return (
    <div style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 16px"}}>
      <div style={{fontWeight:700,fontSize:12,color:C.primaryLight,marginBottom:10}}>
        {title || "🎯 Pick / Ban ตามลำดับ"}
      </div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
        {PICK_BAN_FILTERS.map(f=>(
          <button key={f.id} onClick={()=>setFilter(filter===f.id?null:f.id)}
            style={{background:filter===f.id?(f.type==="ban"?C.ban:C.lose)+"30":"transparent",
              border:`1px solid ${filter===f.id?(f.type==="ban"?C.ban:C.lose):C.border}`,
              color:filter===f.id?(f.type==="ban"?C.ban:C.lose):C.textMuted,
              borderRadius:99,padding:"4px 12px",cursor:"pointer",fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>
            {f.label}
          </button>
        ))}
      </div>
      {!active ? (
        <div style={{textAlign:"center",padding:"16px 0",color:C.textMuted,fontSize:12}}>
          💡 เลือกลำดับด้านบน เพื่อดูว่ามักหยิบ/แบนฮีโร่ตัวไหนในจังหวะนั้น
        </div>
      ) : arr.length===0 ? (
        <div style={{textAlign:"center",padding:"16px 0",color:C.textMuted,fontSize:12}}>ยังไม่มีข้อมูล</div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:4}}>
          {arr.map((r,i)=>(
            <div key={r.hero} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
              padding:"6px 10px",background:i%2===0?"transparent":C.bgCard,borderRadius:7}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:10,color:C.textMuted,width:16}}>#{i+1}</span>
                <HeroChip name={r.hero} size={26} accentCol={active.type==="ban"?C.ban:C.lose} fontSize={12}/>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:10,color:C.textMuted}}>{r.count} ครั้ง</span>
                <span style={{fontSize:11,fontWeight:700,padding:"1px 8px",borderRadius:5,
                  background:r.wr>=50?C.lose+"20":C.win+"20",color:r.wr>=50?C.lose:C.win}}>
                  ชนะ {r.wr}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
