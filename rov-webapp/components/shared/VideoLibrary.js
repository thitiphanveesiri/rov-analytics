"use client";
// components/shared/VideoLibrary.js
// ── Extracted from components/RovApp.js ──
// The whole video module, moved verbatim (no logic changes) — the source
// file already called this out as one unit ("VIDEO LIBRARY (merged
// module)"), so it lifts out cleanly as a single file: URL/type detection
// (getVideoInfo), the embed player (VideoEmbed), timestamped notes
// (TimestampedNote), the freehand draw-over-video overlay
// (VideoDrawOverlay), the per-video card (VideoCard), and the page itself
// (VideoLibrary). Everything here is self-contained — no dispatch/reducer
// access, just props + callbacks, same pattern as SchedulePage.

import { useState, useEffect, useRef } from "react";
import { C, iStyle } from "@/lib/theme";

// ═══════════════════════════════════════════
//  VIDEO LIBRARY (merged module)
// ═══════════════════════════════════════════


const TAG_COLORS = {
  drill:"#6C5CE7", review:"#00cec9", scrim:"#fdcb6e",
  tutorial:"#00b894", highlight:"#e17055",
};

const TAGS = ["drill","review","scrim","tutorial","highlight"];

// detect YouTube/video URL type
function getVideoInfo(url) {
  try {
    const u = url.trim();
    const ytMatch = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) return { type:"youtube", id:ytMatch[1] };
    if (u.startsWith("blob:") || /\.(mp4|webm|mov|avi|mkv)$/i.test(u)) return { type:"video", url:u };
    if (u.startsWith("http")) return { type:"iframe", url:u };
    return null;
  } catch { return null; }
}

function VideoEmbed({ src, title }) {
  const [embedFailed, setEmbedFailed] = useState(false);
  const info = getVideoInfo(src);

  if (!info) return (
    <div style={{width:"100%",aspectRatio:"16/9",background:"#080614",
      borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",
      color:C.textMuted,fontSize:12}}>
      ❌ URL ไม่ถูกต้อง
    </div>
  );

  // YouTube fallback card — shown when embed is blocked (private/unlisted with embedding disabled)
  const YouTubeFallback = ({ url }) => (
    <div style={{width:"100%",aspectRatio:"16/9",background:"#0f0f0f",
      borderRadius:8,display:"flex",flexDirection:"column",
      alignItems:"center",justifyContent:"center",gap:14}}>
      <div style={{fontSize:36}}>▶️</div>
      <div style={{fontSize:13,color:C.textMuted,textAlign:"center",padding:"0 20px"}}>
        วิดีโอนี้ไม่อนุญาตให้ embed — คลิกเพื่อเปิดใน YouTube
      </div>
      <a href={url} target="_blank" rel="noopener noreferrer"
        style={{background:"#ff0000",color:"#fff",borderRadius:8,
          padding:"9px 22px",fontWeight:700,fontSize:13,
          textDecoration:"none",display:"flex",alignItems:"center",gap:8}}>
        🔗 เปิดใน YouTube
      </a>
    </div>
  );

  if (info.type==="youtube") {
    if (embedFailed) return <YouTubeFallback url={src}/>;
    return (
      <iframe
        style={{width:"100%",aspectRatio:"16/9",border:"none",borderRadius:8}}
        src={`https://www.youtube.com/embed/${info.id}?rel=0`}
        title={title} allowFullScreen
        onError={()=>setEmbedFailed(true)}/>
    );
  }
  if (info.type==="video") return (
    <video controls style={{width:"100%",aspectRatio:"16/9",borderRadius:8,background:"#000"}}>
      <source src={src}/>
    </video>
  );
  return (
    <iframe src={src} title={title}
      style={{width:"100%",aspectRatio:"16/9",border:"none",borderRadius:8}}
      allowFullScreen/>
  );
}

// ── parse [MM:SS] or [HH:MM:SS] timestamps in note text → clickable buttons ──
function TimestampedNote({ note, onSeek }) {
  // split on [MM:SS] or [H:MM:SS] patterns
  const parts = note.split(/(\[\d{1,2}:\d{2}(?::\d{2})?\])/g);
  return (
    <div style={{marginTop:10,background:C.primary+"12",borderRadius:8,
      padding:"8px 12px",fontSize:12,color:C.primaryLight,lineHeight:2}}>
      📝{" "}
      {parts.map((part, i) => {
        const match = part.match(/^\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]$/);
        if (!match) return <span key={i}>{part}</span>;
        // convert to total seconds
        const hasHours = match[3] !== undefined;
        const secs = hasHours
          ? parseInt(match[1])*3600 + parseInt(match[2])*60 + parseInt(match[3])
          : parseInt(match[1])*60 + parseInt(match[2]);
        return (
          <button key={i} onClick={()=>onSeek(secs)}
            title={`กระโดดไปที่ ${part.slice(1,-1)}`}
            style={{background:C.primary+"40",border:`1px solid ${C.primary}`,
              color:C.primaryLight,borderRadius:5,padding:"1px 7px",
              cursor:"pointer",fontSize:11,fontWeight:800,margin:"0 2px",
              fontFamily:"monospace"}}>
            ⏱ {part.slice(1,-1)}
          </button>
        );
      })}
    </div>
  );
}

// ── VideoDrawOverlay: วาดทับวิดีโอสดๆ ตอนอธิบายให้ผู้เล่นดู (ไม่บันทึกอะไรลง
//    database เลย — ปิดโหมดวาด/ปิดการ์ดวิดีโอแล้วลายเส้นหายไปเลย เหมือน
//    ปากกาเลเซอร์ ไม่ใช่การบันทึกเป็นวิดีโอใหม่) ──
const DRAW_COLORS = ["#ff4757", "#ffd93d", "#1dd1a1", "#54a0ff", "#ffffff"];

function VideoDrawOverlay({ active }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef(null);
  const [color, setColor] = useState(DRAW_COLORS[0]);
  const colorRef = useRef(color);
  useEffect(() => { colorRef.current = color; }, [color]);

  // ปรับขนาด canvas ให้เท่ากับกล่องวิดีโอเป๊ะเสมอ (รวมตอน resize จอ)
  useEffect(() => {
    const canvas = canvasRef.current, container = containerRef.current;
    if (!canvas || !container) return;
    function resize() {
      const rect = container.getBoundingClientRect();
      // เก็บลายเส้นเดิมไว้ไม่ได้ตอน resize (canvas resize = เคลียร์เอง
      // โดยธรรมชาติ) — โอเคเพราะฟีเจอร์นี้ตั้งใจให้เป็นของชั่วคราวอยู่แล้ว
      canvas.width = rect.width;
      canvas.height = rect.height;
    }
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  function getPoint(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  }

  function start(e) {
    if (!active) return;
    e.preventDefault();
    drawingRef.current = true;
    lastPointRef.current = getPoint(e);
  }
  function move(e) {
    if (!active || !drawingRef.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const p = getPoint(e);
    const last = lastPointRef.current;
    ctx.strokeStyle = colorRef.current;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPointRef.current = p;
  }
  function end() { drawingRef.current = false; }

  function clearCanvas() {
    const canvas = canvasRef.current;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
  }

  return (
    <div ref={containerRef} style={{position:"absolute", inset:0, pointerEvents: active ? "auto" : "none"}}>
      <canvas ref={canvasRef}
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={move} onTouchEnd={end}
        style={{position:"absolute", inset:0, width:"100%", height:"100%",
          cursor: active ? "crosshair" : "default", touchAction:"none"}}/>
      {active && (
        <div style={{position:"absolute", bottom:8, left:8, display:"flex", gap:6,
          background:"rgba(10,10,22,0.85)", borderRadius:10, padding:"6px 8px", alignItems:"center"}}>
          {DRAW_COLORS.map(c => (
            <button key={c} onClick={()=>setColor(c)}
              style={{width:20, height:20, borderRadius:"50%", background:c, cursor:"pointer",
                border: color===c ? "2px solid #fff" : "2px solid transparent", padding:0}}/>
          ))}
          <button onClick={clearCanvas}
            style={{background:"transparent", border:`1px solid ${C.border}`, color:"#fff",
              borderRadius:6, padding:"3px 8px", cursor:"pointer", fontSize:11, fontWeight:700, marginLeft:4}}>
            🧹 ลบทั้งหมด
          </button>
        </div>
      )}
    </div>
  );
}

function VideoCard({ v, onDelete, onEdit, forceOpen, onForceOpenHandled }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({...v});
  const [drawMode, setDrawMode] = useState(false);
  const iframeRef = useRef(null);
  const cardRef = useRef(null);

  // ปิดโหมดวาดทุกครั้งที่ปิดการ์ด — ลายเส้นเป็นของชั่วคราวจริงๆ ไม่ใช่แค่ซ่อนไว้
  useEffect(() => { if (!open) setDrawMode(false); }, [open]);


  // ── ถ้าถูกเปิดมาจากปุ่ม "ดูวิดีโอ" ใน Match Log ให้ขยายอัตโนมัติ + เลื่อนจอมาหา ──
  useEffect(() => {
    if (forceOpen) {
      setOpen(true);
      cardRef.current?.scrollIntoView({ behavior:"smooth", block:"center" });
      onForceOpenHandled && onForceOpenHandled();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceOpen]);

  function saveEdit() {
    onEdit(editData); setEditing(false);
  }

  // seek YouTube iframe to a specific second via postMessage
  function seekTo(seconds) {
    if (!iframeRef.current) return;
    // YouTube iframe API: seekTo via postMessage
    iframeRef.current.contentWindow?.postMessage(
      JSON.stringify({ event:"command", func:"seekTo", args:[seconds, true] }),
      "*"
    );
    // also ensure it's playing
    iframeRef.current.contentWindow?.postMessage(
      JSON.stringify({ event:"command", func:"playVideo", args:[] }),
      "*"
    );
  }

  // get video info for YouTube embed with enablejsapi=1
  const info = getVideoInfo(v.url);
  const embedSrc = info?.type==="youtube"
    ? `https://www.youtube.com/embed/${info.id}?rel=0&enablejsapi=1`
    : null;

  return (
    <div ref={cardRef} style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:14,
      overflow:"hidden",borderLeft:`4px solid ${C.primary}`}}>
      {/* header */}
      <div onClick={()=>setOpen(p=>!p)}
        style={{padding:"12px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <span style={{fontSize:18}}>🎬</span>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:800,fontSize:14,color:C.primaryLight,
            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v.title}</div>
          <div style={{display:"flex",gap:6,marginTop:4,flexWrap:"wrap",alignItems:"center"}}>
            {v.rival&&<span style={{fontSize:10,fontWeight:700,color:C.lose}}>vs {v.rival}</span>}
            {v.date&&<span style={{fontSize:10,color:C.textMuted}}>{v.date}</span>}
            {(v.tags||[]).map(t=>(
              <span key={t} style={{fontSize:9,padding:"1px 7px",borderRadius:99,fontWeight:700,
                background:(TAG_COLORS[t]||C.primary)+"20",color:TAG_COLORS[t]||C.primary}}>
                {t}
              </span>
            ))}
          </div>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <button onClick={e=>{e.stopPropagation();setEditing(p=>!p);}}
            style={{background:C.card,border:`1px solid ${C.border}`,color:C.textMuted,
              borderRadius:7,padding:"3px 10px",cursor:"pointer",fontSize:11}}>
            ✏️
          </button>
          <button onClick={e=>{e.stopPropagation();if(window.confirm("ลบวิดีโอนี้?"))onDelete();}}
            style={{background:C.lose+"20",border:`1px solid ${C.lose}30`,color:C.lose,
              borderRadius:7,padding:"3px 10px",cursor:"pointer",fontSize:11}}>
            🗑️
          </button>
          <span style={{color:C.textMuted,fontSize:13}}>{open?"▲":"▼"}</span>
        </div>
      </div>

      {editing&&(
        <div style={{padding:"0 16px 16px",borderTop:`1px solid ${C.border}`}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            {[{label:"ชื่อวิดีโอ",key:"title"},{label:"ทีมคู่แข่ง",key:"rival"},
              {label:"วันที่",key:"date"},{label:"URL / Link",key:"url"}].map(f=>(
              <div key={f.key}>
                <div style={{fontSize:10,color:C.textMuted,marginBottom:3}}>{f.label}</div>
                <input value={editData[f.key]||""} onChange={e=>setEditData(p=>({...p,[f.key]:e.target.value}))}
                  style={iStyle}/>
              </div>
            ))}
          </div>
          <div style={{marginBottom:8}}>
            <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>Tags</div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              {TAGS.map(t=>(
                <button key={t} onClick={()=>setEditData(p=>({...p,
                  tags:(p.tags||[]).includes(t)?(p.tags||[]).filter(x=>x!==t):[...(p.tags||[]),t]}))}
                  style={{background:(editData.tags||[]).includes(t)?(TAG_COLORS[t]||C.primary)+"30":"transparent",
                    border:`1px solid ${(editData.tags||[]).includes(t)?(TAG_COLORS[t]||C.primary):C.border}`,
                    color:(editData.tags||[]).includes(t)?(TAG_COLORS[t]||C.primary):C.textMuted,
                    borderRadius:99,padding:"3px 10px",cursor:"pointer",fontSize:11,fontWeight:700}}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div style={{marginBottom:8}}>
            <div style={{fontSize:10,color:C.textMuted,marginBottom:3}}>
              Note / วิเคราะห์ — ใส่ timestamp เช่น [03:45] เพื่อกระโดดไปยังเวลานั้นได้
            </div>
            <textarea value={editData.note||""} onChange={e=>setEditData(p=>({...p,note:e.target.value}))}
              rows={3} style={{...iStyle,resize:"vertical"}}
              placeholder="เช่น [03:45] ไฟต์มังกรเล็ก พลาดตำแหน่ง&#10;[12:30] push middle ดีมาก"/>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={saveEdit}
              style={{background:C.primary,color:"#fff",border:"none",borderRadius:8,
                padding:"6px 18px",cursor:"pointer",fontWeight:700,fontSize:12}}>
              ✅ บันทึก
            </button>
            <button onClick={()=>setEditing(false)}
              style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textMuted,
                borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:12}}>
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      {open&&!editing&&(
        <div style={{padding:"0 16px 16px"}}>
          {/* YouTube embed with JS API enabled for seeking */}
          <div style={{position:"relative", width:"100%", aspectRatio:"16/9", borderRadius:8, overflow:"hidden"}}>
            {embedSrc ? (
              <iframe
                ref={iframeRef}
                style={{width:"100%",height:"100%",border:"none"}}
                src={embedSrc} title={v.title} allowFullScreen/>
            ) : (
              <VideoEmbed src={v.url} title={v.title}/>
            )}
            <VideoDrawOverlay active={drawMode}/>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",marginTop:6}}>
            <button onClick={()=>setDrawMode(m=>!m)}
              style={{background: drawMode ? C.primary : "transparent",
                border:`1px solid ${drawMode ? C.primary : C.border}`,
                color: drawMode ? "#fff" : C.textMuted,
                borderRadius:8, padding:"6px 14px", cursor:"pointer", fontSize:12, fontWeight:700}}>
              {drawMode ? "✅ กำลังวาดอยู่ (กดเพื่อหยุด)" : "✏️ วาดอธิบายทับคลิป"}
            </button>
          </div>
          {v.note&&(
            v.note.match(/\[\d{1,2}:\d{2}(?::\d{2})?\]/)
              ? <TimestampedNote note={v.note} onSeek={seekTo}/>
              : <div style={{marginTop:10,background:C.primary+"12",borderRadius:8,
                  padding:"8px 12px",fontSize:12,color:C.primaryLight,lineHeight:1.6}}>
                  📝 {v.note}
                </div>
          )}
          {v.note&&v.note.match(/\[\d{1,2}:\d{2}(?::\d{2})?\]/)&&(
            <div style={{fontSize:10,color:C.textMuted,marginTop:4,textAlign:"right"}}>
              💡 กดปุ่มเวลาเพื่อกระโดดไปยังช่วงนั้นในวิดีโอ
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function VideoLibrary({ videos=[], onAddVideo, onUpdateVideo, onDeleteVideo, focusVideoId, onClearFocusVideo }) {
  const [showAdd,     setShowAdd]     = useState(false);
  const [filterTag,   setFilterTag]   = useState("all");
  const [filterRival, setFilterRival] = useState("");
  const [search,      setSearch]      = useState("");
  const fileInputRef  = useRef(null);

  // ── ถ้ามาจากปุ่ม "ดูวิดีโอ" ใน Match Log ให้ล้าง filter ทั้งหมด
  //    กันไม่ให้วิดีโอที่ผูกไว้โดน filter บังจนหาไม่เจอ ──
  useEffect(() => {
    if (focusVideoId) {
      setFilterTag("all"); setFilterRival(""); setSearch("");
    }
  }, [focusVideoId]);

  const [form, setForm] = useState({
    title:"", url:"", rival:"", date:"", tags:[], note:"", type:"link",
  });

  function addVideo() {
    if (!form.title.trim()) { alert("กรุณากรอกชื่อวิดีโอ"); return; }
    if (!form.url.trim())   { alert("กรุณาใส่ URL หรืออัพโหลดไฟล์"); return; }
    onAddVideo && onAddVideo({ ...form });
    setForm({title:"",url:"",rival:"",date:"",tags:[],note:"",type:"link"});
    setShowAdd(false);
  }

  function handleFileUpload(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const url  = URL.createObjectURL(file);
    setForm(p=>({...p, url, title:p.title||file.name, type:"file"}));
    e.target.value="";
  }

  const rivals = [...new Set(videos.filter(v=>v.rival).map(v=>v.rival))];

  const filtered = videos.filter(v=>{
    const matchTag   = filterTag==="all"   || (v.tags||[]).includes(filterTag);
    const matchRival = !filterRival        || v.rival===filterRival;
    const matchSearch= !search             ||
      v.title.toLowerCase().includes(search.toLowerCase()) ||
      (v.note||"").toLowerCase().includes(search.toLowerCase()) ||
      (v.rival||"").toLowerCase().includes(search.toLowerCase());
    return matchTag && matchRival && matchSearch;
  });

  return (
    <div>
      {/* page header */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6,flexWrap:"wrap"}}>
        <h2 style={{margin:0,fontSize:24,fontWeight:800}}>🎬 Video Library</h2>
        <span style={{background:C.primary,color:"#fff",fontSize:10,padding:"2px 8px",
          borderRadius:99,fontWeight:700}}>{videos.length} วิดีโอ</span>
        <button onClick={()=>setShowAdd(v=>!v)}
          style={{marginLeft:"auto",background:`linear-gradient(135deg,${C.primary},${C.primaryLight})`,
            color:"#fff",border:"none",borderRadius:9,padding:"7px 18px",
            cursor:"pointer",fontWeight:800,fontSize:13}}>
          + เพิ่มวิดีโอ
        </button>
      </div>
      <p style={{margin:"0 0 20px",color:C.textMuted,fontSize:13}}>
        เก็บวิดีโอซ้อม / scrim review / tutorial ไว้ดูซ้ำได้
      </p>

      <div style={{maxWidth:1100}}>

        {/* ADD FORM */}
        {showAdd&&(
          <div style={{background:C.panel,border:`1px solid ${C.border}`,
            borderRadius:16,padding:20,marginBottom:20}}>
            <h3 style={{margin:"0 0 16px",fontSize:16,fontWeight:800,color:C.primaryLight}}>
              + เพิ่มวิดีโอใหม่
            </h3>
            {/* type toggle */}
            <div style={{display:"flex",gap:3,background:C.bg,borderRadius:8,padding:3,
              border:`1px solid ${C.border}`,width:"fit-content",marginBottom:14}}>
              {[{id:"link",label:"🔗 ใส่ Link URL"},{id:"file",label:"📂 อัพโหลดไฟล์"}].map(t=>(
                <button key={t.id} onClick={()=>setForm(p=>({...p,type:t.id,url:""}))}
                  style={{background:form.type===t.id?C.primary:"transparent",
                    border:"none",color:form.type===t.id?"#fff":C.textMuted,
                    borderRadius:6,padding:"5px 16px",cursor:"pointer",fontWeight:700,fontSize:12}}>
                  {t.label}
                </button>
              ))}
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
              <div>
                <div style={{fontSize:10,color:C.textMuted,marginBottom:3}}>ชื่อวิดีโอ *</div>
                <input value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))}
                  placeholder="เช่น Scrim vs Alpha BO3 Game1" style={iStyle}/>
              </div>
              <div>
                <div style={{fontSize:10,color:C.textMuted,marginBottom:3}}>ทีมคู่แข่ง</div>
                <input value={form.rival} onChange={e=>setForm(p=>({...p,rival:e.target.value}))}
                  placeholder="เช่น Alpha Wolves" style={iStyle}/>
              </div>
              <div>
                {form.type==="link" ? (
                  <>
                    <div style={{fontSize:10,color:C.textMuted,marginBottom:3}}>
                      YouTube URL / Link วิดีโอ *
                    </div>
                    <input value={form.url} onChange={e=>setForm(p=>({...p,url:e.target.value}))}
                      placeholder="https://youtube.com/watch?v=..." style={iStyle}/>
                  </>
                ) : (
                  <>
                    <div style={{fontSize:10,color:C.textMuted,marginBottom:3}}>อัพโหลดไฟล์วิดีโอ *</div>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <label style={{flex:1,background:C.card,border:`1px dashed ${C.border}`,
                        color:C.textMuted,borderRadius:8,padding:"8px 12px",cursor:"pointer",
                        fontSize:12,textAlign:"center"}}>
                        {form.url ? "✅ ไฟล์พร้อมแล้ว" : "คลิกเลือกไฟล์..."}
                        <input ref={fileInputRef} type="file" accept="video/*"
                          style={{display:"none"}} onChange={handleFileUpload}/>
                      </label>
                    </div>
                  </>
                )}
              </div>
              <div>
                <div style={{fontSize:10,color:C.textMuted,marginBottom:3}}>วันที่</div>
                <input value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))}
                  placeholder="เช่น 15 มิ.ย. 2568" style={iStyle}/>
              </div>
            </div>

            <div style={{marginBottom:10}}>
              <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>Tags</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {TAGS.map(t=>(
                  <button key={t} onClick={()=>setForm(p=>({...p,
                    tags:(p.tags||[]).includes(t)?(p.tags||[]).filter(x=>x!==t):[...(p.tags||[]),t]}))}
                    style={{background:(form.tags||[]).includes(t)?(TAG_COLORS[t]||C.primary)+"30":"transparent",
                      border:`1px solid ${(form.tags||[]).includes(t)?(TAG_COLORS[t]||C.primary):C.border}`,
                      color:(form.tags||[]).includes(t)?(TAG_COLORS[t]||C.primary):C.textMuted,
                      borderRadius:99,padding:"4px 14px",cursor:"pointer",fontSize:12,fontWeight:700}}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div style={{marginBottom:14}}>
              <div style={{fontSize:10,color:C.textMuted,marginBottom:3}}>Note / วิเคราะห์</div>
              <textarea value={form.note} onChange={e=>setForm(p=>({...p,note:e.target.value}))}
                rows={2} placeholder="จุดสังเกต, ช่วงเวลาสำคัญ..."
                style={{...iStyle,resize:"vertical"}}/>
            </div>

            {/* preview */}
            {form.url&&(
              <div style={{marginBottom:14}}>
                <div style={{fontSize:10,color:C.textMuted,marginBottom:5}}>Preview</div>
                <VideoEmbed src={form.url} title={form.title}/>
              </div>
            )}

            <div style={{display:"flex",gap:8}}>
              <button onClick={addVideo}
                style={{background:`linear-gradient(135deg,${C.primary},${C.primaryLight})`,
                  color:"#fff",border:"none",borderRadius:9,padding:"8px 24px",
                  cursor:"pointer",fontWeight:800,fontSize:13}}>
                ✅ เพิ่มวิดีโอ
              </button>
              <button onClick={()=>setShowAdd(false)}
                style={{background:"transparent",border:`1px solid ${C.border}`,
                  color:C.textMuted,borderRadius:9,padding:"8px 18px",cursor:"pointer",fontSize:13}}>
                ยกเลิก
              </button>
            </div>
          </div>
        )}

        {/* FILTERS */}
        <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="🔍 ค้นหาวิดีโอ..."
            style={{...iStyle,flex:1,minWidth:180,padding:"7px 12px",fontSize:12}}/>
          {rivals.length>0&&(
            <select value={filterRival} onChange={e=>setFilterRival(e.target.value)}
              style={{...iStyle,width:170,padding:"7px 12px",fontSize:12}}>
              <option value="">— ทุกทีม —</option>
              {rivals.map(r=><option key={r} value={r}>{r}</option>)}
            </select>
          )}
          <div style={{display:"flex",gap:4}}>
            {["all",...TAGS].map(t=>(
              <button key={t} onClick={()=>setFilterTag(t)} style={{
                background:filterTag===t?(t==="all"?C.primary:TAG_COLORS[t]||C.primary)+"30":"transparent",
                border:`1px solid ${filterTag===t?(t==="all"?C.primary:TAG_COLORS[t]||C.primary):C.border}`,
                color:filterTag===t?(t==="all"?C.primaryLight:TAG_COLORS[t]||C.primary):C.textMuted,
                borderRadius:99,padding:"4px 12px",cursor:"pointer",fontSize:11,fontWeight:700}}>
                {t==="all"?"ทั้งหมด":t}
              </button>
            ))}
          </div>
        </div>

        {/* STATS ROW */}
        {videos.length>0&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(90px,1fr))",gap:10,marginBottom:16}}>
            {[
              {label:"🎬 ทั้งหมด",  val:videos.length,                            col:C.primaryLight},
              ...TAGS.map(t=>({
                label:t, val:videos.filter(v=>(v.tags||[]).includes(t)).length,
                col:TAG_COLORS[t]||C.primary,
              }))
            ].slice(0,5).map(s=>(
              <div key={s.label} style={{background:C.panel,border:`1px solid ${C.border}`,
                borderRadius:10,padding:"10px 12px",textAlign:"center"}}>
                <div style={{fontSize:9,color:C.textMuted,marginBottom:3}}>{s.label}</div>
                <div style={{fontSize:20,fontWeight:800,color:s.col}}>{s.val}</div>
              </div>
            ))}
          </div>
        )}

        {/* VIDEO LIST */}
        {videos.length===0 ? (
          <div style={{textAlign:"center",padding:60,background:C.panel,borderRadius:14,color:C.textMuted}}>
            <div style={{fontSize:40,marginBottom:10}}>🎬</div>
            <div style={{fontSize:15,fontWeight:700,marginBottom:6}}>ยังไม่มีวิดีโอ</div>
            <div style={{fontSize:12}}>กด "+ เพิ่มวิดีโอ" เพื่อเริ่ม</div>
          </div>
        ) : filtered.length===0 ? (
          <div style={{textAlign:"center",padding:40,background:C.panel,borderRadius:12,
            color:C.textMuted,fontSize:12}}>
            ไม่พบวิดีโอที่ตรงกับ filter
          </div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {filtered.map(v=>(
              <VideoCard key={v.id} v={v}
                onDelete={()=>onDeleteVideo && onDeleteVideo(v.id)}
                onEdit={updated=>onUpdateVideo && onUpdateVideo({id:v.id,...updated})}
                forceOpen={String(v.id)===String(focusVideoId)}
                onForceOpenHandled={onClearFocusVideo}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
