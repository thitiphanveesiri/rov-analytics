"use client";
import { ROLES_PICK } from "@/lib/heroes";
import { BANS_PER_TEAM, DRAFT_ORDER } from "@/components/draft/constants";
import { BO_OPTIONS } from "@/components/common/constants";


// ── 3. DRAFT REDUCER — entire draft session ──
export function initDraftState() {
  return {
    stage:          "setup",   // setup | chooseSide | playing | done
    boType:         "BO3",
    rivalName:      "",
    category:       "scrim",  // "scrim" | "tournament"
    patch:          "",       // patch version เช่น "4.21"
    playedAt:       null,     // เวลาแข่งจริง (epoch ms) — null = ใช้เวลาตอนบันทึก, กรอกเมื่อบันทึกย้อนหลัง
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
    heroViewMode:   "flat",   // "flat" | "grouped" — flat = filter by one role at a time (existing behavior); grouped = show all heroes sectioned by role
    search:         "",
    meta:           { result:"WIN", ourScore:"", enemyScore:"", duration:"", hasPause:false, pauseDuration:"", note:"" },
  };
}

export function draftReducer(state, action) {
  switch (action.type) {

    case "SETUP_SET_BO":       return { ...state, boType: action.payload };
    case "SETUP_SET_RIVAL":    return { ...state, rivalName: action.payload };
    case "SETUP_SET_CATEGORY": return { ...state, category: action.payload };
    case "SETUP_SET_PATCH":    return { ...state, patch: action.payload };
    case "SETUP_SET_PLAYED_AT":return { ...state, playedAt: action.payload };
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
    case "SET_HERO_VIEW_MODE": return { ...state, heroViewMode: action.payload };
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

    // ── เพิ่มเกมพิเศษเข้า series ตอนจะปิดแมตช์ ──
    // ใช้เมื่อโค้ชตั้ง Bo ผิดตอนแรก (เช่น ตั้งใจซ้อม Bo4 แต่กด Bo3) แล้วมาเจอตอนจบเกมสุดท้าย
    // ของ Bo เดิมพอดี — ทำสิ่งเดียวกับ GAME_DONE (เก็บเกมที่เพิ่งจบ ไปเกมถัดไป) แต่ "ขยาย" boType
    // ให้รองรับเกมใหม่นี้ด้วย ผลคือทั้ง header ของ Live Draft และแมตช์ที่บันทึกลง Match Log ในที่สุด
    // (finishSession อ่าน draft.boType ตรงๆ ตอนบันทึก) จะเห็นเป็น Bo ใหม่ที่ถูกต้องแทน
    case "ADD_EXTRA_GAME": {
      const newGames = [...state.completedGames, { ...action.payload, gameNo: state.currentGame }];
      const nextGameNo = state.currentGame + 1;
      const curTotal = (BO_OPTIONS.find(b => b.label === state.boType) || BO_OPTIONS[2]).total;
      // ถ้าเกมถัดไปยังเกินจำนวนที่ Bo ปัจจุบันรองรับอยู่ ขยาย Bo ให้พอดี เช่น Bo3 กด "เพิ่มแมตช์"
      // ตอนจบเกม 3 → เกมถัดไปคือเกม 4 ซึ่งเกิน Bo3 (รองรับสูงสุด 3) เลยขยับเป็น Bo4 ให้อัตโนมัติ
      // จำกัดไม่เกิน Bo7 (ตัวเลือกสูงสุดที่มี — ดู BO_OPTIONS)
      const newTotal = Math.min(7, Math.max(curTotal, nextGameNo));
      const newBoType = (BO_OPTIONS.find(b => b.total === newTotal) || BO_OPTIONS[BO_OPTIONS.length - 1]).label;
      return {
        ...state,
        boType: newBoType,
        completedGames: newGames,
        currentGame: nextGameNo,
        stage: "chooseSide",
        step: 0,
        blueBans:  Array(BANS_PER_TEAM).fill(null),
        redBans:   Array(BANS_PER_TEAM).fill(null),
        bluePicks: ROLES_PICK.map(r => ({ role: r, hero: null, player: "" })),
        redPicks:  ROLES_PICK.map(r => ({ role: r, hero: null, player: "" })),
        meta: { result:"WIN", ourScore:"", enemyScore:"", duration:"", hasPause:false, pauseDuration:"", note:"" },
      };
    }

    default: return state;
  }
}
