"use client";
import { C } from "@/lib/theme";


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
//    2) DRAFT_ORDER ด้านล่าง → ใส่ลำดับ step จริงตามแพตช์ใหม่ (PHASE_SEGS + progress bar derive เอง)
//  ที่เหลือ (ขนาด array การแบน, PHASE_SEGS, progress bar, ตัวกรอง Ban ที่ 1-N, สถิติ ban/pick ต่างๆ)
//  จะปรับตาม BANS_PER_TEAM ให้อัตโนมัติ เพราะ refactor ให้ derive จากค่านี้แล้ว
// ═══════════════════════════════════════════════════════════════
export const BANS_PER_TEAM = 4; // TODO: เปลี่ยนเป็น 5 ตอนแพตช์ปล่อยจริงพร้อมลำดับใหม่
export const DRAFT_LS_KEY = "rov_analytics_draft_inprogress_v1"; // localStorage key สำหรับ autosave draft ที่ทำค้างไว้
// key เดิมไม่ผูกกับผู้ใช้ — เครื่องที่ใช้ร่วมกัน (คอมร้านเน็ต/เครื่องกลางทีม) จะเห็น/กู้ draft ของคนก่อนหน้า
// จึงผูกกับ user id และลบ key เก่าทิ้งตอนเปิดแอป (ดู effect ใน RovAppInner)
export function draftKeyFor(userId) { return userId ? `${DRAFT_LS_KEY}:${userId}` : null; }

export const DRAFT_ORDER = [
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

// derive จาก DRAFT_ORDER อัตโนมัติ: จับ step ติดกันที่ action เดียวกันเป็น 1 เฟส
// (start/end คือ index ใน DRAFT_ORDER) — ไม่ต้องแก้คู่กับ DRAFT_ORDER อีกต่อไป
export const PHASE_SEGS = (() => {
  const segs = [], seen = {ban:0, pick:0};
  DRAFT_ORDER.forEach((s, i) => {
    const last = segs[segs.length - 1];
    if (last && last.action === s.action) { last.end = i; return; }
    seen[s.action]++;
    segs.push({action:s.action, label:`${s.action.toUpperCase()} ${seen[s.action]}`,
      color: s.action === "ban" ? C.ban : C.win, start:i, end:i});
  });
  return segs.map(({action, ...g}) => ({...g, flex:(g.end - g.start + 1) / 2}));
})();
