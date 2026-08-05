export { default } from "next-auth/middleware";

export const config = {
  // Protect everything except: login, register, NextAuth's own API routes,
  // the register API route, Next.js static/internal assets, the PWA
  // static files (manifest/service-worker/icons — these load unauthenticated
  // on every page visit; without this exclusion they get redirected to
  // /login and the browser gets HTML back where it expected JSON, causing
  // "Manifest: Line 1 column 1 Syntax error"), and api/cron — cron jobs
  // (Vercel's own, or an external scheduler like cron-job.org) call these
  // routes with no session at all, just a CRON_SECRET bearer token checked
  // inside the route handler itself; without this exclusion the request
  // gets redirected to /login before the handler ever runs, and the
  // scheduler sees a redirect instead of the route's actual response
  // ("Redirection detected" in cron-job.org's test run).
  matcher: [
  "/((?!login|register|forgot-password|reset-password|api/auth|api/register|api/upload|api/admin|api/cron|_next/static|_next/image|favicon.ico|manifest.json|sw.js|icon-192.png|icon-512.png|apple-touch-icon.png).*)"
],

};
