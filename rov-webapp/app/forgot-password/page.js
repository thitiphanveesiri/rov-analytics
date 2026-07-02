"use client";
// app/forgot-password/page.js
import { useState } from "react";
import Link from "next/link";

const C = {
  bg: "#0a0a16", panel: "#14112a", card: "#1a1535", border: "#1e1640",
  primary: "#6C5CE7", primaryLight: "#a29bfe",
  textMain: "#e8e8f0", textMuted: "#6b6b8a",
  win: "#00b894", lose: "#fd79a8",
};

export default function ForgotPasswordPage() {
  const [email,   setEmail]   = useState("");
  const [status,  setStatus]  = useState(null); // null | "loading" | "done" | "error"
  const [errMsg,  setErrMsg]  = useState("");

  async function handleSubmit() {
    if (!email.trim()) return;
    setStatus("loading"); setErrMsg("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setErrMsg(data.error || "เกิดข้อผิดพลาด"); setStatus("error"); return; }
      setStatus("done");
    } catch {
      setErrMsg("เกิดข้อผิดพลาด ลองใหม่อีกครั้ง"); setStatus("error");
    }
  }

  return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.textMain,
      display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily:"'Segoe UI',sans-serif", padding:20 }}>
      <div style={{ background:C.panel, border:`1px solid ${C.border}`,
        borderRadius:16, padding:"32px 28px", width:360, maxWidth:"100%" }}>

        <div style={{ textAlign:"center", marginBottom:24 }}>
          <div style={{ fontSize:36, marginBottom:8 }}>🔑</div>
          <div style={{ fontWeight:900, fontSize:18, color:C.primaryLight }}>ลืมรหัสผ่าน</div>
          <div style={{ fontSize:12, color:C.textMuted, marginTop:4 }}>
            กรอกอีเมลที่ลงทะเบียนไว้ เราจะส่งลิงก์รีเซ็ตให้
          </div>
        </div>

        {status === "done" ? (
          <div style={{ background:C.win+"15", border:`1px solid ${C.win}40`,
            borderRadius:10, padding:"16px", textAlign:"center" }}>
            <div style={{ fontSize:28, marginBottom:8 }}>✅</div>
            <div style={{ color:C.win, fontWeight:700, marginBottom:6 }}>ส่งลิงก์แล้ว!</div>
            <div style={{ fontSize:12, color:C.textMuted }}>
              ถ้าอีเมลนี้มีในระบบ เราจะส่งลิงก์รีเซ็ตรหัสผ่านให้ภายในไม่กี่นาที
              (ลิงก์มีอายุ 1 ชั่วโมง)
            </div>
            <div style={{ marginTop:12, fontSize:12, color:C.textMuted }}>
              ไม่เห็น email? ลองเช็ค Spam หรือ{" "}
              <button onClick={()=>setStatus(null)}
                style={{ background:"none", border:"none", color:C.primaryLight,
                  cursor:"pointer", fontWeight:700, padding:0 }}>
                ส่งใหม่อีกครั้ง
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:11, color:C.textMuted, marginBottom:5 }}>อีเมล</div>
              <input type="email" value={email}
                onChange={e=>setEmail(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&handleSubmit()}
                placeholder="coach@team.com" disabled={status==="loading"}
                style={{ width:"100%", background:C.card, border:`1px solid ${C.border}`,
                  color:C.textMain, borderRadius:8, padding:"10px 12px",
                  fontSize:14, outline:"none", boxSizing:"border-box" }}/>
            </div>

            {status === "error" && (
              <div style={{ background:C.lose+"15", border:`1px solid ${C.lose}40`,
                color:C.lose, borderRadius:8, padding:"8px 12px",
                fontSize:12, marginBottom:14 }}>
                ⚠️ {errMsg}
              </div>
            )}

            <button onClick={handleSubmit} disabled={status==="loading" || !email.trim()}
              style={{ width:"100%",
                background: status==="loading" || !email.trim()
                  ? "#2a2550"
                  : `linear-gradient(135deg,${C.primary},${C.primaryLight})`,
                color:"#fff", border:"none", borderRadius:9, padding:"11px 0",
                cursor: status==="loading" || !email.trim() ? "not-allowed" : "pointer",
                fontWeight:800, fontSize:14 }}>
              {status==="loading" ? "กำลังส่ง..." : "ส่งลิงก์รีเซ็ต"}
            </button>
          </>
        )}

        <div style={{ textAlign:"center", marginTop:18, fontSize:12, color:C.textMuted }}>
          <Link href="/login" style={{ color:C.primaryLight, fontWeight:700, textDecoration:"none" }}>
            ← กลับหน้าเข้าสู่ระบบ
          </Link>
        </div>
      </div>
    </div>
  );
}
