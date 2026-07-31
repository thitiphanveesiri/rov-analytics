"use client";
// components/shared/ScheduleReminder.js
// ── In-app reminder for upcoming schedule entries (schedules in app state) ──
// No backend, no Cron job, no external service — reads app.schedules
// (already loaded client-side) and shows a banner for anything happening
// within the next 24 hours. Optional bonus: if the user grants permission,
// also fires a native browser Notification so they see it even if the
// app tab isn't focused (still requires the tab to be open — this is NOT
// a push notification service, just the Notification Web API).
//
// Dismissal is remembered in localStorage per schedule id, so closing a
// reminder doesn't bring it back on next reload, but a NEW upcoming item
// still shows normally.

import { useState, useEffect, useMemo } from "react";
import { C } from "@/lib/theme";

const DISMISSED_KEY = "rov_dismissed_reminders";
const NOTIFIED_KEY  = "rov_notified_reminders"; // separate from dismissed — tracks which ids already fired a browser Notification

function loadIdSet(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}
function saveIdSet(key, set) {
  try { localStorage.setItem(key, JSON.stringify([...set])); } catch {}
}

function formatCountdown(ms) {
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 60) return `อีก ${totalMin} นาที`;
  const hrs = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  return min > 0 ? `อีก ${hrs} ชม. ${min} นาที` : `อีก ${hrs} ชม.`;
}

export function ScheduleReminder({ schedules }) {
  const [now, setNow] = useState(() => Date.now());
  const [dismissed, setDismissed] = useState(() => loadIdSet(DISMISSED_KEY));
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported"
  );

  // เช็คทุก 1 นาที พอ ไม่ต้องถี่กว่านั้น (แค่ countdown เตือน ไม่ใช่ตัวจับเวลาแม่นยำ)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  const upcoming = useMemo(() => {
    if (!Array.isArray(schedules)) return [];
    return schedules
      .map(s => {
        if (!s.date) return null;
        const eventTime = new Date(`${s.date}T${s.time || "00:00"}`).getTime();
        if (isNaN(eventTime)) return null;
        return { ...s, eventTime, msUntil: eventTime - now };
      })
      .filter(s => s && s.msUntil > 0 && s.msUntil <= 24 * 60 * 60 * 1000 && !dismissed.has(String(s.id)))
      .sort((a, b) => a.msUntil - b.msUntil)
      .slice(0, 3);
  }, [schedules, now, dismissed]);

  // ยิง browser Notification ครั้งเดียวต่อรายการ (ถ้าได้รับอนุญาตแล้ว)
  useEffect(() => {
    if (notifPermission !== "granted") return;
    const notified = loadIdSet(NOTIFIED_KEY);
    let changed = false;
    for (const s of upcoming) {
      const key = String(s.id);
      if (notified.has(key)) continue;
      const label = s.tournament || s.rival || "นัดหมาย";
      new Notification(`🔔 ${label}`, {
        body: `${formatCountdown(s.msUntil)}${s.rival ? ` · vs ${s.rival}` : ""}`,
        icon: "/icon-192.png",
      });
      notified.add(key);
      changed = true;
    }
    if (changed) saveIdSet(NOTIFIED_KEY, notified);
  }, [upcoming, notifPermission]);

  function dismiss(id) {
    const next = new Set(dismissed);
    next.add(String(id));
    setDismissed(next);
    saveIdSet(DISMISSED_KEY, next);
  }

  function requestPermission() {
    if (typeof Notification === "undefined") return;
    Notification.requestPermission().then(setNotifPermission);
  }

  if (upcoming.length === 0) return null;

  return (
    <div style={{padding:"10px 16px",display:"flex",flexDirection:"column",gap:6}}>
      {upcoming.map(s => (
        <div key={s.id} style={{
          background: s.msUntil <= 2*60*60*1000 ? C.lose+"18" : C.primary+"18",
          border: `1px solid ${s.msUntil <= 2*60*60*1000 ? C.lose : C.primary}40`,
          borderRadius:10, padding:"10px 14px",
          display:"flex", alignItems:"center", justifyContent:"space-between", gap:12,
        }}>
          <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
            <span style={{fontSize:18,flexShrink:0}}>🔔</span>
            <div style={{minWidth:0}}>
              <div style={{fontWeight:800,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                {s.tournament || s.rival || "นัดหมาย"}{s.rival && s.tournament ? ` · vs ${s.rival}` : ""}
              </div>
              <div style={{fontSize:11,color:C.textMuted,marginTop:2}}>
                {formatCountdown(s.msUntil)} · {s.time || "-"} {s.note ? `· ${s.note}` : ""}
              </div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
            {notifPermission === "default" && (
              <button onClick={requestPermission}
                title="เปิดแจ้งเตือนแบบ notification เครื่อง"
                style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textMuted,
                  borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:10,fontWeight:700}}>
                🔕 เปิดแจ้งเตือน
              </button>
            )}
            <button onClick={()=>dismiss(s.id)}
              style={{background:"transparent",border:"none",color:C.textMuted,
                cursor:"pointer",fontSize:14,padding:4}}>
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
