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

export async function loadFromStorage() {
  try {
    const res = await fetch("/api/data");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    // Build state from DB data, falling back to safe defaults per field
    const state = { _loaded: true };
    FIELDS.forEach(f => { state[f] = data[f] ?? FALLBACK[f]; });
    return state;
  } catch (err) {
    console.error("loadFromStorage failed:", err);
    return { ...FALLBACK };
  }
}

export async function saveToStorage(appState) {
  // Only send the fields that belong in the DB — strip all React/internal state
  const payload = {};
  FIELDS.forEach(f => { payload[f] = appState[f] ?? FALLBACK[f]; });

  const res = await fetch("/api/data", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // Surface the real reason (e.g. Zod validation details) instead of a
    // generic message — this is what shows up in the toast/console when a
    // save silently fails, so don't swallow it here.
    const detail = body.error || body.message || JSON.stringify(body.issues || body) || `HTTP ${res.status}`;
    console.error("saveToStorage: server rejected save:", detail);
    throw new Error(detail);
  }
  // IMPORTANT: never catch-and-return-false here — the caller relies on
  // this throwing so it can show an accurate save-failed state to the
  // user. Swallowing errors here previously caused the UI to always show
  // "✅ บันทึกแล้ว" even when the save had actually failed, silently
  // losing data on reload.
  return true;
}
