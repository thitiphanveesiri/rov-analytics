"use client";
import { useState, useEffect, useReducer, useCallback, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { useSession, signOut } from "next-auth/react";
import { upload } from "@vercel/blob/client";
import { loadFromStorage, saveToStorage } from "@/lib/storage";
import { deleteBlobUrls } from "@/lib/blobCleanup";
import { compressImage } from "@/lib/imageCompress";
import { HERO_DATA, ROLES_FILTER, ROLES_PICK, ROLE_COLOR } from "@/lib/heroes";
import { HeroPhotosContext, checkLocalHeroImage, LOCAL_HERO_IMG_CACHE, useHeroImage } from "@/lib/useHeroImage";
import { C, iStyle } from "@/lib/theme";
import { HeroCard, HeroChip } from "@/components/shared/HeroChip";
import { PlayerAvatar, PhotoPicker, ImageCropModal } from "@/components/shared/PlayerMedia";
import { ToastProvider, useToast } from "@/lib/toast";
import { LogoImg, LogoUploader } from "@/components/shared/TeamLogo";
import { NoTeamScreen } from "@/components/shared/NoTeamScreen";
import { PerformanceTrend, CoachNotesHub } from "@/components/shared/PerformanceTrend";
import { HeroImageManager, HeroAvatar } from "@/components/shared/HeroImageManager";
import { PatchSelector, RosterPlayerCard } from "@/components/shared/RosterPlayerCard";
// ── Code-split: these are big and only visited on specific pages
//    (Schedule, Video Library, Practice, My Stats, Analytics, Whiteboard,
//    Admin panel) — loading them lazily instead of bundling into every
//    page load keeps the initial JS payload much smaller for the common
//    case (someone just checking Overview/Roster). Each shows a small
//    loading placeholder while its chunk downloads.
const LazyLoadingPlaceholder = () => (
  <div style={{padding:60,textAlign:"center",color:"#6b6b8a",fontSize:13}}>กำลังโหลด...</div>
);
const SchedulePage = dynamic(
  () => import("@/components/shared/SchedulePage").then(m => m.SchedulePage),
  { loading: LazyLoadingPlaceholder, ssr: false }
);
const VideoLibrary = dynamic(
  () => import("@/components/shared/VideoLibrary").then(m => m.VideoLibrary),
  { loading: LazyLoadingPlaceholder, ssr: false }
);
const PracticePage = dynamic(
  () => import("@/components/shared/PracticePage").then(m => m.PracticePage),
  { loading: LazyLoadingPlaceholder, ssr: false }
);
const MyStatsPage = dynamic(
  () => import("@/components/shared/MyStatsPage").then(m => m.MyStatsPage),
  { loading: LazyLoadingPlaceholder, ssr: false }
);
const AnalyticsPage = dynamic(
  () => import("@/components/shared/Analytics").then(m => m.AnalyticsPage),
  { loading: LazyLoadingPlaceholder, ssr: false }
);
const TacticalWhiteboard = dynamic(
  () => import("@/components/shared/TacticalWhiteboard"),
  { loading: LazyLoadingPlaceholder, ssr: false }
);
const AdminPanel = dynamic(
  () => import("@/components/shared/AdminPanel"),
  { loading: LazyLoadingPlaceholder, ssr: false }
);
import { ScheduleReminder } from "@/components/shared/ScheduleReminder";
import { GoogleCalendarConnect } from "@/components/shared/GoogleCalendarConnect";
import { YoutubeAutoImport } from "@/components/shared/YoutubeAutoImport";
import {
  normalizeDuration,
  durationToMinutes,
  minutesToDurationStr,
  formatDurationDisplay,
} from "@/lib/duration";

// ═══════════════════════════════════════════
//  CONSTANTS (hero list + role helpers moved to lib/heroes.js so server-side
//  analytics routes can share the same role mapping — see lib/heroes.js)
// ═══════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════
//  ⚠️ PENDING PATCH UPDATE — ระบบแบนใหม่ (5 ban/ทีม แทนที่ 4 เดิม)
//  รอ logic ลำดับ ban/pick ที่แน่นอนจากแพตช์ที่กำลังจะอัปเดต
//
//  พอรู้ลำดับจริงแล้ว ต้องแก้แค่ 2 จุดนี้:
//    1) BANS_PER_TEAM ด้านล่าง → เปลี่ยนเป็น 5
//    2) DRAFT_ORDER + PHASE_SEGS ด้านล่าง → ใส่ลำดับ step จริงตามแพตช์ใหม่
//  ที่เหลือ (ขนาด array การแบน, ตัวกรอง Ban ที่ 1-N, สถิติ ban/pick ต่างๆ)
//  จะปรับตาม BANS_PER_TEAM ให้อัตโนมัติ เพราะ refactor ให้ derive จากค่านี้แล้ว
// ═══════════════════════════════════════════════════════════════
const BANS_PER_TEAM = 4; // TODO: เปลี่ยนเป็น 5 ตอนแพตช์ปล่อยจริงพร้อมลำดับใหม่
const DRAFT_LS_KEY = "rov_analytics_draft_inprogress_v1"; // localStorage key สำหรับ autosave draft ที่ทำค้างไว้

const DRAFT_ORDER = [
  {team:"blue",action:"ban", slot:0},{team:"red", action:"ban", slot:0},
  {team:"blue",action:"ban", slot:1},{team:"red", action:"ban", slot:1},
  {team:"blue",action:"pick",slot:0},{team:"red", action:"pick",slot:0},
  {team:"red", action:"pick",slot:1},{team:"blue",action:"pick",slot:1},
  {team:"blue",action:"pick",slot:2},{team:"red", action:"pick",slot:2},
  {team:"red", action:"ban", slot:2},{team:"blue",action:"ban", slot:2},
  {team:"red", action:"ban", slot:3},{team:"blue",action:"ban", slot:3},
  {team:"red", action:"pick",slot:3},{team:"blue",action:"pick",slot:3},
  {team:"blue",action:"pick",slot:4},{team:"red", action:"pick",slot:4},
];

// ⚠️ ต้องอัปเดตคู่กับ DRAFT_ORDER ด้านบนเมื่อรู้ลำดับใหม่ (start/end คือ index ใน DRAFT_ORDER)
const PHASE_SEGS = [
  {label:"BAN 1", color:C.ban,  start:0, end:3,  flex:2},
  {label:"PICK 1",color:C.win,  start:4, end:9,  flex:3},
  {label:"BAN 2", color:C.ban,  start:10,end:13, flex:2},
  {label:"PICK 2",color:C.win,  start:14,end:17, flex:2},
];

const BO_OPTIONS = [1,2,3,4,5,6,7].map(n=>({label:`BO${n}`,total:n}));

const PATTERN_TAGS = [
  "Early Aggro","Late Game","Split Push","Team Fight","Poke Comp",
  "Burst Combo","Tank Heavy","Sustain","Pick Off","Objective Focus",
];

// ═══════════════════════════════════════════
//  TOAST NOTIFICATION SYSTEM — moved to lib/toast.js
//  (so extracted components like AdminPanel.js can import useToast too —
//  see lib/toast.js for the full explanation)
// ═══════════════════════════════════════════

// ── Simple responsive breakpoint hook (phones + tablets in portrait) ──
function useIsMobile(breakpoint = 860) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [breakpoint]);
  return isMobile;
}

// ═══════════════════════════════════════════
//  HERO IMAGE RESOLVER
//  Hero portraits come from files bundled with the app: public/heroes/<slug>.png
//  (slug = the `img` field on each hero in lib/heroes.js / HERO_DATA, e.g.
//  public/heroes/airi.png). No external API call — checked once per hero
//  per session and cached. If a file is missing, the calling component
//  falls back to a letter avatar (existing onError handling), and you can
//  just drop the PNG into public/heroes/ later — no code change needed.
// ═══════════════════════════════════════════
// NOTE: getPreloadedImg/WB_IMG_ELEM_CACHE used to live here, but the only
// place that ever called it (TacticalWhiteboard's redraw()) has since
// moved to components/shared/TacticalWhiteboard.js, so the helper moved
// with it — nothing here calls it anymore.

// ═══════════════════════════════════════════
//  PATCH FILTER — ให้ Overview / Rivals / Roster (Player Profile) / My Stats
//  ดูข้อมูลแยกตาม patch ได้ (ปัจจุบัน / patch เก่า / ทั้งหมด)
//
//  ทำงานจากจุดเดียว: filter `app.matches` ก่อนส่งเข้า `allGames` (ตัวแปร
//  กลางที่ทุกหน้าดึงสถิติจาก) — ไม่ต้องแก้ทีละหน้า เพราะทุกหน้าอ่าน allGames
//  ตัวเดียวกันอยู่แล้ว
//
//  ใช้ match.id (epoch timestamp จาก Date.now() ตอนสร้างแมตช์ — ดู
//  case "SAVE_MATCH") เทียบกับ PatchVersion.effectiveFrom แทนการ parse
//  m.date ที่เป็น string ภาษาไทย (แม่นกว่า ไม่ต้องยุ่งกับ locale parsing)
// ═══════════════════════════════════════════
function usePatchVersions() {
  const [versions, setVersions] = useState([]);
  useEffect(() => {
    fetch("/api/admin/patch-versions")
      .then(r => r.ok ? r.json() : [])
      .then(data => setVersions(Array.isArray(data) ? data : []))
      .catch(() => {}); // ไม่มีประวัติ patch ก็ปล่อยเป็น [] — filterMatchesByPatch จะ fallback เป็น "ทั้งหมด" เอง
  }, []);
  return versions;
}

function filterMatchesByPatch(matches, patchVersions, selectedPatch) {
  if (selectedPatch === "all" || !patchVersions.length) return matches;
  const sorted = [...patchVersions].sort((a,b) => new Date(a.effectiveFrom) - new Date(b.effectiveFrom));

  let from, to = Infinity;
  if (selectedPatch === "current") {
    from = new Date(sorted[sorted.length-1].effectiveFrom).getTime();
  } else {
    const idx = sorted.findIndex(v => v.version === selectedPatch);
    if (idx === -1) return matches; // เผื่อ patch ที่เลือกไว้โดนลบไปแล้ว
    from = new Date(sorted[idx].effectiveFrom).getTime();
    if (idx+1 < sorted.length) to = new Date(sorted[idx+1].effectiveFrom).getTime();
  }
  return matches.filter(m => m.id >= from && m.id < to);
}

// PatchSelector, RosterPlayerCard moved to components/shared/RosterPlayerCard.js

// ═══════════════════════════════════════════
//  UNIFIED STATS EDITOR — ทีมเรา + คู่แข่ง ในตารางเดียว
//  ✅ แก้ใหม่: ใช้ slot index เป็น key แทนชื่อผู้เล่น
//     เพื่อให้บันทึก stats ได้แม้ไม่ได้กรอกชื่อ
// ═══════════════════════════════════════════
function UnifiedStatsEditor({ ourPicks, enemyPicks, gameStats, onChangeStats, ourScore, enemyScore }) {
  // gameStats = { our: { 0:{k,d,a,dmg,gold}, 1:... }, enemy: { 0:..., } }
  const fields = ["kills","deaths","assists","damage","damageTaken","gold"];
  const labels = ["K","D","A","Dmg","DmgTaken","Gold"];
  const fieldWidth = { kills:40, deaths:40, assists:40, damage:72, damageTaken:72, gold:64 };

  function getVal(side, idx, field) {
    return (gameStats?.[side]?.[idx]?.[field]) ?? "";
  }
  function setVal(side, idx, field, val) {
    const next = {
      our:   { ...(gameStats?.our || {}) },
      enemy: { ...(gameStats?.enemy || {}) },
    };
    next[side] = {
      ...next[side],
      [idx]: { ...(next[side][idx] || {}), [field]: val === "" ? undefined : Number(val) },
    };
    onChangeStats(next);
  }

  // ── ระบบช่วยเช็คยอดรวม K/D กันกรอกผิด ──
  // กติกา RoV: kill รวมของทีมเรา = kill ที่บันทึกไว้ของทีมเรา (ourScore)
  //           death รวมของทีมเรา = kill รวมของฝั่งตรงข้าม (enemyScore) เพราะทุก death ของเราคือ kill ของอีกฝั่ง
  //           และกลับกันสำหรับฝั่งคู่แข่ง
  function sumField(side, field) {
    const rows = gameStats?.[side] || {};
    return Object.values(rows).reduce((s,r)=> s + (Number(r?.[field]) || 0), 0);
  }
  const sumOurK = sumField("our","kills"),     sumOurD = sumField("our","deaths");
  const sumEnemyK = sumField("enemy","kills"), sumEnemyD = sumField("enemy","deaths");
  const hasAnyStat = sumOurK||sumOurD||sumEnemyK||sumEnemyD;
  const hasScore = ourScore!=null && enemyScore!=null && (ourScore!==0 || enemyScore!==0);

  const checks = hasScore ? [
    { label:"Kill รวมทีมเรา",     actual:sumOurK,   expected:Number(ourScore)||0   },
    { label:"Death รวมทีมเรา",    actual:sumOurD,   expected:Number(enemyScore)||0 },
    { label:"Kill รวมคู่แข่ง",     actual:sumEnemyK, expected:Number(enemyScore)||0 },
    { label:"Death รวมคู่แข่ง",    actual:sumEnemyD, expected:Number(ourScore)||0   },
  ] : [];

  const sections = [
    { label:"🛡️ ทีมเรา", side:"our",   picks: ourPicks,   col: C.win  },
    { label:"⚔️ คู่แข่ง", side:"enemy", picks: enemyPicks, col: C.lose },
  ];

  const anyPick = [...(ourPicks||[]), ...(enemyPicks||[])].some(s=>s?.hero||s?.player);
  if (!anyPick) return (
    <div style={{textAlign:"center",padding:"20px 0",color:C.textMuted,fontSize:12}}>
      ยังไม่มี Pick ในเกมนี้
    </div>
  );

  return (
    <div style={{background:"#080614",borderRadius:10,overflow:"hidden",border:`1px solid ${C.border}`}}>
      {hasScore && hasAnyStat > 0 && (
        <div style={{padding:"10px 12px",background:"#0f0c22",borderBottom:`1px solid ${C.border}`,
          display:"flex",flexWrap:"wrap",gap:8}}>
          {checks.map(c=>{
            const ok = c.actual === c.expected;
            return (
              <div key={c.label} style={{display:"flex",alignItems:"center",gap:5,
                background: ok ? C.win+"15" : C.lose+"15",
                border:`1px solid ${ok?C.win:C.lose}40`,borderRadius:7,padding:"4px 9px"}}>
                <span style={{fontSize:11}}>{ok?"✅":"⚠️"}</span>
                <span style={{fontSize:10,color:C.textMuted}}>{c.label}:</span>
                <span style={{fontSize:11,fontWeight:800,color:ok?C.win:C.lose}}>
                  {c.actual}/{c.expected}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:560}}>
          <thead>
            <tr style={{background:"#0f0c22"}}>
              <th style={{textAlign:"left",padding:"8px 10px",fontWeight:700,fontSize:10,color:C.textMuted,whiteSpace:"nowrap"}}>
                ผู้เล่น / Hero
              </th>
              {labels.map(h=>(
                <th key={h} style={{textAlign:"center",padding:"8px 4px",fontWeight:700,fontSize:10,color:C.textMuted,whiteSpace:"nowrap"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sections.map(({ label, side, picks, col }) => {
              const validPicks = (picks||[]).filter(s => s?.hero || s?.player);
              if (!validPicks.length) return null;
              return [
                <tr key={`hdr-${side}`}>
                  <td colSpan={6} style={{padding:"6px 10px",
                    background: col + "12",
                    fontSize:10, fontWeight:800, color:col, letterSpacing:1}}>
                    {label}
                  </td>
                </tr>,
                ...(picks||[]).map((slot, idx) => {
                  if (!slot?.hero && !slot?.player) return null;
                  return (
                    <tr key={`${side}-${idx}`} style={{borderTop:`1px solid ${C.border}`}}>
                      <td style={{padding:"5px 10px",minWidth:130}}>
                        <div style={{fontSize:11,fontWeight:700,color:col,lineHeight:1.2}}>
                          {slot.player || <span style={{color:C.textMuted,fontStyle:"italic",fontWeight:400}}>ไม่ระบุชื่อ</span>}
                        </div>
                        <div style={{fontSize:9,color:C.textMuted}}>{slot.hero?.name || "—"}</div>
                      </td>
                      {fields.map(field => (
                        <td key={field} style={{padding:"4px 3px",textAlign:"center"}}>
                          <input
                            type="number" min="0"
                            value={getVal(side, idx, field)}
                            onChange={e => setVal(side, idx, field, e.target.value)}
                            placeholder="0"
                            style={{width:fieldWidth[field],background:"#0a0816",border:`1px solid ${C.border}`,
                              color:C.textMain,borderRadius:5,padding:"4px 5px",
                              fontSize:12,textAlign:"center",outline:"none"}}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                }).filter(Boolean),
              ];
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  OBJECTIVE CONTROL EDITOR (Dragon/Turret/First Blood)
// ═══════════════════════════════════════════
const OBJ_DEFAULT = {
  firstBlood:null, firstTower:null,
  ourAbyssal:0, enemyAbyssal:0,       // มังกร
  ourDark:0, enemyDark:0,             // Dark (Dark Slayer)
  ourGodslayer:0, enemyGodslayer:0,   // Godslayer
  ourTurrets:0, enemyTurrets:0,
};

function ObjectiveEditor({ objectives, onChange }) {
  const obj = { ...OBJ_DEFAULT, ...(objectives||{}) };
  function set(k,v){ onChange({ ...obj, [k]:v }); }

  const FirstPicker = ({ field, label, icon }) => (
    <div>
      <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>{icon} {label}</div>
      <div style={{display:"flex",gap:5}}>
        {[{v:"our",l:"🛡️ เรา",c:C.win},{v:"enemy",l:"⚔️ คู่แข่ง",c:C.lose},{v:null,l:"—",c:C.textMuted}].map(o=>(
          <button key={String(o.v)} onClick={()=>set(field,o.v)}
            style={{background:obj[field]===o.v?o.c+"30":"transparent",
              border:`1px solid ${obj[field]===o.v?o.c:C.border}`,color:obj[field]===o.v?o.c:C.textMuted,
              borderRadius:7,padding:"4px 10px",cursor:"pointer",fontSize:11,fontWeight:700}}>
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );

  const CountField = ({ field, label, col }) => (
    <div>
      <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>{label}</div>
      <input type="number" min="0" value={obj[field]}
        onChange={e=>set(field, Math.max(0, Number(e.target.value)||0))}
        style={{width:60,background:"#0a0816",border:`1px solid ${C.border}`,color:col,
          borderRadius:6,padding:"5px 8px",fontSize:13,fontWeight:700,textAlign:"center",outline:"none"}}/>
    </div>
  );

  return (
    <div style={{background:"#080614",borderRadius:10,padding:"12px 14px",marginTop:8}}>
      <div style={{fontSize:11,fontWeight:800,color:C.primaryLight,marginBottom:12}}>
        🐉 Objective Control
      </div>
      <div style={{display:"flex",gap:20,flexWrap:"wrap",marginBottom:12}}>
        <FirstPicker field="firstBlood" label="First Blood" icon="🩸"/>
        <FirstPicker field="firstTower" label="First Tower"  icon="🏯"/>
      </div>
      <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
        <CountField field="ourAbyssal"    label="🐉 Abyssal (เรา)"     col={C.win}/>
        <CountField field="enemyAbyssal"  label="🐉 Abyssal (คู่แข่ง)" col={C.lose}/>
        <CountField field="ourDark"       label="⚫ Dark (เรา)"        col={C.win}/>
        <CountField field="enemyDark"     label="⚫ Dark (คู่แข่ง)"    col={C.lose}/>
        <CountField field="ourGodslayer"   label="👑 Godslayer (เรา)"     col={C.win}/>
        <CountField field="enemyGodslayer" label="👑 Godslayer (คู่แข่ง)" col={C.lose}/>
        <CountField field="ourTurrets"   label="🏯 Turret พัง (เรา)"     col={C.win}/>
        <CountField field="enemyTurrets" label="🏯 Turret พัง (คู่แข่ง)" col={C.lose}/>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  SINGLE GAME DETAIL (Match Log)
// ═══════════════════════════════════════════
// ═══════════════════════════════════════════
//  EDIT GAME MODAL — แก้ไข hero draft / สกอร์ / เวลา / ชื่อผู้เล่น / ผูกวิดีโอ
//  ย้อนหลังจากหน้า Match Log (ต่างจาก UPDATE_STATS ที่แก้ได้แค่ K/D/A)
// ═══════════════════════════════════════════
function EditGameModal({ game, roster, enemyRoster=[], videos=[], onSave, onClose }) {
  const [ourPicks, setOurPicks] = useState(() =>
    (game.ourPicks && game.ourPicks.length ? game.ourPicks : ROLES_PICK.map(r=>({role:r,hero:null,player:""})))
      .map(p=>({...p})));
  const [enemyPicks, setEnemyPicks] = useState(() =>
    (game.enemyPicks && game.enemyPicks.length ? game.enemyPicks : ROLES_PICK.map(r=>({role:r,hero:null,player:""})))
      .map(p=>({...p})));
  const [result,     setResult]     = useState(game.result || "WIN");
  const [ourScore,   setOurScore]   = useState(game.ourScore ?? "");
  const [enemyScore, setEnemyScore] = useState(game.enemyScore ?? "");
  const [duration,   setDuration]   = useState(game.duration || "");
  const [hasPause,   setHasPause]   = useState(!!game.pauseDuration);
  const [pauseDuration, setPauseDuration] = useState(game.pauseDuration || "");
  const [videoId,    setVideoId]    = useState(game.videoId || "");

  const setOurHero     = (i,name) => setOurPicks(prev => prev.map((p,idx)=> idx===i ? {...p, hero: name?{name}:null} : p));
  const setOurPlayer   = (i,name) => setOurPicks(prev => prev.map((p,idx)=> idx===i ? {...p, player:name} : p));
  const setEnemyHero   = (i,name) => setEnemyPicks(prev => prev.map((p,idx)=> idx===i ? {...p, hero: name?{name}:null} : p));
  const setEnemyPlayer = (i,name) => setEnemyPicks(prev => prev.map((p,idx)=> idx===i ? {...p, player:name} : p));

  function save() {
    onSave({
      ourPicks, enemyPicks, result,
      ourScore: Math.max(0, ourScore===""?0:Number(ourScore)||0),
      enemyScore: Math.max(0, enemyScore===""?0:Number(enemyScore)||0),
      duration: normalizeDuration(duration),
      pauseDuration: hasPause && pauseDuration ? normalizeDuration(pauseDuration) : null,
      videoId: videoId || null,
    });
    onClose();
  }

  const selectStyle = {background:C.bgCard,border:`1px solid ${C.border}`,color:C.textMain,
    borderRadius:6,padding:"5px 6px",fontSize:11,outline:"none"};

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:500,
      display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
      onClick={onClose}>
      <div onClick={e=>e.stopPropagation()}
        style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:16,
          padding:24,width:680,maxWidth:"100%",maxHeight:"85vh",overflowY:"auto"}}>
        <div style={{fontWeight:800,fontSize:16,marginBottom:16,color:C.primaryLight}}>✏️ แก้ไขข้อมูลเกม</div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:16,marginBottom:16}}>
          <div>
            <div style={{fontWeight:700,fontSize:12,color:C.win,marginBottom:8}}>🛡️ ทีมเรา (Hero + ผู้เล่น)</div>
            {ourPicks.map((p,i)=>(
              <div key={i} style={{display:"flex",gap:6,marginBottom:6,alignItems:"center"}}>
                <span style={{fontSize:10,color:C.textMuted,width:48,flexShrink:0}}>{p.role}</span>
                <select value={p.hero?.name||""} onChange={e=>setOurHero(i,e.target.value)} style={{...selectStyle,flex:1}}>
                  <option value="">— hero —</option>
                  {HERO_DATA.map(h=><option key={h.name} value={h.name}>{h.name}</option>)}
                </select>
                <select value={p.player||""} onChange={e=>setOurPlayer(i,e.target.value)} style={{...selectStyle,width:96}}>
                  <option value="">— ผู้เล่น —</option>
                  {roster.map(r=><option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div>
            <div style={{fontWeight:700,fontSize:12,color:C.lose,marginBottom:8}}>⚔️ คู่แข่ง (Hero + ผู้เล่น)</div>
            {enemyPicks.map((p,i)=>(
              <div key={i} style={{display:"flex",gap:6,marginBottom:6,alignItems:"center"}}>
                <span style={{fontSize:10,color:C.textMuted,width:48,flexShrink:0}}>{p.role}</span>
                <select value={p.hero?.name||""} onChange={e=>setEnemyHero(i,e.target.value)} style={{...selectStyle,flex:1}}>
                  <option value="">— hero —</option>
                  {HERO_DATA.map(h=><option key={h.name} value={h.name}>{h.name}</option>)}
                </select>
                {enemyRoster.length > 0 ? (
                  <select value={p.player||""} onChange={e=>setEnemyPlayer(i,e.target.value)} style={{...selectStyle,width:96}}>
                    <option value="">— ผู้เล่น —</option>
                    {enemyRoster.map(r=><option key={r} value={r}>{r}</option>)}
                  </select>
                ) : (
                  // ยังไม่เคยบันทึกชื่อผู้เล่นทีมนี้ไว้เลย (enemyRosters ว่าง) —
                  // ใช้ช่องพิมพ์อิสระแทน dropdown เพื่อไม่ให้ block การกรอกครั้งแรก
                  <input type="text" value={p.player||""} onChange={e=>setEnemyPlayer(i,e.target.value)}
                    placeholder="ชื่อผู้เล่น" style={{...selectStyle,width:96}}/>
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:16}}>
          <div>
            <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>ผล</div>
            <select value={result} onChange={e=>setResult(e.target.value)}
              style={{...selectStyle,color:result==="WIN"?C.win:C.lose,fontWeight:700,padding:"7px 10px",fontSize:12}}>
              <option>WIN</option><option>LOSE</option>
            </select>
          </div>
          <div>
            <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>คิลเรา</div>
            <input type="number" min="0" value={ourScore} onChange={e=>setOurScore(e.target.value)}
              style={{...selectStyle,width:70,padding:"7px 10px",fontSize:12}}/>
          </div>
          <div>
            <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>คิลศัตรู</div>
            <input type="number" min="0" value={enemyScore} onChange={e=>setEnemyScore(e.target.value)}
              style={{...selectStyle,width:70,padding:"7px 10px",fontSize:12}}/>
          </div>
          <div>
            <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>เวลา (นาที.วินาที)</div>
            <input type="text" inputMode="decimal" value={duration}
              onChange={e=>setDuration(e.target.value)}
              onBlur={e=>setDuration(normalizeDuration(e.target.value))}
              placeholder="09.45"
              style={{...selectStyle,width:90,padding:"7px 10px",fontSize:12}}/>
          </div>
          <div>
            <label style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color:C.textMuted,
              marginBottom:4,cursor:"pointer",userSelect:"none",whiteSpace:"nowrap"}}>
              <input type="checkbox" checked={hasPause}
                onChange={e=>{setHasPause(e.target.checked); if(!e.target.checked) setPauseDuration("");}}/>
              ⏸️ มีหยุดเกม
            </label>
            {hasPause && (
              <input type="text" inputMode="decimal" placeholder="00.00"
                title="เวลาที่หยุดเกมไปทั้งหมด (นาที.วินาที)"
                value={pauseDuration}
                onChange={e=>setPauseDuration(e.target.value)}
                onBlur={e=>setPauseDuration(normalizeDuration(e.target.value))}
                style={{...selectStyle,width:90,padding:"7px 10px",fontSize:12}}/>
            )}
          </div>
        </div>

        <div style={{marginBottom:20}}>
          <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>🎬 ผูกกับวิดีโอ (ไม่บังคับ)</div>
          <select value={videoId} onChange={e=>setVideoId(e.target.value)}
            style={{...selectStyle,width:"100%",boxSizing:"border-box",padding:"8px 10px",fontSize:12}}>
            <option value="">— ไม่ผูกวิดีโอ —</option>
            {videos.map(v=><option key={v.id} value={v.id}>{v.title||v.url}</option>)}
          </select>
        </div>

        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={{background:"transparent",border:`1px solid ${C.border}`,
            color:C.textMuted,borderRadius:8,padding:"9px 18px",cursor:"pointer",fontWeight:700,fontSize:13}}>
            ยกเลิก
          </button>
          <button onClick={save} style={{background:C.primary,color:"#fff",border:"none",borderRadius:8,
            padding:"9px 22px",cursor:"pointer",fontWeight:700,fontSize:13}}>
            💾 บันทึก
          </button>
        </div>
      </div>
    </div>
  );
}

function SingleGameDetail({ g, gameNo, onUpdateStats, onUpdateObjectives, onUpdateGameFull, onJumpToVideo, playerPhotos={}, rivalName, roster=[], enemyRoster=[], videos=[] }) {
  const [showStats, setShowStats] = useState(false);
  const [gameStats, setGameStats] = useState(g.gameStats || { our:{}, enemy:{} });
  const [saved, setSaved] = useState(false);
  const [showObj, setShowObj] = useState(false);
  const [objectives, setObjectives] = useState(g.objectives || OBJ_DEFAULT);
  const [objSaved, setObjSaved] = useState(false);
  const [editingGame, setEditingGame] = useState(false);

  function handleSaveObjectives() {
    onUpdateObjectives && onUpdateObjectives(gameNo - 1, objectives);
    setObjSaved(true);
    setTimeout(() => setObjSaved(false), 2000);
  }

  function handleSave() {
    onUpdateStats && onUpdateStats(gameNo - 1, gameStats);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div style={{background:C.bgCard,borderRadius:10,padding:"12px 14px",
      border:`1px solid ${g.result==="WIN"?C.win+"30":C.lose+"30"}`}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,flexWrap:"wrap"}}>
        <span style={{fontWeight:800,fontSize:13,color:C.primaryLight}}>Game {gameNo}</span>
        <span style={{padding:"2px 10px",borderRadius:99,fontSize:11,fontWeight:800,
          background:g.result==="WIN"?C.win+"20":C.lose+"20",
          color:g.result==="WIN"?C.win:C.lose}}>{g.result}</span>
        {g.ourSide && (
          <span style={{fontSize:10,padding:"1px 8px",borderRadius:99,fontWeight:700,
            background:g.ourSide==="blue"?C.blue+"20":C.red+"20",
            color:g.ourSide==="blue"?C.blue:C.red}}>
            {g.ourSide==="blue"?"🔵 Blue":"🔴 Red"} Side
          </span>
        )}
        <div style={{display:"flex",gap:6,marginLeft:"auto"}}>
          {g.videoId && videos.some(v=>String(v.id)===String(g.videoId)) && (
            <button onClick={()=>onJumpToVideo && onJumpToVideo(g.videoId)}
              style={{background:"transparent",border:`1px solid ${C.border}`,color:C.primaryLight,
                borderRadius:7,padding:"3px 10px",cursor:"pointer",fontSize:11,fontWeight:700}}>
              🎬 ดูวิดีโอ
            </button>
          )}
          <button onClick={()=>setEditingGame(true)}
            style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textMuted,
              borderRadius:7,padding:"3px 10px",cursor:"pointer",fontSize:11,fontWeight:700}}>
            ✏️ แก้ไข
          </button>
        </div>
        <span style={{fontSize:12,color:C.textMuted,width:"100%"}}>
          <span style={{color:C.win,fontWeight:700}}>{g.ourScore||0}</span>
          <span style={{color:C.textMuted}}> : </span>
          <span style={{color:C.lose,fontWeight:700}}>{g.enemyScore||0}</span>
          <span style={{color:C.textMuted,fontSize:11}}> kills</span>
          {g.duration && <span style={{marginLeft:8,color:C.textMuted}}>⏱ {formatDurationDisplay(g.duration)}</span>}
        </span>
      </div>

      {editingGame && (
        <EditGameModal
          game={g}
          roster={roster}
          enemyRoster={enemyRoster}
          videos={videos}
          onSave={updates => onUpdateGameFull && onUpdateGameFull(gameNo - 1, updates)}
          onClose={()=>setEditingGame(false)}
        />
      )}

      {/* Bans */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
        {[
          {label:"🚫 เราแบน",     bans:g.ourBans},
          {label:"🚫 คู่แข่งแบน", bans:g.enemyBans},
        ].map(({label,bans})=>(
          <div key={label} style={{background:"#0e0b1e",borderRadius:8,padding:"8px 10px"}}>
            <div style={{fontSize:10,color:C.ban,fontWeight:700,marginBottom:5}}>{label}</div>
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              {(bans||[]).filter(Boolean).map((h,i)=>(
                <span key={i} style={{background:C.ban+"20",color:C.ban,fontSize:10,padding:"2px 7px",borderRadius:99}}>
                  {h.name||h}
                </span>
              ))}
              {!(bans||[]).filter(Boolean).length && <span style={{fontSize:10,color:"#3a3a5c"}}>-</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Picks */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
        {[
          {label:"🛡️ ทีมเรา",    picks:g.ourPicks,   col:C.win},
          {label:"⚔️ คู่แข่ง",   picks:g.enemyPicks, col:C.lose},
        ].map(({label,picks,col})=>(
          <div key={label} style={{background:"#0e0b1e",borderRadius:8,padding:"8px 10px"}}>
            <div style={{fontSize:10,color:col,fontWeight:700,marginBottom:5}}>{label}</div>
            {(picks||[]).filter(s=>s.hero).map((s,i)=>{
              const isEnemySide = label.includes("คู่แข่ง");
              const photoKey = s.player
                ? (isEnemySide ? `enemy:${rivalName}:${s.player}` : `our:${s.player}`)
                : null;
              return (
                <div key={i} style={{display:"flex",gap:6,alignItems:"center",marginBottom:3}}>
                  {s.player && (
                    <PlayerAvatar name={s.player} photoUrl={playerPhotos[photoKey]} size={18}
                      team={isEnemySide?"enemy":"our"}/>
                  )}
                  <span style={{fontSize:9,color:ROLE_COLOR[s.role]||C.primaryLight,width:46}}>{s.role}</span>
                  <span style={{fontSize:11,fontWeight:700,flex:1}}>{s.hero?.name||"—"}</span>
                  {s.player && <span style={{fontSize:9,color:C.textMuted}}>{s.player}</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {g.note && (
        <div style={{background:C.primary+"15",borderRadius:7,padding:"7px 10px",
          fontSize:12,color:C.primaryLight,marginBottom:8}}>📝 {g.note}</div>
      )}

      {/* Stats toggle */}
      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
        <button onClick={()=>setShowStats(v=>!v)} style={{
          background:showStats?C.primary+"30":"transparent",
          border:`1px solid ${showStats?C.primary:C.border}`,
          color:showStats?C.primaryLight:C.textMuted,
          borderRadius:7,padding:"4px 12px",cursor:"pointer",fontSize:11,fontWeight:700}}>
          {showStats?"▲ ซ่อน Stats":"📊 Stats ทั้งทีม"}
        </button>
        {showStats && (
          <button onClick={handleSave} style={{
            background:saved?C.win+"30":C.primary,color:"#fff",border:"none",
            borderRadius:7,padding:"4px 14px",cursor:"pointer",fontSize:11,fontWeight:700}}>
            {saved?"✅ บันทึกแล้ว!":"💾 บันทึก Stats"}
          </button>
        )}
        <button onClick={()=>setShowObj(v=>!v)} style={{
          background:showObj?C.primary+"30":"transparent",
          border:`1px solid ${showObj?C.primary:C.border}`,
          color:showObj?C.primaryLight:C.textMuted,
          borderRadius:7,padding:"4px 12px",cursor:"pointer",fontSize:11,fontWeight:700}}>
          {showObj?"▲ ซ่อน Objective":"🐉 Objective Control"}
        </button>
        {showObj && (
          <button onClick={handleSaveObjectives} style={{
            background:objSaved?C.win+"30":C.primary,color:"#fff",border:"none",
            borderRadius:7,padding:"4px 14px",cursor:"pointer",fontSize:11,fontWeight:700}}>
            {objSaved?"✅ บันทึกแล้ว!":"💾 บันทึก Objective"}
          </button>
        )}
      </div>

      {showObj && <ObjectiveEditor objectives={objectives} onChange={setObjectives}/>}


      {showStats && (
        <div style={{marginTop:8}}>
          <UnifiedStatsEditor
            ourPicks={g.ourPicks}
            enemyPicks={g.enemyPicks}
            gameStats={gameStats}
            onChangeStats={setGameStats}
            ourScore={g.ourScore}
            enemyScore={g.enemyScore}
          />
          {/* ── GPM / DPM / Damage Share ── */}
          {durationToMinutes(g.duration) > 0 && (() => {
            const dur = durationToMinutes(g.duration);
            if (!dur) return null;

            // collect our team stats
            const ourStats = (g.ourPicks||[]).map((slot,i) => {
              const st = gameStats.our?.[i] || {};
              return {
                player: slot.player || `Slot ${i+1}`,
                hero:   slot.hero?.name || "—",
                role:   slot.role || "",
                dmg:    Number(st.damage||0),
                gold:   Number(st.gold||0),
                kills:  Number(st.kills||0),
                assists:Number(st.assists||0),
              };
            });

            const totalDmg   = ourStats.reduce((s,p)=>s+p.dmg, 0);
            const totalGold  = ourStats.reduce((s,p)=>s+p.gold, 0);
            const teamKills  = Number(g.ourScore) || ourStats.reduce((s,p)=>s+p.kills, 0); // ใช้สกอร์ทีมที่บันทึกไว้เป็นหลัก ถ้าไม่มีค่อย fallback ไปรวมจากที่กรอกรายคน
            const hasData    = totalDmg > 0 || totalGold > 0;
            if (!hasData) return null;

            return (
              <div style={{marginTop:12,background:"#080614",borderRadius:10,padding:"12px 14px"}}>
                <div style={{fontSize:11,fontWeight:800,color:C.primaryLight,marginBottom:10,
                  display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span>📊 GPM / DPM / Damage Share — เกม {dur} นาที</span>
                  <span style={{fontSize:10,color:C.textMuted}}>ทีมเราเท่านั้น</span>
                </div>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                    <thead>
                      <tr style={{color:C.textMuted,fontSize:10,borderBottom:`1px solid ${C.border}`}}>
                        <th style={{textAlign:"left",padding:"4px 6px"}}>ผู้เล่น / Hero</th>
                        <th style={{textAlign:"center",padding:"4px 6px"}}>DMG</th>
                        <th style={{textAlign:"center",padding:"4px 6px"}}>DPM</th>
                        <th style={{textAlign:"center",padding:"4px 6px"}}>%Dmg</th>
                        <th style={{textAlign:"center",padding:"4px 6px"}}>Gold</th>
                        <th style={{textAlign:"center",padding:"4px 6px"}}>GPM</th>
                        <th style={{textAlign:"center",padding:"4px 6px"}}>DPG</th>
                        <th style={{textAlign:"center",padding:"4px 6px"}}>KP%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ourStats.map((p,i) => {
                        const dpm      = dur ? Math.round(p.dmg/dur) : 0;
                        const gpm      = dur ? Math.round(p.gold/dur) : 0;
                        const dmgShare = totalDmg ? Math.round(p.dmg/totalDmg*100) : 0;
                        const dpg      = p.gold ? (p.dmg/p.gold).toFixed(2) : null; // Damage per Gold — ความคุ้มค่าทองที่ได้
                        const kp       = teamKills ? Math.round((p.kills+p.assists)/teamKills*100) : null; // Kill Participation
                        const roleCol  = ROLE_COLOR[p.role] || C.textMuted;
                        return (
                          <tr key={i} style={{borderBottom:`1px solid ${C.border}30`,
                            background:i%2?"transparent":"#0d0a1e"}}>
                            <td style={{padding:"5px 6px"}}>
                              <div style={{fontWeight:700,fontSize:11}}>{p.player}</div>
                              <div style={{fontSize:9,color:roleCol}}>{p.role} · {p.hero}</div>
                            </td>
                            <td style={{padding:"5px 6px",textAlign:"center",color:C.primaryLight,fontWeight:700}}>
                              {p.dmg ? p.dmg.toLocaleString() : "—"}
                            </td>
                            <td style={{padding:"5px 6px",textAlign:"center",color:"#74b9ff",fontWeight:700}}>
                              {dpm ? dpm.toLocaleString() : "—"}
                            </td>
                            <td style={{padding:"5px 6px",textAlign:"center"}}>
                              {dmgShare > 0 ? (
                                <div style={{display:"flex",alignItems:"center",gap:4}}>
                                  <div style={{flex:1,height:6,background:C.border,borderRadius:3,overflow:"hidden"}}>
                                    <div style={{width:`${dmgShare}%`,height:"100%",
                                      background:dmgShare>=30?"#e17055":dmgShare>=20?C.primary:"#6b6b8a",
                                      borderRadius:3}}/>
                                  </div>
                                  <span style={{fontSize:10,fontWeight:700,color:
                                    dmgShare>=30?"#e17055":dmgShare>=20?C.primaryLight:C.textMuted,
                                    minWidth:28,textAlign:"right"}}>{dmgShare}%</span>
                                </div>
                              ) : "—"}
                            </td>
                            <td style={{padding:"5px 6px",textAlign:"center",color:"#feca57",fontWeight:700}}>
                              {p.gold ? p.gold.toLocaleString() : "—"}
                            </td>
                            <td style={{padding:"5px 6px",textAlign:"center",color:"#00b894",fontWeight:700}}>
                              {gpm ? gpm.toLocaleString() : "—"}
                            </td>
                            <td style={{padding:"5px 6px",textAlign:"center",color:"#fd79a8",fontWeight:700}}>
                              {dpg ?? "—"}
                            </td>
                            <td style={{padding:"5px 6px",textAlign:"center",color:kp>=60?"#e17055":C.textMain,fontWeight:700}}>
                              {kp!=null ? `${kp}%` : "—"}
                            </td>
                          </tr>
                        );
                      })}
                      {/* totals row */}
                      {(totalDmg > 0 || totalGold > 0) && (
                        <tr style={{borderTop:`2px solid ${C.border}`,background:"#0a0820"}}>
                          <td style={{padding:"5px 6px",fontWeight:800,color:C.primaryLight,fontSize:10}}>
                            รวมทีม
                          </td>
                          <td style={{padding:"5px 6px",textAlign:"center",fontWeight:800,color:C.primaryLight}}>
                            {totalDmg.toLocaleString()}
                          </td>
                          <td style={{padding:"5px 6px",textAlign:"center",fontWeight:800,color:"#74b9ff"}}>
                            {dur ? Math.round(totalDmg/dur).toLocaleString() : "—"}
                          </td>
                          <td style={{padding:"5px 6px",textAlign:"center",color:C.textMuted,fontSize:10}}>
                            100%
                          </td>
                          <td style={{padding:"5px 6px",textAlign:"center",fontWeight:800,color:"#feca57"}}>
                            {totalGold.toLocaleString()}
                          </td>
                          <td style={{padding:"5px 6px",textAlign:"center",fontWeight:800,color:"#00b894"}}>
                            {dur ? Math.round(totalGold/dur).toLocaleString() : "—"}
                          </td>
                          <td style={{padding:"5px 6px",textAlign:"center",fontWeight:800,color:"#fd79a8"}}>
                            {totalGold ? (totalDmg/totalGold).toFixed(2) : "—"}
                          </td>
                          <td style={{padding:"5px 6px",textAlign:"center",color:C.textMuted,fontSize:10}}>
                            —
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div style={{fontSize:9,color:C.textMuted,marginTop:6,textAlign:"right"}}>
                  DPM = Damage/นาที · GPM = Gold/นาที · %Dmg = สัดส่วนดาเมจในทีม ·
                  DPG = Damage/ทอง 1 หน่วย (ความคุ้มค่าทอง) · KP% = (Kill+Assist ของผู้เล่น) / Kill รวมทีม
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
//  MATCH CARD (Match Log page)
// ═══════════════════════════════════════════
// ═══════════════════════════════════════════
//  MATCH DRAFT SUMMARY — สรุปภาพรวม ban/pick ทุกเกมในแมตช์เดียว
//  แบบกราฟิกถ่ายทอดสด ดาวน์โหลดเป็นรูปแชร์ได้
// ═══════════════════════════════════════════
// แปลงข้อมูลเกมจาก Match Log (รูปแบบ our/enemy) ให้เป็น blue/red มาตรฐาน
function matchGameToBlueRed(game, ourTeamName, ourTeamLogo, rivalName, rivalLogo) {
  const isBlueOur = game.ourSide ? game.ourSide === "blue" : true;
  const ourWin = game.result === "WIN";
  return {
    blueTeamName:  isBlueOur ? ourTeamName : rivalName,
    blueTeamLogo:  isBlueOur ? ourTeamLogo : rivalLogo,
    blueTeamTag:   isBlueOur ? "our" : "enemy",
    blueBans:      isBlueOur ? (game.ourBans||[])  : (game.enemyBans||[]),
    bluePicks:     isBlueOur ? (game.ourPicks||[]) : (game.enemyPicks||[]),
    blueScore:     isBlueOur ? (game.ourScore??0)  : (game.enemyScore??0),
    blueWin:       isBlueOur ? ourWin : !ourWin,
    redTeamName:   isBlueOur ? rivalName : ourTeamName,
    redTeamLogo:   isBlueOur ? rivalLogo : ourTeamLogo,
    redTeamTag:    isBlueOur ? "enemy" : "our",
    redBans:       isBlueOur ? (game.enemyBans||[])  : (game.ourBans||[]),
    redPicks:      isBlueOur ? (game.enemyPicks||[]) : (game.ourPicks||[]),
    redScore:      isBlueOur ? (game.enemyScore??0)  : (game.ourScore??0),
    duration: game.duration,
  };
}

// แปลงข้อมูลเกมจาก Scout Log (รูปแบบ teamA/teamB) ให้เป็น blue/red มาตรฐาน
function scoutGameToBlueRed(game, teamAName, teamALogo, teamBName, teamBLogo) {
  const aIsBlue = (game.sideA || "blue") === "blue";
  return {
    blueTeamName:  aIsBlue ? teamAName : teamBName,
    blueTeamLogo:  aIsBlue ? teamALogo : teamBLogo,
    blueTeamTag:   "our", // scout log ไม่มีแนวคิด "เรา" — ใช้สีกลางจาก HeroAvatar team prop
    blueBans:      aIsBlue ? (game.bansA||[])  : (game.bansB||[]),
    bluePicks:     aIsBlue ? (game.picksA||[]) : (game.picksB||[]),
    blueScore:     Number(aIsBlue ? game.killsA : game.killsB) || 0,
    redTeamName:   aIsBlue ? teamBName : teamAName,
    redTeamLogo:   aIsBlue ? teamBLogo : teamALogo,
    redTeamTag:    "enemy",
    redBans:       aIsBlue ? (game.bansB||[])  : (game.bansA||[]),
    redPicks:      aIsBlue ? (game.picksB||[]) : (game.picksA||[]),
    redScore:      Number(aIsBlue ? game.killsB : game.killsA) || 0,
    duration: game.duration,
  };
}

function GameSummaryRow({ bg, gameNo }) {
  const {
    blueTeamName, blueTeamLogo, blueTeamTag, blueBans, bluePicks, blueScore, blueWin,
    redTeamName, redTeamLogo, redTeamTag, redBans, redPicks, redScore,
    duration,
  } = bg;
  const redWin = blueWin===undefined ? undefined : !blueWin;
  // ฝั่งแดงเรียงจากขวาสุดไปซ้าย (สลับทิศจากฝั่งน้ำเงินที่เรียงซ้ายไปขวาปกติ)
  const redBansRTL  = [...redBans].reverse();
  const redPicksRTL = [...redPicks].reverse();

  return (
    <div style={{marginBottom:16,border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden",background:"#0a0a16"}}>
      {/* ── แถว Ban + ชื่อทีม + สกอร์ (Blue ซ้าย / Red ขวา เสมอ) ── */}
      <div style={{display:"flex",alignItems:"center",background:"#14112a"}}>
        <div style={{display:"flex",gap:3,padding:"6px 8px",flexShrink:0}}>
          {blueBans.map((b,i)=>(
            <div key={i} style={{width:30,height:30,borderRadius:5,overflow:"hidden",
              filter:b?.name?"grayscale(65%)":"none",opacity:b?.name?0.85:0.3,
              background:"#000",border:`1px solid ${C.border}`,flexShrink:0}}>
              {b?.name ? <HeroAvatar name={b.name} team={blueTeamTag} size={30}/> : (
                <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:14,color:C.textMuted}}>🚫</div>
              )}
            </div>
          ))}
        </div>
        <div style={{flex:1,textAlign:"center",fontWeight:900,fontSize:13,color:C.blue,
          letterSpacing:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",padding:"0 6px"}}>
          {blueTeamName}
        </div>
        <div style={{padding:"5px 12px",background:C.bgPanel,display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
          <LogoImg url={blueTeamLogo} name={blueTeamName} size={24}/>
          <span style={{fontWeight:900,fontSize:17,color:blueWin?C.win:"#fff"}}>{blueScore}</span>
          <span style={{color:C.textMuted,fontSize:11}}>vs</span>
          <span style={{fontWeight:900,fontSize:17,color:redWin?C.lose:"#fff"}}>{redScore}</span>
          <LogoImg url={redTeamLogo} name={redTeamName} size={24}/>
        </div>
        <div style={{flex:1,textAlign:"center",fontWeight:900,fontSize:13,color:C.red,
          letterSpacing:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",padding:"0 6px"}}>
          {redTeamName}
        </div>
        <div style={{display:"flex",gap:3,padding:"6px 8px",flexShrink:0}}>
          {redBansRTL.map((b,i)=>(
            <div key={i} style={{width:30,height:30,borderRadius:5,overflow:"hidden",
              filter:b?.name?"grayscale(65%)":"none",opacity:b?.name?0.85:0.3,
              background:"#000",border:`1px solid ${C.border}`,flexShrink:0}}>
              {b?.name ? <HeroAvatar name={b.name} team={redTeamTag} size={30}/> : (
                <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:14,color:C.textMuted}}>🚫</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── แถบ Game No. / เวลา ── */}
      <div style={{textAlign:"center",fontSize:10,color:C.textMuted,padding:"3px 0",
        background:"#0d0a1e",borderTop:`1px solid ${C.border}`,borderBottom:`1px solid ${C.border}`,
        letterSpacing:1,fontWeight:700}}>
        GAME {gameNo}{duration ? ` · ⏱ ${formatDurationDisplay(duration)}` : ""}
      </div>

      {/* ── แถว Pick (เรียงตามฝั่ง Blue ซ้าย / Red ขวา เสมอ) ── */}
      <div style={{display:"flex",fontSize:9,fontWeight:800,letterSpacing:1,textAlign:"center",background:"#0d0a1e"}}>
        <div style={{flex:1,padding:"2px 0",color:C.blue}}>🔵 BLUE ({blueTeamName})</div>
        <div style={{flex:1,padding:"2px 0",color:C.red}}>🔴 RED ({redTeamName})</div>
      </div>
      <div style={{display:"flex"}}>
        <div style={{flex:1,display:"flex"}}>
          {bluePicks.map((p,i)=>(
            <div key={i} style={{flex:1,aspectRatio:"1",position:"relative",borderRight:`1px solid ${C.border}`}}>
              {p?.hero?.name ? (
                <HeroAvatar name={p.hero.name} team={blueTeamTag} size={64} style={{width:"100%",height:"100%",borderRadius:0,border:"none"}}/>
              ) : <div style={{width:"100%",height:"100%",background:"#14112a"}}/>}
            </div>
          ))}
        </div>
        <div style={{flex:1,display:"flex"}}>
          {redPicksRTL.map((p,i)=>(
            <div key={i} style={{flex:1,aspectRatio:"1",position:"relative",borderLeft:i===0?`2px solid ${C.border}`:`1px solid ${C.border}`}}>
              {p?.hero?.name ? (
                <HeroAvatar name={p.hero.name} team={redTeamTag} size={64} style={{width:"100%",height:"100%",borderRadius:0,border:"none"}}/>
              ) : <div style={{width:"100%",height:"100%",background:"#14112a"}}/>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MatchDraftSummaryModal({ games, toBlueRed, teamAName, teamBName, onClose }) {
  const captureRef = useRef(null);
  const [downloading, setDownloading] = useState(false);
  const toast = useToast();

  async function downloadImage() {
    setDownloading(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(captureRef.current, {
        backgroundColor: "#0a0a16", scale: 2, useCORS: true,
      });
      const link = document.createElement("a");
      const safeName = (teamBName||"match").replace(/[^a-zA-Z0-9ก-๙]/g, "_");
      link.download = `draft-summary-vs-${safeName}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error("Export image failed:", err);
      toast("สร้างรูปไม่สำเร็จ ลองใหม่อีกครั้ง", "error");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:700,
      display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
      onClick={onClose}>
      <div onClick={e=>e.stopPropagation()}
        style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:16,padding:20,
          maxWidth:820,width:"100%",maxHeight:"90vh",display:"flex",flexDirection:"column"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
          <div style={{fontWeight:800,fontSize:15,color:C.primaryLight}}>
            📸 สรุปภาพรวม Draft — {teamAName} vs {teamBName}
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={downloadImage} disabled={downloading}
              style={{background:C.primary,color:"#fff",border:"none",borderRadius:8,
                padding:"8px 16px",cursor:downloading?"default":"pointer",fontWeight:700,fontSize:12,
                opacity:downloading?0.6:1}}>
              {downloading?"⏳ กำลังสร้างรูป...":"⬇️ ดาวน์โหลดรูป"}
            </button>
            <button onClick={onClose}
              style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textMuted,
                borderRadius:8,padding:"8px 16px",cursor:"pointer",fontWeight:700,fontSize:12}}>
              ✕ ปิด
            </button>
          </div>
        </div>
        <div style={{overflowY:"auto",paddingRight:4}}>
          <div ref={captureRef} style={{background:"#0a0a16",padding:12}}>
            {games.map((g,i)=>(
              <GameSummaryRow key={i} bg={toBlueRed(g)} gameNo={i+1}/>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MatchCardWithStats({ m, onUpdateStats, onUpdateObjectives, onUpdateGameFull, onJumpToVideo, playerPhotos={}, onDelete, onEditMeta, roster=[], enemyRoster=[], videos=[], ourTeamName, ourTeamLogo, rivalLogo }) {
  const [open, setOpen] = useState(false);
  const isBO  = Array.isArray(m.games) && m.games.length > 0;
  const wins  = isBO ? m.games.filter(g=>g.result==="WIN").length : (m.result==="WIN"?1:0);
  const total = isBO ? m.games.length : 1;
  const bc    = wins > total/2 ? C.win : wins === total/2 ? "#fdcb6e" : C.lose;

  // single-game stats
  const [showStats, setShowStats] = useState(false);
  const [gameStats, setGameStats] = useState(m.gameStats || { our:{}, enemy:{} });
  const [saved,     setSaved]     = useState(false);
  const [showObj,   setShowObj]   = useState(false);
  const [objectives,setObjectives]= useState(m.objectives || OBJ_DEFAULT);
  const [objSaved,  setObjSaved]  = useState(false);
  const [editingGame,setEditingGame] = useState(false);
  const [showSummary,setShowSummary] = useState(false);

  function handleSaveObjectives() {
    onUpdateObjectives && onUpdateObjectives(m.id, null, objectives);
    setObjSaved(true);
    setTimeout(() => setObjSaved(false), 2000);
  }

  // ── Edit meta ──
  const [editing,   setEditing]   = useState(false);
  const [editRival, setEditRival] = useState(m.rivalName||"");
  const [editCat,   setEditCat]   = useState(m.category||"scrim");
  const [editNote,  setEditNote]  = useState(m.note||"");

  function handleSingleSave() {
    onUpdateStats && onUpdateStats(m.id, null, gameStats);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleSaveMeta() {
    onEditMeta && onEditMeta({ id:m.id, rivalName:editRival.trim()||m.rivalName, category:editCat, note:editNote });
    setEditing(false);
  }

  return (
    <div style={{background:C.bgPanel,border:`1px solid ${bc}40`,borderRadius:14,
      marginBottom:12,overflow:"hidden",borderLeft:`4px solid ${bc}`}}>
      {/* Header row */}
      <div onClick={()=>setOpen(v=>!v)} style={{padding:"14px 20px",cursor:"pointer",
        display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        {isBO
          ? <span style={{padding:"3px 12px",borderRadius:99,fontSize:12,fontWeight:800,
              background:C.primary+"20",color:C.primaryLight}}>{m.boType||"BO?"}</span>
          : <span style={{padding:"3px 12px",borderRadius:99,fontSize:12,fontWeight:800,
              background:bc+"20",color:bc}}>{m.result}</span>
        }
        <span style={{fontWeight:800,fontSize:16,color:C.primaryLight}}>vs {m.rivalName}</span>
        {m.category==="tournament" && (
          <span style={{background:"#f9ca24"+"30",border:"1px solid #f9ca24"+"60",
            color:"#f9ca24",borderRadius:99,padding:"2px 10px",fontSize:10,fontWeight:800}}>
            🏆 แข่ง
          </span>
        )}
        {(!m.category||m.category==="scrim") && (
          <span style={{background:C.primary+"20",border:`1px solid ${C.primary}40`,
            color:C.textMuted,borderRadius:99,padding:"2px 10px",fontSize:10,fontWeight:700}}>
            🏋️ ซ้อม
          </span>
        )}
        {m.patch && (
          <span style={{background:"#0984e3"+"20",border:"1px solid #0984e3"+"50",
            color:"#74b9ff",borderRadius:99,padding:"2px 10px",fontSize:10,fontWeight:700}}>
            🗂️ {m.patch}
          </span>
        )}
        <span style={{fontSize:13,color:C.textMuted}}>{m.date}</span>
        {isBO && (
          <div style={{display:"flex",gap:5}}>
            {m.games.map((g,i)=>(
              <div key={i} style={{width:22,height:22,borderRadius:"50%",display:"flex",alignItems:"center",
                justifyContent:"center",fontSize:10,fontWeight:800,
                background:g.result==="WIN"?C.win+"30":C.lose+"30",
                color:g.result==="WIN"?C.win:C.lose}}>
                {g.result==="WIN"?"W":"L"}
              </div>
            ))}
          </div>
        )}
        {!isBO && m.ourSide && (
          <span style={{fontSize:11,fontWeight:700,padding:"2px 9px",borderRadius:99,
            background:m.ourSide==="blue"?C.blue+"20":C.red+"20",
            color:m.ourSide==="blue"?C.blue:C.red}}>
            {m.ourSide==="blue"?"🔵 Blue":"🔴 Red"} Side
          </span>
        )}
        <div style={{marginLeft:"auto",display:"flex",gap:12,alignItems:"center"}}>
          {!isBO && (
            <span style={{fontSize:13}}>
              <span style={{color:C.win,fontWeight:700}}>{m.ourScore}</span>
              <span style={{color:C.textMuted}}> : </span>
              <span style={{color:C.lose,fontWeight:700}}>{m.enemyScore}</span>
              <span style={{color:C.textMuted,fontSize:11}}> kills</span>
            </span>
          )}
          {isBO && <span style={{fontSize:12,color:bc,fontWeight:700}}>{wins}W – {total-wins}L</span>}
          {!isBO && m.videoId && videos.some(v=>String(v.id)===String(m.videoId)) && (
            <button onClick={e=>{ e.stopPropagation(); onJumpToVideo && onJumpToVideo(m.videoId); }}
              title="ดูวิดีโอที่ผูกไว้กับแมตช์นี้"
              style={{background:"transparent",border:`1px solid ${C.border}`,color:C.primaryLight,
                borderRadius:7,padding:"3px 10px",cursor:"pointer",fontSize:12,flexShrink:0}}>
              🎬
            </button>
          )}
          {isBO && m.games.some(g=>g.videoId) && (
            <button onClick={e=>{ e.stopPropagation(); setOpen(true); }}
              title="มีวิดีโอผูกไว้ในบางเกม — กดเพื่อดูรายละเอียด"
              style={{background:"transparent",border:`1px solid ${C.border}`,color:C.primaryLight,
                borderRadius:7,padding:"3px 10px",cursor:"pointer",fontSize:12,flexShrink:0}}>
              🎬
            </button>
          )}
          <button onClick={e=>{ e.stopPropagation(); setShowSummary(true); }}
            title="สรุปภาพรวม Draft ทุกเกม — ดาวน์โหลดเป็นรูปได้"
            style={{background:"transparent",border:`1px solid ${C.border}`,color:"#feca57",
              borderRadius:7,padding:"3px 10px",cursor:"pointer",fontSize:12,flexShrink:0}}>
            📸
          </button>
          {showSummary && (
            <MatchDraftSummaryModal
              games={Array.isArray(m.games) && m.games.length ? m.games : [m]}
              toBlueRed={g => matchGameToBlueRed(g, ourTeamName || "ทีมเรา", ourTeamLogo, m.rivalName, rivalLogo)}
              teamAName={ourTeamName || "ทีมเรา"}
              teamBName={m.rivalName}
              onClose={()=>setShowSummary(false)}
            />
          )}
          {onEditMeta && (
            <button onClick={e=>{ e.stopPropagation(); setEditing(v=>!v); }}
              style={{background:C.primary+"20",border:`1px solid ${C.primary}40`,color:C.primaryLight,
                borderRadius:7,padding:"3px 10px",cursor:"pointer",fontSize:11,fontWeight:700,flexShrink:0}}>
              ✏️ แก้ไข
            </button>
          )}
          {onDelete && (
            <button onClick={e=>{
              e.stopPropagation();
              if(window.confirm(`ลบแมตช์ vs ${m.rivalName} (${m.date}) ออกไหม?\nไม่สามารถย้อนคืนได้`))
                onDelete(m.id);
            }}
              style={{background:C.lose+"20",border:`1px solid ${C.lose}40`,color:C.lose,
                borderRadius:7,padding:"3px 10px",cursor:"pointer",fontSize:11,
                fontWeight:700,flexShrink:0}}>
              🗑️ ลบ
            </button>
          )}
          <span style={{color:C.textMuted,fontSize:14}}>{open?"▲":"▼"}</span>
        </div>
        {/* ── Edit Meta Panel ── */}
        {editing && (
          <div onClick={e=>e.stopPropagation()}
            style={{padding:"14px 20px",borderTop:`1px solid ${C.border}`,
              background:C.bgBase,display:"flex",flexWrap:"wrap",gap:12,alignItems:"flex-end"}}>
            <div>
              <div style={{fontSize:11,color:C.textMuted,marginBottom:4}}>ชื่อทีมคู่แข่ง</div>
              <input value={editRival} onChange={e=>setEditRival(e.target.value)}
                style={{background:C.bgPanel,border:`1px solid ${C.border}`,color:C.textMain,
                  borderRadius:7,padding:"6px 10px",fontSize:13,outline:"none",width:160}}/>
            </div>
            <div>
              <div style={{fontSize:11,color:C.textMuted,marginBottom:4}}>ประเภท</div>
              <div style={{display:"flex",gap:6}}>
                {[{id:"scrim",label:"🏋️ ซ้อม"},{id:"tournament",label:"🏆 แข่ง"}].map(c=>(
                  <button key={c.id} onClick={()=>setEditCat(c.id)}
                    style={{background:editCat===c.id?C.primary+"30":"transparent",
                      border:`2px solid ${editCat===c.id?C.primary:C.border}`,
                      color:editCat===c.id?C.primaryLight:C.textMuted,
                      borderRadius:7,padding:"5px 10px",cursor:"pointer",fontWeight:700,fontSize:11}}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{flex:1,minWidth:160}}>
              <div style={{fontSize:11,color:C.textMuted,marginBottom:4}}>โน้ต</div>
              <input value={editNote} onChange={e=>setEditNote(e.target.value)}
                style={{background:C.bgPanel,border:`1px solid ${C.border}`,color:C.textMain,
                  borderRadius:7,padding:"6px 10px",fontSize:13,outline:"none",width:"100%",boxSizing:"border-box"}}/>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={handleSaveMeta}
                style={{background:`linear-gradient(135deg,${C.primary},${C.primaryLight})`,
                  color:"#fff",border:"none",borderRadius:8,padding:"7px 16px",
                  cursor:"pointer",fontWeight:800,fontSize:12}}>
                💾 บันทึก
              </button>
              <button onClick={()=>setEditing(false)}
                style={{background:"transparent",border:`1px solid ${C.border}`,
                  color:C.textMuted,borderRadius:8,padding:"7px 12px",cursor:"pointer",fontSize:12}}>
                ยกเลิก
              </button>
            </div>
          </div>
        )}
      </div>

      {open && (
        <div style={{padding:"0 16px 16px"}}>
          {isBO ? (
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {m.games.map((g,i)=>(
                <SingleGameDetail
                  key={i} g={g} gameNo={i+1}
                  onUpdateStats={(gameIdx, gs) => onUpdateStats(m.id, gameIdx, gs)}
                  onUpdateObjectives={(gameIdx, obj) => onUpdateObjectives(m.id, gameIdx, obj)}
                  onUpdateGameFull={(gameIdx, updates) => onUpdateGameFull && onUpdateGameFull(m.id, gameIdx, updates)}
                  onJumpToVideo={onJumpToVideo}
                  playerPhotos={playerPhotos} rivalName={m.rivalName}
                  roster={roster} enemyRoster={enemyRoster} videos={videos}
                />
              ))}
            </div>
          ) : (
            <div>
              {/* Bans */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
                {[
                  {label:"🚫 เราแบน",     bans:m.ourBans},
                  {label:"🚫 คู่แข่งแบน", bans:m.enemyBans},
                ].map(({label,bans})=>(
                  <div key={label} style={{background:C.bgCard,borderRadius:10,padding:"10px 14px"}}>
                    <div style={{fontSize:11,color:C.ban,fontWeight:700,marginBottom:8}}>{label}</div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      {(bans||[]).filter(Boolean).map((h,i)=>(
                        <span key={i} style={{background:C.ban+"20",color:C.ban,fontSize:12,padding:"3px 10px",borderRadius:99}}>
                          {h.name||h}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {/* Picks */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
                {[
                  {label:"🛡️ ทีมเรา",  picks:m.ourPicks,   col:C.win},
                  {label:"⚔️ คู่แข่ง", picks:m.enemyPicks, col:C.lose},
                ].map(({label,picks,col})=>(
                  <div key={label} style={{background:C.bgCard,borderRadius:10,padding:"10px 14px"}}>
                    <div style={{fontSize:12,color:col,fontWeight:700,marginBottom:10}}>{label}</div>
                    {(picks||[]).map((slot,i)=>{
                      const isEnemySide = label.includes("คู่แข่ง");
                      const photoKey = slot.player
                        ? (isEnemySide ? `enemy:${m.rivalName}:${slot.player}` : `our:${slot.player}`)
                        : null;
                      return (
                        <div key={i} style={{display:"flex",gap:8,alignItems:"center",marginBottom:6}}>
                          {slot.player && (
                            <PlayerAvatar name={slot.player} photoUrl={playerPhotos[photoKey]} size={22}
                              team={isEnemySide?"enemy":"our"}/>
                          )}
                          <span style={{fontSize:11,color:C.primaryLight,width:55}}>{slot.role||ROLES_PICK[i]}</span>
                          <span style={{fontSize:13,fontWeight:700,flex:1}}>{slot.hero?.name||slot.hero||"-"}</span>
                          {slot.player && <span style={{fontSize:11,color:C.textMuted}}>{slot.player}</span>}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
              {m.note && (
                <div style={{background:C.primary+"15",border:`1px solid ${C.primary}40`,
                  borderRadius:8,padding:"10px 14px",fontSize:13,color:C.primaryLight,marginBottom:12}}>
                  📝 {m.note}
                </div>
              )}

              {/* Stats รวม */}
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,flexWrap:"wrap"}}>
                <button onClick={()=>setShowStats(v=>!v)} style={{
                  background:showStats?C.primary+"30":"transparent",
                  border:`1px solid ${showStats?C.primary:C.border}`,
                  color:showStats?C.primaryLight:C.textMuted,
                  borderRadius:7,padding:"4px 12px",cursor:"pointer",fontSize:11,fontWeight:700}}>
                  {showStats?"▲ ซ่อน Stats":"📊 Stats ทั้งทีม"}
                </button>
                {showStats && (
                  <button onClick={handleSingleSave} style={{
                    background:saved?C.win+"30":C.primary,color:"#fff",border:"none",
                    borderRadius:7,padding:"4px 14px",cursor:"pointer",fontSize:11,fontWeight:700}}>
                    {saved?"✅ บันทึกแล้ว!":"💾 บันทึก Stats"}
                  </button>
                )}
                <button onClick={()=>setShowObj(v=>!v)} style={{
                  background:showObj?C.primary+"30":"transparent",
                  border:`1px solid ${showObj?C.primary:C.border}`,
                  color:showObj?C.primaryLight:C.textMuted,
                  borderRadius:7,padding:"4px 12px",cursor:"pointer",fontSize:11,fontWeight:700}}>
                  {showObj?"▲ ซ่อน Objective":"🐉 Objective Control"}
                </button>
                {showObj && (
                  <button onClick={handleSaveObjectives} style={{
                    background:objSaved?C.win+"30":C.primary,color:"#fff",border:"none",
                    borderRadius:7,padding:"4px 14px",cursor:"pointer",fontSize:11,fontWeight:700}}>
                    {objSaved?"✅ บันทึกแล้ว!":"💾 บันทึก Objective"}
                  </button>
                )}
                {m.videoId && videos.some(v=>String(v.id)===String(m.videoId)) && (
                  <button onClick={()=>onJumpToVideo && onJumpToVideo(m.videoId)}
                    style={{background:"transparent",border:`1px solid ${C.border}`,color:C.primaryLight,
                      borderRadius:7,padding:"4px 12px",cursor:"pointer",fontSize:11,fontWeight:700}}>
                    🎬 ดูวิดีโอ
                  </button>
                )}
                <button onClick={()=>setEditingGame(true)}
                  style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textMuted,
                    borderRadius:7,padding:"4px 12px",cursor:"pointer",fontSize:11,fontWeight:700}}>
                  ✏️ แก้ไขข้อมูลเกม
                </button>
              </div>
              {editingGame && (
                <EditGameModal
                  game={m}
                  roster={roster}
                  enemyRoster={enemyRoster}
                  videos={videos}
                  onSave={updates => onUpdateGameFull && onUpdateGameFull(m.id, null, updates)}
                  onClose={()=>setEditingGame(false)}
                />
              )}
              {showObj && <ObjectiveEditor objectives={objectives} onChange={setObjectives}/>}
              {showStats && (
                <UnifiedStatsEditor
                  ourPicks={m.ourPicks}
                  enemyPicks={m.enemyPicks}
                  gameStats={gameStats}
                  onChangeStats={setGameStats}
                  ourScore={m.ourScore}
                  enemyScore={m.enemyScore}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
//  PATCH & META TRACKER
// ═══════════════════════════════════════════
const TIER_CONFIG = [
  {id:"S+", col:"#ff6b6b"}, {id:"S", col:"#feca57"}, {id:"A", col:"#1dd1a1"},
  {id:"B", col:"#54a0ff"}, {id:"C", col:"#8395a7"},
];

function PatchMetaCard({ patchInfo, heroTiers, onSavePatch, onSetTier, isCoach }) {
  const [editing, setEditing] = useState(false);
  const [version, setVersion] = useState(patchInfo?.version || "");
  const [notes,   setNotes]   = useState(patchInfo?.notes   || "");
  const [showTiers, setShowTiers] = useState(false);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(false);

  function save() {
    onSavePatch({ version: version.trim(), notes: notes.trim() });
    setEditing(false);
  }

  const filteredHeroes = HERO_DATA.filter(h =>
    h.name.toLowerCase().includes(search.toLowerCase())
  );

  const NOTES_PREVIEW_LEN = 220; // ยาวกว่านี้ค่อยตัดแล้วมีปุ่ม "ดูเพิ่มเติม"
  const notesText = patchInfo?.notes || "";
  const isLong = notesText.length > NOTES_PREVIEW_LEN;
  const displayedNotes = (!expanded && isLong) ? notesText.slice(0, NOTES_PREVIEW_LEN) + "..." : notesText;

  return (
    <div style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:14,padding:18,marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10}}>
        <div style={{flex:1,minWidth:220}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
            <span style={{fontWeight:800,fontSize:14,color:C.primaryLight}}>🗂️ Patch ปัจจุบัน</span>
            {patchInfo?.version && (
              <span style={{background:"#0984e3"+"20",border:"1px solid #0984e3"+"50",
                color:"#74b9ff",borderRadius:99,padding:"2px 10px",fontSize:11,fontWeight:700}}>
                {patchInfo.version}
              </span>
            )}
          </div>
          {!editing ? (
            <>
              <div style={{fontSize:12,color:C.textMuted,lineHeight:1.6,whiteSpace:"pre-wrap"}}>
                {displayedNotes || "ยังไม่ได้ใส่โน้ต patch — กด แก้ไข เพื่อบันทึกความเปลี่ยนแปลงของ patch นี้"}
              </div>
              {isLong && (
                <button onClick={()=>setExpanded(v=>!v)}
                  style={{background:"transparent",border:"none",color:C.primaryLight,
                    cursor:"pointer",fontSize:11,fontWeight:700,padding:"6px 0 0",textDecoration:"underline"}}>
                  {expanded ? "▲ ย่อกลับ" : "▼ ดูเพิ่มเติม (โน้ตยาว)"}
                </button>
              )}
            </>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:6}}>
              <input value={version} onChange={e=>setVersion(e.target.value)}
                placeholder="เช่น 1.52.2.9" style={{background:C.bgCard,border:`1px solid ${C.border}`,
                  color:C.textMain,borderRadius:7,padding:"6px 10px",fontSize:12,outline:"none",maxWidth:200}}/>
              <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3}
                placeholder="สรุป patch notes / meta ที่เปลี่ยนไป..."
                style={{background:C.bgCard,border:`1px solid ${C.border}`,color:C.textMain,
                  borderRadius:7,padding:"8px 10px",fontSize:12,outline:"none",resize:"vertical"}}/>
            </div>
          )}
          {patchInfo?.updatedAt && !editing && (
            <div style={{fontSize:10,color:C.textMuted,marginTop:6}}>
              อัปเดตล่าสุด {new Date(patchInfo.updatedAt).toLocaleString("th-TH")}
            </div>
          )}
        </div>
        <div style={{display:"flex",gap:8,flexShrink:0}}>
          {editing ? (
            <>
              <button onClick={save} style={{background:C.primary,color:"#fff",border:"none",
                borderRadius:7,padding:"6px 14px",cursor:"pointer",fontWeight:700,fontSize:11}}>💾 บันทึก</button>
              <button onClick={()=>setEditing(false)} style={{background:"transparent",
                border:`1px solid ${C.border}`,color:C.textMuted,borderRadius:7,padding:"6px 12px",
                cursor:"pointer",fontSize:11}}>ยกเลิก</button>
            </>
          ) : (
            isCoach && (
              <button onClick={()=>{setVersion(patchInfo?.version||"");setNotes(patchInfo?.notes||"");setEditing(true);}}
                style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textMuted,
                  borderRadius:7,padding:"6px 12px",cursor:"pointer",fontSize:11,fontWeight:700}}>
                ✏️ แก้ไข
              </button>
            )
          )}
        </div>
      </div>

      <div style={{marginTop:14,paddingTop:12,borderTop:`1px solid ${C.border}`}}>
        <button onClick={()=>setShowTiers(v=>!v)} style={{
          background:showTiers?C.primary+"30":"transparent",
          border:`1px solid ${showTiers?C.primary:C.border}`,color:showTiers?C.primaryLight:C.textMuted,
          borderRadius:7,padding:"5px 14px",cursor:"pointer",fontSize:11,fontWeight:700}}>
          {showTiers?"▲ ซ่อน Tier List":"🏆 Meta Tier List"}
        </button>

        {showTiers && (
          <div style={{marginTop:12}}>
            <input value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="ค้นหา hero..." style={{width:"100%",boxSizing:"border-box",
                background:C.bgCard,border:`1px solid ${C.border}`,color:C.textMain,
                borderRadius:7,padding:"6px 10px",fontSize:12,outline:"none",marginBottom:10}}/>
            <div style={{maxHeight:340,overflowY:"auto",display:"flex",flexDirection:"column",gap:4}}>
              {filteredHeroes.map(h=>{
                const tier = heroTiers?.[h.name];
                return (
                  <div key={h.name} style={{display:"flex",alignItems:"center",gap:8,
                    padding:"5px 8px",borderRadius:7,background:C.bgCard}}>
                    <HeroChip name={h.name} size={26} fontSize={12} bold={false}/>
                    <div style={{display:"flex",gap:4,marginLeft:"auto"}}>
                      {TIER_CONFIG.map(t=>(
                        <button key={t.id} disabled={!isCoach}
                          onClick={()=>isCoach && onSetTier(h.name, tier===t.id?null:t.id)}
                          title={isCoach?undefined:"เฉพาะโค้ช/แอดมินที่ตั้งค่า Tier List ได้"}
                          style={{width:26,height:22,borderRadius:5,cursor:isCoach?"pointer":"not-allowed",
                            fontSize:10,fontWeight:800,opacity:isCoach?1:0.5,
                            background:tier===t.id?t.col:"transparent",
                            border:`1px solid ${tier===t.id?t.col:C.border}`,
                            color:tier===t.id?"#1a1a2e":C.textMuted}}>
                          {t.id}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
              {filteredHeroes.length===0 && (
                <div style={{textAlign:"center",color:C.textMuted,fontSize:12,padding:16}}>ไม่พบ hero</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  WEEKLY / MONTHLY SUMMARY — สรุปผลซ้อม 7 วัน / 30 วันล่าสุด เทียบกับ
//  ช่วงก่อนหน้า (ไม่มี AI แค่คำนวณจากข้อมูลจริงล้วนๆ) — ทีมรวม + รายบุคคล
// ═══════════════════════════════════════════

function fmtKDA(k,d,a) {
  const ratio = d>0 ? (k+a)/d : (k+a>0 ? null : 0); // null = "Perfect" (ไม่เคยตาย แต่มี kill/assist)
  return { k, d, a, ratio, label: ratio===null ? "Perfect" : ratio.toFixed(2) };
}

// สรุปสถิติรายผู้เล่นจากลิสต์เกมที่ให้มา (ใช้ทั้งช่วงปัจจุบันและช่วงก่อนหน้า
// เพื่อคำนวณ delta ทีหลัง)
function summarizePlayers(games) {
  const byPlayer = {};

  games.forEach(g => {
    const picks = g.ourPicks || [];
    // เวลาเล่นจริงของเกมนี้ (หัก pauseDuration ออกแล้ว เหมือน avgGameDuration
    // ฝั่ง Overview — กันเวลาที่หยุดเกมมาปนสถิติ per-minute)
    const durMin = g.duration
      ? Math.max(0, durationToMinutes(g.duration) - (g.pauseDuration ? durationToMinutes(g.pauseDuration) : 0))
      : null;

    picks.forEach((p, idx) => {
      const player = (p.player||"").trim();
      const heroName = p.hero?.name;
      if (!player) return; // ช่องที่ยังไม่ได้กรอกชื่อผู้เล่น ข้ามไป

      if (!byPlayer[player]) byPlayer[player] = {
        games:0, wins:0, kills:0, deaths:0, assists:0,
        damage:0, gold:0, damageTaken:0, minutesWithStats:0,
        heroTally:{},
      };
      const rec = byPlayer[player];
      rec.games++;
      if (g.result==="WIN") rec.wins++;

      const stat = g.gameStats?.our?.[idx];
      if (stat) {
        rec.kills += stat.kills||0;
        rec.deaths += stat.deaths||0;
        rec.assists += stat.assists||0;
        rec.damage += stat.damage||0;
        rec.gold += stat.gold||0;
        rec.damageTaken += stat.damageTaken||0;
        if (durMin) rec.minutesWithStats += durMin;
      }

      if (heroName) {
        if (!rec.heroTally[heroName]) rec.heroTally[heroName] = { games:0, wins:0 };
        rec.heroTally[heroName].games++;
        if (g.result==="WIN") rec.heroTally[heroName].wins++;
      }
    });
  });

  const result = {};
  Object.entries(byPlayer).forEach(([player, rec]) => {
    const wr = rec.games ? Math.round(rec.wins/rec.games*100) : null;
    const kda = fmtKDA(
      +(rec.kills/rec.games).toFixed(1),
      +(rec.deaths/rec.games).toFixed(1),
      +(rec.assists/rec.games).toFixed(1)
    );
    const dpm = rec.minutesWithStats ? Math.round(rec.damage/rec.minutesWithStats) : null;
    const goldPerMin = rec.minutesWithStats ? Math.round(rec.gold/rec.minutesWithStats) : null;
    const avgDamageTaken = rec.games ? Math.round(rec.damageTaken/rec.games) : null;

    const topHeroes = Object.entries(rec.heroTally)
      .sort((a,b)=>b[1].games-a[1].games)
      .slice(0,3)
      .map(([name,v])=>({ name, games:v.games, wr: Math.round(v.wins/v.games*100) }));

    // ฮีโร่ win rate สูงสุด — ต้องเล่นอย่างน้อยครึ่งหนึ่งของเกมทั้งหมดของ
    // ผู้เล่นคนนั้นในช่วงนี้ ถึงจะเข้าเกณฑ์ (กันฮีโร่ที่เล่นแค่เกมเดียวแล้ว
    // ชนะ ดันอันดับ win rate สูงลอยๆ ทั้งที่ยังไม่มีนัยสำคัญ)
    const threshold = Math.ceil(rec.games/2);
    const qualifyingHeroes = Object.entries(rec.heroTally)
      .filter(([,v]) => v.games >= threshold)
      .map(([name,v]) => ({ name, games:v.games, wr: Math.round(v.wins/v.games*100) }))
      .sort((a,b)=>b.wr-a.wr || b.games-a.games);
    const bestHero = qualifyingHeroes[0] || null;

    result[player] = { games: rec.games, wins: rec.wins, wr, kda, dpm, goldPerMin, avgDamageTaken, topHeroes, bestHero };
  });
  return result;
}

// ── date helpers for the week/month picker ──
function startOfWeekMon(d) {
  const date = new Date(d); date.setHours(0,0,0,0);
  const day = date.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day; // ให้จันทร์เป็นวันแรกของสัปดาห์
  date.setDate(date.getDate() + diff);
  return date;
}
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate()+n); return r; }
function addMonths(d, n) { const r = new Date(d.getFullYear(), d.getMonth()+n, 1); return r; }

// รับช่วงเวลาแบบระบุตรงๆ (ไม่ใช่ "ย้อนหลัง N วันจากตอนนี้" แบบเดิม) — เพื่อ
// ให้เลือกดูสัปดาห์/เดือนไหนก็ได้ ไม่ใช่แค่สัปดาห์/เดือนปัจจุบัน ช่วงก่อน
// หน้าคำนวณจากความยาวช่วงเดียวกันที่อยู่ก่อนหน้า rangeStart ทันที
function summarizePeriodByRange(matches, rangeStart, rangeEnd) {
  const periodStart = rangeStart.getTime();
  const periodEnd   = rangeEnd.getTime();
  const spanMs       = periodEnd - periodStart;
  const prevStart    = periodStart - spanMs;
  const prevEnd      = periodStart;

  const flatten = (ms) => ms.flatMap(m =>
    Array.isArray(m.games) && m.games.length > 0
      ? m.games.map(g => ({ ...g, _matchId: m.id }))
      : [{ ...m, _matchId: m.id }]
  );

  const inRange = (g, start, end) => g._matchId >= start && g._matchId < end;

  const allGames = flatten(matches);
  const current  = allGames.filter(g => inRange(g, periodStart, periodEnd));
  const previous = allGames.filter(g => inRange(g, prevStart, prevEnd));

  function stats(games) {
    const total = games.length;
    const wins  = games.filter(g=>g.result==="WIN").length;
    const wr    = total ? Math.round(wins/total*100) : null;
    const withDur = games.filter(g=>g.duration);
    const avgDuration = withDur.length
      ? withDur.reduce((s,g)=> s + Math.max(0, durationToMinutes(g.duration) - (g.pauseDuration?durationToMinutes(g.pauseDuration):0)), 0) / withDur.length
      : null;
    return { total, wins, losses: total-wins, wr, avgDuration };
  }

  const cur = stats(current), prev = stats(previous);

  const heroTally = {};
  current.forEach(g => {
    (g.ourPicks||[]).forEach(p => {
      const name = p.hero?.name;
      if (!name) return;
      if (!heroTally[name]) heroTally[name] = { picks:0, wins:0 };
      heroTally[name].picks++;
      if (g.result==="WIN") heroTally[name].wins++;
    });
  });
  const topHeroes = Object.entries(heroTally)
    .sort((a,b)=>b[1].picks-a[1].picks)
    .slice(0,3)
    .map(([name,v])=>({ name, games:v.picks, wr: Math.round(v.wins/v.picks*100) }));

  function teamCombatStats(games) {
    // รวมค่า damage/damageTaken/gold ของผู้เล่นทั้ง 5 คนต่อเกม แล้วเฉลี่ยเป็น
    // "ค่าเฉลี่ยทั้งทีมต่อเกม" — ต่างจากสถิติรายบุคคลที่แยกเป็นคนๆ ไป
    let dmgSum=0, dmgTakenSum=0, goldSum=0, gamesWithStats=0;
    games.forEach(g => {
      const our = g.gameStats?.our;
      if (!our) return;
      let gameDmg=0, gameDmgTaken=0, gameGold=0, hasAny=false;
      Object.values(our).forEach(s => {
        if (!s) return;
        gameDmg += s.damage||0;
        gameDmgTaken += s.damageTaken||0;
        gameGold += s.gold||0;
        hasAny = true;
      });
      if (hasAny) { dmgSum+=gameDmg; dmgTakenSum+=gameDmgTaken; goldSum+=gameGold; gamesWithStats++; }
    });
    return gamesWithStats ? {
      avgDamage: Math.round(dmgSum/gamesWithStats),
      avgDamageTaken: Math.round(dmgTakenSum/gamesWithStats),
      avgGold: Math.round(goldSum/gamesWithStats),
    } : { avgDamage:null, avgDamageTaken:null, avgGold:null };
  }
  const curTeamCombat = teamCombatStats(current);
  const prevTeamCombat = teamCombatStats(previous);
  const teamCombat = {
    ...curTeamCombat,
    avgDamageDelta: curTeamCombat.avgDamage!=null && prevTeamCombat.avgDamage!=null ? curTeamCombat.avgDamage-prevTeamCombat.avgDamage : null,
    avgDamageTakenDelta: curTeamCombat.avgDamageTaken!=null && prevTeamCombat.avgDamageTaken!=null ? curTeamCombat.avgDamageTaken-prevTeamCombat.avgDamageTaken : null,
    avgGoldDelta: curTeamCombat.avgGold!=null && prevTeamCombat.avgGold!=null ? curTeamCombat.avgGold-prevTeamCombat.avgGold : null,
  };

  const sorted = [...current].sort((a,b)=>b._matchId-a._matchId);
  let streak = 0, streakType = null;
  for (const g of sorted) {
    if (streakType===null) { streakType = g.result; streak = 1; }
    else if (g.result === streakType) streak++;
    else break;
  }

  // ── รายบุคคล + delta เทียบช่วงก่อนหน้า (จับคู่ตามชื่อผู้เล่นเดียวกัน) ──
  const curPlayers = summarizePlayers(current);
  const prevPlayers = summarizePlayers(previous);
  const players = Object.entries(curPlayers)
    .map(([name, p]) => {
      const prevP = prevPlayers[name];
      return {
        name, ...p,
        wrDelta: prevP?.wr!=null && p.wr!=null ? p.wr-prevP.wr : null,
        kdaDelta: prevP && p.kda.ratio!=null && prevP.kda.ratio!=null ? +(p.kda.ratio-prevP.kda.ratio).toFixed(2) : null,
        dpmDelta: prevP?.dpm!=null && p.dpm!=null ? p.dpm-prevP.dpm : null,
        goldPerMinDelta: prevP?.goldPerMin!=null && p.goldPerMin!=null ? p.goldPerMin-prevP.goldPerMin : null,
        avgDamageTakenDelta: prevP?.avgDamageTaken!=null && p.avgDamageTaken!=null ? p.avgDamageTaken-prevP.avgDamageTaken : null,
      };
    })
    .sort((a,b)=>b.games-a.games);

  return {
    ...cur,
    wrDelta: cur.wr!=null && prev.wr!=null ? cur.wr-prev.wr : null,
    avgDurationDelta: cur.avgDuration!=null && prev.avgDuration!=null ? cur.avgDuration-prev.avgDuration : null,
    topHeroes, teamCombat, streak, streakType, players,
  };
}

function DeltaTag({ value, unit="", higherIsBetter=true, decimals=0 }) {
  if (value==null) return null;
  const good = higherIsBetter ? value>=0 : value<=0;
  const shown = Math.abs(value).toFixed(decimals);
  return (
    <span style={{fontSize:10,fontWeight:700,color: good?C.win:C.lose, marginLeft:6}}>
      {value>=0?"▲":"▼"}{shown}{unit}
    </span>
  );
}

function PlayerPeriodRow({ p }) {
  return (
    <div style={{background:C.card,borderRadius:10,padding:"10px 12px",marginBottom:8}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6}}>
        <div style={{fontWeight:800,fontSize:13}}>{p.name}</div>
        <div style={{fontSize:11,color:C.textMuted}}>
          {p.games} เกม · <span style={{color:p.wr>=50?C.win:C.lose,fontWeight:700}}>{p.wr}%</span>
          <DeltaTag value={p.wrDelta} unit="%"/>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginTop:8}}>
        <div>
          <div style={{fontSize:9,color:C.textMuted}}>KDA</div>
          <div style={{fontSize:13,fontWeight:700}}>
            {p.kda.k}/{p.kda.d}/{p.kda.a}
            <span style={{fontSize:10,color:C.textMuted,marginLeft:4}}>({p.kda.label})</span>
          </div>
          <DeltaTag value={p.kdaDelta} decimals={2}/>
        </div>
        <div>
          <div style={{fontSize:9,color:C.textMuted}}>DPM</div>
          <div style={{fontSize:13,fontWeight:700}}>{p.dpm ?? "-"}</div>
          <DeltaTag value={p.dpmDelta}/>
        </div>
        <div>
          <div style={{fontSize:9,color:C.textMuted}}>Gold/min</div>
          <div style={{fontSize:13,fontWeight:700}}>{p.goldPerMin ?? "-"}</div>
          <DeltaTag value={p.goldPerMinDelta}/>
        </div>
        <div>
          <div style={{fontSize:9,color:C.textMuted}}>DMG Taken</div>
          <div style={{fontSize:13,fontWeight:700}}>{p.avgDamageTaken ?? "-"}</div>
          <DeltaTag value={p.avgDamageTakenDelta} higherIsBetter={false}/>
        </div>
      </div>

      {p.topHeroes.length>0 && (
        <div style={{marginTop:8}}>
          <div style={{fontSize:9,color:C.textMuted,marginBottom:4}}>ฮีโร่ที่เล่นบ่อยสุด</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {p.topHeroes.map(h=>(
              <HeroChip key={h.name} name={h.name} size={18} fontSize={10} textCol={h.wr>=50?C.win:C.lose}/>
            ))}
          </div>
        </div>
      )}

      {p.bestHero ? (
        <div style={{marginTop:6,fontSize:11,color:C.textMuted}}>
          ⭐ ฮีโร่ win rate สูงสุด (เล่น ≥ครึ่งเกม): <b style={{color:C.textMain}}>{p.bestHero.name}</b> {p.bestHero.wr}% ({p.bestHero.games} เกม)
        </div>
      ) : (
        <div style={{marginTop:6,fontSize:11,color:C.textMuted}}>⭐ ยังไม่มีฮีโร่ที่เล่นถึงครึ่งของเกมทั้งหมดในช่วงนี้</div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
//  CALENDAR POPUPS — เลือกสัปดาห์/เดือนที่ต้องการดูสถิติ
//  (ทำเป็น custom popup แทน <input type="week"/"month"> เพราะ input แบบ
//  native พวกนี้ Safari/มือถือหลายรุ่นไม่รองรับ หรือรองรับไม่ตรงกัน)
// ═══════════════════════════════════════════
const THAI_MONTHS_SHORT = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
const THAI_DAYS_SHORT = ["จ","อ","พ","พฤ","ศ","ส","อา"];

function WeekPickerPopup({ value, onSelect, onClose }) {
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(value));
  const [hoverWeek, setHoverWeek] = useState(null);

  const gridStart = startOfWeekMon(viewMonth);
  const weeks = [];
  for (let w=0; w<6; w++) {
    const days = [];
    for (let d=0; d<7; d++) days.push(addDays(gridStart, w*7+d));
    weeks.push(days);
    if (days[6] >= addMonths(viewMonth,1) && w>=4) break; // ไม่ต้องโชว์แถวเกินจำเป็น
  }

  const selectedWeekStart = startOfWeekMon(value).getTime();

  return (
    <div style={{position:"absolute",top:"100%",left:0,marginTop:6,zIndex:300,
      background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:12,padding:14,
      boxShadow:"0 8px 24px rgba(0,0,0,0.5)",width:280}}
      onMouseLeave={()=>setHoverWeek(null)}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        <button onClick={()=>setViewMonth(addMonths(viewMonth,-1))}
          style={{background:"transparent",border:"none",color:C.textMuted,cursor:"pointer",fontSize:16,padding:4}}>‹</button>
        <div style={{fontWeight:800,fontSize:13}}>{THAI_MONTHS_SHORT[viewMonth.getMonth()]} {viewMonth.getFullYear()+543}</div>
        <button onClick={()=>setViewMonth(addMonths(viewMonth,1))}
          style={{background:"transparent",border:"none",color:C.textMuted,cursor:"pointer",fontSize:16,padding:4}}>›</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>
        {THAI_DAYS_SHORT.map(d=>(
          <div key={d} style={{textAlign:"center",fontSize:10,color:C.textMuted,padding:"2px 0"}}>{d}</div>
        ))}
      </div>
      {weeks.map((days,wi) => {
        const weekStartMs = days[0].getTime();
        const isSelected = weekStartMs === selectedWeekStart;
        const isHovered = hoverWeek === wi;
        return (
          <div key={wi}
            onMouseEnter={()=>setHoverWeek(wi)}
            onClick={()=>{ onSelect(days[0]); onClose(); }}
            style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,cursor:"pointer",
              background: isSelected ? C.primary+"35" : isHovered ? C.primary+"18" : "transparent",
              borderRadius:6,marginBottom:1}}>
            {days.map((d,di)=>{
              const inMonth = d.getMonth()===viewMonth.getMonth();
              return (
                <div key={di} style={{textAlign:"center",fontSize:11,padding:"5px 0",
                  color: inMonth ? (isSelected?C.primaryLight:C.textMain) : C.textMuted+"80"}}>
                  {d.getDate()}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function MonthPickerPopup({ value, onSelect, onClose }) {
  const [viewYear, setViewYear] = useState(() => value.getFullYear());
  const selectedKey = `${value.getFullYear()}-${value.getMonth()}`;

  return (
    <div style={{position:"absolute",top:"100%",left:0,marginTop:6,zIndex:300,
      background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:12,padding:14,
      boxShadow:"0 8px 24px rgba(0,0,0,0.5)",width:260}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        <button onClick={()=>setViewYear(y=>y-1)}
          style={{background:"transparent",border:"none",color:C.textMuted,cursor:"pointer",fontSize:16,padding:4}}>‹</button>
        <div style={{fontWeight:800,fontSize:13}}>{viewYear+543}</div>
        <button onClick={()=>setViewYear(y=>y+1)}
          style={{background:"transparent",border:"none",color:C.textMuted,cursor:"pointer",fontSize:16,padding:4}}>›</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
        {THAI_MONTHS_SHORT.map((m,mi)=>{
          const key = `${viewYear}-${mi}`;
          const isSelected = key === selectedKey;
          return (
            <button key={m} onClick={()=>{ onSelect(new Date(viewYear, mi, 1)); onClose(); }}
              style={{padding:"8px 0",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:700,
                border:`1px solid ${isSelected?C.primary:C.border}`,
                background:isSelected?C.primary+"35":"transparent",
                color:isSelected?C.primaryLight:C.textMain}}>
              {m}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DatePickerButton({ label, mode, value, onSelect }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div ref={wrapRef} style={{position:"relative"}}>
      <button onClick={()=>setOpen(v=>!v)}
        style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textMuted,
          borderRadius:7,padding:"3px 9px",cursor:"pointer",fontSize:11,fontWeight:700,
          display:"flex",alignItems:"center",gap:4}}>
        📅 {label}
      </button>
      {open && mode==="week" && (
        <WeekPickerPopup value={value} onSelect={onSelect} onClose={()=>setOpen(false)}/>
      )}
      {open && mode==="month" && (
        <MonthPickerPopup value={value} onSelect={onSelect} onClose={()=>setOpen(false)}/>
      )}
    </div>
  );
}

function PeriodSummaryCard({ title, dateRangeLabel, data, mode, pickerValue, onPickDate }) {
  const [showPlayers, setShowPlayers] = useState(false);
  const wrColor = data.wr==null ? C.textMuted : data.wr>=50 ? C.win : C.lose;
  return (
    <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:14,padding:18,flex:1,minWidth:280}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
        <div style={{fontWeight:800,fontSize:14}}>{title}</div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{fontSize:11,color:C.textMuted}}>{dateRangeLabel}</div>
          <DatePickerButton label="เลือกช่วง" mode={mode} value={pickerValue} onSelect={onPickDate}/>
        </div>
      </div>

      {data.total===0 ? (
        <div style={{color:C.textMuted,fontSize:12,padding:"10px 0"}}>ยังไม่มีข้อมูลในช่วงนี้</div>
      ) : (
        <>
          <div style={{display:"flex",alignItems:"baseline",gap:10,marginBottom:4,flexWrap:"wrap"}}>
            <span style={{fontSize:30,fontWeight:900,color:wrColor}}>{data.wr}%</span>
            <span style={{fontSize:12,color:C.textMuted}}>{data.wins}W-{data.losses}L ({data.total} เกม)</span>
            {data.wrDelta!=null && (
              <span style={{fontSize:12,fontWeight:700,color:data.wrDelta>=0?C.win:C.lose}}>
                {data.wrDelta>=0?"▲":"▼"} {Math.abs(data.wrDelta)}% เทียบช่วงก่อนหน้า
              </span>
            )}
          </div>

          {data.avgDuration!=null && (
            <div style={{fontSize:12,color:C.textMuted,marginBottom:4}}>
              ⏱️ เวลาเฉลี่ย/เกม: <b style={{color:C.textMain}}>{minutesToDurationStr(data.avgDuration).replace(".",":")}</b>
              <DeltaTag value={data.avgDurationDelta} unit=" นาที" higherIsBetter={false} decimals={1}/>
            </div>
          )}

          {data.streak>=2 && (
            <div style={{fontSize:12,marginTop:6,marginBottom:10,fontWeight:700,
              color: data.streakType==="WIN" ? C.win : C.lose}}>
              {data.streakType==="WIN" ? "🔥" : "⚠️"} {data.streakType==="WIN"?"ชนะ":"แพ้"}ติดต่อกัน {data.streak} เกม
            </div>
          )}

          {(data.teamCombat.avgDamage!=null || data.teamCombat.avgDamageTaken!=null) && (
            <div style={{marginTop:10}}>
              <div style={{fontSize:10,color:C.textMuted,marginBottom:5}}>ภาพรวมทีม (เฉลี่ย/เกม)</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                <div>
                  <div style={{fontSize:9,color:C.textMuted}}>DMG ทั้งทีม</div>
                  <div style={{fontSize:14,fontWeight:800}}>{data.teamCombat.avgDamage ?? "-"}</div>
                  <DeltaTag value={data.teamCombat.avgDamageDelta}/>
                </div>
                <div>
                  <div style={{fontSize:9,color:C.textMuted}}>DMG Taken ทั้งทีม</div>
                  <div style={{fontSize:14,fontWeight:800}}>{data.teamCombat.avgDamageTaken ?? "-"}</div>
                  <DeltaTag value={data.teamCombat.avgDamageTakenDelta} higherIsBetter={false}/>
                </div>
                <div>
                  <div style={{fontSize:9,color:C.textMuted}}>Gold ทั้งทีม</div>
                  <div style={{fontSize:14,fontWeight:800}}>{data.teamCombat.avgGold ?? "-"}</div>
                  <DeltaTag value={data.teamCombat.avgGoldDelta}/>
                </div>
              </div>
            </div>
          )}

          {data.topHeroes.length>0 && (
            <div style={{marginTop:10}}>
              <div style={{fontSize:10,color:C.textMuted,marginBottom:5}}>ฮีโร่ที่เล่นบ่อยสุด (รวมทั้งทีม)</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {data.topHeroes.map(h=>(
                  <HeroChip key={h.name} name={h.name} size={20} fontSize={11}
                    textCol={h.wr>=50?C.win:C.lose}/>
                ))}
              </div>
            </div>
          )}

          {data.players.length>0 && (
            <div style={{marginTop:14}}>
              <button onClick={()=>setShowPlayers(v=>!v)}
                style={{background:"transparent",border:`1px solid ${C.border}`,color:C.primaryLight,
                  borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:11,fontWeight:700,width:"100%"}}>
                {showPlayers ? "▲ ซ่อนสถิติรายบุคคล" : `▼ ดูสถิติรายบุคคล (${data.players.length} คน)`}
              </button>
              {showPlayers && (
                <div style={{marginTop:10}}>
                  {data.players.map(p => <PlayerPeriodRow key={p.name} p={p}/>)}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
//  RECENT ACTIVITY — ใครแก้อะไรเมื่อไหร่ (เห็นได้ทุกคนในทีม ไม่ใช่แค่
//  admin — ต่างจาก audit log เดิมที่มีแค่เรื่อง role/อนุมัติสมาชิก)
// ═══════════════════════════════════════════
function RecentActivityWidget() {
  const [logs, setLogs] = useState(null); // null = loading
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/activity-log")
      .then(r => r.ok ? r.json() : [])
      .then(setLogs)
      .catch(() => setLogs([]));
  }, []);

  function timeAgo(iso) {
    const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (diffMin < 1) return "เมื่อสักครู่";
    if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`;
    const diffHr = Math.round(diffMin / 60);
    if (diffHr < 24) return `${diffHr} ชม.ที่แล้ว`;
    return new Date(iso).toLocaleDateString("th-TH", { day:"numeric", month:"short" });
  }

  if (logs === null || logs.length === 0) return null; // ไม่มีข้อมูล/กำลังโหลด — ไม่ต้องโชว์การ์ดเปล่าๆ

  return (
    <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:14,padding:18,marginBottom:20}}>
      <button onClick={()=>setOpen(v=>!v)}
        style={{width:"100%",background:"transparent",border:"none",color:C.textMain,
          display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",padding:0}}>
        <span style={{fontWeight:800,fontSize:14}}>🕘 กิจกรรมล่าสุด</span>
        <span style={{fontSize:11,color:C.textMuted}}>{open ? "▲ ซ่อน" : `▼ ดู (${logs.length})`}</span>
      </button>
      {open && (
        <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:8}}>
          {logs.map(log => (
            <div key={log.id} style={{fontSize:12,color:C.textMuted,display:"flex",gap:8,alignItems:"baseline"}}>
              <span style={{color:C.textMain,fontWeight:700,flexShrink:0}}>{log.userEmail.split("@")[0]}</span>
              <span style={{flex:1}}>{log.summary}</span>
              <span style={{flexShrink:0,fontSize:10}}>{timeAgo(log.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WeeklyMonthlySummary({ matches }) {
  const [weekStart,  setWeekStart]  = useState(() => startOfWeekMon(new Date()));
  const [monthStart, setMonthStart] = useState(() => startOfMonth(new Date()));

  const weekEnd  = useMemo(() => addDays(weekStart, 7), [weekStart]);
  const monthEnd = useMemo(() => addMonths(monthStart, 1), [monthStart]);

  // memo บน `matches` + ช่วงที่เลือกเท่านั้น — RovAppInner (parent) re-render
  // บ่อยมากจาก state อื่นๆ ที่ไม่เกี่ยวกับแมตช์เลย ถ้าไม่ memo ไว้
  // summarizePeriodByRange (วน flatMap + aggregate ทุกเกม) จะรันซ้ำทุกครั้ง
  // โดยไม่จำเป็น
  const weekly  = useMemo(() => summarizePeriodByRange(matches||[], weekStart, weekEnd),   [matches, weekStart, weekEnd]);
  const monthly = useMemo(() => summarizePeriodByRange(matches||[], monthStart, monthEnd), [matches, monthStart, monthEnd]);

  const fmt = (d) => d.toLocaleDateString("th-TH",{day:"numeric",month:"short"});
  const weekLabel  = `${fmt(weekStart)} - ${fmt(addDays(weekEnd,-1))}`;
  const monthLabel = `${THAI_MONTHS_SHORT[monthStart.getMonth()]} ${monthStart.getFullYear()+543}`;

  return (
    <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:20}}>
      <PeriodSummaryCard title="📅 รายสัปดาห์" dateRangeLabel={weekLabel} data={weekly}
        mode="week" pickerValue={weekStart} onPickDate={setWeekStart}/>
      <PeriodSummaryCard title="🗓️ รายเดือน" dateRangeLabel={monthLabel} data={monthly}
        mode="month" pickerValue={monthStart} onPickDate={setMonthStart}/>
    </div>
  );
}


// ═══════════════════════════════════════════
function PhaseTracker({ step }) {
  return (
    <div style={{marginBottom:10}}>
      <div style={{display:"flex",gap:3,marginBottom:4}}>
        {PHASE_SEGS.map(seg=>{
          const done   = step > seg.end;
          const active = step >= seg.start && step <= seg.end;
          return (
            <div key={seg.label} style={{flex:seg.flex,textAlign:"center",padding:"3px 4px",borderRadius:6,
              background:active?seg.color+"22":done?seg.color+"10":"#14112a",
              border:`1px solid ${active?seg.color:done?seg.color+"30":C.border}`}}>
              <div style={{fontSize:9,fontWeight:800,color:active?seg.color:done?seg.color+"60":"#3a3a5c"}}>{seg.label}</div>
              {active && <div style={{fontSize:8,color:seg.color+"cc"}}>{step-seg.start+1}/{seg.end-seg.start+1}</div>}
              {done   && <div style={{fontSize:8,color:seg.color+"50"}}>✓</div>}
            </div>
          );
        })}
      </div>
      <div style={{height:2,background:C.border,borderRadius:99}}>
        <div style={{height:2,borderRadius:99,width:`${(step/18)*100}%`,
          background:"linear-gradient(90deg,#ff4757,#6C5CE7,#00cec9)",transition:"width .3s"}}/>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  PLAYER PROFILE — ✅ อ่าน stats จาก gameStats ใหม่
// ═══════════════════════════════════════════
function PlayerProfile({ player, isEnemy, allGames, onBack, photoUrl }) {
  const SC = { card:{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 18px"} };
  const accentCol = isEnemy ? C.lose : C.win;

  const picksKey  = isEnemy ? "enemyPicks"      : "ourPicks";
  const sideKey   = isEnemy ? "enemy"            : "our";
  const resultWin = isEnemy ? "LOSE"             : "WIN";

  // หา index ของผู้เล่นในแต่ละเกม เพื่อ map กับ gameStats[sideKey][idx]
  const pGames = allGames.filter(g => (g[picksKey]||[]).some(s=>s.player===player));
  const pWins  = pGames.filter(g=>g.result===resultWin).length;
  const pWR    = pGames.length ? Math.round(pWins/pGames.length*100) : 0;

  // รวม stats ต่อ hero
  const heroSt = {};
  let totK=0,totD=0,totA=0,totDmg=0,totDtk=0,totGold=0,totDur=0,statG=0;

  pGames.forEach(g=>{
    const picks = g[picksKey] || [];
    const slotIdx = picks.findIndex(s=>s.player===player);
    if (slotIdx < 0) return;
    const slot = picks[slotIdx];
    if (!slot?.hero) return;
    const hName = slot.hero.name;
    if (!heroSt[hName]) heroSt[hName] = {picks:0,wins:0,k:0,d:0,a:0,dmg:0,dtk:0,gold:0,dur:0,cnt:0};
    heroSt[hName].picks++;
    if (g.result===resultWin) heroSt[hName].wins++;

    const gs = g.gameStats?.[sideKey]?.[slotIdx];
    if (gs && gs.kills !== undefined) {
      heroSt[hName].k   += Number(gs.kills||0);
      heroSt[hName].d   += Number(gs.deaths||0);
      heroSt[hName].a   += Number(gs.assists||0);
      heroSt[hName].dmg += Number(gs.damage||0);
      heroSt[hName].dtk += Number(gs.damageTaken||0);
      heroSt[hName].gold+= Number(gs.gold||0);
      heroSt[hName].dur += durationToMinutes(g.duration);
      heroSt[hName].cnt++;
      totK+=Number(gs.kills||0);totD+=Number(gs.deaths||0);totA+=Number(gs.assists||0);
      totDmg+=Number(gs.damage||0);totDtk+=Number(gs.damageTaken||0);
      totGold+=Number(gs.gold||0);
      totDur+=durationToMinutes(g.duration);statG++;
    }
  });

  const heroArr = Object.entries(heroSt).map(([h,s])=>({
    hero:h, picks:s.picks,
    wr:Math.round(s.wins/s.picks*100),
    kda: s.cnt ? ((s.k+s.a)/Math.max(s.d,1)/s.cnt).toFixed(2) : "-",
    avgK:  s.cnt ? (s.k/s.cnt).toFixed(1) : "-",
    avgD:  s.cnt ? (s.d/s.cnt).toFixed(1) : "-",
    avgA:  s.cnt ? (s.a/s.cnt).toFixed(1) : "-",
    avgDmg:s.cnt ? Math.round(s.dmg/s.cnt) : null,
    avgDtk:s.cnt ? Math.round(s.dtk/s.cnt) : null,
    goldPerMin: s.cnt&&s.dur ? Math.round(s.gold/s.dur) : null,
  })).sort((a,b)=>b.picks-a.picks);

  const avgKDAval  = statG ? ((totK+totA)/Math.max(totD,1)).toFixed(2) : "-";
  const avgDmg     = statG ? Math.round(totDmg/statG) : null;
  const avgDtk     = statG ? Math.round(totDtk/statG) : null;
  const goldPerMin = statG&&totDur ? Math.round(totGold/totDur) : null;
  const avgK = statG ? (totK/statG).toFixed(1) : "-";
  const avgD = statG ? (totD/statG).toFixed(1) : "-";
  const avgA = statG ? (totA/statG).toFixed(1) : "-";

  // allGames/pGames เรียงจากใหม่ไปเก่า (แมตช์ใหม่ถูก prepend เข้า array) —
  // ต้องเอา 10 ตัวแรก (ใหม่สุด) แล้ว reverse ให้กราฟไล่จากซ้าย(เก่า)ไปขวา(ใหม่)
  const chartGames = pGames.slice(0, 10).reverse();
  const chartData  = chartGames.map((g,i)=>{
    const picks = g[picksKey] || [];
    const slotIdx = picks.findIndex(s=>s.player===player);
    const slot = picks[slotIdx];
    const gs = g.gameStats?.[sideKey]?.[slotIdx];
    return {
      idx:i+1, win:g.result===resultWin,
      hero:slot?.hero?.name||"?",
      kda: gs?.kills!==undefined
        ? ((Number(gs.kills)+Number(gs.assists||0))/Math.max(Number(gs.deaths)||1,1)).toFixed(1)
        : null,
    };
  });

  return (
    <div>
      <button onClick={onBack} style={{background:"transparent",border:"none",
        color:C.textMuted,cursor:"pointer",fontSize:14,marginBottom:18,padding:0}}>
        ← กลับ Roster
      </button>
      <div style={{display:"flex",alignItems:"center",gap:18,marginBottom:20}}>
        <PlayerAvatar name={player} photoUrl={photoUrl} size={64} team={isEnemy?"enemy":"our"}
          style={{borderRadius:16,fontSize:26}}/>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <h2 style={{margin:0,fontSize:26,fontWeight:900}}>{player}</h2>
            <span style={{fontSize:11,padding:"2px 10px",borderRadius:99,fontWeight:700,
              background:isEnemy?C.lose+"20":C.win+"20",color:isEnemy?C.lose:C.win,
              border:`1px solid ${isEnemy?C.lose+"50":C.win+"50"}`}}>
              {isEnemy?"⚔️ คู่แข่ง":"🛡️ ทีมเรา"}
            </span>
          </div>
          <div style={{fontSize:12,color:C.textMuted,marginTop:3}}>{pGames.length} เกมที่บันทึก</div>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))",gap:12,marginBottom:16}}>
        {[
          {icon:"🎮",label:"Games",    val:pGames.length,       col:C.primaryLight},
          {icon:"🏆",label:"Win Rate", val:`${pWR}%`,           col:pWR>=50?accentCol:C.lose},
          {icon:"✅",label:"Wins",     val:pWins,               col:accentCol},
          {icon:"❌",label:"Losses",   val:pGames.length-pWins, col:C.lose},
        ].map(c=>(
          <div key={c.label} style={{...SC.card,textAlign:"center"}}>
            <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>{c.icon} {c.label}</div>
            <div style={{fontSize:22,fontWeight:800,color:c.col}}>{c.val}</div>
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(70px,1fr))",gap:10,marginBottom:16}}>
        {[
          {label:"Avg K",      val:avgK,                                col:"#00cec9"},
          {label:"Avg D",      val:avgD,                                col:C.lose},
          {label:"Avg A",      val:avgA,                                col:"#a29bfe"},
          {label:"KDA",        val:avgKDAval,                           col:"#fdcb6e"},
          {label:"Avg Dmg",    val:avgDmg?avgDmg.toLocaleString():"-",  col:"#e17055"},
          {label:"Avg DmgTkn", val:avgDtk?avgDtk.toLocaleString():"-",  col:"#fd79a8"},
          {label:"Gold/Min",   val:goldPerMin?goldPerMin.toLocaleString():"-", col:"#feca57"},
        ].map(c=>(
          <div key={c.label} style={{...SC.card,textAlign:"center",padding:"10px 8px"}}>
            <div style={{fontSize:9,color:C.textMuted,marginBottom:3}}>{c.label}</div>
            <div style={{fontSize:16,fontWeight:800,color:statG>0?c.col:C.textMuted+"60"}}>{c.val}</div>
          </div>
        ))}
      </div>

      {statG===0 && pGames.length>0 && (
        <div style={{padding:"10px 14px",background:C.bgCard,borderRadius:8,marginBottom:16,
          fontSize:12,color:C.textMuted,borderLeft:`3px solid ${C.primary}`}}>
          💡 กรอก KDA/Damage/Gold ได้จากปุ่ม "📊 Stats ทั้งทีม" ใน Match Log
        </div>
      )}

      {pGames.length>0&&(
        <div style={{...SC.card,marginBottom:16}}>
          <div style={{fontSize:11,color:C.textMuted,fontWeight:700,marginBottom:8}}>
            Win/Loss ({pWins}W — {pGames.length-pWins}L)
          </div>
          <div style={{display:"flex",height:14,borderRadius:99,overflow:"hidden",gap:1}}>
            {pWins>0&&<div style={{flex:pWins,background:`linear-gradient(90deg,${accentCol},#00b894)`,
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#fff",fontWeight:700}}>
              {pWR}%
            </div>}
            {pGames.length-pWins>0&&<div style={{flex:pGames.length-pWins,background:C.lose,
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#fff",fontWeight:700}}>
              {100-pWR}%
            </div>}
          </div>
        </div>
      )}

      <div style={{...SC.card,marginBottom:16}}>
        <div style={{fontWeight:700,fontSize:13,marginBottom:12}}>📈 ผล 10 เกมล่าสุด</div>
        {chartData.length===0
          ?<div style={{color:C.textMuted,textAlign:"center",padding:"20px 0",fontSize:12}}>ยังไม่มีข้อมูล</div>
          :<div style={{display:"flex",gap:4,alignItems:"flex-end",height:100}}>
            {chartData.map((d,i)=>(
              <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                {d.kda&&<div style={{fontSize:8,color:"#fdcb6e",fontWeight:700,marginBottom:1}}>{d.kda}</div>}
                <div style={{width:"100%",flex:1,borderRadius:"6px 6px 0 0",minHeight:40,
                  background:d.win
                    ?`linear-gradient(180deg,${accentCol},#00b894)`
                    :`linear-gradient(180deg,${C.lose},#e84393)`,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:11,fontWeight:900,color:"#fff"}}>
                  {d.win?"W":"L"}
                </div>
                <div style={{fontSize:8,color:C.textMuted,textAlign:"center",
                  overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",width:"100%"}}>
                  {d.hero}
                </div>
              </div>
            ))}
          </div>
        }
      </div>

      <div style={{...SC.card}}>
        <div style={{fontWeight:700,fontSize:13,color:C.primaryLight,marginBottom:14}}>🦸 Hero Stats</div>
        {heroArr.length===0
          ?<div style={{color:C.textMuted,textAlign:"center",padding:"20px 0",fontSize:12}}>ยังไม่มีข้อมูล</div>
          :<div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:600}}>
              <thead>
                <tr style={{borderBottom:`2px solid ${C.border}`,color:C.textMuted,fontSize:10}}>
                  {["Hero","Picks","Win%","K","D","A","KDA","Avg Dmg","Avg DmgTkn","Gold/Min"].map(h=>(
                    <th key={h} style={{padding:"8px 8px",textAlign:h==="Hero"?"left":"center",fontWeight:700,whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heroArr.map((s,i)=>(
                  <tr key={s.hero} style={{borderBottom:`1px solid ${C.border}`,background:i%2===0?"transparent":C.bgCard}}>
                    <td style={{padding:"8px 8px",whiteSpace:"nowrap"}}><HeroChip name={s.hero} size={26}/></td>
                    <td style={{padding:"8px 8px",textAlign:"center",color:C.primaryLight,fontWeight:700}}>{s.picks}</td>
                    <td style={{padding:"8px 8px",textAlign:"center"}}>
                      <span style={{display:"inline-block",padding:"2px 8px",borderRadius:6,fontWeight:700,fontSize:11,
                        background:s.wr>=50?accentCol+"20":C.lose+"20",color:s.wr>=50?accentCol:C.lose}}>{s.wr}%</span>
                    </td>
                    <td style={{padding:"8px 8px",textAlign:"center",color:"#00cec9",fontWeight:700}}>{s.avgK}</td>
                    <td style={{padding:"8px 8px",textAlign:"center",color:C.lose,fontWeight:700}}>{s.avgD}</td>
                    <td style={{padding:"8px 8px",textAlign:"center",color:"#a29bfe",fontWeight:700}}>{s.avgA}</td>
                    <td style={{padding:"8px 8px",textAlign:"center",color:"#fdcb6e",fontWeight:700}}>{s.kda}</td>
                    <td style={{padding:"8px 8px",textAlign:"center",color:C.textMuted,fontSize:12}}>
                      {s.avgDmg?s.avgDmg.toLocaleString():"-"}
                    </td>
                    <td style={{padding:"8px 8px",textAlign:"center",color:"#fd79a8",fontSize:12}}>
                      {s.avgDtk?s.avgDtk.toLocaleString():"-"}
                    </td>
                    <td style={{padding:"8px 8px",textAlign:"center",color:"#feca57",fontSize:12}}>
                      {s.goldPerMin?s.goldPerMin.toLocaleString():"-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  RIVAL STATS SECTION (Rivals > Overview)
// ═══════════════════════════════════════════
// ═══════════════════════════════════════════
//  PICK / BAN ORDER FILTER
//  (ban slot index 0-3 = 1st-4th ban, pick slot index 0-4 = 1st-5th pick
//   ต่อทีม — ลำดับนี้ถูกบันทึกไว้แล้วตอน Draft เพราะแต่ละทีมจะ ban/pick
//   เรียงตาม slot 0→1→2... เสมอ)
// ═══════════════════════════════════════════
const PICK_BAN_FILTERS = [
  ...Array.from({length: BANS_PER_TEAM}, (_, i) => ({
    id:`ban${i}`, label:`🚫 Ban ที่ ${i+1}`, type:"ban", idx:i,
  })),
  ...Array.from({length: ROLES_PICK.length}, (_, i) => ({
    id:`pick${i}`, label:`🦸 Pick ที่ ${i+1}`, type:"pick", idx:i,
  })),
];

function PickBanOrderPanel({ games, getBans, getPicks, getWon, title }) {
  const [filter, setFilter] = useState(null);
  const active = PICK_BAN_FILTERS.find(f=>f.id===filter);

  const rows = {};
  if (active) {
    games.forEach(g=>{
      let heroName = null;
      if (active.type==="ban") {
        const b = (getBans(g)||[])[active.idx];
        heroName = b?.name || (typeof b==="string" ? b : null);
      } else {
        const slot = (getPicks(g)||[])[active.idx];
        heroName = slot?.hero?.name || null;
      }
      if (!heroName) return;
      if (!rows[heroName]) rows[heroName] = { count:0, wins:0 };
      rows[heroName].count++;
      if (getWon(g)) rows[heroName].wins++;
    });
  }
  const arr = Object.entries(rows)
    .map(([hero,s]) => ({ hero, count:s.count, wr:Math.round(s.wins/s.count*100) }))
    .sort((a,b)=>b.count-a.count);

  return (
    <div style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 16px"}}>
      <div style={{fontWeight:700,fontSize:12,color:C.primaryLight,marginBottom:10}}>
        {title || "🎯 Pick / Ban ตามลำดับ"}
      </div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
        {PICK_BAN_FILTERS.map(f=>(
          <button key={f.id} onClick={()=>setFilter(filter===f.id?null:f.id)}
            style={{background:filter===f.id?(f.type==="ban"?C.ban:C.lose)+"30":"transparent",
              border:`1px solid ${filter===f.id?(f.type==="ban"?C.ban:C.lose):C.border}`,
              color:filter===f.id?(f.type==="ban"?C.ban:C.lose):C.textMuted,
              borderRadius:99,padding:"4px 12px",cursor:"pointer",fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>
            {f.label}
          </button>
        ))}
      </div>
      {!active ? (
        <div style={{textAlign:"center",padding:"16px 0",color:C.textMuted,fontSize:12}}>
          💡 เลือกลำดับด้านบน เพื่อดูว่ามักหยิบ/แบนฮีโร่ตัวไหนในจังหวะนั้น
        </div>
      ) : arr.length===0 ? (
        <div style={{textAlign:"center",padding:"16px 0",color:C.textMuted,fontSize:12}}>ยังไม่มีข้อมูล</div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:4}}>
          {arr.map((r,i)=>(
            <div key={r.hero} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
              padding:"6px 10px",background:i%2===0?"transparent":C.bgCard,borderRadius:7}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:10,color:C.textMuted,width:16}}>#{i+1}</span>
                <HeroChip name={r.hero} size={26} accentCol={active.type==="ban"?C.ban:C.lose} fontSize={12}/>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:10,color:C.textMuted}}>{r.count} ครั้ง</span>
                <span style={{fontSize:11,fontWeight:700,padding:"1px 8px",borderRadius:5,
                  background:r.wr>=50?C.lose+"20":C.win+"20",color:r.wr>=50?C.lose:C.win}}>
                  ชนะ {r.wr}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RivalStatsSection({ selRival, rGames, enemyRosters }) {
  const SC = { card:{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px 18px"} };
  const enemyRoster = enemyRosters[selRival] || [];

  // ── คำนวณ stats ผู้เล่นคู่แข่ง ──
  const playerStats = {};
  rGames.forEach(g => {
    (g.enemyPicks||[]).forEach((slot, idx) => {
      const name = slot.player;
      if (!name) return;
      if (!playerStats[name]) playerStats[name] = {games:0,wins:0,k:0,d:0,a:0,dmg:0,dtk:0,gold:0,dur:0,cnt:0,heroes:{}};
      const ps = playerStats[name];
      ps.games++;
      if (g.result === "LOSE") ps.wins++;
      if (slot.hero?.name) ps.heroes[slot.hero.name] = (ps.heroes[slot.hero.name]||0)+1;
      const gs = g.gameStats?.enemy?.[idx];
      if (gs?.kills !== undefined) {
        ps.k   += Number(gs.kills||0);
        ps.d   += Number(gs.deaths||0);
        ps.a   += Number(gs.assists||0);
        ps.dmg += Number(gs.damage||0);
        ps.dtk += Number(gs.damageTaken||0);
        ps.gold+= Number(gs.gold||0);
        ps.dur += durationToMinutes(g.duration);
        ps.cnt++;
      }
    });
  });

  // ── คำนวณ KDA ต่อ Hero คู่แข่ง ──
  const heroKDA = {};
  rGames.forEach(g => {
    (g.enemyPicks||[]).forEach((slot, idx) => {
      const h = slot.hero?.name;
      if (!h) return;
      if (!heroKDA[h]) heroKDA[h] = {picks:0,wins:0,k:0,d:0,a:0,dmg:0,dtk:0,gold:0,dur:0,cnt:0};
      const hd = heroKDA[h];
      hd.picks++;
      if (g.result==="LOSE") hd.wins++;
      const gs = g.gameStats?.enemy?.[idx];
      if (gs?.kills !== undefined) {
        hd.k   += Number(gs.kills||0);
        hd.d   += Number(gs.deaths||0);
        hd.a   += Number(gs.assists||0);
        hd.dmg += Number(gs.damage||0);
        hd.dtk += Number(gs.damageTaken||0);
        hd.gold+= Number(gs.gold||0);
        hd.dur += durationToMinutes(g.duration);
        hd.cnt++;
      }
    });
  });
  const heroArr = Object.entries(heroKDA)
    .map(([h,s]) => ({
      hero:h, picks:s.picks,
      wr: Math.round(s.wins/s.picks*100),
      kda: s.cnt ? ((s.k+s.a)/Math.max(s.d,1)/s.cnt).toFixed(2) : "-",
      avgK:  s.cnt?(s.k/s.cnt).toFixed(1):"-",
      avgD:  s.cnt?(s.d/s.cnt).toFixed(1):"-",
      avgA:  s.cnt?(s.a/s.cnt).toFixed(1):"-",
      avgDmg:s.cnt?Math.round(s.dmg/s.cnt):null,
      avgDtk:s.cnt?Math.round(s.dtk/s.cnt):null,
      gpm:   s.cnt&&s.dur?Math.round(s.gold/s.dur):null,
    }))
    .sort((a,b)=>b.picks-a.picks);

  const playerArr = Object.entries(playerStats)
    .map(([name,ps]) => ({
      name,
      games:ps.games, wins:ps.wins,
      wr: ps.games?Math.round(ps.wins/ps.games*100):0,
      kda: ps.cnt ? ((ps.k+ps.a)/Math.max(ps.d,1)/ps.cnt).toFixed(2):"-",
      avgK:  ps.cnt?(ps.k/ps.cnt).toFixed(1):"-",
      avgD:  ps.cnt?(ps.d/ps.cnt).toFixed(1):"-",
      avgA:  ps.cnt?(ps.a/ps.cnt).toFixed(1):"-",
      avgDmg:ps.cnt?Math.round(ps.dmg/ps.cnt):null,
      avgDtk:ps.cnt?Math.round(ps.dtk/ps.cnt):null,
      gpm:   ps.cnt&&ps.dur?Math.round(ps.gold/ps.dur):null,
      mainHero: Object.entries(ps.heroes).sort((a,b)=>b[1]-a[1])[0]?.[0]||"-",
      hasStats: ps.cnt>0,
    }))
    .sort((a,b)=>b.games-a.games);

  // ── กราฟเปรียบเทียบ ──
  // avg per game across all games that have stats
  function avgStat(side, field) {
    let total=0, cnt=0;
    rGames.forEach(g => {
      const picks = side==="our" ? (g.ourPicks||[]) : (g.enemyPicks||[]);
      picks.forEach((slot,idx)=>{
        const gs = g.gameStats?.[side]?.[idx];
        if (gs?.[field] !== undefined) { total+=Number(gs[field]||0); cnt++; }
      });
    });
    return cnt ? Math.round(total/cnt) : 0;
  }

  const compareData = [
    { label:"Avg Damage",    our: avgStat("our","damage"),      enemy: avgStat("enemy","damage"),      col:"#e17055" },
    { label:"Avg Dmg Taken", our: avgStat("our","damageTaken"), enemy: avgStat("enemy","damageTaken"), col:"#fd79a8" },
    { label:"Gold/min",      our: avgStat("our","gold"),        enemy: avgStat("enemy","gold"),        col:"#feca57" },
  ];
  const hasCompareData = compareData.some(d=>d.our>0||d.enemy>0);

  function Bar({val, maxVal, col, label}) {
    const pct = maxVal>0 ? Math.round(val/maxVal*100) : 0;
    return (
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
        <div style={{fontSize:9,color:C.textMuted,width:20,textAlign:"right"}}>{label}</div>
        <div style={{flex:1,height:14,background:C.bgBase,borderRadius:99,overflow:"hidden"}}>
          <div style={{width:`${pct}%`,height:"100%",background:col,borderRadius:99,
            display:"flex",alignItems:"center",paddingLeft:4,minWidth:pct>0?16:0,transition:"width .4s"}}>
            {pct>=10&&<span style={{fontSize:8,color:"#fff",fontWeight:700,whiteSpace:"nowrap"}}>
              {val.toLocaleString()}
            </span>}
          </div>
        </div>
        {pct<10&&<span style={{fontSize:9,color:col,fontWeight:700,minWidth:36}}>{val.toLocaleString()}</span>}
      </div>
    );
  }

  const hasPlayerStats = playerArr.some(p=>p.hasStats);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16,marginTop:4}}>

      {/* ── กราฟเปรียบเทียบ ── */}
      <div style={SC.card}>
        <div style={{fontWeight:700,fontSize:13,color:C.primaryLight,marginBottom:14}}>
          📊 เปรียบเทียบ ทีมเรา vs {selRival}
        </div>
        {!hasCompareData ? (
          <div style={{color:C.textMuted,fontSize:12,textAlign:"center",padding:"16px 0"}}>
            ยังไม่มี Stats — กรอกข้อมูลใน Match Log ก่อนนะครับ
          </div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {compareData.map(row => {
              const maxVal = Math.max(row.our, row.enemy, 1);
              return (
                <div key={row.label}>
                  <div style={{fontSize:10,color:row.col,fontWeight:700,marginBottom:6}}>{row.label}</div>
                  <Bar val={row.our}   maxVal={maxVal} col={C.win}  label="เรา"/>
                  <Bar val={row.enemy} maxVal={maxVal} col={C.lose} label="คู่แข่ง"/>
                  <div style={{display:"flex",gap:16,marginTop:4}}>
                    {row.our>0&&row.enemy>0&&(
                      <span style={{fontSize:10,color:row.our>=row.enemy?C.win:C.lose,fontWeight:700}}>
                        {row.our>=row.enemy
                          ? `🛡️ ทีมเรานำ +${(row.our-row.enemy).toLocaleString()}`
                          : `⚔️ คู่แข่งนำ +${(row.enemy-row.our).toLocaleString()}`}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div style={{display:"flex",gap:16,marginTop:12,paddingTop:10,borderTop:`1px solid ${C.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:5}}>
            <div style={{width:12,height:12,borderRadius:3,background:C.win}}/>
            <span style={{fontSize:10,color:C.win,fontWeight:700}}>🛡️ ทีมเรา</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:5}}>
            <div style={{width:12,height:12,borderRadius:3,background:C.lose}}/>
            <span style={{fontSize:10,color:C.lose,fontWeight:700}}>⚔️ {selRival}</span>
          </div>
        </div>
      </div>

      {/* ── ตาราง Stats ผู้เล่นคู่แข่ง ── */}
      <div style={SC.card}>
        <div style={{fontWeight:700,fontSize:13,color:C.lose,marginBottom:14}}>
          👤 Stats ผู้เล่น {selRival}
        </div>
        {playerArr.length===0 ? (
          <div style={{color:C.textMuted,fontSize:12,textAlign:"center",padding:"16px 0"}}>
            ยังไม่มีผู้เล่นที่ assign — เลือกชื่อผู้เล่นตอน Draft แล้วกรอก Stats ใน Match Log
          </div>
        ) : (
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:640}}>
              <thead>
                <tr style={{borderBottom:`2px solid ${C.border}`,color:C.textMuted,fontSize:10}}>
                  {["ผู้เล่น","Main Hero","G","W%","Avg K","Avg D","Avg A","KDA","Avg Dmg","Avg DmgTkn","GPM"].map(h=>(
                    <th key={h} style={{padding:"7px 8px",textAlign:h==="ผู้เล่น"||h==="Main Hero"?"left":"center",
                      fontWeight:700,whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {playerArr.map((p,i)=>(
                  <tr key={p.name} style={{borderBottom:`1px solid ${C.border}`,
                    background:i%2===0?"transparent":C.bgCard}}>
                    <td style={{padding:"7px 8px",fontWeight:800,color:C.lose,fontSize:13}}>{p.name}</td>
                    <td style={{padding:"7px 8px"}}>
                      {p.mainHero!=="-" ? <HeroChip name={p.mainHero} size={22} fontSize={11} bold={false}/>
                        : <span style={{fontSize:11,color:C.textMuted}}>-</span>}
                    </td>
                    <td style={{padding:"7px 8px",textAlign:"center",fontWeight:700,color:C.primaryLight}}>{p.games}</td>
                    <td style={{padding:"7px 8px",textAlign:"center"}}>
                      <span style={{display:"inline-block",padding:"1px 7px",borderRadius:5,fontWeight:700,fontSize:11,
                        background:p.wr>=50?C.lose+"20":C.win+"20",
                        color:p.wr>=50?C.lose:C.win}}>{p.games?`${p.wr}%`:"-"}</span>
                    </td>
                    <td style={{padding:"7px 8px",textAlign:"center",color:"#00cec9",fontWeight:700}}>{p.avgK}</td>
                    <td style={{padding:"7px 8px",textAlign:"center",color:C.lose,fontWeight:700}}>{p.avgD}</td>
                    <td style={{padding:"7px 8px",textAlign:"center",color:"#a29bfe",fontWeight:700}}>{p.avgA}</td>
                    <td style={{padding:"7px 8px",textAlign:"center",color:"#fdcb6e",fontWeight:700}}>{p.kda}</td>
                    <td style={{padding:"7px 8px",textAlign:"center",color:"#e17055",fontSize:11}}>
                      {p.avgDmg?p.avgDmg.toLocaleString():"-"}
                    </td>
                    <td style={{padding:"7px 8px",textAlign:"center",color:"#fd79a8",fontSize:11}}>
                      {p.avgDtk?p.avgDtk.toLocaleString():"-"}
                    </td>
                    <td style={{padding:"7px 8px",textAlign:"center",color:"#feca57",fontSize:11}}>
                      {p.gpm?p.gpm.toLocaleString():"-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!hasPlayerStats&&(
              <div style={{marginTop:10,padding:"8px 12px",background:C.primary+"10",borderRadius:7,
                fontSize:11,color:C.textMuted,borderLeft:`3px solid ${C.primary}`}}>
                💡 กรอก KDA/Damage/Gold ได้จากปุ่ม "📊 Stats ทั้งทีม" ใน Match Log
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Pick/Ban ตามลำดับ ── */}
      <PickBanOrderPanel
        games={rGames}
        getBans={g=>g.enemyBans}
        getPicks={g=>g.enemyPicks}
        getWon={g=>g.result==="LOSE"}
        title={`🎯 Pick / Ban ตามลำดับ ของ ${selRival}`}
      />

      {/* ── KDA ต่อ Hero คู่แข่ง ── */}
      <div style={SC.card}>
        <div style={{fontWeight:700,fontSize:13,color:C.lose,marginBottom:14}}>
          ⚔️ KDA ต่อ Hero ของ {selRival}
        </div>
        {heroArr.length===0 ? (
          <div style={{color:C.textMuted,fontSize:12,textAlign:"center",padding:"16px 0"}}>ยังไม่มีข้อมูล</div>
        ) : (
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:560}}>
              <thead>
                <tr style={{borderBottom:`2px solid ${C.border}`,color:C.textMuted,fontSize:10}}>
                  {["Hero","Picks","Win%","Avg K","Avg D","Avg A","KDA","Avg Dmg","Avg DmgTkn"].map(h=>(
                    <th key={h} style={{padding:"7px 8px",textAlign:h==="Hero"?"left":"center",fontWeight:700,whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heroArr.map((s,i)=>(
                  <tr key={s.hero} style={{borderBottom:`1px solid ${C.border}`,
                    background:i%2===0?"transparent":C.bgCard}}>
                    <td style={{padding:"7px 8px"}}><HeroChip name={s.hero} size={24} accentCol={C.lose} fontSize={12}/></td>
                    <td style={{padding:"7px 8px",textAlign:"center",color:C.primaryLight,fontWeight:700}}>{s.picks}</td>
                    <td style={{padding:"7px 8px",textAlign:"center"}}>
                      <span style={{display:"inline-block",padding:"1px 7px",borderRadius:5,fontWeight:700,fontSize:11,
                        background:s.wr>=50?C.lose+"20":C.win+"20",color:s.wr>=50?C.lose:C.win}}>{s.wr}%</span>
                    </td>
                    <td style={{padding:"7px 8px",textAlign:"center",color:"#00cec9",fontWeight:700}}>{s.avgK}</td>
                    <td style={{padding:"7px 8px",textAlign:"center",color:C.lose,fontWeight:700}}>{s.avgD}</td>
                    <td style={{padding:"7px 8px",textAlign:"center",color:"#a29bfe",fontWeight:700}}>{s.avgA}</td>
                    <td style={{padding:"7px 8px",textAlign:"center",color:"#fdcb6e",fontWeight:700}}>{s.kda}</td>
                    <td style={{padding:"7px 8px",textAlign:"center",color:"#e17055",fontSize:11}}>
                      {s.avgDmg?s.avgDmg.toLocaleString():"-"}
                    </td>
                    <td style={{padding:"7px 8px",textAlign:"center",color:"#fd79a8",fontSize:11}}>
                      {s.avgDtk?s.avgDtk.toLocaleString():"-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  CSV EXPORT UTIL
// ═══════════════════════════════════════════
function exportCSV(matches, allGames) {
  const rows = [];
  // header
  rows.push([
    "Date","Session","RivalName","BoType","GameNo",
    "Result","OurSide","OurScore","EnemyScore","Duration(min)",
    "Team","SlotIdx","Role","Hero","Player",
    "Kills","Deaths","Assists","Damage","DamageTaken","Gold","KDA"
  ].join(","));

  matches.forEach((m, si) => {
    const games = Array.isArray(m.games)&&m.games.length ? m.games : [m];
    games.forEach((g, gi) => {
      const gameNo = gi+1;
      // our picks
      (g.ourPicks||[]).forEach((slot, idx) => {
        const gs = g.gameStats?.our?.[idx] || {};
        const k=Number(gs.kills||0), d=Number(gs.deaths||0), a=Number(gs.assists||0);
        const kda = (k+a)/Math.max(d,1);
        rows.push([
          m.date, si+1, `"${m.rivalName||""}"`, m.boType||"BO1", gameNo,
          g.result||"", g.ourSide||"", g.ourScore||0, g.enemyScore||0, durationToMinutes(g.duration).toFixed(2),
          "เรา", idx, slot.role||"", `"${slot.hero?.name||""}"`, `"${slot.player||""}"`,
          gs.kills??"-", gs.deaths??"-", gs.assists??"-",
          gs.damage??"-", gs.damageTaken??"-", gs.gold??"-",
          gs.kills!==undefined ? kda.toFixed(2) : "-"
        ].join(","));
      });
      // enemy picks
      (g.enemyPicks||[]).forEach((slot, idx) => {
        const gs = g.gameStats?.enemy?.[idx] || {};
        const k=Number(gs.kills||0), d=Number(gs.deaths||0), a=Number(gs.assists||0);
        const kda = (k+a)/Math.max(d,1);
        rows.push([
          m.date, si+1, `"${m.rivalName||""}"`, m.boType||"BO1", gameNo,
          g.result||"", g.ourSide||"", g.ourScore||0, g.enemyScore||0, durationToMinutes(g.duration).toFixed(2),
          "คู่แข่ง", idx, slot.role||"", `"${slot.hero?.name||""}"`, `"${slot.player||""}"`,
          gs.kills??"-", gs.deaths??"-", gs.assists??"-",
          gs.damage??"-", gs.damageTaken??"-", gs.gold??"-",
          gs.kills!==undefined ? kda.toFixed(2) : "-"
        ].join(","));
      });
    });
  });

  const csv = "\uFEFF" + rows.join("\n"); // BOM for Excel Thai
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = `rov_stats_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Export JSON backup ──
function exportJSON(appState) {
  const payload = {
    version: 7,
    exportedAt: new Date().toISOString(),
    matches:       appState.matches,
    rivals:        appState.rivals,
    roster:        appState.roster,
    enemyRosters:  appState.enemyRosters,
    scoutMatches:  appState.scoutMatches,
    playerPhotos:  appState.playerPhotos,
    heroPhotos:    appState.heroPhotos,
    customHeroes:  appState.customHeroes,
    roleOverrides: appState.roleOverrides,
    videos:        appState.videos,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:"application/json"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = `rov_backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Import JSON + merge (no overwrite by id) ──
function importJSON(file, currentState, onMerge) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      // dedup by id
      const mergeById = (existing, incoming) => {
        const ids = new Set(existing.map(x=>x.id));
        return [...existing, ...(incoming||[]).filter(x=>!ids.has(x.id))];
      };
      // roster: merge unique strings
      const mergeArr = (a, b) => [...new Set([...a, ...(b||[])])];
      // enemyRosters: merge per team
      const mergeRosters = (a, b) => {
        const result = {...a};
        Object.entries(b||{}).forEach(([team, players]) => {
          result[team] = mergeArr(result[team]||[], players);
        });
        return result;
      };
      // customHeroes: dedup by name (case-insensitive)
      const mergeCustomHeroes = (existing, incoming) => {
        const names = new Set(existing.map(h=>h.name.toLowerCase()));
        return [...existing, ...(incoming||[]).filter(h=>!names.has(h.name.toLowerCase()))];
      };

      const merged = {
        matches:       mergeById(currentState.matches,      data.matches),
        rivals:        mergeById(currentState.rivals,       data.rivals),
        roster:        mergeArr(currentState.roster,        data.roster),
        enemyRosters:  mergeRosters(currentState.enemyRosters, data.enemyRosters),
        scoutMatches:  mergeById(currentState.scoutMatches, data.scoutMatches),
        playerPhotos:  { ...currentState.playerPhotos,  ...(data.playerPhotos||{}) },
        heroPhotos:    { ...currentState.heroPhotos,    ...(data.heroPhotos||{}) },
        customHeroes:  mergeCustomHeroes(currentState.customHeroes, data.customHeroes),
        roleOverrides: { ...currentState.roleOverrides, ...(data.roleOverrides||{}) },
        videos:        mergeById(currentState.videos||[], data.videos),
      };

      const added = {
        matches:      merged.matches.length      - currentState.matches.length,
        rivals:       merged.rivals.length       - currentState.rivals.length,
        scoutMatches: merged.scoutMatches.length - currentState.scoutMatches.length,
      };
      onMerge(merged, added);
    } catch {
      alert("❌ ไฟล์ไม่ถูกต้อง — กรุณาใช้ไฟล์ backup JSON ของแอปนี้เท่านั้น");
    }
  };
  reader.readAsText(file);
}

// ═══════════════════════════════════════════
//  HERO SYNERGY / COUNTER MATRIX
// ═══════════════════════════════════════════
function HeroSynergyCounter({ allGames, scoutMatches }) {
  const [mode,       setMode]       = useState("synergy"); // "synergy" | "counter"
  const [dataSource, setDataSource] = useState("all");     // "all"|"our"|"enemy"|"scout"
  const [minGames,   setMinGames]   = useState(2);
  const [searchA,    setSearchA]    = useState("");
  const [searchB,    setSearchB]    = useState("");

  // ── build game samples ──
  // each sample: { heroA, heroB, win: bool }
  const samples = [];

  if (dataSource==="all" || dataSource==="our" || dataSource==="enemy") {
    allGames.forEach(g => {
      const ourWin = g.result==="WIN";
      if (mode==="synergy") {
        // same-team pairs
        if (dataSource!=="enemy") {
          const op = (g.ourPicks||[]).filter(s=>s.hero?.name).map(s=>s.hero.name);
          for (let i=0;i<op.length;i++) for (let j=i+1;j<op.length;j++)
            samples.push({heroA:op[i], heroB:op[j], win:ourWin, src:"our"});
        }
        if (dataSource!=="our") {
          const ep = (g.enemyPicks||[]).filter(s=>s.hero?.name).map(s=>s.hero.name);
          for (let i=0;i<ep.length;i++) for (let j=i+1;j<ep.length;j++)
            samples.push({heroA:ep[i], heroB:ep[j], win:!ourWin, src:"enemy"});
        }
      } else {
        // cross-team: our hero vs enemy hero
        const op = (g.ourPicks||[]).filter(s=>s.hero?.name).map(s=>s.hero.name);
        const ep = (g.enemyPicks||[]).filter(s=>s.hero?.name).map(s=>s.hero.name);
        if (dataSource!=="enemy") {
          op.forEach(ha => ep.forEach(hb =>
            samples.push({heroA:ha, heroB:hb, win:ourWin, src:"our"})
          ));
        }
        if (dataSource!=="our") {
          ep.forEach(ha => op.forEach(hb =>
            samples.push({heroA:ha, heroB:hb, win:!ourWin, src:"enemy"})
          ));
        }
      }
    });
  }

  if (dataSource==="all" || dataSource==="scout") {
    scoutMatches.forEach(sm => {
      (sm.games||[]).forEach(g => {
        const aWin = g.teamAResult==="WIN";
        if (mode==="synergy") {
          const pa = (g.picksA||[]).filter(s=>s.hero?.name).map(s=>s.hero.name);
          const pb = (g.picksB||[]).filter(s=>s.hero?.name).map(s=>s.hero.name);
          for (let i=0;i<pa.length;i++) for (let j=i+1;j<pa.length;j++)
            samples.push({heroA:pa[i], heroB:pa[j], win:aWin, src:"scout"});
          for (let i=0;i<pb.length;i++) for (let j=i+1;j<pb.length;j++)
            samples.push({heroA:pb[i], heroB:pb[j], win:!aWin, src:"scout"});
        } else {
          const pa = (g.picksA||[]).filter(s=>s.hero?.name).map(s=>s.hero.name);
          const pb = (g.picksB||[]).filter(s=>s.hero?.name).map(s=>s.hero.name);
          pa.forEach(ha => pb.forEach(hb => samples.push({heroA:ha, heroB:hb, win:aWin,  src:"scout"})));
          pb.forEach(ha => pa.forEach(hb => samples.push({heroA:ha, heroB:hb, win:!aWin, src:"scout"})));
        }
      });
    });
  }

  // ── aggregate ──
  const pairMap = {};
  samples.forEach(({heroA, heroB, win}) => {
    const key = [heroA, heroB].sort().join("|||");
    if (!pairMap[key]) pairMap[key] = {heroA, heroB, games:0, wins:0};
    pairMap[key].games++;
    if (win) pairMap[key].wins++;
  });

  const pairs = Object.values(pairMap)
    .filter(p => p.games >= minGames)
    .map(p => ({...p, wr: Math.round(p.wins/p.games*100)}))
    .sort((a,b) => b.wr===a.wr ? b.games-a.games : b.wr-a.wr);

  const filtered = pairs.filter(p => {
    const sa = searchA.toLowerCase(), sb = searchB.toLowerCase();
    const n1 = p.heroA.toLowerCase(), n2 = p.heroB.toLowerCase();
    const matchA = !sa || n1.includes(sa) || n2.includes(sa);
    const matchB = !sb || n1.includes(sb) || n2.includes(sb);
    return matchA && matchB;
  });

  const WRColor = wr => wr>=65?C.win : wr>=50?"#fdcb6e" : C.lose;

  return (
    <div style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:14,padding:20,marginTop:20}}>
      {/* header */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <h3 style={{margin:0,fontSize:15,fontWeight:800,color:C.primaryLight}}>
          🧬 Hero Synergy / Counter Matrix
        </h3>
        {/* mode toggle */}
        <div style={{display:"flex",gap:3,background:C.bgBase,borderRadius:8,padding:3,border:`1px solid ${C.border}`}}>
          {[{id:"synergy",label:"🤝 Synergy"},{id:"counter",label:"⚔️ Counter"}].map(m=>(
            <button key={m.id} onClick={()=>setMode(m.id)} style={{
              background:mode===m.id?C.primary:"transparent",
              border:"none",color:mode===m.id?"#fff":C.textMuted,
              borderRadius:6,padding:"5px 14px",cursor:"pointer",fontWeight:700,fontSize:12}}>
              {m.label}
            </button>
          ))}
        </div>
        {/* data source */}
        <div style={{display:"flex",gap:3,background:C.bgBase,borderRadius:8,padding:3,border:`1px solid ${C.border}`}}>
          {[{id:"all",label:"ทั้งหมด"},{id:"our",label:"🛡️ ทีมเรา"},{id:"enemy",label:"⚔️ คู่แข่ง"},{id:"scout",label:"🔍 Scout"}].map(s=>(
            <button key={s.id} onClick={()=>setDataSource(s.id)} style={{
              background:dataSource===s.id?C.primary+"80":"transparent",
              border:"none",color:dataSource===s.id?C.primaryLight:C.textMuted,
              borderRadius:6,padding:"4px 10px",cursor:"pointer",fontWeight:700,fontSize:11}}>
              {s.label}
            </button>
          ))}
        </div>
        {/* min games */}
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:10,color:C.textMuted}}>Min เกม</span>
          <select value={minGames} onChange={e=>setMinGames(Number(e.target.value))}
            style={{...iStyle,width:60,padding:"3px 6px",fontSize:11}}>
            {[1,2,3,5].map(n=><option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      {/* mode description */}
      <div style={{fontSize:11,color:C.textMuted,marginBottom:12,padding:"6px 10px",
        background:C.bgCard,borderRadius:7,borderLeft:`3px solid ${C.primary}`}}>
        {mode==="synergy"
          ? "🤝 Synergy — Hero ที่อยู่ทีมเดียวกันแล้วชนะบ่อย (ข้อมูลจาก picks ฝั่งเดียวกัน)"
          : "⚔️ Counter — Hero A ข้ามทีม Hero B แล้วฝั่ง A ชนะบ่อย (ข้อมูลจาก picks ข้ามทีม)"}
      </div>

      {/* search filters */}
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        <input value={searchA} onChange={e=>setSearchA(e.target.value)}
          placeholder="🔍 Hero A..."
          style={{...iStyle,flex:1,padding:"6px 10px",fontSize:12}}/>
        <input value={searchB} onChange={e=>setSearchB(e.target.value)}
          placeholder="🔍 Hero B..."
          style={{...iStyle,flex:1,padding:"6px 10px",fontSize:12}}/>
        {(searchA||searchB)&&(
          <button onClick={()=>{setSearchA("");setSearchB("");}}
            style={{background:C.lose+"20",border:`1px solid ${C.lose}40`,color:C.lose,
              borderRadius:8,padding:"0 12px",cursor:"pointer",fontSize:12,fontWeight:700}}>✕</button>
        )}
      </div>

      {/* results */}
      {filtered.length===0 ? (
        <div style={{textAlign:"center",padding:"30px 20px",color:C.textMuted,fontSize:12}}>
          {samples.length===0
            ? `ยังไม่มีข้อมูลเพียงพอ — บันทึกแมตช์เพิ่มแล้วลองใหม่`
            : `ไม่พบ Hero pair ที่ตรงกับ filter (ลองลด Min เกม)`}
        </div>
      ) : (
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:480}}>
            <thead>
              <tr style={{background:"#0f0c22",borderBottom:`2px solid ${C.border}`}}>
                <th style={{padding:"8px 10px",textAlign:"center",fontSize:10,color:C.textMuted,fontWeight:700,width:60}}>WR%</th>
                <th style={{padding:"8px 10px",textAlign:"left",fontSize:10,color:C.textMuted,fontWeight:700}}>
                  {mode==="synergy"?"Hero คู่":"Hero A"}
                </th>
                <th style={{padding:"8px 10px",textAlign:"left",fontSize:10,color:C.textMuted,fontWeight:700}}>
                  {mode==="synergy"?"":"vs Hero B"}
                </th>
                <th style={{padding:"8px 10px",textAlign:"center",fontSize:10,color:C.textMuted,fontWeight:700}}>เกม</th>
                <th style={{padding:"8px 10px",textAlign:"center",fontSize:10,color:C.textMuted,fontWeight:700}}>W</th>
                <th style={{padding:"8px 10px",textAlign:"center",fontSize:10,color:C.textMuted,fontWeight:700}}>L</th>
                <th style={{padding:"8px 10px",fontSize:10,color:C.textMuted,fontWeight:700,minWidth:100}}>WR Bar</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0,50).map((p,i)=>{
                const col = WRColor(p.wr);
                return (
                  <tr key={i} style={{borderBottom:`1px solid ${C.border}`,
                    background:i%2===0?"transparent":C.bgCard}}>
                    <td style={{padding:"7px 10px",textAlign:"center"}}>
                      <span style={{display:"inline-block",padding:"3px 10px",borderRadius:6,
                        fontWeight:800,fontSize:12,background:col+"22",color:col}}>
                        {p.wr}%
                      </span>
                    </td>
                    <td style={{padding:"7px 10px"}}>
                      <HeroChip name={p.heroA} size={26}/>
                    </td>
                    <td style={{padding:"7px 10px"}}>
                      {mode==="synergy" ? (
                        <HeroChip name={p.heroB} size={26}/>
                      ) : (
                        <HeroChip name={p.heroB} size={26} accentCol={C.lose} textCol={C.lose}/>
                      )}
                    </td>
                    <td style={{padding:"7px 10px",textAlign:"center",color:C.primaryLight,fontWeight:700}}>{p.games}</td>
                    <td style={{padding:"7px 10px",textAlign:"center",color:C.win,fontWeight:700}}>{p.wins}</td>
                    <td style={{padding:"7px 10px",textAlign:"center",color:C.lose,fontWeight:700}}>{p.games-p.wins}</td>
                    <td style={{padding:"7px 10px"}}>
                      <div style={{height:8,background:C.bgBase,borderRadius:99,overflow:"hidden"}}>
                        <div style={{width:`${p.wr}%`,height:"100%",background:col,borderRadius:99,transition:"width .3s"}}/>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length>50&&(
            <div style={{textAlign:"center",padding:"8px 0",fontSize:11,color:C.textMuted}}>
              แสดง 50 / {filtered.length} คู่ — ใช้ช่อง Search เพื่อ filter ให้แคบลง
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
//  MAIN APP
// ═══════════════════════════════════════════

// ═══════════════════════════════════════════
//  SCOUT GAME FORM — บันทึก 1 เกม
// ═══════════════════════════════════════════
function ScoutGameForm({ gameNo, teamA, teamB, rivals, enemyRosters, onSave, onCancel }) {
  const initPicks = () => ROLES_PICK.map(r=>({role:r,hero:null,player:""}));
  const [picksA,    setPicksA]    = useState(initPicks);
  const [picksB,    setPicksB]    = useState(initPicks);
  const [bansA,     setBansA]     = useState(Array(BANS_PER_TEAM).fill(null)); // ลำดับแบน ทีม A
  const [bansB,     setBansB]     = useState(Array(BANS_PER_TEAM).fill(null)); // ลำดับแบน ทีม B
  // statsA/B: { [slotIdx]: { kills, deaths, assists, damage, damageTaken, gold } }
  const [statsA,    setStatsA]    = useState({});
  const [statsB,    setStatsB]    = useState({});
  const [result,    setResult]    = useState("A");
  const [sideA,     setSideA]     = useState("blue"); // "blue" | "red" — side ของ teamA
  const [killsA,    setKillsA]    = useState("");
  const [killsB,    setKillsB]    = useState("");
  const [duration,  setDuration]  = useState("");
  const [note,      setNote]      = useState("");
  const [tags,      setTags]      = useState([]);
  const [search,    setSearch]    = useState("");
  const [roleFilter,setRoleFilter]= useState("All");
  const [activeSlot,setActiveSlot]= useState({team:"A",idx:0});
  const [showStats, setShowStats] = useState(false);

  const usedHeroes = new Set([
    ...picksA.filter(p=>p.hero).map(p=>p.hero.name),
    ...picksB.filter(p=>p.hero).map(p=>p.hero.name),
  ]);

  const filtered = HERO_DATA.filter(h=>
    (roleFilter==="All"||h.role===roleFilter) &&
    h.name.toLowerCase().includes(search.toLowerCase())
  );

  function pickHero(hero) {
    // ถ้ากำลัง ban อยู่ให้ ban ก่อน
    if (banMode) { banHero(hero); return; }
    if (usedHeroes.has(hero.name)) return;
    const { team, idx } = activeSlot;
    if (team==="A") { const p=[...picksA]; p[idx]={...p[idx],hero}; setPicksA(p); }
    else            { const p=[...picksB]; p[idx]={...p[idx],hero}; setPicksB(p); }
    if (team==="A") {
      const na=picksA.findIndex((s,i)=>i>idx&&!s.hero);
      if (na>=0) setActiveSlot({team:"A",idx:na});
      else { const nb=picksB.findIndex(s=>!s.hero); if(nb>=0) setActiveSlot({team:"B",idx:nb}); }
    } else {
      const nb2=picksB.findIndex((s,i)=>i>idx&&!s.hero);
      if (nb2>=0) setActiveSlot({team:"B",idx:nb2});
      else { const na2=picksA.findIndex(s=>!s.hero); if(na2>=0) setActiveSlot({team:"A",idx:na2}); }
    }
  }

  function clearPick(team, idx) {
    if (team==="A") { const p=[...picksA]; p[idx]={...p[idx],hero:null,player:""}; setPicksA(p); }
    else            { const p=[...picksB]; p[idx]={...p[idx],hero:null,player:""}; setPicksB(p); }
    setActiveSlot({team,idx});
  }

  function toggleTag(t) { setTags(prev=>prev.includes(t)?prev.filter(x=>x!==t):[...prev,t]); }

  // ── Ban hero (เลือก slot ว่างอัตโนมัติ) ──
  const [banMode, setBanMode] = useState(null); // null | "A" | "B"
  const [banSlot, setBanSlot] = useState(0);

  function banHero(hero) {
    if (!banMode) return;
    if (banMode==="A") {
      const b=[...bansA]; b[banSlot]=hero; setBansA(b);
      const next=bansA.findIndex((x,i)=>i>banSlot&&!x);
      if(next>=0) setBanSlot(next); else setBanMode(null);
    } else {
      const b=[...bansB]; b[banSlot]=hero; setBansB(b);
      const next=bansB.findIndex((x,i)=>i>banSlot&&!x);
      if(next>=0) setBanSlot(next); else setBanMode(null);
    }
  }

  function clearBan(team, idx) {
    if(team==="A"){ const b=[...bansA]; b[idx]=null; setBansA(b); }
    else          { const b=[...bansB]; b[idx]=null; setBansB(b); }
  }

  function setStatVal(side, idx, field, val) {
    const setter = side==="A" ? setStatsA : setStatsB;
    setter(prev=>({...prev,[idx]:{...(prev[idx]||{}),[field]:val===""?undefined:Number(val)}}));
  }

  function handleSave() {
    onSave({ gameNo, teamAResult:result==="A"?"WIN":"LOSE",
      sideA, sideB: sideA==="blue"?"red":"blue",
      picksA, picksB, bansA, bansB, statsA, statsB,
      killsA, killsB, duration, note, tags });
  }

  const rosterA = enemyRosters[teamA]||[];
  const rosterB = enemyRosters[teamB]||[];

  const renderPickColumn = (label, teamKey, picks, setpicks, roster, accentCol) => (
    <div style={{flex:1,background:"#0e0b1e",borderRadius:12,padding:"12px 10px"}}>
      <div style={{textAlign:"center",marginBottom:10}}>
        <span style={{fontWeight:900,fontSize:14,color:accentCol}}>{label}</span>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {picks.map((slot,idx)=>{
          const isActive = activeSlot.team===teamKey && activeSlot.idx===idx;
          return (
            <div key={idx} onClick={()=>setActiveSlot({team:teamKey,idx})}
              style={{display:"flex",alignItems:"center",gap:6,padding:"6px 8px",borderRadius:10,
                background:isActive?accentCol+"15":C.bgPanel,cursor:"pointer",
                border:`2px solid ${isActive?accentCol:C.border}`,
                boxShadow:isActive?`0 0 10px ${accentCol}40`:"none",
                transition:"all .15s",minHeight:52}}>
              {slot.hero ? (
                <>
                  <HeroCard hero={slot.hero} size={38} showName={false}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:800,lineHeight:1.2,overflow:"hidden",
                      textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{slot.hero.name}</div>
                    <div style={{fontSize:9,color:ROLE_COLOR[slot.hero.role]}}>{slot.role}</div>
                    {roster.length>0&&(
                      <select value={slot.player||""} onClick={e=>e.stopPropagation()}
                        onChange={e=>{const p=[...picks];p[idx]={...p[idx],player:e.target.value};setpicks(p);}}
                        style={{width:"100%",background:"#0a0816",border:`1px solid ${C.border}`,
                          color:slot.player?accentCol:C.textMuted,borderRadius:4,
                          padding:"1px 4px",fontSize:10,outline:"none",marginTop:2}}>
                        <option value="">— เลือกผู้เล่น —</option>
                        {roster.map(p=><option key={p} value={p}>{p}</option>)}
                      </select>
                    )}
                  </div>
                  <button onClick={e=>{e.stopPropagation();clearPick(teamKey,idx);}}
                    style={{background:"none",border:"none",color:"#ff4757",cursor:"pointer",fontSize:14,padding:"0 2px",lineHeight:1}}>✕</button>
                </>
              ) : (
                <div style={{display:"flex",alignItems:"center",gap:8,width:"100%"}}>
                  <div style={{width:38,height:38,borderRadius:8,flexShrink:0,
                    border:`2px dashed ${isActive?accentCol:C.border}`,
                    display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <span style={{fontSize:16,color:isActive?accentCol:"#2a2550"}}>{isActive?"✛":"+"}</span>
                  </div>
                  <div>
                    <div style={{fontSize:11,color:isActive?accentCol:"#3a3a5c",fontWeight:700}}>{slot.role}</div>
                    <div style={{fontSize:9,color:"#2a2550"}}>{isActive?"คลิก Hero":"รอเลือก"}</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderStatsTable = (teamKey, picks, stats, accentCol, teamName) => {
    const fields = ["kills","deaths","assists","damage","damageTaken","gold"];
    const headers = ["K","D","A","Dmg","DmgTkn","Gold"];
    const fieldWidth = { kills:36, deaths:36, assists:36, damage:70, damageTaken:70, gold:62 };
    if (!picks.some(s=>s.hero)) return null;
    return (
      <div style={{marginBottom:8}}>
        <div style={{fontSize:10,color:accentCol,fontWeight:800,marginBottom:5}}>
          {teamKey==="A"?`🔵 ${teamName}`:`🔴 ${teamName}`}
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:440}}>
            <thead>
              <tr style={{background:"#0f0c22"}}>
                <th style={{padding:"5px 8px",textAlign:"left",fontSize:9,color:C.textMuted,fontWeight:700}}>ผู้เล่น / Hero</th>
                {headers.map(h=>(
                  <th key={h} style={{padding:"5px 4px",textAlign:"center",fontSize:9,color:C.textMuted,fontWeight:700}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {picks.map((slot,idx)=>{
                if (!slot.hero) return null;
                return (
                  <tr key={idx} style={{borderTop:`1px solid ${C.border}`}}>
                    <td style={{padding:"4px 8px",minWidth:100}}>
                      <div style={{fontSize:10,fontWeight:700,color:accentCol}}>
                        {slot.player||<span style={{color:C.textMuted,fontWeight:400,fontStyle:"italic"}}>ไม่ระบุ</span>}
                      </div>
                      <div style={{fontSize:8,color:C.textMuted}}>{slot.hero.name}</div>
                    </td>
                    {fields.map(field=>{
                      const cur = stats[idx]?.[field];
                      return (
                        <td key={field} style={{padding:"3px 2px",textAlign:"center"}}>
                          <input type="number" min="0"
                            value={cur??""} placeholder="0"
                            onChange={e=>setStatVal(teamKey,idx,field,e.target.value)}
                            style={{width:fieldWidth[field],background:"#0a0816",border:`1px solid ${C.border}`,
                              color:C.textMain,borderRadius:4,padding:"3px 4px",
                              fontSize:11,textAlign:"center",outline:"none"}}/>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:14,padding:"16px 18px",marginBottom:12}}>
      <div style={{fontWeight:800,fontSize:14,color:C.primaryLight,marginBottom:12}}>
        🎮 Game {gameNo}
      </div>

      {/* ── Ban Order Section ── */}
      <div style={{marginBottom:14,background:C.bgCard,borderRadius:12,padding:"12px 14px"}}>
        <div style={{fontWeight:700,fontSize:12,color:C.textMuted,marginBottom:10}}>
          🚫 ลำดับแบน
          <span style={{fontSize:10,fontWeight:400,marginLeft:8,opacity:0.6}}>
            {banMode ? `กำลังแบนให้${banMode==="A"?teamA||"ทีม A":teamB||"ทีม B"} — คลิก Hero ด้านล่าง` : "กดปุ่มเพื่อเพิ่มแบน"}
          </span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {[{label:teamA||"ทีม A",col:C.blue,bans:bansA,setBans:setBansA,team:"A"},
            {label:teamB||"ทีม B",col:C.red, bans:bansB,setBans:setBansB,team:"B"}].map(({label,col,bans,team})=>(
            <div key={team}>
              <div style={{fontSize:11,color:col,fontWeight:700,marginBottom:6}}>{label}</div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                {bans.map((h,i)=>(
                  <div key={i}
                    onClick={()=>{ if(h){ clearBan(team,i); } else { setBanMode(team); setBanSlot(i); }}}
                    style={{width:40,height:40,borderRadius:8,border:`2px solid ${h?col:C.border}`,
                      background:h?col+"20":C.bgBase,cursor:"pointer",
                      display:"flex",alignItems:"center",justifyContent:"center",
                      position:"relative",overflow:"hidden",
                      outline:banMode===team&&banSlot===i?`3px solid ${col}`:"none"}}>
                    {h
                      ? <><HeroChip name={h.name} size={36} accentCol={col} fontSize={9}/>
                          <div style={{position:"absolute",top:0,left:0,background:"rgba(0,0,0,0.5)",
                            fontSize:9,fontWeight:900,color:"#fff",padding:"1px 3px",borderRadius:"0 0 4px 0"}}>
                            {i+1}
                          </div>
                        </>
                      : <span style={{fontSize:16,color:C.border}}>+</span>
                    }
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        {banMode&&(
          <div style={{marginTop:8,fontSize:11,color:C.textMuted,
            background:C.bgBase,borderRadius:7,padding:"5px 10px"}}>
            💡 คลิก Hero ในกริดด้านล่างเพื่อแบน · กด + อีกครั้งเพื่อยกเลิก
            <button onClick={()=>setBanMode(null)}
              style={{marginLeft:10,background:"transparent",border:"none",
                color:C.lose,cursor:"pointer",fontWeight:700,fontSize:11}}>
              ✕ ยกเลิก
            </button>
          </div>
        )}
      </div>

      {/* 3-col: teamA | hero grid | teamB */}
      <div style={{display:"flex",gap:10,marginBottom:14}}>
        {renderPickColumn(teamA||"ทีม A","A",picksA,setPicksA,rosterA,C.blue)}
        <div style={{flex:2,display:"flex",flexDirection:"column",gap:6}}>
          <div style={{display:"flex",gap:4,flexWrap:"wrap",alignItems:"center"}}>
            <input value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="🔍 Hero..."
              style={{...iStyle,width:120,padding:"4px 8px",fontSize:11}}/>
            {ROLES_FILTER.map(r=>(
              <button key={r} onClick={()=>setRoleFilter(r)} style={{
                background:roleFilter===r?(ROLE_COLOR[r]||C.primary):"#14112a",
                border:`1px solid ${roleFilter===r?(ROLE_COLOR[r]||C.primary):C.border}`,
                color:roleFilter===r?"#fff":C.textMuted,
                borderRadius:99,padding:"3px 9px",fontSize:10,cursor:"pointer",fontWeight:700}}>{r}</button>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(62px,1fr))",
            gap:4,maxHeight:420,overflowY:"auto"}}>
            {filtered.map(hero=>{
              const used=usedHeroes.has(hero.name);
              return (
                <div key={hero.name} onClick={()=>!used&&pickHero(hero)}
                  style={{opacity:used?0.2:1,cursor:used?"not-allowed":"pointer",transition:"transform .1s"}}
                  onMouseEnter={e=>{if(!used)e.currentTarget.style.transform="scale(1.1)";}}
                  onMouseLeave={e=>{e.currentTarget.style.transform="scale(1)";}}>
                  <HeroCard hero={hero} size={54}/>
                </div>
              );
            })}
          </div>
        </div>
        {renderPickColumn(teamB||"ทีม B","B",picksB,setPicksB,rosterB,C.red)}
      </div>

      {/* Result + side + kills + duration */}
      <div style={{display:"flex",gap:10,alignItems:"flex-end",marginBottom:10,flexWrap:"wrap"}}>
        <div>
          <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>ทีมที่ชนะ</div>
          <div style={{display:"flex",gap:6}}>
            {[{k:"A",label:teamA||"ทีม A",col:C.blue},{k:"B",label:teamB||"ทีม B",col:C.red}].map(opt=>(
              <button key={opt.k} onClick={()=>setResult(opt.k)}
                style={{background:result===opt.k?opt.col+"30":"transparent",
                  border:`2px solid ${result===opt.k?opt.col:C.border}`,
                  color:result===opt.k?opt.col:C.textMuted,
                  borderRadius:8,padding:"5px 12px",cursor:"pointer",fontWeight:700,fontSize:12}}>
                🏆 {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>ฝั่ง {teamA||"ทีม A"}</div>
          <div style={{display:"flex",gap:6}}>
            {[{k:"blue",label:"🔵 Blue",col:C.blue},{k:"red",label:"🔴 Red",col:C.red}].map(s=>(
              <button key={s.k} onClick={()=>setSideA(s.k)}
                style={{background:sideA===s.k?s.col+"30":"transparent",
                  border:`2px solid ${sideA===s.k?s.col:C.border}`,
                  color:sideA===s.k?s.col:C.textMuted,
                  borderRadius:8,padding:"5px 10px",cursor:"pointer",fontWeight:700,fontSize:11}}>
                {s.label}
              </button>
            ))}
          </div>
          <div style={{fontSize:9,color:C.textMuted,marginTop:3}}>
            {teamB||"ทีม B"} = {sideA==="blue"?"🔴 Red":"🔵 Blue"}
          </div>
        </div>
        <div>
          <div style={{fontSize:10,color:C.blue,marginBottom:4}}>Kill {teamA||"A"}</div>
          <input type="number" min="0" value={killsA} onChange={e=>setKillsA(e.target.value)}
            placeholder="0" style={{...iStyle,width:70,padding:"5px 8px",fontSize:12}}/>
        </div>
        <div>
          <div style={{fontSize:10,color:C.red,marginBottom:4}}>Kill {teamB||"B"}</div>
          <input type="number" min="0" value={killsB} onChange={e=>setKillsB(e.target.value)}
            placeholder="0" style={{...iStyle,width:70,padding:"5px 8px",fontSize:12}}/>
        </div>
        <div>
          <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>เวลา (นาที.วินาที)</div>
          <input type="text" inputMode="decimal" value={duration}
            onChange={e=>setDuration(e.target.value)}
            onBlur={e=>setDuration(normalizeDuration(e.target.value))}
            placeholder="09.45" style={{...iStyle,width:80,padding:"5px 8px",fontSize:12}}/>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>Coach Notes</div>
          <input value={note} onChange={e=>setNote(e.target.value)}
            placeholder="วิเคราะห์ draft / pattern..."
            style={{...iStyle,padding:"5px 10px",fontSize:12}}/>
        </div>
      </div>

      {/* Pattern Tags */}
      <div style={{marginBottom:10}}>
        <div style={{fontSize:10,color:C.textMuted,marginBottom:5,fontWeight:700}}>🏷️ Pattern Tags</div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
          {PATTERN_TAGS.map(t=>(
            <button key={t} onClick={()=>toggleTag(t)} style={{
              background:tags.includes(t)?C.primary+"40":"transparent",
              border:`1px solid ${tags.includes(t)?C.primary:C.border}`,
              color:tags.includes(t)?C.primaryLight:C.textMuted,
              borderRadius:99,padding:"3px 10px",fontSize:10,cursor:"pointer",fontWeight:700}}>{t}</button>
          ))}
        </div>
      </div>

      {/* Stats accordion */}
      <div style={{marginBottom:12}}>
        <button onClick={()=>setShowStats(v=>!v)} style={{
          background:showStats?C.primary+"20":"transparent",
          border:`1px solid ${showStats?C.primary:C.border}`,
          color:showStats?C.primaryLight:C.textMuted,
          borderRadius:7,padding:"4px 12px",cursor:"pointer",fontSize:11,fontWeight:700,marginBottom:showStats?10:0}}>
          {showStats?"▲ ซ่อน Stats":"📊 กรอก Stats ผู้เล่น (K/D/A/Dmg ฯลฯ)"}
        </button>
        {showStats&&(
          <div style={{background:"#080614",borderRadius:10,padding:"12px 14px",border:`1px solid ${C.border}`}}>
            {renderStatsTable("A",picksA,statsA,C.blue,teamA||"ทีม A")}
            {renderStatsTable("B",picksB,statsB,C.red, teamB||"ทีม B")}
          </div>
        )}
      </div>

      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <button onClick={onCancel}
          style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textMuted,
            borderRadius:8,padding:"6px 16px",cursor:"pointer",fontSize:12}}>ยกเลิก</button>
        <button onClick={handleSave}
          style={{background:`linear-gradient(135deg,${C.primary},${C.primaryLight})`,
            color:"#fff",border:"none",borderRadius:8,padding:"6px 20px",
            cursor:"pointer",fontWeight:800,fontSize:12}}>
          ✅ บันทึก Game {gameNo}
        </button>
      </div>
    </div>
  );
}
function ScoutSessionCreator({ rivals, enemyRosters, onSave, onCancel }) {
  const [teamA,      setTeamA]      = useState("");
  const [teamB,      setTeamB]      = useState("");
  const [mode,       setMode]       = useState("quick"); // "quick" | "bo"
  const [boType,     setBoType]     = useState("BO3");
  const [scoutCat,   setScoutCat]   = useState("scrim"); // "scrim" | "tournament"
  const [games,      setGames]      = useState([]);
  const [gameNo,     setGameNo]     = useState(1);
  const [stage,      setStage]      = useState("setup"); // "setup" | "recording" | "done"

  const bo = BO_OPTIONS.find(b=>b.label===boType)||BO_OPTIONS[2];

  function handleGameSave(gameData) {
    const newGames = [...games, gameData];
    setGames(newGames);
    if (mode==="quick" || newGames.length >= bo.total) {
      onSave({ teamA, teamB, mode, boType:mode==="bo"?boType:"Quick",
               category:scoutCat, games:newGames });
    } else {
      setGameNo(n=>n+1);
    }
  }

  if (stage==="setup") return (
    <div style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:16,padding:28,maxWidth:520}}>
      <div style={{textAlign:"center",marginBottom:22}}>
        <div style={{fontSize:32,marginBottom:6}}>🔍</div>
        <h3 style={{margin:0,fontSize:18,fontWeight:800}}>บันทึก Scout Match</h3>
        <p style={{margin:"4px 0 0",color:C.textMuted,fontSize:12}}>จดแมตช์ที่เราไปส่องมา</p>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
        {[{label:"🔵 ทีม A",val:teamA,set:setTeamA,col:C.blue},
          {label:"🔴 ทีม B",val:teamB,set:setTeamB,col:C.red}].map(({label,val,set,col})=>(
          <div key={label}>
            <div style={{fontSize:11,color:col,fontWeight:700,marginBottom:5}}>{label}</div>
            <select value={rivals.find(r=>r.name===val)?val:"__custom__"}
              onChange={e=>{if(e.target.value!=="__custom__")set(e.target.value);else set("");}}
              style={iStyle}>
              <option value="__custom__">— พิมพ์ชื่อใหม่ —</option>
              {rivals.map(r=><option key={r.id} value={r.name}>{r.name}</option>)}
            </select>
            {(!val||!rivals.find(r=>r.name===val))&&(
              <input value={val} onChange={e=>set(e.target.value)}
                placeholder="ชื่อทีม..." style={{...iStyle,marginTop:5}}/>
            )}
          </div>
        ))}
      </div>

      <div style={{marginBottom:18}}>
        <div style={{fontSize:11,color:C.textMuted,fontWeight:700,marginBottom:8}}>รูปแบบ</div>
        <div style={{display:"flex",gap:8}}>
          {[{id:"quick",label:"⚡ Quick (1 เกม)",sub:"จดเร็ว"},
            {id:"bo",   label:"📦 BO Series",   sub:"หลายเกม"}].map(opt=>(
            <button key={opt.id} onClick={()=>setMode(opt.id)}
              style={{flex:1,background:mode===opt.id?C.primary+"25":"transparent",
                border:`2px solid ${mode===opt.id?C.primary:C.border}`,
                color:mode===opt.id?C.primaryLight:C.textMuted,
                borderRadius:10,padding:"10px 8px",cursor:"pointer",textAlign:"center"}}>
              <div style={{fontWeight:800,fontSize:13}}>{opt.label}</div>
              <div style={{fontSize:10,color:C.textMuted,marginTop:2}}>{opt.sub}</div>
            </button>
          ))}
        </div>
        {mode==="bo"&&(
          <div style={{marginTop:10}}>
            <div style={{fontSize:10,color:C.textMuted,marginBottom:6}}>BO format</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(70px,1fr))",gap:5}}>
              {BO_OPTIONS.map(b=>(
                <button key={b.label} onClick={()=>setBoType(b.label)} style={{
                  background:boType===b.label?C.primary+"30":"transparent",
                  border:`2px solid ${boType===b.label?C.primary:C.border}`,
                  color:boType===b.label?C.primaryLight:C.textMuted,
                  borderRadius:8,padding:"7px 2px",cursor:"pointer",textAlign:"center",fontSize:12,fontWeight:900}}>
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── ประเภท Scout ── */}
      <div style={{marginBottom:16}}>
        <div style={{fontSize:11,color:C.textMuted,fontWeight:700,marginBottom:8}}>ประเภทแมตช์</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {[{id:"scrim",label:"🏋️ ซ้อม",desc:"Scrim / Practice"},
            {id:"tournament",label:"🏆 แข่ง",desc:"Tournament / Official"}].map(cat=>(
            <button key={cat.id} onClick={()=>setScoutCat(cat.id)}
              style={{background:scoutCat===cat.id?C.primary+"30":"transparent",
                border:`2px solid ${scoutCat===cat.id?C.primary:C.border}`,
                color:scoutCat===cat.id?C.primaryLight:C.textMuted,
                borderRadius:10,padding:"10px 8px",cursor:"pointer",textAlign:"center"}}>
              <div style={{fontWeight:900,fontSize:14}}>{cat.label}</div>
              <div style={{fontSize:10,marginTop:2,opacity:0.7}}>{cat.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{display:"flex",gap:8}}>
        <button onClick={onCancel}
          style={{flex:1,background:"transparent",border:`1px solid ${C.border}`,
            color:C.textMuted,borderRadius:9,padding:"10px",cursor:"pointer",fontWeight:700}}>
          ยกเลิก
        </button>
        <button onClick={()=>{
          if(!teamA.trim()||!teamB.trim()){alert("กรุณากรอกชื่อทั้งสองทีม");return;}
          if(teamA.trim()===teamB.trim()){alert("ทีม A และ B ต้องไม่เหมือนกัน");return;}
          setStage("recording");
        }} style={{flex:2,background:`linear-gradient(135deg,${C.primary},${C.primaryLight})`,
          color:"#fff",border:"none",borderRadius:9,padding:"10px",
          cursor:"pointer",fontWeight:800,fontSize:14}}>
          เริ่มบันทึก →
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
        <div style={{fontWeight:800,fontSize:15,color:C.primaryLight}}>
          🔍 Scout: <span style={{color:C.blue}}>{teamA}</span>
          <span style={{color:C.textMuted,margin:"0 6px"}}>vs</span>
          <span style={{color:C.red}}>{teamB}</span>
        </div>
        {mode==="bo"&&(
          <div style={{display:"flex",gap:5}}>
            {Array.from({length:bo.total},(_,i)=>(
              <div key={i} style={{width:22,height:22,borderRadius:"50%",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,
                background:i<games.length?"#6C5CE730":i===gameNo-1?C.primary+"30":"transparent",
                border:`2px solid ${i<games.length?C.primary:i===gameNo-1?C.primary:C.border}`,
                color:i<games.length?C.primaryLight:i===gameNo-1?C.primary:C.textMuted}}>
                {i<games.length?"✓":i+1}
              </div>
            ))}
          </div>
        )}
        {mode==="bo" && games.length>0 && (
          <button onClick={()=>{
            if(window.confirm(`จบ session นี้เลย? (บันทึกไว้แล้ว ${games.length} เกม ไม่ต้องครบ ${bo.total} เกมตามที่ตั้งไว้)`)) {
              onSave({ teamA, teamB, mode, boType, category:scoutCat, games });
            }
          }}
            style={{marginLeft:"auto",background:C.win+"20",border:`1px solid ${C.win}50`,
              color:C.win,borderRadius:7,padding:"4px 12px",cursor:"pointer",fontSize:12,fontWeight:700}}>
            ✅ จบ Session ({games.length} เกม)
          </button>
        )}
        <button onClick={()=>{if(window.confirm("ยกเลิกการบันทึก?"))onCancel();}}
          style={{background:"transparent",border:`1px solid ${C.lose}40`,
            color:C.lose,borderRadius:7,padding:"4px 12px",cursor:"pointer",fontSize:12}}>
          ✕ ยกเลิก
        </button>
      </div>
      <ScoutGameForm
        key={gameNo} gameNo={gameNo}
        teamA={teamA} teamB={teamB}
        rivals={rivals} enemyRosters={enemyRosters}
        onSave={handleGameSave}
        onCancel={onCancel}
      />
    </div>
  );
}

// ═══════════════════════════════════════════
//  SCOUT CARD — แสดงผลใน Scout Log
// ═══════════════════════════════════════════
// ═══════════════════════════════════════════
//  EDIT SCOUT GAME MODAL — แก้ไข hero/ban/ผู้เล่น/สกอร์/เวลา/K-D-A
//  ของเกมที่ scout ไว้แล้ว (คล้าย EditGameModal ของ Match Log แต่ปรับ
//  ให้เข้ากับรูปแบบข้อมูล teamA/teamB ของ Scout Log)
// ═══════════════════════════════════════════
function EditScoutGameModal({ game, teamA, teamB, onSave, onClose }) {
  const [picksA, setPicksA] = useState(() =>
    (game.picksA?.length ? game.picksA : ROLES_PICK.map(r=>({role:r,hero:null,player:""}))).map(p=>({...p})));
  const [picksB, setPicksB] = useState(() =>
    (game.picksB?.length ? game.picksB : ROLES_PICK.map(r=>({role:r,hero:null,player:""}))).map(p=>({...p})));
  const [bansA, setBansA] = useState(() =>
    (game.bansA?.length ? game.bansA : Array(BANS_PER_TEAM).fill(null)).slice());
  const [bansB, setBansB] = useState(() =>
    (game.bansB?.length ? game.bansB : Array(BANS_PER_TEAM).fill(null)).slice());
  const [statsA, setStatsA] = useState(game.statsA || {});
  const [statsB, setStatsB] = useState(game.statsB || {});
  const [teamAResult, setTeamAResult] = useState(game.teamAResult || "WIN");
  const [killsA, setKillsA] = useState(game.killsA ?? "");
  const [killsB, setKillsB] = useState(game.killsB ?? "");
  const [duration, setDuration] = useState(game.duration || "");
  const [sideA, setSideA] = useState(game.sideA || "blue");

  const setPickHero   = (side,i,name) => (side==="A"?setPicksA:setPicksB)(prev=>prev.map((p,idx)=>idx===i?{...p,hero:name?{name}:null}:p));
  const setPickPlayer = (side,i,val)  => (side==="A"?setPicksA:setPicksB)(prev=>prev.map((p,idx)=>idx===i?{...p,player:val}:p));
  const setBanHero    = (side,i,name) => (side==="A"?setBansA:setBansB)(prev=>prev.map((b,idx)=>idx===i?(name?{name}:null):b));

  function save() {
    onSave({
      picksA, picksB, bansA, bansB, statsA, statsB,
      teamAResult,
      killsA: Math.max(0, Number(killsA)||0),
      killsB: Math.max(0, Number(killsB)||0),
      duration: normalizeDuration(duration),
      sideA, sideB: sideA==="blue"?"red":"blue",
    });
  }

  const selectStyle = {background:C.bgCard,border:`1px solid ${C.border}`,color:C.textMain,
    borderRadius:6,padding:"5px 6px",fontSize:11,outline:"none"};

  const PickBanSide = ({ side, teamName, color, bans, picks }) => (
    <div>
      <div style={{fontWeight:700,fontSize:12,color,marginBottom:8}}>
        {side==="A"?"🔵":"🔴"} {teamName} — Ban
      </div>
      <div style={{display:"flex",gap:4,marginBottom:10,flexWrap:"wrap"}}>
        {bans.map((b,i)=>(
          <select key={i} value={b?.name||""} onChange={e=>setBanHero(side,i,e.target.value)} style={{...selectStyle,width:88}}>
            <option value="">— ban —</option>
            {HERO_DATA.map(h=><option key={h.name} value={h.name}>{h.name}</option>)}
          </select>
        ))}
      </div>
      <div style={{fontWeight:700,fontSize:12,color,marginBottom:8}}>Pick + ผู้เล่น</div>
      {picks.map((p,i)=>(
        <div key={i} style={{display:"flex",gap:6,marginBottom:6,alignItems:"center"}}>
          <span style={{fontSize:10,color:C.textMuted,width:48,flexShrink:0}}>{p.role}</span>
          <select value={p.hero?.name||""} onChange={e=>setPickHero(side,i,e.target.value)} style={{...selectStyle,flex:1}}>
            <option value="">— hero —</option>
            {HERO_DATA.map(h=><option key={h.name} value={h.name}>{h.name}</option>)}
          </select>
          <input value={p.player||""} onChange={e=>setPickPlayer(side,i,e.target.value)} placeholder="ผู้เล่น"
            style={{...selectStyle,width:86}}/>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:550,
      display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
      onClick={onClose}>
      <div onClick={e=>e.stopPropagation()}
        style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:16,padding:24,
          width:760,maxWidth:"100%",maxHeight:"85vh",overflowY:"auto"}}>
        <div style={{fontWeight:800,fontSize:16,marginBottom:16,color:C.primaryLight}}>
          ✏️ แก้ไขข้อมูล Scout — {teamA} vs {teamB}
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:16,marginBottom:16}}>
          <PickBanSide side="A" teamName={teamA} color={C.blue} bans={bansA} picks={picksA}/>
          <PickBanSide side="B" teamName={teamB} color={C.red}  bans={bansB} picks={picksB}/>
        </div>

        <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:16,alignItems:"flex-end"}}>
          <div>
            <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>ทีมไหนชนะ</div>
            <select value={teamAResult} onChange={e=>setTeamAResult(e.target.value)}
              style={{...selectStyle,fontWeight:700,padding:"7px 10px",fontSize:12,
                color:teamAResult==="WIN"?C.blue:C.red}}>
              <option value="WIN">{teamA} ชนะ</option>
              <option value="LOSE">{teamB} ชนะ</option>
            </select>
          </div>
          <div>
            <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>ฝั่งของ {teamA}</div>
            <select value={sideA} onChange={e=>setSideA(e.target.value)} style={{...selectStyle,padding:"7px 10px",fontSize:12}}>
              <option value="blue">🔵 Blue</option>
              <option value="red">🔴 Red</option>
            </select>
          </div>
          <div>
            <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>คิล {teamA}</div>
            <input type="number" min="0" value={killsA} onChange={e=>setKillsA(e.target.value)}
              style={{...selectStyle,width:70,padding:"7px 10px",fontSize:12}}/>
          </div>
          <div>
            <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>คิล {teamB}</div>
            <input type="number" min="0" value={killsB} onChange={e=>setKillsB(e.target.value)}
              style={{...selectStyle,width:70,padding:"7px 10px",fontSize:12}}/>
          </div>
          <div>
            <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>เวลา (นาที.วินาที)</div>
            <input type="text" inputMode="decimal" value={duration}
              onChange={e=>setDuration(e.target.value)}
              onBlur={e=>setDuration(normalizeDuration(e.target.value))}
              placeholder="09.45" style={{...selectStyle,width:90,padding:"7px 10px",fontSize:12}}/>
          </div>
        </div>

        <div style={{marginBottom:20}}>
          <div style={{fontWeight:700,fontSize:12,color:C.primaryLight,marginBottom:8}}>
            📊 Stats รายผู้เล่น (K/D/A/Dmg/Gold)
          </div>
          <UnifiedStatsEditor
            ourPicks={picksA} enemyPicks={picksB}
            gameStats={{ our: statsA, enemy: statsB }}
            onChangeStats={(next)=>{ setStatsA(next.our||{}); setStatsB(next.enemy||{}); }}
            ourScore={Number(killsA)||0} enemyScore={Number(killsB)||0}
          />
        </div>

        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={{background:"transparent",border:`1px solid ${C.border}`,
            color:C.textMuted,borderRadius:8,padding:"9px 18px",cursor:"pointer",fontWeight:700,fontSize:13}}>
            ยกเลิก
          </button>
          <button onClick={save} style={{background:C.primary,color:"#fff",border:"none",borderRadius:8,
            padding:"9px 22px",cursor:"pointer",fontWeight:700,fontSize:13}}>
            💾 บันทึก
          </button>
        </div>
      </div>
    </div>
  );
}

function ScoutCard({ sm, onDelete, onUpdateGame }) {
  const [open, setOpen] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [editingGameIdx, setEditingGameIdx] = useState(null);
  const gamesArr = sm.games||[];
  const aWins = gamesArr.filter(g=>g.teamAResult==="WIN").length;
  const bWins = gamesArr.length - aWins;

  // รวม kills ทั้ง session
  const totKillsA = gamesArr.reduce((s,g)=>s+Number(g.killsA||0),0);
  const totKillsB = gamesArr.reduce((s,g)=>s+Number(g.killsB||0),0);

  return (
    <div style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:14,
      marginBottom:10,overflow:"hidden",borderLeft:`4px solid ${C.primary}`}}>
      <div onClick={()=>setOpen(v=>!v)}
        style={{padding:"12px 18px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <span style={{fontSize:18}}>🔍</span>
        <div>
          <span style={{fontWeight:800,color:C.blue,fontSize:14}}>{sm.teamA}</span>
          <span style={{color:C.textMuted,margin:"0 8px",fontWeight:700}}>vs</span>
          <span style={{fontWeight:800,color:C.red,fontSize:14}}>{sm.teamB}</span>
        </div>
        <span style={{fontSize:11,color:C.textMuted}}>{sm.date}</span>
        <span style={{fontSize:11,padding:"2px 9px",borderRadius:99,fontWeight:700,
          background:C.primary+"20",color:C.primaryLight}}>{sm.boType}</span>
        {sm.category==="tournament"
          ? <span style={{background:"#f9ca24"+"30",border:"1px solid #f9ca24"+"60",color:"#f9ca24",
              borderRadius:99,padding:"2px 9px",fontSize:10,fontWeight:800}}>🏆 แข่ง</span>
          : <span style={{background:C.border+"40",color:C.textMuted,
              borderRadius:99,padding:"2px 9px",fontSize:10,fontWeight:700}}>🏋️ ซ้อม</span>
        }
        <div style={{marginLeft:"auto",display:"flex",gap:12,alignItems:"center"}}>
          {/* win score */}
          <div style={{display:"flex",gap:4,alignItems:"center"}}>
            <span style={{fontSize:13,color:C.blue,fontWeight:800}}>{aWins}W</span>
            <span style={{fontSize:11,color:C.textMuted}}>—</span>
            <span style={{fontSize:13,color:C.red,fontWeight:800}}>{bWins}W</span>
          </div>
          {/* kill score */}
          {(totKillsA>0||totKillsB>0)&&(
            <div style={{display:"flex",gap:4,alignItems:"center",
              background:C.bgCard,borderRadius:7,padding:"2px 8px",fontSize:11}}>
              <span style={{color:C.blue,fontWeight:700}}>{totKillsA}</span>
              <span style={{color:C.textMuted}}>:</span>
              <span style={{color:C.red,fontWeight:700}}>{totKillsB}</span>
              <span style={{color:C.textMuted,fontSize:9}}>kills</span>
            </div>
          )}
          <span style={{color:C.textMuted,fontSize:13}}>{open?"▲":"▼"}</span>
        </div>
      </div>

      {open&&(
        <div style={{padding:"0 16px 16px"}}>
          {gamesArr.map((g,gi)=>{
            const winner = g.teamAResult==="WIN" ? sm.teamA : sm.teamB;
            const hasStatsA = g.statsA && Object.values(g.statsA).some(s=>s?.kills!==undefined);
            const hasStatsB = g.statsB && Object.values(g.statsB).some(s=>s?.kills!==undefined);
            const hasAnyStats = hasStatsA || hasStatsB;

            return (
              <div key={gi} style={{background:C.bgCard,borderRadius:10,padding:"12px 14px",
                marginBottom:8,border:`1px solid ${C.border}`}}>
                {/* game header */}
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,flexWrap:"wrap"}}>
                  <span style={{fontWeight:800,fontSize:12,color:C.primaryLight}}>Game {gi+1}</span>
                  <span style={{padding:"2px 10px",borderRadius:99,fontSize:11,fontWeight:800,
                    background:C.win+"20",color:C.win}}>🏆 {winner}</span>
                  <button onClick={()=>setEditingGameIdx(gi)}
                    style={{marginLeft:"auto",background:"transparent",border:`1px solid ${C.border}`,
                      color:C.textMuted,borderRadius:6,padding:"2px 9px",cursor:"pointer",fontSize:10,fontWeight:700}}>
                    ✏️ แก้ไข
                  </button>
                  {g.sideA&&(
                    <span style={{fontSize:10,color:C.textMuted}}>
                      <span style={{color:g.sideA==="blue"?C.blue:C.red,fontWeight:700}}>
                        {g.sideA==="blue"?"🔵":"🔴"} {sm.teamA}
                      </span>
                      {" vs "}
                      <span style={{color:g.sideA==="blue"?C.red:C.blue,fontWeight:700}}>
                        {g.sideA==="blue"?"🔴":"🔵"} {sm.teamB}
                      </span>
                    </span>
                  )}
                  {(g.killsA||g.killsB)&&(
                    <span style={{fontSize:11,color:C.textMuted}}>
                      <span style={{color:C.blue,fontWeight:700}}>{g.killsA||0}</span>
                      <span style={{margin:"0 4px"}}>:</span>
                      <span style={{color:C.red,fontWeight:700}}>{g.killsB||0}</span>
                      <span style={{fontSize:9}}> kills</span>
                    </span>
                  )}
                  {g.duration&&<span style={{fontSize:11,color:C.textMuted}}>⏱ {formatDurationDisplay(g.duration)}</span>}
                  {g.tags&&g.tags.length>0&&(
                    <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                      {g.tags.map(t=>(
                        <span key={t} style={{background:C.primary+"20",color:C.primaryLight,
                          fontSize:9,padding:"1px 7px",borderRadius:99,fontWeight:700}}>{t}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── Ban Order Display ── */}
                {(g.bansA?.some(Boolean)||g.bansB?.some(Boolean))&&(
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                    {[{label:sm.teamA,bans:g.bansA||[],col:C.blue,sideLabel:g.sideA==="blue"?"🔵":"🔴"},
                      {label:sm.teamB,bans:g.bansB||[],col:C.red, sideLabel:g.sideA==="blue"?"🔴":"🔵"}].map(({label,bans,col,sideLabel})=>(
                      <div key={label}>
                        <div style={{fontSize:10,color:col,fontWeight:700,marginBottom:5}}>
                          {sideLabel} {label} แบน:
                        </div>
                        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                          {bans.map((h,i)=>h&&(
                            <div key={i} style={{position:"relative"}}>
                              <HeroChip name={h.name} size={32} accentCol={col} fontSize={9}/>
                              <div style={{position:"absolute",top:-3,left:-3,
                                background:col,color:"#fff",fontSize:8,fontWeight:900,
                                width:14,height:14,borderRadius:"50%",
                                display:"flex",alignItems:"center",justifyContent:"center",
                                lineHeight:1}}>
                                {i+1}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* picks + inline stats */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:g.note?8:0}}>
                  {[
                    {label:`🔵 ${sm.teamA}`,picks:g.picksA,stats:g.statsA||{},col:C.blue},
                    {label:`🔴 ${sm.teamB}`,picks:g.picksB,stats:g.statsB||{},col:C.red},
                  ].map(({label,picks,stats,col})=>(
                    <div key={label} style={{background:"#0e0b1e",borderRadius:8,padding:"8px 10px"}}>
                      <div style={{fontSize:10,color:col,fontWeight:700,marginBottom:6}}>{label}</div>
                      {(picks||[]).filter(s=>s.hero).map((s,i)=>{
                        const ps = stats[i]||{};
                        const hasPs = ps.kills!==undefined;
                        const kda = hasPs
                          ? ((Number(ps.kills||0)+Number(ps.assists||0))/Math.max(Number(ps.deaths||1),1)).toFixed(1)
                          : null;
                        return (
                          <div key={i} style={{marginBottom:5}}>
                            <div style={{display:"flex",gap:6,alignItems:"center"}}>
                              <span style={{fontSize:9,color:ROLE_COLOR[s.role]||col,width:44}}>{s.role}</span>
                              <span style={{fontSize:11,fontWeight:700,flex:1}}>{s.hero?.name||"—"}</span>
                              {s.player&&<span style={{fontSize:9,color:C.textMuted}}>{s.player}</span>}
                              {kda&&<span style={{fontSize:9,color:"#fdcb6e",fontWeight:700}}>KDA {kda}</span>}
                            </div>
                            {hasPs&&(
                              <div style={{display:"flex",gap:6,marginLeft:50,marginTop:1}}>
                                <span style={{fontSize:9,color:"#00cec9"}}>{ps.kills??"-"}K</span>
                                <span style={{fontSize:9,color:C.lose}}>{ps.deaths??"-"}D</span>
                                <span style={{fontSize:9,color:"#a29bfe"}}>{ps.assists??"-"}A</span>
                                {ps.damage&&<span style={{fontSize:9,color:"#e17055"}}>{Number(ps.damage).toLocaleString()} dmg</span>}
                                {ps.damageTaken&&<span style={{fontSize:9,color:"#fd79a8"}}>{Number(ps.damageTaken).toLocaleString()} tkn</span>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>

                {g.note&&(
                  <div style={{background:C.primary+"12",borderRadius:7,padding:"6px 10px",
                    fontSize:11,color:C.primaryLight,marginTop:6}}>
                    📝 {g.note}
                  </div>
                )}
                {editingGameIdx===gi && (
                  <EditScoutGameModal
                    game={g} teamA={sm.teamA} teamB={sm.teamB}
                    onSave={updates => { onUpdateGame && onUpdateGame(gi, updates); setEditingGameIdx(null); }}
                    onClose={()=>setEditingGameIdx(null)}
                  />
                )}
              </div>
            );
          })}
          <div style={{display:"flex",gap:8,marginTop:4}}>
            <button onClick={()=>setShowSummary(true)}
              style={{background:"transparent",border:`1px solid ${C.border}`,color:"#feca57",
                borderRadius:7,padding:"5px 14px",cursor:"pointer",fontSize:11,fontWeight:700}}>
              📸 สรุปภาพรวม Draft
            </button>
            <button onClick={()=>{if(window.confirm("ลบ Scout record นี้?"))onDelete(sm.id);}}
              style={{background:C.lose+"15",border:`1px solid ${C.lose}30`,color:C.lose,
                borderRadius:7,padding:"5px 14px",cursor:"pointer",fontSize:11,fontWeight:700}}>
              🗑️ ลบ
            </button>
          </div>
          {showSummary && (
            <MatchDraftSummaryModal
              games={gamesArr}
              toBlueRed={g => scoutGameToBlueRed(g, sm.teamA, null, sm.teamB, null)}
              teamAName={sm.teamA}
              teamBName={sm.teamB}
              onClose={()=>setShowSummary(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
//  SCOUT LOG PAGE — แสดงใน Rivals detail
// ═══════════════════════════════════════════
// ── helper: คำนวณ stats ต่อ matchup ──
function calcMatchupStats(records, teamFocus) {
  let wins=0, games=0, kFor=0, kAgainst=0;
  let totK=0,totD=0,totA=0,totDmg=0,totDtk=0,totGold=0,statCnt=0;
  let totDur=0, durCnt=0;
  // แยกตาม side (blue/red)
  const sideStats = { blue:{dmg:0,dtk:0,gold:0,cnt:0,wins:0,games:0}, red:{dmg:0,dtk:0,gold:0,cnt:0,wins:0,games:0} };
  const heroFreq={}, patternCount={}, banFreq={};
  const heroStats={};   // heroName -> {picks,wins,losses,k,d,a,statCnt}
  const playerStats={}; // playerName -> {games,wins,losses,k,d,a,statCnt,heroes:{}}

  records.forEach(sm=>{
    const isA = sm.teamA===teamFocus;
    (sm.games||[]).forEach(g=>{
      games++;
      const won = isA ? g.teamAResult==="WIN" : g.teamAResult==="LOSE";
      if (won) wins++;
      kFor     += Number(isA?g.killsA:g.killsB||0);
      kAgainst += Number(isA?g.killsB:g.killsA||0);
      if (g.duration) { totDur += durationToMinutes(g.duration); durCnt++; }

      // side ของ teamFocus
      const mySide = isA ? (g.sideA||"blue") : (g.sideA==="blue"?"red":"blue");
      sideStats[mySide].games++;
      if(won) sideStats[mySide].wins++;

      // stats per player (raw, index-based — เก็บไว้ใช้จับคู่กับ picks ด้านล่าง)
      const statsObj = isA?(g.statsA||{}):(g.statsB||{});
      Object.values(statsObj).forEach(ps=>{ if(ps?.kills!==undefined){
        const k=Number(ps.kills||0),d=Number(ps.deaths||0),a=Number(ps.assists||0);
        const dmg=Number(ps.damage||0),dtk=Number(ps.damageTaken||0),gold=Number(ps.gold||0);
        totK+=k;totD+=d;totA+=a;totDmg+=dmg;totDtk+=dtk;totGold+=gold;statCnt++;
        sideStats[mySide].dmg+=dmg;sideStats[mySide].dtk+=dtk;
        sideStats[mySide].gold+=gold;sideStats[mySide].cnt++;
      }});

      // hero freq + ban freq + hero-level & player-level breakdown
      const picks = isA?g.picksA:g.picksB;
      const bans  = isA?(g.bansA||[]):(g.bansB||[]);
      (picks||[]).forEach((slot,idx)=>{
        if (!slot?.hero?.name) return;
        const heroName = slot.hero.name;
        const playerName = (slot.player||"").trim();
        heroFreq[heroName] = (heroFreq[heroName]||0)+1;

        if (!heroStats[heroName]) heroStats[heroName] = {picks:0,wins:0,losses:0,k:0,d:0,a:0,statCnt:0};
        const hs = heroStats[heroName];
        hs.picks++; if (won) hs.wins++; else hs.losses++;

        const ps = statsObj[idx];
        if (ps?.kills!==undefined) {
          hs.k += Number(ps.kills||0); hs.d += Number(ps.deaths||0); hs.a += Number(ps.assists||0); hs.statCnt++;
        }

        if (playerName) {
          if (!playerStats[playerName]) playerStats[playerName] = {games:0,wins:0,losses:0,k:0,d:0,a:0,statCnt:0,heroes:{}};
          const pst = playerStats[playerName];
          pst.games++; if (won) pst.wins++; else pst.losses++;
          pst.heroes[heroName] = (pst.heroes[heroName]||0)+1;
          if (ps?.kills!==undefined) {
            pst.k += Number(ps.kills||0); pst.d += Number(ps.deaths||0); pst.a += Number(ps.assists||0); pst.statCnt++;
          }
        }
      });
      bans.forEach(h=>{ if(h?.name) banFreq[h.name]=(banFreq[h.name]||0)+1; });
      (g.tags||[]).forEach(t=>{ patternCount[t]=(patternCount[t]||0)+1; });
    });
  });

  // side win rate
  const blueGames=sideStats.blue.games, blueWins=sideStats.blue.wins;
  const redGames=sideStats.red.games,   redWins=sideStats.red.wins;

  return {
    wins, games, losses:games-wins,
    wr: games?Math.round(wins/games*100):0,
    kFor, kAgainst,
    avgKDA:  statCnt?((totK+totA)/Math.max(totD,1)/statCnt).toFixed(2):"-",
    avgK:    statCnt?(totK/statCnt).toFixed(1):"-",
    avgD:    statCnt?(totD/statCnt).toFixed(1):"-",
    avgA:    statCnt?(totA/statCnt).toFixed(1):"-",
    avgDmg:  statCnt?Math.round(totDmg/statCnt):null,
    avgDtk:  statCnt?Math.round(totDtk/statCnt):null,
    avgGold: statCnt?Math.round(totGold/statCnt):null,
    statCnt,
    avgDuration: durCnt ? minutesToDurationStr(totDur/durCnt) : null,
    durCnt,
    // side breakdown
    blue: { games:blueGames, wins:blueWins, wr:blueGames?Math.round(blueWins/blueGames*100):null,
      avgDmg:sideStats.blue.cnt?Math.round(sideStats.blue.dmg/sideStats.blue.cnt):null,
      avgDtk:sideStats.blue.cnt?Math.round(sideStats.blue.dtk/sideStats.blue.cnt):null,
      avgGold:sideStats.blue.cnt?Math.round(sideStats.blue.gold/sideStats.blue.cnt):null },
    red:  { games:redGames,  wins:redWins,  wr:redGames ?Math.round(redWins/redGames*100):null,
      avgDmg:sideStats.red.cnt?Math.round(sideStats.red.dmg/sideStats.red.cnt):null,
      avgDtk:sideStats.red.cnt?Math.round(sideStats.red.dtk/sideStats.red.cnt):null,
      avgGold:sideStats.red.cnt?Math.round(sideStats.red.gold/sideStats.red.cnt):null },
    topHeroes:   Object.entries(heroFreq).sort((a,b)=>b[1]-a[1]).slice(0,8),
    topBans:     Object.entries(banFreq).sort((a,b)=>b[1]-a[1]).slice(0,8),
    topPatterns: Object.entries(patternCount).sort((a,b)=>b[1]-a[1]).slice(0,6),
    // ── Hero Pool แบบเต็ม พร้อม win rate / W-L / KDA ──
    heroPool: Object.entries(heroStats).map(([hero,s])=>({
      hero, picks:s.picks, wins:s.wins, losses:s.losses,
      wr: s.picks ? Math.round(s.wins/s.picks*100) : 0,
      avgK: s.statCnt ? (s.k/s.statCnt).toFixed(1) : null,
      avgD: s.statCnt ? (s.d/s.statCnt).toFixed(1) : null,
      avgA: s.statCnt ? (s.a/s.statCnt).toFixed(1) : null,
      hasStats: s.statCnt>0,
    })).sort((a,b)=>b.picks-a.picks),
    // ── สถิติส่วนตัวของแต่ละผู้เล่นที่ scout ไว้ ──
    playerPool: Object.entries(playerStats).map(([player,s])=>({
      player, games:s.games, wins:s.wins, losses:s.losses,
      wr: s.games ? Math.round(s.wins/s.games*100) : 0,
      avgK: s.statCnt ? (s.k/s.statCnt).toFixed(1) : null,
      avgD: s.statCnt ? (s.d/s.statCnt).toFixed(1) : null,
      avgA: s.statCnt ? (s.a/s.statCnt).toFixed(1) : null,
      hasStats: s.statCnt>0,
      topHeroes: Object.entries(s.heroes).sort((a,b)=>b[1]-a[1]).map(([h])=>h),
    })).sort((a,b)=>b.games-a.games),
  };
}

// ── Matchup Detail: A vs B ──
function MatchupDetail({ rivalName, opponent, records, rivals, enemyRosters, onSaveScout, onDeleteScout, onUpdateScoutGame, onBack }) {
  const [creating, setCreating] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const st = calcMatchupStats(records, rivalName);
  const SC = { card:{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 16px"} };

  // flatten scout games into rivalName's perspective for pick/ban-order analysis
  const rivalGames = records.flatMap(sm => {
    const isA = sm.teamA === rivalName;
    return (sm.games||[]).map(g => ({
      bans:  isA ? (g.bansA||[])  : (g.bansB||[]),
      picks: isA ? (g.picksA||[]) : (g.picksB||[]),
      won:   isA ? g.teamAResult==="WIN" : g.teamAResult==="LOSE",
    }));
  });

  if (creating) return (
    <ScoutSessionCreator rivals={rivals} enemyRosters={enemyRosters}
      onSave={data=>{onSaveScout(data);setCreating(false);}}
      onCancel={()=>setCreating(false)}/>
  );

  return (
    <div>
      {/* breadcrumb header */}
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        <button onClick={onBack}
          style={{background:"transparent",border:"none",color:C.textMuted,
            cursor:"pointer",fontSize:13,padding:0,display:"flex",alignItems:"center",gap:4}}>
          ← Scout Log
        </button>
        <span style={{color:C.border}}>›</span>
        <span style={{fontWeight:800,fontSize:15,color:C.blue}}>{rivalName}</span>
        <span style={{color:C.textMuted,fontWeight:700}}>vs</span>
        <span style={{fontWeight:800,fontSize:15,color:C.red}}>{opponent}</span>
        <div style={{display:"flex",gap:3,background:C.bgBase,borderRadius:8,padding:3,
          border:`1px solid ${C.border}`,marginLeft:"auto"}}>
          {[{id:"overview",label:"📊 Overview"},{id:"log",label:"📋 Records"}].map(t=>(
            <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{
              background:activeTab===t.id?C.primary:"transparent",
              border:"none",color:activeTab===t.id?"#fff":C.textMuted,
              borderRadius:6,padding:"5px 12px",cursor:"pointer",fontWeight:700,fontSize:12}}>
              {t.label}
            </button>
          ))}
        </div>
        <button onClick={()=>setCreating(true)}
          style={{background:`linear-gradient(135deg,${C.primary},${C.primaryLight})`,
            color:"#fff",border:"none",borderRadius:9,padding:"6px 14px",
            cursor:"pointer",fontWeight:800,fontSize:12}}>
          + บันทึก Scout ใหม่
        </button>
      </div>

      {records.length===0 ? (
        <div style={{textAlign:"center",padding:"40px 20px",background:C.bgPanel,
          borderRadius:14,color:C.textMuted}}>
          <div style={{fontSize:32,marginBottom:8}}>🔍</div>
          ยังไม่มีข้อมูล {rivalName} vs {opponent}
        </div>
      ) : activeTab==="log" ? (
        records.map(sm=>(
          <ScoutCard key={sm.id} sm={sm} onDelete={id=>onDeleteScout(id)}
            onUpdateGame={(gameIdx,updates)=>onUpdateScoutGame && onUpdateScoutGame(sm.id,gameIdx,updates)}/>
        ))
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {/* summary cards */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(90px,1fr))",gap:10}}>
            {[
              {label:"🎮 เกม",        val:st.games,                              col:C.primaryLight},
              {label:"🏆 Win Rate",   val:st.games?`${st.wr}%`:"-",             col:st.wr>=50?C.win:C.lose},
              {label:"✅ W / ❌ L",   val:`${st.wins} / ${st.losses}`,          col:st.wins>=st.losses?C.win:C.lose},
              {label:"⚔️ Kill For",  val:st.kFor,                               col:C.win},
              {label:"💀 Kill Against",val:st.kAgainst,                         col:C.lose},
            ].map(c=>(
              <div key={c.label} style={{...SC.card,textAlign:"center",padding:"12px 8px"}}>
                <div style={{fontSize:9,color:C.textMuted,marginBottom:4}}>{c.label}</div>
                <div style={{fontSize:st.games>0&&c.label==="✅ W / ❌ L"?16:22,fontWeight:800,color:c.col}}>{c.val}</div>
              </div>
            ))}
          </div>

          {/* KDA */}
          {st.statCnt>0&&(
            <div style={SC.card}>
              <div style={{fontWeight:700,fontSize:12,color:C.primaryLight,marginBottom:10}}>
                📈 KDA เฉลี่ยต่อผู้เล่น ({rivalName})
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(80px,1fr))",gap:8}}>
                {[
                  {label:"Avg K",      val:st.avgK,                              col:"#00cec9"},
                  {label:"Avg D",      val:st.avgD,                              col:C.lose},
                  {label:"Avg A",      val:st.avgA,                              col:"#a29bfe"},
                  {label:"KDA",        val:st.avgKDA,                            col:"#fdcb6e"},
                  {label:"Avg Dmg",    val:st.avgDmg?st.avgDmg.toLocaleString():"-", col:"#e17055"},
                  {label:"Avg DmgTkn", val:st.avgDtk?st.avgDtk.toLocaleString():"-", col:"#fd79a8"},
                  {label:"⏱️ เวลาเฉลี่ย/เกม", val:st.avgDuration?st.avgDuration.replace(".",":"):"-", col:"#1dd1a1"},
                ].map(c=>(
                  <div key={c.label} style={{background:C.bgCard,borderRadius:8,padding:"8px 6px",textAlign:"center"}}>
                    <div style={{fontSize:9,color:C.textMuted,marginBottom:3}}>{c.label}</div>
                    <div style={{fontSize:15,fontWeight:800,color:c.col}}>{c.val}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Side Win Rate + Gold/Dmg/DmgTkn Comparison ── */}
          {(st.blue.games>0||st.red.games>0)&&(
            <div style={SC.card}>
              <div style={{fontWeight:700,fontSize:12,color:C.primaryLight,marginBottom:12}}>
                🔵🔴 สถิติแยกฝั่ง ({rivalName})
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
                {[{id:"blue",label:"🔵 Blue Side",col:C.blue},{id:"red",label:"🔴 Red Side",col:C.red}].map(s=>{
                  const sd=st[s.id];
                  return (
                    <div key={s.id} style={{background:C.bgCard,borderRadius:10,padding:"12px 14px"}}>
                      <div style={{fontWeight:800,fontSize:13,color:s.col,marginBottom:8}}>{s.label}</div>
                      {sd.games===0
                        ? <div style={{color:C.textMuted,fontSize:11}}>ไม่มีข้อมูล</div>
                        : <>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                            <span style={{fontSize:11,color:C.textMuted}}>Win Rate</span>
                            <span style={{fontWeight:800,fontSize:13,color:sd.wr>=50?C.win:C.lose}}>
                              {sd.wr}% ({sd.wins}/{sd.games})
                            </span>
                          </div>
                          {sd.avgDmg&&<div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                            <span style={{fontSize:11,color:C.textMuted}}>Avg Dmg</span>
                            <span style={{fontWeight:700,fontSize:12,color:"#e17055"}}>{sd.avgDmg?.toLocaleString()}</span>
                          </div>}
                          {sd.avgDtk&&<div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                            <span style={{fontSize:11,color:C.textMuted}}>Avg DmgTkn</span>
                            <span style={{fontWeight:700,fontSize:12,color:C.lose}}>{sd.avgDtk?.toLocaleString()}</span>
                          </div>}
                          {sd.avgGold&&<div style={{display:"flex",justifyContent:"space-between"}}>
                            <span style={{fontSize:11,color:C.textMuted}}>Avg Gold</span>
                            <span style={{fontWeight:700,fontSize:12,color:"#f9ca24"}}>{sd.avgGold?.toLocaleString()}</span>
                          </div>}
                        </>
                      }
                    </div>
                  );
                })}
              </div>
              {/* โดยรวม Gold/Dmg/DmgTkn */}
              {st.statCnt>0&&(
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:8}}>
                  {[{label:"Avg Gold",val:st.avgGold,col:"#f9ca24"},
                    {label:"Avg Dmg",val:st.avgDmg,col:"#e17055"},
                    {label:"Avg DmgTkn",val:st.avgDtk,col:C.lose}].map(c=>(
                    <div key={c.label} style={{background:C.bgCard,borderRadius:8,padding:"8px",textAlign:"center"}}>
                      <div style={{fontSize:9,color:C.textMuted,marginBottom:2}}>{c.label}</div>
                      <div style={{fontSize:14,fontWeight:800,color:c.col}}>
                        {c.val?c.val.toLocaleString():"-"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Top Bans ── */}
          {st.topBans.length>0&&(
            <div style={SC.card}>
              <div style={{fontWeight:700,fontSize:12,color:"#e17055",marginBottom:10}}>
                🚫 Hero ที่แบนบ่อย ({rivalName})
              </div>
              {st.topBans.map(([h,cnt],i)=>(
                <div key={h} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                  padding:"5px 8px",background:i%2===0?"transparent":C.bgCard,borderRadius:6,marginBottom:2}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:10,color:C.textMuted,width:16}}>#{i+1}</span>
                    <HeroChip name={h} size={26} accentCol={"#e17055"} fontSize={12}/>
                  </div>
                  <span style={{background:"#e17055"+"20",color:"#e17055",fontSize:10,
                    padding:"1px 8px",borderRadius:99,fontWeight:700}}>×{cnt}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── Pick/Ban ตามลำดับ ── */}
          <PickBanOrderPanel
            games={rivalGames}
            getBans={g=>g.bans}
            getPicks={g=>g.picks}
            getWon={g=>g.won}
            title={`🎯 Pick / Ban ตามลำดับ ของ ${rivalName}`}
          />

          {/* Hero Pool แบบเต็ม พร้อม win rate / W-L / KDA */}
          {st.heroPool.length>0 && (
            <div style={{...SC.card, marginBottom:12}}>
              <div style={{fontWeight:700,fontSize:12,color:C.lose,marginBottom:10}}>
                🦸 Hero Pool ของ {rivalName} ({st.heroPool.length} ตัว)
              </div>
              <div style={{overflowX:"auto"}} className="h-scroll">
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:420}}>
                  <thead>
                    <tr style={{color:C.textMuted,fontSize:10,textAlign:"left"}}>
                      <th style={{padding:"4px 8px",fontWeight:600}}>Hero</th>
                      <th style={{padding:"4px 8px",fontWeight:600,textAlign:"center"}}>เกม</th>
                      <th style={{padding:"4px 8px",fontWeight:600,textAlign:"center"}}>W-L</th>
                      <th style={{padding:"4px 8px",fontWeight:600,textAlign:"center"}}>Win%</th>
                      <th style={{padding:"4px 8px",fontWeight:600,textAlign:"center"}}>K/D/A</th>
                    </tr>
                  </thead>
                  <tbody>
                    {st.heroPool.map((h,i)=>(
                      <tr key={h.hero} style={{background:i%2===0?"transparent":C.bgCard}}>
                        <td style={{padding:"6px 8px"}}><HeroChip name={h.hero} size={24} accentCol={C.lose} fontSize={12}/></td>
                        <td style={{padding:"6px 8px",textAlign:"center",color:C.textMuted}}>{h.picks}</td>
                        <td style={{padding:"6px 8px",textAlign:"center"}}>
                          <span style={{color:C.win,fontWeight:700}}>{h.wins}</span>
                          <span style={{color:C.textMuted}}> - </span>
                          <span style={{color:C.lose,fontWeight:700}}>{h.losses}</span>
                        </td>
                        <td style={{padding:"6px 8px",textAlign:"center"}}>
                          <span style={{fontWeight:700,padding:"1px 8px",borderRadius:5,
                            background:h.wr>=50?C.lose+"20":C.win+"20",color:h.wr>=50?C.lose:C.win}}>
                            {h.wr}%
                          </span>
                        </td>
                        <td style={{padding:"6px 8px",textAlign:"center",color:C.textMuted}}>
                          {h.hasStats ? `${h.avgK}/${h.avgD}/${h.avgA}` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* สถิติส่วนตัวของผู้เล่นแต่ละคนที่ scout ไว้ */}
          {st.playerPool.length>0 && (
            <div style={{...SC.card, marginBottom:12}}>
              <div style={{fontWeight:700,fontSize:12,color:C.lose,marginBottom:10}}>
                👤 สถิติผู้เล่นของ {rivalName} ({st.playerPool.length} คน)
              </div>
              <div style={{overflowX:"auto"}} className="h-scroll">
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:480}}>
                  <thead>
                    <tr style={{color:C.textMuted,fontSize:10,textAlign:"left"}}>
                      <th style={{padding:"4px 8px",fontWeight:600}}>ผู้เล่น</th>
                      <th style={{padding:"4px 8px",fontWeight:600,textAlign:"center"}}>เกม</th>
                      <th style={{padding:"4px 8px",fontWeight:600,textAlign:"center"}}>W-L</th>
                      <th style={{padding:"4px 8px",fontWeight:600,textAlign:"center"}}>Win%</th>
                      <th style={{padding:"4px 8px",fontWeight:600,textAlign:"center"}}>K/D/A</th>
                      <th style={{padding:"4px 8px",fontWeight:600}}>Hero ที่เล่นบ่อย</th>
                    </tr>
                  </thead>
                  <tbody>
                    {st.playerPool.map((p,i)=>(
                      <tr key={p.player} style={{background:i%2===0?"transparent":C.bgCard}}>
                        <td style={{padding:"6px 8px",fontWeight:700}}>{p.player}</td>
                        <td style={{padding:"6px 8px",textAlign:"center",color:C.textMuted}}>{p.games}</td>
                        <td style={{padding:"6px 8px",textAlign:"center"}}>
                          <span style={{color:C.win,fontWeight:700}}>{p.wins}</span>
                          <span style={{color:C.textMuted}}> - </span>
                          <span style={{color:C.lose,fontWeight:700}}>{p.losses}</span>
                        </td>
                        <td style={{padding:"6px 8px",textAlign:"center"}}>
                          <span style={{fontWeight:700,padding:"1px 8px",borderRadius:5,
                            background:p.wr>=50?C.lose+"20":C.win+"20",color:p.wr>=50?C.lose:C.win}}>
                            {p.wr}%
                          </span>
                        </td>
                        <td style={{padding:"6px 8px",textAlign:"center",color:C.textMuted}}>
                          {p.hasStats ? `${p.avgK}/${p.avgD}/${p.avgA}` : "—"}
                        </td>
                        <td style={{padding:"6px 8px"}}>
                          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                            {p.topHeroes.slice(0,4).map(h=><HeroChip key={h} name={h} size={20} fontSize={10}/>)}
                            {p.topHeroes.length>4 && <span style={{fontSize:10,color:C.textMuted}}>+{p.topHeroes.length-4}</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pattern ที่เจอ */}
          <div style={{display:"grid",gridTemplateColumns:"1fr",gap:12}}>
            {st.topPatterns.length>0&&(
              <div style={SC.card}>
                <div style={{fontWeight:700,fontSize:12,color:C.primaryLight,marginBottom:10}}>
                  🏷️ Pattern ที่เจอ
                </div>
                {st.topPatterns.map(([t,cnt],i)=>(
                  <div key={t} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                    padding:"5px 8px",background:i%2===0?"transparent":C.bgCard,borderRadius:6,marginBottom:2}}>
                    <span style={{fontWeight:700,fontSize:12,color:C.primaryLight}}>{t}</span>
                    <span style={{background:C.primary+"25",color:C.primaryLight,fontSize:10,
                      padding:"1px 8px",borderRadius:99,fontWeight:700}}>×{cnt}</span>
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

// ── Scout Log Page: matchup list ──
function ScoutLogPage({ rivalName, scoutMatches, rivals, enemyRosters, isCoach, onSaveScout, onDeleteScout, onUpdateScoutGame }) {
  const [creating,       setCreating]       = useState(false);
  const [selOpponent,    setSelOpponent]    = useState(null);
  const [scoutCatFilter, setScoutCatFilter] = useState("all"); // "all" | "scrim" | "tournament"

  // records ที่ rivalName เกี่ยวข้อง
  const related = scoutMatches.filter(sm=>sm.teamA===rivalName||sm.teamB===rivalName);

  // สร้าง matchup map: { opponentName → records[] }
  const matchupMap = {};
  related.forEach(sm=>{
    const opp = sm.teamA===rivalName ? sm.teamB : sm.teamA;
    if (!matchupMap[opp]) matchupMap[opp]=[];
    matchupMap[opp].push(sm);
  });
  const matchups = Object.entries(matchupMap)
    .map(([opp,recs])=>({ opp, recs, ...calcMatchupStats(recs,rivalName) }))
    .sort((a,b)=>b.games-a.games);

  if (creating) return (
    <ScoutSessionCreator rivals={rivals} enemyRosters={enemyRosters}
      onSave={data=>{onSaveScout(data);setCreating(false);}}
      onCancel={()=>setCreating(false)}/>
  );

  // ── Drill-down: A vs B ──
  if (selOpponent) return (
    <MatchupDetail
      rivalName={rivalName}
      opponent={selOpponent}
      records={matchupMap[selOpponent]||[]}
      rivals={rivals}
      enemyRosters={enemyRosters}
      onSaveScout={data=>{onSaveScout(data);}}
      onDeleteScout={onDeleteScout}
      onUpdateScoutGame={onUpdateScoutGame}
      onBack={()=>setSelOpponent(null)}
    />
  );

  // ── Level 1: matchup list ──
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <h3 style={{margin:0,fontSize:15,fontWeight:800,color:C.primaryLight}}>
          🔍 Scout Log — {rivalName}
        </h3>
        {isCoach && (
          <button onClick={()=>setCreating(true)}
            style={{marginLeft:"auto",background:`linear-gradient(135deg,${C.primary},${C.primaryLight})`,
              color:"#fff",border:"none",borderRadius:9,padding:"7px 16px",
              cursor:"pointer",fontWeight:800,fontSize:12}}>
            + บันทึก Scout ใหม่
          </button>
        )}
      </div>

      {!isCoach && (
        <div style={{background:C.primary+"12",border:`1px solid ${C.primary}30`,borderRadius:10,
          padding:"9px 14px",marginBottom:14,fontSize:12,color:C.textMuted,
          display:"flex",alignItems:"center",gap:8}}>
          <span>🔒</span>
          <span>Scout log เป็นข้อมูลที่โค้ช/แอดมินจัดการ — ข้อมูลจากการซ้อมของทีมคู่แข่งดูได้เฉพาะโค้ช/แอดมินเท่านั้น ข้อมูลจากแมตช์แข่งจริงดูได้ตามปกติ</span>
        </div>
      )}

      {related.length===0 ? (
        <div style={{textAlign:"center",padding:"40px 20px",background:C.bgPanel,
          borderRadius:14,color:C.textMuted}}>
          <div style={{fontSize:32,marginBottom:8}}>🔍</div>
          ยังไม่มี Scout record ของ {rivalName}<br/>
          <span style={{fontSize:12}}>กด "+ บันทึก Scout ใหม่" เพื่อเริ่มจด</span>
        </div>
      ) : (
        <>
          {/* ── Category filter tabs ── */}
          {(()=>{
            const scrimCount = related.filter(sm=>!sm.category||sm.category==="scrim").length;
            const tourneyCount = related.filter(sm=>sm.category==="tournament").length;
            const filteredMatchups = matchups.filter(mu=>{
              if(scoutCatFilter==="all") return true;
              return mu.recs.some(sm=>scoutCatFilter==="tournament"
                ? sm.category==="tournament"
                : (!sm.category||sm.category==="scrim"));
            });
            return (
              <>
                <div style={{display:"flex",gap:6,marginBottom:14}}>
                  {[{id:"all",label:"ทั้งหมด",count:related.length},
                    {id:"scrim",label:"🏋️ ซ้อม",count:scrimCount},
                    {id:"tournament",label:"🏆 แข่ง",count:tourneyCount}].map(t=>(
                    <button key={t.id} onClick={()=>setScoutCatFilter(t.id)}
                      style={{background:scoutCatFilter===t.id?C.primary+"30":"transparent",
                        border:`2px solid ${scoutCatFilter===t.id?C.primary:C.border}`,
                        color:scoutCatFilter===t.id?C.primaryLight:C.textMuted,
                        borderRadius:99,padding:"5px 14px",cursor:"pointer",fontWeight:700,fontSize:11}}>
                      {t.label} <span style={{opacity:0.6,fontWeight:400}}>({t.count})</span>
                    </button>
                  ))}
                </div>
                <p style={{margin:"0 0 12px",color:C.textMuted,fontSize:12}}>
                  เลือก matchup เพื่อดูรายละเอียด
                </p>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {filteredMatchups.map(mu=>(
              <div key={mu.opp}
                onClick={()=>setSelOpponent(mu.opp)}
                style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:14,
                  padding:"14px 18px",cursor:"pointer",
                  borderLeft:`4px solid ${mu.wr>=50?C.win:mu.games===0?"#555":C.lose}`,
                  display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}
                onMouseEnter={e=>e.currentTarget.style.borderColor=C.primary}
                onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>

                {/* team names */}
                <div style={{minWidth:180}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                    <span style={{fontWeight:900,fontSize:15,color:C.blue}}>{rivalName}</span>
                    <span style={{color:C.textMuted,fontWeight:700,fontSize:12}}>vs</span>
                    <span style={{fontWeight:900,fontSize:15,color:C.red}}>{mu.opp}</span>
                  </div>
                  <div style={{fontSize:11,color:C.textMuted}}>
                    {mu.recs.length} session · {mu.games} เกม
                  </div>
                </div>

                {/* W/L record */}
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <div style={{background:C.win+"20",borderRadius:8,padding:"4px 12px",textAlign:"center"}}>
                    <div style={{fontSize:16,fontWeight:800,color:C.win}}>{mu.wins}</div>
                    <div style={{fontSize:9,color:C.textMuted}}>W</div>
                  </div>
                  <span style={{color:C.textMuted,fontWeight:700}}>—</span>
                  <div style={{background:C.lose+"20",borderRadius:8,padding:"4px 12px",textAlign:"center"}}>
                    <div style={{fontSize:16,fontWeight:800,color:C.lose}}>{mu.losses}</div>
                    <div style={{fontSize:9,color:C.textMuted}}>L</div>
                  </div>
                </div>

                {/* WR badge */}
                <div style={{textAlign:"center",minWidth:52}}>
                  <div style={{fontSize:20,fontWeight:800,color:mu.wr>=50?C.win:C.lose}}>
                    {mu.games?`${mu.wr}%`:"-"}
                  </div>
                  <div style={{fontSize:9,color:C.textMuted}}>Win Rate</div>
                </div>

                {/* kill ratio */}
                {(mu.kFor>0||mu.kAgainst>0)&&(
                  <div style={{textAlign:"center",minWidth:80}}>
                    <div style={{fontSize:13,fontWeight:700}}>
                      <span style={{color:C.win}}>{mu.kFor}</span>
                      <span style={{color:C.textMuted,margin:"0 4px"}}>:</span>
                      <span style={{color:C.lose}}>{mu.kAgainst}</span>
                    </div>
                    <div style={{fontSize:9,color:C.textMuted}}>kills</div>
                  </div>
                )}

                {/* last game tags */}
                {(()=>{
                  const lastGame = mu.recs[mu.recs.length-1];
                  const lastG = (lastGame?.games||[]).slice(-1)[0];
                  const tags = lastG?.tags||[];
                  return tags.length>0&&(
                    <div style={{display:"flex",gap:4,flexWrap:"wrap",flex:1}}>
                      {tags.slice(0,3).map(t=>(
                        <span key={t} style={{background:C.primary+"20",color:C.primaryLight,
                          fontSize:9,padding:"2px 8px",borderRadius:99,fontWeight:700}}>{t}</span>
                      ))}
                    </div>
                  );
                })()}

                <span style={{marginLeft:"auto",color:C.textMuted,fontSize:13}}>→</span>
              </div>
            ))}
                </div>
              </>
            );
          })()}
        </>
      )}
    </div>
  );
}

// SchedulePage, LogoImg, LogoUploader moved to components/shared/SchedulePage.js and components/shared/TeamLogo.js

// PerformanceTrend, CoachNotesHub moved to components/shared/PerformanceTrend.js
// HeroImageManager, AddHeroModal, HeroImageSlot, HeroAvatar moved to components/shared/HeroImageManager.js
// (also removed dead-code leftovers HERO_LIST/ROLE_COLORS/TOOLS/COLORS/SIZES that used to sit here — see that file's header comment)

// ═══════════════════════════════════════════
//  MAIN APP
// ═══════════════════════════════════════════


// Video Library module (getVideoInfo, VideoEmbed, TimestampedNote, VideoDrawOverlay, VideoCard, VideoLibrary) moved to components/shared/VideoLibrary.js

// ═══════════════════════════════════════════
//  REDUCERS
// ═══════════════════════════════════════════

// ── 1. APP REDUCER — persistent data ──────
const APP_INIT = {
  matches:      null,   // loaded lazily from localStorage
  teamLogo:     null,   // URL รูปโลโก้ทีมเรา (Vercel Blob)
  rivalLogos:   {},     // { [rivalName]: URL }
  rivals:       null,
  roster:       null,
  enemyRosters: null,
};

// ── App state defaults (actual load/save now goes through lib/storage.js,
//    which talks to the real Postgres-backed /api/data route) ──

function defaultAppState() {
  return {
    matches:       [],
    rivals:        [],
    roster:        ["Player 1","Player 2"],
    enemyRosters:  {},
    scoutMatches:  [],
    playerPhotos:  {},
    heroPhotos:    {},
    customHeroes:  [],
    roleOverrides: {},
    videos:        [], // { id, title, url, rival, date, tags, note, type }
    schedules:     [], // { id, date, time, rival, tournament, note, matchId? }
    teamLogo:      null,
    rivalLogos:    {},
    patchInfo:     {version:"",notes:"",updatedAt:null}, // ข้อมูล patch ปัจจุบัน
    heroTiers:     {}, // { [heroName]: "S+"|"S"|"A"|"B"|"C" } — meta tier list
    practiceAssignments: [], // [{ id, player, title, note, dueDate, done, createdAt, createdBy }]
    whiteboardElements: [],   // Tactical Whiteboard current board — paths/arrows/hero markers/text
    whiteboardFormations: [], // saved named boards — [{ id, name, elements, mapUrl, createdAt }]
    whiteboardMapUrl: null,   // uploaded background map — Vercel Blob URL
  };
}

function initAppState() {
  // sync default — actual data is hydrated async via loadFromStorage()
  return { ...defaultAppState(), _loaded: false };
}

function appReducer(state, action) {
  switch (action.type) {

    case "LOAD_FROM_STORAGE":
      return { ...action.payload };

    case "SAVE_MATCH": {
      const today = new Date().toLocaleDateString("th-TH",{day:"numeric",month:"short",year:"numeric"});
      const m = { id: Date.now(), date: today, category: "scrim", ...action.payload };
      const rivals = state.rivals.find(r => r.name === action.payload.rivalName)
        ? state.rivals
        : [...state.rivals, { id: Date.now()+1, name: action.payload.rivalName }];
      return { ...state, matches: [m, ...state.matches], rivals };
    }

    case "DELETE_MATCH":
      return { ...state, matches: state.matches.filter(m => m.id !== action.payload) };

    case "UPDATE_MATCH_META": {
      // payload: { id, rivalName, category, note }  (ช่วยแก้ข้อมูลพื้นฐานของแมตช์)
      const { id: mid, ...changes } = action.payload;
      return {
        ...state,
        matches: state.matches.map(m => m.id === mid ? { ...m, ...changes } : m),
      };
    }

    case "ADD_VIDEO": {
      const today = new Date().toLocaleDateString("th-TH",{day:"numeric",month:"short",year:"numeric"});
      const v = { id: Date.now(), date: action.payload.date || today, ...action.payload };
      return { ...state, videos: [v, ...state.videos] };
    }

    // ── ใช้ตอนกด "เช็ควิดีโอใหม่" ในหน้า Video Library ──
    // ดึง videos ล่าสุดจาก server มา merge เข้า state ปัจจุบัน (ไม่ทับ field
    // อื่นๆ ที่อาจกำลังแก้ค้างอยู่ — ต่างจาก LOAD_FROM_STORAGE ที่ replace
    // ทั้งก้อน) เผื่อ cron job เพิ่งนำเข้าวิดีโอใหม่จาก YouTube ให้
    case "SET_VIDEOS":
      return { ...state, videos: action.payload };

    case "UPDATE_VIDEO":
      return { ...state, videos: state.videos.map(v => v.id===action.payload.id ? { ...v, ...action.payload } : v) };

    case "DELETE_VIDEO":
      return { ...state, videos: state.videos.filter(v => v.id !== action.payload) };

    case "UPDATE_STATS": {
      const { matchId, gameIdx, gameStats } = action.payload;
      const matches = state.matches.map(m => {
        if (m.id !== matchId) return m;
        if (gameIdx != null && Array.isArray(m.games)) {
          const games = [...m.games];
          games[gameIdx] = { ...games[gameIdx], gameStats };
          return { ...m, games };
        }
        return { ...m, gameStats };
      });
      return { ...state, matches };
    }

    case "UPDATE_OBJECTIVES": {
      const { matchId, gameIdx, objectives } = action.payload;
      const matches = state.matches.map(m => {
        if (m.id !== matchId) return m;
        if (gameIdx != null && Array.isArray(m.games)) {
          const games = [...m.games];
          games[gameIdx] = { ...games[gameIdx], objectives };
          return { ...m, games };
        }
        return { ...m, objectives };
      });
      return { ...state, matches };
    }

    // แก้ไขข้อมูลเกมย้อนหลังจากหน้า Match Log — hero draft, สกอร์, เวลา,
    // ชื่อผู้เล่น, และการผูกวิดีโอ (ไม่ใช่แค่ stats เหมือน UPDATE_STATS เดิม)
    case "UPDATE_GAME_FULL": {
      const { matchId, gameIdx, updates } = action.payload;
      const matches = state.matches.map(m => {
        if (m.id !== matchId) return m;
        if (gameIdx != null && Array.isArray(m.games)) {
          const games = [...m.games];
          games[gameIdx] = { ...games[gameIdx], ...updates };
          return { ...m, games };
        }
        return { ...m, ...updates };
      });
      return { ...state, matches };
    }

    case "ADD_PLAYER": {
      const name = action.payload.trim();
      if (!name || state.roster.includes(name)) return state;
      return { ...state, roster: [...state.roster, name] };
    }

    case "REMOVE_PLAYER": {
      const { [`our:${action.payload}`]: _omit, ...restPhotos } = state.playerPhotos;
      return { ...state, roster: state.roster.filter(p => p !== action.payload), playerPhotos: restPhotos };
    }

    case "RENAME_PLAYER": {
      // payload: { oldName, newName }
      // ต้องอัปเดตทุกที่ที่อ้างชื่อผู้เล่นแบบ string ตรงๆ ไม่งั้นสถิติ/รูป
      // เก่าจะ "หาย" (จริงๆ ยังอยู่ แต่ผูกกับชื่อเก่าที่ไม่มีใครค้นหาแล้ว):
      //   roster, playerPhotos (key our:<name>), matches[].ourPicks[].player,
      //   practiceAssignments[].player
      const { oldName, newName: rawNewName } = action.payload;
      const newName = rawNewName.trim();
      if (!newName || oldName === newName) return state;
      if (state.roster.includes(newName)) return state; // กันชื่อซ้ำกับคนที่มีอยู่แล้ว

      const roster = state.roster.map(p => p === oldName ? newName : p);

      const oldPhotoKey = `our:${oldName}`, newPhotoKey = `our:${newName}`;
      let playerPhotos = state.playerPhotos;
      if (Object.prototype.hasOwnProperty.call(playerPhotos, oldPhotoKey)) {
        const { [oldPhotoKey]: movedPhoto, ...rest } = playerPhotos;
        playerPhotos = { ...rest, [newPhotoKey]: movedPhoto };
      }

      const renamePicksInGame = (g) => (
        Array.isArray(g.ourPicks) && g.ourPicks.some(s => s.player === oldName)
          ? { ...g, ourPicks: g.ourPicks.map(s => s.player === oldName ? { ...s, player: newName } : s) }
          : g
      );
      const matches = state.matches.map(m =>
        Array.isArray(m.games) && m.games.length > 0
          ? { ...m, games: m.games.map(renamePicksInGame) }
          : renamePicksInGame(m)
      );

      const practiceAssignments = (state.practiceAssignments || []).map(a =>
        a.player === oldName ? { ...a, player: newName } : a
      );

      return { ...state, roster, playerPhotos, matches, practiceAssignments };
    }

    case "ADD_ENEMY_PLAYER": {
      const { rivalName, playerName } = action.payload;
      const cur = state.enemyRosters[rivalName] || [];
      if (!playerName.trim() || cur.includes(playerName.trim())) return state;
      return {
        ...state,
        enemyRosters: { ...state.enemyRosters, [rivalName]: [...cur, playerName.trim()] },
      };
    }

    case "REMOVE_ENEMY_PLAYER": {
      const { rivalName, playerName } = action.payload;
      const { [`enemy:${rivalName}:${playerName}`]: _omit, ...restPhotos } = state.playerPhotos;
      return {
        ...state,
        enemyRosters: {
          ...state.enemyRosters,
          [rivalName]: (state.enemyRosters[rivalName] || []).filter(p => p !== playerName),
        },
        playerPhotos: restPhotos,
      };
    }

    case "RENAME_ENEMY_PLAYER": {
      // payload: { rivalName, oldName, newName } — เหมือน RENAME_PLAYER แต่
      // scope เฉพาะทีมคู่แข่งทีมนั้น (enemyRosters[rivalName], enemyPicks
      // ในเกมที่ rivalName ตรงกัน, photo key แบบ enemy:<rival>:<name>)
      const { rivalName, oldName, newName: rawNewName } = action.payload;
      const newName = rawNewName.trim();
      const currentRoster = state.enemyRosters[rivalName] || [];
      if (!newName || oldName === newName) return state;
      if (currentRoster.includes(newName)) return state; // กันชื่อซ้ำในทีมเดียวกัน

      const enemyRosters = {
        ...state.enemyRosters,
        [rivalName]: currentRoster.map(p => p === oldName ? newName : p),
      };

      const oldPhotoKey = `enemy:${rivalName}:${oldName}`, newPhotoKey = `enemy:${rivalName}:${newName}`;
      let playerPhotos = state.playerPhotos;
      if (Object.prototype.hasOwnProperty.call(playerPhotos, oldPhotoKey)) {
        const { [oldPhotoKey]: movedPhoto, ...rest } = playerPhotos;
        playerPhotos = { ...rest, [newPhotoKey]: movedPhoto };
      }

      const renameInGame = (g) => (
        g.rivalName === rivalName && Array.isArray(g.enemyPicks) && g.enemyPicks.some(s => s.player === oldName)
          ? { ...g, enemyPicks: g.enemyPicks.map(s => s.player === oldName ? { ...s, player: newName } : s) }
          : g
      );
      // match ระดับบนสุดก็มี rivalName ติดอยู่ (ไม่ใช่แค่ game) — เช็ค m.rivalName
      // ก่อนเข้าไปวนแก้ games เพื่อไม่ต้องไล่ทุกแมตช์ของทุกทีมเปล่าๆ
      const matches = state.matches.map(m => {
        if (m.rivalName !== rivalName) return m;
        return Array.isArray(m.games) && m.games.length > 0
          ? { ...m, games: m.games.map(renameInGame) }
          : renameInGame(m);
      });

      return { ...state, enemyRosters, playerPhotos, matches };
    }

    case "SET_PHOTO": {
      // payload: { key, dataUrl }  key e.g. "our:Name" or "enemy:Team:Name"
      return { ...state, playerPhotos: { ...state.playerPhotos, [action.payload.key]: action.payload.dataUrl } };
    }

    case "REMOVE_PHOTO": {
      const { [action.payload]: _omit, ...rest } = state.playerPhotos;
      return { ...state, playerPhotos: rest };
    }

    case "SET_HERO_PHOTO": {
      // payload: { heroName, dataUrl }
      return { ...state, heroPhotos: { ...state.heroPhotos, [action.payload.heroName]: action.payload.dataUrl } };
    }

    case "SET_HERO_PHOTOS_BULK": {
      // payload: { [heroName]: dataUrl, ... }
      return { ...state, heroPhotos: { ...state.heroPhotos, ...action.payload } };
    }

    case "REMOVE_HERO_PHOTO": {
      const { [action.payload]: _omit, ...rest } = state.heroPhotos;
      return { ...state, heroPhotos: rest };
    }

    case "ADD_RIVAL": {
      const name = action.payload.trim();
      if (!name || state.rivals.some(r=>r.name.toLowerCase()===name.toLowerCase())) return state;
      return { ...state, rivals: [...state.rivals, { id: Date.now()+Math.random(), name }] };
    }

    case "DELETE_RIVAL":
      return { ...state, rivals: state.rivals.filter(r=>r.name!==action.payload) };

    case "ADD_SCHEDULE": {
      const s = { id: Date.now()+Math.random(), ...action.payload };
      const sched = [...(state.schedules||[]), s].sort((a,b)=>
        new Date(a.date+"T"+(a.time||"00:00")) - new Date(b.date+"T"+(b.time||"00:00"))
      );
      return { ...state, schedules: sched };
    }

    case "UPDATE_SCHEDULE": {
      const { id: sid, ...changes } = action.payload;
      return { ...state, schedules: (state.schedules||[]).map(s=>s.id===sid?{...s,...changes}:s) };
    }

    case "DELETE_SCHEDULE":
      return { ...state, schedules: (state.schedules||[]).filter(s=>s.id!==action.payload) };

    case "SET_TEAM_LOGO":
      return { ...state, teamLogo: action.payload };

    case "SET_RIVAL_LOGO":
      return { ...state, rivalLogos: { ...state.rivalLogos, [action.payload.name]: action.payload.url } };

    case "REMOVE_RIVAL_LOGO": {
      const { [action.payload]: _, ...rest } = state.rivalLogos || {};
      return { ...state, rivalLogos: rest };
    }

    case "SET_PATCH_INFO":
      return { ...state, patchInfo: { ...state.patchInfo, ...action.payload, updatedAt: new Date().toISOString() } };

    case "SET_HERO_TIER": {
      const { hero, tier } = action.payload;
      const heroTiers = { ...(state.heroTiers||{}) };
      if (!tier) delete heroTiers[hero]; else heroTiers[hero] = tier;
      return { ...state, heroTiers };
    }

    case "ADD_PRACTICE": {
      const item = { id: Date.now(), done: false, createdAt: new Date().toISOString(), ...action.payload };
      return { ...state, practiceAssignments: [item, ...(state.practiceAssignments||[])] };
    }

    case "TOGGLE_PRACTICE":
      return { ...state, practiceAssignments: (state.practiceAssignments||[]).map(p=>
        p.id===action.payload ? { ...p, done: !p.done } : p) };

    case "DELETE_PRACTICE":
      return { ...state, practiceAssignments: (state.practiceAssignments||[]).filter(p=>p.id!==action.payload) };

    // ── Tactical Whiteboard persistence ──
    // ก่อนหน้านี้ elements/formations เก็บแค่ local useState ใน
    // TacticalWhiteboard เอง ไม่เคยถูกบันทึกลง database เลย — พอออกจากหน้า
    // หรือ refresh ข้อมูลเลยหายหมด (ทั้งกระดานที่วาดค้างและ formation ที่
    // "บันทึก" ไว้) ย้ายมาไว้ใน app state ตรงนี้แทน ให้ autosave ที่มีอยู่
    // แล้วจัดการให้เหมือน field อื่นๆ ทั้งหมด
    case "SET_WHITEBOARD_ELEMENTS":
      return { ...state, whiteboardElements: action.payload };

    case "SET_WHITEBOARD_MAP":
      return { ...state, whiteboardMapUrl: action.payload };

    case "ADD_WHITEBOARD_FORMATION": {
      const item = { id: Date.now(), createdAt: new Date().toISOString(), ...action.payload };
      return { ...state, whiteboardFormations: [item, ...(state.whiteboardFormations||[])] };
    }

    case "DELETE_WHITEBOARD_FORMATION":
      return { ...state, whiteboardFormations: (state.whiteboardFormations||[]).filter(f=>f.id!==action.payload) };

    case "ADD_CUSTOM_HERO": {
      // payload: { name, role, img? }
      const name = action.payload.name.trim();
      if (!name) return state;
      const exists = [...HERO_DATA, ...state.customHeroes].some(h=>h.name.toLowerCase()===name.toLowerCase());
      if (exists) return state; // don't add duplicates
      return { ...state, customHeroes: [...state.customHeroes, { name, role: action.payload.role, img: name.toLowerCase() }] };
    }

    case "REMOVE_CUSTOM_HERO": {
      // ลบได้เฉพาะ Hero ที่ทีมเพิ่มเอง (customHeroes) — ปุ่มลบใน UI โชว์เฉพาะ
      // การ์ดที่ hero._custom===true อยู่แล้ว แต่กันซ้ำอีกชั้น: ถ้าชื่อที่ส่งมา
      // ไม่ได้อยู่ใน customHeroes (เช่นเป็น Hero หลักของเกม) จะไม่มีผลอะไรเลย
      const name = action.payload;
      return {
        ...state,
        customHeroes: state.customHeroes.filter(h => h.name !== name),
        // เผื่อเคยตั้ง role override ให้ฮีโร่ตัวนี้ไว้ — ล้างทิ้งกันขยะค้าง
        roleOverrides: Object.fromEntries(Object.entries(state.roleOverrides).filter(([k]) => k !== name)),
      };
    }

    case "SET_ROLE_OVERRIDE": {
      // payload: { heroName, role }
      return { ...state, roleOverrides: { ...state.roleOverrides, [action.payload.heroName]: action.payload.role } };
    }

    case "SAVE_SCOUT": {
      const today = new Date().toLocaleDateString("th-TH",{day:"numeric",month:"short",year:"numeric"});
      const sm = { id: Date.now(), date: today, ...action.payload };
      // auto-add rivals if new
      const newRivals = [...state.rivals];
      [sm.teamA, sm.teamB].forEach(name => {
        if (name && !newRivals.find(r=>r.name===name))
          newRivals.push({ id: Date.now() + Math.random(), name });
      });
      return { ...state, scoutMatches: [sm, ...state.scoutMatches], rivals: newRivals };
    }

    case "DELETE_SCOUT":
      return { ...state, scoutMatches: state.scoutMatches.filter(s=>s.id!==action.payload) };

    // แก้ไขข้อมูลเกมใน Scout Log ย้อนหลัง (hero/ผู้เล่น/สกอร์/เวลา/K-D-A)
    case "UPDATE_SCOUT_GAME": {
      const { scoutId, gameIdx, updates } = action.payload;
      const scoutMatches = state.scoutMatches.map(sm => {
        if (sm.id !== scoutId) return sm;
        const games = [...(sm.games||[])];
        games[gameIdx] = { ...games[gameIdx], ...updates };
        return { ...sm, games };
      });
      return { ...state, scoutMatches };
    }

    case "MERGE_STATE":
      return { ...state, ...action.payload };

    default: return state;
  }
}

// ── 2. UI REDUCER — navigation & inputs ───
function initUIState() {
  return {
    page:           "overview",
    selRival:       null,
    rivalView:      "history",
    rosterTab:      "our",
    selPlayer:      null,
    selPlayerEnemy: false,
    selEnemyTeam:   null,
    newName:        "",
    newEnemyName:   "",
    scoutView:      null,   // null | "log" | "new"
    focusVideoId:   null,   // ใช้ตอนกด "ดูวิดีโอ" จาก Match Log ให้ไปเปิดคลิปที่ผูกไว้อัตโนมัติ
  };
}

function uiReducer(state, action) {
  switch (action.type) {
    case "SET_PAGE":            return { ...state, page: action.payload, selRival: null };
    case "GOTO_VIDEO":          return { ...state, page: "video", focusVideoId: action.payload, selRival: null };
    case "CLEAR_FOCUS_VIDEO":   return { ...state, focusVideoId: null };
    case "SET_SEL_RIVAL":       return { ...state, selRival: action.payload, rivalView: "history", scoutView: null };
    case "SET_RIVAL_VIEW":      return { ...state, rivalView: action.payload };
    case "SET_SCOUT_VIEW":      return { ...state, scoutView: action.payload };
    case "SET_ROSTER_TAB":      return { ...state, rosterTab: action.payload, selEnemyTeam: null };
    case "SET_SEL_PLAYER":      return { ...state, selPlayer: action.payload.name, selPlayerEnemy: action.payload.isEnemy };
    case "CLEAR_SEL_PLAYER":    return { ...state, selPlayer: null, selPlayerEnemy: false };
    case "SET_SEL_ENEMY_TEAM":  return { ...state, selEnemyTeam: action.payload };
    case "SET_NEW_NAME":        return { ...state, newName: action.payload };
    case "SET_NEW_ENEMY_NAME":  return { ...state, newEnemyName: action.payload };
    case "CLEAR_NEW_NAME":      return { ...state, newName: "" };
    case "CLEAR_NEW_ENEMY_NAME":return { ...state, newEnemyName: "" };
    case "SET_MATCH_CAT_FILTER":  return { ...state, matchCatFilter: action.payload };
    case "SET_MATCH_PATCH_FILTER": return { ...state, matchPatchFilter: action.payload };
    default: return state;
  }
}

// ── 3. DRAFT REDUCER — entire draft session ──
function initDraftState() {
  return {
    stage:          "setup",   // setup | chooseSide | playing | done
    boType:         "BO3",
    rivalName:      "",
    category:       "scrim",  // "scrim" | "tournament"
    patch:          "",       // patch version เช่น "4.21"
    ourSide:        null,
    currentGame:    1,
    completedGames: [],
    // SingleGameDraft sub-state
    step:           0,
    blueBans:       Array(BANS_PER_TEAM).fill(null),
    redBans:        Array(BANS_PER_TEAM).fill(null),
    bluePicks:      ROLES_PICK.map(r => ({ role: r, hero: null, player: "" })),
    redPicks:       ROLES_PICK.map(r => ({ role: r, hero: null, player: "" })),
    roleFilter:     "All",
    search:         "",
    meta:           { result:"WIN", ourScore:"", enemyScore:"", duration:"", hasPause:false, pauseDuration:"", note:"" },
  };
}

function draftReducer(state, action) {
  switch (action.type) {

    case "SETUP_SET_BO":       return { ...state, boType: action.payload };
    case "SETUP_SET_RIVAL":    return { ...state, rivalName: action.payload };
    case "SETUP_SET_CATEGORY": return { ...state, category: action.payload };
    case "SETUP_SET_PATCH":    return { ...state, patch: action.payload };
    case "SETUP_NEXT":         return { ...state, stage: "chooseSide" };

    case "CHOOSE_SIDE":
      return { ...state, ourSide: action.payload, stage: "playing" };

    case "BACK_TO_SETUP":
      return { ...initDraftState(), boType: state.boType };

    case "RESET":
      return initDraftState();

    // กู้คืน draft ที่ค้างไว้จาก localStorage (กรณีแท็บ crash/refresh กลางคัน)
    case "LOAD_DRAFT":
      return { ...action.payload };

    // Hero selection
    case "SELECT_HERO": {
      const { hero, team, action: act, slot } = action.payload;
      if (act === "ban") {
        const key = team === "blue" ? "blueBans" : "redBans";
        const arr = [...state[key]]; arr[slot] = hero;
        return { ...state, [key]: arr, step: state.step + 1 };
      } else {
        const key = team === "blue" ? "bluePicks" : "redPicks";
        const arr = [...state[key]]; arr[slot] = { ...arr[slot], hero };
        return { ...state, [key]: arr, step: state.step + 1 };
      }
    }

    case "UNDO": {
      if (state.step === 0) return state;
      const prev = DRAFT_ORDER[state.step - 1];
      const { team, action: act, slot } = prev;
      if (act === "ban") {
        const key = team === "blue" ? "blueBans" : "redBans";
        const arr = [...state[key]]; arr[slot] = null;
        return { ...state, [key]: arr, step: state.step - 1 };
      } else {
        const key = team === "blue" ? "bluePicks" : "redPicks";
        const arr = [...state[key]]; arr[slot] = { ...arr[slot], hero: null };
        return { ...state, [key]: arr, step: state.step - 1 };
      }
    }

    case "SET_PLAYER": {
      const { team, idx, playerName } = action.payload;
      const key = team === "blue" ? "bluePicks" : "redPicks";
      const arr = [...state[key]];
      arr[idx] = { ...arr[idx], player: playerName };
      return { ...state, [key]: arr };
    }

    case "SET_ROLE_FILTER": return { ...state, roleFilter: action.payload };
    case "SET_SEARCH":      return { ...state, search: action.payload };
    case "SET_META":        return { ...state, meta: { ...state.meta, ...action.payload } };

    case "GAME_DONE": {
      // Note: when this was the LAST game of the BO series, the component
      // intercepts handleGameDone() and calls onFinishSession() directly
      // instead of dispatching here — see DraftPageR.handleGameDone().
      // This reducer case only ever runs for non-final games now, so it
      // always advances to the next game.
      const newGames = [...state.completedGames, { ...action.payload, gameNo: state.currentGame }];
      return {
        ...state,
        completedGames: newGames,
        currentGame: state.currentGame + 1,
        stage: "chooseSide",
        // reset board for next game
        step: 0,
        blueBans:  Array(BANS_PER_TEAM).fill(null),
        redBans:   Array(BANS_PER_TEAM).fill(null),
        bluePicks: ROLES_PICK.map(r => ({ role: r, hero: null, player: "" })),
        redPicks:  ROLES_PICK.map(r => ({ role: r, hero: null, player: "" })),
        meta: { result:"WIN", ourScore:"", enemyScore:"", duration:"", hasPause:false, pauseDuration:"", note:"" },
      };
    }

    case "FINISH_EARLY":
      return { ...state, stage: "done" };

    default: return state;
  }
}

// PracticePage moved to components/shared/PracticePage.js

// MyStatsPage moved to components/shared/MyStatsPage.js

// NoTeamScreen moved to components/shared/NoTeamScreen.js

// ═══════════════════════════════════════════
//  MAIN APP
// ═══════════════════════════════════════════
function RovAppInner() {
  const { data: session, update: updateSession } = useSession();
  const toast = useToast();
  const userRole = session?.user?.role || "member"; // "admin" | "coach" | "member"
  const isAdmin  = userRole === "admin";
  const isCoach  = userRole === "admin" || userRole === "coach";
  const [app,  dispatchApp]  = useReducer(appReducer,  null, initAppState);
  const [ui,   dispatchUI]   = useReducer(uiReducer,   null, initUIState);

  // ── Google Calendar connect/disconnect result ──
  // /api/google-calendar/callback redirects back here with ?calendar=...
  // — show a toast for the result, then strip the param so a page refresh
  // doesn't re-show it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("calendar");
    if (!result) return;
    if (result === "connected") toast("เชื่อมต่อ Google Calendar สำเร็จ 🎉", "success");
    else if (result === "denied") toast("ยกเลิกการเชื่อมต่อ Google Calendar", "info");
    else if (result === "error") toast("เชื่อมต่อ Google Calendar ไม่สำเร็จ ลองใหม่อีกครั้ง", "error");
    params.delete("calendar");
    const cleanUrl = window.location.pathname + (params.toString() ? `?${params}` : "");
    window.history.replaceState({}, "", cleanUrl);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [draft, dispatchDraft]= useReducer(draftReducer, null, initDraftState);

  // ── Patch filter — ใช้ทั่วทั้งแอป (Overview/Rivals/Roster/My Stats อ่าน allGames ตัวเดียวกัน) ──
  const patchVersions = usePatchVersions();
  const [selectedPatch, setSelectedPatch] = useState("current");

  // ── Autosave in-progress draft ไว้ที่ localStorage ──
  // ป้องกันเสีย progress ทั้งหมดถ้าแท็บ crash/refresh/ปิดพลาดกลางคันตอน
  // กำลัง ban/pick อยู่ (ระหว่างแข่งจริง ที่กดดันเรื่องเวลามาก เสียแล้วเสียเลย)
  useEffect(() => {
    try {
      if (draft.stage === "setup") {
        localStorage.removeItem(DRAFT_LS_KEY);
      } else {
        localStorage.setItem(DRAFT_LS_KEY, JSON.stringify(draft));
      }
    } catch (err) {
      console.warn("Draft autosave to localStorage failed (non-fatal):", err);
    }
  }, [draft]);
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved | error
  const [heroDataVersion, setHeroDataVersion] = useState(0); // bump to force re-render after HERO_DATA mutation
  // 1400px covers iPad landscape (max ~1366 CSS px) too — with 13 nav items
  // + team name + user badge, nothing narrower than a genuinely wide
  // monitor can fit them in one row without an ugly wrap.
  const isMobile = useIsMobile(1400);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // ── load from Database on mount ──
  useEffect(() => {
    let cancelled = false;
    loadFromStorage().then(loaded => {
      if (!cancelled) dispatchApp({ type:"LOAD_FROM_STORAGE", payload: loaded });
    });
    return () => { cancelled = true; };
  }, []);

  // ── save to Database (debounced) whenever app data changes ──
  // ── in-flight save guard ──
  // Root-cause fix for "save says success, then a bit later says conflict
  // and the result disappears": previously nothing stopped a SECOND real
  // save from firing while a FIRST save (including its own conflict
  // fetch-fresh+merge+retry) was still in flight — e.g. finishing a draft
  // right after some other edit's autosave was still waiting on a slow
  // network response. Two concurrent saves can each trigger their own
  // conflict-recovery, and those recoveries can race each other (one's
  // "fresh" snapshot can predate the other's just-written data), silently
  // dropping whichever save lost the race — even though storage.js's
  // saveToStorage() is now itself serialized (see the queue there), we
  // still don't want to pile up several queued saves back-to-back here;
  // if one is running, just remember that another save is needed and fire
  // ONE more with the latest state once the current one settles.
  const savingRef  = useRef(false);
  const pendingRef = useRef(false);

  const runAutosave = useCallback(async () => {
    if (savingRef.current) { pendingRef.current = true; return; } // already saving — queue exactly one more round
    savingRef.current = true;
    setSaveStatus("saving");
    try {
      await saveToStorage(app);
      setSaveStatus("saved");
      setTimeout(()=>setSaveStatus("idle"), 2000);
    } catch (err) {
      if (err.wasMerged) {
        // ── ชนกันแต่กู้คืนอัตโนมัติสำเร็จ ──
        // saveToStorage() พยายามรวมข้อมูลที่เพิ่ม (แมตช์/วิดีโอ/ตารางซ้อม
        // ฯลฯ) เข้ากับข้อมูลล่าสุดจาก server ให้แล้วและบันทึกสำเร็จ — ไม่ใช่
        // error จริง แค่ต้องโหลด state ฝั่ง client ใหม่ให้ตรงกับที่ merge
        // ไปแล้ว ไม่งั้นรอบ autosave ถัดไปจะส่งค่าเก่าทับซ้ำ (โดยเฉพาะ field
        // ที่ merge ไม่ได้ เช่น roster/photos ที่อีกฝ่ายอาจแก้ไปพร้อมกัน)
        setSaveStatus("saved");
        toast("มีการแก้ไขจากที่อื่นพร้อมกัน — รวมข้อมูลให้อัตโนมัติแล้ว ✅", "success", 5000);
        loadFromStorage().then(loaded => dispatchApp({ type:"LOAD_FROM_STORAGE", payload: loaded }));
        setTimeout(()=>setSaveStatus("idle"), 2000);
      } else {
        console.error("Save failed:", err);
        setSaveStatus("error");
        if (err.isConflict) {
          // ชนกันซ้ำสอง (พยายาม merge อัตโนมัติไปแล้วครั้งนึงใน saveToStorage
          // แต่ก็ยังชนอยู่ดี) — เคสนี้เกิดยากมาก ต้องให้ user จัดการเอง
          toast(err.message, "error", 8000);
        } else {
          toast("บันทึกไม่สำเร็จ กรุณาลองใหม่", "error", 5000);
        }
        setTimeout(()=>setSaveStatus("idle"), 4000);
      }
    } finally {
      savingRef.current = false;
      if (pendingRef.current) {
        pendingRef.current = false;
        runAutosave(); // one more round was requested while we were busy — run it now with latest `app`
      }
    }
  }, [app, toast]);

  useEffect(() => {
    if (!app._loaded) return; // don't save until initial load completes
    const timer = setTimeout(runAutosave, 600); // debounce: wait 600ms after last change before saving
    return () => clearTimeout(timer);
  }, [app, runAutosave]);

  // ── sync HERO_DATA (module-level array) with custom heroes + role overrides ──
  // HERO_DATA is referenced directly (HERO_DATA.filter/.find) in many places
  // throughout the app (draft hero grid, scout form, HeroChip lookups, etc).
  // Rather than thread a "all heroes" value through every one of those call
  // sites, we mutate the shared array in place once data loads/changes —
  // the array reference never changes, only its contents, which keeps all
  // existing .filter()/.find() callers working without modification.
  useEffect(() => {
    if (!app._loaded) return;
    // remove any previously-synced custom heroes, then re-add current ones
    for (let i = HERO_DATA.length - 1; i >= 0; i--) {
      if (HERO_DATA[i]._custom) HERO_DATA.splice(i, 1);
    }
    app.customHeroes.forEach(h => HERO_DATA.push({ ...h, _custom: true }));
    // apply role overrides to every hero (built-in or custom), keeping the
    // original role stashed so an override can be reverted cleanly later
    HERO_DATA.forEach(h => {
      if (h._origRole === undefined) h._origRole = h.role;
      h.role = app.roleOverrides[h.name] || h._origRole;
    });
    setHeroDataVersion(v => v + 1); // force re-render so HeroCard/HeroChip pick up new role/list
  }, [app.customHeroes, app.roleOverrides, app._loaded]);

  // ── derived: allGames flat list ──
  // กรองตาม patch ที่เลือกก่อน — ทุกหน้า (Overview/Rivals/Roster/My Stats)
  // อ่านจาก allGames ตัวนี้ตัวเดียว เลยกรองที่จุดนี้จุดเดียวพอ
  //
  // useMemo ตรงนี้สำคัญ — RovAppInner คือ component ใหญ่สุดที่ re-render
  // แทบทุกครั้งที่ state เปลี่ยนจุดไหนก็ตามในแอป (reducer เดียวคุมทั้งแอป)
  // ถ้าไม่ memo ไว้ การ flatMap ทั้ง matches array นี้จะรันซ้ำทุก re-render
  // แม้ matches จริงๆ จะไม่ได้เปลี่ยนเลยก็ตาม ยิ่งแมตช์เยอะขึ้นเรื่อยๆ ยิ่ง
  // เสียเวลามากขึ้นทุก re-render โดยไม่จำเป็น
  const patchFilteredMatches = useMemo(
    () => filterMatchesByPatch(app.matches, patchVersions, selectedPatch),
    [app.matches, patchVersions, selectedPatch]
  );
  const allGames = useMemo(() => patchFilteredMatches.flatMap(m =>
    Array.isArray(m.games) && m.games.length > 0
      ? m.games.map((g, gi) => ({ ...g, rivalName:m.rivalName, date:m.date, _matchId:m.id, _gameIdx:gi }))
      : [{ ...m, _matchId:m.id, _gameIdx:null }]
  ), [patchFilteredMatches]);

  // ── handlers (wrapped in useCallback for stable refs) ──
  const handleSaveMatch = useCallback((draftResult) => {
    dispatchApp({ type:"SAVE_MATCH", payload: draftResult });
    dispatchUI({ type:"SET_PAGE", payload:"matches" });
    dispatchDraft({ type:"RESET" });
    // ── ไม่ toast "บันทึกสำเร็จ" ตรงนี้ ──
    // จุดนี้แค่ dispatch เข้า local state (React) เท่านั้น ยังไม่ได้เขียนขึ้น
    // server จริง — การ save จริงเกิดที่ autosave effect (runAutosave) แยก
    // ต่างหาก 600ms ถัดจากนี้ ถ้า toast "สำเร็จ" ตรงนี้เลย จะดูขัดแย้งกันเอง
    // ถ้า autosave รอบถัดไปเจอ conflict/error (เห็น toast ผลลัพธ์จริงสอง
    // อันที่ขัดกัน) ให้ toast แค่ว่าบันทึกลงในแอปแล้ว กำลังซิงก์ขึ้นระบบ —
    // ผลจริงจะโชว์ผ่าน saveStatus/toast ของ runAutosave เอง
    toast("เพิ่มแมตช์แล้ว กำลังบันทึกขึ้นระบบ...", "info");
  }, [toast]);

  // ── Export Match Summary PDF (ใช้ browser print) ──
  const handleExportMatchPDF = useCallback((filterCat="all") => {
    const filtered = filterCat==="all" ? app.matches
      : app.matches.filter(m=>(filterCat==="tournament"?m.category==="tournament":(!m.category||m.category==="scrim")));

    const totalG = filtered.reduce((s,m)=>s+(Array.isArray(m.games)?m.games.length:1),0);
    const totalW = filtered.reduce((s,m)=>{
      if(Array.isArray(m.games)) return s+m.games.filter(g=>g.result==="WIN").length;
      return s+(m.result==="WIN"?1:0);
    },0);
    const wr = totalG?Math.round(totalW/totalG*100):0;

    const rows = filtered.map(m=>{
      const games = Array.isArray(m.games)?m.games:[];
      const w = games.filter(g=>g.result==="WIN").length;
      const t = games.length||1;
      return `<tr>
        <td>${m.date||""}</td>
        <td>${m.category==="tournament"?"🏆 แข่ง":"🏋️ ซ้อม"}</td>
        <td><strong>vs ${m.rivalName||""}</strong></td>
        <td>${m.boType||"BO1"}</td>
        <td style="color:${w>t/2?"#00b894":"#fd79a8"};font-weight:700">${games.length>0?`${w}W-${t-w}L`:m.result}</td>
        <td>${m.note||""}</td>
      </tr>`;
    }).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Match Report — ${app.teamName||"RoV Team"}</title>
    <style>
      body{font-family:'Segoe UI',sans-serif;padding:24px;color:#1a1a2e}
      h1{color:#6C5CE7;margin-bottom:4px}
      .meta{color:#666;font-size:13px;margin-bottom:20px}
      .summary{display:flex;gap:20px;margin-bottom:20px}
      .stat{background:#f8f8ff;border-radius:8px;padding:12px 20px;text-align:center}
      .stat .val{font-size:28px;font-weight:900;color:#6C5CE7}
      .stat .lbl{font-size:11px;color:#666}
      table{width:100%;border-collapse:collapse}
      th{background:#6C5CE7;color:#fff;padding:10px 8px;text-align:left;font-size:12px}
      td{padding:8px;border-bottom:1px solid #eee;font-size:12px}
      tr:nth-child(even){background:#f9f9ff}
      @media print{body{padding:10px}}
    </style></head><body>
    <h1>🦅 Match Report — ${app.teamName||"RoV Team"}</h1>
    <div class="meta">สร้างเมื่อ ${new Date().toLocaleDateString("th-TH",{day:"numeric",month:"long",year:"numeric"})}
      · ประเภท: ${filterCat==="all"?"ทั้งหมด":filterCat==="tournament"?"เฉพาะแข่ง":"เฉพาะซ้อม"}</div>
    <div class="summary">
      <div class="stat"><div class="val">${filtered.length}</div><div class="lbl">แมตช์</div></div>
      <div class="stat"><div class="val">${totalG}</div><div class="lbl">เกมทั้งหมด</div></div>
      <div class="stat"><div class="val">${totalW}</div><div class="lbl">ชนะ</div></div>
      <div class="stat"><div class="val">${wr}%</div><div class="lbl">Win Rate</div></div>
    </div>
    <table><thead><tr>
      <th>วันที่</th><th>ประเภท</th><th>คู่แข่ง</th><th>Format</th><th>ผล</th><th>โน้ต</th>
    </tr></thead><tbody>${rows}</tbody></table>
    </body></html>`;

    const w = window.open("","_blank");
    w.document.write(html);
    w.document.close();
    setTimeout(()=>w.print(), 500);
  }, [app.matches, app.teamName]);

  const handleEditMatchMeta = useCallback(({ id, rivalName, category, note }) => {
    dispatchApp({ type:"UPDATE_MATCH_META", payload:{ id, rivalName, category, note } });
    toast("แก้ไขแมตช์สำเร็จ", "success");
  }, [toast]);

  const handleUpdateStats = useCallback((matchId, gameIdx, gameStats) => {
    dispatchApp({ type:"UPDATE_STATS", payload:{ matchId, gameIdx, gameStats } });
  }, []);

  const handleUpdateObjectives = useCallback((matchId, gameIdx, objectives) => {
    dispatchApp({ type:"UPDATE_OBJECTIVES", payload:{ matchId, gameIdx, objectives } });
  }, []);

  const handleUpdateGameFull = useCallback((matchId, gameIdx, updates) => {
    dispatchApp({ type:"UPDATE_GAME_FULL", payload:{ matchId, gameIdx, updates } });
    toast("แก้ไขข้อมูลเกมสำเร็จ ✅", "success");
  }, [toast]);

  const handleJumpToVideo = useCallback((videoId) => {
    dispatchUI({ type:"GOTO_VIDEO", payload: videoId });
  }, []);

  const handleLinkPlayer = useCallback(async (playerName) => {
    try {
      const res = await fetch("/api/user/player-link", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerName }),
      });
      if (!res.ok) throw new Error();
      await updateSession({ playerName }); // รีเฟรช session ทันทีโดยไม่ต้อง login ใหม่
      toast(`ผูกบัญชีกับ "${playerName}" สำเร็จ ✅`, "success");
    } catch {
      toast("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง", "error");
    }
  }, [updateSession, toast]);

  const handleAddPractice = useCallback((payload) => {
    dispatchApp({ type:"ADD_PRACTICE", payload });
    toast("มอบหมายการบ้านสำเร็จ ✅", "success");
  }, [toast]);
  const handleTogglePractice = useCallback((id) => {
    dispatchApp({ type:"TOGGLE_PRACTICE", payload:id });
  }, []);
  const handleDeletePractice = useCallback((id) => {
    dispatchApp({ type:"DELETE_PRACTICE", payload:id });
  }, []);

  const [newPlayerPhoto,      setNewPlayerPhoto]      = useState(null);
  const [newEnemyPlayerPhoto, setNewEnemyPlayerPhoto]  = useState(null);
  const [showAddRival,        setShowAddRival]         = useState(false);
  const [newRivalName,        setNewRivalName]         = useState("");
  const [cropRivalLogo,       setCropRivalLogo]        = useState(null); // { name, file } — modal state for rival logo cropping

  const handleAddPlayer = useCallback(() => {
    const name = ui.newName.trim();
    dispatchApp({ type:"ADD_PLAYER", payload: name });
    if (name && newPlayerPhoto) {
      dispatchApp({ type:"SET_PHOTO", payload:{ key:`our:${name}`, dataUrl:newPlayerPhoto } });
    }
    setNewPlayerPhoto(null);
    dispatchUI({ type:"CLEAR_NEW_NAME" });
  }, [ui.newName, newPlayerPhoto]);

  const handleRemovePlayer = useCallback((name) => {
    if (window.confirm(`ลบ ${name} ออกจากทีม?`))
      dispatchApp({ type:"REMOVE_PLAYER", payload: name });
  }, []);

  const handleAddEnemyPlayer = useCallback((rivalName) => {
    const name = ui.newEnemyName.trim();
    dispatchApp({ type:"ADD_ENEMY_PLAYER", payload:{ rivalName, playerName: name } });
    if (name && newEnemyPlayerPhoto) {
      dispatchApp({ type:"SET_PHOTO", payload:{ key:`enemy:${rivalName}:${name}`, dataUrl:newEnemyPlayerPhoto } });
    }
    setNewEnemyPlayerPhoto(null);
    dispatchUI({ type:"CLEAR_NEW_ENEMY_NAME" });
  }, [ui.newEnemyName, newEnemyPlayerPhoto]);

  const handleRemoveEnemyPlayer = useCallback((rivalName, playerName) => {
    if (window.confirm(`ลบ ${playerName} ออกจาก ${rivalName}?`))
      dispatchApp({ type:"REMOVE_ENEMY_PLAYER", payload:{ rivalName, playerName } });
  }, []);

  // ── draft: finish session ──
  function finishSession(games) {
    if (!games.length) { dispatchDraft({ type:"RESET" }); return; }
    handleSaveMatch({ rivalName:draft.rivalName, boType:draft.boType, category:draft.category, patch:draft.patch, games, ourSide:games[0].ourSide });
  }

  // ── overview stats ──
  const tG = allGames.length, tW = allGames.filter(g=>g.result==="WIN").length;
  const wr = tG ? Math.round(tW/tG*100) : 0;
  const gamesWithDuration = allGames.filter(g=>g.duration);
  // หัก pauseDuration ออกก่อนคำนวณ — เวลาที่จดไว้รวมช่วงที่เกมหยุด (ผู้เล่น/
  // คนดูขอหยุด) ด้วย ถ้าไม่หักออก ค่าเฉลี่ยจะสูงกว่าเวลาเล่นจริง
  const effectiveDuration = g => Math.max(0, durationToMinutes(g.duration) - (g.pauseDuration ? durationToMinutes(g.pauseDuration) : 0));
  const avgGameDuration = gamesWithDuration.length
    ? minutesToDurationStr(gamesWithDuration.reduce((s,g)=>s+effectiveDuration(g),0) / gamesWithDuration.length)
    : null;
  const uniq = new Set();
  allGames.forEach(g=>(g.ourPicks||[]).forEach(s=>{if(s.hero?.name)uniq.add(s.hero.name);}));
  const banCounts = {};
  allGames.forEach(g=>(g.ourBans||[]).forEach(h=>{if(h?.name)banCounts[h.name]=(banCounts[h.name]||0)+1;}));
  const top10 = Object.entries(banCounts).sort((a,b)=>b[1]-a[1]).slice(0,10);
  const heroSt = {};
  allGames.forEach(g=>{
    const w = g.result==="WIN";
    (g.ourPicks||[]).forEach(s=>{ if(s.hero?.name){
      if(!heroSt[s.hero.name]) heroSt[s.hero.name]={picks:0,wins:0};
      heroSt[s.hero.name].picks++;
      if(w) heroSt[s.hero.name].wins++;
    }});
  });
  const heroArr = Object.entries(heroSt)
    .map(([h,s])=>({hero:h,picks:s.picks,wr:Math.round(s.wins/s.picks*100)}))
    .sort((a,b)=>b.picks-a.picks);

  // ── Objective control aggregate ──
  const gamesWithObj = allGames.filter(g=>g.objectives);
  const objSummary = (() => {
    let fbOur=0, fbEnemy=0, ftOur=0, ftEnemy=0, turOur=0, turEnemy=0;
    let abyOur=0, abyEnemy=0, darkOur=0, darkEnemy=0, gsOur=0, gsEnemy=0;
    let winsWithFT=0, gamesWithFT=0;
    let winsWithGSEdge=0, gamesWithGSEdge=0;
    gamesWithObj.forEach(g=>{
      const o=g.objectives;
      if(o.firstBlood==="our") fbOur++; else if(o.firstBlood==="enemy") fbEnemy++;
      if(o.firstTower==="our") { ftOur++; gamesWithFT++; if(g.result==="WIN") winsWithFT++; }
      else if(o.firstTower==="enemy") { ftEnemy++; gamesWithFT++; }
      abyOur   += Number(o.ourAbyssal||0);   abyEnemy   += Number(o.enemyAbyssal||0);
      darkOur  += Number(o.ourDark||0);      darkEnemy  += Number(o.enemyDark||0);
      gsOur    += Number(o.ourGodslayer||0); gsEnemy    += Number(o.enemyGodslayer||0);
      turOur   += Number(o.ourTurrets||0);   turEnemy   += Number(o.enemyTurrets||0);
      // Godslayer มักเป็นตัวชี้ผลเกมช่วงท้าย เลยใช้เป็น "objective edge" หลักแทน dragon รวมแบบเดิม
      if(Number(o.ourGodslayer||0) > Number(o.enemyGodslayer||0)) {
        gamesWithGSEdge++; if(g.result==="WIN") winsWithGSEdge++;
      }
    });
    return {
      total: gamesWithObj.length,
      fbOur, fbEnemy,
      ftOur, ftEnemy,
      ftWinRate: gamesWithFT ? Math.round(winsWithFT/gamesWithFT*100) : null,
      abyOur, abyEnemy, darkOur, darkEnemy, gsOur, gsEnemy,
      turOur, turEnemy,
      gsEdgeWinRate: gamesWithGSEdge ? Math.round(winsWithGSEdge/gamesWithGSEdge*100) : null,
    };
  })();

  const NAV = [
    {id:"overview",icon:"📊",label:"Overview"},
    {id:"mystats", icon:"👤",label:"My Stats"},
    {id:"practice",icon:"🏋️",label:"Practice"},
    {id:"analytics",icon:"📈",label:"Analytics"},
    {id:"draft",   icon:"⚔️",label:"Live Draft", coachOnly:true},
    {id:"matches", icon:"📋",label:"Match Log"},
    {id:"rivals",  icon:"🎯",label:"Rivals"},
    {id:"roster",  icon:"👥",label:"Roster"},
    {id:"schedule",icon:"📅",label:"ตารางแข่ง"},
    {id:"notes",   icon:"📝",label:"Notes"},
    {id:"video",   icon:"🎬",label:"Video"},
    {id:"board",   icon:"🗺️",label:"Whiteboard"},
    {id:"heroimg", icon:"🦸",label:"Hero Images"},
    {id:"admin",   icon:"⚙️",label:"Admin",    adminOnly:true},
  ];

  // ── short aliases for readability ──
  const { page, selRival, rivalView, rosterTab, selPlayer, selPlayerEnemy,
          selEnemyTeam, newName, newEnemyName } = ui;
  const { matches, rivals, roster, enemyRosters, scoutMatches } = app;

  // ── loading screen until Database hydration completes ──
  if (!app._loaded) {
    return (
      <div style={{minHeight:"100vh",background:C.bgBase,color:C.textMain,
        display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
        gap:14,fontFamily:"'Segoe UI',sans-serif"}}>
        <div style={{fontSize:36}}>🦅</div>
        <div style={{fontSize:14,color:C.textMuted}}>กำลังโหลดข้อมูล...</div>
        <div style={{width:120,height:3,background:C.bgPanel,borderRadius:99,overflow:"hidden"}}>
          <div style={{width:"40%",height:"100%",background:C.primary,borderRadius:99,
            animation:"loadbar 1.1s ease-in-out infinite"}}/>
        </div>
        <style>{`@keyframes loadbar{0%{margin-left:-40%}50%{margin-left:60%}100%{margin-left:140%}}`}</style>
      </div>
    );
  }

  // ── No team at all (removed by admin, or never finished joining) ──
  // Unlike `pending` (still shows the app shell with a banner — that was a
  // deliberate earlier choice), this blocks the whole app: someone with no
  // teamId has nothing to show menus/nav for, and letting them into an
  // empty-looking shell is what caused the confusing "บันทึกไม่สำเร็จ" toast
  // spam before (autosave kept trying and failing every 600ms with no
  // explanation). Full-screen modal instead, with a way to fix it inline.
  if (app.noTeam) {
    return <NoTeamScreen/>;
  }

  return (
    <HeroPhotosContext.Provider value={app.heroPhotos || {}}>
    <div style={{minHeight:"100vh",background:C.bgBase,color:C.textMain,fontFamily:"'Segoe UI',sans-serif"}}>

      {/* NAV */}
      <div style={{background:"linear-gradient(90deg,#12072a,#0a0a16)",borderBottom:`1px solid ${C.border}`,
        padding:isMobile?"0 12px":"0 20px",display:"flex",alignItems:"center",height:56,position:"sticky",top:0,zIndex:200}}>
        <span style={{fontSize:20,marginRight:8,flexShrink:0}}>🦅</span>
        <span style={{fontWeight:900,fontSize:isMobile?13:17,letterSpacing:isMobile?0.5:1,color:C.primaryLight}}>
          {session?.user?.teamName || app.teamName || "ทีมของฉัน"}
        </span>
        {/* save status indicator */}
        <span style={{marginLeft:isMobile?8:12,fontSize:isMobile?14:11,color:
          saveStatus==="saving"?C.primaryLight:saveStatus==="saved"?"#00b894":saveStatus==="error"?"#ff4757":C.textMuted,
          display:"flex",alignItems:"center",gap:4,transition:"opacity .3s",flexShrink:0,
          opacity:saveStatus==="idle"?0.4:1}}>
          {isMobile ? (
            saveStatus==="saving"?"☁️":saveStatus==="saved"?"✅":saveStatus==="error"?"❌":"☁️"
          ) : (
            <>
              {saveStatus==="saving" && <>☁️ กำลังบันทึก...</>}
              {saveStatus==="saved"  && <>✅ บันทึกแล้ว</>}
              {saveStatus==="idle"   && <>☁️ ซิงค์แล้ว</>}
              {saveStatus==="error"  && <>❌ บันทึกไม่สำเร็จ</>}
            </>
          )}
        </span>
        <div style={{marginLeft:isMobile?8:14,flexShrink:0}}>
          <PatchSelector versions={patchVersions} value={selectedPatch} onChange={setSelectedPatch} />
        </div>
        <div style={{flex:1}}/>

        {/* เมนู ☰ เดียวกันทุกขนาดจอ — กันเมนูล้น/ตกบรรทัดไม่สวยเมื่อเพิ่มเมนูใหม่ในอนาคต */}
        <button onClick={()=>setShowMobileMenu(v=>!v)}
          style={{background:showMobileMenu?C.primary+"30":"transparent",
            border:`1px solid ${showMobileMenu?C.primary:C.border}`,
            color:showMobileMenu?C.primaryLight:C.textMain,borderRadius:8,
            padding:isMobile?"8px 12px":"8px 16px",cursor:"pointer",fontSize:isMobile?16:14,fontWeight:700,
            minWidth:44,minHeight:44,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          {showMobileMenu ? "✕" : "☰"}{!isMobile && <span>{showMobileMenu?"ปิดเมนู":"เมนู"}</span>}
        </button>
      </div>

      {/* ── เมนูแบบ dropdown เดียวกันทุกขนาดจอ (grid ยืดตามความกว้างจอ) ── */}
      {showMobileMenu && (
        <div style={{position:"sticky",top:56,zIndex:199,background:"#0d0a1e",
          borderBottom:`1px solid ${C.border}`,padding:isMobile?"10px 12px":"16px 20px",
          maxHeight:"calc(100vh - 56px)",overflowY:"auto"}}>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(170px,1fr))",gap:6}}>
            {NAV.filter(n=>(!n.coachOnly || isCoach) && (!n.adminOnly || isAdmin)).map(n=>(
              <button key={n.id}
                onClick={()=>{dispatchUI({type:"SET_PAGE",payload:n.id});setShowMobileMenu(false);}}
                style={{background:page===n.id?C.primary+"30":"transparent",
                  border:page===n.id?`1px solid ${C.primary}60`:"1px solid transparent",
                  color:page===n.id?C.primaryLight:C.textMain,textAlign:"left",
                  padding:"12px 14px",cursor:"pointer",fontSize:isMobile?15:14,minHeight:44,
                  fontWeight:page===n.id?700:400,borderRadius:9}}>
                {n.icon} {n.label}
              </button>
            ))}
          </div>
          {session?.user && (
            <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.border}`,
              display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
              {app.teamLogo && (
                <LogoImg url={app.teamLogo} name={app.teamName||"ทีมเรา"} size={32}
                  style={{border:`2px solid ${C.primary}40`}}/>
              )}
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,color:C.textMain,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                  {session.user.name || session.user.email}
                </div>
                <span style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:99,
                  background: isAdmin?"#f9ca24"+"30":isCoach?C.primary+"30":C.border+"30",
                  color:       isAdmin?"#f9ca24"  :isCoach?C.primaryLight:C.textMuted}}>
                  {isAdmin?"👑 Admin":isCoach?"🎓 Coach":"👤 Member"}
                </span>
              </div>
              <button onClick={()=>signOut({ callbackUrl: "/login" })}
                style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textMuted,
                  borderRadius:7,padding:"8px 14px",cursor:"pointer",fontSize:12,fontWeight:600,minHeight:40}}>
                ออกจากระบบ
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── PENDING APPROVAL BANNER — คนเข้าทีมผ่าน invite code ที่ยังไม่ได้รับอนุมัติ ── */}
      {app.pending && (
        <div style={{margin:"10px 16px",background:C.primary+"15",border:`1px solid ${C.primary}50`,
          borderRadius:10,padding:"12px 16px",display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:18}}>⏳</span>
          <div>
            <div style={{fontWeight:800,fontSize:13,color:C.primaryLight}}>
              รอ Admin ของทีม{session?.user?.teamName?` "${session.user.teamName}"`:""}อนุมัติ
            </div>
            <div style={{fontSize:11,color:C.textMuted,marginTop:2}}>
              บัญชีของคุณเข้าร่วมทีมสำเร็จแล้ว แต่ต้องรอ Admin กดอนุมัติก่อน ถึงจะเห็นข้อมูลทีมได้
            </div>
          </div>
        </div>
      )}

      {/* ── SCHEDULE REMINDER — เตือนนัดซ้อม/แข่งที่ใกล้ถึง เห็นได้ทุกหน้า ── */}
      <ScheduleReminder schedules={app.schedules}/>

      {/* ── MY STATS PAGE ── */}
      {page==="mystats" && (
        <MyStatsPage
          session={session}
          roster={roster}
          allGames={allGames}
          playerPhotos={app.playerPhotos}
          onLinkPlayer={handleLinkPlayer}
        />
      )}

      {/* ── PRACTICE ASSIGNMENT PAGE ── */}
      {page==="practice" && (
        <PracticePage
          session={session}
          roster={roster}
          playerPhotos={app.playerPhotos}
          assignments={app.practiceAssignments}
          isCoach={isCoach}
          onAdd={handleAddPractice}
          onToggle={handleTogglePractice}
          onDelete={handleDeletePractice}
        />
      )}

      {/* ── ANALYTICS PAGE ── */}
      {page==="analytics" && (
        <AnalyticsPage rivals={rivals} roster={roster} isAdmin={isAdmin}/>
      )}

      {/* ── DRAFT PAGE ── */}
      {page==="draft" && (
        <DraftPageR
          draft={draft}
          dispatch={dispatchDraft}
          roster={roster}
          rivals={rivals}
          enemyRosters={enemyRosters}
          onFinishSession={finishSession}
          allGames={allGames}
          scoutMatches={scoutMatches}
          heroTiers={app.heroTiers}
        />
      )}

      {/* ── WHITEBOARD PAGE (full-screen, no padding) ── */}
      {page==="board" && <TacticalWhiteboard
        initialElements={app.whiteboardElements}
        initialFormations={app.whiteboardFormations}
        initialMapUrl={app.whiteboardMapUrl}
        onSetElements={els=>dispatchApp({type:"SET_WHITEBOARD_ELEMENTS",payload:els})}
        onSetMapUrl={url=>dispatchApp({type:"SET_WHITEBOARD_MAP",payload:url})}
        onAddFormation={f=>dispatchApp({type:"ADD_WHITEBOARD_FORMATION",payload:f})}
        onDeleteFormation={id=>dispatchApp({type:"DELETE_WHITEBOARD_FORMATION",payload:id})}
      />}
      {page==="schedule" && (
        <div style={{padding:"16px 28px 0",maxWidth:1300,margin:"0 auto"}}>
          <GoogleCalendarConnect/>
        </div>
      )}
      {page==="schedule" && <SchedulePage
        schedules={app.schedules||[]}
        rivals={app.rivals||[]}
        matches={app.matches||[]}
        isCoach={isCoach}
        onAdd={p=>dispatchApp({type:"ADD_SCHEDULE",payload:p})}
        onUpdate={p=>dispatchApp({type:"UPDATE_SCHEDULE",payload:p})}
        onDelete={id=>dispatchApp({type:"DELETE_SCHEDULE",payload:id})}
      />}
      {page==="admin" && isAdmin && <AdminPanel session={session}/>}

      {page!=="draft" && page!=="board" && (
        <div style={{padding:28,maxWidth:1300,margin:"0 auto"}}>

          {/* ═══ OVERVIEW ═══ */}
          {page==="overview" && (
            <div>
              <h2 style={{margin:"0 0 6px",fontSize:24,fontWeight:800}}>📊 Team Overview</h2>
              <p style={{margin:"0 0 12px",color:C.textMuted,fontSize:13}}>สรุปภาพรวมสถิติการซ้อมทั้งหมด</p>
              <PatchMetaCard
                patchInfo={app.patchInfo}
                heroTiers={app.heroTiers}
                onSavePatch={info=>dispatchApp({type:"SET_PATCH_INFO",payload:info})}
                onSetTier={(hero,tier)=>dispatchApp({type:"SET_HERO_TIER",payload:{hero,tier}})}
                isCoach={isCoach}
              />
              <WeeklyMonthlySummary matches={app.matches}/>
              <RecentActivityWidget/>
              {/* ── Upcoming match reminder ── */}
              {(()=>{
                const now = new Date();
                const upcoming = (app.schedules||[])
                  .filter(s=>new Date(s.date+"T"+(s.time||"00:00"))>=now)
                  .slice(0,3);
                if (!upcoming.length) return null;
                return (
                  <div style={{background:"#f9ca24"+"15",border:"1px solid #f9ca24"+"40",
                    borderRadius:12,padding:"12px 16px",marginBottom:20}}>
                    <div style={{fontWeight:800,fontSize:12,color:"#f9ca24",marginBottom:10}}>
                      📅 ตารางแข่งที่กำลังจะมา
                    </div>
                    {upcoming.map(s=>{
                      const d = new Date(s.date+"T"+(s.time||"00:00"));
                      const diff = Math.ceil((d-now)/(1000*60*60*24));
                      const dateStr = d.toLocaleDateString("th-TH",{weekday:"short",day:"numeric",month:"short"});
                      const timeStr = s.time ? d.toLocaleTimeString("th-TH",{hour:"2-digit",minute:"2-digit"}) : "";
                      return (
                        <div key={s.id} style={{display:"flex",justifyContent:"space-between",
                          alignItems:"center",marginBottom:6,lastChild:{marginBottom:0}}}>
                          <div style={{fontSize:13,fontWeight:700}}>
                            ⚔️ vs <span style={{color:C.primaryLight}}>{s.rival}</span>
                            {s.tournament&&<span style={{fontSize:11,color:C.textMuted,marginLeft:8}}>({s.tournament})</span>}
                          </div>
                          <div style={{fontSize:11,color:C.textMuted,textAlign:"right"}}>
                            <span style={{color:diff<=1?"#d63031":diff<=3?C.win:C.textMuted,fontWeight:700}}>
                              {diff===0?"วันนี้! 🔥":diff===1?"พรุ่งนี้ ⚡":`อีก ${diff} วัน`}
                            </span>
                            {" · "}{dateStr}{timeStr&&` ${timeStr}`}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
              {(()=>{
                const blueG=allGames.filter(g=>g.ourSide==="blue");
                const redG =allGames.filter(g=>g.ourSide==="red");
                const blueW=blueG.filter(g=>g.result==="WIN").length;
                const redW =redG.filter(g=>g.result==="WIN").length;
                const blueWR=blueG.length?Math.round(blueW/blueG.length*100):0;
                const redWR =redG.length ?Math.round(redW/redG.length*100):0;
                return (
                  <>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(90px,1fr))",gap:14,marginBottom:16}}>
                      {[
                        {label:"🏆 Win Rate",   val:`${wr}%`,     col:wr>=50?C.win:C.lose, sub:`${tW}W — ${tG-tW}L`},
                        {label:"🎮 เกมทั้งหมด", val:tG,           col:C.primaryLight,       sub:`${matches.length} sessions`},
                        {label:"🦸 Heroes Used",val:uniq.size,    col:"#feca57",            sub:"ตัวละครไม่ซ้ำ"},
                        {label:"⏱️ เวลาเฉลี่ย/เกม",val:avgGameDuration?avgGameDuration.replace(".",":"):"-", col:"#1dd1a1", sub:avgGameDuration?`จาก ${gamesWithDuration.length} เกมที่จดเวลาไว้`:"ยังไม่มีข้อมูลเวลา"},
                        {label:"🔵 Blue Side",  val:`${blueWR}%`, col:C.blue,              sub:`${blueG.length} เกม (${blueW}W)`},
                        {label:"🔴 Red Side",   val:`${redWR}%`,  col:C.red,               sub:`${redG.length} เกม (${redW}W)`},
                      ].map(c=>(
                        <div key={c.label} style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:14,padding:18}}>
                          <div style={{fontSize:11,color:C.textMuted,fontWeight:700,marginBottom:8}}>{c.label}</div>
                          <div style={{fontSize:32,fontWeight:800,color:c.col,lineHeight:1}}>{c.val}</div>
                          <div style={{marginTop:8,fontSize:12,color:C.textMuted}}>{c.sub}</div>
                        </div>
                      ))}
                    </div>
                    {tG>0&&(
                      <div style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:12,
                        padding:"12px 18px",marginBottom:18}}>
                        <div style={{fontSize:11,color:C.textMuted,fontWeight:700,marginBottom:8}}>
                          สัดส่วนการเลือกฝั่ง ({tG} เกม)
                        </div>
                        <div style={{display:"flex",height:16,borderRadius:99,overflow:"hidden",gap:2}}>
                          {blueG.length>0&&<div style={{flex:blueG.length,background:C.blue,display:"flex",
                            alignItems:"center",justifyContent:"center",fontSize:10,color:"#fff",fontWeight:700}}>
                            {Math.round(blueG.length/tG*100)}%
                          </div>}
                          {redG.length>0&&<div style={{flex:redG.length,background:C.red,display:"flex",
                            alignItems:"center",justifyContent:"center",fontSize:10,color:"#fff",fontWeight:700}}>
                            {Math.round(redG.length/tG*100)}%
                          </div>}
                        </div>
                        <div style={{display:"flex",gap:20,marginTop:6}}>
                          <span style={{fontSize:11,color:C.blue,fontWeight:700}}>🔵 Blue {blueG.length} เกม</span>
                          <span style={{fontSize:11,color:C.red,fontWeight:700}}>🔴 Red {redG.length} เกม</span>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
              <div style={{display:"grid",gridTemplateColumns:"280px 1fr",gap:20}}>
                <div style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:14,padding:18}}>
                  <div style={{fontWeight:700,fontSize:14,color:C.ban,marginBottom:14}}>🚫 Top 10 Hero ที่แบน</div>
                  {top10.length===0
                    ?<div style={{color:C.textMuted,fontSize:13,textAlign:"center",padding:"20px 0"}}>ยังไม่มีข้อมูล</div>
                    :top10.map(([hero,cnt],i)=>(
                      <div key={hero} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                        background:C.bgCard,padding:"9px 12px",borderRadius:8,marginBottom:6}}>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <span style={{color:C.textMuted,fontSize:11,width:16}}>#{i+1}</span>
                          <span style={{fontWeight:700}}>{hero}</span>
                        </div>
                        <span style={{fontSize:12,color:C.ban,fontWeight:700,background:C.ban+"20",padding:"2px 8px",borderRadius:4}}>
                          {cnt}x
                        </span>
                      </div>
                    ))
                  }
                </div>
                <div style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:14,padding:18,overflowX:"auto"}}>
                  <div style={{fontWeight:700,fontSize:14,color:C.primaryLight,marginBottom:14}}>📋 Hero Stats</div>
                  {heroArr.length===0
                    ?<div style={{color:C.textMuted,textAlign:"center",padding:"40px 0"}}>ยังไม่มีข้อมูล</div>
                    :<table style={{width:"100%",borderCollapse:"collapse"}}>
                      <thead>
                        <tr style={{borderBottom:`2px solid ${C.border}`,color:C.textMuted,fontSize:11}}>
                          <th style={{padding:"10px 8px",textAlign:"left"}}>Hero</th>
                          <th style={{padding:"10px 8px",textAlign:"center"}}>Picks</th>
                          <th style={{padding:"10px 8px",textAlign:"center"}}>Win Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {heroArr.map((s,i)=>(
                          <tr key={s.hero} style={{borderBottom:`1px solid ${C.border}`,background:i%2?"transparent":C.bgCard}}>
                            <td style={{padding:8}}><HeroChip name={s.hero} size={32}/></td>
                            <td style={{padding:8,textAlign:"center",fontWeight:800,color:C.primaryLight}}>{s.picks}</td>
                            <td style={{padding:8,textAlign:"center"}}>
                              <span style={{display:"inline-block",padding:"3px 10px",borderRadius:6,fontWeight:700,fontSize:12,
                                background:s.wr>=50?C.win+"20":C.lose+"20",color:s.wr>=50?C.win:C.lose}}>{s.wr}%</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  }
                </div>
              </div>
              <HeroSynergyCounter allGames={allGames} scoutMatches={scoutMatches}/>
              <PerformanceTrend allGames={allGames}/>

              {/* ── Objective Control Summary ── */}
              {objSummary.total > 0 && (
                <div style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:14,padding:18,marginBottom:16}}>
                  <div style={{fontWeight:800,fontSize:14,color:C.primaryLight,marginBottom:4}}>
                    🐉 Objective Control
                  </div>
                  <div style={{fontSize:11,color:C.textMuted,marginBottom:14}}>
                    จาก {objSummary.total} เกมที่กรอกข้อมูล Objective ไว้
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))",gap:12}}>
                    {[
                      {icon:"🩸",label:"First Blood",our:objSummary.fbOur,enemy:objSummary.fbEnemy},
                      {icon:"🏯",label:"First Tower",our:objSummary.ftOur,enemy:objSummary.ftEnemy},
                      {icon:"🐉",label:"Abyssal",our:objSummary.abyOur,enemy:objSummary.abyEnemy},
                      {icon:"⚫",label:"Dark",our:objSummary.darkOur,enemy:objSummary.darkEnemy},
                      {icon:"👑",label:"Godslayer",our:objSummary.gsOur,enemy:objSummary.gsEnemy},
                      {icon:"🏰",label:"Turret พัง",our:objSummary.turOur,enemy:objSummary.turEnemy},
                    ].map(c=>(
                      <div key={c.label} style={{background:C.bgCard,borderRadius:10,padding:"12px 10px",textAlign:"center"}}>
                        <div style={{fontSize:10,color:C.textMuted,marginBottom:6}}>{c.icon} {c.label}</div>
                        <div style={{fontSize:18,fontWeight:800}}>
                          <span style={{color:C.win}}>{c.our}</span>
                          <span style={{color:C.textMuted,fontSize:13}}> : </span>
                          <span style={{color:C.lose}}>{c.enemy}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{display:"flex",gap:12,marginTop:14,flexWrap:"wrap"}}>
                    {objSummary.ftWinRate!==null && (
                      <div style={{background:C.primary+"12",borderRadius:8,padding:"8px 14px",fontSize:12,
                        color:C.primaryLight,borderLeft:`3px solid ${C.primary}`}}>
                        💡 เกมที่เราได้ First Tower ก่อน → ชนะ <b>{objSummary.ftWinRate}%</b>
                      </div>
                    )}
                    {objSummary.gsEdgeWinRate!==null && (
                      <div style={{background:C.primary+"12",borderRadius:8,padding:"8px 14px",fontSize:12,
                        color:C.primaryLight,borderLeft:`3px solid ${C.primary}`}}>
                        💡 เกมที่เราคุม Godslayer ได้มากกว่า → ชนะ <b>{objSummary.gsEdgeWinRate}%</b>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Ban/Pick Rate Panel ── */}
              {(()=>{
                // คำนวณ ban/pick rate เปรียบเทียบ ทีมเรา vs คู่แข่ง
                const ourPickRate  = {};
                const ourBanRate   = {};
                const enemyPickRate = {};
                const enemyBanRate  = {};
                const total = allGames.length || 1;

                allGames.forEach(g => {
                  (g.ourPicks||[]).forEach(s => {
                    if(s.hero?.name){ ourPickRate[s.hero.name] = (ourPickRate[s.hero.name]||0)+1; }
                  });
                  (g.ourBans||[]).forEach(h => {
                    if(h?.name){ ourBanRate[h.name] = (ourBanRate[h.name]||0)+1; }
                  });
                  (g.enemyPicks||[]).forEach(s => {
                    if(s.hero?.name){ enemyPickRate[s.hero.name] = (enemyPickRate[s.hero.name]||0)+1; }
                  });
                  (g.enemyBans||[]).forEach(h => {
                    if(h?.name){ enemyBanRate[h.name] = (enemyBanRate[h.name]||0)+1; }
                  });
                });

                const topOurPick   = Object.entries(ourPickRate).sort((a,b)=>b[1]-a[1]).slice(0,8);
                const topOurBan    = Object.entries(ourBanRate).sort((a,b)=>b[1]-a[1]).slice(0,8);
                const topEnemyPick = Object.entries(enemyPickRate).sort((a,b)=>b[1]-a[1]).slice(0,8);
                const topEnemyBan  = Object.entries(enemyBanRate).sort((a,b)=>b[1]-a[1]).slice(0,8);

                const BarRow = ({name,count,max,color}) => (
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                    <div style={{width:100,fontSize:11,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</div>
                    <div style={{flex:1,background:C.bgBase,borderRadius:4,height:14,overflow:"hidden"}}>
                      <div style={{width:`${Math.round(count/max*100)}%`,background:color,height:"100%",borderRadius:4,
                        minWidth:4,transition:"width .3s"}}/>
                    </div>
                    <div style={{fontSize:11,color:C.textMuted,width:50,textAlign:"right"}}>
                      {count}x ({Math.round(count/total*100)}%)
                    </div>
                  </div>
                );

                if (allGames.length === 0) return null;
                return (
                  <div style={{marginTop:20,background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:14,padding:18}}>
                    <div style={{fontWeight:800,fontSize:15,color:C.primaryLight,marginBottom:16}}>
                      📈 Ban/Pick Rate Analysis
                      <span style={{fontSize:11,fontWeight:400,color:C.textMuted,marginLeft:8}}>จาก {total} เกม</span>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
                      {[
                        {title:"🤝 เราเลือก (Pick)",  data:topOurPick,   color:C.win},
                        {title:"🚫 เราแบน (Ban)",    data:topOurBan,    color:C.ban||"#e17055"},
                        {title:"⚔️ ศัตรูเลือก (Pick)", data:topEnemyPick, color:"#fdcb6e"},
                        {title:"🛡️ ศัตรูแบน (Ban)",   data:topEnemyBan,  color:C.lose},
                      ].map(({title,data,color})=>(
                        <div key={title}>
                          <div style={{fontSize:12,fontWeight:700,color,marginBottom:10}}>{title}</div>
                          {data.length===0
                            ?<div style={{fontSize:11,color:C.textMuted}}>ยังไม่มีข้อมูล</div>
                            :data.map(([name,cnt])=>(
                              <BarRow key={name} name={name} count={cnt} max={data[0][1]} color={color}/>
                            ))
                          }
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ═══ MATCH LOG ═══ */}
          {page==="matches" && (
            <div>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:6,flexWrap:"wrap",gap:10}}>
                <h2 style={{margin:0,fontSize:24,fontWeight:800}}>📋 Match Log</h2>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  {/* Export PDF */}
                  <button onClick={()=>handleExportMatchPDF(ui.matchCatFilter||"all")}
                    style={{background:"#d63031"+"20",border:"1px solid #d63031"+"50",
                      color:"#d63031",borderRadius:9,padding:"7px 14px",
                      cursor:"pointer",fontWeight:700,fontSize:12,whiteSpace:"nowrap"}}>
                    📄 Export PDF
                  </button>
                  {/* Import JSON */}
                  <label style={{display:"flex",alignItems:"center",gap:6,
                    background:C.primary+"20",border:`1px solid ${C.primary}50`,
                    color:C.primaryLight,borderRadius:9,padding:"7px 16px",
                    cursor:"pointer",fontWeight:700,fontSize:12,whiteSpace:"nowrap"}}>
                    📂 Import JSON
                    <input type="file" accept=".json" style={{display:"none"}}
                      onChange={e=>{
                        const file = e.target.files?.[0];
                        if (!file) return;
                        importJSON(file, app, (merged, added) => {
                          if (window.confirm(
                            `พบข้อมูลใหม่:\n• Match: +${added.matches}\n• Rivals: +${added.rivals}\n• Scout: +${added.scoutMatches}\n\nMerge เข้าข้อมูลเดิมไหม?`
                          )) {
                            dispatchApp({type:"MERGE_STATE", payload: merged});
                          }
                        });
                        e.target.value = "";
                      }}/>
                  </label>
                  {/* Export JSON */}
                  <button onClick={()=>exportJSON(app)}
                    style={{display:"flex",alignItems:"center",gap:6,
                      background:C.primary+"20",border:`1px solid ${C.primary}50`,
                      color:C.primaryLight,borderRadius:9,padding:"7px 16px",
                      cursor:"pointer",fontWeight:700,fontSize:12,whiteSpace:"nowrap"}}>
                    💾 Backup JSON
                  </button>
                  {matches.length>0&&(
                    <button onClick={()=>exportCSV(matches, allGames)}
                      style={{display:"flex",alignItems:"center",gap:6,
                        background:C.win+"20",border:`1px solid ${C.win}50`,
                        color:C.win,borderRadius:9,padding:"7px 16px",
                        cursor:"pointer",fontWeight:700,fontSize:12,whiteSpace:"nowrap"}}>
                      ⬇️ Export CSV
                    </button>
                  )}
                </div>
              </div>
              <p style={{margin:"0 0 12px",color:C.textMuted,fontSize:13}}>
                คลิกที่แมตช์เพื่อดูรายละเอียด · กด <b style={{color:C.win}}>📊 Stats ทั้งทีม</b> เพื่อกรอก KDA/Damage/DmgTaken/Gold
              </p>
              {/* ── Filter tabs ── */}
              {(() => {
                const matchCatFilter = ui.matchCatFilter||"all";
                const matchPatchFilter = ui.matchPatchFilter||"all";
                // รวม patch ทั้งหมด
                const patches = [...new Set(matches.filter(m=>m.patch).map(m=>m.patch))].sort().reverse();
                const tabs = [
                  {id:"all",        label:"ทั้งหมด",  count: matches.length},
                  {id:"scrim",      label:"🏋️ ซ้อม",  count: matches.filter(m=>!m.category||m.category==="scrim").length},
                  {id:"tournament", label:"🏆 แข่ง",   count: matches.filter(m=>m.category==="tournament").length},
                ];
                let filtered = matchCatFilter==="all" ? matches
                  : matchCatFilter==="tournament" ? matches.filter(m=>m.category==="tournament")
                  : matches.filter(m=>!m.category||m.category==="scrim");
                if (matchPatchFilter!=="all") filtered = filtered.filter(m=>m.patch===matchPatchFilter);
                return (
                  <>
                    <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap",alignItems:"center"}}>
                      {tabs.map(t=>(
                        <button key={t.id} onClick={()=>dispatchUI({type:"SET_MATCH_CAT_FILTER",payload:t.id})}
                          style={{background:matchCatFilter===t.id?C.primary+"30":"transparent",
                            border:`2px solid ${matchCatFilter===t.id?C.primary:C.border}`,
                            color:matchCatFilter===t.id?C.primaryLight:C.textMuted,
                            borderRadius:99,padding:"6px 16px",cursor:"pointer",
                            fontWeight:700,fontSize:12}}>
                          {t.label} <span style={{opacity:0.6,fontWeight:400}}>({t.count})</span>
                        </button>
                      ))}
                      {patches.length>0&&(
                        <select value={matchPatchFilter}
                          onChange={e=>dispatchUI({type:"SET_MATCH_PATCH_FILTER",payload:e.target.value})}
                          style={{background:"#1a1535",border:`1px solid ${C.border}`,
                            color:C.textMain,borderRadius:8,padding:"5px 10px",
                            fontSize:12,cursor:"pointer",marginLeft:4}}>
                          <option value="all">🗂️ ทุก Patch</option>
                          {patches.map(p=><option key={p} value={p}>🗂️ {p}</option>)}
                        </select>
                      )}
                    </div>
                    {filtered.length===0
                      ?<div style={{textAlign:"center",padding:60,background:C.bgPanel,borderRadius:14,color:C.textMuted}}>
                          {matches.length===0
                            ? "ยังไม่มีประวัติ — บันทึกแมตช์จาก Live Draft ก่อน"
                            : `ยังไม่มีแมตช์ประเภท "${tabs.find(t=>t.id===matchCatFilter)?.label}"`}
                        </div>
                      :filtered.map(m=>(
                          <MatchCardWithStats key={m.id} m={m} onUpdateStats={handleUpdateStats} onUpdateObjectives={handleUpdateObjectives} onUpdateGameFull={handleUpdateGameFull} onJumpToVideo={handleJumpToVideo} roster={roster} enemyRoster={app.enemyRosters?.[m.rivalName]||[]} videos={app.videos||[]} playerPhotos={app.playerPhotos} ourTeamName={session?.user?.teamName||app.teamName||"ทีมเรา"} ourTeamLogo={app.teamLogo} rivalLogo={app.rivalLogos?.[m.rivalName]} onDelete={id=>dispatchApp({type:"DELETE_MATCH",payload:id})} onEditMeta={handleEditMatchMeta}/>
                        ))
                    }
                  </>
                );
              })()}
            </div>
          )}

          {/* ═══ RIVALS ═══ */}
          {page==="rivals" && (
            <div>
              {cropRivalLogo && (
                <ImageCropModal file={cropRivalLogo.file} title={`ปรับโลโก้ ${cropRivalLogo.name}`}
                  onConfirm={async (blob) => {
                    const { name, file } = cropRivalLogo;
                    setCropRivalLogo(null);
                    try {
                      if (blob.size > 1.5*1024*1024) { toast("ไฟล์ใหญ่เกิน 1.5MB", "error"); return; }
                      const compressed = await compressImage(blob);
                      const uploaded = await upload("logo.jpg", compressed, { access:"public", handleUploadUrl:"/api/upload" });
                      dispatchApp({ type:"SET_RIVAL_LOGO", payload:{ name, url: uploaded.url } });
                      const oldUrl = app.rivalLogos?.[name];
                      if (oldUrl && oldUrl !== uploaded.url) deleteBlobUrls(oldUrl);
                    } catch { toast("อัพโหลดไม่สำเร็จ", "error"); }
                  }}
                  onCancel={()=>setCropRivalLogo(null)}
                />
              )}
              {!selRival ? (
                <>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6,flexWrap:"wrap"}}>
                    <h2 style={{margin:0,fontSize:24,fontWeight:800}}>🎯 Rivals</h2>
                    <button onClick={()=>setShowAddRival(v=>!v)}
                      style={{marginLeft:"auto",background:showAddRival?C.bgCard:`linear-gradient(135deg,${C.primary},${C.primaryLight})`,
                        color:showAddRival?C.textMuted:"#fff",
                        border:showAddRival?`1px solid ${C.border}`:"none",
                        borderRadius:9,padding:"7px 16px",cursor:"pointer",fontWeight:800,fontSize:12}}>
                      {showAddRival ? "✕ ยกเลิก" : "+ เพิ่มทีมคู่แข่งใหม่"}
                    </button>
                  </div>
                  <p style={{margin:"0 0 16px",color:C.textMuted,fontSize:13}}>คลิกเพื่อดูประวัติการดราฟต์และสถิติเจาะลึก</p>

                  {showAddRival && (
                    <div style={{display:"flex",gap:10,marginBottom:20,background:C.bgPanel,
                      padding:16,borderRadius:14,border:`1px solid ${C.border}`}}>
                      <input type="text" placeholder="ชื่อทีมคู่แข่ง... เช่น Alpha Wolves" value={newRivalName}
                        onChange={e=>setNewRivalName(e.target.value)}
                        onKeyDown={e=>{
                          if (e.key==="Enter" && newRivalName.trim()) {
                            const name = newRivalName.trim();
                            dispatchApp({type:"ADD_RIVAL", payload:name});
                            dispatchUI({type:"SET_PAGE", payload:"roster"});
                            dispatchUI({type:"SET_ROSTER_TAB", payload:"enemy"});
                            dispatchUI({type:"SET_SEL_ENEMY_TEAM", payload:name});
                            setNewRivalName(""); setShowAddRival(false);
                          }
                        }}
                        autoFocus
                        style={{...iStyle,flex:1}}/>
                      <button onClick={()=>{
                          if (!newRivalName.trim()) return;
                          const name = newRivalName.trim();
                          dispatchApp({type:"ADD_RIVAL", payload:name});
                          dispatchUI({type:"SET_PAGE", payload:"roster"});
                          dispatchUI({type:"SET_ROSTER_TAB", payload:"enemy"});
                          dispatchUI({type:"SET_SEL_ENEMY_TEAM", payload:name});
                          setNewRivalName(""); setShowAddRival(false);
                        }}
                        style={{background:C.primary,color:"#fff",border:"none",borderRadius:8,
                          padding:"0 22px",fontWeight:700,cursor:"pointer"}}>
                        + สร้างทีม
                      </button>
                    </div>
                  )}

                  {rivals.length===0
                    ?<div style={{textAlign:"center",padding:60,background:C.bgPanel,borderRadius:14,color:C.textMuted}}>
                        ยังไม่มีคู่แข่ง — กด "+ เพิ่มทีมคู่แข่งใหม่" หรือบันทึกแมตช์เพื่อเพิ่มคู่แข่ง
                      </div>
                    :<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:14}}>
                        {rivals.map(rv=>{
                          const rm=matches.filter(m=>m.rivalName===rv.name);
                          const rGames=rm.flatMap(m=>Array.isArray(m.games)&&m.games.length?m.games:[m]);
                          const rw=rGames.filter(g=>g.result==="WIN").length;
                          const rwrate=rGames.length?Math.round(rw/rGames.length*100):0;
                          return (
                            <div key={rv.id}
                              style={{borderRadius:16,overflow:"hidden",
                                border:`1px solid ${C.border}`,
                                transition:"transform 0.15s, box-shadow 0.15s"}}
                              onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.boxShadow=`0 8px 28px ${C.primary}30`;}}
                              onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none";}}>

                              {/* ── COVER ZONE — คลิกเข้าหน้า detail ── */}
                              <div onClick={()=>dispatchUI({type:"SET_SEL_RIVAL",payload:rv.name})}
                                style={{cursor:"pointer",position:"relative",
                                  height:180,overflow:"hidden",userSelect:"none"}}>

                                {/* Background: logo เต็มกรอบ */}
                                {app.rivalLogos?.[rv.name]
                                  ? <img src={app.rivalLogos[rv.name]} alt={rv.name}
                                      style={{width:"100%",height:"100%",objectFit:"cover",
                                        display:"block",filter:"brightness(0.75)"}}/>
                                  : <div style={{width:"100%",height:"100%",
                                      background:`linear-gradient(135deg,${C.primary}60,${C.primaryLight}30)`,
                                      display:"flex",alignItems:"center",justifyContent:"center"}}>
                                      <span style={{fontSize:56,fontWeight:900,color:"rgba(255,255,255,0.25)",
                                        letterSpacing:-2}}>
                                        {rv.name.slice(0,2).toUpperCase()}
                                      </span>
                                    </div>
                                }

                                {/* Gradient overlay ด้านล่าง เพื่อให้ชื่ออ่านออก */}
                                <div style={{position:"absolute",bottom:0,left:0,right:0,
                                  background:"linear-gradient(to top,rgba(0,0,0,0.85) 0%,rgba(0,0,0,0.3) 60%,transparent 100%)",
                                  padding:"12px 12px 12px"
                                }}>
                                  <div style={{fontWeight:900,fontSize:15,color:"#fff",
                                    lineHeight:1.2,textShadow:"0 1px 6px rgba(0,0,0,0.8)"}}>
                                    {rv.name}
                                  </div>
                                  <div style={{fontSize:10,color:"rgba(255,255,255,0.65)",marginTop:2}}>
                                    {rm.length} session · {rGames.length} เกม
                                  </div>
                                </div>

                                {/* Win rate badge มุมขวาบน */}
                                <div style={{position:"absolute",top:10,right:10,
                                  background:rGames.length===0?"rgba(0,0,0,0.5)":rwrate>=50?"rgba(0,184,148,0.85)":"rgba(253,121,168,0.85)",
                                  color:"#fff",borderRadius:99,
                                  padding:"3px 10px",fontSize:11,fontWeight:900,
                                  backdropFilter:"blur(4px)"}}>
                                  {rGames.length===0?"—":`${rwrate}%`}
                                </div>
                              </div>

                              {/* ── BOTTOM: actions ── */}
                              <div style={{background:C.bgPanel,padding:"8px 10px",
                                display:"flex",flexDirection:"column",gap:5}}>
                                {isCoach&&(
                                  <div onClick={e=>e.stopPropagation()}>
                                    <label style={{display:"flex",alignItems:"center",gap:6,
                                      cursor:"pointer",background:C.primary+"15",
                                      border:`1px solid ${C.primary}30`,borderRadius:7,
                                      padding:"5px 10px",fontSize:10,fontWeight:700,color:C.primaryLight}}>
                                      📸 {app.rivalLogos?.[rv.name]?"เปลี่ยนโลโก้":"อัพโหลดโลโก้"}
                                      <input type="file" accept="image/*"
                                        style={{display:"none"}}
                                        onChange={e=>{
                                          const file=e.target.files?.[0];
                                          if(!file) return;
                                          setCropRivalLogo({ name: rv.name, file });
                                          e.target.value="";
                                        }}/>
                                    </label>
                                  </div>
                                )}
                                <button
                                  onClick={e=>{
                                    e.stopPropagation();
                                    if(window.confirm(`ลบทีม "${rv.name}" ออกจาก Rivals?`))
                                      dispatchApp({type:"DELETE_RIVAL",payload:rv.name});
                                  }}
                                  style={{width:"100%",background:"transparent",
                                    border:`1px solid ${C.lose}25`,color:C.lose,
                                    borderRadius:7,padding:"4px 0",cursor:"pointer",
                                    fontSize:10,fontWeight:700,opacity:0.55}}>
                                  🗑️ ลบทีมนี้
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                  }
                </>
              ) : (()=>{
                  const rm     = matches.filter(m=>m.rivalName===selRival);
                  const rGames = rm.flatMap(m=>Array.isArray(m.games)&&m.games.length?m.games:[m]);
                  const rw     = rGames.filter(g=>g.result==="WIN").length;
                  const rwrate = rGames.length?Math.round(rw/rGames.length*100):0;
                  const eHeroSt={};
                  rGames.forEach(g=>{
                    (g.enemyPicks||[]).forEach(s=>{if(s.hero?.name){
                      if(!eHeroSt[s.hero.name])eHeroSt[s.hero.name]={picks:0,wins:0};
                      eHeroSt[s.hero.name].picks++;
                      if(g.result!=="WIN")eHeroSt[s.hero.name].wins++;
                    }});
                  });
                  const eHeroArr=Object.entries(eHeroSt)
                    .map(([h,s])=>({hero:h,picks:s.picks,wr:Math.round(s.wins/s.picks*100)}))
                    .sort((a,b)=>b.picks-a.picks);
                  const eBanCt={};
                  rGames.forEach(g=>(g.enemyBans||[]).forEach(h=>{
                    if(h?.name)eBanCt[h.name]=(eBanCt[h.name]||0)+1;
                  }));
                  const eTop10Bans=Object.entries(eBanCt).sort((a,b)=>b[1]-a[1]).slice(0,8);
                  const eBlueG=rGames.filter(g=>g.ourSide==="red");
                  const eRedG =rGames.filter(g=>g.ourSide==="blue");
                  const eBlueW=eBlueG.filter(g=>g.result==="LOSE").length;
                  const eRedW =eRedG.filter(g=>g.result==="LOSE").length;
                  const eBlueWR=eBlueG.length?Math.round(eBlueW/eBlueG.length*100):0;
                  const eRedWR =eRedG.length ?Math.round(eRedW/eRedG.length*100):0;
                  return (
                    <>
                      <button onClick={()=>dispatchUI({type:"SET_SEL_RIVAL",payload:null})}
                        style={{background:"transparent",border:"none",color:C.textMuted,cursor:"pointer",fontSize:14,marginBottom:16,padding:0}}>
                        ← กลับ Rivals
                      </button>
                      <div style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:14,padding:20,marginBottom:16}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
                          <div>
                            <h2 style={{margin:0,fontSize:26,fontWeight:800,color:C.primaryLight}}>{selRival}</h2>
                            <p style={{margin:"3px 0 0",color:C.textMuted,fontSize:12}}>{rm.length} session · {rGames.length} เกม</p>
                          </div>
                          <div style={{display:"flex",gap:12,alignItems:"center"}}>
                            {[{v:rw,l:"WINS",c:C.win},{v:rGames.length-rw,l:"LOSSES",c:C.lose}].map(x=>(
                              <div key={x.l} style={{textAlign:"center",background:C.bgBase,padding:"8px 16px",borderRadius:10}}>
                                <div style={{fontSize:20,fontWeight:800,color:x.c}}>{x.v}</div>
                                <div style={{fontSize:10,color:C.textMuted}}>{x.l}</div>
                              </div>
                            ))}
                            <div style={{textAlign:"center"}}>
                              <div style={{fontSize:28,fontWeight:800,color:rwrate>=50?C.win:C.lose}}>
                                {rGames.length?`${rwrate}%`:"-"}
                              </div>
                              <div style={{fontSize:11,color:C.textMuted}}>Win Rate</div>
                            </div>
                          </div>
                        </div>
                        {rGames.length>0&&(
                          <div style={{marginTop:12,height:4,background:"#1e1640",borderRadius:99}}>
                            <div style={{height:4,borderRadius:99,width:`${rwrate}%`,background:rwrate>=50?C.win:C.lose}}/>
                          </div>
                        )}
                      </div>
                      <div style={{display:"flex",gap:4,background:C.bgBase,borderRadius:10,padding:4,
                        marginBottom:18,width:"fit-content",border:`1px solid ${C.border}`}}>
                        {[
                          {id:"history",  label:"📋 ประวัติ Sessions"},
                          {id:"overview", label:"📊 Rival Overview"},
                          {id:"scout",    label:"🔍 Scout Log"},
                        ].map(t=>(
                          <button key={t.id}
                            onClick={()=>dispatchUI({type:"SET_RIVAL_VIEW",payload:t.id})}
                            style={{background:rivalView===t.id?C.primary:"transparent",
                              border:"none",color:rivalView===t.id?"#fff":C.textMuted,
                              borderRadius:7,padding:"7px 18px",cursor:"pointer",fontWeight:700,fontSize:13}}>
                            {t.label}
                          </button>
                        ))}
                      </div>
                      {rivalView==="scout" && (
                        <ScoutLogPage
                          rivalName={selRival}
                          scoutMatches={scoutMatches}
                          rivals={rivals}
                          enemyRosters={enemyRosters}
                          isCoach={isCoach}
                          onSaveScout={data=>dispatchApp({type:"SAVE_SCOUT",payload:data})}
                          onDeleteScout={id=>dispatchApp({type:"DELETE_SCOUT",payload:id})}
                          onUpdateScoutGame={(scoutId,gameIdx,updates)=>dispatchApp({type:"UPDATE_SCOUT_GAME",payload:{scoutId,gameIdx,updates}})}
                          onBack={()=>dispatchUI({type:"SET_RIVAL_VIEW",payload:"history"})}
                        />
                      )}
                      {rivalView==="history" && rm.map(m=>(
                        <MatchCardWithStats key={m.id} m={m} onUpdateStats={handleUpdateStats} onUpdateObjectives={handleUpdateObjectives} onUpdateGameFull={handleUpdateGameFull} onJumpToVideo={handleJumpToVideo} roster={roster} enemyRoster={app.enemyRosters?.[m.rivalName]||[]} videos={app.videos||[]} playerPhotos={app.playerPhotos} ourTeamName={session?.user?.teamName||app.teamName||"ทีมเรา"} ourTeamLogo={app.teamLogo} rivalLogo={app.rivalLogos?.[m.rivalName]} onDelete={id=>dispatchApp({type:"DELETE_MATCH",payload:id})} onEditMeta={handleEditMatchMeta}/>
                      ))}
                      {rivalView==="overview" && (
                        <div>
                          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))",gap:14,marginBottom:16}}>
                            {[
                              {icon:"🔵",label:"Blue Side (คู่แข่ง)",val:`${eBlueWR}%`,col:C.blue,sub:`${eBlueG.length} เกม · ${eBlueW}W`},
                              {icon:"🔴",label:"Red Side (คู่แข่ง)", val:`${eRedWR}%`, col:C.red, sub:`${eRedG.length} เกม · ${eRedW}W`},
                              {icon:"🎮",label:"เกมทั้งหมด",val:rGames.length,col:C.primaryLight,sub:`${rm.length} sessions`},
                              {icon:"🏆",label:"Win Rate (เราชนะ)",val:`${rwrate}%`,col:rwrate>=50?C.win:C.lose,sub:`${rw}W ${rGames.length-rw}L`},
                            ].map(c=>(
                              <div key={c.label} style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:12,padding:16}}>
                                <div style={{fontSize:10,color:C.textMuted,fontWeight:700,marginBottom:6}}>{c.icon} {c.label}</div>
                                <div style={{fontSize:26,fontWeight:800,color:c.col,lineHeight:1}}>{c.val}</div>
                                <div style={{marginTop:6,fontSize:11,color:C.textMuted}}>{c.sub}</div>
                              </div>
                            ))}
                          </div>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
                            <div style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:14,padding:18}}>
                              <div style={{fontWeight:700,fontSize:13,color:C.ban,marginBottom:12}}>🚫 Hero ที่คู่แข่งชอบแบน</div>
                              {eTop10Bans.length===0
                                ?<div style={{color:C.textMuted,textAlign:"center",padding:"20px 0",fontSize:12}}>ยังไม่มีข้อมูล</div>
                                :eTop10Bans.map(([h,cnt],i)=>(
                                  <div key={h} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                                    padding:"7px 10px",background:C.bgCard,borderRadius:7,marginBottom:5}}>
                                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                                      <span style={{color:C.textMuted,fontSize:10,width:16}}>#{i+1}</span>
                                      <span style={{fontWeight:700,fontSize:13}}>{h}</span>
                                    </div>
                                    <span style={{fontSize:11,color:C.ban,fontWeight:700,background:C.ban+"20",
                                      padding:"1px 7px",borderRadius:4}}>{cnt}x</span>
                                  </div>
                                ))
                              }
                            </div>
                            <div style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:14,padding:18}}>
                              <div style={{fontWeight:700,fontSize:13,color:C.lose,marginBottom:12}}>⚔️ Hero ที่คู่แข่งชอบเลือก</div>
                              {eHeroArr.length===0
                                ?<div style={{color:C.textMuted,textAlign:"center",padding:"20px 0",fontSize:12}}>ยังไม่มีข้อมูล</div>
                                :<table style={{width:"100%",borderCollapse:"collapse"}}>
                                  <thead>
                                    <tr style={{borderBottom:`2px solid ${C.border}`,color:C.textMuted,fontSize:10}}>
                                      <th style={{padding:"6px 8px",textAlign:"left"}}>Hero</th>
                                      <th style={{padding:"6px 8px",textAlign:"center"}}>Pick</th>
                                      <th style={{padding:"6px 8px",textAlign:"center"}}>Win%</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {eHeroArr.slice(0,8).map((s,i)=>(
                                      <tr key={s.hero} style={{borderBottom:`1px solid ${C.border}`,background:i%2===0?"transparent":C.bgCard}}>
                                        <td style={{padding:"6px 8px",fontWeight:700,fontSize:12}}>{s.hero}</td>
                                        <td style={{padding:"6px 8px",textAlign:"center",color:C.primaryLight,fontWeight:700}}>{s.picks}</td>
                                        <td style={{padding:"6px 8px",textAlign:"center"}}>
                                          <span style={{display:"inline-block",padding:"1px 7px",borderRadius:5,fontWeight:700,fontSize:11,
                                            background:s.wr>=50?C.win+"20":C.lose+"20",
                                            color:s.wr>=50?C.win:C.lose}}>{s.wr}%</span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              }
                            </div>
                          </div>
                          <RivalStatsSection selRival={selRival} rGames={rGames} enemyRosters={enemyRosters}/>
                        </div>
                      )}
                    </>
                  );
                })()
              }
            </div>
          )}

          {/* ═══ NOTES ═══ */}
          {page==="notes" && (
            <CoachNotesHub allGames={allGames} rivals={rivals}/>
          )}

          {/* ═══ VIDEO LIBRARY ═══ */}
          {page==="video" && (
            <>
              <YoutubeAutoImport onVideosRefreshed={videos=>dispatchApp({type:"SET_VIDEOS",payload:videos})}/>
              <VideoLibrary
                videos={app.videos||[]}
                onAddVideo={v=>dispatchApp({type:"ADD_VIDEO",payload:v})}
                onUpdateVideo={v=>dispatchApp({type:"UPDATE_VIDEO",payload:v})}
                onDeleteVideo={id=>dispatchApp({type:"DELETE_VIDEO",payload:id})}
                focusVideoId={ui.focusVideoId}
                onClearFocusVideo={()=>dispatchUI({type:"CLEAR_FOCUS_VIDEO"})}
              />
            </>
          )}

          {/* ═══ HERO IMAGES ═══ */}
          {page==="heroimg" && (
            <HeroImageManager
              heroPhotos={app.heroPhotos || {}}
              onSetPhoto={(heroName, dataUrl) => dispatchApp({type:"SET_HERO_PHOTO", payload:{heroName, dataUrl}})}
              onSetPhotosBulk={(updates) => dispatchApp({type:"SET_HERO_PHOTOS_BULK", payload:updates})}
              onRemovePhoto={(heroName) => dispatchApp({type:"REMOVE_HERO_PHOTO", payload:heroName})}
              onSetRole={(heroName, role) => dispatchApp({type:"SET_ROLE_OVERRIDE", payload:{heroName, role}})}
              onAddHero={({ name, role, photo }) => {
                dispatchApp({type:"ADD_CUSTOM_HERO", payload:{ name, role }});
                if (photo) dispatchApp({type:"SET_HERO_PHOTO", payload:{ heroName:name, dataUrl:photo }});
              }}
              onRemoveHero={(heroName) => {
                const photoUrl = app.heroPhotos?.[heroName];
                if (photoUrl) deleteBlobUrls(photoUrl);
                dispatchApp({type:"REMOVE_CUSTOM_HERO", payload:heroName});
                toast(`ลบ Hero "${heroName}" แล้ว`, "success");
              }}
            />
          )}

          {/* ═══ ROSTER ═══ */}
          {page==="roster" && (
            <div style={{maxWidth:960}}>
              {selPlayer ? (
                <PlayerProfile
                  player={selPlayer}
                  isEnemy={selPlayerEnemy}
                  allGames={allGames}
                  onBack={()=>dispatchUI({type:"CLEAR_SEL_PLAYER"})}
                  photoUrl={app.playerPhotos?.[selPlayerEnemy ? `enemy:${selEnemyTeam}:${selPlayer}` : `our:${selPlayer}`]}
                />
              ) : (
                <>
                  <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:16}}>
                    <LogoImg url={app.teamLogo} name={app.teamName||"ทีมเรา"} size={72}
                      style={{border:`3px solid ${C.primary}40`}}/>
                    <div>
                      <h2 style={{margin:"0 0 4px",fontSize:24,fontWeight:800}}>👥 Roster</h2>
                      <p style={{margin:"0 0 8px",color:C.textMuted,fontSize:13}}>คลิกที่ผู้เล่นเพื่อดู Player Profile</p>
                      {isCoach&&(
                        <LogoUploader
                          label="โลโก้ทีมเรา"
                          currentUrl={app.teamLogo}
                          onUpload={url=>dispatchApp({type:"SET_TEAM_LOGO",payload:url})}
                          onRemove={()=>dispatchApp({type:"SET_TEAM_LOGO",payload:null})}
                          size={36}
                        />
                      )}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:4,background:C.bgBase,borderRadius:10,padding:4,
                    marginBottom:20,width:"fit-content",border:`1px solid ${C.border}`}}>
                    {[{id:"our",label:"🛡️ ทีมเรา"},{id:"enemy",label:"⚔️ คู่แข่ง"}].map(t=>(
                      <button key={t.id}
                        onClick={()=>dispatchUI({type:"SET_ROSTER_TAB",payload:t.id})}
                        style={{background:rosterTab===t.id?C.primary:"transparent",
                          border:"none",color:rosterTab===t.id?"#fff":C.textMuted,
                          borderRadius:7,padding:"7px 22px",cursor:"pointer",fontWeight:700,fontSize:13}}>
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {rosterTab==="our" && (
                    <>
                      <div style={{display:"flex",gap:14,alignItems:"center",marginBottom:16,background:C.bgPanel,
                        padding:16,borderRadius:14,border:`1px solid ${C.border}`}}>
                        <PhotoPicker value={newPlayerPhoto} onChange={(v)=>setNewPlayerPhoto(v)} size={56} team="our"/>
                        <input type="text" placeholder="ชื่อผู้เล่นใหม่..." value={newName}
                          onChange={e=>dispatchUI({type:"SET_NEW_NAME",payload:e.target.value})}
                          onKeyDown={e=>e.key==="Enter"&&handleAddPlayer()}
                          style={{...iStyle,flex:1}}/>
                        <button onClick={handleAddPlayer}
                          style={{background:C.primary,color:"#fff",border:"none",borderRadius:8,
                            padding:"0 22px",fontWeight:700,cursor:"pointer",alignSelf:"stretch"}}>+ เพิ่ม</button>
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:10}}>
                        {roster.map(player=>{
                          let pg=0,pw=0; const ph={};
                          allGames.forEach(g=>{
                            const s=(g.ourPicks||[]).find(d=>d.player===player);
                            if(s){pg++;if(g.result==="WIN")pw++;if(s.hero?.name)ph[s.hero.name]=(ph[s.hero.name]||0)+1;}
                          });
                          const pwr=pg?Math.round(pw/pg*100):0;
                          const top=Object.entries(ph).sort((a,b)=>b[1]-a[1])[0];
                          const photoKey = `our:${player}`;
                          return (
                            <RosterPlayerCard key={player}
                              player={player}
                              photoUrl={app.playerPhotos?.[photoKey]}
                              pg={pg} pw={pw} pwr={pwr} top={top}
                              onSelect={()=>dispatchUI({type:"SET_SEL_PLAYER",payload:{name:player,isEnemy:false}})}
                              onRemove={()=>handleRemovePlayer(player)}
                              onRename={(newName)=>dispatchApp({type:"RENAME_PLAYER",payload:{oldName:player,newName}})}
                              onSetPhoto={(url)=>dispatchApp({type:"SET_PHOTO",payload:{key:photoKey,dataUrl:url}})}
                            />
                          );
                        })}
                        {roster.length===0&&(
                          <div style={{textAlign:"center",color:C.textMuted,padding:30,background:C.bgPanel,borderRadius:12}}>
                            ยังไม่มีผู้เล่น
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {rosterTab==="enemy" && (
                    <>
                      {!selEnemyTeam ? (
                        <>
                          <p style={{fontSize:12,color:C.textMuted,marginBottom:14}}>
                            เลือกทีมคู่แข่งเพื่อจัดการ Roster และดู Player Profile
                          </p>
                          {rivals.length===0&&(
                            <div style={{textAlign:"center",color:C.textMuted,padding:40,background:C.bgPanel,borderRadius:12}}>
                              ยังไม่มีทีมคู่แข่ง — บันทึกแมตช์ก่อนนะครับ
                            </div>
                          )}
                          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:12}}>
                            {rivals.map(rv=>{
                              const ep=enemyRosters[rv.name]||[];
                              const rGames=allGames.filter(g=>g.rivalName===rv.name);
                              const rw=rGames.filter(g=>g.result==="WIN").length;
                              const rwr=rGames.length?Math.round(rw/rGames.length*100):0;
                              return (
                                <div key={rv.id}
                                  onClick={()=>dispatchUI({type:"SET_SEL_ENEMY_TEAM",payload:rv.name})}
                                  style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px 18px",cursor:"pointer"}}
                                  onMouseEnter={e=>e.currentTarget.style.borderColor=C.lose}
                                  onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
                                  <div style={{fontWeight:800,fontSize:16,color:C.primaryLight,marginBottom:4}}>{rv.name}</div>
                                  <div style={{fontSize:11,color:C.textMuted,marginBottom:8}}>
                                    {ep.length} ผู้เล่น · {rGames.length} เกม · WR {rGames.length?`${rwr}%`:"-"}
                                  </div>
                                  <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                                    {ep.slice(0,5).map(p=>(
                                      <span key={p} style={{background:C.lose+"20",color:C.lose,fontSize:10,padding:"2px 8px",borderRadius:99,fontWeight:700}}>{p}</span>
                                    ))}
                                    {ep.length>5&&<span style={{fontSize:10,color:C.textMuted}}>+{ep.length-5}</span>}
                                    {ep.length===0&&<span style={{fontSize:10,color:"#3a3a5c"}}>ยังไม่มีผู้เล่น</span>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      ) : (
                        <>
                          <button onClick={()=>dispatchUI({type:"SET_SEL_ENEMY_TEAM",payload:null})}
                            style={{background:"transparent",border:"none",color:C.textMuted,cursor:"pointer",fontSize:13,marginBottom:14,padding:0}}>
                            ← กลับ
                          </button>
                          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
                            <h3 style={{margin:0,fontSize:18,fontWeight:800,color:C.lose}}>{selEnemyTeam}</h3>
                            <span style={{fontSize:11,color:C.textMuted}}>⚔️ Enemy Roster</span>
                          </div>
                          <div style={{display:"flex",gap:14,alignItems:"center",marginBottom:16,background:C.bgPanel,
                            padding:14,borderRadius:12,border:`1px solid ${C.border}`}}>
                            <PhotoPicker value={newEnemyPlayerPhoto} onChange={(v)=>setNewEnemyPlayerPhoto(v)} size={50} team="enemy"/>
                            <input type="text" placeholder="ชื่อผู้เล่นคู่แข่ง..." value={newEnemyName}
                              onChange={e=>dispatchUI({type:"SET_NEW_ENEMY_NAME",payload:e.target.value})}
                              onKeyDown={e=>e.key==="Enter"&&handleAddEnemyPlayer(selEnemyTeam)}
                              style={{...iStyle,flex:1}}/>
                            <button onClick={()=>handleAddEnemyPlayer(selEnemyTeam)}
                              style={{background:C.lose,color:"#fff",border:"none",borderRadius:8,padding:"0 18px",fontWeight:700,cursor:"pointer",alignSelf:"stretch"}}>
                              + เพิ่ม
                            </button>
                          </div>
                          <div style={{display:"flex",flexDirection:"column",gap:10}}>
                            {(enemyRosters[selEnemyTeam]||[]).map(player=>{
                              let pg=0,pw=0; const ph={};
                              allGames.filter(g=>g.rivalName===selEnemyTeam).forEach(g=>{
                                const s=(g.enemyPicks||[]).find(d=>d.player===player);
                                if(s){pg++;if(g.result==="LOSE")pw++;if(s.hero?.name)ph[s.hero.name]=(ph[s.hero.name]||0)+1;}
                              });
                              const pwr=pg?Math.round(pw/pg*100):0;
                              const top=Object.entries(ph).sort((a,b)=>b[1]-a[1])[0];
                              const photoKey = `enemy:${selEnemyTeam}:${player}`;
                              return (
                                <RosterPlayerCard key={player}
                                  team="enemy"
                                  player={player}
                                  photoUrl={app.playerPhotos?.[photoKey]}
                                  pg={pg} pw={pw} pwr={pwr} top={top}
                                  onSelect={()=>dispatchUI({type:"SET_SEL_PLAYER",payload:{name:player,isEnemy:true}})}
                                  onRemove={()=>handleRemoveEnemyPlayer(selEnemyTeam,player)}
                                  onRename={(newName)=>dispatchApp({type:"RENAME_ENEMY_PLAYER",payload:{rivalName:selEnemyTeam,oldName:player,newName}})}
                                  onSetPhoto={(url)=>dispatchApp({type:"SET_PHOTO",payload:{key:photoKey,dataUrl:url}})}
                                />
                              );
                            })}
                            {(enemyRosters[selEnemyTeam]||[]).length===0&&(
                              <div style={{textAlign:"center",color:C.textMuted,padding:30,background:C.bgPanel,borderRadius:12}}>
                                ยังไม่มีผู้เล่น — เพิ่มชื่อด้านบนได้เลย
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
    </HeroPhotosContext.Provider>
  );
}

// ── Outer wrapper ──
// ToastProvider must wrap RovAppInner from OUTSIDE, not be rendered by it —
// a component can never read a Context Provider that it renders itself
// (Context only flows down to descendants). This is what fixed the
// "toast is not a function" crash: handlers defined directly inside the
// old RovApp (now RovAppInner) call useToast(), so RovAppInner itself
// must be a *child* of ToastProvider, not its parent.
export default function RovApp() {
  return (
    <ToastProvider>
      <RovAppInner />
    </ToastProvider>
  );
}

// ═══════════════════════════════════════════
//  DRAFT PAGE — refactored to use draftReducer
// ═══════════════════════════════════════════
// ═══════════════════════════════════════════
//  MOCK DRAFT TRAINER — ฝึกซ้อม draft กับ AI ที่จำลอง
//  พฤติกรรม pick/ban ของคู่แข่งจากข้อมูลจริง (ไม่นับเป็นแมตช์จริง)
// ═══════════════════════════════════════════
// ── ความน่าเชื่อถือของข้อมูลลดลงครึ่งหนึ่งทุกๆ 60 วัน กัน meta เก่า/patch เก่า
//    มาครอบงำการทำนายพฤติกรรมปัจจุบันของคู่แข่ง ──
const RECENCY_HALF_LIFE_DAYS = 60;
function recencyWeight(idMs) {
  if (!idMs) return 1;
  const ageDays = Math.max(0, (Date.now() - idMs) / (1000*60*60*24));
  return Math.pow(0.5, ageDays / RECENCY_HALF_LIFE_DAYS);
}

// เก็บความถี่ ban/pick แยกตามตำแหน่ง (slot) — ถ่วงน้ำหนักตามความใหม่ของข้อมูล
// rivalFilter = null → เก็บภาพรวม "meta" จากทุกทีม (ทั้งเราและคู่แข่งทุกคน)
// rivalFilter = "ชื่อทีม" → เก็บเฉพาะพฤติกรรมของทีมนั้นทีมเดียว
function collectFrequencies(allGames, scoutMatches, rivalFilter) {
  const bans  = Array.from({length: BANS_PER_TEAM}, () => new Map());
  const picks = Array.from({length: ROLES_PICK.length}, () => new Map());
  const add = (map, name, w) => { if (name && map) map.set(name, (map.get(name)||0) + w); };

  allGames.forEach(g=>{
    const w = recencyWeight(g._matchId);
    if (!rivalFilter) {
      // meta ภาพรวม: นับทั้งฝั่งเราและฝั่งคู่แข่งทุกทีมที่เคยเจอ
      (g.ourBans||[]).forEach((b,i)=>add(bans[i], b?.name || (typeof b==="string"?b:null), w));
      (g.ourPicks||[]).forEach((s,i)=>add(picks[i], s?.hero?.name, w));
    }
    if (!rivalFilter || g.rivalName===rivalFilter) {
      (g.enemyBans||[]).forEach((b,i)=>add(bans[i], b?.name || (typeof b==="string"?b:null), w));
      (g.enemyPicks||[]).forEach((s,i)=>add(picks[i], s?.hero?.name, w));
    }
  });

  (scoutMatches||[]).forEach(sm=>{
    const w = recencyWeight(sm.id);
    const isA = sm.teamA===rivalFilter, isB = sm.teamB===rivalFilter;
    if (rivalFilter && !isA && !isB) return;
    (sm.games||[]).forEach(g=>{
      if (!rivalFilter) {
        // meta ภาพรวม: นับทั้ง 2 ฝั่งของ scout log
        [["bansA","picksA"],["bansB","picksB"]].forEach(([bk,pk])=>{
          (g[bk]||[]).forEach((b,i)=>add(bans[i], b?.name || (typeof b==="string"?b:null), w));
          (g[pk]||[]).forEach((s,i)=>add(picks[i], s?.hero?.name, w));
        });
      } else {
        const gb = isA ? (g.bansA||[])  : (g.bansB||[]);
        const gp = isA ? (g.picksA||[]) : (g.picksB||[]);
        gb.forEach((b,i)=>add(bans[i], b?.name || (typeof b==="string"?b:null), w));
        gp.forEach((s,i)=>add(picks[i], s?.hero?.name, w));
      }
    });
  });

  return { bans, picks };
}

// นับจำนวนเกม "ดิบ" (ไม่ถ่วงน้ำหนัก) ที่มีข้อมูลของทีมนี้ — ใช้โชว์ความน่าเชื่อถือให้โค้ชเห็น
function countRivalSamples(rivalName, allGames, scoutMatches) {
  const fromMatches = allGames.filter(g=>g.rivalName===rivalName).length;
  const fromScout = (scoutMatches||[]).reduce((sum,sm)=>{
    if (sm.teamA===rivalName || sm.teamB===rivalName) return sum + (sm.games||[]).length;
    return sum;
  }, 0);
  return { fromMatches, fromScout, total: fromMatches + fromScout };
}

const TIER_BONUS = { "S+":5, "S":3, "A":1, "B":0, "C":0 };
const RIVAL_DATA_MULTIPLIER   = 4; // ให้น้ำหนักข้อมูล "เฉพาะทีมนี้" มากกว่าภาพรวม meta ทั่วไป
const COUNTER_DATA_MULTIPLIER = 5; // "เขาชอบตอบโต้ตัวนี้เวลาเราหยิบตัวนั้น" คือข้อมูลจำเพาะที่สุด ให้น้ำหนักสูงสุด

// ── สร้างสถิติ "counter-response": เมื่อเราหยิบฮีโร่ X ไปแล้ว คู่แข่งมักเลือก/แบนฮีโร่ Y
//    ตอบโต้บ่อยแค่ไหน — รีคอนสตรัคลำดับ draft แบบเต็มจาก DRAFT_ORDER + ourSide ของแต่ละเกมจริง
//    (ใช้เฉพาะแมตช์จริงของเราเท่านั้น เพราะ scout log ไม่ได้บันทึกฝั่ง blue/red ไว้แน่ชัดพอจะ
//    รีคอนสตรัคลำดับเป๊ะๆ ได้ — ถ้าเดาผิดจะให้ข้อมูลที่ผิดยิ่งกว่าไม่มีข้อมูล)
function collectCounterResponses(allGames, rivalFilter) {
  const banResponses  = new Map(); // ourHero -> Map(enemyHero -> weight)
  const pickResponses = new Map();

  allGames.forEach(g=>{
    if (rivalFilter && g.rivalName !== rivalFilter) return;
    if (!g.ourSide) return; // ข้อมูลเก่าที่ไม่ได้เก็บฝั่งไว้ ข้ามไปกันข้อมูลผิด
    const w = recencyWeight(g._matchId);

    const sequence = DRAFT_ORDER.map(step=>{
      const isOur = step.team === g.ourSide;
      const hero = step.action==="ban"
        ? (isOur ? g.ourBans : g.enemyBans)?.[step.slot]?.name || null
        : (isOur ? g.ourPicks : g.enemyPicks)?.[step.slot]?.hero?.name || null;
      return { isOur, action: step.action, hero };
    });

    const revealedOurPicks = [];
    sequence.forEach(({ isOur, action, hero }) => {
      if (!isOur && hero) {
        const targetMap = action==="ban" ? banResponses : pickResponses;
        revealedOurPicks.forEach(ourHero=>{
          if (!targetMap.has(ourHero)) targetMap.set(ourHero, new Map());
          const m = targetMap.get(ourHero);
          m.set(hero, (m.get(hero)||0) + w);
        });
      }
      if (isOur && action==="pick" && hero) revealedOurPicks.push(hero);
    });
  });

  return { banResponses, pickResponses };
}

// รวม counter-response ของ "ฮีโร่ที่เรา reveal ไปแล้วในดราฟต์ปัจจุบัน" เข้าด้วยกัน
// พร้อมจำไว้ว่าฮีโร่เราตัวไหนเป็นตัว "กระตุ้น" การตอบโต้นั้นมากที่สุด (ไว้โชว์เหตุผล)
function buildCounterBonus(responseTable, revealedOurHeroes) {
  const combined = new Map();
  const triggeredBy = new Map(); // enemyHero -> { ourHero, weight }
  revealedOurHeroes.forEach(ourHero=>{
    const m = responseTable.get(ourHero);
    if (!m) return;
    m.forEach((w,enemyHero)=>{
      combined.set(enemyHero, (combined.get(enemyHero)||0) + w);
      const best = triggeredBy.get(enemyHero);
      if (!best || w > best.weight) triggeredBy.set(enemyHero, { ourHero, weight: w });
    });
  });
  return { combined, triggeredBy };
}

// รวม 4 ชั้นข้อมูลเข้าด้วยกัน แล้วสุ่มแบบถ่วงน้ำหนัก พร้อมบอกว่าผลลัพธ์มาจากชั้นไหน
// (เพื่อโชว์เหตุผลให้โค้ชเห็น ไม่ใช่ black box)
function weightedChoiceWithSource(rivalMap, globalMap, counterMap, counterTriggers, heroTiers, type, exclude) {
  const combined = new Map();
  (rivalMap||new Map()).forEach((w,h)=>{ if(!exclude.has(h)) combined.set(h, (combined.get(h)||0) + w*RIVAL_DATA_MULTIPLIER); });
  (globalMap||new Map()).forEach((w,h)=>{ if(!exclude.has(h)) combined.set(h, (combined.get(h)||0) + w); });
  (counterMap||new Map()).forEach((w,h)=>{ if(!exclude.has(h)) combined.set(h, (combined.get(h)||0) + w*COUNTER_DATA_MULTIPLIER); });
  if (type==="picks" && heroTiers) {
    Object.entries(heroTiers).forEach(([hero,tier])=>{
      if (exclude.has(hero)) return;
      const bonus = TIER_BONUS[tier] || 0;
      if (bonus) combined.set(hero, (combined.get(hero)||0) + bonus);
    });
  }

  const entries = [...combined.entries()];
  if (!entries.length) {
    return { hero: randomHeroExcluding(exclude), source: "random" };
  }
  const total = entries.reduce((s,[,c])=>s+c, 0);
  let r = Math.random() * total;
  let picked = entries[entries.length-1][0];
  for (const [h,c] of entries) { r -= c; if (r<=0) { picked = h; break; } }

  if (counterMap?.has(picked) && counterMap.get(picked)>0) {
    const trigger = counterTriggers?.get(picked);
    return { hero: picked, source: "counter", trigger };
  }
  const source = (rivalMap?.has(picked) && rivalMap.get(picked)>0) ? "rival"
               : (globalMap?.has(picked) && globalMap.get(picked)>0) ? "global"
               : "tier";
  return { hero: picked, source };
}

function randomHeroExcluding(exclude) {
  const pool = HERO_DATA.filter(h=>!exclude.has(h.name));
  if (!pool.length) return null;
  return pool[Math.floor(Math.random()*pool.length)].name;
}

const SOURCE_LABEL = {
  counter:{ icon:"🔁", text:"counter-pick ที่คู่แข่งชอบตอบโต้" },
  rival:  { icon:"🎯", text:"ข้อมูลเฉพาะทีมนี้" },
  global: { icon:"🌐", text:"ภาพรวม meta ทั่วไป" },
  tier:   { icon:"⭐", text:"Tier List ที่โค้ชตั้งไว้" },
  random: { icon:"🎲", text:"สุ่ม (ไม่มีข้อมูลอ้างอิง)" },
};

function MockDraftTrainer({ rivals, allGames, scoutMatches, heroTiers, onExit }) {
  const [phase, setPhase]         = useState("setup"); // setup | drafting | done
  const [rivalName, setRivalName] = useState(rivals[0]?.name || "");
  const [ourSide, setOurSide]     = useState("blue");
  const [freq, setFreq]           = useState(null); // { rival:{bans,picks}, global:{bans,picks} }
  const [state, setState]         = useState(null);
  const [thinking, setThinking]   = useState(false);
  const [search, setSearch]       = useState("");
  const [lastSource, setLastSource] = useState(null); // { hero, source } — เหตุผลของการเลือกล่าสุด

  const sampleCounts = rivalName ? countRivalSamples(rivalName, allGames, scoutMatches) : {fromMatches:0,fromScout:0,total:0};
  const hasData = sampleCounts.total > 0;

  function start() {
    setFreq({
      rival:   collectFrequencies(allGames, scoutMatches, rivalName),
      global:  collectFrequencies(allGames, scoutMatches, null),
      counter: collectCounterResponses(allGames, rivalName),
    });
    setLastSource(null);
    setState({
      step: 0,
      blueBans: Array(BANS_PER_TEAM).fill(null), redBans: Array(BANS_PER_TEAM).fill(null),
      bluePicks: ROLES_PICK.map(r=>({role:r,hero:null})),
      redPicks:  ROLES_PICK.map(r=>({role:r,hero:null})),
    });
    setPhase("drafting");
  }

  const cur = state && state.step < DRAFT_ORDER.length ? DRAFT_ORDER[state.step] : null;
  const enemySide = ourSide==="blue" ? "red" : "blue";
  const isOurTurn = cur && cur.team===ourSide;
  const isDone = state && state.step >= DRAFT_ORDER.length;

  const usedNames = state ? new Set([
    ...state.blueBans.filter(Boolean).map(h=>h.name),
    ...state.redBans.filter(Boolean).map(h=>h.name),
    ...state.bluePicks.filter(p=>p.hero).map(p=>p.hero.name),
    ...state.redPicks.filter(p=>p.hero).map(p=>p.hero.name),
  ]) : new Set();

  function placeHero(name) {
    if (!cur || !name) return;
    setState(prev=>{
      const next = { ...prev, step: prev.step+1 };
      const heroObj = { name };
      if (cur.action==="ban") {
        if (cur.team==="blue") { next.blueBans=[...prev.blueBans]; next.blueBans[cur.slot]=heroObj; }
        else { next.redBans=[...prev.redBans]; next.redBans[cur.slot]=heroObj; }
      } else {
        if (cur.team==="blue") { next.bluePicks=[...prev.bluePicks]; next.bluePicks[cur.slot]={...prev.bluePicks[cur.slot],hero:heroObj}; }
        else { next.redPicks=[...prev.redPicks]; next.redPicks[cur.slot]={...prev.redPicks[cur.slot],hero:heroObj}; }
      }
      return next;
    });
  }

  // ── ให้ "คู่แข่งจำลอง" เดินเองอัตโนมัติ โดยผสม 3 ชั้นข้อมูล:
  //    1) พฤติกรรมเฉพาะทีมนี้ (น้ำหนักสูงสุด) 2) ภาพรวม meta ปัจจุบัน 3) Tier List ที่โค้ชตั้งไว้ ──
  useEffect(() => {
    if (phase!=="drafting" || !cur || isOurTurn || thinking) return;
    setThinking(true);
    const t = setTimeout(() => {
      const type = cur.action==="ban" ? "bans" : "picks";
      const rivalMap  = freq?.rival?.[type]?.[cur.slot];
      const globalMap = freq?.global?.[type]?.[cur.slot];

      const ourPicksArr = ourSide==="blue" ? state.bluePicks : state.redPicks;
      const revealedOurHeroes = ourPicksArr.filter(p=>p.hero).map(p=>p.hero.name);
      const counterTable = cur.action==="ban" ? freq?.counter?.banResponses : freq?.counter?.pickResponses;
      const { combined: counterMap, triggeredBy } = buildCounterBonus(counterTable || new Map(), revealedOurHeroes);

      const result = weightedChoiceWithSource(rivalMap, globalMap, counterMap, triggeredBy, heroTiers, type, usedNames);
      setLastSource(result);
      placeHero(result.hero);
      setThinking(false);
    }, 650);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, state?.step]);

  if (phase==="setup") return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",
      minHeight:"calc(100vh - 56px)",background:C.bgBase,padding:16}}>
      <div style={{width:440,maxWidth:"100%",background:C.bgPanel,borderRadius:20,padding:30,
        border:`1px solid ${C.border}`,boxShadow:"0 20px 60px rgba(0,0,0,0.4)"}}>
        <div style={{textAlign:"center",marginBottom:22}}>
          <div style={{fontSize:34,marginBottom:6}}>🧠</div>
          <h2 style={{margin:0,fontSize:19,fontWeight:800}}>ฝึกซ้อม Draft (Mock)</h2>
          <p style={{margin:"6px 0 0",fontSize:12,color:C.textMuted}}>
            ระบบจะจำลองคู่แข่งเลือก/แบนฮีโร่ตามแพทเทิร์นจริงที่เคยเจอมา — ไม่นับเป็นแมตช์จริง
          </p>
          <p style={{margin:"6px 0 0",fontSize:11,color:C.textMuted,opacity:0.8}}>
            รวมถึง "counter-pick" ที่คู่แข่งเคยตอบโต้เวลาเราหยิบฮีโร่บางตัว (จากแมตช์จริงเท่านั้น)
          </p>
        </div>
        <div style={{marginBottom:16}}>
          <div style={{fontSize:12,color:C.textMuted,marginBottom:6,fontWeight:700}}>ฝึกซ้อมกับทีมไหน</div>
          <select value={rivalName} onChange={e=>setRivalName(e.target.value)}
            style={{width:"100%",boxSizing:"border-box",background:C.bgCard,border:`1px solid ${C.border}`,
              color:C.textMain,borderRadius:8,padding:"9px 12px",fontSize:13,outline:"none"}}>
            <option value="">— เลือกทีมคู่แข่ง —</option>
            {rivals.map(r=><option key={r.id} value={r.name}>{r.name}</option>)}
          </select>
          {rivalName && !hasData && (
            <div style={{marginTop:8,fontSize:11,color:"#feca57"}}>
              ⚠️ ยังไม่มีข้อมูลแมตช์/scout ของทีมนี้เลย — จะใช้ภาพรวม meta ทั่วไปกับ Tier List แทน
            </div>
          )}
          {rivalName && hasData && (
            <div style={{marginTop:8,padding:"8px 12px",background:C.primary+"10",
              border:`1px solid ${C.primary}30`,borderRadius:8,fontSize:11,color:C.primaryLight}}>
              ✅ มีข้อมูล {sampleCounts.total} เกม ({sampleCounts.fromMatches} จากแมตช์จริง, {sampleCounts.fromScout} จาก scout log)
              — ยิ่งเยอะ AI ยิ่งแม่นยำขึ้น (ข้อมูลเก่ากว่า 60 วันจะถูกลดน้ำหนักลงเรื่อยๆ)
            </div>
          )}
        </div>
        <div style={{marginBottom:22}}>
          <div style={{fontSize:12,color:C.textMuted,marginBottom:6,fontWeight:700}}>ทีมเรา</div>
          <div style={{display:"flex",gap:8}}>
            {[{v:"blue",l:"🔵 ฝั่งน้ำเงิน"},{v:"red",l:"🔴 ฝั่งแดง"}].map(o=>(
              <button key={o.v} onClick={()=>setOurSide(o.v)}
                style={{flex:1,background:ourSide===o.v?C.primary+"30":"transparent",
                  border:`1px solid ${ourSide===o.v?C.primary:C.border}`,
                  color:ourSide===o.v?C.primaryLight:C.textMuted,borderRadius:9,
                  padding:"9px 0",cursor:"pointer",fontSize:12,fontWeight:700}}>
                {o.l}
              </button>
            ))}
          </div>
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onExit} style={{flex:1,background:"transparent",border:`1px solid ${C.border}`,
            color:C.textMuted,borderRadius:9,padding:"11px 0",cursor:"pointer",fontWeight:700,fontSize:13}}>
            ← กลับ
          </button>
          <button onClick={start} disabled={!rivalName}
            style={{flex:2,background:rivalName?C.primary:C.border,color:"#fff",border:"none",borderRadius:9,
              padding:"11px 0",cursor:rivalName?"pointer":"default",fontWeight:800,fontSize:13}}>
            🚀 เริ่มฝึกซ้อม
          </button>
        </div>
      </div>
    </div>
  );

  const filteredHeroes = HERO_DATA.filter(h=>
    !usedNames.has(h.name) && h.name.toLowerCase().includes(search.toLowerCase())
  );

  const BoardSide = ({ side, label, col }) => {
    const bansArr  = side==="blue" ? state.blueBans  : state.redBans;
    const picksArr = side==="blue" ? state.bluePicks : state.redPicks;
    return (
      <div style={{flex:1,minWidth:260}}>
        <div style={{fontWeight:800,fontSize:12,color:col,marginBottom:8}}>
          {label} {side===ourSide?"(เรา)":"(จำลอง)"}
        </div>
        <div style={{display:"flex",gap:5,marginBottom:10}}>
          {bansArr.map((b,i)=>(
            <div key={i} style={{width:34,height:34,borderRadius:8,overflow:"hidden",
              border:`1px solid ${C.border}`,opacity:b?1:0.4,filter:b?"grayscale(60%)":"none",
              display:"flex",alignItems:"center",justifyContent:"center",background:C.bgCard,fontSize:9}}>
              {b ? <HeroAvatar name={b.name} team={side===ourSide?"our":"enemy"} size={34}/> : "🚫"}
            </div>
          ))}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:5}}>
          {picksArr.map((p,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,background:C.bgCard,
              borderRadius:8,padding:"5px 8px",border:`1px solid ${C.border}`}}>
              <span style={{fontSize:9,color:C.textMuted,width:52,flexShrink:0}}>{p.role}</span>
              {p.hero ? <HeroChip name={p.hero.name} size={24} fontSize={11}/> :
                <span style={{fontSize:11,color:C.textMuted}}>—</span>}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={{padding:"16px 24px 40px",maxWidth:920,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
        <div>
          <h2 style={{margin:0,fontSize:18,fontWeight:800}}>🧠 ฝึกซ้อม Draft vs {rivalName}</h2>
          <p style={{margin:"2px 0 0",fontSize:11,color:C.textMuted}}>โหมดฝึกซ้อม — ไม่นับเป็นแมตช์จริง</p>
        </div>
        <button onClick={onExit} style={{background:"transparent",border:`1px solid ${C.border}`,
          color:C.textMuted,borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:12,fontWeight:700}}>
          ✕ ออกจากโหมดฝึกซ้อม
        </button>
      </div>

      {!isDone ? (
        <>
          <div style={{textAlign:"center",marginBottom:14,padding:"10px 0",
            background: isOurTurn ? C.primary+"15" : "#feca5715",
            border:`1px solid ${isOurTurn?C.primary:"#feca57"}40`, borderRadius:10}}>
            {isOurTurn ? (
              <span style={{fontSize:13,fontWeight:800,color:C.primaryLight}}>
                🎯 ตาคุณ — {cur.action==="ban"?"เลือกฮีโร่ที่จะ Ban":"เลือกฮีโร่ที่จะ Pick"} ({ROLES_PICK[cur.slot]||""})
              </span>
            ) : (
              <span style={{fontSize:13,fontWeight:700,color:"#feca57"}}>
                🤖 คู่แข่งจำลองกำลังเลือก{cur?.action==="ban"?"ฮีโร่ที่จะแบน":"ฮีโร่"}...
              </span>
            )}
            {lastSource && !thinking && (
              <div style={{marginTop:6,fontSize:11,color:C.textMuted}}>
                ↳ เลือก <b style={{color:C.textMain}}>{lastSource.hero}</b> จาก {SOURCE_LABEL[lastSource.source].icon} {SOURCE_LABEL[lastSource.source].text}
                {lastSource.source==="counter" && lastSource.trigger && (
                  <> — เพราะเราหยิบ <b style={{color:C.textMain}}>{lastSource.trigger.ourHero}</b> ไปก่อนหน้านี้</>
                )}
              </div>
            )}
          </div>

          <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:16}}>
            <BoardSide side="blue" label="🔵 ฝั่งน้ำเงิน" col="#4a9eff"/>
            <BoardSide side="red"  label="🔴 ฝั่งแดง"     col="#ff6b6b"/>
          </div>

          {isOurTurn && (
            <div style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:14,padding:14}}>
              <input value={search} onChange={e=>setSearch(e.target.value)}
                placeholder="🔍 ค้นหา Hero..." autoFocus
                style={{width:"100%",boxSizing:"border-box",background:C.bgCard,border:`1px solid ${C.border}`,
                  color:C.textMain,borderRadius:8,padding:"8px 12px",fontSize:13,outline:"none",marginBottom:10}}/>
              <div style={{maxHeight:280,overflowY:"auto",display:"grid",
                gridTemplateColumns:"repeat(auto-fit,minmax(90px,1fr))",gap:6}}>
                {filteredHeroes.map(h=>(
                  <button key={h.name} onClick={()=>placeHero(h.name)}
                    style={{background:C.bgCard,border:`1px solid ${C.border}`,color:C.textMain,
                      borderRadius:8,padding:"8px 4px",cursor:"pointer",fontSize:10,fontWeight:700,
                      display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                    <HeroAvatar name={h.name} team="our" size={32}/>
                    <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",width:"100%",textAlign:"center"}}>
                      {h.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div style={{textAlign:"center",padding:"30px 0"}}>
          <div style={{fontSize:36,marginBottom:10}}>🏁</div>
          <h3 style={{margin:"0 0 16px",fontSize:17,fontWeight:800,color:C.primaryLight}}>จบการฝึกซ้อมแล้ว!</h3>
          <div style={{display:"flex",gap:16,flexWrap:"wrap",justifyContent:"center",marginBottom:20}}>
            <BoardSide side="blue" label="🔵 ฝั่งน้ำเงิน" col="#4a9eff"/>
            <BoardSide side="red"  label="🔴 ฝั่งแดง"     col="#ff6b6b"/>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"center"}}>
            <button onClick={()=>setPhase("setup")} style={{background:C.primary,color:"#fff",border:"none",
              borderRadius:9,padding:"10px 24px",cursor:"pointer",fontWeight:700,fontSize:13}}>
              🔄 ฝึกใหม่
            </button>
            <button onClick={onExit} style={{background:"transparent",border:`1px solid ${C.border}`,
              color:C.textMuted,borderRadius:9,padding:"10px 24px",cursor:"pointer",fontWeight:700,fontSize:13}}>
              ออกจากโหมดฝึกซ้อม
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DraftPageR({ draft, dispatch, roster, rivals, enemyRosters, onFinishSession, allGames, scoutMatches, heroTiers }) {
  const [mockMode, setMockMode] = useState(false);

  // เช็คครั้งเดียวตอนเปิดหน้านี้ว่ามี draft ที่ทำค้างไว้ (จากแท็บก่อนหน้าที่ crash/ปิดพลาด) ไหม
  const [recoverable] = useState(() => {
    if (draft.stage !== "setup") return null; // อยู่กลาง session อยู่แล้ว ไม่ต้องเสนอกู้คืน
    try {
      const raw = localStorage.getItem(DRAFT_LS_KEY);
      if (!raw) return null;
      const saved = JSON.parse(raw);
      if (saved && saved.stage && saved.stage !== "setup") return saved;
      return null;
    } catch { return null; }
  });
  const [dismissedRecovery, setDismissedRecovery] = useState(false);

  if (mockMode) return (
    <MockDraftTrainer rivals={rivals} allGames={allGames} scoutMatches={scoutMatches} heroTiers={heroTiers}
      onExit={()=>setMockMode(false)}/>
  );

  const { stage, boType, rivalName, ourSide, currentGame, completedGames,
          step, blueBans, redBans, bluePicks, redPicks,
          roleFilter, search, meta } = draft;

  const bo = BO_OPTIONS.find(b=>b.label===boType) || BO_OPTIONS[2];
  const currentEnemyRoster = enemyRosters[rivalName] || [];

  const globalLockedOur = new Set(
    completedGames.flatMap(g=>(g.ourPicks||[]).filter(s=>s.hero).map(s=>s.hero.name))
  );
  const globalLockedEnemy = new Set(
    completedGames.flatMap(g=>(g.enemyPicks||[]).filter(s=>s.hero).map(s=>s.hero.name))
  );

  const cur        = step < DRAFT_ORDER.length ? DRAFT_ORDER[step] : null;
  const phase      = !cur ? "DONE" : cur.action==="ban" ? "BAN" : "PICK";
  const phaseColor = phase==="BAN" ? C.ban : C.win;

  const usedThisGame = new Set([
    ...blueBans.filter(Boolean).map(h=>h.name),
    ...redBans.filter(Boolean).map(h=>h.name),
    ...bluePicks.filter(h=>h.hero).map(h=>h.hero.name),
    ...redPicks.filter(h=>h.hero).map(h=>h.hero.name),
  ]);

  function isGlobalLocked(heroName) {
    if (!cur || cur.action==="ban") return false;
    return cur.team===ourSide ? globalLockedOur.has(heroName) : globalLockedEnemy.has(heroName);
  }

  function teamLabel(t) {
    return t===ourSide ? `${t==="blue"?"🔵":"🔴"} ทีมเรา` : `${t==="blue"?"🔵":"🔴"} คู่แข่ง`;
  }

  function selectHero(hero) {
    if (!cur || usedThisGame.has(hero.name) || isGlobalLocked(hero.name)) return;
    dispatch({ type:"SELECT_HERO", payload:{ hero, team:cur.team, action:cur.action, slot:cur.slot } });
  }

  function handleGameDone() {
    const ourPicksData   = ourSide==="blue" ? bluePicks : redPicks;
    const enemyPicksData = ourSide==="blue" ? redPicks  : bluePicks;
    const ourBansData    = ourSide==="blue" ? blueBans  : redBans;
    const enemyBansData  = ourSide==="blue" ? redBans   : blueBans;
    const finishedGame = {
      ourSide, result:meta.result,
      ourScore:meta.ourScore, enemyScore:meta.enemyScore,
      duration:meta.duration,
      pauseDuration: meta.hasPause && meta.pauseDuration ? normalizeDuration(meta.pauseDuration) : null,
      note:meta.note,
      ourBans:ourBansData, enemyBans:enemyBansData,
      ourPicks:ourPicksData, enemyPicks:enemyPicksData,
      gameStats:{ our:{}, enemy:{} },
      gameNo: currentGame,
    };

    // If this was the last game in the BO series, save the whole match
    // immediately instead of relying on the user to notice and press the
    // separate "Finish" button — that button doesn't even exist once the
    // reducer's "done" stage is reached, leaving the match unsaved.
    if (currentGame >= bo.total) {
      onFinishSession([...completedGames, finishedGame]);
      return;
    }

    dispatch({ type:"GAME_DONE", payload: finishedGame });
  }

  const filtered = HERO_DATA.filter(h =>
    (roleFilter==="All" || h.role===roleFilter) &&
    h.name.toLowerCase().includes(search.toLowerCase())
  );

  const phaseLabel = !cur ? "✅ Draft เสร็จ"
    : cur.action==="ban" ? `🚫 BAN — ${teamLabel(cur.team)}`
    : `⚔️ PICK — ${teamLabel(cur.team)}`;

  // ── SETUP ──
  if (stage==="setup") return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",
      minHeight:"calc(100vh - 60px)",background:C.bgBase}}>
      <div style={{width:500,background:C.bgPanel,borderRadius:20,padding:36,
        border:`1px solid ${C.border}`,boxShadow:"0 20px 60px rgba(0,0,0,0.4)"}}>
        {recoverable && !dismissedRecovery && (
          <div style={{background:"#feca5715",border:"1px solid #feca5750",borderRadius:12,
            padding:14,marginBottom:20}}>
            <div style={{fontWeight:800,fontSize:13,color:"#feca57",marginBottom:6}}>
              ⚠️ พบ Draft ที่ทำค้างไว้
            </div>
            <div style={{fontSize:12,color:C.textMuted,marginBottom:10}}>
              {recoverable.boType} vs {recoverable.rivalName || "?"} — ทำไปแล้ว {recoverable.step||0}/{DRAFT_ORDER.length} ขั้นตอน
              (น่าจะเกิดจากรีเฟรช/ปิดแท็บกลางคันครั้งก่อน)
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{ dispatch({type:"LOAD_DRAFT", payload:recoverable}); }}
                style={{background:"#feca57",color:"#1a1a2e",border:"none",borderRadius:8,
                  padding:"7px 16px",cursor:"pointer",fontWeight:800,fontSize:12}}>
                🔄 กู้คืนต่อ
              </button>
              <button onClick={()=>{
                  try{ localStorage.removeItem(DRAFT_LS_KEY); }catch{}
                  setDismissedRecovery(true);
                }}
                style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textMuted,
                  borderRadius:8,padding:"7px 16px",cursor:"pointer",fontWeight:700,fontSize:12}}>
                🗑️ ลบทิ้ง เริ่มใหม่
              </button>
            </div>
          </div>
        )}
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:36,marginBottom:6}}>⚔️</div>
          <h2 style={{margin:0,fontSize:20,fontWeight:800}}>เริ่ม Draft Session</h2>
          <button onClick={()=>setMockMode(true)}
            style={{marginTop:10,background:"transparent",border:`1px solid ${C.border}`,
              color:C.textMuted,borderRadius:99,padding:"5px 14px",cursor:"pointer",fontSize:11,fontWeight:700}}>
            🧠 หรือฝึกซ้อม Draft กับ AI แทน →
          </button>
        </div>
        <div style={{marginBottom:18}}>
          <div style={{fontSize:12,color:C.textMuted,marginBottom:6,fontWeight:700}}>ทีมคู่แข่ง</div>
          {rivals.length>0 ? (
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              <select
                value={rivals.find(r=>r.name===rivalName) ? rivalName : "__custom__"}
                onChange={e=>{
                  if (e.target.value==="__custom__") dispatch({type:"SETUP_SET_RIVAL",payload:""});
                  else dispatch({type:"SETUP_SET_RIVAL",payload:e.target.value});
                }}
                style={iStyle}>
                <option value="__custom__">— พิมพ์ชื่อทีมใหม่ —</option>
                {rivals.map(r=><option key={r.id} value={r.name}>{r.name}</option>)}
              </select>
              {(!rivalName || !rivals.find(r=>r.name===rivalName)) && (
                <input value={rivalName}
                  onChange={e=>dispatch({type:"SETUP_SET_RIVAL",payload:e.target.value})}
                  placeholder="พิมพ์ชื่อทีมใหม่..." style={iStyle}/>
              )}
            </div>
          ) : (
            <input value={rivalName}
              onChange={e=>dispatch({type:"SETUP_SET_RIVAL",payload:e.target.value})}
              placeholder="เช่น Alpha Wolves" style={iStyle}/>
          )}
          {rivalName && currentEnemyRoster.length>0 && (
            <div style={{marginTop:8,padding:"8px 12px",background:C.lose+"10",
              border:`1px solid ${C.lose}30`,borderRadius:8}}>
              <div style={{fontSize:10,color:C.lose,fontWeight:700,marginBottom:4}}>
                ⚔️ Roster: {currentEnemyRoster.length} คน
              </div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                {currentEnemyRoster.map(p=>(
                  <span key={p} style={{background:C.lose+"20",color:C.lose,fontSize:10,
                    padding:"2px 8px",borderRadius:99,fontWeight:700}}>{p}</span>
                ))}
              </div>
            </div>
          )}
        </div>
        <div style={{marginBottom:28}}>
          <div style={{fontSize:12,color:C.textMuted,marginBottom:10,fontWeight:700}}>รูปแบบ BO</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(70px,1fr))",gap:6}}>
            {BO_OPTIONS.map(b=>(
              <button key={b.label}
                onClick={()=>dispatch({type:"SETUP_SET_BO",payload:b.label})}
                style={{background:boType===b.label?C.primary+"30":"transparent",
                  border:`2px solid ${boType===b.label?C.primary:C.border}`,
                  color:boType===b.label?C.primaryLight:C.textMuted,
                  borderRadius:10,padding:"10px 4px",cursor:"pointer",textAlign:"center"}}>
                <div style={{fontWeight:900,fontSize:15}}>{b.label}</div>
              </button>
            ))}
          </div>
        </div>
        {/* ── Patch Version ── */}
        <div style={{marginBottom:16}}>
          <div style={{fontSize:12,color:C.textMuted,marginBottom:8,fontWeight:700}}>
            🗂️ Patch Version <span style={{fontWeight:400,fontSize:11}}>(ไม่บังคับ)</span>
          </div>
          <input
            value={draft.patch||""}
            onChange={e=>dispatch({type:"SETUP_SET_PATCH",payload:e.target.value})}
            placeholder="เช่น 4.21, 4.22 ..."
            style={{width:"100%",boxSizing:"border-box",background:"#1a1535",
              border:`1px solid ${C.border}`,color:C.textMain,borderRadius:9,
              padding:"9px 14px",fontSize:13,outline:"none"}}/>
        </div>

        {/* ── Category: ซ้อม / แข่ง ── */}
        <div style={{marginBottom:28}}>
          <div style={{fontSize:12,color:C.textMuted,marginBottom:10,fontWeight:700}}>ประเภทแมตช์</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {[{id:"scrim",label:"🏋️ ซ้อม",desc:"Scrim / Practice"},{id:"tournament",label:"🏆 แข่ง",desc:"Tournament / Official"}].map(cat=>(
              <button key={cat.id}
                onClick={()=>dispatch({type:"SETUP_SET_CATEGORY",payload:cat.id})}
                style={{background:draft.category===cat.id?C.primary+"30":"transparent",
                  border:`2px solid ${draft.category===cat.id?C.primary:C.border}`,
                  color:draft.category===cat.id?C.primaryLight:C.textMuted,
                  borderRadius:10,padding:"12px 8px",cursor:"pointer",textAlign:"center"}}>
                <div style={{fontWeight:900,fontSize:15}}>{cat.label}</div>
                <div style={{fontSize:10,marginTop:3,opacity:0.7}}>{cat.desc}</div>
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={()=>{
            if(!rivalName.trim()){alert("กรุณากรอกชื่อทีมคู่แข่ง");return;}
            dispatch({type:"SETUP_NEXT"});
          }}
          style={{width:"100%",background:`linear-gradient(135deg,${C.primary},${C.primaryLight})`,
            color:"#fff",border:"none",borderRadius:10,padding:"13px",fontWeight:800,fontSize:15,cursor:"pointer"}}>
          ถัดไป: เลือกฝั่ง Game 1 →
        </button>
      </div>
    </div>
  );

  // ── CHOOSE SIDE ──
  if (stage==="chooseSide") return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      minHeight:"calc(100vh - 60px)",background:C.bgBase,position:"relative"}}>
      {completedGames.length>0&&(
        <button onClick={()=>onFinishSession(completedGames)} style={{
          position:"absolute",top:20,right:24,
          background:"transparent",border:`1px solid ${C.win}60`,color:C.win,
          borderRadius:8,padding:"6px 16px",cursor:"pointer",fontWeight:700,fontSize:13}}>
          ✅ Finish ({completedGames.length} เกม)
        </button>
      )}
      <button onClick={()=>dispatch({type:"BACK_TO_SETUP"})} style={{
        position:"absolute",top:20,left:24,
        background:"transparent",border:"none",color:C.textMuted,cursor:"pointer",fontSize:13}}>
        ← กลับ Setup
      </button>
      <div style={{textAlign:"center",marginBottom:8}}>
        <div style={{fontSize:11,color:C.primaryLight,fontWeight:700,letterSpacing:1,marginBottom:4}}>
          {boType} · vs {rivalName}
        </div>
        <div style={{display:"flex",gap:6,justifyContent:"center",marginBottom:16}}>
          {Array.from({length:bo.total},(_,i)=>(
            <div key={i} style={{width:24,height:24,borderRadius:"50%",display:"flex",
              alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,
              background:i<completedGames.length
                ?completedGames[i].result==="WIN"?C.win+"30":C.lose+"30"
                :i===currentGame-1?C.primary+"30":"transparent",
              border:`2px solid ${i<completedGames.length
                ?completedGames[i].result==="WIN"?C.win:C.lose
                :i===currentGame-1?C.primary:C.border}`,
              color:i<completedGames.length
                ?completedGames[i].result==="WIN"?C.win:C.lose
                :i===currentGame-1?C.primary:C.textMuted}}>
              {i<completedGames.length?(completedGames[i].result==="WIN"?"W":"L"):i+1}
            </div>
          ))}
        </div>
        <h2 style={{margin:0,fontSize:20,fontWeight:800}}>เลือกฝั่ง — Game {currentGame}</h2>
        <p style={{margin:"6px 0 0",color:C.textMuted,fontSize:12}}>ทีมเราเล่นฝั่งไหนในเกมนี้?</p>
        {(globalLockedOur.size>0||globalLockedEnemy.size>0)&&(
          <div style={{marginTop:16,background:C.bgPanel,border:`1px solid ${C.border}`,
            borderRadius:12,padding:"12px 20px",maxWidth:440,textAlign:"left"}}>
            <div style={{fontSize:11,color:C.textMuted,fontWeight:700,marginBottom:4}}>
              🔒 Global Lock สำหรับ Game {currentGame}
            </div>
            {globalLockedOur.size>0&&<div style={{fontSize:11,color:C.win}}>
              🛡️ <b>ทีมเรา</b> ห้าม Pick: {[...globalLockedOur].join(", ")}
            </div>}
            {globalLockedEnemy.size>0&&<div style={{fontSize:11,color:C.lose}}>
              ⚔️ <b>คู่แข่ง</b> ห้าม Pick: {[...globalLockedEnemy].join(", ")}
            </div>}
          </div>
        )}
      </div>
      <div style={{display:"flex",gap:20,marginTop:20}}>
        {[
          {side:"blue",color:C.blue,emoji:"🔵",label:"Blue Side",hint:"Ban ก่อน"},
          {side:"red", color:C.red, emoji:"🔴",label:"Red Side", hint:"Ban ทีหลัง"},
        ].map(opt=>(
          <button key={opt.side}
            onClick={()=>dispatch({type:"CHOOSE_SIDE",payload:opt.side})}
            style={{background:"transparent",border:`2px solid ${opt.color}`,
              borderRadius:16,padding:"24px 40px",cursor:"pointer",
              display:"flex",flexDirection:"column",alignItems:"center",gap:8}}
            onMouseEnter={e=>e.currentTarget.style.background=opt.color+"18"}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <span style={{fontSize:40}}>{opt.emoji}</span>
            <span style={{fontWeight:900,fontSize:16,color:opt.color}}>{opt.label}</span>
            <span style={{fontSize:10,color:C.textMuted}}>{opt.hint}</span>
          </button>
        ))}
      </div>
    </div>
  );

  // ── PLAYING ──
  if (stage==="playing") return (
    <div style={{padding:"10px 16px",display:"flex",flexDirection:"column",minHeight:"calc(100vh - 56px)",boxSizing:"border-box"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,flexWrap:"wrap"}}>
        <span style={{fontWeight:800,fontSize:14,color:C.primaryLight}}>{boType} vs {rivalName}</span>
        <div style={{display:"flex",gap:5}}>
          {Array.from({length:bo.total},(_,i)=>(
            <div key={i} style={{width:24,height:24,borderRadius:"50%",display:"flex",
              alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,
              background:i<completedGames.length
                ?completedGames[i].result==="WIN"?C.win+"30":C.lose+"30"
                :i===currentGame-1?C.primary+"30":"transparent",
              border:`2px solid ${i<completedGames.length
                ?completedGames[i].result==="WIN"?C.win:C.lose
                :i===currentGame-1?C.primary:C.border}`,
              color:i<completedGames.length
                ?completedGames[i].result==="WIN"?C.win:C.lose
                :i===currentGame-1?C.primary:C.textMuted}}>
              {i<completedGames.length?(completedGames[i].result==="WIN"?"W":"L"):i+1}
            </div>
          ))}
        </div>
        <span style={{fontSize:11,padding:"2px 10px",borderRadius:99,fontWeight:700,
          background:ourSide==="blue"?C.blue+"20":C.red+"20",
          color:ourSide==="blue"?C.blue:C.red}}>
          {ourSide==="blue"?"🔵 Blue":"🔴 Red"} Side
        </span>
        <div style={{marginLeft:"auto",display:"flex",gap:8}}>
          <button onClick={()=>{if(window.confirm("จบ session นี้เลยไหม?"))onFinishSession(completedGames);}}
            style={{background:"transparent",border:`1px solid ${C.win}60`,color:C.win,
              borderRadius:8,padding:"4px 12px",cursor:"pointer",fontSize:12,fontWeight:700}}>
            ✅ Finish
          </button>
          <button onClick={()=>{if(window.confirm("ยกเลิก session นี้?"))dispatch({type:"RESET"});}}
            style={{background:"transparent",border:`1px solid ${C.lose}40`,color:C.lose,
              borderRadius:8,padding:"4px 12px",cursor:"pointer",fontSize:12}}>
            ✕ ยกเลิก
          </button>
        </div>
      </div>

      {/* board */}
      <div style={{border:`2px solid ${C.border}`,borderRadius:14,overflow:"hidden",marginBottom:8,
        flex:1,display:"flex",flexDirection:"column",minHeight:0}}>
        <div style={{background:"#0d0b1e",padding:"8px 16px",display:"flex",alignItems:"center",
          gap:10,borderBottom:`1px solid ${C.border}`,flexWrap:"wrap"}}>
          <span style={{fontWeight:900,color:C.primaryLight,fontSize:14}}>{boType} — Game {currentGame}</span>
          <div style={{padding:"3px 12px",borderRadius:99,fontWeight:700,fontSize:11,
            background:phaseColor+"22",color:phaseColor,border:`1px solid ${phaseColor}50`}}>
            {phaseLabel}
          </div>
          <span style={{fontSize:10,padding:"2px 10px",borderRadius:99,fontWeight:700,
            background:ourSide==="blue"?C.blue+"20":C.red+"20",
            color:ourSide==="blue"?C.blue:C.red}}>
            {ourSide==="blue"?"🔵 Blue":"🔴 Red"}
          </span>
          {globalLockedOur.size>0&&(
            <div style={{fontSize:10,color:C.win,background:C.win+"15",padding:"2px 10px",
              borderRadius:99,border:`1px solid ${C.win}30`}}>
              🛡️ {[...globalLockedOur].join(", ")}
            </div>
          )}
          {globalLockedEnemy.size>0&&(
            <div style={{fontSize:10,color:C.lose,background:C.lose+"15",padding:"2px 10px",
              borderRadius:99,border:`1px solid ${C.lose}30`}}>
              ⚔️ {[...globalLockedEnemy].join(", ")}
            </div>
          )}
          <div style={{flex:1}}/>
          <button onClick={()=>dispatch({type:"UNDO"})} disabled={step===0}
            style={{background:C.bgCard,border:`1px solid ${C.border}`,
              color:step===0?"#3a3a5c":C.textMuted,borderRadius:7,padding:"4px 12px",
              cursor:step===0?"not-allowed":"pointer",fontSize:11,fontWeight:700}}>
            ↩ Undo
          </button>
        </div>

        <div style={{display:"flex",flex:1,minHeight:420}}>
          <TeamPanelR side="blue" isOurTeam={ourSide==="blue"}
            bans={blueBans} picks={bluePicks} cur={cur}
            roster={roster} enemyRoster={currentEnemyRoster}
            onPlayerChange={(i,v)=>dispatch({type:"SET_PLAYER",payload:{team:"blue",idx:i,playerName:v}})}
          />
          {/* center hero grid */}
          <div style={{flex:1,display:"flex",flexDirection:"column",padding:"10px 12px",overflowY:"auto",background:C.bgBase}}>
            <PhaseTracker step={step}/>

            {/* ── Draft Suggestion from history ── */}
            {cur && cur.action==="pick" && cur.team===ourSide && (() => {
              // collect enemy picks so far this game
              const enemyPicksSoFar = (ourSide==="blue" ? redPicks : bluePicks)
                .filter(s=>s.hero).map(s=>s.hero.name);
              if (!enemyPicksSoFar.length) return null;

              // find games where enemy picked similar heroes and we won
              const heroWinRate = {}; // { heroName: {wins, total} }
              allGames.forEach(g => {
                const ep = (g.enemyPicks||[]).filter(s=>s.hero?.name).map(s=>s.hero.name);
                const op = (g.ourPicks||[]).filter(s=>s.hero?.name).map(s=>s.hero.name);
                const overlap = enemyPicksSoFar.filter(h=>ep.includes(h));
                if (overlap.length === 0) return;
                const win = g.result==="WIN";
                op.forEach(h=>{
                  if (!heroWinRate[h]) heroWinRate[h] = {wins:0,total:0};
                  heroWinRate[h].total++;
                  if (win) heroWinRate[h].wins++;
                });
              });

              const suggestions = Object.entries(heroWinRate)
                .filter(([,s])=>s.total>=1)
                .map(([name,s])=>({name,wr:Math.round(s.wins/s.total*100),total:s.total}))
                .sort((a,b)=>b.wr-a.wr||b.total-a.total)
                .slice(0,5);

              if (!suggestions.length) return null;

              return (
                <div style={{marginBottom:8,background:"#0d0b1e",borderRadius:10,
                  padding:"8px 12px",border:`1px solid ${C.primary}40`}}>
                  <div style={{fontSize:10,fontWeight:800,color:C.primaryLight,marginBottom:6}}>
                    💡 แนะนำ Pick — vs {enemyPicksSoFar.join(", ")}
                  </div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {suggestions.map(s=>(
                      <div key={s.name}
                        onClick={()=>{
                          const h=HERO_DATA.find(h=>h.name===s.name);
                          if(h&&!usedThisGame.has(s.name))selectHero(h);
                        }}
                        style={{display:"flex",alignItems:"center",gap:5,
                          background:s.wr>=60?C.win+"20":s.wr>=50?C.primary+"20":C.border+"40",
                          border:`1px solid ${s.wr>=60?C.win:s.wr>=50?C.primary:C.border}`,
                          borderRadius:8,padding:"4px 8px",cursor:"pointer"}}>
                        <HeroChip name={s.name} size={20} fontSize={11} bold={true}/>
                        <span style={{fontSize:10,fontWeight:800,
                          color:s.wr>=60?C.win:s.wr>=50?C.primaryLight:C.textMuted}}>
                          {s.wr}%
                        </span>
                        <span style={{fontSize:9,color:C.textMuted}}>({s.total})</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div style={{display:"flex",gap:5,marginBottom:8,flexWrap:"wrap",alignItems:"center"}}>
              <input value={search}
                onChange={e=>dispatch({type:"SET_SEARCH",payload:e.target.value})}
                placeholder="🔍 Hero..."
                style={{...iStyle,width:140,padding:"5px 10px",fontSize:12}}/>
              {ROLES_FILTER.map(r=>(
                <button key={r} onClick={()=>dispatch({type:"SET_ROLE_FILTER",payload:r})} style={{
                  background:roleFilter===r?(ROLE_COLOR[r]||C.primary):"#14112a",
                  border:`1px solid ${roleFilter===r?(ROLE_COLOR[r]||C.primary):C.border}`,
                  color:roleFilter===r?"#fff":C.textMuted,
                  borderRadius:99,padding:"3px 9px",fontSize:10,cursor:"pointer",fontWeight:700}}>{r}</button>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(66px,1fr))",gap:4,flex:1}}>
              {filtered.map(hero=>{
                const usedHere = usedThisGame.has(hero.name);
                const glLocked = isGlobalLocked(hero.name);
                const disabled = usedHere || glLocked;
                const isBanned = [...blueBans,...redBans].some(h=>h?.name===hero.name);
                const glBadgeColor = cur?.action==="pick"?(cur.team===ourSide?C.win:C.lose):C.primary;
                return (
                  <div key={hero.name}
                    onClick={()=>selectHero(hero)}
                    title={usedHere?"ใช้แล้ว":glLocked?"Global Lock":""}
                    style={{opacity:disabled?0.2:1,cursor:disabled?"not-allowed":"pointer",
                      transition:"transform .1s",position:"relative"}}
                    onMouseEnter={e=>{if(!disabled)e.currentTarget.style.transform="scale(1.08)";}}
                    onMouseLeave={e=>{e.currentTarget.style.transform="scale(1)";}}>
                    <HeroCard hero={hero} size={66} banned={isBanned}/>
                    {glLocked&&!usedHere&&(
                      <div style={{position:"absolute",top:2,left:2,background:glBadgeColor,
                        color:"#fff",fontSize:8,fontWeight:800,padding:"1px 4px",borderRadius:4}}>GL</div>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{marginTop:6,display:"flex",gap:5,flexWrap:"wrap"}}>
              {DRAFT_ORDER.slice(step+1,step+4).map((s,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:4,background:C.bgPanel,
                  borderRadius:6,padding:"3px 8px",border:`1px solid ${C.border}`}}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:s.team==="blue"?C.blue:C.red}}/>
                  <span style={{fontSize:9,color:s.action==="ban"?C.ban:C.win,fontWeight:700}}>
                    {s.action==="ban"?"BAN":"PICK"}
                  </span>
                  <span style={{fontSize:9,color:s.team===ourSide?C.primaryLight:C.textMuted}}>
                    {s.team===ourSide?"เรา":"คู่แข่ง"}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <TeamPanelR side="red" isOurTeam={ourSide==="red"}
            bans={redBans} picks={redPicks} cur={cur}
            roster={roster} enemyRoster={currentEnemyRoster}
            onPlayerChange={(i,v)=>dispatch({type:"SET_PLAYER",payload:{team:"red",idx:i,playerName:v}})}
          />
        </div>

        {/* meta bar */}
        <div style={{background:"#0d0b1e",borderTop:`1px solid ${C.border}`,padding:"10px 16px",
          display:"flex",gap:10,alignItems:"flex-end",flexWrap:"wrap"}}>
          {[
            {label:"ผล",key:"result",type:"select",opts:["WIN","LOSE"],w:88},
            {label:"คิลเรา",key:"ourScore",type:"number",placeholder:"0",w:75},
            {label:"คิลศัตรู",key:"enemyScore",type:"number",placeholder:"0",w:75},
            {label:"เวลา(นาที.วินาที)",key:"duration",type:"text",placeholder:"09.45",w:96},
          ].map(f=>(
            <div key={f.key}>
              <div style={{fontSize:10,color:C.textMuted,marginBottom:3}}>{f.label}</div>
              {f.type==="select"
                ?<select value={meta[f.key]}
                    onChange={e=>dispatch({type:"SET_META",payload:{[f.key]:e.target.value}})}
                    style={{...iStyle,width:f.w,padding:"5px 8px",fontSize:12,fontWeight:700,
                      color:meta[f.key]==="WIN"?C.win:C.lose}}>
                    {f.opts.map(o=><option key={o}>{o}</option>)}
                  </select>
                :<input type={f.type} inputMode={f.key==="duration"?"decimal":undefined}
                    placeholder={f.placeholder} value={meta[f.key]}
                    onChange={e=>dispatch({type:"SET_META",payload:{[f.key]:e.target.value}})}
                    onBlur={f.key==="duration" ? e=>dispatch({type:"SET_META",payload:{duration:normalizeDuration(e.target.value)}}) : undefined}
                    style={{...iStyle,width:f.w,padding:"5px 8px",fontSize:12}}/>
              }
            </div>
          ))}
          <div>
            <label style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color:C.textMuted,
              marginBottom:3,cursor:"pointer",userSelect:"none",whiteSpace:"nowrap"}}>
              <input type="checkbox" checked={meta.hasPause}
                onChange={e=>dispatch({type:"SET_META",payload:{hasPause:e.target.checked, ...(e.target.checked?{}:{pauseDuration:""})}})}/>
              ⏸️ มีหยุดเกม
            </label>
            {meta.hasPause && (
              <input type="text" inputMode="decimal" placeholder="00.00"
                title="เวลาที่หยุดเกมไปทั้งหมด (นาที.วินาที)"
                value={meta.pauseDuration}
                onChange={e=>dispatch({type:"SET_META",payload:{pauseDuration:e.target.value}})}
                onBlur={e=>dispatch({type:"SET_META",payload:{pauseDuration:normalizeDuration(e.target.value)}})}
                style={{...iStyle,width:96,padding:"5px 8px",fontSize:12}}/>
            )}
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:10,color:C.textMuted,marginBottom:3}}>Coach Notes</div>
            <input placeholder="วิเคราะห์เกมนี้..." value={meta.note}
              onChange={e=>dispatch({type:"SET_META",payload:{note:e.target.value}})}
              style={{...iStyle,padding:"5px 10px",fontSize:12}}/>
          </div>
          <button onClick={handleGameDone}
            style={{background:`linear-gradient(135deg,${C.primary},${C.primaryLight})`,
              color:"#fff",border:"none",borderRadius:8,padding:"8px 22px",
              cursor:"pointer",fontWeight:800,fontSize:13,whiteSpace:"nowrap"}}>
            ✅ บันทึก Game {currentGame}
          </button>
        </div>
      </div>
    </div>
  );

  // ── DONE ──
  const ourWins = completedGames.filter(g=>g.result==="WIN").length;
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      minHeight:"calc(100vh - 60px)",gap:16,background:C.bgBase}}>
      <div style={{fontSize:52}}>{ourWins>completedGames.length/2?"🏆":"😔"}</div>
      <h2 style={{margin:0,fontSize:22,fontWeight:800}}>{boType} เสร็จสิ้น: vs {rivalName}</h2>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"center"}}>
        {completedGames.map((g,i)=>(
          <span key={i} style={{padding:"5px 16px",borderRadius:99,fontWeight:800,
            background:g.result==="WIN"?C.win+"20":C.lose+"20",
            color:g.result==="WIN"?C.win:C.lose}}>
            G{i+1} {g.result}
          </span>
        ))}
      </div>
      <p style={{color:C.textMuted,fontSize:13,margin:0}}>บันทึกลง Match Log เรียบร้อย!</p>
      <button onClick={()=>dispatch({type:"RESET"})}
        style={{background:`linear-gradient(135deg,${C.primary},${C.primaryLight})`,
          color:"#fff",border:"none",borderRadius:10,padding:"12px 32px",
          fontWeight:800,fontSize:15,cursor:"pointer",marginTop:8}}>
        ⚔️ เริ่ม Session ใหม่
      </button>
    </div>
  );
}

// TeamPanel renamed to TeamPanelR (same logic, already stateless)
function TeamPanelR({ side, isOurTeam, bans, picks, cur, roster, enemyRoster=[], onPlayerChange }) {
  const color       = side==="blue" ? C.blue : C.red;
  const isActive    = cur?.team===side;
  const isBanPhase  = cur?.action==="ban";
  const isPickPhase = cur?.action==="pick";
  const usedPlayers = new Set(picks.map(s=>s.player).filter(Boolean));

  return (
    <div style={{width:190,background:"#0e0b1e",
      borderRight:side==="blue"?`1px solid ${C.border}`:"none",
      borderLeft: side==="red" ?`1px solid ${C.border}`:"none",
      padding:"12px 10px",display:"flex",flexDirection:"column",gap:10,
      boxShadow:isActive?`inset 0 0 0 2px ${color}50`:"none",
      transition:"box-shadow .2s",overflowY:"auto"}}>
      <div style={{textAlign:"center"}}>
        <div style={{display:"inline-flex",alignItems:"center",gap:6}}>
          <div style={{width:10,height:10,borderRadius:"50%",background:color}}/>
          <span style={{fontWeight:900,fontSize:14,color,letterSpacing:1}}>
            {side==="blue"?"BLUE":"RED"}
          </span>
        </div>
        <div style={{marginTop:4}}>
          <span style={{fontSize:10,fontWeight:800,padding:"2px 10px",borderRadius:99,
            background:isOurTeam?C.win+"25":C.lose+"20",color:isOurTeam?C.win:C.lose,
            border:`1px solid ${isOurTeam?C.win+"60":C.lose+"50"}`}}>
            {isOurTeam?"🛡️ ทีมเรา":"⚔️ คู่แข่ง"}
          </span>
        </div>
        {isActive&&(
          <div style={{fontSize:10,color,background:color+"20",borderRadius:99,
            padding:"2px 8px",marginTop:4,fontWeight:700,display:"inline-block"}}>
            {isBanPhase?"🚫 กำลัง BAN":"⚔️ กำลัง PICK"}
          </div>
        )}
      </div>
      <div>
        <div style={{fontSize:10,color:C.ban,fontWeight:700,marginBottom:5,letterSpacing:1}}>— BAN —</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
          {bans.map((hero,i)=>{
            const isCur=isActive&&isBanPhase&&cur?.slot===i&&!hero;
            return (
              <div key={i} style={{borderRadius:8,overflow:"hidden",
                border:isCur?`2px solid ${C.ban}`:`2px solid ${C.border}`,
                background:C.bgPanel,height:60,display:"flex",alignItems:"center",justifyContent:"center",
                boxShadow:isCur?`0 0 10px ${C.ban}70`:"none"}}>
                {hero
                  ?<HeroCard hero={hero} size={56} banned showName={false}/>
                  :<span style={{fontSize:isCur?18:14,color:isCur?C.ban:"#2a1f4e"}}>{isCur?"🚫":"○"}</span>}
              </div>
            );
          })}
        </div>
      </div>
      <div style={{height:1,background:C.border}}/>
      <div style={{flex:1}}>
        <div style={{fontSize:10,color,fontWeight:700,marginBottom:5,letterSpacing:1}}>— PICKS —</div>
        <div style={{display:"flex",flexDirection:"column",gap:5}}>
          {picks.map((slot,i)=>{
            const isCur=isActive&&isPickPhase&&cur?.slot===i&&!slot.hero;
            const availableRoster = isOurTeam ? roster : enemyRoster;
            return (
              <div key={i} style={{display:"flex",alignItems:"center",gap:6,
                background:isCur?color+"12":C.bgPanel,borderRadius:10,padding:"4px 7px",
                border:isCur?`2px solid ${color}`:`2px solid ${C.border}`,
                boxShadow:isCur?`0 0 10px ${color}50`:"none",
                minHeight:55,transition:"all .2s"}}>
                {slot.hero ? (
                  <div style={{display:"flex",flexDirection:"column",gap:3,width:"100%"}}>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <HeroCard hero={slot.hero} size={40} showName={false}/>
                      <div>
                        <div style={{fontSize:12,fontWeight:800,lineHeight:1.2}}>{slot.hero.name}</div>
                        <div style={{fontSize:10,color:ROLE_COLOR[slot.hero.role],fontWeight:700}}>{slot.role}</div>
                      </div>
                    </div>
                    <select value={slot.player||""} onChange={e=>onPlayerChange(i,e.target.value)}
                      style={{...iStyle,fontSize:11,padding:"3px 6px",
                        color:slot.player?(isOurTeam?C.primaryLight:C.lose):C.textMuted}}>
                      <option value="">— เลือกผู้เล่น —</option>
                      {availableRoster.map(p=>(
                        <option key={p} value={p} disabled={usedPlayers.has(p)&&slot.player!==p}>
                          {p}{usedPlayers.has(p)&&slot.player!==p?" ✓":""}
                        </option>
                      ))}
                      {availableRoster.length===0&&(
                        <option disabled value="">ไม่มี Roster — เพิ่มใน Roster</option>
                      )}
                    </select>
                  </div>
                ) : (
                  <div style={{display:"flex",alignItems:"center",gap:8,width:"100%"}}>
                    <div style={{width:40,height:40,borderRadius:8,flexShrink:0,
                      border:`2px dashed ${isCur?color:C.border}`,
                      display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <span style={{fontSize:18,color:isCur?color:"#2a2550"}}>{isCur?"✛":"+"}</span>
                    </div>
                    <div>
                      <div style={{fontSize:11,color:isCur?color:"#3a3a5c",fontWeight:700}}>{slot.role}</div>
                      <div style={{fontSize:10,color:"#2a2550"}}>{isCur?"เลือก Hero":"รอ Pick"}</div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
