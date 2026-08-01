// Storage layer: load/save team data via the /api/data API route.
// Replaces the original window.storage calls from the Claude.ai artifact.

const FIELDS = [
  "matches","rivals","roster","enemyRosters","scoutMatches",
  "playerPhotos","heroPhotos","customHeroes","roleOverrides","videos",
  "teamLogo","rivalLogos","schedules","patchInfo","heroTiers","practiceAssignments",
];

const FALLBACK = {
  matches:[], rivals:[], roster:["Player 1","Player 2"],
  enemyRosters:{}, scoutMatches:[], playerPhotos:{}, heroPhotos:{},
  customHeroes:[], roleOverrides:{}, videos:[],
  teamLogo:null, rivalLogos:{}, schedules:[],
  patchInfo:{version:"",notes:"",updatedAt:null}, heroTiers:{}, practiceAssignments:[], _loaded:true,
};

// Tracks the last-known `updatedAt` timestamp of TeamData as this client
// has seen it. Sent back on every save so the server can detect if someone
// else (another team member, or another tab of the same user) saved in
// between — see the optimistic-locking check in app/api/data/route.js.
let lastKnownUpdatedAt = null;

export async function loadFromStorage() {
  try {
    const res = await fetch("/api/data");

    // ── Not in a team (removed, or never joined) ──
    // /api/data GET returns 403 specifically when the account has no
    // teamId — distinct from a real network/server error, and needs its
    // own UI (a blocking "enter an invite code" modal) instead of quietly
    // falling back to an empty-looking team, which is what used to happen
    // here (silently caught below, autosave then kept failing every
    // 600ms with no explanation to the user).
    if (res.status === 403) {
      return { ...FALLBACK, roster: [], _loaded: true, noTeam: true };
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    lastKnownUpdatedAt = data.updatedAt || null;

    // ── Pending-approval account ──
    // Server intentionally sends back only { pending: true, teamName }
    // (no real team data) while an admin hasn't approved this member yet
    // — see the status check in app/api/data GET. Build state from
    // FALLBACK (keeps the exact shape other code expects, e.g.
    // patchInfo.version) but override `roster` specifically — FALLBACK's
    // roster is ["Player 1","Player 2"], meant as starter placeholders
    // for a brand-new team, which would confusingly look like real team
    // data here. Everything else in FALLBACK is already empty/neutral.
    if (data.pending) {
      return { ...FALLBACK, roster: [], _loaded: true, pending: true };
    }

    // Build state from DB data, falling back to safe defaults per field
    const state = { _loaded: true, pending: false, noTeam: false };
    FIELDS.forEach(f => { state[f] = data[f] ?? FALLBACK[f]; });
    return state;
  } catch (err) {
    console.error("loadFromStorage failed:", err);
    return { ...FALLBACK };
  }
}

export async function saveToStorage(appState) {
  // Pending-approval / no-team accounts can't save anything — server
  // blocks this with a 403 anyway (see app/api/data PUT), but skip the
  // network round-trip entirely rather than let it fail every 600ms via
  // autosave (this is exactly the repeated "บันทึกไม่สำเร็จ" toast spam a
  // removed team member used to see).
  if (appState.pending || appState.noTeam) return true;

  // Only send the fields that belong in the DB — strip all React/internal state
  const payload = {};
  FIELDS.forEach(f => { payload[f] = appState[f] ?? FALLBACK[f]; });
  if (lastKnownUpdatedAt) payload.expectedUpdatedAt = lastKnownUpdatedAt;

  const res = await fetch("/api/data", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));

    if (res.status === 409) {
      // Someone else saved in between — do NOT silently retry-and-overwrite,
      // that's exactly the data-loss bug this check exists to prevent.
      // Adopt their updatedAt so a manual retry (after the user reloads and
      // re-applies their change) will succeed instead of conflicting again.
      lastKnownUpdatedAt = body.currentUpdatedAt || lastKnownUpdatedAt;
      const conflictErr = new Error(
        body.message || "ข้อมูลถูกแก้ไขจากที่อื่นระหว่างนี้ กรุณารีเฟรชหน้าก่อนบันทึกต่อ"
      );
      conflictErr.isConflict = true;
      throw conflictErr;
    }

    // Surface the real reason (e.g. Zod validation details) instead of a
    // generic message — this is what shows up in the toast/console when a
    // save silently fails, so don't swallow it here.
    const detail = body.error || body.message || JSON.stringify(body.issues || body) || `HTTP ${res.status}`;
    console.error("saveToStorage: server rejected save:", detail);
    throw new Error(detail);
  }

  const body = await res.json().catch(() => ({}));
  if (body.updatedAt) lastKnownUpdatedAt = body.updatedAt;

  // IMPORTANT: never catch-and-return-false here — the caller relies on
  // this throwing so it can show an accurate save-failed state to the
  // user. Swallowing errors here previously caused the UI to always show
  // "✅ บันทึกแล้ว" even when the save had actually failed, silently
  // losing data on reload.
  return true;
}
