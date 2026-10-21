"use client";
import { matchTime } from "@/lib/matchTime";
import { printRivalBrief } from "@/components/matchlog/rivalBrief";
import { useState, useEffect, useReducer, useCallback, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { useSession, signOut } from "next-auth/react";
import { upload } from "@vercel/blob/client";
import { loadFromStorage, saveToStorage, clearOfflineData, hasUnsyncedChanges, fieldJsonOf } from "@/lib/storage";
import { idbGet, idbSet } from "@/lib/offlineStore";
import { setupPwa, precacheImages, precachePageShell } from "@/lib/pwa";
import { OfflinePanel } from "@/components/common/OfflinePanel";
import { deleteBlobUrls } from "@/lib/blobCleanup";
import { compressImage } from "@/lib/imageCompress";
import { HERO_DATA } from "@/lib/heroes";
import { HeroPhotosContext } from "@/lib/useHeroImage";
import { C, iStyle } from "@/lib/theme";
import { HeroChip } from "@/components/shared/HeroChip";
import { PhotoPicker, ImageCropModal } from "@/components/shared/PlayerMedia";
import { ToastProvider, useToast } from "@/lib/toast";
import { LogoImg } from "@/components/shared/TeamLogo";
import { TeamCard } from "@/components/shared/TeamCard";
import { NoTeamScreen } from "@/components/shared/NoTeamScreen";
import { PerformanceTrend, CoachNotesHub } from "@/components/shared/PerformanceTrend";
import { HeroImageManager } from "@/components/shared/HeroImageManager";
import { PatchSelector, RosterPlayerCard } from "@/components/shared/RosterPlayerCard";
import { ScheduleReminder } from "@/components/shared/ScheduleReminder";
import { GoogleCalendarConnect } from "@/components/shared/GoogleCalendarConnect";
import { YoutubeAutoImport } from "@/components/shared/YoutubeAutoImport";
import { minutesToDurationStr, playedMinutes } from "@/lib/duration";
import { DRAFT_LS_KEY, draftKeyFor } from "@/components/draft/constants";
import { DraftPageR } from "@/components/draft/DraftPage";
import { HeroSynergyCounter } from "@/components/matchlog/HeroSynergyCounter";
import { MatchCardWithStats } from "@/components/matchlog/MatchCard";
import { ObjectiveSummaryDisplay, adaptScoutGamesForPlayerProfile, computeObjectiveSummary, flattenScoutGamesForFocus } from "@/components/matchlog/objectives";
import { PatchMetaCard } from "@/components/matchlog/PatchMetaCard";
import { PlayerProfile } from "@/components/matchlog/PlayerProfile";
import { RecentActivityWidget, WeeklyMonthlySummary } from "@/components/matchlog/periodSummary";
import { RivalStatsSection } from "@/components/matchlog/RivalStatsSection";
import { ScoutLogPage } from "@/components/scoutlog/ScoutLogPage";
import { appReducer, initAppState, initUIState, uiReducer } from "@/components/common/appState";
import { computePlayerTeamBreakdown, filterMatchesByPatch, getCurrentTeamOf, isMembershipActiveForPatch } from "@/components/common/patchUtils";
import { draftReducer, initDraftState } from "@/components/draft/draftState";
import { escHtml, exportCSV, exportJSON, importJSON } from "@/components/matchlog/dataIO";
import { useIsMobile, usePatchVersions } from "@/components/common/hooks";

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
const HelpPage = dynamic(
  () => import("@/components/shared/HelpPage").then(m => m.HelpPage),
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

// ── ช่องรับผู้เล่นที่ลากมา (ย้ายทีม) — แสดงในแท็บ "ทีมเรา" ข้างการ์ดผู้เล่นที่ลากได้ ──
// ต้องอยู่หน้าเดียวกับการ์ดผู้เล่นเสมอ (การ์ดผู้เล่นอยู่แท็บ "ทีมเรา" ส่วนการ์ดทีมคู่แข่งอยู่แท็บ "คู่แข่ง" — ลากข้ามแท็บไม่ได้)
// ── แถบรับผู้เล่นที่ลากมา (ย้ายทีม) — ปกติ "ย่อ/ซ่อน" อยู่ โผล่มาเฉพาะตอนกำลังลากการ์ดผู้เล่นจริงๆ ──
// ใช้การ์ด TeamCard ตัวเดียวกับที่หน้า Rivals ใช้ (ใหญ่ มีโลโก้เต็ม) ตามที่ขอ แทนที่ pill เล็กๆ แบบเดิม
// รองรับลากจากทีมไหนไปทีมไหนก็ได้ — รายชื่อทีมเป้าหมายคำนวณจาก "ทุกทีมที่มี ยกเว้นทีมต้นทางที่กำลังลากออกมา"
function TransferDropZone({ draggingPlayer, draggingFromTeam, ourTeamName, ourTeamLogo, rivals, rivalLogos, statsOf, onDrop }) {
  if (!draggingPlayer) return null; // ย่ออยู่เป็นค่าเริ่มต้นเสมอ — render ก็ไม่ render เลยถ้าไม่ได้ลากอยู่

  const targets = [
    { key: "our", name: ourTeamName, logoUrl: ourTeamLogo },
    ...rivals.map(r => ({ key: r.name, name: r.name, logoUrl: rivalLogos?.[r.name] })),
  ].filter(t => t.key !== draggingFromTeam);

  if (targets.length === 0) return null; // ไม่มีทีมอื่นให้ย้ายไปเลย (เช่นยังไม่มี Rival สักทีม)

  return (
    <div style={{position:"sticky",top:8,zIndex:40,marginBottom:16,
      background:C.bgPanel,border:`2px dashed ${C.primary}70`,borderRadius:14,
      padding:"12px 14px",boxShadow:"0 8px 24px rgba(0,0,0,0.35)"}}>
      <div style={{fontSize:12,fontWeight:800,color:C.primaryLight,marginBottom:10,textAlign:"center"}}>
        📥 ปล่อย "{draggingPlayer}" ที่ทีมที่ต้องการย้ายไป
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10}}>
        {targets.map(t => (
          <div key={t.key}>
            <TeamCard name={t.name} logoUrl={t.logoUrl}
              {...(statsOf ? statsOf(t.key) : { hideStats:true, winRatePct:null })}
              accentColor={t.key==="our" ? C.primary : C.lose}
              onDropPlayer={(name)=>onDrop(name, draggingFromTeam, t.key)}/>
          </div>
        ))}
      </div>
    </div>
  );
}

// PracticePage moved to components/shared/PracticePage.js

// MyStatsPage moved to components/shared/MyStatsPage.js

// NoTeamScreen moved to components/shared/NoTeamScreen.js

// chunk ของหน้า lazy — ตอนกด "เตรียมออฟไลน์" โหลดมาให้ครบ เพื่อให้ service worker เก็บไว้
// (ไม่งั้นหน้าที่ยังไม่เคยเปิดตอนออนไลน์ จะเปิดไม่ได้ตอน offline)
const LAZY_CHUNK_LOADERS = [
  () => import("@/components/shared/SchedulePage"),
  () => import("@/components/shared/VideoLibrary"),
  () => import("@/components/shared/PracticePage"),
  () => import("@/components/shared/MyStatsPage"),
  () => import("@/components/shared/HelpPage"),
  () => import("@/components/shared/Analytics"),
  () => import("@/components/shared/TacticalWhiteboard"),
  () => import("@/components/shared/AdminPanel"),
];

// ═══════════════════════════════════════════
//  MAIN APP
// ═══════════════════════════════════════════
function RovAppInner() {
  const { data: session, update: updateSession } = useSession();
  const toast = useToast();
  // ── ผู้ใช้ที่จำไว้ในเครื่อง — ใช้ตอน offline ที่ useSession() เรียก /api/auth/session ไม่ได้ ──
  // ใช้แค่ตัดสิน UI (เมนู Live Draft, key ของ draft autosave) — สิทธิ์จริงยังบังคับที่ server ตอน sync เสมอ
  const [cachedUser, setCachedUser] = useState(null);
  useEffect(() => {
    idbGet("user").then(u => { if (u) setCachedUser(u); }).catch(() => {});
  }, []);
  useEffect(() => {
    const u = session?.user;
    if (!u?.id) return;
    const slim = { id:u.id, email:u.email, name:u.name, role:u.role, teamId:u.teamId, teamName:u.teamName, playerName:u.playerName };
    setCachedUser(slim);
    idbSet("user", slim).catch(() => {});
  }, [session?.user?.id, session?.user?.role, session?.user?.playerName, session?.user?.teamName]); // eslint-disable-line react-hooks/exhaustive-deps
  const effectiveUser = session?.user || cachedUser;
  const sessionLike = session || (cachedUser ? { user: cachedUser } : session); // ให้หน้าลูกที่อ่าน session.user ใช้ได้ตอน offline
  const userRole = effectiveUser?.role || "member"; // "admin" | "coach" | "member"
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
  useEffect(() => { setupPwa(); }, []); // service worker + manifest + persist storage (ใช้งานออฟไลน์)

  // ── Patch filter — ใช้ทั่วทั้งแอป (Overview/Rivals/Roster/My Stats อ่าน allGames ตัวเดียวกัน) ──
  const patchVersions = usePatchVersions();
  const [selectedPatch, setSelectedPatch] = useState("current");

  // ── Autosave in-progress draft ไว้ที่ localStorage ──
  // ป้องกันเสีย progress ทั้งหมดถ้าแท็บ crash/refresh/ปิดพลาดกลางคันตอน
  // กำลัง ban/pick อยู่ (ระหว่างแข่งจริง ที่กดดันเรื่องเวลามาก เสียแล้วเสียเลย)
  const draftKey = draftKeyFor(effectiveUser?.id);
  useEffect(() => {
    try { localStorage.removeItem(DRAFT_LS_KEY); } catch {} // ล้าง key แบบเก่าที่ไม่ผูกกับผู้ใช้
  }, []);
  useEffect(() => {
    if (!draftKey) return; // session ยังไม่พร้อม — อย่าเขียนลง key ที่ไม่รู้เจ้าของ
    try {
      if (draft.stage === "setup") {
        localStorage.removeItem(draftKey);
      } else {
        localStorage.setItem(draftKey, JSON.stringify(draft));
      }
    } catch (err) {
      console.warn("Draft autosave to localStorage failed (non-fatal):", err);
    }
  }, [draft, draftKey]);
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved | error | offline
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    setIsOnline(navigator.onLine !== false);
    const on = () => setIsOnline(true), off = () => setIsOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  const [heroDataVersion, setHeroDataVersion] = useState(0); // bump to force re-render after HERO_DATA mutation
  // 1400px covers iPad landscape (max ~1366 CSS px) too — with 13 nav items
  // + team name + user badge, nothing narrower than a genuinely wide
  // monitor can fit them in one row without an ugly wrap.
  const isMobile = useIsMobile(1400);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // ── load from Database on mount ──
  useEffect(() => {
    let cancelled = false;
    let retryTimer = null;

    function attemptLoad(retriesLeft) {
      loadFromStorage().then(loaded => {
        if (cancelled) return;
        if (loaded.loadError) {
          // ── never dispatch a failed load as if it were real data ──
          // Previously this branch didn't exist: a failed load returned
          // FALLBACK (empty matches/roster/etc, but _loaded:true), got
          // dispatched anyway, and 600ms later autosave would write that
          // emptiness back to the server — turning one bad network
          // request into real, permanent data loss. Now: don't touch
          // `app` at all on failure (it stays in its pre-load default
          // state, which has no `_loaded` flag, so autosave stays off),
          // retry a couple of times with backoff for transient blips
          // (cold start, brief network drop), and only bother the user
          // with an error if every retry fails.
          console.error("Initial load failed:", loaded.loadErrorMessage);
          if (loaded.offlineNoSnapshot) {
            // ไม่มีเน็ตและเครื่องนี้ยังไม่เคยเตรียมข้อมูล — retry ไม่ช่วย บอกตรงๆ
            toast(loaded.loadErrorMessage, "error", 12000);
            return;
          }
          if (retriesLeft > 0) {
            retryTimer = setTimeout(() => attemptLoad(retriesLeft - 1), 2000);
          } else {
            toast("โหลดข้อมูลทีมไม่สำเร็จ กรุณารีเฟรชหน้าเว็บ", "error", 10000);
          }
          return;
        }
        dispatchApp({ type:"LOAD_FROM_STORAGE", payload: loaded });
        if (loaded.offline) {
          setSaveStatus("offline");
          toast("ไม่มีอินเทอร์เน็ต — เปิดจากข้อมูลที่เก็บไว้ในเครื่อง การแก้ไขจะถูกส่งขึ้นระบบเมื่อกลับมาออนไลน์", "info", 8000);
        } else if (loaded.recoveredOffline) {
          toast("พบงานที่แก้ไว้ตอนออฟไลน์ กำลังส่งขึ้นระบบ...", "info", 6000);
        }
      });
    }

    attemptLoad(3); // initial try + up to 3 retries (2s apart) before giving up
    return () => { cancelled = true; if (retryTimer) clearTimeout(retryTimer); };
  }, [toast]);

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

  const conflictRetryRef = useRef(0);
  const ignoredToastRef = useRef(""); // จำชุด field ที่เคยแจ้งไปแล้ว จะได้ไม่เด้ง toast ซ้ำทุกครั้งที่ autosave
  const conflictRetryTimerRef = useRef(null);
  const offlineToastRef = useRef(false);
  const runAutosaveRef = useRef(null);
  const MAX_CONFLICT_RETRIES = 4;

  const runAutosave = useCallback(async () => {
    if (savingRef.current) { pendingRef.current = true; return; } // already saving — queue exactly one more round
    savingRef.current = true;
    setSaveStatus("saving");
    try {
      await saveToStorage(app);
      offlineToastRef.current = false;
      conflictRetryRef.current = 0; // a clean save means we're caught up — reset the retry counter
      setSaveStatus("saved");
      setTimeout(()=>setSaveStatus("idle"), 2000);
    } catch (err) {
      if (err.wasIgnored) {
        // ── server รับ request แต่ทิ้งบาง field เพราะบัญชีนี้ไม่มีสิทธิ์แก้ (member) ──
        // ไม่ใช่ความล้มเหลวของระบบ (ส่วนที่มีสิทธิ์ถูกบันทึกแล้ว) แต่ต้องบอกผู้ใช้ตรงๆ ว่าส่วนที่แก้ไม่ถูกเก็บ
        // ไม่งั้นจะเห็น "บันทึกแล้ว ✅" ทั้งที่รีเฟรชแล้วค่าเดิมกลับมา
        conflictRetryRef.current = 0;
        setSaveStatus("saved");
        setTimeout(()=>setSaveStatus("idle"), 2000);
        const IGNORED_LABEL = { matches:"แมตช์", rivals:"ทีมคู่แข่ง", roster:"Roster", enemyRosters:"Roster คู่แข่ง",
          rosterMembership:"ประวัติย้ายทีม",
          scoutMatches:"Scout", playerPhotos:"รูปผู้เล่น", teamLogo:"โลโก้ทีม", rivalLogos:"โลโก้คู่แข่ง",
          schedules:"ตารางแข่ง", patchInfo:"Patch notes", heroTiers:"Tier list", practiceAssignments:"การบ้านฝึกซ้อม" };
        const key = (err.ignoredFields||[]).join(",");
        if (ignoredToastRef.current !== key) {
          ignoredToastRef.current = key;
          const names = (err.ignoredFields||[]).map(f=>IGNORED_LABEL[f]||f).join(", ");
          toast(`บัญชีของคุณแก้ส่วนนี้ไม่ได้ (${names}) — การเปลี่ยนแปลงจะไม่ถูกบันทึก รีเฟรชหน้าเพื่อดูข้อมูลจริงของทีม`, "error", 10000);
        }
      } else if (err.isOffline) {
        // ── ไม่มีเน็ต: งานถูกเก็บลงเครื่องแล้ว ไม่ retry รัว ไม่ toast ซ้ำ — รอ event online/กลับมาที่แท็บ ──
        conflictRetryRef.current = 0;
        setSaveStatus("offline");
        if (!offlineToastRef.current) {
          offlineToastRef.current = true;
          toast("ออฟไลน์ — เก็บการแก้ไขไว้ในเครื่องแล้ว จะส่งขึ้นระบบอัตโนมัติเมื่อมีอินเทอร์เน็ต", "info", 6000);
        }
      } else if (err.isAuth) {
        // session หมดอายุ — งานถูกเก็บไว้ในเครื่อง (ไม่ทิ้ง) ต้อง login ใหม่ก่อนส่ง
        setSaveStatus("error");
        toast("เซสชันหมดอายุ — กรุณาเข้าสู่ระบบใหม่ ข้อมูลที่ยังไม่ส่งถูกเก็บไว้ในเครื่องนี้และจะถูกส่งต่ออัตโนมัติหลัง login", "error", 15000);
      } else if (err.wasMerged) {
        // ── ชนกันแต่กู้คืนอัตโนมัติสำเร็จ ──
        // saveToStorage() พยายามรวมข้อมูลที่เพิ่ม (แมตช์/วิดีโอ/ตารางซ้อม
        // ฯลฯ) เข้ากับข้อมูลล่าสุดจาก server ให้แล้วและบันทึกสำเร็จ — ไม่ใช่
        // error จริง แค่ต้องโหลด state ฝั่ง client ใหม่ให้ตรงกับที่ merge
        // ไปแล้ว ไม่งั้นรอบ autosave ถัดไปจะส่งค่าเก่าทับซ้ำ (โดยเฉพาะ field
        // ที่ merge ไม่ได้ เช่น roster/photos ที่อีกฝ่ายอาจแก้ไปพร้อมกัน)
        conflictRetryRef.current = 0;
        setSaveStatus("saved");
        toast("มีการแก้ไขจากที่อื่นพร้อมกัน — รวมข้อมูลให้อัตโนมัติแล้ว ✅", "success", 5000);
        loadFromStorage().then(loaded => {
          if (loaded.loadError) {
            // ── DON'T wipe good local state over a failed refresh ──
            // The merged write already succeeded server-side (that's why
            // we're in this branch at all) — this GET is just to pull the
            // merged result back down so the client's view of non-
            // mergeable fields (roster/photos/etc, if someone else edited
            // those in the same window) stays in sync. If THIS request
            // fails, the old code dispatched FALLBACK anyway, replacing
            // perfectly good local data with empty placeholders — and
            // autosave would then save that emptiness right back to the
            // server. Now: leave `app` untouched and just tell the person
            // their view might be slightly stale for fields they can't
            // self-merge, rather than silently destroying their data.
            console.error("Post-merge refresh failed:", loaded.loadErrorMessage);
            toast("รวมข้อมูลสำเร็จ แต่โหลดข้อมูลล่าสุดไม่สำเร็จ — ลองรีเฟรชหน้าถ้าเห็นข้อมูลไม่ตรง", "error", 8000);
            return;
          }
          // รวมเฉพาะ field ที่ผู้ใช้ไม่ได้แก้เพิ่มระหว่างรอ — ไม่ replace ทั้งก้อนเหมือนเดิม (กันทับสิ่งที่พิมพ์ค้าง)
          dispatchApp({ type:"MERGE_LOADED", payload: { loaded, sentFieldJson: err.sentFieldJson } });
        });
        setTimeout(()=>setSaveStatus("idle"), 2000);
      } else {
        console.error("Save failed:", err);
        setSaveStatus("error");
        if (err.isConflict) {
          // ── ชนกันซ้ำสอง (double-conflict) — auto-retry แทนที่จะปล่อยค้าง ──
          // เคสนี้คือ merge อัตโนมัติใน saveToStorage() พยายามไปแล้วรอบนึง
          // แต่ก็ยังชนอยู่ดี (มีคนอื่นบันทึกซ้อนจังหวะเดียวกันสองชั้น) —
          // ก่อนหน้านี้โค้ดจะแค่โชว์ error แล้วหยุดเฉยๆ ไม่ลองใหม่เอง เพราะ
          // `app` ไม่เปลี่ยน useEffect ก็ไม่ยิงซ้ำจนกว่าจะมีการแก้ไขจุดอื่น
          // อีกครั้ง — แปลว่าแมตช์ที่เพิ่งจบจาก Live Draft อาจค้างอยู่แค่ใน
          // browser เฉยๆ โดยไม่มีใครลองบันทึกซ้ำให้เลย ถ้าปิดแท็บ/รีเฟรช
          // ไปตอนนั้นพอดี ข้อมูลจะหายจริง (ไม่เคยขึ้น server เลย) ทั้งที่
          // ปกติแค่รอสักครู่แล้วลองใหม่ก็น่าจะผ่าน (ชนกันแค่ชั่วขณะ ไม่ใช่
          // ปัญหาถาวร) — เลย retry อัตโนมัติให้เองสูงสุด 4 ครั้ง ห่างกันไป
          // เรื่อยๆ (3s/6s/12s/24s) ก่อนจะยอมแพ้แล้วบอกให้ user รีเฟรชเอง
          if (conflictRetryRef.current < MAX_CONFLICT_RETRIES) {
            conflictRetryRef.current += 1;
            const delay = 3000 * Math.pow(2, conflictRetryRef.current - 1); // 3s,6s,12s,24s
            toast(`มีการแก้ไขจากที่อื่นพร้อมกัน — กำลังลองบันทึกใหม่อีกครั้ง (${conflictRetryRef.current}/${MAX_CONFLICT_RETRIES})...`, "error", delay);
            if (conflictRetryTimerRef.current) clearTimeout(conflictRetryTimerRef.current);
            conflictRetryTimerRef.current = setTimeout(() => runAutosave(), delay);
          } else {
            toast("บันทึกไม่สำเร็จหลายครั้งติดกัน — กรุณารีเฟรชหน้าเว็บแล้วลองบันทึกใหม่ด้วยตัวเอง เพื่อไม่ให้ข้อมูลล่าสุดหายไป", "error", 15000);
            conflictRetryRef.current = 0;
          }
        } else if (err.code === "SHRINK_GUARD" || err.code === "PAYLOAD_TOO_LARGE") {
          // server ปฏิเสธเพื่อกันข้อมูลหาย/ใหญ่เกิน — ต้องให้ผู้ใช้รู้เหตุผลจริง ไม่ใช่ "ลองใหม่" (ลองซ้ำก็ไม่ผ่าน)
          toast(err.userMessage || err.message, "error", 15000);
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

  // ── กลับมาออนไลน์/กลับมาที่แท็บ (iOS ไม่มี Background Sync จึงต้องทำเองฝั่ง client) → ส่งงานที่ค้าง ──
  runAutosaveRef.current = runAutosave;
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === "hidden" || navigator.onLine === false) return;
      if (hasUnsyncedChanges()) runAutosaveRef.current?.();
    };
    window.addEventListener("online", flush);
    document.addEventListener("visibilitychange", flush);
    return () => { window.removeEventListener("online", flush); document.removeEventListener("visibilitychange", flush); };
  }, []);

  // ── ปุ่ม "เตรียมออฟไลน์" ──
  // 1) ส่งงานที่ค้างขึ้น server 2) โหลดข้อมูลล่าสุดลง snapshot 3) เก็บรูป/chunk/หน้าเว็บให้ service worker
  const [prep, setPrep] = useState({ running:false, msg:"" });
  const handlePrepareOffline = useCallback(async () => {
    if (prep.running) return;
    if (navigator.onLine === false) { toast("ต้องออนไลน์ก่อนถึงจะเตรียมข้อมูลได้", "error"); return; }
    setPrep({ running:true, msg:"กำลังส่งงานที่ค้างขึ้นระบบ..." });
    try {
      try { await saveToStorage(app); }
      catch (err) {
        if (!err.wasMerged && !err.wasIgnored) throw err; // merged/ignored = ส่งขึ้นแล้ว ไปต่อได้
      }
      setPrep({ running:true, msg:"กำลังโหลดข้อมูลทีมล่าสุด..." });
      const loaded = await loadFromStorage();
      if (loaded.loadError) throw new Error(loaded.loadErrorMessage || "โหลดข้อมูลไม่สำเร็จ");
      dispatchApp({ type:"MERGE_LOADED", payload:{ loaded, sentFieldJson: fieldJsonOf(app) } });

      setPrep({ running:true, msg:"กำลังเก็บหน้าเว็บและหน้าต่างๆ..." });
      await precachePageShell();
      await Promise.allSettled(LAZY_CHUNK_LOADERS.map(load => load()));

      const urls = [
        loaded.teamLogo, ...Object.values(loaded.rivalLogos || {}),
        ...Object.values(loaded.playerPhotos || {}), ...Object.values(loaded.heroPhotos || {}),
        ...(loaded.customHeroes || []).map(h => h?.img),
        ...HERO_DATA.filter(h => !h._custom && h.img && !/^https?:/.test(h.img)).map(h => `/heroes/${h.img}.png`),
      ].filter(u => typeof u === "string" && u);
      const { ok, failed } = await precacheImages(urls, (done, total) =>
        setPrep({ running:true, msg:`กำลังเก็บรูป ${done}/${total}...` }));

      const msg = `พร้อมใช้ออฟไลน์ ✅ ${loaded.matches?.length || 0} แมตช์, ${loaded.scoutMatches?.length || 0} scout, รูป ${ok} ไฟล์${failed ? ` (ไม่สำเร็จ ${failed} — มักเป็นฮีโร่ที่ไม่มีไฟล์รูป)` : ""}`;
      setPrep({ running:false, msg });
      toast(msg, "success", 8000);
    } catch (err) {
      console.error("prepare offline failed:", err);
      setPrep({ running:false, msg:`เตรียมไม่สำเร็จ: ${err.message || err}` });
      toast("เตรียมออฟไลน์ไม่สำเร็จ ลองใหม่อีกครั้งตอนมีเน็ตดีๆ", "error", 8000);
    }
  }, [app, prep.running, toast]);

  // ── cleanup the conflict-retry timer on unmount ──
  // runAutosave schedules its own setTimeout (see MAX_CONFLICT_RETRIES
  // above) independent of the debounce effect's timer — needs its own
  // cleanup so a scheduled retry never fires after this component is gone.
  useEffect(() => {
    return () => { if (conflictRetryTimerRef.current) clearTimeout(conflictRetryTimerRef.current); };
  }, []);

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
    // original role stashed so an override can be reverted cleanly later.
    // roleOverrides[heroName] can be an array (multi-role — e.g. Rouie as
    // both "เมจ" and "ซัพ", so hero-picker searches for either role find
    // it in Live Draft / Rival scouting) or a plain string (older data
    // saved before multi-role support existed) — normalize both shapes
    // into `h.roles` (always an array) here, once, so every place that
    // filters/searches by role can just check `.includes()` without
    // needing to know which shape is stored. `h.role` is kept too, set to
    // the first entry, for any code that only ever wanted a single
    // "primary" role (e.g. color lookups) and doesn't need the full list.
    HERO_DATA.forEach(h => {
      if (h._origRole === undefined) h._origRole = h.role;
      const override = app.roleOverrides[h.name];
      const overrideRoles = Array.isArray(override) ? override : (override ? [override] : null);
      h.roles = (overrideRoles && overrideRoles.length) ? overrideRoles : [h._origRole];
      h.role = h.roles[0];
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
  // ── same idea, for Scout log entries ──
  // Scout match objects use `id: Date.now()` too (see SAVE_SCOUT reducer
  // case), so the exact same time-range filter that works for `matches`
  // works here unchanged — no separate filtering logic needed.
  const patchFilteredScoutMatches = useMemo(
    () => filterMatchesByPatch(app.scoutMatches, patchVersions, selectedPatch),
    [app.scoutMatches, patchVersions, selectedPatch]
  );
  const allGames = useMemo(() => patchFilteredMatches.flatMap(m =>
    Array.isArray(m.games) && m.games.length > 0
      ? m.games.map((g, gi) => ({ ...g, rivalName:m.rivalName, date:m.date, _matchId:m.id, _playedAt:matchTime(m), _gameIdx:gi }))
      : [{ ...m, _matchId:m.id, _playedAt:matchTime(m), _gameIdx:null }]
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
    // ── follows the currently-selected patch, same as everything else on
    //    this page — exporting should match what the person is looking at
    //    on screen, not silently include matches from other patches ──
    const filtered = filterCat==="all" ? patchFilteredMatches
      : patchFilteredMatches.filter(m=>(filterCat==="tournament"?m.category==="tournament":(!m.category||m.category==="scrim")));

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
        <td>${escHtml(m.date)}</td>
        <td>${m.category==="tournament"?"🏆 แข่ง":"🏋️ ซ้อม"}</td>
        <td><strong>vs ${escHtml(m.rivalName)}</strong></td>
        <td>${escHtml(m.boType||"BO1")}</td>
        <td style="color:${w>t/2?"#00b894":"#fd79a8"};font-weight:700">${games.length>0?`${w}W-${t-w}L`:escHtml(m.result)}</td>
        <td>${escHtml(m.note)}</td>
      </tr>`;
    }).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Match Report — ${escHtml(app.teamName||"RoV Team")}</title>
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
    <h1>🦅 Match Report — ${escHtml(app.teamName||"RoV Team")}</h1>
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
    if (!w) { toast("เบราว์เซอร์บล็อกหน้าต่างพิมพ์ — กรุณาอนุญาต popup แล้วลองใหม่", "error"); return; }
    w.document.write(html);
    w.document.close();
    setTimeout(()=>w.print(), 500);
  }, [patchFilteredMatches, app.teamName, toast]);

  const handleEditMatchMeta = useCallback(({ id, rivalName, category, note, playedAt }) => {
    dispatchApp({ type:"UPDATE_MATCH_META", payload:{ id, rivalName, category, note, ...(playedAt ? { playedAt } : {}) } });
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
  const [draggingPlayer,      setDraggingPlayer]      = useState(null); // ชื่อผู้เล่นที่กำลังถูกลากอยู่ (ย้ายทีม) — ใช้ไฮไลต์ drop tile
  const [draggingFromTeam,    setDraggingFromTeam]    = useState(null); // ทีมต้นทางของการลากครั้งนี้ ("our" หรือชื่อ rival) — ใช้คำนวณว่าทีมไหนเป็นปลายทางที่ลากไปได้บ้าง
  const [newEnemyPlayerPhoto, setNewEnemyPlayerPhoto]  = useState(null);
  const [showAddRival,        setShowAddRival]         = useState(false);
  const [newRivalName,        setNewRivalName]         = useState("");
  const [cropRivalLogo,       setCropRivalLogo]        = useState(null); // { name, file } — modal state for rival logo cropping
  const [cropOurLogo,         setCropOurLogo]           = useState(null); // { file } — same idea, for "ทีมเรา" logo on the Roster page

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
    // "ลบ" = ออกจากทีมเรา (soft-remove) ไม่ใช่ลบข้อมูลทิ้งถาวร — สถิติเก่ายังดูย้อนหลังได้ตอนเลือก patch
    // เก่า/ทั้งหมด (ดู REMOVE_PLAYER ใน appReducer) ปรับข้อความให้ตรงกับพฤติกรรมจริง ไม่ให้เข้าใจผิดว่าหายถาวร
    if (window.confirm(`เอา "${name}" ออกจากทีมเรา?\n\nสถิติที่เล่นให้ทีมเราจะยังอยู่ครบ (ดูย้อนหลังได้ตอนเลือก patch เก่า หรือ "ทั้งหมด") แค่จะไม่โผล่ในทีมเราอีกจาก patch ปัจจุบันเป็นต้นไป`))
      dispatchApp({ type:"REMOVE_PLAYER", payload: name });
  }, []);

  // ── ย้ายผู้เล่นระหว่างทีมใดก็ได้ (ทีมเรา หรือทีมคู่แข่งทีมใดก็ได้) — ลากการ์ดไปวาง หรือเลือกจาก dropdown
  //    บนการ์ดในจอสัมผัส — รองรับทั้ง 3 ทิศทาง: ทีมเรา→คู่แข่ง, คู่แข่ง→ทีมเรา, คู่แข่ง→คู่แข่งทีมอื่น ──
  // ถามยืนยันก่อนเสมอ เพราะเป็นการเปลี่ยนสถานะสังกัดของผู้เล่น (ยกเลิกได้ด้วยการย้ายกลับทันทีถ้าลากผิดทีม) และ
  // กันการลากพลาด/ปล่อยมือผิดทีมเงียบๆ
  const teamLabel = useCallback((team) => team==="our" ? (effectiveUser?.teamName||app.teamName||"ทีมเรา") : team, [effectiveUser, app.teamName]);
  const handleTransferPlayer = useCallback((playerName, fromTeam, toTeam) => {
    setDraggingPlayer(null);
    setDraggingFromTeam(null);
    if (!playerName || !fromTeam || !toTeam || fromTeam===toTeam) return;
    if (!window.confirm(`ย้าย "${playerName}" จาก "${teamLabel(fromTeam)}" ไปทีม "${teamLabel(toTeam)}"?\n\nสถิติเก่ากับทีมเดิมจะยังอยู่ครบ (ดูย้อนหลังได้ตอนเลือก patch เก่า หรือ "ทั้งหมด") ` +
                        `ตั้งแต่วันนี้ผู้เล่นจะไปอยู่ใน Roster ของ "${teamLabel(toTeam)}" แทน`)) return;
    dispatchApp({ type:"TRANSFER_PLAYER", payload:{ playerName, fromTeam, toTeam } });
    toast(`ย้าย ${playerName} ไปทีม ${teamLabel(toTeam)} แล้ว`, "success");
  }, [toast, teamLabel]);

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
    if (window.confirm(`เอา "${playerName}" ออกจาก ${rivalName}?\n\nสถิติเก่าจะยังอยู่ครบ (ดูย้อนหลังได้ตอนเลือก patch เก่า หรือ "ทั้งหมด") แค่จะไม่โผล่ในทีมนี้อีกจาก patch ปัจจุบันเป็นต้นไป`))
      dispatchApp({ type:"REMOVE_ENEMY_PLAYER", payload:{ rivalName, playerName } });
  }, []);

  // ── draft: finish session ──
  function finishSession(games) {
    if (!games.length) { dispatchDraft({ type:"RESET" }); return; }
    handleSaveMatch({ rivalName:draft.rivalName, boType:draft.boType, category:draft.category, patch:draft.patch, playedAt:draft.playedAt || undefined, games, ourSide:games[0].ourSide });
  }

  // ── overview stats ──
  const tG = allGames.length, tW = allGames.filter(g=>g.result==="WIN").length;
  const wr = tG ? Math.round(tW/tG*100) : 0;
  const gamesWithDuration = allGames.filter(g=>g.duration);
  // หัก pauseDuration ออกก่อนคำนวณ — เวลาที่จดไว้รวมช่วงที่เกมหยุด (ผู้เล่น/
  // คนดูขอหยุด) ด้วย ถ้าไม่หักออก ค่าเฉลี่ยจะสูงกว่าเวลาเล่นจริง
  const effectiveDuration = playedMinutes;
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

  // ── Objective control aggregate (shared function — see computeObjectiveSummary) ──
  const objSummary = computeObjectiveSummary(allGames);

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
    {id:"help",    icon:"❓",label:"Help"},
    {id:"admin",   icon:"⚙️",label:"Admin",    adminOnly:true},
  ];

  // ── short aliases for readability ──
  const { page, selRival, rivalView, rosterTab, selPlayer, selPlayerEnemy,
          selEnemyTeam, newName, newEnemyName, enemyStatsScope } = ui;
  const { rivals, roster, enemyRosters } = app;
  // ── Roster ตาม patch ที่เลือก ──
  // ผู้เล่นที่ไม่เคยย้ายทีม (ไม่มีประวัติ) โชว์ทุก patch เหมือนเดิม — เฉพาะคนที่เคยถูก "ย้ายทีม" เท่านั้นที่ถูกกรอง
  // ตามช่วงเวลาที่สังกัดทีมนั้นจริง (ดู isMembershipActiveForPatch) เลือก "ทั้งหมด" = โชว์ทุกคนที่เคยอยู่ทีมนั้น
  const rosterMembership = app.rosterMembership || {};
  const visibleOurRoster = roster.filter(p =>
    isMembershipActiveForPatch(rosterMembership[p], "our", patchVersions, selectedPatch));
  const visibleEnemyRosterOf = (team) => (enemyRosters[team] || []).filter(p =>
    isMembershipActiveForPatch(rosterMembership[p], team, patchVersions, selectedPatch));

  // stats ของการ์ดทีม (ใช้ทั้งหน้า Rival/Roster และช่องปล่อยตอนลากย้ายทีม — ให้หน้าตาเหมือนกัน)
  const teamCardStats = (key) => {
    const ms = key==="our" ? patchFilteredMatches : patchFilteredMatches.filter(m=>m.rivalName===key);
    const gs = ms.flatMap(m=>Array.isArray(m.games)&&m.games.length?m.games:[m]);
    const w = gs.filter(g=>g.result==="WIN").length;
    return { sessionCount: ms.length, gameCount: gs.length, winRatePct: gs.length ? Math.round(w/gs.length*100) : 0 };
  };

  // ── games to feed PlayerProfile ──
  // For our own players, PlayerProfile keeps using the plain app-wide
  // allGames like before (only one "our team", no scoping needed). For an
  // enemy player, scope to THIS specific rival team AND respect whichever
  // stats filter (all/vsUs/vsOthers) is currently selected — same filter
  // the card-level summary above already uses, so the detailed profile
  // view never disagrees with what the card just showed. This also
  // incidentally fixes a latent risk in the enemy case: without scoping
  // by rivalName, PlayerProfile would match a player purely by name
  // across every rival ever recorded, which could silently mix two
  // different teams' stats together if they happened to share a player
  // name — a real (if uncommon) risk in esports where names repeat.
  const profileGames = selPlayerEnemy
    ? [
        ...(enemyStatsScope!=="vsOthers" ? allGames.filter(g=>g.rivalName===selEnemyTeam) : []),
        ...(enemyStatsScope!=="vsUs" ? adaptScoutGamesForPlayerProfile(patchFilteredScoutMatches, selEnemyTeam) : []),
      ]
    : allGames;

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

      {/* ── Rival logo crop modal — hoisted here (not page-specific) since both
           the Rival page AND the Roster page's rival cards can trigger a logo
           change; cropRivalLogo state is shared regardless of which page is
           currently active. ── */}
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

      {/* ── Our team's logo crop modal — same pattern as the rival one above,
           used by the "ทีมเรา" TeamCard on the Roster page. ── */}
      {cropOurLogo && (
        <ImageCropModal file={cropOurLogo.file} title="ปรับโลโก้ทีมเรา"
          onConfirm={async (blob) => {
            setCropOurLogo(null);
            try {
              if (blob.size > 1.5*1024*1024) { toast("ไฟล์ใหญ่เกิน 1.5MB", "error"); return; }
              const compressed = await compressImage(blob);
              const uploaded = await upload("logo.jpg", compressed, { access:"public", handleUploadUrl:"/api/upload" });
              const oldUrl = app.teamLogo;
              dispatchApp({ type:"SET_TEAM_LOGO", payload: uploaded.url });
              if (oldUrl && oldUrl !== uploaded.url) deleteBlobUrls(oldUrl);
            } catch { toast("อัพโหลดไม่สำเร็จ", "error"); }
          }}
          onCancel={()=>setCropOurLogo(null)}
        />
      )}

      {/* NAV */}
      <div style={{background:"linear-gradient(90deg,#12072a,#0a0a16)",borderBottom:`1px solid ${C.border}`,
        padding:isMobile?"0 12px":"0 20px",display:"flex",alignItems:"center",height:56,position:"sticky",top:0,zIndex:200}}>
        <span style={{fontSize:20,marginRight:8,flexShrink:0}}>🦅</span>
        <span style={{fontWeight:900,fontSize:isMobile?13:17,letterSpacing:isMobile?0.5:1,color:C.primaryLight}}>
          {effectiveUser?.teamName || app.teamName || "ทีมของฉัน"}
        </span>
        {/* save status indicator */}
        <span style={{marginLeft:isMobile?8:12,fontSize:isMobile?14:11,color:
          saveStatus==="saving"?C.primaryLight:saveStatus==="saved"?"#00b894":saveStatus==="error"?"#ff4757":saveStatus==="offline"?"#fdcb6e":C.textMuted,
          display:"flex",alignItems:"center",gap:4,transition:"opacity .3s",flexShrink:0,
          opacity:saveStatus==="idle"?0.4:1}}>
          {isMobile ? (
            saveStatus==="saving"?"☁️":saveStatus==="saved"?"✅":saveStatus==="error"?"❌":saveStatus==="offline"?"📴":"☁️"
          ) : (
            <>
              {saveStatus==="saving" && <>☁️ กำลังบันทึก...</>}
              {saveStatus==="saved"  && <>✅ บันทึกแล้ว</>}
              {saveStatus==="idle"   && <>☁️ ซิงค์แล้ว</>}
              {saveStatus==="error"  && <>❌ บันทึกไม่สำเร็จ</>}
              {saveStatus==="offline"&& <>📴 ออฟไลน์ — เก็บในเครื่องแล้ว</>}
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
          <OfflinePanel app={app} isOnline={isOnline} prep={prep} onPrepare={handlePrepareOffline} />
          {effectiveUser && (
            <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.border}`,
              display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
              {app.teamLogo && (
                <LogoImg url={app.teamLogo} name={app.teamName||"ทีมเรา"} size={32}
                  style={{border:`2px solid ${C.primary}40`}}/>
              )}
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,color:C.textMain,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                  {effectiveUser.name || effectiveUser.email}
                </div>
                <span style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:99,
                  background: isAdmin?"#f9ca24"+"30":isCoach?C.primary+"30":C.border+"30",
                  color:       isAdmin?"#f9ca24"  :isCoach?C.primaryLight:C.textMuted}}>
                  {isAdmin?"👑 Admin":isCoach?"🎓 Coach":"👤 Member"}
                </span>
              </div>
              <button onClick={async ()=>{
                  if (hasUnsyncedChanges() && !window.confirm("มีการแก้ไขที่ยังไม่ได้ส่งขึ้นระบบ (ตอนออฟไลน์) — ถ้าออกจากระบบตอนนี้ข้อมูลส่วนนั้นจะหายไป ต้องการออกต่อไหม?")) return;
                  try{ if(draftKey) localStorage.removeItem(draftKey); }catch{}
                  await clearOfflineData(); // ล้าง snapshot + user ที่จำไว้ ไม่ให้ค้างบนเครื่องที่ใช้ร่วมกัน
                                    signOut({ callbackUrl: "/login" });
                }}
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
              รอ Admin ของทีม{effectiveUser?.teamName?` "${effectiveUser.teamName}"`:""}อนุมัติ
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
          session={sessionLike}
          roster={roster}
          allGames={allGames}
          playerPhotos={app.playerPhotos}
          onLinkPlayer={handleLinkPlayer}
        />
      )}

      {/* ── PRACTICE ASSIGNMENT PAGE ── */}
      {page==="practice" && (
        <PracticePage
          session={sessionLike}
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
          roster={visibleOurRoster}
          rivals={rivals}
          enemyRosters={Object.fromEntries(Object.keys(enemyRosters).map(t=>[t, visibleEnemyRosterOf(t)]))}
          onFinishSession={finishSession}
          allGames={allGames}
          scoutMatches={app.scoutMatches}
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
      {page==="help" && (
        <div style={{padding:"16px 28px",maxWidth:900,margin:"0 auto"}}>
          <HelpPage/>
        </div>
      )}

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
              <WeeklyMonthlySummary matches={patchFilteredMatches}/>
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
                        {label:"🎮 เกมทั้งหมด", val:tG,           col:C.primaryLight,       sub:`${patchFilteredMatches.length} sessions`},
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
              <HeroSynergyCounter allGames={allGames} scoutMatches={patchFilteredScoutMatches}/>
              <PerformanceTrend allGames={allGames}/>

              {/* ── Objective Control Summary ── */}
              <ObjectiveSummaryDisplay objSummary={objSummary}/>

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
                  {patchFilteredMatches.length>0&&(
                    <button onClick={()=>exportCSV(patchFilteredMatches, allGames)}
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
                const matchRivalFilter = ui.matchRivalFilter||"all";
                // รวม patch ทั้งหมด — เฉพาะภายในแมตช์ที่อยู่ในช่วง patch
                // (ตัว dropdown บนสุด) ที่เลือกไว้แล้วเท่านั้น ไม่ใช่ทุก patch
                // ที่เคยมีมาทั้งหมด
                const patches = [...new Set(patchFilteredMatches.filter(m=>m.patch).map(m=>m.patch))].sort().reverse();
                // รายชื่อทีมคู่แข่งในตัวกรอง — อ้างอิงจากลิสต์ Rivals ตรงๆ (ไม่ใช่ไล่เก็บชื่อจาก
                // ตัวแมตช์เอง) กันปัญหาพิมพ์ชื่อไม่ตรงกันระหว่างแมตช์เก่า/ใหม่ และให้เลือกทีมที่ยังไม่มี
                // ประวัติเลยได้ด้วย (จะเจอ empty state ปกติ ไม่ใช่หาย)
                const rivalOptions = [...rivals].sort((a,b)=>a.name.localeCompare(b.name,"th"));
                const tabs = [
                  {id:"all",        label:"ทั้งหมด",  count: patchFilteredMatches.length},
                  {id:"scrim",      label:"🏋️ ซ้อม",  count: patchFilteredMatches.filter(m=>!m.category||m.category==="scrim").length},
                  {id:"tournament", label:"🏆 แข่ง",   count: patchFilteredMatches.filter(m=>m.category==="tournament").length},
                ];
                let filtered = matchCatFilter==="all" ? patchFilteredMatches
                  : matchCatFilter==="tournament" ? patchFilteredMatches.filter(m=>m.category==="tournament")
                  : patchFilteredMatches.filter(m=>!m.category||m.category==="scrim");
                if (matchPatchFilter!=="all") filtered = filtered.filter(m=>m.patch===matchPatchFilter);
                if (matchRivalFilter!=="all") filtered = filtered.filter(m=>m.rivalName===matchRivalFilter);
                // ── เรียงล่าสุด → เก่าสุด เสมอ ──
                // ไม่พึ่งลำดับเดิมของ array (SAVE_MATCH ใหม่ prepend ไว้ก่อนก็จริง แต่ import JSON/
                // merge ตอน sync ชนกัน (lib/storage.js) อาจเรียงสลับได้) ใช้ matchTime(m) (= m.playedAt เวลาแข่งจริง,
                // แมตช์เก่าที่ไม่มี fallback เป็น m.id) ไม่ต้อง sort ก่อน slice จะได้ไม่กระทบ
                // ต้นฉบับ (filtered เป็น array ใหม่จาก .filter อยู่แล้วทุกครั้ง)
                filtered = filtered.sort((a,b)=>matchTime(b)-matchTime(a));
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
                      {rivalOptions.length>0&&(
                        <select value={matchRivalFilter}
                          onChange={e=>dispatchUI({type:"SET_MATCH_RIVAL_FILTER",payload:e.target.value})}
                          style={{background:"#1a1535",border:`1px solid ${C.border}`,
                            color:C.textMain,borderRadius:8,padding:"5px 10px",
                            fontSize:12,cursor:"pointer"}}>
                          <option value="all">🎯 ทุกทีม</option>
                          {rivalOptions.map(rv=><option key={rv.id} value={rv.name}>🎯 {rv.name}</option>)}
                        </select>
                      )}
                    </div>
                    {filtered.length===0
                      ?<div style={{textAlign:"center",padding:60,background:C.bgPanel,borderRadius:14,color:C.textMuted}}>
                          {patchFilteredMatches.length===0
                            ? "ยังไม่มีประวัติ — บันทึกแมตช์จาก Live Draft ก่อน"
                            : matchRivalFilter!=="all"
                              ? `ยังไม่มีแมตช์กับ "${matchRivalFilter}"`
                              : `ยังไม่มีแมตช์ประเภท "${tabs.find(t=>t.id===matchCatFilter)?.label}"`}
                        </div>
                      :filtered.map(m=>(
                          <MatchCardWithStats key={m.id} m={m} onUpdateStats={handleUpdateStats} onUpdateObjectives={handleUpdateObjectives} onUpdateGameFull={handleUpdateGameFull} onJumpToVideo={handleJumpToVideo} roster={roster} enemyRoster={app.enemyRosters?.[m.rivalName]||[]} videos={app.videos||[]} playerPhotos={app.playerPhotos} ourTeamName={effectiveUser?.teamName||app.teamName||"ทีมเรา"} ourTeamLogo={app.teamLogo} rivalLogo={app.rivalLogos?.[m.rivalName]} onDelete={id=>dispatchApp({type:"DELETE_MATCH",payload:id})} onEditMeta={handleEditMatchMeta}/>
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
                          const rm=patchFilteredMatches.filter(m=>m.rivalName===rv.name);
                          const rGames=rm.flatMap(m=>Array.isArray(m.games)&&m.games.length?m.games:[m]);
                          const rw=rGames.filter(g=>g.result==="WIN").length;
                          const rwrate=rGames.length?Math.round(rw/rGames.length*100):0;
                          return (
                            <TeamCard key={rv.id}
                              name={rv.name}
                              logoUrl={app.rivalLogos?.[rv.name]}
                              sessionCount={rm.length}
                              gameCount={rGames.length}
                              winRatePct={rwrate}
                              onClick={()=>dispatchUI({type:"SET_SEL_RIVAL",payload:rv.name})}
                              onPickLogoFile={file=>setCropRivalLogo({ name: rv.name, file })}
                              onDelete={()=>dispatchApp({type:"DELETE_RIVAL",payload:rv.name})}
                              deleteConfirmMessage={`ลบทีม "${rv.name}" ออกจาก Rivals?`}
                              isCoach={isCoach}
                              accentColor={C.lose}
                            />
                          );
                        })}
                      </div>
                  }
                </>
              ) : (()=>{
                  const rm     = patchFilteredMatches.filter(m=>m.rivalName===selRival);
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
                            <button
                              onClick={()=>{
                                const ok = printRivalBrief({
                                  ourTeamName: effectiveUser?.teamName||app.teamName, rivalName: selRival,
                                  rGames: rm.flatMap(m=>(Array.isArray(m.games)&&m.games.length?m.games:[m]).map(g=>({...g, date:m.date, _playedAt:matchTime(m)}))),
                                  scoutMatches: patchFilteredScoutMatches, enemyRoster: enemyRosters[selRival]||[],
                                  heroTiers: app.heroTiers||{}, patchLabel: app.patchInfo?.version||"",
                                });
                                if (!ok) toast("เบราว์เซอร์บล็อกหน้าต่างพิมพ์ — กรุณาอนุญาต popup แล้วลองใหม่", "error");
                              }}
                              title="พิมพ์/เซฟเป็น PDF — สำรองไว้ใช้ตอนไม่มีเน็ต"
                              style={{background:"transparent",border:`1px solid ${C.border}`,color:C.primaryLight,
                                borderRadius:8,padding:"8px 12px",cursor:"pointer",fontSize:12,fontWeight:700}}>
                              🖨️ ใบสรุป PDF
                            </button>
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
                          scoutMatches={patchFilteredScoutMatches}
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
                        <MatchCardWithStats key={m.id} m={m} onUpdateStats={handleUpdateStats} onUpdateObjectives={handleUpdateObjectives} onUpdateGameFull={handleUpdateGameFull} onJumpToVideo={handleJumpToVideo} roster={roster} enemyRoster={app.enemyRosters?.[m.rivalName]||[]} videos={app.videos||[]} playerPhotos={app.playerPhotos} ourTeamName={effectiveUser?.teamName||app.teamName||"ทีมเรา"} ourTeamLogo={app.teamLogo} rivalLogo={app.rivalLogos?.[m.rivalName]} onDelete={id=>dispatchApp({type:"DELETE_MATCH",payload:id})} onEditMeta={handleEditMatchMeta}/>
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

                          <ObjectiveSummaryDisplay objSummary={computeObjectiveSummary(rGames)}/>

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
                  key={selPlayer}
                  player={selPlayer}
                  isEnemy={selPlayerEnemy}
                  allGames={profileGames}
                  onBack={()=>dispatchUI({type:"CLEAR_SEL_PLAYER"})}
                  photoUrl={app.playerPhotos?.[selPlayerEnemy ? `enemy:${selEnemyTeam}:${selPlayer}` : `our:${selPlayer}`]}
                  teamBreakdown={computePlayerTeamBreakdown(rosterMembership[selPlayer], app.matches, selPlayer)}
                  rawMatches={app.matches}
                  membershipHistory={rosterMembership[selPlayer]}
                  ourTeamName={effectiveUser?.teamName||app.teamName||"ทีมเรา"}
                  ourTeamLogo={app.teamLogo}
                  rivalLogos={app.rivalLogos}
                />
              ) : (
                <>
                  <div style={{marginBottom:16}}>
                    <h2 style={{margin:"0 0 4px",fontSize:24,fontWeight:800}}>👥 Roster</h2>
                    <p style={{margin:0,color:C.textMuted,fontSize:13}}>คลิกที่ผู้เล่นเพื่อดู Player Profile</p>
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

                  <TransferDropZone
                    draggingPlayer={draggingPlayer}
                    draggingFromTeam={draggingFromTeam}
                    ourTeamName={effectiveUser?.teamName||app.teamName||"ทีมเรา"}
                    ourTeamLogo={app.teamLogo}
                    rivals={rivals}
                    rivalLogos={app.rivalLogos}
                    statsOf={teamCardStats}
                    onDrop={(name, fromTeam, toTeam)=>handleTransferPlayer(name, fromTeam, toTeam)}
                  />

                  {rosterTab==="our" && (
                    <>
                      <div style={{maxWidth:280,marginBottom:20}}>
                        <TeamCard
                          name={app.teamName||"ทีมเรา"}
                          logoUrl={app.teamLogo}
                          sessionCount={patchFilteredMatches.length}
                          gameCount={allGames.length}
                          winRatePct={allGames.length ? Math.round(allGames.filter(g=>g.result==="WIN").length/allGames.length*100) : 0}
                          onPickLogoFile={file=>setCropOurLogo({ file })}
                          isCoach={isCoach}
                          accentColor={C.primary}
                        />
                      </div>
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
                      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:14}}>
                        {visibleOurRoster.map(player=>{
                          let pg=0,pw=0; const ph={};
                          allGames.forEach(g=>{
                            const s=(g.ourPicks||[]).find(d=>d.player===player);
                            if(s){pg++;if(g.result==="WIN")pw++;if(s.hero?.name)ph[s.hero.name]=(ph[s.hero.name]||0)+1;}
                          });
                          const pwr=pg?Math.round(pw/pg*100):0;
                          const top=Object.entries(ph).sort((a,b)=>b[1]-a[1])[0];
                          const photoKey = `our:${player}`;
                          const currentTeam = getCurrentTeamOf(rosterMembership[player]) ?? "our";
                          // ลากย้ายทีมได้เฉพาะ coach และเฉพาะคนที่ "ตอนนี้" ยังอยู่ทีมเรา (คนที่ย้ายไปแล้วแต่ยังโผล่ในมุมมอง
                          // patch เก่า/ทั้งหมด เป็นแค่ข้อมูลย้อนหลัง ลากซ้ำไม่ได้) และต้องมี Rival อย่างน้อย 1 ทีมให้ย้ายไป
                          const canTransfer = isCoach && rivals.length>0 && currentTeam==="our";
                          const statusLabel = currentTeam!=="our" ? `🔀 ย้ายไป ${currentTeam}` : null;
                          // ลากจาก "ทีมเรา" เป้าหมายคือ Rival ทุกทีม (ไม่มี "our" ให้เลือกเพราะนั่นคือทีมต้นทางอยู่แล้ว)
                          const transferTargets = canTransfer ? rivals.map(r=>({value:r.name, label:r.name})) : undefined;
                          return (
                            <RosterPlayerCard key={player}
                              player={player}
                              photoUrl={app.playerPhotos?.[photoKey]}
                              pg={pg} pw={pw} pwr={pwr} top={top}
                              statusLabel={statusLabel}
                              draggable={canTransfer}
                              onDragStart={(name)=>{ setDraggingPlayer(name); setDraggingFromTeam("our"); }}
                              onDragEnd={()=>{ setDraggingPlayer(null); setDraggingFromTeam(null); }}
                              transferTargets={transferTargets}
                              onTransfer={canTransfer ? (toTeam)=>handleTransferPlayer(player, "our", toTeam) : undefined}
                              onSelect={()=>dispatchUI({type:"SET_SEL_PLAYER",payload:{name:player,isEnemy:false}})}
                              onRemove={()=>handleRemovePlayer(player)}
                              onRename={(newName)=>dispatchApp({type:"RENAME_PLAYER",payload:{oldName:player,newName}})}
                              onSetPhoto={(url)=>dispatchApp({type:"SET_PHOTO",payload:{key:photoKey,dataUrl:url}})}
                            />
                          );
                        })}
                        {visibleOurRoster.length===0&&(
                          <div style={{textAlign:"center",color:C.textMuted,padding:30,background:C.bgPanel,borderRadius:12}}>
                            {roster.length===0 ? "ยังไม่มีผู้เล่น" : "ไม่มีผู้เล่นในทีมช่วง patch นี้ — เลือก \"ทั้งหมด\" ที่มุมขวาบนเพื่อดูทุกคนที่เคยอยู่ทีม"}
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
                          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:14}}>
                            {rivals.map(rv=>{
                              const rm=patchFilteredMatches.filter(m=>m.rivalName===rv.name);
                              const rGames=rm.flatMap(m=>Array.isArray(m.games)&&m.games.length?m.games:[m]);
                              const rw=rGames.filter(g=>g.result==="WIN").length;
                              const rwr=rGames.length?Math.round(rw/rGames.length*100):0;
                              return (
                                <TeamCard key={rv.id}
                                  name={rv.name}
                                  logoUrl={app.rivalLogos?.[rv.name]}
                                  sessionCount={rm.length}
                                  gameCount={rGames.length}
                                  winRatePct={rwr}
                                  onClick={()=>dispatchUI({type:"SET_SEL_ENEMY_TEAM",payload:rv.name})}
                                  onPickLogoFile={file=>setCropRivalLogo({ name: rv.name, file })}
                                  onDelete={()=>dispatchApp({type:"DELETE_RIVAL",payload:rv.name})}
                                  deleteConfirmMessage={`ลบทีม "${rv.name}" ออกจาก Rivals?`}
                                  isCoach={isCoach}
                                  accentColor={C.lose}
                                />
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
                          <div style={{display:"flex",gap:4,background:C.bgBase,borderRadius:8,padding:3,
                            marginBottom:14,width:"fit-content",border:`1px solid ${C.border}`}}>
                            {[
                              {id:"all",       label:"ทั้งหมด"},
                              {id:"vsUs",      label:"เจอเรา"},
                              {id:"vsOthers",  label:"เจอทีมอื่น"},
                            ].map(t=>(
                              <button key={t.id}
                                onClick={()=>dispatchUI({type:"SET_ENEMY_STATS_SCOPE",payload:t.id})}
                                style={{background:enemyStatsScope===t.id?C.lose:"transparent",
                                  border:"none",color:enemyStatsScope===t.id?"#fff":C.textMuted,
                                  borderRadius:6,padding:"6px 16px",cursor:"pointer",fontWeight:700,fontSize:12}}>
                                {t.label}
                              </button>
                            ))}
                          </div>

                          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:14}}>
                            {(() => {
                              // คำนวณครั้งเดียวนอก loop ผู้เล่น แทนที่จะคำนวณซ้ำทุกคน
                              const scoutGamesForTeam = (enemyStatsScope==="all" || enemyStatsScope==="vsOthers")
                                ? flattenScoutGamesForFocus(patchFilteredScoutMatches, selEnemyTeam)
                                : [];
                              return visibleEnemyRosterOf(selEnemyTeam).map(player=>{
                              let pg=0,pw=0; const ph={};
                              // "เจอเรา" — แมตช์จริงที่เราเจอทีมนี้ (allGames)
                              if (enemyStatsScope==="all" || enemyStatsScope==="vsUs") {
                                allGames.filter(g=>g.rivalName===selEnemyTeam).forEach(g=>{
                                  const s=(g.enemyPicks||[]).find(d=>d.player===player);
                                  if(s){pg++;if(g.result==="LOSE")pw++;if(s.hero?.name)ph[s.hero.name]=(ph[s.hero.name]||0)+1;}
                                });
                              }
                              // "เจอทีมอื่น" — ข้อมูลจาก Scout (ทีมนี้เจอคู่แข่งทีมอื่น ไม่ใช่เรา)
                              // สำคัญ: g.result ตรงนี้ถูก normalize เป็นมุมมองของ "ทีมคู่แข่งที่กำลังดู"
                              // อยู่แล้ว (จาก flattenScoutGamesForFocus) ต่างจาก allGames ด้านบนที่
                              // g.result เป็นมุมมองของ "เรา" — ถ้าใช้เงื่อนไข LOSE เหมือนกันจะนับ
                              // แพ้/ชนะสลับกันของข้อมูลส่วนนี้ทั้งหมด
                              if (enemyStatsScope==="all" || enemyStatsScope==="vsOthers") {
                                scoutGamesForTeam.forEach(g=>{
                                  const s=(g.picks||[]).find(d=>d.player===player);
                                  if(s){pg++;if(g.result==="WIN")pw++;if(s.hero?.name)ph[s.hero.name]=(ph[s.hero.name]||0)+1;}
                                });
                              }
                              const pwr=pg?Math.round(pw/pg*100):0;
                              const top=Object.entries(ph).sort((a,b)=>b[1]-a[1])[0];
                              const photoKey = `enemy:${selEnemyTeam}:${player}`;
                              // ป้ายสถานะ: มาจากทีมเรา / ย้ายไปทีมอื่นแล้ว / ออกจากทีมนี้แล้วแบบไม่รู้ว่าไปไหนต่อ
                              const hist = rosterMembership[player];
                              const curTeam = getCurrentTeamOf(hist) ?? (hist ? null : selEnemyTeam);
                              const cameFromUs = !!hist && hist.some(h=>h.team==="our");
                              const enemyStatus =
                                curTeam === null && !!hist ? "🚪 ออกจากทีมนี้แล้ว"
                                : curTeam && curTeam!==selEnemyTeam ? (curTeam==="our" ? "🛡️ กลับไปอยู่ทีมเรา" : `🔀 ย้ายไป ${curTeam}`)
                                : cameFromUs ? "🛡️ เคยอยู่ทีมเรา" : null;
                              // ลากย้ายทีมได้เฉพาะ coach + คนที่ "ตอนนี้" ยังอยู่ทีมนี้จริง — ปลายทางคือทีมเรา
                              // บวก Rival ทีมอื่นทั้งหมด (ไม่รวมทีมนี้เองที่กำลังลากออกมา)
                              const canTransfer = isCoach && curTeam===selEnemyTeam;
                              const transferTargets = canTransfer
                                ? [{value:"our", label: effectiveUser?.teamName||app.teamName||"ทีมเรา"},
                                   ...rivals.filter(r=>r.name!==selEnemyTeam).map(r=>({value:r.name,label:r.name}))]
                                : undefined;
                              return (
                                <RosterPlayerCard key={player}
                                  team="enemy"
                                  player={player}
                                  photoUrl={app.playerPhotos?.[photoKey]}
                                  statusLabel={enemyStatus}
                                  pg={pg} pw={pw} pwr={pwr} top={top}
                                  draggable={canTransfer}
                                  onDragStart={(name)=>{ setDraggingPlayer(name); setDraggingFromTeam(selEnemyTeam); }}
                                  onDragEnd={()=>{ setDraggingPlayer(null); setDraggingFromTeam(null); }}
                                  transferTargets={transferTargets}
                                  onTransfer={canTransfer ? (toTeam)=>handleTransferPlayer(player, selEnemyTeam, toTeam) : undefined}
                                  onSelect={()=>dispatchUI({type:"SET_SEL_PLAYER",payload:{name:player,isEnemy:true}})}
                                  onRemove={()=>handleRemoveEnemyPlayer(selEnemyTeam,player)}
                                  onRename={(newName)=>dispatchApp({type:"RENAME_ENEMY_PLAYER",payload:{rivalName:selEnemyTeam,oldName:player,newName}})}
                                  onSetPhoto={(url)=>dispatchApp({type:"SET_PHOTO",payload:{key:photoKey,dataUrl:url}})}
                                />
                              );
                              });
                            })()}
                            {visibleEnemyRosterOf(selEnemyTeam).length===0&&(
                              <div style={{textAlign:"center",color:C.textMuted,padding:30,background:C.bgPanel,borderRadius:12}}>
                                {(enemyRosters[selEnemyTeam]||[]).length===0
                                  ? "ยังไม่มีผู้เล่น — เพิ่มชื่อด้านบนได้เลย"
                                  : "ไม่มีผู้เล่นทีมนี้ในช่วง patch ที่เลือก — เลือก \"ทั้งหมด\" ที่มุมขวาบนเพื่อดูทุกคนที่เคยอยู่ทีม"}
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
