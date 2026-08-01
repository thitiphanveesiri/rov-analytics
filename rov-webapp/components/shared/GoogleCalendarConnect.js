"use client";
// components/shared/GoogleCalendarConnect.js
// Compact widget for connecting/disconnecting a personal Google Calendar.
// Placed on the Schedule page — each team member connects their OWN
// Google account; once connected, every team schedule item auto-syncs
// into their calendar whenever anyone adds/edits/removes one (server-side,
// see lib/googleCalendar.js + the sync call in app/api/data PUT).

import { useState, useEffect } from "react";
import { C } from "@/lib/theme";

export function GoogleCalendarConnect() {
  const [status, setStatus] = useState(null); // null = loading, {connected, googleEmail}
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    fetch("/api/google-calendar/status")
      .then(r => r.ok ? r.json() : { connected: false })
      .then(setStatus)
      .catch(() => setStatus({ connected: false }));
  }, []);

  async function disconnect() {
    if (!window.confirm("ยกเลิกการเชื่อมต่อ Google Calendar? นัดหมายที่เคย sync ไว้จะไม่ถูกลบออกจากปฏิทินของคุณ แต่จะไม่อัปเดตตามอีกต่อไป")) return;
    setDisconnecting(true);
    try {
      await fetch("/api/google-calendar/disconnect", { method: "POST" });
      setStatus({ connected: false });
    } finally {
      setDisconnecting(false);
    }
  }

  if (status === null) return null; // avoid a flash of "not connected" while loading

  return (
    <div style={{
      background: status.connected ? C.win+"12" : C.bgPanel,
      border: `1px solid ${status.connected ? C.win+"40" : C.border}`,
      borderRadius: 12, padding: "12px 16px", marginBottom: 16,
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
    }}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:20}}>📅</span>
        <div>
          <div style={{fontWeight:800,fontSize:13}}>
            {status.connected ? "เชื่อมต่อ Google Calendar แล้ว" : "ยังไม่ได้เชื่อมต่อ Google Calendar"}
          </div>
          <div style={{fontSize:11,color:C.textMuted,marginTop:2}}>
            {status.connected
              ? `นัดหมายทีมจะขึ้นในปฏิทินของ ${status.googleEmail} อัตโนมัติ`
              : "เชื่อมต่อแล้วนัดซ้อม/แข่งในแอปจะขึ้นในปฏิทิน Google ของคุณเองอัตโนมัติ"}
          </div>
        </div>
      </div>
      {status.connected ? (
        <button onClick={disconnect} disabled={disconnecting}
          style={{background:"transparent",border:`1px solid ${C.lose}40`,color:C.lose,
            borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:12,fontWeight:700,
            opacity:disconnecting?0.5:1}}>
          {disconnecting ? "กำลังยกเลิก..." : "ยกเลิกการเชื่อมต่อ"}
        </button>
      ) : (
        <a href="/api/google-calendar/connect"
          style={{background:C.primary,color:"#fff",borderRadius:8,padding:"7px 16px",
            fontSize:12,fontWeight:700,textDecoration:"none",display:"inline-block"}}>
          🔗 เชื่อมต่อ Google Calendar
        </a>
      )}
    </div>
  );
}
