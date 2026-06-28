// Storage layer: load/save team data via the /api/data API route.
// Replaces the original window.storage calls from the Claude.ai artifact.

const FIELDS = [
  "matches","rivals","roster","enemyRosters","scoutMatches",
  "playerPhotos","heroPhotos","customHeroes","roleOverrides","videos",
];

const FALLBACK = {
  matches:[], rivals:[], roster:["Player 1","Player 2"],
  enemyRosters:{}, scoutMatches:[], playerPhotos:{}, heroPhotos:{},
  customHeroes:[], roleOverrides:{}, videos:[], _loaded:true,
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
  try {
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
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    return true;
  } catch (err) {
    console.error("saveToStorage failed:", err);
    return false;
  }
}
