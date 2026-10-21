"use client";
import { useEffect, useState } from "react";


// ═══════════════════════════════════════════
//  TOAST NOTIFICATION SYSTEM — moved to lib/toast.js
//  (so extracted components like AdminPanel.js can import useToast too —
//  see lib/toast.js for the full explanation)
// ═══════════════════════════════════════════

// ── Simple responsive breakpoint hook (phones + tablets in portrait) ──
export function useIsMobile(breakpoint = 860) {
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
export function usePatchVersions() {
  const PATCH_CACHE_KEY = "rov_patch_versions_v1";
  const [versions, setVersions] = useState([]);
  useEffect(() => {
    // offline: ใช้รายการ patch ที่จำไว้ครั้งล่าสุด ไม่งั้น filter จะ fallback เป็น "ทั้งหมด" เงียบๆ แล้วสถิติเพี้ยน
    try {
      const cached = JSON.parse(localStorage.getItem(PATCH_CACHE_KEY) || "null");
      if (Array.isArray(cached)) setVersions(cached);
    } catch {}
    fetch("/api/admin/patch-versions")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!Array.isArray(data)) return; // error/ไม่ใช่รายการ = คงของเดิม (cache) ไว้
        setVersions(data);
        try { localStorage.setItem(PATCH_CACHE_KEY, JSON.stringify(data)); } catch {}
      })
      .catch(() => {}); // ไม่มีประวัติ patch ก็ปล่อยเป็น [] — filterMatchesByPatch จะ fallback เป็น "ทั้งหมด" เอง
  }, []);
  return versions;
}
