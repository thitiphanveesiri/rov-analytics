// Drop-in replacements for the loadFromStorage()/saveToStorage() functions
// that the original artifact used with window.storage. Same shape in,
// same shape out — only the transport changed (window.storage → fetch).

export async function loadFromStorage() {
  try {
    const res = await fetch("/api/data");
    if (!res.ok) throw new Error("Failed to load");
    const data = await res.json();
    return {
      matches:       data.matches       ?? [],
      rivals:        data.rivals        ?? [],
      roster:        data.roster        ?? ["Player 1", "Player 2"],
      enemyRosters:  data.enemyRosters  ?? {},
      scoutMatches:  data.scoutMatches  ?? [],
      playerPhotos:  data.playerPhotos  ?? {},
      heroPhotos:    data.heroPhotos    ?? {},
      customHeroes:  data.customHeroes  ?? [],
      roleOverrides: data.roleOverrides ?? {},
      videos:        data.videos        ?? [],
      _loaded: true,
    };
  } catch (err) {
    console.error("loadFromStorage failed:", err);
    // fall back to empty defaults so the app still renders something
    // instead of hanging on the loading screen forever
    return {
      matches: [], rivals: [], roster: ["Player 1", "Player 2"],
      enemyRosters: {}, scoutMatches: [], playerPhotos: {}, heroPhotos: {},
      customHeroes: [], roleOverrides: {}, _loaded: true,
    };
  }
}

export async function saveToStorage(appState) {
  try {
    const { _loaded, _saving, ...dataToSave } = appState;
    const res = await fetch("/api/data", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dataToSave),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.error("Save failed:", body.error || res.statusText);
    }
  } catch (err) {
    console.error("saveToStorage failed:", err);
  }
}
