"use client";
// components/shared/TacticalWhiteboard.js
// ── Extracted from components/RovApp.js ──
// Canvas-based tactical drawing board — only visited when someone opens
// the "Whiteboard" page, so it's a good candidate for code-splitting via
// next/dynamic() in RovApp.js rather than shipping it in the main bundle
// for every single page load.

import { useState, useEffect, useCallback, useRef, useContext } from "react";
import { upload } from "@vercel/blob/client";
import { deleteBlobUrls } from "@/lib/blobCleanup";
import { compressImage } from "@/lib/imageCompress";
import { C } from "@/lib/theme";
import { HERO_DATA } from "@/lib/heroes";
import { useHeroImage, HeroPhotosContext, checkLocalHeroImage, LOCAL_HERO_IMG_CACHE } from "@/lib/useHeroImage";

// ── constants the whiteboard needs — these lived at module level in
//    RovApp.js right before the TacticalWhiteboard function itself, not
//    inside it, so they have to be duplicated here rather than picked up
//    automatically by extracting just the function body ──
const TOOLS = [
  { id:"select",  icon:"↖",   label:"Select"   },
  { id:"pen",     icon:"✏️",  label:"Pen"      },
  { id:"arrow",   icon:"→",   label:"Arrow"    },
  { id:"text",    icon:"T",   label:"Text"     },
  { id:"hero",    icon:"🦸",  label:"Hero"     },
  { id:"erase",   icon:"⌫",   label:"Erase"    },
];
const COLORS = ["#ffffff","#00cec9","#fd79a8","#fdcb6e","#e17055","#6C5CE7","#00b894","#ff4757","#2196f3"];
const SIZES  = [2, 4, 8, 14];
const TEAM_COLORS = { our:"#00cec9", enemy:"#fd79a8" };

// Preloaded-image cache for canvas drawImage() — used when placing hero
// portraits on the board. This was referenced here but actually defined
// back in RovApp.js (outside TacticalWhiteboard's own function
// boundaries), missed during the original extraction since it's a plain
// function call, not a JSX component — moved here to where it's used.
const WB_IMG_ELEM_CACHE = {}; // { url: HTMLImageElement } — preloaded for canvas drawImage

function getPreloadedImg(url, onReady) {
  if (!url) return null;
  if (WB_IMG_ELEM_CACHE[url]) {
    const img = WB_IMG_ELEM_CACHE[url];
    return img.complete && img.naturalWidth > 0 ? img : null;
  }
  // start loading — no crossOrigin (see the note in redraw()'s map-image
  // loading for why: Vercel Blob's CORS headers aren't reliable enough for
  // this, and setting crossOrigin makes the browser refuse to display the
  // image entirely rather than degrade gracefully)
  const img = new Image();
  img.onload = () => { WB_IMG_ELEM_CACHE[url] = img; if (onReady) onReady(); };
  img.onerror = () => { WB_IMG_ELEM_CACHE[url] = null; };
  img.src = url;
  WB_IMG_ELEM_CACHE[url] = img; // store immediately (complete=false until loaded)
  return null;
}

// HeroAvatar is duplicated here (also still defined separately in
// RovApp.js, which uses it extensively elsewhere) rather than shared via
// import — small enough that keeping this file fully self-contained for
// code-splitting purposes outweighs the minor duplication.
function HeroAvatar({ name, team, size=40, style={} }) {
  const col = TEAM_COLORS[team] || TEAM_COLORS.our;
  const hero = HERO_DATA.find(h=>h.name===name);
  const imgUrl = useHeroImage(hero);
  const [imgErr, setImgErr] = useState(false);
  return (
    <div style={{
      width:size, height:size, borderRadius:"50%",
      background:col+"30", border:`2.5px solid ${col}`,
      display:"flex", flexDirection:"column", overflow:"hidden",
      alignItems:"center", justifyContent:"center",
      fontSize:size*0.28, fontWeight:900, color:col,
      userSelect:"none", flexShrink:0, position:"relative",
      ...style,
    }}>
      {imgUrl && !imgErr ? (
        <>
          <img src={imgUrl} onError={()=>setImgErr(true)} alt={name}
            style={{width:"100%",height:"100%",objectFit:"cover",position:"absolute",top:0,left:0}}/>
          <div style={{position:"absolute",bottom:0,left:0,right:0,background:"rgba(0,0,0,0.55)",
            fontSize:size*0.16,fontWeight:700,color:"#fff",textAlign:"center",
            padding:"1px 2px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {name.length>6?name.slice(0,5)+"…":name}
          </div>
        </>
      ) : (
        <>
          <div style={{lineHeight:1}}>{name.charAt(0)}</div>
          <div style={{fontSize:size*0.18,fontWeight:700,color:col+"cc",lineHeight:1,
            maxWidth:size-4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
            textAlign:"center"}}>
            {name.length>6?name.slice(0,5)+"…":name}
          </div>
        </>
      )}
    </div>
  );
}

export default function TacticalWhiteboard({ initialElements, initialFormations, initialMapUrl, onSetElements, onSetMapUrl, onAddFormation, onDeleteFormation }) {
  const canvasRef    = useRef(null);
  const overlayRef   = useRef(null); // for drawing preview
  const fileInputRef = useRef(null);
  const textInputRef = useRef(null);

  // ── hero photos from context (user-uploaded) ──
  const heroPhotos = useContext(HeroPhotosContext);

  // ── tool state ──
  const [tool,       setTool]       = useState("pen");
  const [color,      setColor]      = useState("#00cec9");
  const [size,       setSize]       = useState(4);
  const [heroTeam,   setHeroTeam]   = useState("our");
  const [heroSearch, setHeroSearch] = useState("");
  const [showHeroPicker, setShowHeroPicker] = useState(false);

  // ── canvas state ──
  const [mapImg,     setMapImg]     = useState(() => initialMapUrl || null); // background map — Vercel Blob URL (see handleMapUpload)
  const [mapUploading, setMapUploading] = useState(false);
  const [elements,   setElements]   = useState(() => initialElements || []);   // drawn elements
  const [history,    setHistory]    = useState([]);   // undo stack
  const formations = initialFormations || []; // saved formations — add/delete dispatch straight to app state (no local copy needed, prop stays in sync via the reducer)
  const [showFormations, setShowFormations] = useState(false);

  // ── sync ขึ้น app state (แล้ว autosave ที่มีอยู่แล้วจัดการบันทึกให้) ──
  // ก่อนหน้านี้ elements เป็นแค่ local state เฉยๆ ไม่เคยถูกส่งไปไหนเลย
  // พอออกจากหน้า/refresh เลยหายหมด — sync ทุกครั้งที่เปลี่ยนแทน (ข้าม
  // effect แรกตอน mount เพราะตอนนั้น elements ยังเป็นค่าที่โหลดมาเป๊ะๆ
  // ไม่มีอะไรเปลี่ยนจริง ไม่งั้นจะ trigger save เปล่าๆ ทุกครั้งที่แค่เปิดหน้านี้)
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    onSetElements?.(elements);
  }, [elements]); // eslint-disable-line react-hooks/exhaustive-deps

  // mapImg เดิมไม่เคยถูกบันทึกลง database เลย (เก็บ local state ล้วนๆ)
  // เลยหายทุกครั้งที่ออกจากหน้า/refresh — sync แยกจาก elements เพราะเป็น
  // คนละ field กัน (mount-skip ของตัวเองด้วย เหตุผลเดียวกับด้านบน)
  const mapMountedRef = useRef(false);
  useEffect(() => {
    if (!mapMountedRef.current) { mapMountedRef.current = true; return; }
    onSetMapUrl?.(mapImg);
  }, [mapImg]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── drawing state ──
  const drawing    = useRef(false);
  const startPt    = useRef(null);
  const currentPath= useRef([]);

  // ── text input state ──
  const [textMode,   setTextMode]   = useState(false);
  const [textPos,    setTextPos]    = useState(null);
  const [textVal,    setTextVal]    = useState("");
  const [editingTextIdx, setEditingTextIdx] = useState(null); // index ของ text element ที่กำลังแก้

  // ── selected element ──
  const [selected,   setSelected]   = useState(null);
  const [dragging,   setDragging]   = useState(false);
  const dragStart    = useRef(null);

  const canvasW = 800, canvasH = 600;

  // ── redraw canvas ──
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvasW, canvasH);

    // background
    ctx.fillStyle = "#0d1117";
    ctx.fillRect(0, 0, canvasW, canvasH);

    // map image
    if (mapImg) {
      const img = new Image();
      // ไม่ตั้ง crossOrigin ตรงนี้ตั้งใจ — เคยลองตั้ง "anonymous" เพื่อให้
      // ปุ่มดาวน์โหลด PNG ใช้งานได้ (toDataURL ต้องการ CORS approval) แต่
      // Vercel Blob ไม่ได้ส่ง CORS header ที่แน่นอน/สม่ำเสมอพอสำหรับเคสนี้
      // เลย — ผลคือ browser ปฏิเสธไม่โหลดรูปเลยทั้งที่ URL ถูกต้อง (เห็นเป็น
      // จอดำ) แก้โดยตัด crossOrigin ออก: รูปจะโหลด/แสดงผลได้ปกติเสมอ แลกกับ
      // canvas จะ "tainted" (เรียก toDataURL()/ดาวน์โหลด PNG ไม่ได้เฉพาะตอน
      // มีรูปแมพอยู่บนบอร์ด — ดู downloadCanvas() ที่ห่อ try/catch ไว้ให้
      // fail แบบมีข้อความบอกเหตุผล ไม่ throw error ค้าง)
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvasW, canvasH);
        drawElements(ctx);
      };
      img.src = mapImg;
    } else {
      // placeholder grid
      ctx.strokeStyle = "#1e1640";
      ctx.lineWidth = 1;
      for (let x=0; x<=canvasW; x+=50) {
        ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvasH); ctx.stroke();
      }
      for (let y=0; y<=canvasH; y+=50) {
        ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvasW,y); ctx.stroke();
      }
      ctx.fillStyle = "#2a2550";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("อัพโหลดรูปแมพ RoV ด้านบน", canvasW/2, canvasH/2);
      drawElements(ctx);
    }
  }, [mapImg, elements, selected, heroPhotos]);

  function drawElements(ctx) {
    elements.forEach((el, idx) => {
      const isSel = selected === idx;
      ctx.save();
      if (el.type === "path") {
        ctx.strokeStyle = el.color;
        ctx.lineWidth   = el.size;
        ctx.lineCap     = "round";
        ctx.lineJoin    = "round";
        ctx.beginPath();
        el.points.forEach((p, i) => i===0 ? ctx.moveTo(p.x,p.y) : ctx.lineTo(p.x,p.y));
        ctx.stroke();
        if (isSel) {
          ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.setLineDash([4,4]);
          ctx.stroke(); ctx.setLineDash([]);
        }
      } else if (el.type === "arrow") {
        drawArrow(ctx, el.x1, el.y1, el.x2, el.y2, el.color, el.size);
        if (isSel) {
          ctx.strokeStyle="#fff"; ctx.lineWidth=1; ctx.setLineDash([4,4]);
          drawArrow(ctx, el.x1, el.y1, el.x2, el.y2, "#fff", 1);
          ctx.setLineDash([]);
        }
      } else if (el.type === "text") {
        ctx.font      = `${el.size*3+10}px 'Segoe UI', sans-serif`;
        ctx.fillStyle = el.color;
        ctx.textBaseline = "top";
        ctx.fillText(el.text, el.x, el.y);
        if (isSel) {
          const m = ctx.measureText(el.text);
          ctx.strokeStyle="#fff"; ctx.lineWidth=1; ctx.setLineDash([3,3]);
          ctx.strokeRect(el.x-2, el.y-2, m.width+4, el.size*3+14);
          ctx.setLineDash([]);
        }
      } else if (el.type === "hero") {
        // draw circle with hero image (uploaded > wiki fallback > letter)
        const col = TEAM_COLORS[el.team] || TEAM_COLORS.our;
        const r   = el.r || 22;
        ctx.lineWidth   = isSel ? 3 : 2;
        // resolve best URL: user-uploaded first, then bundled local image
        const uploadedUrl = heroPhotos?.[el.name] || null;
        const localCached = LOCAL_HERO_IMG_CACHE[el.name];
        if (localCached === undefined && !uploadedUrl) {
          // not checked yet this session — kick off the check, redraw once we know
          const heroDef = HERO_DATA.find(h => h.name === el.name);
          checkLocalHeroImage(heroDef?.img).then((url) => {
            LOCAL_HERO_IMG_CACHE[el.name] = url;
            redraw();
          });
        }
        const imgUrl = uploadedUrl || localCached || null;
        // trigger preload if needed — onReady redraws the canvas
        const preloaded   = imgUrl ? getPreloadedImg(imgUrl, () => redraw()) : null;
        ctx.save();
        ctx.beginPath(); ctx.arc(el.x, el.y, r, 0, Math.PI*2); ctx.clip();
        if (preloaded) {
          ctx.drawImage(preloaded, el.x-r, el.y-r, r*2, r*2);
        } else {
          ctx.fillStyle = col+"40"; ctx.fill();
          ctx.fillStyle = col;
          ctx.font = `bold ${r*0.55}px 'Segoe UI', sans-serif`;
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(el.name.charAt(0), el.x, el.y-4);
        }
        ctx.restore();
        // draw border + name label below
        ctx.strokeStyle = col;
        ctx.lineWidth = isSel ? 3 : 2;
        ctx.beginPath(); ctx.arc(el.x, el.y, r, 0, Math.PI*2); ctx.stroke();
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(el.x-r, el.y+r*0.55, r*2, r*0.55);
        ctx.fillStyle = col;
        ctx.font = `${r*0.32}px 'Segoe UI', sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        const short = el.name.length>5 ? el.name.slice(0,5)+"…" : el.name;
        ctx.fillText(short, el.x, el.y+r*0.82);
        ctx.textAlign = "left";
      }
      ctx.restore();
    });
  }

  function drawArrow(ctx, x1, y1, x2, y2, col, w) {
    const headLen = Math.max(14, w*4);
    const angle   = Math.atan2(y2-y1, x2-x1);
    ctx.strokeStyle = col; ctx.fillStyle = col;
    ctx.lineWidth   = w; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2-headLen*Math.cos(angle-Math.PI/6), y2-headLen*Math.sin(angle-Math.PI/6));
    ctx.lineTo(x2-headLen*Math.cos(angle+Math.PI/6), y2-headLen*Math.sin(angle+Math.PI/6));
    ctx.closePath(); ctx.fill();
  }

  useEffect(() => { redraw(); }, [redraw]);

  // ── canvas coords ──
  function getPos(e) {
    const canvas = canvasRef.current;
    const rect   = canvas.getBoundingClientRect();
    const scaleX = canvasW / rect.width;
    const scaleY = canvasH / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top)  * scaleY,
    };
  }

  // ── hit test ──
  function hitTest(pos) {
    for (let i = elements.length-1; i >= 0; i--) {
      const el = elements[i];
      if (el.type==="hero") {
        const r = el.r||22;
        if (Math.hypot(pos.x-el.x, pos.y-el.y) <= r) return i;
      } else if (el.type==="text") {
        const canvas=canvasRef.current; const ctx=canvas.getContext("2d");
        ctx.font=`${el.size*3+10}px 'Segoe UI', sans-serif`;
        const w=ctx.measureText(el.text).width, h=el.size*3+14;
        if (pos.x>=el.x-2&&pos.x<=el.x+w+2&&pos.y>=el.y-2&&pos.y<=el.y+h) return i;
      } else if (el.type==="path") {
        for (let j=0;j<el.points.length-1;j++){
          const p1=el.points[j], p2=el.points[j+1];
          const d=distToSegment(pos, p1, p2);
          if (d <= Math.max(el.size+4, 8)) return i;
        }
      } else if (el.type==="arrow") {
        const d=distToSegment(pos, {x:el.x1,y:el.y1}, {x:el.x2,y:el.y2});
        if (d <= Math.max(el.size+4, 8)) return i;
      }
    }
    return null;
  }

  function distToSegment(p, a, b) {
    const dx=b.x-a.x, dy=b.y-a.y, len2=dx*dx+dy*dy;
    if (len2===0) return Math.hypot(p.x-a.x, p.y-a.y);
    let t=((p.x-a.x)*dx+(p.y-a.y)*dy)/len2;
    t=Math.max(0,Math.min(1,t));
    return Math.hypot(p.x-a.x-t*dx, p.y-a.y-t*dy);
  }

  // ── mouse handlers ──
  function onMouseDown(e) {
    if (textMode) return;
    const pos = getPos(e);

    if (tool==="select") {
      const hit = hitTest(pos);
      setSelected(hit);
      if (hit!==null) {
        setDragging(true);
        dragStart.current = { pos, el: {...elements[hit]} };
      }
      return;
    }
    // double-click ใน text tool บน text element = แก้ไข
    if (tool==="text") {
      const hit = hitTest(pos);
      if (hit!==null && elements[hit]?.type==="text") {
        // แก้ไขข้อความเดิม
        const el = elements[hit];
        setEditingTextIdx(hit);
        setTextPos({x:el.x, y:el.y});
        setTextVal(el.text);
        setTextMode(true);
        setTimeout(()=>textInputRef.current?.focus(), 50);
        return;
      }
    }
    if (tool==="erase") {
      const hit = hitTest(pos);
      if (hit!==null) deleteElement(hit);
      return;
    }
    if (tool==="text") {
      setTextPos(pos); setTextVal(""); setTextMode(true);
      setTimeout(()=>textInputRef.current?.focus(), 50);
      return;
    }
    if (tool==="hero") { setShowHeroPicker(true); return; }

    drawing.current = true;
    startPt.current = pos;
    if (tool==="pen") currentPath.current = [pos];
  }

  function onMouseMove(e) {
    if (!drawing.current && !dragging) return;
    const pos = getPos(e);

    if (dragging && selected!==null) {
      const orig = dragStart.current;
      const dx=pos.x-orig.pos.x, dy=pos.y-orig.pos.y;
      const el = orig.el;
      const updated = elements.map((item,i)=>{
        if (i!==selected) return item;
        if (item.type==="hero"||item.type==="text") return {...item, x:el.x+dx, y:el.y+dy};
        if (item.type==="arrow") return {...item, x1:el.x1+dx,y1:el.y1+dy, x2:el.x2+dx,y2:el.y2+dy};
        if (item.type==="path") return {...item, points:el.points.map(p=>({x:p.x+dx,y:p.y+dy}))};
        return item;
      });
      setElements(updated);
      return;
    }

    if (tool==="pen") {
      currentPath.current.push(pos);
      // preview on overlay
      const ov=overlayRef.current; if(!ov) return;
      const ctx=ov.getContext("2d");
      ctx.clearRect(0,0,canvasW,canvasH);
      ctx.strokeStyle=color; ctx.lineWidth=size; ctx.lineCap="round"; ctx.lineJoin="round";
      ctx.beginPath();
      currentPath.current.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));
      ctx.stroke();
    } else if (tool==="arrow") {
      const ov=overlayRef.current; if(!ov) return;
      const ctx=ov.getContext("2d");
      ctx.clearRect(0,0,canvasW,canvasH);
      drawArrow(ctx, startPt.current.x, startPt.current.y, pos.x, pos.y, color, size);
    }
  }

  function onMouseUp(e) {
    if (dragging) {
      setDragging(false); dragStart.current=null;
      pushHistory(); return;
    }
    if (!drawing.current) return;
    drawing.current=false;
    const pos=getPos(e);
    const ov=overlayRef.current;
    if(ov) ov.getContext("2d").clearRect(0,0,canvasW,canvasH);

    if (tool==="pen" && currentPath.current.length>1) {
      // สำคัญ: ต้อง snapshot ค่าออกมาเป็นตัวแปรใหม่ตรงนี้ก่อน ห้ามอ่าน
      // currentPath.current ทีหลังข้างใน setElements(prev=>...) เพราะ React
      // จะเรียก updater function นั้นทีหลัง (ไม่ใช่ตอนนี้ทันที) — ถ้าอ่านจาก
      // ref ตรงนั้น จะได้ค่าที่ currentPath.current ถูก reset เป็น [] ไปแล้ว
      // (บรรทัดท้ายฟังก์ชันนี้) กลายเป็นเส้นที่บันทึกไว้มี points ว่างเปล่า
      // วาดออกมาไม่เห็นอะไรเลย — นี่คือสาเหตุที่ปากกาดูเหมือน "เขียนแล้วหาย"
      const pathPoints = [...currentPath.current];
      const mainCtx = canvasRef.current?.getContext("2d");
      if (mainCtx && pathPoints.length > 1) {
        mainCtx.strokeStyle = color;
        mainCtx.lineWidth   = size;
        mainCtx.lineCap     = "round";
        mainCtx.lineJoin    = "round";
        mainCtx.beginPath();
        pathPoints.forEach((p, i) =>
          i === 0 ? mainCtx.moveTo(p.x, p.y) : mainCtx.lineTo(p.x, p.y)
        );
        mainCtx.stroke();
      }
      // บันทึกเข้า state (redraw จาก state จะ sync ในภายหลัง)
      pushHistory();
      setElements(prev=>[...prev,{type:"path",points:pathPoints,color,size}]);
    } else if (tool==="arrow") {
      // เก็บ snapshot ไว้เหมือนกัน แม้ตอนนี้ startPt.current จะไม่ได้ถูก
      // reset ก่อนหน้า setElements ตรงนี้ (เลยไม่เคยเกิดบั๊กแบบเดียวกัน) —
      // กันไว้ล่วงหน้าเผื่อมีคนแก้โค้ดส่วนอื่นทีหลังแล้วเผลอไปเพิ่ม reset
      // เข้ามาระหว่างนี้
      const x1 = startPt.current.x, y1 = startPt.current.y;
      pushHistory();
      setElements(prev=>[...prev,{type:"arrow",x1,y1,x2:pos.x,y2:pos.y,color,size}]);
    }
    currentPath.current=[];
  }

  function commitText() {
    if (textVal.trim()) {
      pushHistory();
      if (editingTextIdx !== null) {
        // แก้ไขข้อความเดิม
        setElements(prev => prev.map((el,i) =>
          i===editingTextIdx ? {...el, text:textVal} : el
        ));
      } else {
        // สร้างข้อความใหม่
        setElements(prev=>[...prev,{type:"text",x:textPos.x,y:textPos.y,text:textVal,color,size}]);
      }
    }
    setTextMode(false); setTextVal(""); setTextPos(null); setEditingTextIdx(null);
  }

  function placeHero(name) {
    const pos = { x: canvasW/2 + (Math.random()-0.5)*100, y: canvasH/2 + (Math.random()-0.5)*80 };
    pushHistory();
    setElements(prev=>[...prev,{type:"hero",x:pos.x,y:pos.y,name,team:heroTeam,r:22}]);
    setShowHeroPicker(false); setHeroSearch("");
  }

  function deleteElement(idx) {
    pushHistory();
    setElements(prev=>prev.filter((_,i)=>i!==idx));
    setSelected(null);
  }

  function pushHistory() {
    setHistory(prev=>[...prev.slice(-29), elements]);
  }

  function undo() {
    if (!history.length) return;
    setElements(history[history.length-1]);
    setHistory(prev=>prev.slice(0,-1));
    setSelected(null);
  }

  function clearAll() {
    if (!window.confirm("ล้าง canvas ทั้งหมด?")) return;
    pushHistory(); setElements([]); setSelected(null);
  }

  function saveFormation() {
    const name = prompt("ชื่อ Formation นี้:");
    if (!name?.trim()) return;
    onAddFormation?.({name:name.trim(), elements:[...elements], mapUrl:mapImg, time:new Date().toLocaleString("th-TH")});
  }

  function loadFormation(f) {
    pushHistory();
    setElements([...f.elements]);
    if (f.mapUrl !== undefined) setMapImg(f.mapUrl); // formations saved before this fix won't have mapUrl — leave the current map as-is rather than blanking it
    setShowFormations(false);
  }

  function downloadCanvas() {
    // flatten canvas + overlay into one image
    const out = document.createElement("canvas");
    out.width=canvasW; out.height=canvasH;
    const ctx=out.getContext("2d");
    ctx.drawImage(canvasRef.current,0,0);
    try {
      const a=document.createElement("a");
      a.download=`formation_${Date.now()}.png`;
      a.href=out.toDataURL("image/png");
      a.click();
    } catch (err) {
      // canvas "tainted" — เกิดเฉพาะตอนมีรูปแมพอยู่บนบอร์ด (Vercel Blob
      // ไม่ส่ง CORS header ที่ใช้ export ได้ ดู redraw()'s comment) ดักไว้
      // ให้ error message ชัดเจน แทนที่จะปล่อยให้ throw เงียบๆ
      console.error("Canvas export failed (likely tainted by cross-origin map image):", err);
      alert("ดาวน์โหลดรูปไม่ได้ เพราะมีรูปแผนที่ที่โหลดจากภายนอกอยู่บนบอร์ด (ข้อจำกัดของเบราว์เซอร์ ไม่ใช่บั๊ก) — ลองเอารูปแผนที่ออกก่อนแล้วดาวน์โหลดใหม่");
    }
  }

  // เดิม: อ่านไฟล์เป็น base64 เก็บใน local state ตรงๆ — ไม่เคยเซฟลง
  // database เลย (แค่ local ก็หายทุก refresh อยู่แล้ว) และต่อให้เซฟ ก็ไม่
  // ควรเก็บ base64 ดิบๆ ในฐานข้อมูลด้วย (บวมเปล่าๆ) — เปลี่ยนมาอัปโหลดขึ้น
  // Vercel Blob เหมือนรูปอื่นๆ ในแอปทั้งหมด แล้วเก็บแค่ URL แทน
  async function handleMapUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (file.size > 5 * 1024 * 1024) {
      alert("ไฟล์รูปแผนที่ใหญ่เกินไป (จำกัด 5MB) — กรุณาเลือกรูปที่เล็กกว่านี้");
      return;
    }

    setMapUploading(true);
    try {
      const compressed = await compressImage(file);
      const uploaded = await upload("whiteboard-map.jpg", compressed, {
        access: "public",
        handleUploadUrl: "/api/upload",
      });
      const previousMap = mapImg;
      setMapImg(uploaded.url);
      if (previousMap && previousMap.startsWith("http")) deleteBlobUrls(previousMap); // เคลียร์รูปแผนที่เก่าทิ้ง
    } catch (err) {
      console.error("Map upload failed:", err);
      alert("อัปโหลดรูปแผนที่ไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setMapUploading(false);
    }
  }

  function removeMap() {
    if (!window.confirm("เอารูปแผนที่ออก?")) return;
    if (mapImg && mapImg.startsWith("http")) deleteBlobUrls(mapImg);
    setMapImg(null);
  }

  const filteredHeroes = HERO_DATA.filter(h=>h.name.toLowerCase().includes(heroSearch.toLowerCase()));

  return (
    <div style={{height:"calc(100vh - 114px)",background:C.bg,color:C.textMain,
      fontFamily:"'Segoe UI',sans-serif",display:"flex",flexDirection:"column"}}>

      {/* ── HEADER ── */}
      <div style={{background:"linear-gradient(90deg,#12072a,#0a0a16)",
        borderBottom:`1px solid ${C.border}`,padding:"0 20px",
        display:"flex",alignItems:"center",height:54,gap:14,flexShrink:0}}>
        <span style={{fontSize:20}}>🗺️</span>
        <span style={{fontWeight:900,fontSize:16,letterSpacing:2,color:C.primaryLight}}>
          RoV TACTICAL WHITEBOARD
        </span>
        <div style={{flex:1}}/>
        {/* map upload */}
        <label style={{background:C.primary+"30",border:`1px solid ${C.primary}60`,
          color:C.primaryLight,borderRadius:8,padding:"5px 14px",cursor:mapUploading?"not-allowed":"pointer",
          fontSize:12,fontWeight:700,opacity:mapUploading?0.6:1}}>
          {mapUploading ? "⏳ กำลังอัปโหลด..." : "📂 อัพโหลดแมพ"}
          <input type="file" accept="image/*" style={{display:"none"}} disabled={mapUploading}
            ref={fileInputRef} onChange={handleMapUpload}/>
        </label>
        {mapImg && (
          <button onClick={removeMap}
            style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textMuted,
              borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:12,fontWeight:700}}>
            ✕ เอาแมพออก
          </button>
        )}
        <button onClick={saveFormation}
          style={{background:C.primary,color:"#fff",border:"none",borderRadius:8,
            padding:"5px 14px",cursor:"pointer",fontSize:12,fontWeight:700}}>
          💾 บันทึก Formation
        </button>
        <button onClick={()=>setShowFormations(v=>!v)}
          style={{background:showFormations?C.primary+"40":"transparent",
            border:`1px solid ${C.primary}60`,color:C.primaryLight,borderRadius:8,
            padding:"5px 14px",cursor:"pointer",fontSize:12,fontWeight:700}}>
          📋 Formations ({formations.length})
        </button>
        <button onClick={downloadCanvas}
          style={{background:"#00b89430",border:`1px solid #00b89460`,
            color:"#00b894",borderRadius:8,padding:"5px 14px",cursor:"pointer",
            fontSize:12,fontWeight:700}}>
          ⬇️ Export PNG
        </button>
      </div>

      <div style={{display:"flex",flex:1,overflow:"hidden"}}>

        {/* ── LEFT TOOLBAR ── */}
        <div style={{width:64,background:C.panel,borderRight:`1px solid ${C.border}`,
          display:"flex",flexDirection:"column",alignItems:"center",padding:"10px 0",gap:4}}>
          {TOOLS.map(t=>(
            <button key={t.id} onClick={()=>{setTool(t.id);setSelected(null);setTextMode(false);}}
              title={t.label}
              style={{width:44,height:44,borderRadius:10,cursor:"pointer",fontSize:18,
                display:"flex",alignItems:"center",justifyContent:"center",
                background:tool===t.id?C.primary+"50":"transparent",
                border:`1.5px solid ${tool===t.id?C.primary:C.border}`,
                color:tool===t.id?C.primaryLight:C.textMuted}}>
              {t.icon}
            </button>
          ))}
          <div style={{height:1,width:40,background:C.border,margin:"6px 0"}}/>
          <button onClick={undo} title="Undo"
            style={{width:44,height:44,borderRadius:10,cursor:"pointer",fontSize:16,
              display:"flex",alignItems:"center",justifyContent:"center",
              background:"transparent",border:`1.5px solid ${C.border}`,color:C.textMuted}}>
            ↩
          </button>
          <button onClick={clearAll} title="Clear All"
            style={{width:44,height:44,borderRadius:10,cursor:"pointer",fontSize:16,
              display:"flex",alignItems:"center",justifyContent:"center",
              background:"transparent",border:`1.5px solid #ff475740`,color:"#ff4757"}}>
            🗑️
          </button>
        </div>

        {/* ── CANVAS AREA ── */}
        <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",
          background:"#080612",position:"relative",overflow:"hidden"}}>
          <div style={{position:"relative",
            boxShadow:"0 8px 40px rgba(0,0,0,0.6)",
            borderRadius:4,overflow:"hidden"}}>
            {/* main canvas */}
            <canvas ref={canvasRef} width={canvasW} height={canvasH}
              style={{display:"block",maxWidth:"100%",maxHeight:"calc(100vh - 174px)",
                cursor:tool==="pen"?"crosshair":tool==="arrow"?"crosshair":
                       tool==="text"?"text":tool==="erase"?"cell":
                       tool==="hero"?"copy":"default"}}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
              onDoubleClick={e=>{
                const pos = getPos(e);
                const hit = hitTest(pos);
                if (hit!==null && elements[hit]?.type==="text") {
                  const el = elements[hit];
                  setEditingTextIdx(hit);
                  setTextPos({x:el.x, y:el.y});
                  setTextVal(el.text);
                  setTextMode(true);
                  setTimeout(()=>textInputRef.current?.focus(), 50);
                }
              }}
            />
            {/* overlay canvas for live preview */}
            <canvas ref={overlayRef} width={canvasW} height={canvasH}
              style={{position:"absolute",top:0,left:0,pointerEvents:"none",
                maxWidth:"100%",maxHeight:"calc(100vh - 174px)"}}
            />
            {/* text input overlay */}
            {textMode && textPos && (
              <div style={{position:"absolute",
                left:`${(textPos.x/canvasW)*100}%`,
                top:`${(textPos.y/canvasH)*100}%`,
                transform:"translate(0,-50%)"}}>
                <input ref={textInputRef}
                  value={textVal} onChange={e=>setTextVal(e.target.value)}
                  onKeyDown={e=>{ if(e.key==="Enter")commitText(); if(e.key==="Escape"){setTextMode(false);setTextVal("");setEditingTextIdx(null);} }}
                  onBlur={commitText}
                  style={{background:"rgba(20,17,42,0.92)",border:`2px solid ${editingTextIdx!==null?C.win:C.primary}`,
                    color:color,borderRadius:4,padding:"3px 8px",
                    fontSize:`${size*3+10}px`,outline:"none",minWidth:120,fontWeight:700}}
                  placeholder={editingTextIdx!==null?"แก้ไขข้อความ...":"พิมพ์ข้อความ..."}/>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div style={{width:220,background:C.panel,borderLeft:`1px solid ${C.border}`,
          padding:"14px 12px",display:"flex",flexDirection:"column",gap:14,overflowY:"auto"}}>

          {/* Tool info */}
          <div>
            <div style={{fontSize:10,color:C.textMuted,fontWeight:700,marginBottom:8,letterSpacing:1}}>
              TOOL: {TOOLS.find(t=>t.id===tool)?.label?.toUpperCase()}
            </div>

            {/* color picker */}
            {["pen","arrow","text"].includes(tool)&&(
              <>
                <div style={{fontSize:10,color:C.textMuted,marginBottom:5}}>สี</div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>
                  {COLORS.map(c=>(
                    <div key={c} onClick={()=>setColor(c)}
                      style={{width:22,height:22,borderRadius:"50%",background:c,cursor:"pointer",
                        border:`2.5px solid ${color===c?"#fff":"transparent"}`,
                        boxShadow:color===c?"0 0 6px #fff6":"none"}}/>
                  ))}
                </div>
                <div style={{fontSize:10,color:C.textMuted,marginBottom:5}}>ขนาด</div>
                <div style={{display:"flex",gap:6,marginBottom:10}}>
                  {SIZES.map(s=>(
                    <div key={s} onClick={()=>setSize(s)}
                      style={{width:28,height:28,borderRadius:6,background:size===s?C.primary+"40":"transparent",
                        border:`1.5px solid ${size===s?C.primary:C.border}`,
                        display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                      <div style={{width:s*1.5,height:s*1.5,borderRadius:"50%",background:color}}/>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* hero team selector */}
            {tool==="hero"&&(
              <>
                <div style={{fontSize:10,color:C.textMuted,marginBottom:5}}>ทีม</div>
                <div style={{display:"flex",gap:6,marginBottom:10}}>
                  {[{id:"our",label:"🛡️ เรา",col:TEAM_COLORS.our},
                    {id:"enemy",label:"⚔️ คู่แข่ง",col:TEAM_COLORS.enemy}].map(t=>(
                    <button key={t.id} onClick={()=>setHeroTeam(t.id)}
                      style={{flex:1,background:heroTeam===t.id?t.col+"30":"transparent",
                        border:`1.5px solid ${heroTeam===t.id?t.col:C.border}`,
                        color:heroTeam===t.id?t.col:C.textMuted,
                        borderRadius:8,padding:"5px 4px",cursor:"pointer",fontSize:10,fontWeight:700}}>
                      {t.label}
                    </button>
                  ))}
                </div>
                <button onClick={()=>setShowHeroPicker(true)}
                  style={{width:"100%",background:C.primary,color:"#fff",border:"none",
                    borderRadius:8,padding:"7px 0",cursor:"pointer",fontSize:12,fontWeight:800}}>
                  + วาง Hero บนแมพ
                </button>
              </>
            )}

            {/* select tool actions */}
            {tool==="select"&&selected!==null&&(
              <div style={{marginTop:8}}>
                <div style={{fontSize:11,color:C.primaryLight,fontWeight:700,marginBottom:8}}>
                  เลือก element #{selected+1}
                </div>
                <button onClick={()=>deleteElement(selected)}
                  style={{width:"100%",background:"#ff475720",border:"1px solid #ff475740",
                    color:"#ff4757",borderRadius:7,padding:"6px 0",cursor:"pointer",
                    fontSize:12,fontWeight:700}}>
                  🗑️ ลบ element นี้
                </button>
              </div>
            )}
          </div>

          {/* On-canvas heroes list */}
          {elements.filter(e=>e.type==="hero").length>0&&(
            <div>
              <div style={{fontSize:10,color:C.textMuted,fontWeight:700,marginBottom:8,letterSpacing:1}}>
                HEROES บนแมพ
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:5}}>
                {elements.map((el,i)=>el.type!=="hero"?null:(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:7,
                    background:C.card,borderRadius:8,padding:"5px 8px",
                    border:`1px solid ${selected===i?TEAM_COLORS[el.team]:C.border}`,
                    cursor:"pointer"}}
                    onClick={()=>{setTool("select");setSelected(i);}}>
                    <HeroAvatar name={el.name} team={el.team} size={28}/>
                    <span style={{fontSize:11,fontWeight:700,flex:1,overflow:"hidden",
                      textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{el.name}</span>
                    <button onClick={e=>{e.stopPropagation();deleteElement(i);}}
                      style={{background:"none",border:"none",color:"#ff4757",
                        cursor:"pointer",fontSize:13,padding:0}}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* tips */}
          <div style={{fontSize:10,color:C.textMuted,lineHeight:1.7,marginTop:"auto",
            background:C.card,borderRadius:8,padding:"8px 10px"}}>
            <div style={{fontWeight:700,color:C.primaryLight,marginBottom:4}}>💡 Tips</div>
            <div>✏️ วาดเส้นอิสระ</div>
            <div>→ วาดลูกศรทิศทาง</div>
            <div>T พิมพ์ข้อความ</div>
            <div>🖱️ ดับเบิ้ลคลิก text = แก้ไข</div>
            <div>🦸 วาง Hero icon</div>
            <div>↖ Select & ย้าย</div>
            <div>⌫ ลบ element</div>
            <div>↩ Undo (toolbar)</div>
          </div>
        </div>
      </div>

      {/* ── HERO PICKER MODAL ── */}
      {showHeroPicker&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",
          display:"flex",alignItems:"center",justifyContent:"center",zIndex:999}}>
          <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:16,
            padding:20,width:420,maxHeight:"80vh",display:"flex",flexDirection:"column"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
              <h3 style={{margin:0,fontSize:16,fontWeight:800,color:C.primaryLight}}>
                เลือก Hero — {heroTeam==="our"?"🛡️ ทีมเรา":"⚔️ คู่แข่ง"}
              </h3>
              <button onClick={()=>{setShowHeroPicker(false);setHeroSearch("");}}
                style={{marginLeft:"auto",background:"none",border:"none",
                  color:C.textMuted,cursor:"pointer",fontSize:20}}>✕</button>
            </div>
            <input value={heroSearch} onChange={e=>setHeroSearch(e.target.value)}
              placeholder="🔍 ค้นหา Hero..." autoFocus
              style={{background:C.card,border:`1px solid ${C.border}`,color:C.textMain,
                borderRadius:8,padding:"7px 12px",fontSize:13,outline:"none",marginBottom:10}}/>
            <div style={{overflowY:"auto",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))",gap:6}}>
              {filteredHeroes.map(h=>(
                <button key={h.name} onClick={()=>placeHero(h.name)}
                  style={{background:C.card,border:`1px solid ${C.border}`,
                    color:C.textMain,borderRadius:8,padding:"8px 4px",cursor:"pointer",
                    fontSize:11,fontWeight:700,textAlign:"center",
                    display:"flex",flexDirection:"column",alignItems:"center",gap:4}}
                  onMouseEnter={e=>e.currentTarget.style.borderColor=TEAM_COLORS[heroTeam]}
                  onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
                  <HeroAvatar name={h.name} team={heroTeam} size={36}/>
                  <span style={{fontSize:9,lineHeight:1.2,overflow:"hidden",
                    textOverflow:"ellipsis",whiteSpace:"nowrap",width:"100%",
                    textAlign:"center"}}>{h.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── FORMATIONS PANEL ── */}
      {showFormations&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",
          display:"flex",alignItems:"center",justifyContent:"center",zIndex:998}}>
          <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:16,
            padding:20,width:380,maxHeight:"70vh",display:"flex",flexDirection:"column"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
              <h3 style={{margin:0,fontSize:15,fontWeight:800,color:C.primaryLight}}>
                📋 Formations ที่บันทึกไว้
              </h3>
              <button onClick={()=>setShowFormations(false)}
                style={{marginLeft:"auto",background:"none",border:"none",
                  color:C.textMuted,cursor:"pointer",fontSize:20}}>✕</button>
            </div>
            {formations.length===0?(
              <div style={{textAlign:"center",padding:"30px 0",color:C.textMuted,fontSize:12}}>
                ยังไม่มี Formation — วาดแล้วกด "💾 บันทึก Formation"
              </div>
            ):(
              <div style={{overflowY:"auto",display:"flex",flexDirection:"column",gap:8}}>
                {formations.map((f)=>(
                  <div key={f.id} style={{background:C.card,border:`1px solid ${C.border}`,
                    borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:13,color:C.primaryLight}}>{f.name}</div>
                      <div style={{fontSize:10,color:C.textMuted,marginTop:2}}>
                        {f.time} · {f.elements.length} elements
                      </div>
                    </div>
                    <button onClick={()=>loadFormation(f)}
                      style={{background:C.primary,color:"#fff",border:"none",
                        borderRadius:7,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700}}>
                      โหลด
                    </button>
                    <button onClick={()=>onDeleteFormation?.(f.id)}
                      style={{background:"#ff475720",border:"1px solid #ff475740",color:"#ff4757",
                        borderRadius:7,padding:"5px 8px",cursor:"pointer",fontSize:11}}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

