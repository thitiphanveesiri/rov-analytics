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

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "สมัครไม่สำเร็จ");
      setLoading(false);
      return;
    }

    // auto-login right after successful registration
    const signInRes = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);

    if (signInRes?.error) {
      router.push("/login");
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
            สมัครสมาชิกทีม
          </div>
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
            ทุกคนในทีมเห็นข้อมูลเดียวกัน
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 5 }}>ชื่อ (ไม่บังคับ)</div>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Coach Tom"
              style={{
                width: "100%", background: C.card, border: `1px solid ${C.border}`,
                color: C.textMain, borderRadius: 8, padding: "10px 12px",
                fontSize: 14, outline: "none", boxSizing: "border-box",
              }} />
          </div>

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
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 5 }}>รหัสผ่าน (อย่างน้อย 6 ตัว)</div>
            <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: "100%", background: C.card, border: `1px solid ${C.border}`,
                color: C.textMain, borderRadius: 8, padding: "10px 12px",
                fontSize: 14, outline: "none", boxSizing: "border-box",
              }} />
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
            {loading ? "กำลังสมัคร..." : "สมัครสมาชิก"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 18, fontSize: 12, color: C.textMuted }}>
          มีบัญชีอยู่แล้ว?{" "}
          <Link href="/login" style={{ color: C.primaryLight, fontWeight: 700, textDecoration: "none" }}>
            เข้าสู่ระบบ
          </Link>
        </div>
      </div>
    </div>
  );
}
