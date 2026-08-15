"use client";
// components/shared/AdminPanel.js
// ── Extracted from components/RovApp.js ──
// Member management / role approval / audit log — only admins ever open
// this page. Code-split via next/dynamic() in RovApp.js so regular
// members/coaches never download this bundle at all.

import { useState, useEffect } from "react";
import { C } from "@/lib/theme";

export default function AdminPanel({ session }) {
  const [members,    setMembers]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [updating,   setUpdating]   = useState(null); // userId กำลัง update
  const toast = useToast();

  const ROLES = [
    { id:"admin",  label:"👑 Admin",   desc:"จัดการสมาชิก + ใช้ได้ทุกอย่าง" },
    { id:"coach",  label:"🎓 Coach",   desc:"ใช้ Live Draft + บันทึกแมตช์" },
    { id:"member", label:"👤 Member",  desc:"ดูข้อมูลได้อย่างเดียว" },
  ];

  useEffect(() => { fetchMembers(); }, []);

  const [auditLog, setAuditLog] = useState([]);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);

  async function fetchAuditLog() {
    setAuditLoading(true);
    try {
      const res = await fetch("/api/admin/audit-log");
      if (!res.ok) throw new Error();
      setAuditLog(await res.json());
    } catch {
      toast("โหลดประวัติไม่สำเร็จ", "error");
    } finally { setAuditLoading(false); }
  }

  function toggleAuditLog() {
    const next = !showAuditLog;
    setShowAuditLog(next);
    if (next && auditLog.length === 0) fetchAuditLog();
  }

  const AUDIT_ACTION_LABEL = {
    role_change: "🔄 เปลี่ยน Role",
    member_removed: "🚫 ลบสมาชิกออกจากทีม",
    member_approved: "✅ อนุมัติสมาชิก",
    member_rejected: "⛔ ปฏิเสธคำขอเข้าร่วม",
  };

  async function fetchMembers() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/members");
      if (!res.ok) throw new Error();
      const data = await res.json();
      // pending ขึ้นก่อนเสมอ — คำขอเข้าร่วมใหม่ไม่ควรจมอยู่ล่างสุดของลิสต์
      // (API ส่งมาเรียงตาม createdAt เก่า→ใหม่ ซึ่งดีสำหรับกลุ่ม active
      // ปกติ แต่ pending คนใหม่มาทีหลังจะตกไปอยู่ล่างสุด เห็นยาก)
      data.sort((a, b) => (a.status==="pending"?0:1) - (b.status==="pending"?0:1));
      setMembers(data);
    } catch {
      toast("โหลดข้อมูลสมาชิกไม่สำเร็จ", "error");
    } finally { setLoading(false); }
  }

  async function updateRole(userId, newRole) {
    setUpdating(userId);
    try {
      const res = await fetch("/api/admin/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "เกิดข้อผิดพลาด");
      }
      setMembers(prev => prev.map(m => m.id===userId ? {...m, role:newRole} : m));
      toast("เปลี่ยน Role สำเร็จ ✅", "success");
    } catch (err) {
      toast(err.message || "เปลี่ยน Role ไม่สำเร็จ", "error");
    } finally { setUpdating(null); }
  }

  async function removeMember(userId, email) {
    if (!window.confirm(`ลบ ${email} ออกจากทีม?`)) return;
    setUpdating(userId);
    try {
      const res = await fetch(`/api/admin/members?userId=${userId}`, { method:"DELETE" });
      if (!res.ok) throw new Error();
      setMembers(prev => prev.filter(m => m.id!==userId));
      toast("ลบสมาชิกสำเร็จ", "success");
    } catch {
      toast("ลบสมาชิกไม่สำเร็จ", "error");
    } finally { setUpdating(null); }
  }

  async function approveMember(userId, email) {
    setUpdating(userId);
    try {
      const res = await fetch("/api/admin/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, status: "active" }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "เกิดข้อผิดพลาด");
      }
      setMembers(prev => prev.map(m => m.id===userId ? {...m, status:"active"} : m));
      toast(`อนุมัติ ${email} แล้ว ✅`, "success");
    } catch (err) {
      toast(err.message || "อนุมัติไม่สำเร็จ", "error");
    } finally { setUpdating(null); }
  }

  async function rejectMember(userId, email) {
    if (!window.confirm(`ปฏิเสธคำขอเข้าร่วมของ ${email}? (คนนี้จะหลุดจากทีม ต้องขอ invite code แล้วเข้าร่วมใหม่เองถ้าจะลองอีกครั้ง)`)) return;
    setUpdating(userId);
    try {
      const res = await fetch(`/api/admin/members?userId=${userId}`, { method:"DELETE" });
      if (!res.ok) throw new Error();
      setMembers(prev => prev.filter(m => m.id!==userId));
      toast("ปฏิเสธคำขอแล้ว", "success");
    } catch {
      toast("ดำเนินการไม่สำเร็จ", "error");
    } finally { setUpdating(null); }
  }

  const roleColor = { admin:"#f9ca24", coach:C.primaryLight, member:C.textMuted };

  const [exporting, setExporting] = useState(false);
  async function exportData() {
    setExporting(true);
    try {
      const res = await fetch("/api/admin/export");
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      // ดึงชื่อไฟล์จาก header ที่ server ตั้งไว้ ถ้าหาไม่เจอก็ fallback
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="(.+)"/);
      const filename = match?.[1] || `rov-backup-${new Date().toISOString().slice(0,10)}.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast("Export ข้อมูลสำเร็จ ✅", "success");
    } catch {
      toast("Export ข้อมูลไม่สำเร็จ", "error");
    } finally { setExporting(false); }
  }

  return (
    <div style={{padding:"0 24px 40px",maxWidth:900,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
        <div>
          <h2 style={{margin:"0 0 6px",fontSize:24,fontWeight:800}}>⚙️ Admin Panel</h2>
          <p style={{margin:"0 0 24px",color:C.textMuted,fontSize:13}}>
            จัดการสมาชิกในทีม · เฉพาะ Admin เท่านั้น
          </p>
        </div>
        <button onClick={exportData} disabled={exporting}
          style={{background:C.bgPanel,border:`1px solid ${C.border}`,color:C.textMain,
            borderRadius:9,padding:"9px 16px",cursor:exporting?"default":"pointer",
            fontWeight:700,fontSize:12.5,opacity:exporting?0.6:1,whiteSpace:"nowrap"}}>
          {exporting ? "⏳ กำลัง Export..." : "💾 Export ข้อมูลทีม (Backup)"}
        </button>
      </div>

      {loading ? (
        <div style={{textAlign:"center",padding:40,color:C.textMuted}}>กำลังโหลด...</div>
      ) : (
        <div style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:14,overflow:"hidden"}}>
          {/* header */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 120px 200px 80px",
            gap:12,padding:"10px 20px",background:C.bgBase,
            fontSize:11,color:C.textMuted,fontWeight:700,letterSpacing:0.5}}>
            <div>สมาชิก</div>
            <div>เข้าร่วม</div>
            <div>Role</div>
            <div></div>
          </div>

          {members.map((m, i) => {
            const isSelf = m.id === session?.user?.id;
            const isLast = members.filter(x=>x.role==="admin").length===1 && m.role==="admin";
            const isPending = m.status === "pending";
            return (
              <div key={m.id} style={{display:"grid",gridTemplateColumns:"1fr 120px 200px 80px",
                gap:12,padding:"14px 20px",alignItems:"center",
                borderTop:`1px solid ${C.border}`,
                background:isPending?"#f9ca2412":(isSelf?C.primary+"08":"transparent")}}>

                {/* name + email */}
                <div>
                  <div style={{fontWeight:700,fontSize:13,color:C.textMain}}>
                    {m.name || "—"}
                    {isSelf && <span style={{marginLeft:6,fontSize:10,color:C.primaryLight,
                      background:C.primary+"20",padding:"1px 7px",borderRadius:99}}>คุณ</span>}
                    {isPending && <span style={{marginLeft:6,fontSize:10,color:"#f9ca24",
                      background:"#f9ca2420",padding:"1px 7px",borderRadius:99,fontWeight:700}}>⏳ รออนุมัติ</span>}
                  </div>
                  <div style={{fontSize:11,color:C.textMuted,marginTop:2}}>{m.email}</div>
                </div>

                {/* join date */}
                <div style={{fontSize:11,color:C.textMuted}}>
                  {new Date(m.createdAt).toLocaleDateString("th-TH",{day:"numeric",month:"short",year:"numeric"})}
                </div>

                {isPending ? (
                  <>
                    {/* pending: approve/reject แทนที่ role selector + remove ปกติ */}
                    <div style={{display:"flex",gap:6}}>
                      <button onClick={()=>approveMember(m.id, m.email)}
                        disabled={updating===m.id}
                        style={{background:C.win+"20",border:`2px solid ${C.win}`,color:C.win,
                          borderRadius:99,padding:"4px 12px",cursor:"pointer",fontSize:11,fontWeight:700,
                          opacity:updating===m.id?0.5:1}}>
                        ✅ อนุมัติ
                      </button>
                    </div>
                    <div>
                      <button onClick={()=>rejectMember(m.id, m.email)}
                        disabled={updating===m.id}
                        style={{background:"transparent",border:`1px solid ${C.lose}40`,
                          color:C.lose,borderRadius:7,padding:"4px 10px",
                          cursor:"pointer",fontSize:11,fontWeight:700,
                          opacity:updating===m.id?0.5:1}}>
                        ⛔ ปฏิเสธ
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    {/* role selector */}
                    <div style={{display:"flex",gap:4}}>
                      {ROLES.map(r => (
                        <button key={r.id}
                          disabled={updating===m.id || (isSelf && isLast && r.id!=="admin")}
                          onClick={()=>{ if(m.role!==r.id) updateRole(m.id, r.id); }}
                          title={r.desc}
                          style={{padding:"4px 10px",borderRadius:99,cursor:"pointer",fontSize:10,fontWeight:700,
                            border:`2px solid ${m.role===r.id?roleColor[r.id]:C.border}`,
                            background:m.role===r.id?roleColor[r.id]+"25":"transparent",
                            color:m.role===r.id?roleColor[r.id]:C.textMuted,
                            opacity:updating===m.id?0.5:1}}>
                          {r.label}
                        </button>
                      ))}
                    </div>

                    {/* remove */}
                    <div>
                      {!isSelf && !isLast && (
                        <button onClick={()=>removeMember(m.id, m.email)}
                          disabled={updating===m.id}
                          style={{background:"transparent",border:`1px solid ${C.lose}40`,
                            color:C.lose,borderRadius:7,padding:"4px 10px",
                            cursor:"pointer",fontSize:11,fontWeight:700,
                            opacity:updating===m.id?0.5:1}}>
                          🗑️
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}

          {members.length===0&&(
            <div style={{textAlign:"center",padding:40,color:C.textMuted}}>ไม่พบสมาชิก</div>
          )}
        </div>
      )}

      {/* Invite Code */}
      <div style={{marginTop:20,background:C.bgPanel,border:`1px solid ${C.border}`,
        borderRadius:14,padding:"16px 20px"}}>
        <div style={{fontWeight:700,fontSize:13,color:C.primaryLight,marginBottom:6}}>
          🔗 Invite Code ของทีม
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <code style={{background:C.bgBase,padding:"8px 14px",borderRadius:8,
            fontSize:14,fontWeight:700,color:C.textMain,letterSpacing:2,flex:1}}>
            {session?.user?.inviteCode || "..."}
          </code>
          <button onClick={()=>{
            navigator.clipboard.writeText(session?.user?.inviteCode||"");
            toast("คัดลอก Invite Code แล้ว!", "success");
          }} style={{background:C.primary+"20",border:`1px solid ${C.primary}40`,
            color:C.primaryLight,borderRadius:8,padding:"8px 14px",
            cursor:"pointer",fontWeight:700,fontSize:12}}>
            📋 Copy
          </button>
        </div>
        <div style={{fontSize:11,color:C.textMuted,marginTop:6}}>
          แชร์ code นี้ให้ทีมใช้ตอน Register เพื่อเข้าร่วมทีม
        </div>
      </div>

      {/* Audit Log */}
      <div style={{marginTop:20,background:C.bgPanel,border:`1px solid ${C.border}`,
        borderRadius:14,overflow:"hidden"}}>
        <button onClick={toggleAuditLog}
          style={{width:"100%",background:"transparent",border:"none",cursor:"pointer",
            padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",
            fontWeight:700,fontSize:13,color:C.primaryLight}}>
          <span>📜 ประวัติการกระทำของ Admin</span>
          <span style={{fontSize:11,color:C.textMuted}}>{showAuditLog?"ซ่อน ▲":"แสดง ▼"}</span>
        </button>
        {showAuditLog && (
          <div style={{borderTop:`1px solid ${C.border}`,padding:"8px 0"}}>
            {auditLoading ? (
              <div style={{textAlign:"center",padding:24,color:C.textMuted,fontSize:12}}>กำลังโหลด...</div>
            ) : auditLog.length===0 ? (
              <div style={{textAlign:"center",padding:24,color:C.textMuted,fontSize:12}}>ยังไม่มีประวัติ</div>
            ) : (
              auditLog.map(entry => (
                <div key={entry.id} style={{padding:"9px 20px",fontSize:12,
                  borderBottom:`1px solid ${C.border}30`,display:"flex",
                  justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
                  <div>
                    <span style={{fontWeight:700}}>{AUDIT_ACTION_LABEL[entry.action]||entry.action}</span>
                    {entry.targetEmail && <span style={{color:C.textMuted}}> — {entry.targetEmail}</span>}
                    {entry.detail && <span style={{color:C.textMuted}}> ({entry.detail})</span>}
                  </div>
                  <div style={{color:C.textMuted,fontSize:11,whiteSpace:"nowrap"}}>
                    โดย {entry.actorEmail} · {new Date(entry.createdAt).toLocaleString("th-TH")}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

