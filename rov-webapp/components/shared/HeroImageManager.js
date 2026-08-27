"use client";
// components/shared/HeroImageManager.js
// ── Extracted from components/RovApp.js ──
// Hero photo management module, moved as one unit: HeroImageManager (bulk
// upload + per-hero editor), AddHeroModal, HeroImageSlot, and HeroAvatar
// (the small circular hero icon used all over the app for draft/roster
// displays). All four sit together in the original source and share the
// same photo-lookup plumbing (useHeroImage). Only pulled in the ONE
// constant HeroAvatar actually needs (TEAM_COLORS) — the rest of the
// constants that used to sit next to it in RovApp.js (HERO_LIST,
// ROLE_COLORS, TOOLS, COLORS, SIZES) turned out to be leftover dead code
// from the original TacticalWhiteboard extraction: TOOLS/COLORS/SIZES/
// TEAM_COLORS are already properly duplicated inside
// components/shared/TacticalWhiteboard.js (where they're actually used),
// and HERO_LIST/ROLE_COLORS aren't used ANYWHERE in the codebase at all —
// so those five were simply deleted from RovApp.js instead of moved.

import { useState, useRef } from "react";
import { upload } from "@vercel/blob/client";
import { C, iStyle } from "@/lib/theme";
import { HERO_DATA, ROLES_PICK, ROLE_COLOR } from "@/lib/heroes";
import { useHeroImage } from "@/lib/useHeroImage";
import { deleteBlobUrls } from "@/lib/blobCleanup";
import { compressImage } from "@/lib/imageCompress";
import { PhotoPicker, ImageCropModal } from "@/components/shared/PlayerMedia";

// team-color accent used only by HeroAvatar below (see file header note)
const TEAM_COLORS = { our:"#00cec9", enemy:"#fd79a8" };

export function HeroImageManager({ heroPhotos, onSetPhoto, onSetPhotosBulk, onRemovePhoto, onAddHero, onSetRole, onRemoveHero }) {
  const [search,     setSearch]     = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [dragOver,   setDragOver]   = useState(false);
  const [matchLog,   setMatchLog]   = useState(null);
  const [bulkUploading, setBulkUploading] = useState(false); // { matched:[], unmatched:[] }
  const [showAddHero, setShowAddHero] = useState(false);
  const bulkInputRef = useRef(null);

  // normalize a string for fuzzy filename matching: lowercase, strip
  // extension, strip non-alphanumeric chars (spaces, apostrophes, dashes…)
  function normalize(s) {
    return s.toLowerCase().replace(/\.[a-z0-9]+$/,"").replace(/[^a-z0-9]/g,"");
  }

  async function handleBulkFiles(fileList) {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    const heroByNorm = {};
    HERO_DATA.forEach(h => { heroByNorm[normalize(h.name)] = h.name; });

    const matched = [];
    const unmatched = [];
    const updates = {};

    setBulkUploading(true);
    await Promise.all(files.map(async file => {
      const norm = normalize(file.name);
      const heroName = heroByNorm[norm];
      if (!heroName) { unmatched.push(file.name); return; }
      try {
        const compressed = await compressImage(file);
        if (compressed.size > 1.5*1024*1024) { unmatched.push(`${file.name} (ใหญ่เกิน 1.5MB)`); return; }
        const blob = await upload(file.name, compressed, { access: "public", handleUploadUrl: "/api/upload" });
        updates[heroName] = blob.url;
        matched.push({ file: file.name, hero: heroName });
      } catch (err) {
        console.error("Hero bulk upload failed:", file.name, err);
        unmatched.push(`${file.name} (อัพโหลดไม่สำเร็จ)`);
      }
    }));

    if (Object.keys(updates).length > 0) {
      onSetPhotosBulk(updates);
      // clean up old photos for any hero that just got a replacement
      const oldUrls = Object.keys(updates)
        .map(heroName => heroPhotos[heroName])
        .filter(Boolean);
      deleteBlobUrls(oldUrls);
    }
    setMatchLog({ matched, unmatched });
    setBulkUploading(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) handleBulkFiles(e.dataTransfer.files);
  }

  const filtered = HERO_DATA.filter(h =>
    (roleFilter==="All"||h.role===roleFilter) &&
    h.name.toLowerCase().includes(search.toLowerCase())
  );

  const uploadedCount = HERO_DATA.filter(h => heroPhotos[h.name]).length;

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6,flexWrap:"wrap"}}>
        <h2 style={{margin:0,fontSize:24,fontWeight:800}}>🦸 Hero Images</h2>
        <span style={{background:C.primary,color:"#fff",fontSize:10,padding:"2px 8px",
          borderRadius:99,fontWeight:700}}>{uploadedCount}/{HERO_DATA.length} อัพโหลดแล้ว</span>
        <button onClick={()=>setShowAddHero(true)}
          style={{marginLeft:"auto",background:`linear-gradient(135deg,${C.primary},${C.primaryLight})`,
            color:"#fff",border:"none",borderRadius:9,padding:"7px 16px",
            cursor:"pointer",fontWeight:800,fontSize:12,whiteSpace:"nowrap"}}>
          + เพิ่ม Hero ใหม่
        </button>
      </div>
      <p style={{margin:"0 0 20px",color:C.textMuted,fontSize:13}}>
        อัพโหลดรูป Hero จากเครื่องตัวเอง — รูปที่อัพโหลดจะใช้แทนรูปจากเว็บทันที · แก้ Role ได้ทุกตัวที่การ์ดด้านล่าง
      </p>

      {showAddHero && (
        <AddHeroModal onAdd={onAddHero} onClose={()=>setShowAddHero(false)}/>
      )}

      {/* Bulk upload zone */}
      <div
        onDragOver={e=>{e.preventDefault();setDragOver(true);}}
        onDragLeave={()=>setDragOver(false)}
        onDrop={handleDrop}
        style={{background:dragOver?C.primary+"15":C.bgPanel,
          border:`2px dashed ${dragOver?C.primary:C.border}`,borderRadius:14,
          padding:"28px 20px",textAlign:"center",marginBottom:16,transition:"all .15s"}}>
        <div style={{fontSize:30,marginBottom:8}}>📂</div>
        <div style={{fontSize:14,fontWeight:700,marginBottom:6}}>
          ลากไฟล์รูปมาวางที่นี่ หรือเลือกหลายไฟล์พร้อมกัน
        </div>
        <div style={{fontSize:11,color:C.textMuted,marginBottom:14}}>
          ระบบจะจับคู่ไฟล์กับ Hero อัตโนมัติจากชื่อไฟล์ เช่น "Toro.png" → Toro
        </div>
        <label style={{background:`linear-gradient(135deg,${C.primary},${C.primaryLight})`,
          color:"#fff",border:"none",borderRadius:9,padding:"9px 22px",cursor:"pointer",
          fontWeight:800,fontSize:13,display:"inline-block"}}>
          เลือกไฟล์รูป (เลือกได้หลายไฟล์)
          <input ref={bulkInputRef} type="file" accept="image/*" multiple style={{display:"none"}}
            onChange={e=>{ if(e.target.files?.length) handleBulkFiles(e.target.files); e.target.value=""; }}/>
        </label>
      </div>

      {/* Match result log */}
      {matchLog && (
        <div style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:12,
          padding:"14px 18px",marginBottom:16}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
            <span style={{fontWeight:800,fontSize:13,color:C.primaryLight}}>ผลการจับคู่ไฟล์</span>
            <button onClick={()=>setMatchLog(null)}
              style={{marginLeft:"auto",background:"none",border:"none",color:C.textMuted,
                cursor:"pointer",fontSize:14}}>✕</button>
          </div>
          {matchLog.matched.length>0 && (
            <div style={{fontSize:12,color:C.win,marginBottom:6}}>
              ✅ จับคู่สำเร็จ {matchLog.matched.length} ไฟล์: {matchLog.matched.map(m=>m.hero).join(", ")}
            </div>
          )}
          {matchLog.unmatched.length>0 && (
            <div style={{fontSize:12,color:C.lose}}>
              ❌ จับคู่ไม่ได้ {matchLog.unmatched.length} ไฟล์ (ชื่อไฟล์ไม่ตรงกับ Hero ใดเลย): {matchLog.unmatched.join(", ")}
              <div style={{fontSize:11,color:C.textMuted,marginTop:4}}>
                แก้ไขได้ด้วยมือทีละตัวที่การ์ดด้านล่าง
              </div>
            </div>
          )}
        </div>
      )}

      {/* filters */}
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="🔍 ค้นหา Hero..."
          style={{...iStyle,flex:1,minWidth:180,padding:"7px 12px",fontSize:12}}/>
        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          {["All",...ROLES_PICK].map(r=>(
            <button key={r} onClick={()=>setRoleFilter(r)} style={{
              background:roleFilter===r?(ROLE_COLOR[r]||C.primary)+"30":"transparent",
              border:`1px solid ${roleFilter===r?(ROLE_COLOR[r]||C.primary):C.border}`,
              color:roleFilter===r?(ROLE_COLOR[r]||C.primaryLight):C.textMuted,
              borderRadius:99,padding:"4px 12px",cursor:"pointer",fontSize:11,fontWeight:700}}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* per-hero grid editor */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:10}}>
        {filtered.map(hero => (
          <HeroImageSlot key={hero.name} hero={hero}
            photoUrl={heroPhotos[hero.name]}
            onSet={(dataUrl)=>onSetPhoto(hero.name, dataUrl)}
            onRemove={()=>onRemovePhoto(hero.name)}
            onSetRole={(role)=>onSetRole(hero.name, role)}
            onDelete={hero._custom ? () => {
              if (window.confirm(`ลบ "${hero.name}" ออกจากรายชื่อ Hero? (ลบได้เฉพาะ Hero ที่เพิ่มเอง ข้อมูลแมตช์ที่เคยใช้ฮีโร่นี้จะยังอยู่เหมือนเดิม แค่ระบบจะไม่รู้จัก role ของมันแล้ว)`)) {
                onRemoveHero(hero.name);
              }
            } : undefined}/>
        ))}
        {filtered.length===0 && (
          <div style={{gridColumn:"1/-1",textAlign:"center",padding:30,color:C.textMuted}}>
            ไม่พบ Hero ที่ตรงกับการค้นหา
          </div>
        )}
      </div>
    </div>
  );
}

// ── Add Hero modal: name + role + optional photo ──
function AddHeroModal({ onAdd, onClose }) {
  const [name,  setName]  = useState("");
  const [role,  setRole]  = useState(ROLES_PICK[0]);
  const [photo, setPhoto] = useState(null);
  const [error, setError] = useState("");

  function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) { setError("กรุณากรอกชื่อ Hero"); return; }
    const exists = HERO_DATA.some(h=>h.name.toLowerCase()===trimmed.toLowerCase());
    if (exists) { setError(`มี Hero ชื่อ "${trimmed}" อยู่แล้ว`); return; }
    onAdd({ name: trimmed, role, photo });
    onClose();
  }

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",
      display:"flex",alignItems:"center",justifyContent:"center",zIndex:999}}
      onClick={onClose}>
      <div onClick={e=>e.stopPropagation()}
        style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:16,
          padding:24,width:380,maxWidth:"90vw"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18}}>
          <h3 style={{margin:0,fontSize:16,fontWeight:800,color:C.primaryLight}}>+ เพิ่ม Hero ใหม่</h3>
          <button onClick={onClose}
            style={{marginLeft:"auto",background:"none",border:"none",color:C.textMuted,
              cursor:"pointer",fontSize:18}}>✕</button>
        </div>

        <div style={{display:"flex",justifyContent:"center",marginBottom:16}}>
          <PhotoPicker value={photo} onChange={setPhoto} size={64} team="our"/>
        </div>

        <div style={{marginBottom:12}}>
          <div style={{fontSize:11,color:C.textMuted,marginBottom:4}}>ชื่อ Hero *</div>
          <input value={name} onChange={e=>{setName(e.target.value);setError("");}}
            onKeyDown={e=>e.key==="Enter"&&handleSubmit()}
            placeholder="เช่น Tulen, Liliana..." autoFocus
            style={{...iStyle,padding:"8px 12px",fontSize:13}}/>
        </div>

        <div style={{marginBottom:18}}>
          <div style={{fontSize:11,color:C.textMuted,marginBottom:4}}>Role *</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {ROLES_PICK.map(r=>(
              <button key={r} onClick={()=>setRole(r)}
                style={{background:role===r?(ROLE_COLOR[r]||C.primary)+"30":"transparent",
                  border:`1.5px solid ${role===r?(ROLE_COLOR[r]||C.primary):C.border}`,
                  color:role===r?(ROLE_COLOR[r]||C.primaryLight):C.textMuted,
                  borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:12,fontWeight:700}}>
                {r}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div style={{background:C.lose+"15",border:`1px solid ${C.lose}40`,color:C.lose,
            borderRadius:8,padding:"7px 12px",fontSize:12,marginBottom:14}}>
            ⚠️ {error}
          </div>
        )}

        <div style={{display:"flex",gap:8}}>
          <button onClick={handleSubmit}
            style={{flex:1,background:`linear-gradient(135deg,${C.primary},${C.primaryLight})`,
              color:"#fff",border:"none",borderRadius:9,padding:"9px 0",
              cursor:"pointer",fontWeight:800,fontSize:13}}>
            ✅ เพิ่ม Hero
          </button>
          <button onClick={onClose}
            style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textMuted,
              borderRadius:9,padding:"9px 18px",cursor:"pointer",fontSize:13}}>
            ยกเลิก
          </button>
        </div>
      </div>
    </div>
  );
}

function HeroImageSlot({ hero, photoUrl, onSet, onRemove, onSetRole, onDelete }) {
  const [err, setErr] = useState(false);
  const [editingRole, setEditingRole] = useState(false);
  const fileRef = useRef(null);
  const webUrl = useHeroImage(photoUrl ? null : hero); // only fall back to web lookup if no upload
  const displayUrl = photoUrl || webUrl;

  const [uploading, setUploading] = useState(false);
  const [cropFile, setCropFile] = useState(null);

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
        alert("ไฟล์รูปใหญ่เกินไป (จำกัด 1.5MB)");
        return;
      }
      const compressed = await compressImage(blob);
      const uploaded = await upload("hero.jpg", compressed, { access: "public", handleUploadUrl: "/api/upload" });
      onSet(uploaded.url);
      if (photoUrl && photoUrl !== uploaded.url) deleteBlobUrls(photoUrl); // clean up the old photo
    } catch (err) {
      console.error("Hero photo upload failed:", err);
      alert("อัพโหลดรูปไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div style={{background:C.bgPanel,border:`1px solid ${photoUrl?C.primary+"60":C.border}`,
      borderRadius:10,padding:8,textAlign:"center"}}>
      {cropFile && (
        <ImageCropModal file={cropFile} title={`ปรับรูป ${hero.name}`}
          onConfirm={handleCropConfirm}
          onCancel={()=>{setCropFile(null); if(fileRef.current) fileRef.current.value="";}}
        />
      )}
      <div style={{position:"relative",width:"100%",aspectRatio:"1",borderRadius:8,
        overflow:"hidden",background:(ROLE_COLOR[hero.role]||C.primary)+"22",marginBottom:6}}>
        {displayUrl && !err ? (
          <img src={displayUrl} onError={()=>setErr(true)} alt={hero.name}
            style={{width:"100%",height:"100%",objectFit:"cover"}}/>
        ) : (
          <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <span style={{fontSize:24,fontWeight:900,color:ROLE_COLOR[hero.role]||C.primaryLight}}>
              {hero.name.charAt(0)}
            </span>
          </div>
        )}
        {photoUrl && (
          <div style={{position:"absolute",top:3,right:3,background:C.win,color:"#fff",
            fontSize:8,fontWeight:800,padding:"1px 5px",borderRadius:99}}>✓</div>
        )}
        {hero._custom && (
          <div style={{position:"absolute",top:3,left:3,background:C.primary,color:"#fff",
            fontSize:8,fontWeight:800,padding:"1px 5px",borderRadius:99}}>NEW</div>
        )}
      </div>
      <div style={{fontSize:11,fontWeight:700,marginBottom:4,overflow:"hidden",
        textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{hero.name}</div>

      {/* role — click to edit (multi-select: a hero can now hold more
          than one role at once, e.g. Rouie as both เมจ and ซัพ — helps
          finding it under either role filter in Live Draft / Rival
          scouting instead of being locked to a single classification) */}
      {editingRole ? (
        <div onBlur={e=>{ if(!e.currentTarget.contains(e.relatedTarget)) setEditingRole(false); }}
          tabIndex={-1}
          style={{background:C.bgCard,border:`1px solid ${C.primary}`,borderRadius:6,
            padding:"6px 4px",marginBottom:6,textAlign:"left"}}>
          {ROLES_PICK.map(r=>{
            const roles = hero.roles || [hero.role];
            const checked = roles.includes(r);
            return (
              <label key={r} style={{display:"flex",alignItems:"center",gap:5,
                padding:"2px 4px",cursor:"pointer",fontSize:10}}>
                <input type="checkbox" checked={checked}
                  onChange={()=>{
                    const current = hero.roles || [hero.role];
                    const next = checked ? current.filter(x=>x!==r) : [...current, r];
                    // เหลืออย่างน้อย 1 role เสมอ — ห้าม uncheck จนไม่มี role เหลือเลย
                    if (next.length === 0) return;
                    onSetRole(next);
                  }}/>
                <span style={{color:ROLE_COLOR[r]||C.textMuted}}>{r}</span>
              </label>
            );
          })}
          <button onClick={()=>setEditingRole(false)}
            style={{width:"100%",marginTop:4,background:C.primary,color:"#fff",border:"none",
              borderRadius:4,padding:"3px 0",fontSize:10,fontWeight:700,cursor:"pointer"}}>
            ✓ เสร็จแล้ว
          </button>
        </div>
      ) : (
        <div onClick={()=>setEditingRole(true)} title="แก้ไข Role (เลือกได้หลายตำแหน่ง)"
          style={{fontSize:9,fontWeight:700,marginBottom:6,cursor:"pointer",
            color:ROLE_COLOR[hero.role]||C.textMuted,
            display:"flex",alignItems:"center",justifyContent:"center",gap:3,flexWrap:"wrap"}}>
          {(hero.roles||[hero.role]).join(" / ")} <span style={{opacity:.6,fontSize:8}}>✏️</span>
        </div>
      )}

      <div style={{display:"flex",gap:4}}>
        <label style={{flex:1,background:C.primary+"20",border:`1px solid ${C.primary}50`,
          color:C.primaryLight,borderRadius:6,padding:"3px 0",cursor:"pointer",
          fontSize:10,fontWeight:700}}>
          📂
          <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleFile}/>
        </label>
        {photoUrl && (
          <button onClick={()=>{deleteBlobUrls(photoUrl);onRemove();}}
            style={{background:C.lose+"20",border:`1px solid ${C.lose}40`,color:C.lose,
              borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:10,fontWeight:700}}>
            ✕
          </button>
        )}
        {onDelete && (
          <button onClick={onDelete} title="ลบ Hero นี้ (Hero ที่เพิ่มเองเท่านั้น)"
            style={{background:C.lose+"20",border:`1px solid ${C.lose}40`,color:C.lose,
              borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:10,fontWeight:700}}>
            🗑️
          </button>
        )}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════
//  HERO ICON (letter avatar)
// ═══════════════════════════════════════════
export function HeroAvatar({ name, team, size=40, style={} }) {
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
