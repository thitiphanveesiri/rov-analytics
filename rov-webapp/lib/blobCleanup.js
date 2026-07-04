// Fire-and-forget helper to delete old Vercel Blob files when a photo/logo
// gets replaced or removed. Without this, every re-upload leaves the
// previous file orphaned in Blob storage forever.
//
// Safe to call with null/undefined/non-blob URLs (e.g. the fandom.com wiki
// fallback images) — those are filtered out and never sent to the server.

function isBlobUrl(url) {
  return typeof url === "string" && /\.public\.blob\.vercel-storage\.com\//.test(url);
}

export function deleteBlobUrls(urls) {
  const list = (Array.isArray(urls) ? urls : [urls]).filter(isBlobUrl);
  if (list.length === 0) return;

  // Never block the UI or the new upload on cleanup of the old file —
  // this is best-effort housekeeping, not something the user should wait on.
  fetch("/api/upload/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ urls: list }),
  }).catch(err => console.warn("Blob cleanup failed (non-fatal):", err));
}
