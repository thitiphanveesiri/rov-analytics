"use client";
import { C } from "@/lib/theme";
import { HERO_DATA } from "@/lib/heroes";
import { HeroChip } from "@/components/shared/HeroChip";
import { useState } from "react";


// ═══════════════════════════════════════════
//  PATCH & META TRACKER
// ═══════════════════════════════════════════
const TIER_CONFIG = [
  {id:"S+", col:"#ff6b6b"}, {id:"S", col:"#feca57"}, {id:"A", col:"#1dd1a1"},
  {id:"B", col:"#54a0ff"}, {id:"C", col:"#8395a7"},
];

export function PatchMetaCard({ patchInfo, heroTiers, onSavePatch, onSetTier, isCoach }) {
  const [editing, setEditing] = useState(false);
  const [version, setVersion] = useState(patchInfo?.version || "");
  const [notes,   setNotes]   = useState(patchInfo?.notes   || "");
  const [showTiers, setShowTiers] = useState(false);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(false);

  function save() {
    onSavePatch({ version: version.trim(), notes: notes.trim() });
    setEditing(false);
  }

  const filteredHeroes = HERO_DATA.filter(h =>
    h.name.toLowerCase().includes(search.toLowerCase())
  );

  const NOTES_PREVIEW_LEN = 220; // ยาวกว่านี้ค่อยตัดแล้วมีปุ่ม "ดูเพิ่มเติม"
  const notesText = patchInfo?.notes || "";
  const isLong = notesText.length > NOTES_PREVIEW_LEN;
  const displayedNotes = (!expanded && isLong) ? notesText.slice(0, NOTES_PREVIEW_LEN) + "..." : notesText;

  return (
    <div style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:14,padding:18,marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10}}>
        <div style={{flex:1,minWidth:220}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
            <span style={{fontWeight:800,fontSize:14,color:C.primaryLight}}>🗂️ Patch ปัจจุบัน</span>
            {patchInfo?.version && (
              <span style={{background:"#0984e3"+"20",border:"1px solid #0984e3"+"50",
                color:"#74b9ff",borderRadius:99,padding:"2px 10px",fontSize:11,fontWeight:700}}>
                {patchInfo.version}
              </span>
            )}
          </div>
          {!editing ? (
            <>
              <div style={{fontSize:12,color:C.textMuted,lineHeight:1.6,whiteSpace:"pre-wrap"}}>
                {displayedNotes || "ยังไม่ได้ใส่โน้ต patch — กด แก้ไข เพื่อบันทึกความเปลี่ยนแปลงของ patch นี้"}
              </div>
              {isLong && (
                <button onClick={()=>setExpanded(v=>!v)}
                  style={{background:"transparent",border:"none",color:C.primaryLight,
                    cursor:"pointer",fontSize:11,fontWeight:700,padding:"6px 0 0",textDecoration:"underline"}}>
                  {expanded ? "▲ ย่อกลับ" : "▼ ดูเพิ่มเติม (โน้ตยาว)"}
                </button>
              )}
            </>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:6}}>
              <input value={version} onChange={e=>setVersion(e.target.value)}
                placeholder="เช่น 1.52.2.9" style={{background:C.bgCard,border:`1px solid ${C.border}`,
                  color:C.textMain,borderRadius:7,padding:"6px 10px",fontSize:12,outline:"none",maxWidth:200}}/>
              <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3}
                placeholder="สรุป patch notes / meta ที่เปลี่ยนไป..."
                style={{background:C.bgCard,border:`1px solid ${C.border}`,color:C.textMain,
                  borderRadius:7,padding:"8px 10px",fontSize:12,outline:"none",resize:"vertical"}}/>
            </div>
          )}
          {patchInfo?.updatedAt && !editing && (
            <div style={{fontSize:10,color:C.textMuted,marginTop:6}}>
              อัปเดตล่าสุด {new Date(patchInfo.updatedAt).toLocaleString("th-TH")}
            </div>
          )}
        </div>
        <div style={{display:"flex",gap:8,flexShrink:0}}>
          {editing ? (
            <>
              <button onClick={save} style={{background:C.primary,color:"#fff",border:"none",
                borderRadius:7,padding:"6px 14px",cursor:"pointer",fontWeight:700,fontSize:11}}>💾 บันทึก</button>
              <button onClick={()=>setEditing(false)} style={{background:"transparent",
                border:`1px solid ${C.border}`,color:C.textMuted,borderRadius:7,padding:"6px 12px",
                cursor:"pointer",fontSize:11}}>ยกเลิก</button>
            </>
          ) : (
            isCoach && (
              <button onClick={()=>{setVersion(patchInfo?.version||"");setNotes(patchInfo?.notes||"");setEditing(true);}}
                style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textMuted,
                  borderRadius:7,padding:"6px 12px",cursor:"pointer",fontSize:11,fontWeight:700}}>
                ✏️ แก้ไข
              </button>
            )
          )}
        </div>
      </div>

      <div style={{marginTop:14,paddingTop:12,borderTop:`1px solid ${C.border}`}}>
        <button onClick={()=>setShowTiers(v=>!v)} style={{
          background:showTiers?C.primary+"30":"transparent",
          border:`1px solid ${showTiers?C.primary:C.border}`,color:showTiers?C.primaryLight:C.textMuted,
          borderRadius:7,padding:"5px 14px",cursor:"pointer",fontSize:11,fontWeight:700}}>
          {showTiers?"▲ ซ่อน Tier List":"🏆 Meta Tier List"}
        </button>

        {showTiers && (
          <div style={{marginTop:12}}>
            <input value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="ค้นหา hero..." style={{width:"100%",boxSizing:"border-box",
                background:C.bgCard,border:`1px solid ${C.border}`,color:C.textMain,
                borderRadius:7,padding:"6px 10px",fontSize:12,outline:"none",marginBottom:10}}/>
            <div style={{maxHeight:340,overflowY:"auto",display:"flex",flexDirection:"column",gap:4}}>
              {filteredHeroes.map(h=>{
                const tier = heroTiers?.[h.name];
                return (
                  <div key={h.name} style={{display:"flex",alignItems:"center",gap:8,
                    padding:"5px 8px",borderRadius:7,background:C.bgCard}}>
                    <HeroChip name={h.name} size={26} fontSize={12} bold={false}/>
                    <div style={{display:"flex",gap:4,marginLeft:"auto"}}>
                      {TIER_CONFIG.map(t=>(
                        <button key={t.id} disabled={!isCoach}
                          onClick={()=>isCoach && onSetTier(h.name, tier===t.id?null:t.id)}
                          title={isCoach?undefined:"เฉพาะโค้ช/แอดมินที่ตั้งค่า Tier List ได้"}
                          style={{width:26,height:22,borderRadius:5,cursor:isCoach?"pointer":"not-allowed",
                            fontSize:10,fontWeight:800,opacity:isCoach?1:0.5,
                            background:tier===t.id?t.col:"transparent",
                            border:`1px solid ${tier===t.id?t.col:C.border}`,
                            color:tier===t.id?"#1a1a2e":C.textMuted}}>
                          {t.id}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
              {filteredHeroes.length===0 && (
                <div style={{textAlign:"center",color:C.textMuted,fontSize:12,padding:16}}>ไม่พบ hero</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
