"use client";
// components/shared/SchedulePage.js
// ── Extracted from components/RovApp.js ──
// The "ตารางแข่ง" (Schedule) page — self-contained: takes plain data +
// callback props (onAdd/onUpdate/onDelete), no direct dispatch/reducer
// access, so it lifts out cleanly. Good pairing with the already-extracted
// GoogleCalendarConnect / ScheduleReminder / YoutubeAutoImport, which all
// live on or near this same page.

import { useState } from "react";
import { C } from "@/lib/theme";
import { useToast } from "@/lib/toast";
import { LogoImg } from "@/components/shared/TeamLogo";

export function SchedulePage({ schedules=[], rivals=[], matches=[], isCoach, onAdd, onUpdate, onDelete }) {
  const [showForm,   setShowForm]   = useState(false);
  const [editId,     setEditId]     = useState(null);
  const [form,       setForm]       = useState({ date:"", time:"", rival:"", tournament:"", note:"", category:"tournament" });
  const [filter,     setFilter]     = useState("upcoming"); // "upcoming" | "all" | "past"
  const toast = useToast();

  const now = new Date();

  function openAdd() {
    // default date = วันนี้
    const today = new Date().toISOString().slice(0,10);
    setForm({ date:today, time:"18:00", rival:"", tournament:"", note:"", category:"tournament" });
    setEditId(null); setShowForm(true);
  }

  function openEdit(s) {
    setForm({ date:s.date||"", time:s.time||"", rival:s.rival||"",
      tournament:s.tournament||"", note:s.note||"", category:s.category||"tournament" });
    setEditId(s.id); setShowForm(true);
  }

  function handleSave() {
    if (!form.date) { toast("กรุณาเลือกวันที่", "error"); return; }
    if (!form.rival.trim()) { toast("กรุณาระบุทีมคู่แข่ง", "error"); return; }
    if (editId) {
      onUpdate({ id:editId, ...form });
      toast("แก้ไขตารางสำเร็จ ✅", "success");
    } else {
      onAdd(form);
      toast("เพิ่มตารางแข่งสำเร็จ 📅", "success");
    }
    setShowForm(false);
  }

  // กรอง schedule
  const filtered = (schedules||[]).filter(s => {
    const d = new Date(s.date+"T"+(s.time||"00:00"));
    if (filter==="upcoming") return d >= now;
    if (filter==="past")     return d < now;
    return true;
  });

  // หาว่า schedule นี้มี match ที่บันทึกไว้แล้วไหม
  const linkedMatch = (s) => matches.find(m =>
    m.rivalName===s.rival &&
    m.date === new Date(s.date).toLocaleDateString("th-TH",{day:"numeric",month:"short",year:"numeric"})
  );

  // สี category
  const catColor = { tournament:"#f9ca24", scrim:C.primaryLight };
  const catLabel = { tournament:"🏆 แข่ง", scrim:"🏋️ ซ้อม" };

  // นับวันถึง match
  function daysUntil(dateStr, timeStr) {
    const target = new Date(dateStr+"T"+(timeStr||"00:00"));
    const diff = Math.ceil((target - now) / (1000*60*60*24));
    if (diff < 0) return null;
    if (diff === 0) return "วันนี้! 🔥";
    if (diff === 1) return "พรุ่งนี้ ⚡";
    return `อีก ${diff} วัน`;
  }

  return (
    <div style={{padding:"0 24px 40px",maxWidth:900,margin:"0 auto"}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
        <div>
          <h2 style={{margin:"0 0 6px",fontSize:24,fontWeight:800}}>📅 ตารางแข่ง</h2>
          <p style={{margin:0,color:C.textMuted,fontSize:13}}>
            วางแผนตารางซ้อมและแข่งขัน · เชื่อมกับ Match Log อัตโนมัติ
          </p>
        </div>
        {isCoach && (
          <button onClick={openAdd}
            style={{background:`linear-gradient(135deg,${C.primary},${C.primaryLight})`,
              color:"#fff",border:"none",borderRadius:10,padding:"10px 18px",
              cursor:"pointer",fontWeight:800,fontSize:13,whiteSpace:"nowrap"}}>
            + เพิ่มตาราง
          </button>
        )}
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div style={{background:C.bgPanel,border:`2px solid ${C.primary}40`,
          borderRadius:14,padding:20,marginBottom:20}}>
          <div style={{fontWeight:800,fontSize:15,color:C.primaryLight,marginBottom:16}}>
            {editId ? "✏️ แก้ไขตาราง" : "📅 เพิ่มตารางใหม่"}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            <div>
              <div style={{fontSize:11,color:C.textMuted,marginBottom:5,fontWeight:700}}>📅 วันที่</div>
              <input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))}
                style={{width:"100%",background:C.bgBase,border:`1px solid ${C.border}`,
                  color:C.textMain,borderRadius:8,padding:"9px 12px",fontSize:13,
                  outline:"none",boxSizing:"border-box"}}/>
            </div>
            <div>
              <div style={{fontSize:11,color:C.textMuted,marginBottom:5,fontWeight:700}}>⏰ เวลา</div>
              <input type="time" value={form.time} onChange={e=>setForm(p=>({...p,time:e.target.value}))}
                style={{width:"100%",background:C.bgBase,border:`1px solid ${C.border}`,
                  color:C.textMain,borderRadius:8,padding:"9px 12px",fontSize:13,
                  outline:"none",boxSizing:"border-box"}}/>
            </div>
            <div>
              <div style={{fontSize:11,color:C.textMuted,marginBottom:5,fontWeight:700}}>⚔️ ทีมคู่แข่ง</div>
              <input list="rival-list" value={form.rival}
                onChange={e=>setForm(p=>({...p,rival:e.target.value}))}
                placeholder="ชื่อทีม..."
                style={{width:"100%",background:C.bgBase,border:`1px solid ${C.border}`,
                  color:C.textMain,borderRadius:8,padding:"9px 12px",fontSize:13,
                  outline:"none",boxSizing:"border-box"}}/>
              <datalist id="rival-list">
                {rivals.map(r=><option key={r.id||r.name} value={r.name||r}/>)}
              </datalist>
            </div>
            <div>
              <div style={{fontSize:11,color:C.textMuted,marginBottom:5,fontWeight:700}}>🏆 Tournament / ชื่อรายการ</div>
              <input value={form.tournament} onChange={e=>setForm(p=>({...p,tournament:e.target.value}))}
                placeholder="เช่น RoV Pro League, Scrim Week 3 ..."
                style={{width:"100%",background:C.bgBase,border:`1px solid ${C.border}`,
                  color:C.textMain,borderRadius:8,padding:"9px 12px",fontSize:13,
                  outline:"none",boxSizing:"border-box"}}/>
            </div>
          </div>

          {/* Category */}
          <div style={{marginBottom:12}}>
            <div style={{fontSize:11,color:C.textMuted,marginBottom:8,fontWeight:700}}>ประเภท</div>
            <div style={{display:"flex",gap:8}}>
              {[{id:"tournament",label:"🏆 แข่ง"},{id:"scrim",label:"🏋️ ซ้อม"}].map(c=>(
                <button key={c.id} onClick={()=>setForm(p=>({...p,category:c.id}))}
                  style={{background:form.category===c.id?C.primary+"30":"transparent",
                    border:`2px solid ${form.category===c.id?C.primary:C.border}`,
                    color:form.category===c.id?C.primaryLight:C.textMuted,
                    borderRadius:8,padding:"7px 16px",cursor:"pointer",fontWeight:700,fontSize:12}}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <div style={{marginBottom:16}}>
            <div style={{fontSize:11,color:C.textMuted,marginBottom:5,fontWeight:700}}>📝 โน้ต</div>
            <textarea value={form.note} onChange={e=>setForm(p=>({...p,note:e.target.value}))}
              placeholder="กลยุทธ์ที่จะใช้, hero priority ..."
              rows={2}
              style={{width:"100%",background:C.bgBase,border:`1px solid ${C.border}`,
                color:C.textMain,borderRadius:8,padding:"9px 12px",fontSize:13,
                outline:"none",resize:"vertical",boxSizing:"border-box"}}/>
          </div>

          <div style={{display:"flex",gap:8}}>
            <button onClick={handleSave}
              style={{background:`linear-gradient(135deg,${C.primary},${C.primaryLight})`,
                color:"#fff",border:"none",borderRadius:9,padding:"10px 22px",
                cursor:"pointer",fontWeight:800,fontSize:13}}>
              💾 บันทึก
            </button>
            <button onClick={()=>setShowForm(false)}
              style={{background:"transparent",border:`1px solid ${C.border}`,
                color:C.textMuted,borderRadius:9,padding:"10px 16px",
                cursor:"pointer",fontSize:13}}>
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div style={{display:"flex",gap:6,marginBottom:16}}>
        {[
          {id:"upcoming",label:"📅 กำลังจะมา",  count:(schedules||[]).filter(s=>new Date(s.date+"T"+(s.time||"00:00"))>=now).length},
          {id:"all",     label:"ทั้งหมด",        count:(schedules||[]).length},
          {id:"past",    label:"⏪ ผ่านมาแล้ว", count:(schedules||[]).filter(s=>new Date(s.date+"T"+(s.time||"00:00"))<now).length},
        ].map(t=>(
          <button key={t.id} onClick={()=>setFilter(t.id)}
            style={{background:filter===t.id?C.primary+"30":"transparent",
              border:`2px solid ${filter===t.id?C.primary:C.border}`,
              color:filter===t.id?C.primaryLight:C.textMuted,
              borderRadius:99,padding:"6px 16px",cursor:"pointer",fontWeight:700,fontSize:12}}>
            {t.label} <span style={{opacity:0.6,fontWeight:400}}>({t.count})</span>
          </button>
        ))}
      </div>

      {/* Schedule list */}
      {filtered.length===0 ? (
        <div style={{textAlign:"center",padding:"60px 20px",background:C.bgPanel,
          borderRadius:14,color:C.textMuted}}>
          <div style={{fontSize:40,marginBottom:12}}>📅</div>
          <div style={{fontWeight:700,marginBottom:6}}>
            {filter==="upcoming" ? "ยังไม่มีตารางที่กำลังจะมา" : "ยังไม่มีตาราง"}
          </div>
          <div style={{fontSize:12}}>
            {isCoach ? 'กด "+ เพิ่มตาราง" เพื่อเริ่มวางแผน' : "รอ Coach เพิ่มตารางแข่ง"}
          </div>
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {filtered.map(s => {
            const d       = new Date(s.date+"T"+(s.time||"00:00"));
            const isPast  = d < now;
            const linked  = linkedMatch(s);
            const countdown = daysUntil(s.date, s.time);
            const dateStr = d.toLocaleDateString("th-TH",{weekday:"short",day:"numeric",month:"short",year:"numeric"});
            const timeStr = s.time ? d.toLocaleTimeString("th-TH",{hour:"2-digit",minute:"2-digit"}) : "";

            return (
              <div key={s.id} style={{background:C.bgPanel,border:`1px solid ${isPast?C.border:C.primary+"40"}`,
                borderRadius:14,padding:"16px 20px",opacity:isPast?0.7:1,
                borderLeft:`4px solid ${isPast?C.border:catColor[s.category]||C.primary}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10}}>
                  {/* Left: date + rival */}
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
                      <span style={{fontWeight:700,fontSize:13,color:C.textMuted}}>
                        {dateStr}{timeStr&&` · ${timeStr}`}
                      </span>
                      <span style={{background:(catColor[s.category]||C.primary)+"25",
                        border:`1px solid ${catColor[s.category]||C.primary}60`,
                        color:catColor[s.category]||C.primaryLight,
                        borderRadius:99,padding:"1px 9px",fontSize:10,fontWeight:800}}>
                        {catLabel[s.category]||"📅"}
                      </span>
                      {!isPast&&countdown&&(
                        <span style={{background:countdown.includes("วันนี้")?"#d63031"+"30":C.win+"20",
                          color:countdown.includes("วันนี้")?"#d63031":C.win,
                          borderRadius:99,padding:"1px 9px",fontSize:10,fontWeight:800}}>
                          {countdown}
                        </span>
                      )}
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:s.tournament||s.note?8:0}}>
                      <LogoImg url={null} name={s.rival} size={36}/>
                      <div>
                        <div style={{fontWeight:900,fontSize:17,color:C.primaryLight}}>vs {s.rival}</div>
                        {s.tournament&&(
                          <div style={{fontSize:11,color:C.textMuted,marginTop:1}}>🏆 {s.tournament}</div>
                        )}
                      </div>
                    </div>
                    {s.note&&(
                      <div style={{fontSize:12,color:C.textMuted,background:C.bgBase,
                        borderRadius:7,padding:"6px 10px",marginTop:6}}>
                        📝 {s.note}
                      </div>
                    )}
                  </div>

                  {/* Right: linked match + actions */}
                  <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"flex-end"}}>
                    {linked ? (
                      <span style={{background:C.win+"20",border:`1px solid ${C.win}40`,
                        color:C.win,borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700}}>
                        ✅ บันทึก Match แล้ว
                      </span>
                    ) : isPast ? (
                      <span style={{background:C.lose+"15",border:`1px solid ${C.lose}30`,
                        color:C.lose,borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700}}>
                        ❌ ยังไม่มี Match Log
                      </span>
                    ) : null}
                    {isCoach && (
                      <div style={{display:"flex",gap:6}}>
                        <button onClick={()=>openEdit(s)}
                          style={{background:C.primary+"20",border:`1px solid ${C.primary}40`,
                            color:C.primaryLight,borderRadius:7,padding:"4px 10px",
                            cursor:"pointer",fontSize:11,fontWeight:700}}>
                          ✏️ แก้ไข
                        </button>
                        <button onClick={()=>{
                          if(window.confirm(`ลบตาราง vs ${s.rival} ออกไหม?`)) {
                            onDelete(s.id);
                            toast("ลบตารางแล้ว","info");
                          }
                        }} style={{background:C.lose+"15",border:`1px solid ${C.lose}30`,
                          color:C.lose,borderRadius:7,padding:"4px 10px",
                          cursor:"pointer",fontSize:11,fontWeight:700}}>
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

