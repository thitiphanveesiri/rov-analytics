"use client";
// app/reset-password/page.js
import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

const C = {
  bg: "#0a0a16", panel: "#14112a", card: "#1a1535", border: "#1e1640",
  primary: "#6C5CE7", primaryLight: "#a29bfe",
  textMain: "#e8e8f0", textMuted: "#6b6b8a",
  win: "#00b894", lose: "#fd79a8",
};

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const token        = searchParams.get("token");

  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status,    setStatus]    = useState(null);
  const [errMsg,    setErrMsg]    = useState("");

  useEffect(() => { if (!token) setStatus("invalid"); }, [token]);

  async function handleSubmit() {
    if (password !== confirm) { setErrMsg("รหัสผ่านไม่ตรงกัน"); return; }
    if (password.length < 6)  { setErrMsg("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"); return; }
    setStatus("loading"); setErrMsg("");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) { setErrMsg(data.error || "เกิดข้อผิดพลาด"); setStatus("error"); return; }
      setStatus("done");
      setTimeout(() => router.push("/login"), 2500);
    } catch {
      setErrMsg("เกิดข้อผิดพลาด ลองใหม่อีกครั้ง"); setStatus("error");
    }
  }

  if (status === "invalid" || !token) return (
    <div style={{ textAlign:"center" }}>
      <div style={{ fontSize:36, marginBottom:8 }}>❌</div>
      <div style={{ color:C.lose, fontWeight:700, marginBottom:8 }}>ลิงก์ไม่ถูกต้อง</div>
      <div style={{ fontSize:12, color:C.textMuted, marginBottom:16 }}>
        ลิงก์นี้ไม่ถูกต้องหรือหมดอายุแล้ว
      </div>
      <Link href="/forgot-password"
        style={{ color:C.primaryLight, fontWeight:700, textDecoration:"none", fontSize:13 }}>
        ขอลิงก์ใหม่ →
      </Link>
    </div>
  );

  if (status === "done") return (
    <div style={{ textAlign:"center" }}>
      <div style={{ fontSize:36, marginBottom:8 }}>✅</div>
      <div style={{ color:C.win, fontWeight:700, marginBottom:8 }}>รีเซ็ตสำเร็จ!</div>
      <div style={{ fontSize:12, color:C.textMuted }}>กำลังพาไปหน้า login...</div>
    </div>
  );

  return (
    <>
      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:11, color:C.textMuted, marginBottom:5 }}>รหัสผ่านใหม่</div>
        <div style={{ position:"relative" }}>
          <input type={showPassword ? "text" : "password"} value={password}
            onChange={e=>setPassword(e.target.value)} placeholder="อย่างน้อย 6 ตัวอักษร"
            disabled={status==="loading"}
            style={{ width:"100%", background:C.card, border:`1px solid ${C.border}`,
              color:C.textMain, borderRadius:8, padding:"10px 40px 10px 12px",
              fontSize:14, outline:"none", boxSizing:"border-box" }}/>
          <button type="button" onClick={()=>setShowPassword(v=>!v)}
            aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
            style={{ position:"absolute", right:4, top:"50%", transform:"translateY(-50%)",
              background:"none", border:"none", cursor:"pointer", color:C.textMuted,
              fontSize:16, padding:8, display:"flex", alignItems:"center" }}>
            {showPassword ? "🙈" : "👁️"}
          </button>
        </div>
      </div>
      <div style={{ marginBottom:18 }}>
        <div style={{ fontSize:11, color:C.textMuted, marginBottom:5 }}>ยืนยันรหัสผ่านใหม่</div>
        <input type={showPassword ? "text" : "password"} value={confirm}
          onChange={e=>setConfirm(e.target.value)} placeholder="พิมพ์อีกครั้ง"
          onKeyDown={e=>e.key==="Enter"&&handleSubmit()}
          disabled={status==="loading"}
          style={{ width:"100%", background:C.card, border:`1px solid ${C.border}`,
            color:C.textMain, borderRadius:8, padding:"10px 12px",
            fontSize:14, outline:"none", boxSizing:"border-box" }}/>
      </div>

      {(status==="error"||errMsg) && (
        <div style={{ background:C.lose+"15", border:`1px solid ${C.lose}40`,
          color:C.lose, borderRadius:8, padding:"8px 12px",
          fontSize:12, marginBottom:14 }}>
          ⚠️ {errMsg}
        </div>
      )}

      <button onClick={handleSubmit} disabled={status==="loading"}
        style={{ width:"100%",
          background: status==="loading" ? "#2a2550" : `linear-gradient(135deg,${C.primary},${C.primaryLight})`,
          color:"#fff", border:"none", borderRadius:9, padding:"11px 0",
          cursor: status==="loading" ? "not-allowed" : "pointer",
          fontWeight:800, fontSize:14 }}>
        {status==="loading" ? "กำลังบันทึก..." : "ตั้งรหัสผ่านใหม่"}
      </button>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.textMain,
      display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily:"'Segoe UI',sans-serif", padding:20 }}>
      <div style={{ background:C.panel, border:`1px solid ${C.border}`,
        borderRadius:16, padding:"32px 28px", width:380, maxWidth:"100%" }}>
        <div style={{ textAlign:"center", marginBottom:24 }}>
          <div style={{ fontSize:36, marginBottom:8 }}>🔐</div>
          <div style={{ fontWeight:900, fontSize:18, color:C.primaryLight }}>
            ตั้งรหัสผ่านใหม่
          </div>
        </div>
        <Suspense fallback={<div style={{textAlign:"center",color:C.textMuted}}>กำลังโหลด...</div>}>
          <ResetPasswordForm />
        </Suspense>
        <div style={{ textAlign:"center", marginTop:18, fontSize:12, color:C.textMuted }}>
          <Link href="/login" style={{ color:C.primaryLight, fontWeight:700, textDecoration:"none" }}>
            ← กลับหน้าเข้าสู่ระบบ
          </Link>
        </div>
      </div>
    </div>
  );
}
