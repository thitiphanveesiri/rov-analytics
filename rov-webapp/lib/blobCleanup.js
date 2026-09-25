// Fire-and-forget helper to delete old Vercel Blob files when a photo/logo
// gets replaced or removed. Without this, every re-upload leaves the
// previous file orphaned in Blob storage forever.
//
// Safe to call with null/undefined/non-blob URLs (e.g. the fandom.com wiki
// fallback images) — those are filtered out and never sent to the server.
//
// The actual authorization check (is this URL really this team's file?)
// happens server-side in app/api/upload/delete — this client-side filtering
// is just to avoid sending obviously-useless requests, never to be trusted
// as the real boundary.

// เพดานเดียวกับ MAX_URLS_PER_REQUEST ใน app/api/upload/delete/route.js — ตัดที่นี่ด้วยกันเผลอส่ง
// อาร์เรย์ยาวผิดปกติ (เช่น bug ที่ไหนดันส่ง URL ซ้ำเข้ามาเพียบ) ยิง request เดียวใหญ่เกินจำเป็น
const MAX_URLS_PER_CALL = 25;

function isBlobUrl(url) {
  return typeof url === "string" && /\.public\.blob\.vercel-storage\.com\//.test(url);
}

export function deleteBlobUrls(urls) {
  const list = [...new Set((Array.isArray(urls) ? urls : [urls]).filter(isBlobUrl))].slice(0, MAX_URLS_PER_CALL);
  if (list.length === 0) return;

  // Never block the UI or the new upload on cleanup of the old file —
  // this is best-effort housekeeping, not something the user should wait on.
  fetch("/api/upload/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ urls: list }),
  }).catch(err => console.warn("Blob cleanup failed (non-fatal):", err));
}
