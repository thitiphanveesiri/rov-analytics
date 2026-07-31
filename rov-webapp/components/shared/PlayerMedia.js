"use client";
// components/shared/PlayerMedia.js
// ── Extracted from components/RovApp.js ──
// Player photo display + upload/crop flow, moved verbatim (no logic
// changes). Grouped together because PhotoPicker depends on the other two
// directly (renders PlayerAvatar for the preview, opens ImageCropModal
// before upload).

import { useState, useEffect, useRef } from "react";
import { upload } from "@vercel/blob/client";
import { deleteBlobUrls } from "@/lib/blobCleanup";
import { compressImage } from "@/lib/imageCompress";
import { C, iStyle } from "@/lib/theme";

// ── PlayerAvatar: circular photo/initial, used for both our + enemy players ──
export function PlayerAvatar({ name, photoUrl, size=44, team="our", style={} }) {
  const [err, setErr] = useState(false);
  const col = team==="our" ? C.primaryLight : C.lose;
  return (
    <div style={{position:"relative",width:size,height:size,borderRadius:"50%",
      overflow:"hidden",background:col+"22",border:`2px solid ${col}55`,
      flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",...style}}>
      {photoUrl && !err ? (
        <img src={photoUrl} onError={()=>setErr(true)} alt={name}
          style={{width:"100%",height:"100%",objectFit:"cover"}}/>
      ) : (
        <span style={{fontSize:size*0.38,fontWeight:800,color:col}}>
          {(name||"?").charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );
}

// ── ImageCropModal: drag/zoom crop UI shown before a picked photo uploads ──
export function ImageCropModal({ file, onConfirm, onCancel, round=false, title="ปรับตำแหน่ง/ขนาดรูป" }) {
  const [imgUrl, setImgUrl] = useState(null);
  const [natural, setNatural] = useState({ w:0, h:0 });
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x:0, y:0 });
  const [saving, setSaving] = useState(false);
  const dragRef = useRef(null);
  const imgRef = useRef(null);
  const CONTAINER = 280;

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function handleImgLoad(e) {
    setNatural({ w:e.target.naturalWidth, h:e.target.naturalHeight });
    setZoom(1); setPos({x:0,y:0});
  }

  const baseScale = natural.w && natural.h ? Math.max(CONTAINER/natural.w, CONTAINER/natural.h) : 1;
  const scale = baseScale * zoom;
  const dispW = natural.w * scale, dispH = natural.h * scale;

  function clamp(p) {
    // กันลากรูปหลุดจนเห็นพื้นที่ว่างในกรอบ
    const maxX = Math.max(0, (dispW - CONTAINER) / 2);
    const maxY = Math.max(0, (dispH - CONTAINER) / 2);
    return { x: Math.min(maxX, Math.max(-maxX, p.x)), y: Math.min(maxY, Math.max(-maxY, p.y)) };
  }

  function getPoint(e) {
    const t = e.touches ? e.touches[0] : e;
    return { x:t.clientX, y:t.clientY };
  }
  function onPointerDown(e) {
    const p = getPoint(e);
    dragRef.current = { startX:p.x, startY:p.y, origX:pos.x, origY:pos.y };
  }
  function onPointerMove(e) {
    if (!dragRef.current) return;
    const p = getPoint(e);
    const dx = p.x - dragRef.current.startX, dy = p.y - dragRef.current.startY;
    setPos(clamp({ x: dragRef.current.origX + dx, y: dragRef.current.origY + dy }));
  }
  function onPointerUp() { dragRef.current = null; }

  function confirm() {
    setSaving(true);
    const OUT = 480;
    const canvas = document.createElement("canvas");
    canvas.width = OUT; canvas.height = OUT;
    const ctx = canvas.getContext("2d");
    const drawScale = OUT / CONTAINER;
    const imgLeft = (CONTAINER - dispW)/2 + pos.x;
    const imgTop  = (CONTAINER - dispH)/2 + pos.y;
    ctx.drawImage(imgRef.current, 0,0,natural.w,natural.h,
      imgLeft*drawScale, imgTop*drawScale, dispW*drawScale, dispH*drawScale);
    canvas.toBlob(blob => {
      setSaving(false);
      if (blob) onConfirm(blob); else onCancel();
    }, "image/jpeg", 0.92);
  }

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",zIndex:600,
      display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:16,padding:20,
        width:360,maxWidth:"100%"}}>
        <div style={{fontWeight:800,fontSize:14,marginBottom:12,color:C.primaryLight}}>{title}</div>
        <div
          onMouseDown={onPointerDown} onMouseMove={onPointerMove} onMouseUp={onPointerUp} onMouseLeave={onPointerUp}
          onTouchStart={onPointerDown} onTouchMove={onPointerMove} onTouchEnd={onPointerUp}
          style={{width:CONTAINER,height:CONTAINER,margin:"0 auto",position:"relative",overflow:"hidden",
            borderRadius:round?"50%":12,background:"#000",cursor:dragRef.current?"grabbing":"grab",
            touchAction:"none",border:`2px solid ${C.border}`}}>
          {imgUrl && (
            <img ref={imgRef} src={imgUrl} onLoad={handleImgLoad} draggable={false} alt=""
              style={{
                position:"absolute",
                left: (CONTAINER - dispW)/2 + pos.x,
                top:  (CONTAINER - dispH)/2 + pos.y,
                width: dispW, height: dispH,
                userSelect:"none", pointerEvents:"none",
              }}/>
          )}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginTop:14}}>
          <span style={{fontSize:16}}>🔍</span>
          <input type="range" min="1" max="3" step="0.02" value={zoom}
            onChange={e=>setZoom(Number(e.target.value))} style={{flex:1}}/>
        </div>
        <div style={{fontSize:11,color:C.textMuted,textAlign:"center",marginTop:6}}>
          ลากรูปเพื่อขยับตำแหน่ง · เลื่อนแถบเพื่อซูมเข้า-ออก
        </div>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:16}}>
          <button onClick={onCancel} disabled={saving}
            style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textMuted,
              borderRadius:8,padding:"9px 18px",cursor:"pointer",fontWeight:700,fontSize:13}}>
            ยกเลิก
          </button>
          <button onClick={confirm} disabled={saving || !imgUrl}
            style={{background:C.primary,color:"#fff",border:"none",borderRadius:8,
              padding:"9px 22px",cursor:"pointer",fontWeight:700,fontSize:13,opacity:saving?0.6:1}}>
            {saving?"กำลังตัด...":"✅ ใช้รูปนี้"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PhotoPicker: upload button + crop flow + URL-paste fallback ──
export function PhotoPicker({ value, onChange, size=72, team="our" }) {
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlVal, setUrlVal] = useState(value && value.startsWith("http") ? value : "");
  const fileRef = useRef(null);

  const [uploading, setUploading] = useState(false);
  const [cropFile, setCropFile] = useState(null);

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCropFile(file); // เปิดหน้าต่างปรับตำแหน่ง/ซูมก่อน แล้วค่อยอัปโหลดตอนกดยืนยัน
  }

  async function handleCropConfirm(blob) {
    setCropFile(null);
    setUploading(true);
    try {
      if (blob.size > 1.5*1024*1024) {
        alert("ไฟล์รูปใหญ่เกินไป (จำกัด 1.5MB) — กรุณาเลือกรูปที่เล็กกว่านี้");
        return;
      }
      const compressed = await compressImage(blob);
      const uploaded = await upload("photo.jpg", compressed, { access: "public", handleUploadUrl: "/api/upload" });
      onChange(uploaded.url);
      if (value && value !== uploaded.url) deleteBlobUrls(value); // clean up the old photo
    } catch (err) {
      console.error("Photo upload failed:", err);
      alert("อัพโหลดรูปไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
      {cropFile && (
        <ImageCropModal file={cropFile} round
          onConfirm={handleCropConfirm}
          onCancel={()=>{setCropFile(null); if(fileRef.current) fileRef.current.value="";}}
        />
      )}
      <div style={{position:"relative"}}>
        <PlayerAvatar name="?" photoUrl={value} size={size} team={team}/>
        {value && (
          <button onClick={()=>{deleteBlobUrls(value);onChange(null);setUrlVal("");}}
            style={{position:"absolute",top:-4,right:-4,width:20,height:20,borderRadius:"50%",
              background:C.lose,border:"none",color:"#fff",cursor:"pointer",fontSize:11,
              display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800}}>
            ✕
          </button>
        )}
      </div>
      <div style={{display:"flex",gap:5}}>
        <label style={{background:C.primary+"20",border:`1px solid ${C.primary}50`,
          color:C.primaryLight,borderRadius:6,padding:"3px 9px",cursor:"pointer",
          fontSize:10,fontWeight:700}}>
          📂 อัพโหลด
          <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleFile}/>
        </label>
        <button onClick={()=>setShowUrlInput(v=>!v)}
          style={{background:showUrlInput?C.primary+"30":"transparent",
            border:`1px solid ${C.border}`,color:C.textMuted,borderRadius:6,
            padding:"3px 9px",cursor:"pointer",fontSize:10,fontWeight:700}}>
          🔗 URL
        </button>
      </div>
      {showUrlInput && (
        <div style={{display:"flex",gap:4,width:"100%"}}>
          <input value={urlVal} onChange={e=>setUrlVal(e.target.value)}
            placeholder="https://..." style={{...iStyle,padding:"4px 8px",fontSize:10,flex:1}}/>
          <button onClick={()=>{if(urlVal.trim())onChange(urlVal.trim());}}
            style={{background:C.primary,color:"#fff",border:"none",borderRadius:6,
              padding:"0 10px",cursor:"pointer",fontSize:10,fontWeight:700}}>
            ✓
          </button>
        </div>
      )}
    </div>
  );
}
