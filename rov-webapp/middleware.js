export { default } from "next-auth/middleware";

export const config = {
  // Protect every PAGE route with next-auth's default redirect-to-/login
  // behavior. Every API route is excluded here on purpose — see below —
  // and instead does its own explicit getServerSession()+role check inside
  // the route handler itself (already true of every route in this app:
  // /api/data, /api/upload(/delete), /api/team/join, /api/admin/*,
  // /api/google-calendar/*, /api/register).
  //
  // ── Why exclude ALL of /api/* instead of listing routes one at a time ──
  // The previous version of this matcher excluded api/auth, api/register,
  // api/upload, api/admin, and api/cron individually — but NOT api/data,
  // api/team/join, or api/google-calendar/*. That meant an unauthenticated
  // (or session-expired-mid-session) request to those specific routes hit
  // next-auth's middleware FIRST, which redirects (302) to /login instead
  // of letting the route return its own clean JSON 401.
  //
  // Concretely: fetch() follows redirects by default, so
  // fetch("/api/data") from lib/storage.js would silently end up with the
  // *login page's HTML* at a 200 status (not 401/403) after the browser
  // follows that redirect. `if (!res.ok)` never fires (200 is "ok"), so the
  // code falls through to `await res.json()` on an HTML body — throwing a
  // "Unexpected token < in JSON" parse error. That's the exact same class
  // of bug this file's own comment already describes for manifest.json/
  // sw.js below (a JSON-expecting client getting redirected to an HTML
  // page instead) — it just hadn't been noticed yet for these three routes,
  // since it only bites when a session expires *while a page is already
  // open* (a fresh page load would already have been redirected to /login
  // by the SAME middleware before any client JS ran, so the gap was easy
  // to miss in normal testing).
  //
  // Since every API route already protects itself explicitly and returns
  // its own proper JSON error status, there's no protection lost by
  // excluding /api entirely here — only the redundant, and in these three
  // cases actively confusing, middleware-level redirect goes away.
  matcher: [
  "/((?!login|register|forgot-password|reset-password|api|_next/static|_next/image|favicon.ico|manifest.json|sw.js|icon-192.png|icon-512.png|apple-touch-icon.png).*)"
],

};
