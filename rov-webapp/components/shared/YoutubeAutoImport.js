"use client";
// components/shared/YoutubeAutoImport.js
// Lets any team member add their OWN YouTube channel to a watch list —
// requires connecting a Google account first (same connection used for
// Calendar sync — one login covers both). That's what lets the cron job
// see UNLISTED uploads, not just public ones: it authenticates as the
// channel owner rather than using an anonymous API key.

import { useState, useEffect } from "react";
import { C, iStyle } from "@/lib/theme";

export function YoutubeAutoImport({ onVideosRefreshed }) {
  const [open, setOpen] = useState(false);
  const [channels, setChannels] = useState(null); // null = loading
  const [keywords, setKeywords] = useState([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [googleConnected, setGoogleConnected] = useState(null); // null = loading
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  function load() {
    Promise.all([
      fetch("/api/admin/youtube-channels").then(r => r.ok ? r.json() : { channels: [], keywords: [] }),
      fetch("/api/google-calendar/status").then(r => r.ok ? r.json() : { connected: false }),
    ]).then(([ch, status]) => {
      setChannels(ch.channels || []);
      setKeywords(ch.keywords || []);
      setGoogleConnected(status.connected);
    }).catch(() => { setChannels([]); setKeywords([]); setGoogleConnected(false); });
  }

  useEffect(() => { if (open && channels === null) load(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  async function addMyChannel() {
    setAdding(true);
    setError("");
    try {
      const res = await fetch("/api/admin/youtube-channels", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "เกิดข้อผิดพลาด"); return; }
      setChannels(prev => [...(prev||[]), data]);
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setAdding(false);
    }
  }

  async function removeChannel(id) {
    if (!window.confirm("เอาช่องนี้ออกจากลิสต์เช็ควิดีโอใหม่อัตโนมัติ?")) return;
    const res = await fetch(`/api/admin/youtube-channels?id=${id}`, { method: "DELETE" });
    if (res.ok) setChannels(prev => prev.filter(c => c.id !== id));
  }

  async function saveKeywords(next) {
    setKeywords(next);
    await fetch("/api/admin/youtube-channels", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keywords: next }),
    });
  }

  function addKeyword(e) {
    e.preventDefault();
    const k = keywordInput.trim();
    if (!k || keywords.includes(k)) return;
    saveKeywords([...keywords, k]);
    setKeywordInput("");
  }

  async function refreshNow() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/data");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.videos)) onVideosRefreshed(data.videos);
      }
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:12,marginBottom:16,overflow:"hidden"}}>
      <button onClick={()=>setOpen(v=>!v)}
        style={{width:"100%",background:"transparent",border:"none",color:C.textMain,
          padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",
          cursor:"pointer",fontSize:13,fontWeight:800}}>
        <span>📺 นำเข้าวิดีโอจาก YouTube อัตโนมัติ</span>
        <span style={{color:C.textMuted,fontSize:11,fontWeight:400}}>{open ? "▲ ซ่อน" : "▼ ตั้งค่า"}</span>
      </button>

      {open && (
        <div style={{padding:"0 16px 16px",borderTop:`1px solid ${C.border}`}}>
          {channels === null ? (
            <div style={{padding:"14px 0",fontSize:12,color:C.textMuted}}>กำลังโหลด...</div>
          ) : (
            <>
              <div style={{fontSize:11,color:C.textMuted,margin:"14px 0 8px"}}>
                รองรับวิดีโอ Unlisted ด้วย (ไม่ใช่แค่ Public) — ระบบเช็คช่องที่เชื่อมต่อไว้ทุก ~15 นาที
                วิดีโอไหนชื่อขึ้นต้นด้วยคำที่ตั้งไว้ด้านล่าง จะถูกเพิ่มเข้า Video Library ให้อัตโนมัติ
              </div>

              {/* channel list */}
              {channels.map(c => (
                <div key={c.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                  padding:"7px 10px",background:C.bgCard,borderRadius:8,marginBottom:6}}>
                  <div style={{fontSize:12}}>
                    <span style={{fontWeight:700}}>{c.channelTitle || c.channelId}</span>
                    <span style={{color:C.textMuted,marginLeft:8,fontSize:10}}>เพิ่มโดย {c.addedByEmail}</span>
                  </div>
                  <button onClick={()=>removeChannel(c.id)}
                    style={{background:"transparent",border:"none",color:C.lose,cursor:"pointer",fontSize:13}}>✕</button>
                </div>
              ))}

              {/* add-my-channel action */}
              {googleConnected === false ? (
                <div style={{background:C.primary+"12",border:`1px solid ${C.primary}30`,borderRadius:10,
                  padding:"10px 14px",fontSize:12,color:C.textMuted,marginTop:8}}>
                  ต้องเชื่อมต่อบัญชี Google ก่อน (ใช้ปุ่มเดียวกับ Google Calendar ในหน้า Schedule) ถึงจะเพิ่มช่องตัวเองได้ —
                  จำเป็นเพราะระบบต้องรู้จักตัวตนเจ้าของช่อง ถึงจะเห็นวิดีโอ Unlisted ได้
                  <div style={{marginTop:8}}>
                    <a href="/api/google-calendar/connect"
                      style={{background:C.primary,color:"#fff",borderRadius:8,padding:"6px 14px",
                        fontSize:12,fontWeight:700,textDecoration:"none",display:"inline-block"}}>
                      🔗 เชื่อมต่อบัญชี Google
                    </a>
                  </div>
                </div>
              ) : (
                <button onClick={addMyChannel} disabled={adding}
                  style={{marginTop:8,background:C.primary,color:"#fff",border:"none",borderRadius:8,
                    padding:"7px 16px",cursor:"pointer",fontSize:12,fontWeight:700,opacity:adding?0.6:1}}>
                  {adding ? "กำลังเพิ่ม..." : "+ เพิ่มช่องของฉัน"}
                </button>
              )}
              {error && <div style={{color:C.lose,fontSize:11,marginTop:6}}>⚠️ {error}</div>}

              {/* keywords */}
              <div style={{fontSize:11,color:C.textMuted,margin:"16px 0 8px"}}>
                คำขึ้นต้นชื่อวิดีโอที่จะนำเข้าอัตโนมัติ (ไม่สนตัวพิมพ์เล็ก/ใหญ่):
              </div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
                {keywords.map(k => (
                  <span key={k} style={{background:C.primary+"20",color:C.primaryLight,
                    borderRadius:99,padding:"4px 10px",fontSize:11,fontWeight:700,
                    display:"flex",alignItems:"center",gap:6}}>
                    {k}
                    <span onClick={()=>saveKeywords(keywords.filter(x=>x!==k))}
                      style={{cursor:"pointer",opacity:0.7}}>✕</span>
                  </span>
                ))}
              </div>
              <form onSubmit={addKeyword} style={{display:"flex",gap:6}}>
                <input value={keywordInput} onChange={e=>setKeywordInput(e.target.value)}
                  placeholder="เช่น scrim, ซ้อม"
                  style={{...iStyle,flex:1,fontSize:12,padding:"6px 10px"}}/>
                <button type="submit"
                  style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textMuted,
                    borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:11,fontWeight:700}}>
                  + คำ
                </button>
              </form>

              <button onClick={refreshNow} disabled={refreshing}
                style={{marginTop:14,background:"transparent",border:`1px solid ${C.border}`,color:C.textMuted,
                  borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:11,fontWeight:700}}>
                {refreshing ? "กำลังเช็ค..." : "🔄 เช็ควิดีโอที่นำเข้าล่าสุด"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
