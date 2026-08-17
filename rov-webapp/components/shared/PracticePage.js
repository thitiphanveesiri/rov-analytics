"use client";
// components/shared/PracticePage.js
// ── Extracted from components/RovApp.js ──
// Practice/homework assignment page ("การบ้านฝึกซ้อมรายบุคคล") — plain
// props + callbacks (onAdd/onToggle/onDelete), no dispatch/reducer access,
// same self-contained shape as SchedulePage. Only external dependency is
// PlayerAvatar, already exported from PlayerMedia.js.

import { useState } from "react";
import { C } from "@/lib/theme";
import { PlayerAvatar } from "@/components/shared/PlayerMedia";

export function PracticePage({ session, roster, playerPhotos, assignments, isCoach, onAdd, onToggle, onDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [player,   setPlayer]   = useState(roster[0]||"");
  const [title,    setTitle]    = useState("");
  const [note,     setNote]     = useState("");
  const [dueDate,  setDueDate]  = useState("");
  const [filter,   setFilter]   = useState("all"); // all | mine | pending | done

  const myPlayerName = session?.user?.playerName;

  function submit() {
    if (!title.trim() || !player) return;
    onAdd({ player, title: title.trim(), note: note.trim(), dueDate, createdBy: session?.user?.email || "" });
    setTitle(""); setNote(""); setDueDate("");
    setShowForm(false);
  }

  const canToggle = (a) => isCoach || (myPlayerName && a.player===myPlayerName);

  const filtered = (assignments||[]).filter(a=>{
    if (filter==="mine")    return myPlayerName && a.player===myPlayerName;
    if (filter==="pending") return !a.done;
    if (filter==="done")    return a.done;
    return true;
  });

  const grouped = {};
  filtered.forEach(a=>{ if (!grouped[a.player]) grouped[a.player]=[]; grouped[a.player].push(a); });

  return (
    <div style={{padding:"0 24px 40px",maxWidth:900,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10,marginBottom:16}}>
        <div>
          <h2 style={{margin:"0 0 6px",fontSize:24,fontWeight:800}}>🏋️ Practice Assignment</h2>
          <p style={{margin:0,color:C.textMuted,fontSize:13}}>การบ้านฝึกซ้อมรายบุคคล</p>
        </div>
        {isCoach && (
          <button onClick={()=>setShowForm(v=>!v)} style={{background:C.primary,color:"#fff",border:"none",
            borderRadius:9,padding:"9px 18px",cursor:"pointer",fontWeight:700,fontSize:13}}>
            {showForm?"✕ ยกเลิก":"+ มอบหมายการบ้าน"}
          </button>
        )}
      </div>

      {showForm && isCoach && (
        <div style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:14,padding:18,marginBottom:16}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10,marginBottom:10}}>
            <div>
              <div style={{fontSize:11,color:C.textMuted,marginBottom:5}}>ผู้เล่น</div>
              <select value={player} onChange={e=>setPlayer(e.target.value)}
                style={{width:"100%",boxSizing:"border-box",background:C.bgCard,border:`1px solid ${C.border}`,
                  color:C.textMain,borderRadius:8,padding:"8px 10px",fontSize:13,outline:"none"}}>
                {roster.map(r=><option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <div style={{fontSize:11,color:C.textMuted,marginBottom:5}}>กำหนดเสร็จ (ไม่บังคับ)</div>
              <input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}
                style={{width:"100%",boxSizing:"border-box",background:C.bgCard,border:`1px solid ${C.border}`,
                  color:C.textMain,borderRadius:8,padding:"8px 10px",fontSize:13,outline:"none"}}/>
            </div>
          </div>
          <div style={{marginBottom:10}}>
            <div style={{fontSize:11,color:C.textMuted,marginBottom:5}}>หัวข้อการบ้าน</div>
            <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="เช่น ฝึก Airi 10 เกม"
              style={{width:"100%",boxSizing:"border-box",background:C.bgCard,border:`1px solid ${C.border}`,
                color:C.textMain,borderRadius:8,padding:"8px 10px",fontSize:13,outline:"none"}}/>
          </div>
          <div style={{marginBottom:14}}>
            <div style={{fontSize:11,color:C.textMuted,marginBottom:5}}>รายละเอียดเพิ่มเติม (ไม่บังคับ)</div>
            <textarea value={note} onChange={e=>setNote(e.target.value)} rows={2}
              style={{width:"100%",boxSizing:"border-box",background:C.bgCard,border:`1px solid ${C.border}`,
                color:C.textMain,borderRadius:8,padding:"8px 10px",fontSize:13,outline:"none",resize:"vertical"}}/>
          </div>
          <button onClick={submit} disabled={!title.trim()}
            style={{background:title.trim()?C.primary:C.border,color:"#fff",border:"none",borderRadius:9,
              padding:"9px 20px",cursor:title.trim()?"pointer":"default",fontWeight:700,fontSize:13}}>
            ✅ มอบหมาย
          </button>
        </div>
      )}

      <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
        {[{id:"all",label:"ทั้งหมด"},{id:"mine",label:"ของฉัน"},{id:"pending",label:"ยังไม่เสร็จ"},{id:"done",label:"เสร็จแล้ว"}].map(f=>(
          <button key={f.id} onClick={()=>setFilter(f.id)}
            style={{background:filter===f.id?C.primary+"30":"transparent",
              border:`1px solid ${filter===f.id?C.primary:C.border}`,
              color:filter===f.id?C.primaryLight:C.textMuted,borderRadius:99,
              padding:"5px 14px",cursor:"pointer",fontSize:12,fontWeight:700}}>
            {f.label}
          </button>
        ))}
      </div>

      {Object.keys(grouped).length===0 ? (
        <div style={{textAlign:"center",padding:"40px 0",color:C.textMuted,fontSize:13}}>ยังไม่มีการบ้าน</div>
      ) : (
        Object.entries(grouped).map(([playerName, items])=>(
          <div key={playerName} style={{marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <PlayerAvatar name={playerName} photoUrl={playerPhotos?.[playerName]} size={28}/>
              <span style={{fontWeight:800,fontSize:13}}>{playerName}</span>
              <span style={{fontSize:11,color:C.textMuted}}>
                {items.filter(i=>i.done).length}/{items.length} เสร็จแล้ว
              </span>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {items.map(a=>(
                <div key={a.id} style={{display:"flex",alignItems:"flex-start",gap:10,
                  background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",
                  opacity:a.done?0.6:1}}>
                  <button onClick={()=>canToggle(a)&&onToggle(a.id)} disabled={!canToggle(a)}
                    style={{width:22,height:22,borderRadius:6,border:`2px solid ${a.done?C.win:C.border}`,
                      background:a.done?C.win:"transparent",cursor:canToggle(a)?"pointer":"default",
                      flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",
                      color:"#fff",fontSize:13,marginTop:1}}>
                    {a.done?"✓":""}
                  </button>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:13,textDecoration:a.done?"line-through":"none"}}>
                      {a.title}
                    </div>
                    {a.note && <div style={{fontSize:12,color:C.textMuted,marginTop:2}}>{a.note}</div>}
                    {a.dueDate && (
                      <div style={{fontSize:10,color:C.textMuted,marginTop:4}}>
                        📅 กำหนดเสร็จ {new Date(a.dueDate).toLocaleDateString("th-TH",{day:"numeric",month:"short",year:"numeric"})}
                      </div>
                    )}
                  </div>
                  {isCoach && (
                    <button onClick={()=>onDelete(a.id)} style={{background:"transparent",border:"none",
                      color:C.lose,cursor:"pointer",fontSize:14,padding:4,flexShrink:0}}>🗑️</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
