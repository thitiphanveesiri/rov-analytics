"use client";
import { useEffect, useRef, useState } from "react";
import { C } from "@/lib/theme";
import { PlayerAvatar } from "@/components/shared/PlayerMedia";
import { LogoImg } from "@/components/shared/TeamLogo";

// Modal ยืนยันย้ายทีม — แทน window.confirm
// teams: [{ key, name, logoUrl }] ทีมที่เลือกเป็นปลายทางได้ (ไม่รวมทีมต้นทาง)
// phase: "confirm" | "saving" | "error" (page คุมตามผลบันทึกจริงของ autosave)
export function TransferConfirmModal({ player, photoUrl, from, teams, initialTo, phase, errorText, onConfirm, onCancel }) {
  const [to, setTo] = useState(initialTo);
  const busy = phase === "saving";
  const confirmRef = useRef(null);

  useEffect(() => { confirmRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !busy) onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  const fromIsOur = from.key === "our";
  const dest = teams.find(t => t.key === to);

  return (
    <div role="dialog" aria-modal="true" aria-label={`ย้าย ${player}`}
      onClick={(e)=>{ if (e.target === e.currentTarget && !busy) onCancel(); }}
      style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.65)",display:"flex",
        alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:16,padding:22,
        width:"100%",maxWidth:440,boxShadow:"0 20px 60px rgba(0,0,0,0.5)"}}>
        <div style={{fontWeight:800,fontSize:16,marginBottom:16}}>🔀 ยืนยันการย้ายทีม</div>

        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:16}}>
          <PlayerAvatar name={player} photoUrl={photoUrl} size={64} team={fromIsOur ? "our" : "enemy"}/>
          <div style={{fontWeight:800,fontSize:18}}>{player}</div>
        </div>

        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
          <div style={{flex:1,minWidth:120,display:"flex",alignItems:"center",gap:8,background:C.bgBase,
            border:`1px solid ${C.border}`,borderRadius:10,padding:"8px 10px"}}>
            <LogoImg url={from.logoUrl} name={from.name} size={26}/>
            <div><div style={{fontSize:9,color:C.textMuted}}>จากทีม</div>
              <div style={{fontWeight:700,fontSize:13}}>{from.name}</div></div>
          </div>
          <span style={{fontSize:18,color:C.textMuted}} aria-hidden>→</span>
          <div style={{flex:1,minWidth:120,display:"flex",alignItems:"center",gap:8,background:C.bgBase,
            border:`1px solid ${C.primary}`,borderRadius:10,padding:"8px 10px"}}>
            <LogoImg url={dest?.logoUrl} name={dest?.name||"?"} size={26}/>
            <div><div style={{fontSize:9,color:C.textMuted}}>ไปทีม</div>
              <div style={{fontWeight:700,fontSize:13}}>{dest?.name}</div></div>
          </div>
        </div>

        {teams.length > 1 && (
          <label style={{display:"block",marginBottom:14,fontSize:12,color:C.textMuted}}>
            เปลี่ยนทีมปลายทาง
            <select value={to} disabled={busy} onChange={e=>setTo(e.target.value)}
              style={{display:"block",width:"100%",marginTop:4,padding:"8px 10px",borderRadius:8,
                background:C.bgBase,color:C.textMain,border:`1px solid ${C.border}`,fontSize:13}}>
              {teams.map(t => <option key={t.key} value={t.key}>{t.name}</option>)}
            </select>
          </label>
        )}

        <div style={{fontSize:11,color:C.textMuted,marginBottom:14,lineHeight:1.5}}>
          สถิติเก่ากับทีมเดิมยังอยู่ครบ (ดูย้อนหลังได้ตอนเลือก patch เก่า หรือ "ทั้งหมด") ตั้งแต่วันนี้ผู้เล่นจะอยู่ใน Roster ของทีมปลายทางแทน
        </div>

        {phase === "error" && (
          <div role="alert" style={{background:C.lose+"20",border:`1px solid ${C.lose}`,color:C.lose,
            borderRadius:8,padding:"8px 10px",fontSize:12,marginBottom:12}}>
            {errorText || "บันทึกไม่สำเร็จ"}
          </div>
        )}

        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button onClick={onCancel} disabled={busy}
            style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textMuted,borderRadius:8,
              padding:"9px 18px",cursor:busy?"not-allowed":"pointer",fontWeight:700}}>
            {phase === "error" ? "ปิด" : "ยกเลิก"}
          </button>
          {phase !== "error" && (
            <button ref={confirmRef} onClick={()=>onConfirm(to)} disabled={busy || !to}
              style={{background:C.primary,border:"none",color:"#fff",borderRadius:8,padding:"9px 18px",
                cursor:busy?"wait":"pointer",fontWeight:800,opacity:busy?0.7:1}}>
              {busy ? "กำลังบันทึก..." : "ยืนยันย้ายทีม"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
