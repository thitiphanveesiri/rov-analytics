"use client";
// components/shared/NoTeamScreen.js
// ── Extracted from components/RovApp.js ──
// Full-screen blocking gate shown when the signed-in account has no team
// (removed by an admin, or never finished joining one) — lets them enter
// an invite code to (re)join. No props at all: reads nothing from the
// parent, just calls next-auth's signOut() directly on its own.

import { useState } from "react";
import { signOut } from "next-auth/react";
import { C, iStyle } from "@/lib/theme";

// ═══════════════════════════════════════════
//  NO TEAM SCREEN — บัญชีถูกเอาออกจากทีม (หรือยังไม่เคยเข้าทีมสำเร็จ)
//  บล็อกการเข้าแอปทั้งหมด จนกว่าจะกรอก invite code ใหม่สำเร็จ
// ═══════════════════════════════════════════
export function NoTeamScreen() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleJoin(e) {
    e.preventDefault();
    if (!code.trim()) { setError("กรุณากรอก Invite Code"); return; }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/team/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "เกิดข้อผิดพลาด"); return; }
      // สำเร็จแล้ว — reload เพื่อให้ loadFromStorage() โหลดสถานะใหม่
      // (จะกลายเป็น "pending" รอ admin อนุมัติ ไม่ใช่ noTeam อีกต่อไป)
      window.location.reload();
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{minHeight:"100vh",background:C.bgBase,color:C.textMain,
      display:"flex",alignItems:"center",justifyContent:"center",
      fontFamily:"'Segoe UI',sans-serif",padding:20}}>
      <div style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:16,
        padding:"32px 28px",width:380,maxWidth:"100%"}}>
        <div style={{textAlign:"center",marginBottom:20}}>
          <div style={{fontSize:36,marginBottom:8}}>🚪</div>
          <div style={{fontWeight:900,fontSize:17,color:C.primaryLight}}>บัญชีนี้ไม่ได้อยู่ในทีมไหนแล้ว</div>
          <div style={{fontSize:12,color:C.textMuted,marginTop:8,lineHeight:1.6}}>
            อาจเป็นเพราะถูก Admin เอาออกจากทีม หรือยังไม่เคยเข้าร่วมทีมสำเร็จ —
            กรอก Invite Code เพื่อเข้าร่วมทีม (จะต้องรอ Admin อนุมัติอีกครั้งก่อนเริ่มใช้งาน)
          </div>
        </div>

        <form onSubmit={handleJoin}>
          <input value={code} onChange={e=>{setCode(e.target.value);setError("");}}
            placeholder="Invite Code"
            style={{...iStyle,textAlign:"center",fontWeight:700,letterSpacing:1,marginBottom:12}}/>

          {error && (
            <div style={{background:C.lose+"15",border:`1px solid ${C.lose}40`,color:C.lose,
              borderRadius:8,padding:"8px 12px",fontSize:12,marginBottom:14}}>
              ⚠️ {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{width:"100%",background:loading?"#2a2550":`linear-gradient(135deg,${C.primary},${C.primaryLight})`,
              color:"#fff",border:"none",borderRadius:9,padding:"11px 0",
              cursor:loading?"not-allowed":"pointer",fontWeight:800,fontSize:14}}>
            {loading ? "กำลังเข้าร่วม..." : "เข้าร่วมทีม"}
          </button>
        </form>

        <div style={{textAlign:"center",marginTop:16}}>
          <button onClick={()=>signOut({ callbackUrl: "/login" })}
            style={{background:"transparent",border:"none",color:C.textMuted,
              cursor:"pointer",fontSize:12,textDecoration:"underline"}}>
            ออกจากระบบ
          </button>
        </div>
      </div>
    </div>
  );
}
