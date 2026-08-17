"use client";
// components/shared/TeamLogo.js
// ── Extracted from components/RovApp.js ──
// LogoImg (circular team/rival logo with initials fallback) and
// LogoUploader (upload/crop flow for it) — grouped together because
// LogoUploader renders LogoImg directly for its preview, same pairing
// pattern as PlayerAvatar/PhotoPicker in PlayerMedia.js. LogoImg alone is
// used in several other places across the app (draft summary rows, match
// cards, schedule entries, team settings), so it's exported on its own
// too, not just via LogoUploader.

import { useState, useRef } from "react";
import { upload } from "@vercel/blob/client";
import { deleteBlobUrls } from "@/lib/blobCleanup";
import { compressImage } from "@/lib/imageCompress";
import { C } from "@/lib/theme";
import { useToast } from "@/lib/toast";
import { ImageCropModal } from "@/components/shared/PlayerMedia";

// ═══════════════════════════════════════════
//  TEAM / RIVAL LOGO UPLOADER
// ═══════════════════════════════════════════
export function LogoImg({ url, name, size=48, style={} }) {
  const [err, setErr] = useState(false);
  if (!url || err) {
    // fallback: วงกลมสีพร้อมตัวอักษรแรก
    const initials = (name||"?").slice(0,2).toUpperCase();
    return (
      <div style={{width:size,height:size,borderRadius:"50%",
        background:`linear-gradient(135deg,${C.primary},${C.primaryLight})`,
        display:"flex",alignItems:"center",justifyContent:"center",
        fontWeight:900,fontSize:size*0.35,color:"#fff",flexShrink:0,...style}}>
        {initials}
      </div>
    );
  }
  return (
    <img src={url} alt={name} onError={()=>setErr(true)}
      style={{width:size,height:size,borderRadius:"50%",
        objectFit:"cover",flexShrink:0,...style}}/>
  );
}

export function LogoUploader({ label, currentUrl, onUpload, onRemove, size=64 }) {
  const [uploading, setUploading] = useState(false);
  const [cropFile, setCropFile] = useState(null);
  const fileRef = useRef(null);
  const toast = useToast();

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCropFile(file);
  }

  async function handleCropConfirm(blob) {
    setCropFile(null);
    setUploading(true);
    try {
      if (blob.size > 1.5*1024*1024) {
        toast("ไฟล์รูปใหญ่เกินไป (จำกัด 1.5MB)", "error");
        return;
      }
      const compressed = await compressImage(blob);
      const uploaded = await upload("logo.jpg", compressed, { access:"public", handleUploadUrl:"/api/upload" });
      onUpload(uploaded.url);
      if (currentUrl && currentUrl !== uploaded.url) deleteBlobUrls(currentUrl); // clean up the old logo
      toast(`อัพโหลดโลโก้ ${label} สำเร็จ`, "success");
    } catch {
      toast("อัพโหลดไม่สำเร็จ ลองใหม่อีกครั้ง", "error");
    } finally { setUploading(false); if(fileRef.current) fileRef.current.value=""; }
  }

  return (
    <div style={{display:"flex",alignItems:"center",gap:12}}>
      {cropFile && (
        <ImageCropModal file={cropFile} title={`ปรับโลโก้ ${label}`}
          onConfirm={handleCropConfirm}
          onCancel={()=>{setCropFile(null); if(fileRef.current) fileRef.current.value="";}}
        />
      )}
      <LogoImg url={currentUrl} name={label} size={size}/>
      <div>
        <div style={{fontSize:11,color:C.textMuted,marginBottom:6,fontWeight:700}}>{label}</div>
        <div style={{display:"flex",gap:6}}>
          <label style={{background:C.primary+"20",border:`1px solid ${C.primary}40`,
            color:C.primaryLight,borderRadius:7,padding:"4px 12px",
            cursor:uploading?"default":"pointer",opacity:uploading?0.6:1,
            fontSize:11,fontWeight:700}}>
            {uploading?"⏳...":"📸 อัพโหลดโลโก้"}
            <input ref={fileRef} type="file" accept="image/*" disabled={uploading}
              style={{display:"none"}} onChange={handleFile}/>
          </label>
          {currentUrl&&(
            <button onClick={()=>{deleteBlobUrls(currentUrl);onRemove();}}
              style={{background:"transparent",border:`1px solid ${C.lose}40`,
                color:C.lose,borderRadius:7,padding:"4px 10px",
                cursor:"pointer",fontSize:11,fontWeight:700}}>
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
