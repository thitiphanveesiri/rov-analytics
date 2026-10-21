"use client";
import { formatMatchDate } from "@/lib/matchTime";
import { HERO_DATA } from "@/lib/heroes";
import { closeOpenPeriod, getCurrentTeamOf, openNewPeriod, renameMembershipKey } from "@/components/common/patchUtils";
import { STORAGE_FIELDS } from "@/lib/storage";


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
    // ประวัติการสังกัดทีมของผู้เล่นที่เคยย้ายทีม — { [playerName]: [{ team:"our"|rivalName, from:epochMs, to:epochMs|null }] }
    // ผู้เล่นที่ไม่มี key นี้ = ไม่เคยย้ายทีมเลย → โชว์ทุก patch ตามเดิม (ดู isMembershipActiveForPatch)
    rosterMembership: {},
  };
}

export function initAppState() {
  // sync default — actual data is hydrated async via loadFromStorage()
  return { ...defaultAppState(), _loaded: false };
}

export function appReducer(state, action) {
  switch (action.type) {

    case "LOAD_FROM_STORAGE":
      return { ...action.payload };

    // ── รวมข้อมูลที่โหลดใหม่เข้า state ปัจจุบัน แบบไม่ทับสิ่งที่ผู้ใช้แก้ค้างระหว่างรอ save ──
    // payload: { loaded, sentFieldJson } — sentFieldJson = JSON ของแต่ละ field ตอนเริ่ม save
    // field ที่ state ปัจจุบันยัง "เท่ากับที่ส่งไป" = ผู้ใช้ไม่ได้แก้เพิ่ม → รับค่าที่ merge แล้วจาก server
    // field ที่ต่างไปแล้ว = ผู้ใช้กำลังพิมพ์/แก้อยู่ → เก็บของเดิม (autosave รอบถัดไปจะส่งต่อเอง)
    // (ต่างจาก LOAD_FROM_STORAGE ที่ replace ทั้งก้อน ซึ่งเคยทับสิ่งที่พิมพ์ค้างตอน save กำลังวิ่ง)
    case "MERGE_LOADED": {
      const { loaded, sentFieldJson } = action.payload;
      const next = { ...state, _loaded: true, pending: false, noTeam: false };
      for (const f of STORAGE_FIELDS) {
        const untouched = sentFieldJson && JSON.stringify(state[f] === undefined ? null : state[f]) === sentFieldJson[f];
        if (untouched || !sentFieldJson) next[f] = loaded[f];
      }
      return next;
    }

    case "SAVE_MATCH": {
      // playedAt = เวลาแข่งจริง (กรอกตอน setup draft / แก้ทีหลังได้) — ไม่กรอก = ตอนนี้
      // ห้ามใช้ id เป็นเวลาแข่งอีก: id คือเวลาที่กดบันทึก (ดู lib/matchTime.js)
      const { playedAt: pa, ...rest } = action.payload;
      const id = Date.now();
      const playedAt = Number.isFinite(pa) && pa > 0 ? pa : id;
      const m = { id, category: "scrim", ...rest, playedAt, date: formatMatchDate(playedAt) };
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
      // แก้เวลาแข่ง → อัปเดตสตริงวันที่ที่โชว์ให้ตรงกันด้วย
      if (Number.isFinite(changes.playedAt) && changes.playedAt > 0) changes.date = formatMatchDate(changes.playedAt);
      else delete changes.playedAt;
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
      const now = Date.now();
      // เปิดช่วงสังกัดทีมเราตั้งแต่ตอนนี้ — ผู้เล่นที่เพิ่มจากนี้ไปจะมี "วันที่เข้าร่วม" จริง ใช้กรองตาม patch
      // ได้แม่นยำ (ผู้เล่นเก่าก่อนมีฟีเจอร์นี้ไม่มีประวัติ เลยโชว์ทุก patch เป็นค่า fallback เท่านั้น)
      const rosterMembership = {
        ...(state.rosterMembership || {}),
        [name]: openNewPeriod(state.rosterMembership?.[name], "our", now),
      };
      return { ...state, roster: [...state.roster, name], rosterMembership };
    }

    // ── "ลบ" ผู้เล่นออกจากทีมเรา = ปิดช่วงสังกัดทีมเรา (soft-remove) ไม่ใช่ลบข้อมูลทิ้งถาวร ──
    // เดิมลบชื่อออกจาก state.roster ตรงๆ ทำให้ผู้เล่นคนนั้นหายไปจากทุก patch แม้แต่ patch เก่าที่เขาเคยอยู่
    // จริง ตอนนี้ชื่อยังอยู่ใน roster เสมอ (patch เก่าที่เคยอยู่จริงยังหาเจอ) แต่ patch ปัจจุบัน/อนาคตจะไม่เห็น
    // เขาอีกในทีมเรา — เหมือนกับตอนย้ายทีมทุกประการ (ก็คือ "ออกจากทีมโดยไม่รู้ว่าไปไหนต่อ") ไม่ลบรูปโปรไฟล์
    // อีกต่อไปด้วย เพราะการ์ด patch เก่าควรยังมีรูปให้ดูตามปกติ
    case "REMOVE_PLAYER": {
      const name = action.payload;
      if (!state.roster.includes(name)) return state;
      const now = Date.now();
      const history = state.rosterMembership?.[name];
      if ((getCurrentTeamOf(history) ?? "our") !== "our") return state; // ไม่มีประวัติ = ถือว่าอยู่ทีมเรา (เจอใน state.roster)
      const rosterMembership = {
        ...(state.rosterMembership || {}),
        [name]: closeOpenPeriod(history, "our", now),
      };
      return { ...state, rosterMembership };
    }

    // ── ย้ายผู้เล่นระหว่างทีมใดก็ได้ (ทีมเรา หรือทีมคู่แข่งทีมใดก็ได้ใน Rivals) ──
    // payload: { playerName, fromTeam, toTeam, at? }   ("our" หรือชื่อ rival ทั้งคู่)
    // รองรับทั้ง 3 ทิศทาง: ทีมเรา→คู่แข่ง, คู่แข่ง→ทีมเรา, คู่แข่ง→คู่แข่งทีมอื่น
    // ตั้งใจ "ไม่ลบ" ชื่อออกจาก array ต้นทาง (roster / enemyRosters[fromTeam]) — ต้องเก็บไว้ให้ patch เก่า/
    // ทั้งหมด ยังมองย้อนกลับไปเห็นว่าเคยอยู่ทีมนั้นได้ การซ่อนจาก patch ปัจจุบันทำผ่าน rosterMembership แทน
    case "TRANSFER_PLAYER": {
      const { playerName, fromTeam, toTeam } = action.payload;
      const at = action.payload.at ?? Date.now();
      if (!playerName || !fromTeam || !toTeam || fromTeam === toTeam) return state;
      const teamExists = (team) => team === "our" || (state.rivals || []).some(r => r.name === team);
      if (!teamExists(fromTeam) || !teamExists(toTeam)) return state;

      const rosterOf = (team) => team === "our" ? state.roster : (state.enemyRosters[team] || []);
      if (!rosterOf(fromTeam).includes(playerName)) return state;

      const membership = state.rosterMembership || {};
      // ไม่มีประวัติ = อยู่ fromTeam มาตลอดตั้งแต่ก่อนมีระบบนี้ (ใช้ fromTeam ไม่ใช่ "our" เสมอไป — รองรับกรณี
      // ลากคนจาก roster คู่แข่งที่ไม่เคยถูกย้ายมาก่อนเลยด้วย ซึ่งควรนับว่าเขาอยู่ทีมนั้นมาตลอด ไม่ใช่ทีมเรา)
      const history = membership[playerName] ? [...membership[playerName]] : [{ team: fromTeam, from: 0, to: null }];
      if (getCurrentTeamOf(history) !== fromTeam) return state; // กันลากซ้ำ/ลากจากมุมมอง all-time ที่เห็นการ์ดเก่า

      const closed = closeOpenPeriod(history, fromTeam, at);
      const updated = openNewPeriod(closed, toTeam, at);

      const toArr = toTeam === "our" ? state.roster : (state.enemyRosters[toTeam] || []);
      const roster = (toTeam === "our" && !toArr.includes(playerName)) ? [...state.roster, playerName] : state.roster;
      const enemyRosters = (toTeam !== "our" && !toArr.includes(playerName))
        ? { ...state.enemyRosters, [toTeam]: [...toArr, playerName] }
        : state.enemyRosters;

      // ก๊อปรูปโปรไฟล์ตามไปด้วย (key รูปแยกตามบริบททีม: our:<ชื่อ> / enemy:<ทีม>:<ชื่อ>) ไม่งั้นการ์ดใหม่จะไม่มีรูป
      const photoKeyOf = (team, n) => team === "our" ? `our:${n}` : `enemy:${team}:${n}`;
      const oldPhotoKey = photoKeyOf(fromTeam, playerName), newPhotoKey = photoKeyOf(toTeam, playerName);
      const playerPhotos = (state.playerPhotos?.[oldPhotoKey] && !state.playerPhotos?.[newPhotoKey])
        ? { ...state.playerPhotos, [newPhotoKey]: state.playerPhotos[oldPhotoKey] }
        : state.playerPhotos;

      return { ...state, rosterMembership: { ...membership, [playerName]: updated }, roster, enemyRosters, playerPhotos };
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

      const rosterMembership = renameMembershipKey(state.rosterMembership, oldName, newName);

      return { ...state, roster, playerPhotos, matches, practiceAssignments, rosterMembership };
    }

    case "ADD_ENEMY_PLAYER": {
      const { rivalName, playerName } = action.payload;
      const cur = state.enemyRosters[rivalName] || [];
      const trimmed = playerName.trim();
      if (!trimmed || cur.includes(trimmed)) return state;
      const now = Date.now();
      // เปิดช่วงสังกัดทีมนี้ตั้งแต่ตอนนี้ (เหมือน ADD_PLAYER ฝั่งทีมเรา) — ให้กรองตาม patch ได้แม่นยำเช่นกัน
      const rosterMembership = {
        ...(state.rosterMembership || {}),
        [trimmed]: openNewPeriod(state.rosterMembership?.[trimmed], rivalName, now),
      };
      return {
        ...state,
        enemyRosters: { ...state.enemyRosters, [rivalName]: [...cur, trimmed] },
        rosterMembership,
      };
    }

    // ── "ลบ" ผู้เล่นออกจาก roster ทีมคู่แข่ง = ปิดช่วงสังกัดทีมนั้น (soft-remove) เหมือน REMOVE_PLAYER ──
    case "REMOVE_ENEMY_PLAYER": {
      const { rivalName, playerName } = action.payload;
      if (!(state.enemyRosters[rivalName] || []).includes(playerName)) return state;
      const now = Date.now();
      const history = state.rosterMembership?.[playerName];
      if ((getCurrentTeamOf(history) ?? rivalName) !== rivalName) return state; // ไม่มีประวัติ = ถือว่าอยู่ทีมนี้ (เจอใน enemyRosters[rivalName])
      const rosterMembership = {
        ...(state.rosterMembership || {}),
        [playerName]: closeOpenPeriod(history, rivalName, now),
      };
      return { ...state, rosterMembership };
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

      // ประวัติย้ายทีมตามคนไปด้วย (ถ้าเปลี่ยนชื่อฝั่งทีมเราไปแล้ว key อยู่ที่ชื่อใหม่อยู่แล้ว — ตรงนี้ no-op ปลอดภัย)
      const rosterMembership = renameMembershipKey(state.rosterMembership, oldName, newName);

      return { ...state, enemyRosters, playerPhotos, matches, rosterMembership };
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
      // payload: { heroName, role } — role can now be an array of roles
      // (multi-role support, e.g. ["เมจ","ซัพ"]) or a single string
      // (kept working for anything still sending the old shape)
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
export function initUIState() {
  return {
    page:           "overview",
    selRival:       null,
    rivalView:      "history",
    rosterTab:      "our",
    selPlayer:      null,
    selPlayerEnemy: false,
    selEnemyTeam:   null,
    enemyStatsScope: "all",  // "all" | "vsUs" | "vsOthers" — filter for enemy player stats on Roster page
    newName:        "",
    newEnemyName:   "",
    scoutView:      null,   // null | "log" | "new"
    focusVideoId:   null,   // ใช้ตอนกด "ดูวิดีโอ" จาก Match Log ให้ไปเปิดคลิปที่ผูกไว้อัตโนมัติ
  };
}

export function uiReducer(state, action) {
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
    case "SET_SEL_ENEMY_TEAM":  return { ...state, selEnemyTeam: action.payload, enemyStatsScope: "all" };
    case "SET_ENEMY_STATS_SCOPE": return { ...state, enemyStatsScope: action.payload };
    case "SET_NEW_NAME":        return { ...state, newName: action.payload };
    case "SET_NEW_ENEMY_NAME":  return { ...state, newEnemyName: action.payload };
    case "CLEAR_NEW_NAME":      return { ...state, newName: "" };
    case "CLEAR_NEW_ENEMY_NAME":return { ...state, newEnemyName: "" };
    case "SET_MATCH_CAT_FILTER":  return { ...state, matchCatFilter: action.payload };
    case "SET_MATCH_PATCH_FILTER": return { ...state, matchPatchFilter: action.payload };
    case "SET_MATCH_RIVAL_FILTER": return { ...state, matchRivalFilter: action.payload };
    default: return state;
  }
}
