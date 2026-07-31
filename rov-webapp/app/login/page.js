"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const C = {
  bg: "#0a0a16", panel: "#14112a", card: "#1a1535", border: "#1e1640",
  primary: "#6C5CE7", primaryLight: "#a29bfe",
  textMain: "#e8e8f0", textMuted: "#6b6b8a", lose: "#fd79a8",
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await signIn("credentials", {
      email, password, redirect: false,
    });

    setLoading(false);
    if (res?.error) {
      // NextAuth v4's CredentialsProvider forwards whatever message we
      // `throw` inside authorize() as res.error — the default
      // "CredentialsSignin" only shows up for the plain `return null`
      // case (wrong email/password), so anything else is a message we
      // wrote on purpose (e.g. the rate-limit one) and should be shown
      // to the user as-is instead of getting papered over with a
      // generic "wrong password" message that would be actively
      // misleading here.
      setError(
        res.error === "CredentialsSignin"
          ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
          : res.error
      );
    } else {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <div style={{
      minHeight: "100vh", background: C.bg, color: C.textMain,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Segoe UI',sans-serif", padding: 20,
    }}>
      <div style={{
        background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16,
        padding: "32px 28px", width: 360, maxWidth: "100%",
      }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🦅</div>
          <div style={{ fontWeight: 900, fontSize: 18, letterSpacing: 1, color: C.primaryLight }}>
            PRO TEAM ANALYTICS
          </div>
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>เข้าสู่ระบบทีมโค้ช</div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 5 }}>อีเมล</div>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              placeholder="coach@team.com"
              style={{
                width: "100%", background: C.card, border: `1px solid ${C.border}`,
                color: C.textMain, borderRadius: 8, padding: "10px 12px",
                fontSize: 14, outline: "none", boxSizing: "border-box",
              }} />
          </div>

          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 5 }}>รหัสผ่าน</div>
            <div style={{ position: "relative" }}>
              <input type={showPassword ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: "100%", background: C.card, border: `1px solid ${C.border}`,
                  color: C.textMain, borderRadius: 8, padding: "10px 40px 10px 12px",
                  fontSize: 14, outline: "none", boxSizing: "border-box",
                }} />
              <button type="button" onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                style={{
                  position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", color: C.textMuted,
                  fontSize: 16, padding: 8, display: "flex", alignItems: "center",
                }}>
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          {error && (
            <div style={{
              background: C.lose + "15", border: `1px solid ${C.lose}40`, color: C.lose,
              borderRadius: 8, padding: "8px 12px", fontSize: 12, marginBottom: 14,
            }}>
              ⚠️ {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{
              width: "100%", background: loading ? "#2a2550" : `linear-gradient(135deg,${C.primary},${C.primaryLight})`,
              color: "#fff", border: "none", borderRadius: 9, padding: "11px 0",
              cursor: loading ? "not-allowed" : "pointer", fontWeight: 800, fontSize: 14,
            }}>
            {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 18, fontSize: 12, color: C.textMuted }}>
          ยังไม่มีบัญชี?{" "}
          <Link href="/register" style={{ color: C.primaryLight, fontWeight: 700, textDecoration: "none" }}>
            สมัครสมาชิก
          </Link>
          <span style={{ margin: "0 10px", color: C.textMuted, opacity: 0.5 }}>|</span>
          <Link href="/forgot-password" style={{ color: C.primaryLight, fontWeight: 700, textDecoration: "none" }}>
            ลืมรหัสผ่าน?
          </Link>
        </div>
      </div>
    </div>
  );
}
