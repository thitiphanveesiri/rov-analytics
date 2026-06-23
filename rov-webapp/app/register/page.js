"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const C = {
  bg:"#0a0a16", panel:"#14112a", card:"#1a1535", border:"#1e1640",
  primary:"#6C5CE7", primaryLight:"#a29bfe",
  textMain:"#e8e8f0", textMuted:"#6b6b8a", lose:"#fd79a8", win:"#00cec9",
};

const inputStyle = {
  width:"100%", background:C.card, border:`1px solid ${C.border}`,
  color:C.textMain, borderRadius:8, padding:"10px 12px",
  fontSize:14, outline:"none", boxSizing:"border-box",
};

export default function RegisterPage() {
  const router = useRouter();
  const [action,     setAction]     = useState("create"); // "create" | "join"
  const [name,       setName]       = useState("");
  const [email,      setEmail]      = useState("");
  const [password,   setPassword]   = useState("");
  const [teamName,   setTeamName]   = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error,      setError]      = useState("");
  const [loading,    setLoading]    = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setLoading(true);

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name, action, teamName, inviteCode }),
    });
    const data = await res.json();

    if (!res.ok) { setError(data.error || "สมัครไม่สำเร็จ"); setLoading(false); return; }

    const signInRes = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (signInRes?.error) router.push("/login");
    else { router.push("/"); router.refresh(); }
  }

  return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.textMain,
      display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily:"'Segoe UI',sans-serif", padding:20 }}>
      <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:16,
        padding:"32px 28px", width:400, maxWidth:"100%" }}>

        <div style={{ textAlign:"center", marginBottom:24 }}>
          <div style={{ fontSize:36, marginBottom:8 }}>🦅</div>
          <div style={{ fontWeight:900, fontSize:18, letterSpacing:1, color:C.primaryLight }}>
            สมัครสมาชิก
          </div>
        </div>

        {/* toggle create / join */}
        <div style={{ display:"flex", background:C.bg, borderRadius:8, padding:3,
          border:`1px solid ${C.border}`, marginBottom:20 }}>
          {[{id:"create",label:"🏆 สร้างทีมใหม่"},{id:"join",label:"🤝 เข้าร่วมทีม"}].map(t=>(
            <button key={t.id} onClick={()=>{setAction(t.id);setError("");}}
              style={{ flex:1, background:action===t.id?C.primary:"transparent",
                border:"none", color:action===t.id?"#fff":C.textMuted,
                borderRadius:6, padding:"8px 0", cursor:"pointer",
                fontWeight:700, fontSize:13 }}>
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:11, color:C.textMuted, marginBottom:5 }}>ชื่อ (ไม่บังคับ)</div>
            <input value={name} onChange={e=>setName(e.target.value)}
              placeholder="ชื่อของคุณ" style={inputStyle}/>
          </div>

          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:11, color:C.textMuted, marginBottom:5 }}>อีเมล</div>
            <input type="email" required value={email} onChange={e=>setEmail(e.target.value)}
              placeholder="coach@team.com" style={inputStyle}/>
          </div>

          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:11, color:C.textMuted, marginBottom:5 }}>รหัสผ่าน (อย่างน้อย 6 ตัว)</div>
            <input type="password" required minLength={6} value={password}
              onChange={e=>setPassword(e.target.value)}
              placeholder="••••••••" style={inputStyle}/>
          </div>

          {action==="create" ? (
            <div style={{ marginBottom:18 }}>
              <div style={{ fontSize:11, color:C.textMuted, marginBottom:5 }}>ชื่อทีม</div>
              <input required value={teamName} onChange={e=>setTeamName(e.target.value)}
                placeholder="เช่น Alpha Wolves" style={inputStyle}/>
              <div style={{ fontSize:10, color:C.textMuted, marginTop:5 }}>
                💡 หลัง register จะได้ Invite Code ไปแชร์ให้ทีม
              </div>
            </div>
          ) : (
            <div style={{ marginBottom:18 }}>
              <div style={{ fontSize:11, color:C.textMuted, marginBottom:5 }}>Invite Code</div>
              <input required value={inviteCode} onChange={e=>setInviteCode(e.target.value)}
                placeholder="ใส่ code ที่ได้รับจาก Coach" style={inputStyle}/>
            </div>
          )}

          {error && (
            <div style={{ background:C.lose+"15", border:`1px solid ${C.lose}40`, color:C.lose,
              borderRadius:8, padding:"8px 12px", fontSize:12, marginBottom:14 }}>
              ⚠️ {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{ width:"100%", background:loading?"#2a2550":`linear-gradient(135deg,${C.primary},${C.primaryLight})`,
              color:"#fff", border:"none", borderRadius:9, padding:"11px 0",
              cursor:loading?"not-allowed":"pointer", fontWeight:800, fontSize:14 }}>
            {loading ? "กำลังสมัคร..." : action==="create" ? "สร้างทีม + สมัครสมาชิก" : "เข้าร่วมทีม"}
          </button>
        </form>

        <div style={{ textAlign:"center", marginTop:18, fontSize:12, color:C.textMuted }}>
          มีบัญชีอยู่แล้ว?{" "}
          <Link href="/login" style={{ color:C.primaryLight, fontWeight:700, textDecoration:"none" }}>
            เข้าสู่ระบบ
          </Link>
        </div>
      </div>
    </div>
  );
}
